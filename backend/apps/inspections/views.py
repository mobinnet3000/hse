from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auditlog.services import log_event
from apps.checklists.models import Checklist
from apps.core.access import (
    accessible_organization_ids,
    can_conduct_inspections,
    can_view_organization,
    is_active_member,
)
from apps.core.views_utils import resolve_organization
from apps.organizations.models import Organization
from apps.workplaces.models import Workplace

from .models import Inspection, InspectionResponse
from .serializers import (
    InspectionDetailSerializer,
    InspectionResponseSerializer,
    InspectionSerializer,
)

NOT_FOUND = {"error": {"code": "not_found", "message": "موردی یافت نشد."}}
FORBIDDEN = {
    "error": {"code": "permission_denied", "message": "اجازه انجام این عملیات را ندارید."}
}


class InspectionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Inspection.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).select_related("checklist", "workplace", "equipment", "organization")
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
        inspection_status = request.query_params.get("status")
        if inspection_status:
            queryset = queryset.filter(status=inspection_status)
        workplace_id = request.query_params.get("workplace")
        if workplace_id:
            queryset = queryset.filter(workplace_id=workplace_id)
        return Response(InspectionSerializer(queryset, many=True).data)

    def post(self, request):
        organization_id, error = resolve_organization(request, can_conduct_inspections)
        if error:
            return error
        serializer = InspectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        checklist = Checklist.objects.filter(
            pk=serializer.validated_data["checklist"].pk,
            organization_id=organization_id,
            is_active=True,
        ).first()
        if checklist is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not checklist.items.exists():
            return Response(
                {
                    "error": {
                        "code": "empty_checklist",
                        "message": "چک‌لیست هیچ آیتمی ندارد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        inspector = serializer.validated_data.get("inspector")
        if inspector is not None and not is_active_member(inspector, organization_id):
            return Response(
                {
                    "error": {
                        "code": "invalid_inspector",
                        "message": "بازرس باید عضو فعال سازمان باشد.",
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

        inspection = Inspection.objects.create(
            organization=Organization.objects.get(pk=organization_id),
            checklist=checklist,
            workplace=workplace,
            equipment=equipment,
            title=serializer.validated_data.get("title") or checklist.title,
            inspector=inspector or request.user,
            scheduled_at=serializer.validated_data.get("scheduled_at"),
            notes=serializer.validated_data.get("notes", ""),
            created_by=request.user,
        )
        InspectionResponse.objects.bulk_create(
            [
                InspectionResponse(
                    inspection=inspection,
                    item=item,
                    item_text=item.text,
                    is_required=item.is_required,
                    order=item.order,
                )
                for item in checklist.items.all()
            ]
        )
        log_event(
            organization=inspection.organization,
            actor=request.user,
            action="inspection.create",
            entity_type="inspection",
            entity_id=inspection.pk,
        )
        return Response(
            InspectionDetailSerializer(inspection).data,
            status=status.HTTP_201_CREATED,
        )


class InspectionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        inspection = (
            Inspection.objects.select_related("checklist", "workplace", "equipment", "organization")
            .prefetch_related("responses")
            .filter(pk=pk)
            .first()
        )
        if inspection is None or not can_view_organization(
            request.user, inspection.organization_id
        ):
            return None
        return inspection

    def get(self, request, pk):
        inspection = self.get_object(request, pk)
        if inspection is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(InspectionDetailSerializer(inspection).data)

    def patch(self, request, pk):
        inspection = self.get_object(request, pk)
        if inspection is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if inspection.status == Inspection.Status.COMPLETED:
            return Response(
                {
                    "error": {
                        "code": "inspection_completed",
                        "message": "بازرسی تکمیل‌شده قابل ویرایش نیست.",
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )
        if not can_conduct_inspections(request.user, inspection.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get("status")
        if new_status is not None:
            allowed = {
                Inspection.Status.DRAFT: {Inspection.Status.IN_PROGRESS},
                Inspection.Status.IN_PROGRESS: {Inspection.Status.CANCELLED},
                Inspection.Status.CANCELLED: set(),
            }
            if new_status not in allowed.get(inspection.status, set()):
                return Response(
                    {
                        "error": {
                            "code": "invalid_transition",
                            "message": "تغییر وضعیت مجاز نیست.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            inspection.status = new_status
            if new_status == Inspection.Status.IN_PROGRESS:
                inspection.performed_at = timezone.now()

        data = request.data.copy()
        data.pop("status", None)
        data.pop("organization", None)
        serializer = InspectionSerializer(inspection, data=data, partial=True)
        serializer.is_valid(raise_exception=True)

        workplace = serializer.validated_data.get("workplace")
        if workplace is not None and workplace.organization_id != inspection.organization_id:
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
        inspector = serializer.validated_data.get("inspector")
        if inspector is not None and not is_active_member(
            inspector, inspection.organization_id
        ):
            return Response(
                {
                    "error": {
                        "code": "invalid_inspector",
                        "message": "بازرس باید عضو فعال سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        inspection = serializer.save()
        log_event(
            organization=inspection.organization,
            actor=request.user,
            action="inspection.update",
            entity_type="inspection",
            entity_id=inspection.pk,
            details={"status": inspection.status},
        )
        return Response(InspectionDetailSerializer(inspection).data)


class InspectionResponseUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        response = (
            InspectionResponse.objects.select_related("inspection")
            .filter(pk=pk)
            .first()
        )
        if response is None or not can_view_organization(
            request.user, response.inspection.organization_id
        ):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if response.inspection.status == Inspection.Status.COMPLETED:
            return Response(
                {
                    "error": {
                        "code": "inspection_completed",
                        "message": "پاسخ‌های بازرسی تکمیل‌شده قابل ویرایش نیستند.",
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )
        if not can_conduct_inspections(
            request.user, response.inspection.organization_id
        ):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        serializer = InspectionResponseSerializer(
            response, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class InspectionCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        inspection = Inspection.objects.filter(pk=pk).first()
        if inspection is None or not can_view_organization(
            request.user, inspection.organization_id
        ):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_conduct_inspections(request.user, inspection.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        if inspection.status == Inspection.Status.COMPLETED:
            return Response(
                {
                    "error": {
                        "code": "inspection_completed",
                        "message": "بازرسی قبلاً تکمیل شده است.",
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )
        if inspection.status != Inspection.Status.IN_PROGRESS:
            return Response(
                {
                    "error": {
                        "code": "invalid_transition",
                        "message": "بازرسی باید در حال اجرا باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        missing = inspection.responses.filter(is_required=True, result="")
        if missing.exists():
            return Response(
                {
                    "error": {
                        "code": "required_responses_missing",
                        "message": "پاسخ همه آیتم‌های الزامی ثبت نشده است.",
                        "details": list(missing.values_list("id", "item_text")),
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        inspection.status = Inspection.Status.COMPLETED
        inspection.completed_at = timezone.now()
        inspection.save(update_fields=["status", "completed_at", "updated_at"])
        log_event(
            organization=inspection.organization,
            actor=request.user,
            action="inspection.complete",
            entity_type="inspection",
            entity_id=inspection.pk,
        )
        return Response(InspectionDetailSerializer(inspection).data)
