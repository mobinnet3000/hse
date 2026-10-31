from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auditlog.services import log_event
from apps.core.access import (
    accessible_organization_ids,
    can_conduct_inspections,
    can_review,
    can_view_organization,
    is_active_member,
)
from apps.core.file_security import validate_file_upload
from apps.core.views_utils import resolve_organization
from apps.inspections.models import Inspection, InspectionResponse
from apps.organizations.models import Organization
from apps.workplaces.models import Workplace

from .models import NonConformity
from .serializers import NonConformitySerializer

NOT_FOUND = {"error": {"code": "not_found", "message": "موردی یافت نشد."}}
FORBIDDEN = {
    "error": {"code": "permission_denied", "message": "اجازه انجام این عملیات را ندارید."}
}


class NonConformityListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = NonConformity.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).select_related("organization", "workplace", "equipment", "inspection")
        organization_id = request.query_params.get("organization")
        if organization_id:
            try:
                organization_id = int(organization_id)
            except ValueError:
                return Response(
                    {
                        "error": {
                            "code": "invalid_parameter",
                            "message": "شناسه سازمان نامعتبر است.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not can_view_organization(request.user, organization_id):
                return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
            queryset = queryset.filter(organization_id=organization_id)
        nc_status = request.query_params.get("status")
        if nc_status:
            queryset = queryset.filter(status=nc_status)
        severity = request.query_params.get("severity")
        if severity:
            queryset = queryset.filter(severity=severity)
        inspection_id = request.query_params.get("inspection")
        if inspection_id:
            queryset = queryset.filter(inspection_id=inspection_id)
        return Response(NonConformitySerializer(queryset, many=True).data)

    def post(self, request):
        response_id = request.data.get("inspection_response")
        if response_id:
            return self._create_from_response(request, response_id)
        return self._create_manual(request)

    def _create_from_response(self, request, response_id):
        try:
            response_id = int(response_id)
        except (TypeError, ValueError):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        inspection_response = (
            InspectionResponse.objects.select_related("inspection")
            .filter(pk=response_id)
            .first()
        )
        if inspection_response is None or not can_view_organization(
            request.user, inspection_response.inspection.organization_id
        ):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_conduct_inspections(
            request.user, inspection_response.inspection.organization_id
        ):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        if inspection_response.result != InspectionResponse.Result.NONCONFORM:
            return Response(
                {
                    "error": {
                        "code": "not_nonconforming",
                        "message": "فقط پاسخ نامنطبق قابل تبدیل به عدم‌انطباق است.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if NonConformity.objects.filter(inspection_response=inspection_response).exists():
            return Response(
                {
                    "error": {
                        "code": "duplicate_nonconformity",
                        "message": "برای این پاسخ قبلاً عدم‌انطباق ثبت شده است.",
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = NonConformitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        responsible = serializer.validated_data.get("responsible")
        inspection = inspection_response.inspection
        if responsible is not None and not is_active_member(
            responsible, inspection.organization_id
        ):
            return Response(
                {
                    "error": {
                        "code": "invalid_responsible",
                        "message": "مسئول پیگیری باید عضو فعال سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        equipment = serializer.validated_data.get("equipment") or inspection.equipment
        if equipment is not None and equipment.organization_id != inspection.organization_id:
            return Response(
                {
                    "error": {
                        "code": "invalid_equipment",
                        "message": "تجهیز باید متعلق به همان سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        nc = serializer.save(
            organization=inspection.organization,
            inspection=inspection,
            inspection_response=inspection_response,
            workplace=inspection.workplace,
            equipment=equipment,
            source=NonConformity.Source.INSPECTION,
            created_by=request.user,
        )
        log_event(
            organization=nc.organization,
            actor=request.user,
            action="nonconformity.create",
            entity_type="nonconformity",
            entity_id=nc.pk,
            details={"inspection_id": inspection.pk},
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _create_manual(self, request):
        organization_id, error = resolve_organization(
            request, can_conduct_inspections
        )
        if error:
            return error
        serializer = NonConformitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        workplace = serializer.validated_data.get("workplace")
        if workplace is not None and workplace.organization_id != organization_id:
            return Response(
                {
                    "error": {
                        "code": "invalid_workplace",
                        "message": "محل کار باید متعلق به همان سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        inspection = serializer.validated_data.get("inspection")
        if inspection is not None and inspection.organization_id != organization_id:
            return Response(
                {
                    "error": {
                        "code": "invalid_inspection",
                        "message": "بازرسی باید متعلق به همان سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        equipment = serializer.validated_data.get("equipment")
        if equipment is not None and equipment.organization_id != organization_id:
            return Response(
                {
                    "error": {
                        "code": "invalid_equipment",
                        "message": "تجهیز باید متعلق به همان سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        responsible = serializer.validated_data.get("responsible")
        if responsible is not None and not is_active_member(
            responsible, organization_id
        ):
            return Response(
                {
                    "error": {
                        "code": "invalid_responsible",
                        "message": "مسئول پیگیری باید عضو فعال سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        nc = serializer.save(
            organization=Organization.objects.get(pk=organization_id),
            created_by=request.user,
        )
        log_event(
            organization=nc.organization,
            actor=request.user,
            action="nonconformity.create",
            entity_type="nonconformity",
            entity_id=nc.pk,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NonConformityDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        nc = (
            NonConformity.objects.select_related("organization", "workplace", "equipment", "inspection")
            .filter(pk=pk)
            .first()
        )
        if nc is None or not can_view_organization(request.user, nc.organization_id):
            return None
        return nc

    def get(self, request, pk):
        nc = self.get_object(request, pk)
        if nc is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(NonConformitySerializer(nc).data)

    def patch(self, request, pk):
        nc = self.get_object(request, pk)
        if nc is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_conduct_inspections(request.user, nc.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        if nc.status == NonConformity.Status.CLOSED:
            return Response(
                {
                    "error": {
                        "code": "nonconformity_closed",
                        "message": "عدم‌انطباق بسته‌شده قابل ویرایش نیست.",
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        new_status = request.data.get("status")
        if new_status is not None:
            if new_status == NonConformity.Status.CLOSED:
                return Response(
                    {
                        "error": {
                            "code": "use_close_endpoint",
                            "message": "برای بستن از endpoint اختصاصی استفاده کنید.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            allowed = {
                NonConformity.Status.OPEN: {NonConformity.Status.IN_PROGRESS},
                NonConformity.Status.IN_PROGRESS: {
                    NonConformity.Status.READY_FOR_REVIEW
                },
                NonConformity.Status.READY_FOR_REVIEW: {
                    NonConformity.Status.IN_PROGRESS
                },
            }
            if new_status not in allowed.get(nc.status, set()):
                return Response(
                    {
                        "error": {
                            "code": "invalid_transition",
                            "message": "تغییر وضعیت مجاز نیست.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            nc.status = new_status

        data = request.data.copy()
        data.pop("status", None)
        data.pop("organization", None)
        serializer = NonConformitySerializer(nc, data=data, partial=True)
        serializer.is_valid(raise_exception=True)

        workplace = serializer.validated_data.get("workplace")
        if workplace is not None and workplace.organization_id != nc.organization_id:
            return Response(
                {
                    "error": {
                        "code": "invalid_workplace",
                        "message": "محل کار باید متعلق به همان سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        equipment = serializer.validated_data.get("equipment")
        if equipment is not None and equipment.organization_id != nc.organization_id:
            return Response(
                {
                    "error": {
                        "code": "invalid_equipment",
                        "message": "تجهیز باید متعلق به همان سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        responsible = serializer.validated_data.get("responsible")
        if responsible is not None and not is_active_member(
            responsible, nc.organization_id
        ):
            return Response(
                {
                    "error": {
                        "code": "invalid_responsible",
                        "message": "مسئول پیگیری باید عضو فعال سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        nc = serializer.save()
        log_event(
            organization=nc.organization,
            actor=request.user,
            action="nonconformity.update",
            entity_type="nonconformity",
            entity_id=nc.pk,
            details={"status": nc.status},
        )
        return Response(NonConformitySerializer(nc).data)


class NonConformityCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        nc = NonConformity.objects.filter(pk=pk).first()
        if nc is None or not can_view_organization(request.user, nc.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_review(request.user, nc.organization_id):
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "بستن عدم‌انطباق نیازمند نقش بررسی‌کننده است.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if nc.status != NonConformity.Status.READY_FOR_REVIEW:
            return Response(
                {
                    "error": {
                        "code": "invalid_transition",
                        "message": "عدم‌انطباق باید در وضعیت آماده بررسی باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        actions = nc.corrective_actions.all()
        if not actions.exists():
            return Response(
                {
                    "error": {
                        "code": "no_corrective_actions",
                        "message": "بدون اقدام اصلاحی، عدم‌انطباق قابل بستن نیست.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if actions.exclude(status="completed").exists():
            return Response(
                {
                    "error": {
                        "code": "open_corrective_actions",
                        "message": "همه اقدامات اصلاحی باید تکمیل شوند.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        nc.status = NonConformity.Status.CLOSED
        nc.closed_by = request.user
        nc.closed_at = timezone.now()
        nc.save(update_fields=["status", "closed_by", "closed_at", "updated_at"])
        log_event(
            organization=nc.organization,
            actor=request.user,
            action="nonconformity.close",
            entity_type="nonconformity",
            entity_id=nc.pk,
        )
        return Response(NonConformitySerializer(nc).data)


class NonConformityReopenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from .models import AnomalyEvidence
        nc = NonConformity.objects.filter(pk=pk).first()
        if nc is None or not can_view_organization(request.user, nc.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_review(request.user, nc.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        if nc.status != NonConformity.Status.CLOSED:
            return Response(
                {"error": {"code": "not_closed", "message": "فقط موارد بسته شده قابلیت بازگشایی مجدد دارند."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get("reopened_reason", "").strip()
        if not reason:
            return Response(
                {"error": {"code": "reason_required", "message": "ذکر دلیل بازگشایی مجدد عدم‌انطباق الزامی است."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nc.status = NonConformity.Status.OPEN
        nc.reopened_count += 1
        nc.reopened_reason = reason
        nc.closed_by = None
        nc.closed_at = None
        nc.save()
        log_event(
            organization=nc.organization,
            actor=request.user,
            action="nonconformity.reopen",
            entity_type="nonconformity",
            entity_id=nc.pk,
            details={"reopened_reason": reason},
        )
        return Response(NonConformitySerializer(nc).data)


class NonConformityEvidenceUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from .models import AnomalyEvidence
        nc = NonConformity.objects.filter(pk=pk).first()
        if nc is None or not can_view_organization(request.user, nc.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response(
                {"error": {"code": "no_file", "message": "فایل مدرک پیوست نشده است."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        validate_file_upload(file_obj)
        caption = request.data.get("caption", "")
        evidence = AnomalyEvidence.objects.create(
            non_conformity=nc,
            file=file_obj,
            caption=caption,
        )
        return Response(
            {"id": evidence.id, "file": evidence.file.url, "caption": evidence.caption},
            status=status.HTTP_201_CREATED,
        )

