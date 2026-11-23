import logging
from django.dispatch import receiver
from apps.core.events import hse_signal_event, HSEEventRegistry
from apps.core.traceability import TraceabilityChain, TraceabilityNode
from .models import RiskRegister, RiskScenario, RiskTreatmentAction

logger = logging.getLogger(__name__)


@receiver(hse_signal_event)
def handle_cross_module_events(sender, event_name, payload, organization_id, actor=None, **kwargs):
    """
    دریافت رویدادهای سایر ماژول‌ها و همگام‌سازی ارزیابی ریسک بدون افزونگی داده
    مطابق با ماتریس ارتباطات ۲۰ ماژول HSE
    """
    # ۱. دریافت ورودی از ماژول حوادث (Incident -> Risk)
    if event_name == HSEEventRegistry.INCIDENT_LOGGED:
        incident_id = payload.get("incident_id")
        hazard_category = payload.get("hazard_category", "")
        description = payload.get("description", "")

        logger.info(f"[Risk Listener] دریافت حادثه #{incident_id} (Org #{organization_id}) برای بررسی تأثیر بر رجیستر ریسک.")

        # پیدا کردن یا ساخت زنجیره ردیابی برای این حادثه
        chain, _ = TraceabilityChain.objects.get_or_create(
            organization_id=organization_id,
            origin_module="incidents",
            origin_object_id=str(incident_id),
            defaults={
                "tracking_code": f"TRC-INC-{incident_id}",
                "title": f"ردیابی حادثه {incident_id} تا ارزیابی ریسک و اقدام اصلاحی",
                "status": "active"
            }
        )

        # ثبت گره ردیابی ارتباط Incident -> Risk
        TraceabilityNode.objects.create(
            chain=chain,
            from_module="incidents",
            from_id=str(incident_id),
            to_module="risks",
            to_id=str(payload.get("risk_id", "GLOBAL_REVIEW")),
            relation_type="event_based",
            description=f"الزام به بازنگری ریسک به علت رخداد حادثه: {description[:100]}",
            actor=actor
        )

    # ۲. دریافت ورودی از ماژول تغییرات (MOC -> Risk)
    elif event_name == HSEEventRegistry.MOC_AUTHORIZED:
        moc_id = payload.get("moc_id")
        title = payload.get("title", "تغییر فرآیندی/فنی")
        logger.info(f"[Risk Listener] مجوز تغییرات #{moc_id} تأیید شد. ایجاد پرونده ارزیابی ریسک تغییر.")

        chain, _ = TraceabilityChain.objects.get_or_create(
            organization_id=organization_id,
            origin_module="moc",
            origin_object_id=str(moc_id),
            defaults={
                "tracking_code": f"TRC-MOC-{moc_id}",
                "title": f"ردیابی MOC #{moc_id} تا ارزیابی ریسک",
                "status": "active"
            }
        )

        # ساخت پیش‌نویس ارزیابی ریسک برای MOC
        reg_code = f"RR-MOC-{moc_id}"
        reg, created = RiskRegister.objects.get_or_create(
            organization_id=organization_id,
            register_code=reg_code,
            defaults={
                "title": f"ارزیابی ریسک مدیریت تغییر: {title}",
                "status": RiskRegister.RegisterStatus.DRAFT,
                "created_by": actor,
                "project_name": payload.get("project_name", "پروژه MOC")
            }
        )

        TraceabilityNode.objects.create(
            chain=chain,
            from_module="moc",
            from_id=str(moc_id),
            to_module="risks",
            to_id=str(reg.id),
            relation_type="approval_based",
            description=f"پرونده ارزیابی ریسک {reg_code} برای تغییر تأییدشده ایجاد گردید.",
            actor=actor
        )

    # ۳. دریافت ورودی از گزارش‌های ناهنجاری (Anomaly -> Risk)
    elif event_name == HSEEventRegistry.ANOMALY_SUBMITTED:
        anomaly_id = payload.get("anomaly_id")
        title = payload.get("title", "")
        logger.info(f"[Risk Listener] دریافت ناهنجاری #{anomaly_id}. بررسی انطباق با موانع کنترلی.")
