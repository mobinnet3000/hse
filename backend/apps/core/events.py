import logging
from django.dispatch import Signal

logger = logging.getLogger(__name__)

# سیگنال سراسری ارتباط بین‌ماژولی HSE
hse_signal_event = Signal()  # آرگومان‌ها: sender, event_name, payload, organization_id, actor


class HSEEventRegistry:
    # رخدادهای ماژول مدیریت ریسک
    RISK_ASSESSED = "risk.assessed"
    RISK_ASSESSMENT_APPROVED = "risk.assessment.approved"
    RISK_REASSESSMENT_TRIGGERED = "risk.reassessment.triggered"
    HIGH_RISK_ALERT = "risk.high_alert"
    HEALTH_RISK_FLAGGED = "risk.health.flagged"
    ENVIRONMENTAL_RISK_FLAGGED = "risk.environment.flagged"
    RISK_TREATMENT_ASSIGNED = "risk.treatment.assigned"

    # رخدادهای حوادث و ناهنجاری‌ها (Phase 2 Operational Loop)
    INCIDENT_LOGGED = "incident.logged"
    INCIDENT_CRITICAL_EMERGENCY = "incident.critical.emergency"
    INCIDENT_RCA_COMPLETED = "incident.rca.completed"
    INCIDENT_KPI_UPDATED = "incident.kpi.updated"
    INCIDENT_CLOSED = "incident.closed"

    ANOMALY_SUBMITTED = "anomaly.submitted"
    ANOMALY_ESCALATED_INCIDENT = "anomaly.escalated.incident"
    ANOMALY_LINKED_RISK = "anomaly.linked.risk"
    ANOMALY_RESOLVED = "anomaly.resolved"

    # رخدادهای مجوز کار (Permit to Work - PTW)
    PTW_REQUESTED = "ptw.requested"
    PTW_ISSUED = "ptw.issued"
    PTW_ACTIVATED = "ptw.activated"
    PTW_SUSPENDED = "ptw.suspended"
    PTW_CANCELLED = "ptw.cancelled"
    PTW_CLOSED = "ptw.closed"

    # رخدادهای مدیریت تغییر و بازرسی (Phase 3 Controls, Assets & MOC)
    MOC_SUBMITTED = "moc.submitted"
    MOC_RISK_ASSESSED = "moc.risk.assessed"
    MOC_AUTHORIZED = "moc.authorized"
    MOC_CLOSED = "moc.closed"

    INSPECTION_COMPLETED = "inspection.completed"
    INSPECTION_DEFECT_FOUND = "inspection.defect.found"

    EQUIPMENT_STATUS_CHANGED = "equipment.status.changed"
    EQUIPMENT_INSPECTION_TRIGGERED = "equipment.inspection.triggered"

    PPE_ASSIGNED = "ppe.assigned"
    PPE_DEFECT_REPORTED = "ppe.defect.reported"

    TRAINING_COMPLETED = "training.completed"
    COMPETENCY_EXPIRED = "competency.expired"

    # اقدامات اصلاحی
    CAPA_CREATED = "capa.created"
    CAPA_VERIFIED = "capa.verified"

    # رخدادهای فاز ۴ (Phase 4 Specialized Domains)
    CONTRACTOR_QUALIFIED = "contractor.qualified"
    CONTRACTOR_DISQUALIFIED = "contractor.disqualified"
    ENVIRONMENTAL_EXCURSION = "environmental.excursion"
    ENVIRONMENTAL_ASPECT_FLAGGED = "environmental.aspect.flagged"
    HEALTH_RESTRICTION_ISSUED = "health.restriction.issued"
    CHEMICAL_SPILL_ALERT = "chemical.spill.alert"
    CHEMICAL_COMPATIBILITY_CONFLICT = "chemical.compatibility.conflict"
    EMERGENCY_ACTIVATED = "emergency.activated"
    EMERGENCY_DRILL_COMPLETED = "emergency.drill.completed"

    # رخدادهای فاز ۵ (Phase 5 Governance & Culture)
    AUDIT_COMPLETED = "audit.completed"
    AUDIT_NONCONFORMITY_FOUND = "audit.nonconformity.found"
    DOCUMENT_REVISION_TRIGGERED = "document.revision.triggered"
    DOCUMENT_APPROVED = "document.approved"
    SAFETY_BEHAVIOR_LOGGED = "safety.behavior.logged"

    # رخدادهای فاز ۶ (Phase 6 Intelligence & Strategic HSE)
    KPI_THRESHOLD_BREACHED = "kpi.threshold.breached"
    STRATEGIC_GOAL_UPDATED = "strategic.goal.updated"


def dispatch_hse_event(event_name: str, sender_module: str, payload: dict, organization_id: int, actor=None):
    """
    ارسال ساختاریافته رویداد در باس پیام‌های داخلی HSE
    """
    logger.info(f"[HSE Event Bus] Event '{event_name}' dispatched by '{sender_module}' for Org #{organization_id}")
    try:
        hse_signal_event.send(
            sender=sender_module,
            event_name=event_name,
            payload=payload,
            organization_id=organization_id,
            actor=actor
        )
    except Exception as exc:
        logger.error(f"[HSE Event Bus] Error dispatching '{event_name}': {exc}", exc_info=True)


class _EventBus:
    @classmethod
    def publish(cls, event_name: str, payload: dict = None, organization_id: int = 1, actor=None, user_id=None, sender_module: str = "core"):
        return dispatch_hse_event(
            event_name=event_name,
            sender_module=sender_module,
            payload=payload or {},
            organization_id=organization_id or 1,
            actor=actor or user_id,
        )


event_bus = _EventBus()
EventBus = _EventBus
Events = HSEEventRegistry

