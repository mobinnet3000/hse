from datetime import date
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import accessible_organization_ids, can_view_organization
from apps.core.views_utils import resolve_organization
from apps.organizations.models import Organization

from .models import Scaffold, ScaffoldInspection, ScaffoldTagLog
from .serializers import (
    ScaffoldInspectionSerializer,
    ScaffoldSerializer,
    ScaffoldTagLogSerializer,
)
from .services import change_scaffold_tag, record_scaffold_inspection


class ScaffoldViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ScaffoldSerializer

    def get_queryset(self):
        user = self.request.user
        org_ids = accessible_organization_ids(user)
        qs = Scaffold.objects.filter(organization_id__in=org_ids).select_related(
            "workplace", "contractor"
        ).prefetch_related("inspections")
        org_param = self.request.query_params.get("organization")
        if org_param and org_param.isdigit():
            if int(org_param) in org_ids:
                qs = qs.filter(organization_id=int(org_param))
            else:
                return qs.none()
        tag_status = self.request.query_params.get("tag_status")
        if tag_status:
            qs = qs.filter(tag_status=tag_status)
        return qs

    def perform_create(self, serializer):
        org_param = self.request.data.get("organization") or self.request.query_params.get("organization")
        user = self.request.user
        org_ids = accessible_organization_ids(user)
        if org_param:
            try:
                org_id = int(org_param)
            except (ValueError, TypeError):
                raise ValidationError({"organization": "شناسه سازمان نامعتبر است."})
            if org_id not in org_ids:
                raise PermissionDenied("دسترسی به این سازمان مجاز نیست.")
        elif len(org_ids) >= 1:
            org_id = list(org_ids)[0]
        else:
            raise ValidationError({"organization": "شناسه سازمان لازم است."})

        org = Organization.objects.get(pk=org_id)
        serializer.save(organization=org)

    @action(detail=True, methods=["post"], url_path="change-tag")
    def change_tag(self, request, pk=None):
        scaffold = self.get_object()
        new_tag = request.data.get("new_tag")
        reason = request.data.get("reason")
        yellow_restrictions = request.data.get("yellow_restrictions", "")

        if not new_tag:
            return Response({"new_tag": ["انتخاب تگ جدید الزامی است."]}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({"reason": ["درج علت تغییر تگ الزامی است."]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            updated = change_scaffold_tag(
                scaffold=scaffold,
                new_tag=new_tag,
                reason=reason,
                actor=request.user,
                yellow_restrictions=yellow_restrictions,
            )
            return Response(ScaffoldSerializer(updated).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="inspect")
    def inspect(self, request, pk=None):
        scaffold = self.get_object()
        data = request.data

        inspector_name = data.get("inspector_name", "") or request.user.get_full_name() or request.user.username
        result_tag = data.get("result_tag", Scaffold.TagStatus.GREEN_SAFE)
        validity_days = int(data.get("validity_days", 7))
        findings = data.get("findings", "")
        restrictions_notes = data.get("restrictions_notes", "")

        try:
            inspection = record_scaffold_inspection(
                scaffold=scaffold,
                inspector_name=inspector_name,
                result_tag=result_tag,
                validity_days=validity_days,
                base_plates_ok=bool(data.get("base_plates_ok", True)),
                bracing_ok=bool(data.get("bracing_ok", True)),
                guardrails_ok=bool(data.get("guardrails_ok", True)),
                toeboards_ok=bool(data.get("toeboards_ok", True)),
                planks_decking_ok=bool(data.get("planks_decking_ok", True)),
                ties_anchors_ok=bool(data.get("ties_anchors_ok", True)),
                ladder_access_ok=bool(data.get("ladder_access_ok", True)),
                findings=findings,
                restrictions_notes=restrictions_notes,
                inspector=request.user,
            )
            return Response(ScaffoldInspectionSerializer(inspection).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        scaffold = self.get_object()
        logs = ScaffoldTagLog.objects.filter(scaffold=scaffold).select_related("changed_by")
        return Response(ScaffoldTagLogSerializer(logs, many=True).data)

    @action(detail=True, methods=["get"], url_path="tag-card")
    def tag_card(self, request, pk=None):
        scaffold = self.get_object()
        return Response({
            "tag_number": scaffold.tag_number,
            "organization_name": scaffold.organization.name,
            "workplace_name": scaffold.workplace.name,
            "location_details": scaffold.location_details,
            "scaffold_type_display": scaffold.get_scaffold_type_display(),
            "load_duty_display": scaffold.get_load_duty_display(),
            "tag_status": scaffold.tag_status,
            "tag_status_display": scaffold.get_tag_status_display(),
            "valid_until": scaffold.current_tag_valid_until,
            "next_inspection_due": scaffold.next_inspection_due,
            "is_overdue": scaffold.is_inspection_overdue,
            "restrictions": scaffold.yellow_restrictions,
            "erected_by": scaffold.erected_by or (scaffold.contractor.name if scaffold.contractor else "-"),
            "qr_payload": f"HSE-SCAFFOLD:{scaffold.organization_id}:{scaffold.tag_number}",
        })


class ScaffoldInspectionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ScaffoldInspectionSerializer

    def get_queryset(self):
        user = self.request.user
        org_ids = accessible_organization_ids(user)
        return ScaffoldInspection.objects.filter(organization_id__in=org_ids).select_related(
            "scaffold", "inspector", "non_conformity"
        )


class ScaffoldSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        org_ids = accessible_organization_ids(user)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            org_id = int(org_param)
            if org_id not in org_ids:
                return Response(
                    {"error": {"code": "forbidden", "message": "دسترسی به این سازمان مجاز نیست."}},
                    status=status.HTTP_403_FORBIDDEN,
                )
            scaffolds = Scaffold.objects.filter(organization_id=org_id)
        else:
            scaffolds = Scaffold.objects.filter(organization_id__in=org_ids)

        today = date.today()

        green_count = scaffolds.filter(tag_status=Scaffold.TagStatus.GREEN_SAFE).count()
        yellow_count = scaffolds.filter(tag_status=Scaffold.TagStatus.YELLOW_RESTRICTED).count()
        red_count = scaffolds.filter(tag_status=Scaffold.TagStatus.RED_UNSAFE).count()
        dismantled_count = scaffolds.filter(tag_status=Scaffold.TagStatus.DISMANTLED).count()

        overdue_count = sum(1 for s in scaffolds if s.is_inspection_overdue)

        return Response({
            "total_scaffolds": scaffolds.count(),
            "green_count": green_count,
            "yellow_count": yellow_count,
            "red_count": red_count,
            "dismantled_count": dismantled_count,
            "overdue_inspections_count": overdue_count,
        })
