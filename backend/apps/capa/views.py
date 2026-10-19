from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auditlog.services import log_event
from apps.notifications.services import notify_user
from apps.core.access import (
    accessible_organization_ids,
    can_conduct_inspections,
    can_review,
    can_view_organization,
    is_active_member,
)
from apps.findings.models import NonConformity

from .models import CorrectiveAction
from .serializers import CorrectiveActionSerializer

NOT_FOUND = {"error": {"code": "not_found", "message": "موردی یافت نشد."}}
FORBIDDEN = {
    "error": {"code": "permission_denied", "message": "اجازه انجام این عملیات را ندارید."}
}


def can_edit_action(user, action):
    if can_conduct_inspections(user, action.organization_id):
        return True
    return action.responsible_id == getattr(user, "pk", None)


class CorrectiveActionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = CorrectiveAction.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).select_related("non_conformity", "organization")
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
        nc_id = request.query_params.get("non_conformity")
        if nc_id:
            queryset = queryset.filter(non_conformity_id=nc_id)
        action_status = request.query_params.get("status")
        if action_status:
            queryset = queryset.filter(status=action_status)
        return Response(CorrectiveActionSerializer(queryset, many=True).data)

    def post(self, request):
        serializer = CorrectiveActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        nc = serializer.validated_data["non_conformity"]
        if not can_view_organization(request.user, nc.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if nc.status == NonConformity.Status.CLOSED:
            return Response(
                {
                    "error": {
                        "code": "nonconformity_closed",
                        "message": "عدم‌انطباق بسته‌شده قابل تغییر نیست.",
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )
        if not can_conduct_inspections(request.user, nc.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        responsible = serializer.validated_data.get("responsible")
        if responsible is not None and not is_active_member(
            responsible, nc.organization_id
        ):
            return Response(
                {
                    "error": {
                        "code": "invalid_responsible",
                        "message": "مسئول اجرا باید عضو فعال سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        action = serializer.save(
            organization=nc.organization,
            created_by=request.user,
        )
        if action.responsible:
            notify_user(
                user=action.responsible,
                organization=action.organization,
                title="اقدام اصلاحی جدید",
                message=f"یک اقدام اصلاحی جدید به شما اختصاص داده شد: {action.description[:40]}"
            )
        log_event(
            organization=action.organization,
            actor=request.user,
            action="correctiveaction.create",
            entity_type="correctiveaction",
            entity_id=action.pk,
            details={"non_conformity_id": nc.pk},
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CorrectiveActionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        action = (
            CorrectiveAction.objects.select_related("non_conformity", "organization")
            .filter(pk=pk)
            .first()
        )
        if action is None or not can_view_organization(
            request.user, action.organization_id
        ):
            return None
        return action

    def get(self, request, pk):
        action = self.get_object(request, pk)
        if action is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(CorrectiveActionSerializer(action).data)

    def patch(self, request, pk):
        action = self.get_object(request, pk)
        if action is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        is_editor = can_conduct_inspections(request.user, action.organization_id)
        if not can_edit_action(request.user, action):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        if not is_editor and set(request.data.keys()) - {"status", "result_text"}:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "فقط وضعیت و نتیجه اجرا قابل تغییر است.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if action.status == CorrectiveAction.Status.COMPLETED:
            return Response(
                {
                    "error": {
                        "code": "action_completed",
                        "message": "اقدام تکمیل‌شده قابل ویرایش نیست.",
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        new_status = request.data.get("status")
        if new_status is not None:
            if new_status == CorrectiveAction.Status.COMPLETED:
                return Response(
                    {
                        "error": {
                            "code": "use_verify_endpoint",
                            "message": "تکمیل نهایی نیازمند endpoint تأیید است.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            allowed = {
                CorrectiveAction.Status.OPEN: {CorrectiveAction.Status.IN_PROGRESS},
                CorrectiveAction.Status.IN_PROGRESS: {
                    CorrectiveAction.Status.PENDING_VERIFICATION
                },
                CorrectiveAction.Status.PENDING_VERIFICATION: {
                    CorrectiveAction.Status.IN_PROGRESS
                },
            }
            if new_status not in allowed.get(action.status, set()):
                return Response(
                    {
                        "error": {
                            "code": "invalid_transition",
                            "message": "تغییر وضعیت مجاز نیست.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if (
                new_status == CorrectiveAction.Status.PENDING_VERIFICATION
                and not (
                    request.data.get("result_text")
                    or action.result_text
                ).strip()
            ):
                return Response(
                    {
                        "error": {
                            "code": "result_required",
                            "message": "نتیجه اجرا برای ارسال به بررسی لازم است.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            action.status = new_status

        data = request.data.copy()
        data.pop("status", None)
        data.pop("organization", None)
        serializer = CorrectiveActionSerializer(action, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        responsible = serializer.validated_data.get("responsible")
        if responsible is not None and not is_active_member(
            responsible, action.organization_id
        ):
            return Response(
                {
                    "error": {
                        "code": "invalid_responsible",
                        "message": "مسئول اجرا باید عضو فعال سازمان باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_responsible_id = action.responsible_id
        action = serializer.save()
        if action.responsible and action.responsible_id != old_responsible_id:
            notify_user(
                user=action.responsible,
                organization=action.organization,
                title="تخصیص اقدام اصلاحی",
                message=f"اقدام اصلاحی شماره {action.id} به شما واگذار شد: {action.description[:40]}"
            )
        log_event(
            organization=action.organization,
            actor=request.user,
            action="correctiveaction.update",
            entity_type="correctiveaction",
            entity_id=action.pk,
            details={"status": action.status},
        )
        return Response(CorrectiveActionSerializer(action).data)



class CorrectiveActionVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        action = CorrectiveAction.objects.filter(pk=pk).first()
        if action is None or not can_view_organization(
            request.user, action.organization_id
        ):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_review(request.user, action.organization_id):
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "تأیید اثربخشی نیازمند نقش بررسی‌کننده است.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if action.status != CorrectiveAction.Status.PENDING_VERIFICATION:
            return Response(
                {
                    "error": {
                        "code": "invalid_transition",
                        "message": "اقدام باید در انتظار تأیید باشد.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not action.result_text.strip():
            return Response(
                {
                    "error": {
                        "code": "result_required",
                        "message": "نتیجه اجرا ثبت نشده است.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        action.status = CorrectiveAction.Status.COMPLETED
        action.effectiveness_verified = True
        action.verified_by = request.user
        action.verified_at = timezone.now()
        action.save(
            update_fields=[
                "status",
                "effectiveness_verified",
                "verified_by",
                "verified_at",
                "updated_at",
            ]
        )
        log_event(
            organization=action.organization,
            actor=request.user,
            action="correctiveaction.verify",
            entity_type="correctiveaction",
            entity_id=action.pk,
        )
        return Response(CorrectiveActionSerializer(action).data)

