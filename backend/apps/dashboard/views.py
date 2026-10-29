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
from .indicators_engine import compute_organization_indicators


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


class ProactiveIndicatorsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization_id = request.query_params.get("organization")
        from apps.organizations.models import Organization
        if organization_id:
            try:
                org_id = int(organization_id)
            except ValueError:
                return Response({"error": {"code": "invalid_parameter", "message": "شناسه سازمان نامعتبر است."}}, status=400)
            if not can_view_organization(request.user, org_id):
                return Response({"error": {"code": "not_found", "message": "سازمان یافت نشد."}}, status=404)
            try:
                org = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                return Response({"error": {"code": "not_found", "message": "سازمان یافت نشد."}}, status=404)
        else:
            org = resolve_organization(request)
            if not org:
                acc_ids = list(accessible_organization_ids(request.user))
                org = Organization.objects.filter(id__in=acc_ids).first()

        if not org:
            return Response({"error": {"code": "no_organization", "message": "هیچ سازمانی برای کاربر یافت نشد."}}, status=404)

        try:
            days = int(request.query_params.get("days", 90))
        except ValueError:
            days = 90

        data = compute_organization_indicators(org, days=days)
        data["organization_id"] = org.id
        data["organization_name"] = org.name
        return Response(data)


class PersonalWorkspaceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        org_ids = list(accessible_organization_ids(user))
        today = timezone.now().date()

        # 1. Pending Approvals
        from apps.permits.models import Permit
        pending_permits = list(
            Permit.objects.filter(
                organization_id__in=org_ids,
                status="submitted",
            ).values("id", "permit_number", "title", "permit_type", "created_at")[:10]
        )

        from apps.lifting.models import LiftingPlan
        pending_lifts = list(
            LiftingPlan.objects.filter(
                organization_id__in=org_ids,
                status__in=["submitted", "under_review"],
            ).values("id", "plan_number", "title", "lift_category", "created_at")[:10]
        )

        from apps.pssr.models import PSSRReview
        pending_pssr = list(
            PSSRReview.objects.filter(
                organization_id__in=org_ids,
                status="submitted",
            ).values("id", "reference_number", "title", "category", "target_startup_date")[:10]
        )

        # 2. My Tasks
        my_actions_qs = CorrectiveAction.objects.filter(
            organization_id__in=org_ids,
            responsible=user,
        ).exclude(status="completed")
        my_actions = [
            {
                "id": act.id,
                "description": act.description,
                "due_date": act.due_date,
                "status": act.status,
                "is_overdue": bool(act.due_date and act.due_date < today),
            }
            for act in my_actions_qs[:15]
        ]

        from apps.inspections.models import Inspection
        my_inspections = list(
            Inspection.objects.filter(
                organization_id__in=org_ids,
                inspector=user,
                status__in=["draft", "in_progress"],
            ).values("id", "title", "scheduled_at", "status")[:10]
        )

        # 3. Unread counts
        from apps.notifications.models import Notification
        unread_notifications = Notification.objects.filter(user=user, is_read=False).count()

        from apps.chat.models import ChatParticipant
        unread_messages_count = sum(
            part.unread_count for part in ChatParticipant.objects.filter(user=user, is_active=True)
        )

        return Response({
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.get_full_name() or user.username,
            },
            "unread_counts": {
                "notifications": unread_notifications,
                "messages": unread_messages_count,
            },
            "pending_approvals": {
                "permits": pending_permits,
                "lifting_plans": pending_lifts,
                "pssr_reviews": pending_pssr,
                "total": len(pending_permits) + len(pending_lifts) + len(pending_pssr),
            },
            "my_tasks": {
                "actions": my_actions,
                "inspections": my_inspections,
                "total": len(my_actions) + len(my_inspections),
            },
        })
