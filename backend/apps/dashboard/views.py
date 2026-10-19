from datetime import date, timedelta
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.capa.models import CorrectiveAction
from apps.core.access import accessible_organization_ids, can_view_organization
from apps.core.views_utils import resolve_organization
from apps.findings.models import NonConformity
from apps.inspections.models import Inspection
from apps.risks.models import Hazard, RiskAssessment

class DashboardMetricsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization_id = request.query_params.get("organization")
        if organization_id:
            try:
                organization_id = int(organization_id)
            except ValueError:
                return Response({"error": {"code": "invalid_parameter", "message": "شناسه سازمان نامعتبر است."}}, status=400)
            if not can_view_organization(request.user, organization_id):
                return Response({"error": {"code": "not_found", "message": "سازمان یافت نشد."}}, status=404)
            org_ids = [organization_id]
        else:
            org_ids = list(accessible_organization_ids(request.user))

        today = timezone.now().date()
        upcoming = today + timedelta(days=7)

        # Inspections by status
        inspections_data = dict(
            Inspection.objects.filter(organization_id__in=org_ids)
            .values("status")
            .annotate(count=Count("id"))
            .values_list("status", "count")
        )

        # Risks by level
        risks_data = dict(
            RiskAssessment.objects.filter(organization_id__in=org_ids)
            .values("level")
            .annotate(count=Count("id"))
            .values_list("level", "count")
        )

        # Non-conformities by status
        nc_data = dict(
            NonConformity.objects.filter(organization_id__in=org_ids)
            .values("status")
            .annotate(count=Count("id"))
            .values_list("status", "count")
        )

        # Corrective Actions metrics
        actions_qs = CorrectiveAction.objects.filter(organization_id__in=org_ids)
        open_actions = actions_qs.filter(status__in=["open", "in_progress", "pending_verification"]).count()
        completed_actions = actions_qs.filter(status="completed").count()
        overdue_actions = actions_qs.filter(
            status__in=["open", "in_progress", "pending_verification"],
            due_date__lt=today
        ).count()

        # Upcoming/Overdue items lists
        urgent_inspections = Inspection.objects.filter(
            organization_id__in=org_ids,
            status__in=["draft", "in_progress"],
            scheduled_at__isnull=False,
            scheduled_at__date__lte=upcoming
        ).order_by("scheduled_at").values("id", "title", "scheduled_at", "status")[:10]

        urgent_actions = actions_qs.filter(
            status__in=["open", "in_progress", "pending_verification"],
            due_date__isnull=False,
            due_date__lte=upcoming
        ).order_by("due_date").values("id", "description", "due_date", "status")[:10]

        formatted_inspections = [
            {
                "id": item["id"],
                "title": item["title"],
                "scheduled_at": item["scheduled_at"],
                "status": item["status"],
                "is_overdue": item["scheduled_at"].date() < today if item.get("scheduled_at") else False,
            }
            for item in urgent_inspections
        ]

        formatted_actions = [
            {
                "id": item["id"],
                "description": item["description"],
                "due_date": item["due_date"],
                "status": item["status"],
                "is_overdue": item["due_date"] < today if item.get("due_date") else False,
            }
            for item in urgent_actions
        ]

        return Response({
            "inspections": {
                "draft": inspections_data.get("draft", 0),
                "in_progress": inspections_data.get("in_progress", 0),
                "completed": inspections_data.get("completed", 0),
                "cancelled": inspections_data.get("cancelled", 0),
                "total": sum(inspections_data.values()),
            },
            "risks": {
                "low": risks_data.get("low", 0),
                "medium": risks_data.get("medium", 0),
                "high": risks_data.get("high", 0),
                "critical": risks_data.get("critical", 0),
                "total": sum(risks_data.values()),
                "hazards_count": Hazard.objects.filter(organization_id__in=org_ids).count(),
            },
            "non_conformities": {
                "open": nc_data.get("open", 0),
                "in_progress": nc_data.get("in_progress", 0),
                "ready_for_review": nc_data.get("ready_for_review", 0),
                "closed": nc_data.get("closed", 0),
                "total": sum(nc_data.values()),
            },
            "corrective_actions": {
                "open": open_actions,
                "completed": completed_actions,
                "overdue": overdue_actions,
                "total": actions_qs.count(),
            },
            "urgent_deadlines": {
                "inspections": formatted_inspections,
                "actions": formatted_actions,
            }
        })

