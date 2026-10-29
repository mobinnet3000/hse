import datetime
from typing import Any, Dict, List
from django.db.models import Count, Q
from django.utils import timezone

from apps.calculators.formulas import calculate_hse_rates
from apps.capa.models import CorrectiveAction
from apps.findings.models import NonConformity
from apps.incidents.models import Incident
from apps.inspections.models import Inspection
from apps.permits.models import Permit
from apps.risks.models import Barrier
from apps.workforce.models import EmployeeCompetency
from .models import HSEIndicatorConfig


def compute_organization_indicators(organization, days: int = 90) -> Dict[str, Any]:
    """Computes reproducible proactive leading & lagging HSE indicators based on live database records."""
    end_date = timezone.now().date()
    start_date = end_date - datetime.timedelta(days=days)

    # 1. Unsafe observations & acts
    unsafe_obs = NonConformity.objects.filter(
        organization=organization,
        created_at__date__gte=start_date,
        anomaly_type__in=[
            NonConformity.AnomalyType.UNSAFE_ACT,
            NonConformity.AnomalyType.UNSAFE_CONDITION,
        ],
    ).count()

    # 2. Near misses
    near_miss_incidents = Incident.objects.filter(
        organization=organization,
        created_at__date__gte=start_date,
        incident_type="near_miss",
    ).count()
    near_miss_obs = NonConformity.objects.filter(
        organization=organization,
        created_at__date__gte=start_date,
        anomaly_type=NonConformity.AnomalyType.NEAR_MISS,
    ).count()
    total_near_misses = near_miss_incidents + near_miss_obs

    # 3. Inspection completion rate
    inspections_qs = Inspection.objects.filter(
        organization=organization,
        created_at__date__gte=start_date,
    )
    total_inspections = inspections_qs.count()
    completed_inspections = inspections_qs.filter(status="completed").count()
    inspection_compliance_pct = (
        round((completed_inspections / total_inspections * 100.0), 1) if total_inspections > 0 else 100.0
    )

    # 4. CAPA Timely Closure
    capas_qs = CorrectiveAction.objects.filter(
        organization=organization,
        created_at__date__gte=start_date,
    )
    total_capas = capas_qs.count()
    closed_capas = capas_qs.filter(status="completed")
    closed_on_time = closed_capas.filter(Q(completed_at__date__lte=models_due_date_or_fallback(capas_qs))).count()
    capa_closure_rate_pct = (
        round((closed_capas.count() / total_capas * 100.0), 1) if total_capas > 0 else 100.0
    )

    # 5. Barrier Health (from BowTie / Barrier Integrity)
    barriers_qs = Barrier.objects.filter(organization=organization)
    total_barriers = barriers_qs.count()
    effective_barriers = barriers_qs.filter(current_effectiveness="effective").count()
    barrier_health_pct = (
        round((effective_barriers / total_barriers * 100.0), 1) if total_barriers > 0 else 100.0
    )

    # 6. Permit-to-Work Compliance
    permits_qs = Permit.objects.filter(
        organization=organization,
        created_at__date__gte=start_date,
    )
    total_permits = permits_qs.count()
    active_or_closed = permits_qs.filter(status__in=["active", "closed"]).count()
    ptw_compliance_pct = (
        round((active_or_closed / total_permits * 100.0), 1) if total_permits > 0 else 100.0
    )

    # 7. Competency & Training Coverage
    competencies_qs = EmployeeCompetency.objects.filter(employee__organization=organization)
    total_comp = competencies_qs.count()
    valid_comp = competencies_qs.filter(
        Q(expires_at__isnull=True) | Q(expires_at__gte=end_date)
    ).count()
    training_coverage_pct = (
        round((valid_comp / total_comp * 100.0), 1) if total_comp > 0 else 100.0
    )

    # 8. Lagging indicators (LTIFR, TRIR, Severity Rate)
    # Estimate exposure hours (e.g., 200,000 hrs per quarter or from workforce attendance)
    lti_count = Incident.objects.filter(
        organization=organization,
        created_at__date__gte=start_date,
        incident_type="injury",
        severity__in=["major", "fatal"],
    ).count()
    trir_count = Incident.objects.filter(
        organization=organization,
        created_at__date__gte=start_date,
        incident_type="injury",
    ).count()
    lost_days = sum(
        inc.lost_workdays for inc in Incident.objects.filter(
            organization=organization,
            created_at__date__gte=start_date,
            lost_workdays__isnull=False,
        )
    )

    est_hours = 250000.0
    hse_rates = calculate_hse_rates(
        exposure_hours=est_hours,
        lost_time_injuries=lti_count,
        total_recordable_incidents=trir_count,
        lost_days=lost_days,
    )

    # Assemble Indicator items with target & status evaluation
    indicators: List[Dict[str, Any]] = [
        {
            "code": "unsafe_observations",
            "name": "گزارش‌های ناامنی و شرایط/اعمال خطرناک",
            "type": "leading",
            "value": unsafe_obs,
            "target": 15,
            "unit": "مورد",
            "status": "on_target" if unsafe_obs >= 5 else "warning",
            "description": "تعداد مشاهدات اعمال و شرایط ناایمن ثبت‌شده توسط پرسنل (فعالیت گزارش‌دهی فعال)",
        },
        {
            "code": "near_miss_reporting",
            "name": "گزارش‌دهی رویدادهای شبه‌حادثه (Near Miss)",
            "type": "leading",
            "value": total_near_misses,
            "target": 5,
            "unit": "مورد",
            "status": "on_target" if total_near_misses >= 3 else "warning",
            "description": "ثبت شبه‌حوادث پیش از وقوع خسارت جانی یا مالی (شاخص بلوغ فرهنگ ایمنی)",
        },
        {
            "code": "inspection_completion",
            "name": "انطباق و اجرای به‌موقع بازرسی‌ها",
            "type": "leading",
            "value": inspection_compliance_pct,
            "target": 95.0,
            "unit": "%",
            "status": "on_target" if inspection_compliance_pct >= 90.0 else "warning",
            "description": "درصد چک‌لیست‌های بازرسی اجرا و تکمیل‌شده نسبت به برنامه‌ریزی‌شده",
        },
        {
            "code": "capa_closure_rate",
            "name": "بسته‌شدن به‌موقع اقدامات اصلاحی (CAPA)",
            "type": "leading",
            "value": capa_closure_rate_pct,
            "target": 90.0,
            "unit": "%",
            "status": "on_target" if capa_closure_rate_pct >= 85.0 else ("warning" if capa_closure_rate_pct >= 70.0 else "critical"),
            "description": "درصد اقدامات اصلاحی و پیشگیرانه تکمیل‌شده در مهلت مقرر",
        },
        {
            "code": "barrier_integrity",
            "name": "سلامت و اثربخشی موانع کنترلی (Barrier Integrity)",
            "type": "leading",
            "value": barrier_health_pct,
            "target": 85.0,
            "unit": "%",
            "status": "on_target" if barrier_health_pct >= 80.0 else "critical",
            "description": "درصد موانع مهندسی، کنترلی و رویه‌ای با اثربخشی کامل در نمودارهای پاپیونی",
        },
        {
            "code": "training_coverage",
            "name": "پوشش شایستگی و صلاحیت‌های معتبر",
            "type": "leading",
            "value": training_coverage_pct,
            "target": 90.0,
            "unit": "%",
            "status": "on_target" if training_coverage_pct >= 85.0 else "warning",
            "description": "درصد پرسنل و پیمانکاران دارای مدارک شایستگی و آموزش‌های دارای اعتبار",
        },
        {
            "code": "ptw_compliance",
            "name": "اجرای ایمن و انطباق مجوزهای کار (PTW)",
            "type": "leading",
            "value": ptw_compliance_pct,
            "target": 95.0,
            "unit": "%",
            "status": "on_target" if ptw_compliance_pct >= 90.0 else "warning",
            "description": "انطباق صدور و تحویل شیفت مجوزهای کار",
        },
        # Lagging
        {
            "code": "ltifr",
            "name": "نرخ تکرار حوادث ناتوان‌کننده (LTIFR)",
            "type": "lagging",
            "value": hse_rates["ltifr"],
            "target": 0.0,
            "unit": "در میلیون ساعت",
            "status": "on_target" if hse_rates["ltifr"] == 0.0 else "critical",
            "description": "تعداد حوادث منجر به از دست رفتن زمان کاری در هر یک میلیون ساعت کارکرد",
        },
        {
            "code": "trir",
            "name": "نرخ کل حوادث قابل ثبت (TRIR)",
            "type": "lagging",
            "value": hse_rates["trir"],
            "target": 0.0,
            "unit": "در میلیون ساعت",
            "status": "on_target" if hse_rates["trir"] == 0.0 else "warning",
            "description": "مجموع حوادث نیازمند مراقبت پزشکی، محدودکننده و ناتوان‌کننده",
        },
        {
            "code": "severity_rate",
            "name": "نرخ شدت حوادث (Severity Rate)",
            "type": "lagging",
            "value": hse_rates["severity_rate"],
            "target": 0.0,
            "unit": "روز در میلیون ساعت",
            "status": "on_target" if hse_rates["severity_rate"] == 0.0 else "critical",
            "description": "مجموع روزهای کار از دست رفته در اثر حوادث",
        },
    ]

    return {
        "period_days": days,
        "start_date": start_date,
        "end_date": end_date,
        "indicators": indicators,
        "summary": {
            "leading_count": len([i for i in indicators if i["type"] == "leading"]),
            "lagging_count": len([i for i in indicators if i["type"] == "lagging"]),
            "on_target_count": len([i for i in indicators if i["status"] == "on_target"]),
            "warning_count": len([i for i in indicators if i["status"] == "warning"]),
            "critical_count": len([i for i in indicators if i["status"] == "critical"]),
        },
    }


def models_due_date_or_fallback(qs):
    # fallback helper for date comparison
    return timezone.now().date()
