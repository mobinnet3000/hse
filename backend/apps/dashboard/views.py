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
            ).values("id", "reference_code", "title", "permit_type", "created_at")[:10]
        )

        from apps.lifting.models import LiftingPlan
        pending_lifts = list(
            LiftingPlan.objects.filter(
                organization_id__in=org_ids,
                status__in=["submitted", "under_review"],
            ).values("id", "plan_number", "title", "category", "created_at")[:10]
        )

        from apps.pssr.models import PSSRReview
        pending_pssr = list(
            PSSRReview.objects.filter(
                organization_id__in=org_ids,
                status="submitted",
            ).values("id", "pssr_number", "project_or_system_name", "review_type", "target_startup_date")[:10]
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

        from apps.chat.models import ChatParticipant, ChatMessage
        unread_messages_count = 0
        for part in ChatParticipant.objects.filter(user=user).select_related("conversation"):
            msg_filter = Q(conversation=part.conversation) & ~Q(sender=user)
            if part.last_read_at:
                msg_filter &= Q(created_at__gt=part.last_read_at)
            unread_messages_count += ChatMessage.objects.filter(msg_filter).count()

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

from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import HSEStrategicGoal, HSEBudgetProgram
from .serializers import HSEStrategicGoalSerializer, HSEBudgetProgramSerializer
from apps.core.events import EventBus, Events


class HSEStrategicGoalListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_ids = accessible_organization_ids(request.user)
        queryset = HSEStrategicGoal.objects.filter(organization_id__in=org_ids)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            queryset = queryset.filter(organization_id=int(org_param))
        fiscal_year = request.query_params.get("fiscal_year")
        if fiscal_year:
            queryset = queryset.filter(fiscal_year=fiscal_year)
        serializer = HSEStrategicGoalSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        org_ids = accessible_organization_ids(request.user)
        org_id = request.data.get("organization")
        if not org_id or int(org_id) not in org_ids:
            if len(org_ids) == 1:
                org_id = list(org_ids)[0]
            else:
                return Response({"error": "شناسه سازمان معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = HSEStrategicGoalSerializer(data=request.data)
        if serializer.is_valid():
            goal = serializer.save(organization_id=org_id)
            EventBus.publish(Events.STRATEGIC_GOAL_UPDATED, {
                "goal_id": goal.id,
                "title": goal.title,
                "pillar": goal.pillar,
                "current": float(goal.current_value),
                "target": float(goal.target_value),
            }, user_id=request.user.id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class HSEStrategicGoalDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        org_ids = accessible_organization_ids(request.user)
        goal = get_object_or_404(HSEStrategicGoal, pk=pk, organization_id__in=org_ids)
        return Response(HSEStrategicGoalSerializer(goal).data)

    def patch(self, request, pk):
        org_ids = accessible_organization_ids(request.user)
        goal = get_object_or_404(HSEStrategicGoal, pk=pk, organization_id__in=org_ids)
        serializer = HSEStrategicGoalSerializer(goal, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            EventBus.publish(Events.STRATEGIC_GOAL_UPDATED, {
                "goal_id": updated.id,
                "title": updated.title,
                "pillar": updated.pillar,
                "current": float(updated.current_value),
                "target": float(updated.target_value),
            }, user_id=request.user.id)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class HSEBudgetProgramListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_ids = accessible_organization_ids(request.user)
        queryset = HSEBudgetProgram.objects.filter(organization_id__in=org_ids)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            queryset = queryset.filter(organization_id=int(org_param))
        fiscal_year = request.query_params.get("fiscal_year")
        if fiscal_year:
            queryset = queryset.filter(fiscal_year=fiscal_year)
        serializer = HSEBudgetProgramSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        org_ids = accessible_organization_ids(request.user)
        org_id = request.data.get("organization")
        if not org_id or int(org_id) not in org_ids:
            if len(org_ids) == 1:
                org_id = list(org_ids)[0]
            else:
                return Response({"error": "شناسه سازمان معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = HSEBudgetProgramSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(organization_id=org_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class HSEKPIEngineView(APIView):
    """
    موتور محاسباتی شاخص‌های کلیدی عملکرد HSE (KPI Engine)
    محاسبه نرخ حوادث شدید و تلفاتی (LTIFR/TRIR) و شاخص‌های پیشرو (Leading Indicators)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_ids = accessible_organization_ids(request.user)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            if int(org_param) in org_ids:
                org_ids = [int(org_param)]

        from apps.incidents.models import Incident
        from apps.inspections.models import Inspection
        from apps.capa.models import CorrectiveAction
        from apps.surveys.models import BehaviorObservation
        from apps.workforce.models import AttendanceRecord, EmployeeCompetency

        # Man-hours worked
        # Default estimation: 200,000 baseline hours per org or attendance calculation
        man_hours_records = AttendanceRecord.objects.filter(organization_id__in=org_ids)
        if man_hours_records.exists():
            total_man_hours = float(sum(r.man_hours for r in man_hours_records))
        else:
            total_man_hours = 250000.0 * max(len(org_ids), 1)

        # Incidents calculations
        incidents = Incident.objects.filter(organization_id__in=org_ids)
        total_incidents = incidents.count()
        lti_count = incidents.filter(severity__in=["lost_time_injury", "fatality", "major"]).count()
        lost_days = sum(getattr(i, "lost_workdays", 0) or 0 for i in incidents)

        # Formulas
        ltifr = round((lti_count * 1_000_000) / total_man_hours, 2) if total_man_hours > 0 else 0.0
        trir = round((total_incidents * 1_000_000) / total_man_hours, 2) if total_man_hours > 0 else 0.0
        severity_rate = round((lost_days * 1_000_000) / total_man_hours, 2) if total_man_hours > 0 else 0.0

        # Inspections compliance
        inspections = Inspection.objects.filter(organization_id__in=org_ids)
        total_insp = inspections.count()
        completed_insp = inspections.filter(status="completed").count()
        inspection_rate = round((completed_insp / total_insp * 100), 1) if total_insp > 0 else 100.0

        # CAPA closure rate
        capas = CorrectiveAction.objects.filter(organization_id__in=org_ids)
        total_capa = capas.count()
        closed_capa = capas.filter(status__in=["verified", "closed"]).count()
        capa_closure_rate = round((closed_capa / total_capa * 100), 1) if total_capa > 0 else 100.0

        # BBS Safe Behavior Rate
        bbs = BehaviorObservation.objects.filter(organization_id__in=org_ids)
        total_bbs = bbs.count()
        safe_bbs = bbs.filter(observation_type="safe").count()
        safe_behavior_rate = round((safe_bbs / total_bbs * 100), 1) if total_bbs > 0 else 85.0

        return Response({
            "man_hours_worked": total_man_hours,
            "ltifr": ltifr,
            "trir": trir,
            "severity_rate": severity_rate,
            "lti_count": lti_count,
            "total_incidents": total_incidents,
            "inspection_compliance_rate": inspection_rate,
            "capa_closure_rate": capa_closure_rate,
            "safe_behavior_rate": safe_behavior_rate,
            "proactive_ratio": round(safe_behavior_rate / 10.0, 1),
            "status": "normal" if ltifr < 1.0 else "warning",
        })


class Executive20ModuleDashboardView(APIView):
    """
    داشبورد پایش جامع و یکپارچه کل ۲۰ ماژول HSE
    (Executive 20-Module Live Overview)
    تجمیع وضعیت زنده، هشدارهای فعال، شاخص‌ها و مسیر ردیابی عمیق
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_ids = accessible_organization_ids(request.user)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            if int(org_param) in org_ids:
                org_ids = [int(org_param)]

        from apps.risks.models import RiskAssessment
        from apps.findings.models import NonConformity
        from apps.incidents.models import Incident
        from apps.permits.models import Permit
        from apps.inspections.models import Inspection
        from apps.assets.models import Equipment
        from apps.workforce.models import (
            PPEItem, PPEAssignment, TrainingCourse, TrainingSession,
            EmployeeCompetency, ContractorCompany, OccupationalHealthFitRecord
        )
        from apps.moc.models import ChangeRequest
        from apps.environment.models import (
            EnvironmentalAspect, WasteRecord, WastewaterEmissionRecord,
            ChemicalItem, EmergencyScenario, EmergencyDrill, EmergencyResource, ResourceConsumptionRecord
        )
        from apps.auditlog.models import AuditPlan, AuditFinding
        from apps.documents.models import Document
        from apps.surveys.models import BehaviorObservation, SafetyCultureScore
        from apps.findings.models import NonConformity
        from apps.capa.models import CorrectiveAction

        # Module 1: Risk Management
        risks_qs = RiskAssessment.objects.filter(organization_id__in=org_ids)
        m1 = {
            "name": "مدیریت ریسک‌های HSE",
            "code": "risk_management",
            "count": risks_qs.count(),
            "critical_count": risks_qs.filter(level__in=["high", "critical"]).count(),
            "status": "normal" if risks_qs.filter(level__in=["high", "critical"]).count() == 0 else "action_required",
            "path": "/risks",
        }

        # Module 2: Anomaly Reports
        anomalies_qs = NonConformity.objects.filter(organization_id__in=org_ids)
        m2 = {
            "name": "گزارش ناهنجاری‌ها و موارد ناایمن",
            "code": "anomaly_reports",
            "count": anomalies_qs.count(),
            "unresolved": anomalies_qs.exclude(status="resolved").count(),
            "status": "warning" if anomalies_qs.filter(status="reported").count() > 5 else "normal",
            "path": "/anomalies",
        }

        # Module 3: Incident Management
        incidents_qs = Incident.objects.filter(organization_id__in=org_ids)
        m3 = {
            "name": "مدیریت حوادث و شبه‌حوادث",
            "code": "incidents",
            "count": incidents_qs.count(),
            "open_count": incidents_qs.exclude(status="closed").count(),
            "status": "normal" if incidents_qs.exclude(status="closed").count() == 0 else "action_required",
            "path": "/incidents",
        }

        # Module 4: Permit to Work
        permits_qs = Permit.objects.filter(organization_id__in=org_ids)
        m4 = {
            "name": "مجوزهای کار (PTW)",
            "code": "permits",
            "count": permits_qs.count(),
            "active_permits": permits_qs.filter(status="active").count(),
            "status": "normal",
            "path": "/permits",
        }

        # Module 5: Inspection Management
        insp_qs = Inspection.objects.filter(organization_id__in=org_ids)
        m5 = {
            "name": "مدیریت بازرسی و چک‌لیست‌ها",
            "code": "inspections",
            "count": insp_qs.count(),
            "pending": insp_qs.filter(status="scheduled").count(),
            "status": "normal",
            "path": "/inspections",
        }

        # Module 6: Equipment & Machinery
        eq_qs = Equipment.objects.filter(organization_id__in=org_ids)
        m6 = {
            "name": "تجهیزات و ماشین‌آلات",
            "code": "equipment",
            "count": eq_qs.count(),
            "under_maintenance": eq_qs.filter(status="under_maintenance").count(),
            "status": "normal",
            "path": "/equipment",
        }

        # Module 7: PPE Management
        ppe_qs = PPEItem.objects.filter(organization_id__in=org_ids)
        m7 = {
            "name": "تجهیزات حفاظت فردی (PPE)",
            "code": "ppe",
            "count": ppe_qs.count(),
            "assignments_active": PPEAssignment.objects.filter(organization_id__in=org_ids, status="active").count(),
            "status": "normal",
            "path": "/workforce",
        }

        # Module 8: Training & Competency
        tr_qs = TrainingCourse.objects.filter(organization_id__in=org_ids)
        m8 = {
            "name": "آموزش و شایستگی شغلی",
            "code": "training",
            "count": tr_qs.count(),
            "sessions_count": TrainingSession.objects.filter(organization_id__in=org_ids).count(),
            "status": "normal",
            "path": "/training",
        }

        # Module 9: Management of Change
        moc_qs = ChangeRequest.objects.filter(organization_id__in=org_ids)
        m9 = {
            "name": "مدیریت تغییرات (MOC)",
            "code": "moc",
            "count": moc_qs.count(),
            "pending_approval": moc_qs.filter(status__in=["submitted", "under_review"]).count(),
            "status": "normal" if moc_qs.filter(status="submitted").count() == 0 else "action_required",
            "path": "/moc",
        }

        # Module 10: Contractor HSE
        con_qs = ContractorCompany.objects.filter(organization_id__in=org_ids)
        m10 = {
            "name": "مدیریت HSE پیمانکاران",
            "code": "contractors",
            "count": con_qs.count(),
            "disqualified": con_qs.filter(qualification_status="disqualified").count(),
            "status": "normal" if con_qs.filter(qualification_status="disqualified").count() == 0 else "warning",
            "path": "/contractors",
        }

        # Module 11: Environmental Management
        env_aspects = EnvironmentalAspect.objects.filter(organization_id__in=org_ids)
        m11 = {
            "name": "مدیریت محیط زیست و پسماند",
            "code": "environment",
            "aspects_count": env_aspects.count(),
            "significant_aspects": env_aspects.filter(is_significant=True).count(),
            "status": "normal",
            "path": "/environment",
        }

        # Module 12: Occupational Health
        health_qs = OccupationalHealthFitRecord.objects.filter(employee__organization_id__in=org_ids)
        m12 = {
            "name": "بهداشت حرفه‌ای و طب کار",
            "code": "health",
            "count": health_qs.count(),
            "restricted_workers": health_qs.filter(fit_status__in=["fit_with_restrictions", "temporarily_unfit"]).count(),
            "status": "normal",
            "path": "/health",
        }

        # Module 13: Emergency Management
        emerg_scenarios = EmergencyScenario.objects.filter(organization_id__in=org_ids)
        m13 = {
            "name": "مدیریت واکنش در شرایط اضطراری",
            "code": "emergency",
            "scenarios_count": emerg_scenarios.count(),
            "drills_count": EmergencyDrill.objects.filter(organization_id__in=org_ids).count(),
            "resources_count": EmergencyResource.objects.filter(organization_id__in=org_ids).count(),
            "status": "normal",
            "path": "/emergency",
        }

        # Module 14: Chemical Management
        chem_qs = ChemicalItem.objects.filter(organization_id__in=org_ids)
        m14 = {
            "name": "مدیریت مواد شیمیایی (Chemicals)",
            "code": "chemicals",
            "count": chem_qs.count(),
            "flammable_toxic_count": chem_qs.filter(hazard_classification__in=["flammable", "toxic", "explosive"]).count(),
            "status": "normal",
            "path": "/chemicals",
        }

        # Module 15: Audit & Compliance
        audit_qs = AuditPlan.objects.filter(organization_id__in=org_ids)
        m15 = {
            "name": "ممیزی، بازرسی و انطباق استاندارد",
            "code": "audit",
            "count": audit_qs.count(),
            "findings_count": AuditFinding.objects.filter(audit_plan__organization_id__in=org_ids).count(),
            "status": "normal",
            "path": "/audit",
        }

        # Module 16: Document Control
        doc_qs = Document.objects.filter(organization_id__in=org_ids)
        m16 = {
            "name": "مدیریت اسناد و مدارک مهندسی",
            "code": "documents",
            "count": doc_qs.count(),
            "status": "normal",
            "path": "/documents",
        }

        # Module 17: Safety Culture & BBS
        bbs_qs = BehaviorObservation.objects.filter(organization_id__in=org_ids)
        m17 = {
            "name": "فرهنگ ایمنی و مشاهدات رفتاری (BBS)",
            "code": "safety_culture",
            "count": bbs_qs.count(),
            "safe_count": bbs_qs.filter(observation_type="safe").count(),
            "status": "normal",
            "path": "/safety-culture",
        }

        # Module 18: CAPA & Non-Conformity
        capa_qs = CorrectiveAction.objects.filter(organization_id__in=org_ids)
        m18 = {
            "name": "اقدامات اصلاحی و پیشگیرانه (CAPA)",
            "code": "capa",
            "count": capa_qs.count(),
            "open_actions": capa_qs.exclude(status__in=["verified", "closed"]).count(),
            "status": "normal" if capa_qs.exclude(status__in=["verified", "closed"]).count() < 10 else "warning",
            "path": "/capa",
        }

        # Module 19: Strategic Goals & Budget
        goals_qs = HSEStrategicGoal.objects.filter(organization_id__in=org_ids)
        m19 = {
            "name": "مدیریت راهبردی و بودجه HSE",
            "code": "strategic_hse",
            "goals_count": goals_qs.count(),
            "on_track": goals_qs.filter(status="on_track").count(),
            "budget_programs": HSEBudgetProgram.objects.filter(organization_id__in=org_ids).count(),
            "status": "normal",
            "path": "/strategic-hse",
        }

        # Module 20: KPI Intelligence Engine
        m20 = {
            "name": "موتور تحلیل شاخص‌های عملکرد (KPI Engine)",
            "code": "kpi_engine",
            "active": True,
            "status": "operational",
            "path": "/dashboard/kpis",
        }

        all_modules = [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15, m16, m17, m18, m19, m20]

        return Response({
            "modules_total": 20,
            "modules_healthy": sum(1 for m in all_modules if m.get("status") in ["normal", "operational"]),
            "modules_action_required": sum(1 for m in all_modules if m.get("status") in ["action_required", "warning"]),
            "modules": all_modules,
        })
