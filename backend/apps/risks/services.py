import uuid
from typing import Dict, Any, List, Optional
from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from apps.core.events import HSEEventRegistry, dispatch_hse_event
from apps.core.traceability import TraceabilityChain, TraceabilityNode
from .models import (
    RiskRegister,
    RiskActivityTask,
    HazardSource,
    RiskScenario,
    DimensionScoreSet,
    DimensionConsequence,
    RiskControl,
    RiskTreatmentAction,
    RiskAssessment,
)


class RiskMatrixCalculator:
    """
    موتور محاسبات ریسک بر مبنای استاندارد ماتریس ۵×۵ و ابعاد چهارگانه HAER
    Human, Asset, Environment, Reputation (+ Operational Continuity)
    """

    @staticmethod
    def calculate_rpn(likelihood: int, severity: int) -> int:
        """
        محاسبه عدد اولویت ریسک: RPN = Likelihood * Severity (1..25)
        """
        if not (1 <= likelihood <= 5 and 1 <= severity <= 5):
            raise ValueError("مقادیر احتمال و شدت باید اعدادی صحیح بین ۱ تا ۵ باشند.")
        return likelihood * severity

    @staticmethod
    def classify_level(rpn: int) -> str:
        """
        طبقه‌بندی سطح ریسک بر اساس اصل ALARP:
        ۱ تا ۴: کم / قابل‌قبول (سبز)
        ۵ تا ۹: متوسط / قابل‌تحمل در صورت رعایت ALARP (زرد)
        ۱۰ تا ۱۵: زیاد / نامطلوب (نارنجی)
        ۱۶ تا ۲۵: بحرانی / غیرقابل‌قبول (قرمز)
        """
        if rpn <= 4:
            return "low"
        elif rpn <= 9:
            return "medium"
        elif rpn <= 15:
            return "high"
        return "critical"

    @classmethod
    def evaluate_scenario_scores(
        cls,
        scenario: RiskScenario,
        phase: str,
        score_data: List[Dict[str, Any]]
    ) -> List[DimensionScoreSet]:
        """
        ثبت و به‌روزرسانی نمرات ابعاد مختلف برای یک فاز ارزیابی (initial, current, residual)
        """
        saved_scores = []
        with transaction.atomic():
            for item in score_data:
                dim = item["dimension"]
                l = int(item["likelihood"])
                s = int(item["severity"])
                target_rpn = item.get("target_rpn")

                score_obj, _ = DimensionScoreSet.objects.update_or_create(
                    scenario=scenario,
                    phase=phase,
                    dimension=dim,
                    defaults={
                        "likelihood": l,
                        "severity": s,
                        "target_rpn": target_rpn,
                    }
                )
                saved_scores.append(score_obj)
        return saved_scores

    @classmethod
    def get_matrix_5x5_summary(cls, organization_id: int, dimension: Optional[str] = None, phase: str = "current") -> Dict[str, Any]:
        """
        تولید داده‌های هیت‌مپ ۵×۵ برای داشبورد مدیریتی و ماتریس بصری
        """
        qs = DimensionScoreSet.objects.filter(
            scenario__hazard__activity_task__register__organization_id=organization_id,
            phase=phase
        )
        if dimension and dimension != "all":
            qs = qs.filter(dimension=dimension)

        matrix_cells = []
        for l in range(1, 6):
            for s in range(1, 6):
                count = qs.filter(likelihood=l, severity=s).count()
                rpn = l * s
                matrix_cells.append({
                    "likelihood": l,
                    "severity": s,
                    "rpn": rpn,
                    "level": cls.classify_level(rpn),
                    "count": count
                })

        level_counts = {
            "low": qs.filter(risk_level="low").count(),
            "medium": qs.filter(risk_level="medium").count(),
            "high": qs.filter(risk_level="high").count(),
            "critical": qs.filter(risk_level="critical").count(),
        }

        total_scenarios = qs.values("scenario").distinct().count()

        return {
            "dimension": dimension or "all",
            "phase": phase,
            "total_assessments": qs.count(),
            "total_scenarios": total_scenarios,
            "levels": level_counts,
            "cells": matrix_cells,
        }

    @classmethod
    def calculate_overall_scenario_risk(cls, scenario: RiskScenario, phase: str = "current") -> Dict[str, Any]:
        """
        محاسبه ماکزیمم ریسک کلی یک سناریو در تمام ابعاد چهارگانه HAER
        """
        scores = scenario.scores.filter(phase=phase)
        if not scores.exists():
            return {"overall_rpn": 0, "overall_level": "none", "dominant_dimension": None}

        max_score = max(scores, key=lambda x: x.rpn)
        return {
            "overall_rpn": max_score.rpn,
            "overall_level": max_score.risk_level,
            "dominant_dimension": max_score.dimension,
            "scores_count": scores.count()
        }


class RiskManagementEngineService:
    """
    سرویس جامع هسته مدیریت ریسک فاز ۱:
    - ایجاد اتمیک و کامل پرونده ۱۱ مرحله‌ای
    - مدیریت زنجیره ردیابی یکپارچه (Traceability Chaining)
    - انتشار رویدادهای بین‌ماژولی با رعایت محرمانگی داده‌ها
    - همگام‌سازی و مایگریشن داده‌های قدیمی بدون از دست رفتن رکوردها
    """

    @classmethod
    @transaction.atomic
    def create_full_11_step_register(cls, organization_id: int, user, data: Dict[str, Any]) -> RiskRegister:
        """
        ایجاد ساختار کامل رجیستر ۱۱ مرحله‌ای در یک تراکنش اتمیک
        """
        context = data.get("context", {})
        activity = data.get("activity", {})
        hazard = data.get("hazard", {})
        scenario_data = data.get("scenario", {})
        controls = data.get("controls", [])
        initial_scores = data.get("initial_scores", [])
        current_scores = data.get("current_scores", [])
        residual_scores = data.get("residual_scores", [])
        treatments = data.get("treatments", [])
        governance = data.get("governance", {})

        # 1. ساخت یا اتصال به زنجیره ردیابی (Traceability Chain)
        tracking_code = f"TRC-RSK-{context.get('register_code', uuid.uuid4().hex[:8]).replace('RR-', '')}"
        chain, _ = TraceabilityChain.objects.get_or_create(
            tracking_code=tracking_code,
            organization_id=organization_id,
            defaults={
                "title": f"زنجیره ریسک: {context.get('title', 'پرونده ارزیابی ریسک')}",
                "origin_module": "risks",
                "origin_object_id": tracking_code,
                "status": "active"
            }
        )

        # 2. مرحله ۱: ثبت پرونده رجیستر (Context)
        reg_code = context.get("register_code") or f"RR-{uuid.uuid4().hex[:6].upper()}"
        clean_code = reg_code.replace("RR-", "")
        register = RiskRegister.objects.create(
            organization_id=organization_id,
            register_code=reg_code,
            title=context.get("title") or f"ارزیابی ریسک {activity.get('activity_title', 'عملیات')}",
            revision=context.get("revision", 1),
            status=context.get("status", RiskRegister.RegisterStatus.DRAFT),
            project_name=context.get("project_name", ""),
            department=context.get("department", ""),
            site_location=context.get("site_location", ""),
            area=context.get("area", ""),
            project_phase=context.get("project_phase", ""),
            operation_type=context.get("operation_type", ""),
            client_name=context.get("client_name", ""),
            contractor_name=context.get("contractor_name", ""),
            traceability_chain_id=chain.tracking_code,
            risk_acceptance_status=governance.get("risk_acceptance_status", "acceptable"),
            acceptance_authority=governance.get("acceptance_authority", ""),
            audit_trail_code=governance.get("audit_trail_code") or f"AUD-RR-{clean_code}-{uuid.uuid4().hex[:6].upper()}",
            approval_notes=governance.get("approval_notes", ""),
            next_review_date=governance.get("next_review_date") or None,
            created_by=user,
        )

        # ثبت گره ردیابی اولیه
        TraceabilityNode.objects.create(
            chain=chain,
            from_module="risks.context",
            from_id=str(register.id),
            to_module="risks.register",
            to_id=register.register_code,
            relation_type="direct",
            description=f"ایجاد شناسنامه ارزیابی ریسک {register.register_code}",
            actor=user
        )

        # 3. مرحله ۲: ثبت فعالیت و وظایف (Activity & Tasks)
        act_obj = RiskActivityTask.objects.create(
            register=register,
            activity_title=activity.get("activity_title") or "فعالیت اجرایی",
            activity_description=activity.get("activity_description", ""),
            task_name=activity.get("task_name") or "شرح وظیفه",
            job_steps=activity.get("job_steps", []),
            work_method=activity.get("work_method", ""),
            equipment=activity.get("equipment", ""),
            materials=activity.get("materials", ""),
            personnel_count=int(activity.get("personnel_count", 1)),
            competency=activity.get("competency", ""),
            duration_frequency=activity.get("duration_frequency", ""),
            simops=activity.get("simops", ""),
            operating_conditions=activity.get("operating_conditions", "")
        )

        # 4. مرحله ۳: شناسایی منبع خطر (Hazard Source)
        domain = hazard.get("domain", HazardSource.HazardDomain.SAFETY)
        hazard_obj = HazardSource.objects.create(
            activity_task=act_obj,
            domain=domain,
            category=hazard.get("category", "خطرات عمومی"),
            description=hazard.get("description", "")
        )

        # 5. مرحله ۴: تدوین سناریوی ریسک (Risk Scenario)
        scenario_obj = RiskScenario.objects.create(
            hazard=hazard_obj,
            scenario_title=scenario_data.get("scenario_title") or f"سناریوی خطر {hazard_obj.category}",
            undesired_event=scenario_data.get("undesired_event", ""),
            initiating_event=scenario_data.get("initiating_event", ""),
            direct_causes=scenario_data.get("direct_causes", ""),
            root_causes=scenario_data.get("root_causes", ""),
            escalation_factors=scenario_data.get("escalation_factors", ""),
            event_sequence=scenario_data.get("event_sequence", []),
            scenario_conditions=scenario_data.get("scenario_conditions", ""),
            exposure_pathway=scenario_data.get("exposure_pathway", "")
        )

        # 6. مرحله ۶: کنترل‌های موجود (Existing Controls)
        for ctrl in controls:
            if ctrl.get("description"):
                RiskControl.objects.create(
                    scenario=scenario_obj,
                    description=ctrl.get("description", ""),
                    hierarchy=ctrl.get("hierarchy", RiskControl.HierarchyOfControl.ENGINEERING),
                    control_type=ctrl.get("control_type", ""),
                    control_owner=ctrl.get("control_owner", ""),
                    inspection_frequency=ctrl.get("inspection_frequency", ""),
                    is_effective=ctrl.get("is_effective", True),
                    effectiveness_evidence=ctrl.get("effectiveness_evidence", "")
                )

        # 7. مراحل ۷، ۸، ۱۰: نمرات ابعاد HAER
        if initial_scores:
            RiskMatrixCalculator.evaluate_scenario_scores(scenario_obj, "initial", initial_scores)
        if current_scores:
            RiskMatrixCalculator.evaluate_scenario_scores(scenario_obj, "current", current_scores)
        if residual_scores:
            RiskMatrixCalculator.evaluate_scenario_scores(scenario_obj, "residual", residual_scores)

        # 8. مرحله ۹: اقدامات تکمیلی و کاهش ریسک (Treatment Actions - CAPA)
        has_critical_or_high_risk = False
        for treat in treatments:
            if treat.get("action_description"):
                action_obj = RiskTreatmentAction.objects.create(
                    scenario=scenario_obj,
                    action_description=treat.get("action_description", ""),
                    hierarchy=treat.get("hierarchy", RiskControl.HierarchyOfControl.ENGINEERING),
                    priority=treat.get("priority", "high"),
                    due_date=treat.get("due_date"),
                    status=treat.get("status", "pending"),
                    completion_evidence=treat.get("completion_evidence", ""),
                    verification_result=treat.get("verification_result", ""),
                    traceability_node_id=chain.tracking_code
                )

                # ثبت گره اقدام در زنجیره ردیابی
                TraceabilityNode.objects.create(
                    chain=chain,
                    from_module="risks.scenario",
                    from_id=str(scenario_obj.id),
                    to_module="capa.action",
                    to_id=str(action_obj.id),
                    relation_type="direct",
                    description=f"اقدام کاهش ریسک: {action_obj.action_description[:60]}",
                    actor=user
                )

                # ارسال رویداد تخصیص اقدام کاهش ریسک به ماژول‌های مقصد (Incident, Inspection, Training, PPE)
                dispatch_hse_event(
                    event_name=HSEEventRegistry.RISK_TREATMENT_ASSIGNED,
                    sender_module="risks",
                    payload={
                        "action_id": str(action_obj.id),
                        "register_code": register.register_code,
                        "description": action_obj.action_description,
                        "priority": action_obj.priority,
                        "hierarchy": action_obj.hierarchy,
                        "due_date": str(action_obj.due_date),
                    },
                    organization_id=organization_id,
                    actor=user
                )

        # بررسی سطوح ریسک جاری جهت ارسال هشدارهای لازم به سایر ماژول‌ها
        overall_risk = RiskMatrixCalculator.calculate_overall_scenario_risk(scenario_obj, phase="current")
        if overall_risk["overall_level"] in ["high", "critical"]:
            has_critical_or_high_risk = True
            # هشدار ریسک بالا برای مقاصد: Dashboard, Emergency Management, PTW
            dispatch_hse_event(
                event_name=HSEEventRegistry.HIGH_RISK_ALERT,
                sender_module="risks",
                payload={
                    "register_id": str(register.id),
                    "register_code": register.register_code,
                    "scenario_title": scenario_obj.scenario_title,
                    "overall_rpn": overall_risk["overall_rpn"],
                    "overall_level": overall_risk["overall_level"],
                    "dominant_dimension": overall_risk["dominant_dimension"],
                    "area": register.area,
                },
                organization_id=organization_id,
                actor=user
            )

        # انتشار اعلان اختصاصی برای بهداشت حرفه‌ای (Occupational Health)
        if domain == HazardSource.HazardDomain.OCCUPATIONAL_HEALTH:
            dispatch_hse_event(
                event_name=HSEEventRegistry.HEALTH_RISK_FLAGGED,
                sender_module="risks",
                payload={
                    "register_code": register.register_code,
                    "hazard_category": hazard_obj.category,
                    "task_name": act_obj.task_name,
                    "personnel_count": act_obj.personnel_count,
                    "operating_conditions": act_obj.operating_conditions,
                    # صرفاً نیاز به بررسی تناسب شغلی، بدون دسترسی به پرونده پزشکی
                    "operational_fit_required": True,
                },
                organization_id=organization_id,
                actor=user
            )

        # انتشار اعلان اختصاصی برای محیط زیست (Environmental Management)
        if domain == HazardSource.HazardDomain.ENVIRONMENT:
            dispatch_hse_event(
                event_name=HSEEventRegistry.ENVIRONMENTAL_RISK_FLAGGED,
                sender_module="risks",
                payload={
                    "register_code": register.register_code,
                    "hazard_category": hazard_obj.category,
                    "area": register.area,
                    "direct_causes": scenario_obj.direct_causes,
                },
                organization_id=organization_id,
                actor=user
            )

        # انتشار رویداد ارزیابی ریسک در کل سیستم (مقاصد: PTW, Strategic HSE, Dashboard, HSE KPI)
        dispatch_hse_event(
            event_name=HSEEventRegistry.RISK_ASSESSED,
            sender_module="risks",
            payload={
                "register_id": str(register.id),
                "register_code": register.register_code,
                "title": register.title,
                "project_name": register.project_name,
                "area": register.area,
                "has_critical_risk": has_critical_or_high_risk,
                "tracking_code": chain.tracking_code,
            },
            organization_id=organization_id,
            actor=user
        )

        return register

    @classmethod
    @transaction.atomic
    def sync_legacy_risks_to_registers(cls, organization_id: Optional[int] = None) -> Dict[str, Any]:
        """
        همگام‌سازی و مهاجرت داده‌های قدیمی RiskAssessment به رجیستر استاندارد ۱۱ مرحله‌ای
        بدون از دست رفتن هیچ‌یک از سوابق و با ایجاد پیوندهای ردیابی خودکار.
        """
        legacy_qs = RiskAssessment.objects.all().select_related("hazard", "organization")
        if organization_id:
            legacy_qs = legacy_qs.filter(organization_id=organization_id)

        migrated_count = 0
        skipped_count = 0

        for legacy in legacy_qs:
            reg_code = f"RR-LEGACY-{legacy.id}"
            if RiskRegister.objects.filter(register_code=reg_code).exists():
                skipped_count += 1
                continue

            hazard = legacy.hazard
            org = legacy.organization

            # ایجاد زنجیره ردیابی
            tracking_code = f"TRC-LEGACY-{legacy.id}"
            chain, _ = TraceabilityChain.objects.get_or_create(
                tracking_code=tracking_code,
                organization=org,
                defaults={
                    "title": f"زنجیره ریسک قدیمی: {hazard.title}",
                    "origin_module": "risks.legacy",
                    "origin_object_id": str(legacy.id),
                    "status": "active",
                }
            )

            # ۱. ایجاد Register
            reg = RiskRegister.objects.create(
                organization=org,
                register_code=reg_code,
                title=f"ارزیابی مهاجرت‌یافته: {hazard.title}",
                revision=1,
                status=RiskRegister.RegisterStatus.APPROVED if legacy.status == "approved" else RiskRegister.RegisterStatus.DRAFT,
                project_name="پروژه سوابق انتقالی",
                department=hazard.workplace.name if hazard.workplace else "واحد عمومی",
                site_location="محل ثبت سوابق",
                area="کلیه نواحی",
                operation_type="عملیاتی",
                traceability_chain_id=chain.tracking_code,
                risk_acceptance_status="tolerable_alarp" if legacy.level in ["medium", "high"] else "acceptable",
                acceptance_authority="سامانه ارزیابی قبلی",
                audit_trail_code=f"AUD-{tracking_code}",
            )

            # ۲. فعالیت و وظیفه
            act = RiskActivityTask.objects.create(
                register=reg,
                activity_title=hazard.title,
                activity_description=hazard.description or "سوابق ثبت‌شده از نسخه پیشین",
                task_name="عملیات عمومی پایش خطر",
                personnel_count=1,
                competency="پرسنل آموزش‌دیده",
            )

            # ۳. منبع خطر
            domain_map = {
                "safety": HazardSource.HazardDomain.SAFETY,
                "health": HazardSource.HazardDomain.OCCUPATIONAL_HEALTH,
                "environment": HazardSource.HazardDomain.ENVIRONMENT,
                "ergonomic": HazardSource.HazardDomain.OCCUPATIONAL_HEALTH,
                "psychosocial": HazardSource.HazardDomain.OCCUPATIONAL_HEALTH,
            }
            hazard_source = HazardSource.objects.create(
                activity_task=act,
                domain=domain_map.get(hazard.category, HazardSource.HazardDomain.SAFETY),
                category=hazard.get_category_display() if hasattr(hazard, "get_category_display") else hazard.category,
                description=hazard.description or hazard.title
            )

            # ۴. سناریو
            scenario = RiskScenario.objects.create(
                hazard=hazard_source,
                scenario_title=f"سناریوی خطر: {hazard.title}",
                undesired_event=hazard.consequences or "رخداد رویداد نامطلوب",
                initiating_event=hazard.source or "منبع خطر شناسایی‌شده",
                direct_causes=hazard.causes or "علل ثبت‌شده در رکورد پیشین",
                exposure_pathway=hazard.exposed_persons or "افراد در معرض",
            )

            # ۶. کنترل‌های موجود
            if hazard.existing_controls:
                RiskControl.objects.create(
                    scenario=scenario,
                    description=hazard.existing_controls,
                    hierarchy=RiskControl.HierarchyOfControl.ADMINISTRATIVE,
                    control_type="کنترل‌های ثبتی پیشین",
                    is_effective=True,
                )

            # ۷ و ۸. نمرات
            l = legacy.likelihood
            s = legacy.severity
            # امتیاز به عنوان بعد انسانی و دارایی ثبت می‌شود
            DimensionScoreSet.objects.create(
                scenario=scenario,
                phase="initial",
                dimension=DimensionConsequence.HUMAN,
                likelihood=min(5, l + 1) if l < 5 else 5,
                severity=s
            )
            DimensionScoreSet.objects.create(
                scenario=scenario,
                phase="current",
                dimension=DimensionConsequence.HUMAN,
                likelihood=l,
                severity=s
            )
            DimensionScoreSet.objects.create(
                scenario=scenario,
                phase="residual",
                dimension=DimensionConsequence.HUMAN,
                likelihood=max(1, l - 1),
                severity=max(1, s - 1),
                target_rpn=4
            )

            # ۹. اقدام اصلاحی از proposed_controls
            if legacy.proposed_controls:
                RiskTreatmentAction.objects.create(
                    scenario=scenario,
                    action_description=legacy.proposed_controls,
                    hierarchy=RiskControl.HierarchyOfControl.ENGINEERING,
                    priority="high",
                    due_date=legacy.assessed_at.date() if legacy.assessed_at else timezone.now().date(),
                    status="completed" if legacy.implemented_controls else "pending",
                    completion_evidence=legacy.implemented_controls or "",
                    traceability_node_id=chain.tracking_code
                )

            # گره ردیابی
            TraceabilityNode.objects.create(
                chain=chain,
                from_module="risks.legacy",
                from_id=str(legacy.id),
                to_module="risks.register",
                to_id=reg.register_code,
                relation_type="automatic",
                description="مهاجرت و استانداردسازی خودکار به مدل ۱۱ مرحله‌ای"
            )

            migrated_count += 1

        return {
            "migrated_count": migrated_count,
            "skipped_count": skipped_count,
            "total_legacy": legacy_qs.count()
        }
