from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.auditlog.services import log_event
from apps.capa.models import CorrectiveAction
from apps.core.access import can_investigate_incident, can_manage_incidents
from .models import Incident


def report_incident(*, organization, reported_by, data):
    """Creates a new incident or near-miss report in REPORTED status."""
    incident = Incident.objects.create(
        organization=organization,
        reported_by=reported_by,
        title=data.get("title", "").strip(),
        incident_type=data.get("incident_type", Incident.IncidentType.INCIDENT),
        severity=data.get("severity", Incident.Severity.MINOR),
        status=Incident.Status.REPORTED,
        occurred_at=data["occurred_at"],
        workplace=data.get("workplace"),
        equipment=data.get("equipment"),
        location_details=data.get("location_details", "").strip(),
        description=data.get("description", "").strip(),
        immediate_actions_taken=data.get("immediate_actions_taken", "").strip(),
        injury_count=data.get("injury_count", 0),
        lost_time_days=data.get("lost_time_days", 0),
        environmental_impact=data.get("environmental_impact", "").strip(),
        property_damage_cost=data.get("property_damage_cost"),
        related_hazard=data.get("related_hazard"),
        is_synthetic=data.get("is_synthetic", False),
    )

    log_event(
        organization=organization,
        actor=reported_by,
        action="incident.reported",
        entity_type="Incident",
        entity_id=incident.id,
        details={
            "title": incident.title,
            "type": incident.incident_type,
            "severity": incident.severity,
        },
    )
    return incident


def review_incident(*, incident: Incident, reviewer, review_notes: str, assigned_investigator=None, next_status=None):
    """Reviews an incident and assigns investigator or transitions status."""
    if not can_manage_incidents(reviewer, incident.organization_id):
        raise ValidationError("تنها مدیران HSE و مدیران سازمان مجاز به بررسی و تعیین تکلیف حادثه هستند.")

    if incident.status in {Incident.Status.CLOSED}:
        raise ValidationError("امکان بازنگری حادثه مختومه‌شده وجود ندارد. ابتدا باید بازگشایی شود.")

    incident.review_notes = review_notes.strip()
    if assigned_investigator:
        incident.assigned_investigator = assigned_investigator

    allowed_next = {
        Incident.Status.UNDER_REVIEW,
        Incident.Status.UNDER_INVESTIGATION,
        Incident.Status.ACTION_REQUIRED,
        Incident.Status.CLOSED,
    }

    if next_status:
        if next_status not in allowed_next:
            raise ValidationError(f"تغییر وضعیت به {next_status} در مرحله بازنگری مجاز نیست.")
        incident.status = next_status
        if next_status == Incident.Status.CLOSED:
            incident.closed_at = timezone.now()
            incident.closure_notes = review_notes.strip()
    else:
        incident.status = (
            Incident.Status.UNDER_INVESTIGATION
            if incident.assigned_investigator
            else Incident.Status.UNDER_REVIEW
        )

    incident.save()

    log_event(
        organization=incident.organization,
        actor=reviewer,
        action="incident.reviewed",
        entity_type="Incident",
        entity_id=incident.id,
        details={
            "new_status": incident.status,
            "investigator": incident.assigned_investigator.username if incident.assigned_investigator else None,
        },
    )
    return incident


def record_investigation(*, incident: Incident, investigator, root_cause: str, contributing_factors: str, immediate_actions_taken: str = ""):
    """Records root-cause analysis and investigation findings."""
    if not can_investigate_incident(investigator, incident):
        raise ValidationError("شما مجوز ثبت نتایج بررسی و علت‌یابی این حادثه را ندارید.")

    if incident.status in {Incident.Status.CLOSED}:
        raise ValidationError("امکان ویرایش بررسی حادثه مختومه‌شده وجود ندارد.")

    if not root_cause.strip():
        raise ValidationError("ثبت علت اصلی و ریشه‌ای حادثه (Root Cause) الزامی است.")

    incident.root_cause = root_cause.strip()
    incident.contributing_factors = contributing_factors.strip()
    if immediate_actions_taken.strip():
        incident.immediate_actions_taken = immediate_actions_taken.strip()

    incident.investigation_completed_at = timezone.now()
    if incident.status in {Incident.Status.REPORTED, Incident.Status.UNDER_REVIEW, Incident.Status.UNDER_INVESTIGATION}:
        incident.status = Incident.Status.ACTION_REQUIRED

    incident.save()

    log_event(
        organization=incident.organization,
        actor=investigator,
        action="incident.investigated",
        entity_type="Incident",
        entity_id=incident.id,
        details={"status": incident.status, "has_root_cause": bool(incident.root_cause)},
    )
    return incident


def link_corrective_action_to_incident(*, incident: Incident, actor, corrective_action: CorrectiveAction):
    """Associates an existing CAPA to the incident."""
    if corrective_action.organization_id != incident.organization_id:
        raise ValidationError("اقدام اصلاحی باید متعلق به همان سازمان حادثه باشد.")

    incident.related_corrective_actions.add(corrective_action)
    if incident.status in {Incident.Status.REPORTED, Incident.Status.UNDER_REVIEW, Incident.Status.UNDER_INVESTIGATION}:
        incident.status = Incident.Status.ACTION_REQUIRED
        incident.save(update_fields=["status", "updated_at"])

    log_event(
        organization=incident.organization,
        actor=actor,
        action="incident.action_linked",
        entity_type="Incident",
        entity_id=incident.id,
        details={"corrective_action_id": corrective_action.id},
    )
    return incident


def close_incident(*, incident: Incident, user, closure_notes: str):
    """Closes an incident after verifying prerequisites."""
    if not can_manage_incidents(user, incident.organization_id):
        raise ValidationError("تنها مدیران HSE یا سازمان مجاز به مختومه‌کردن پرونده حادثه هستند.")

    if incident.status == Incident.Status.CLOSED:
        raise ValidationError("این حادثه در حال حاضر مختومه‌شده است.")

    # High severity incident check: require root cause if severity is moderate or higher
    if incident.severity in {Incident.Severity.MODERATE, Incident.Severity.MAJOR, Incident.Severity.CRITICAL}:
        if not incident.root_cause.strip():
            raise ValidationError("برای حوادث متوسط، شدید و بحرانی، ثبت تحلیل ریشه‌ای (Root Cause) قبل از مختومه‌سازی الزامی است.")

    # Check uncompleted CAPAs
    open_actions = incident.related_corrective_actions.filter(
        status__in=[CorrectiveAction.Status.OPEN, CorrectiveAction.Status.IN_PROGRESS]
    )
    if open_actions.exists():
        raise ValidationError(f"تعداد {open_actions.count()} اقدام اصلاحی باز برای این حادثه وجود دارد. ابتدا باید تکمیل و تأیید شوند.")

    incident.status = Incident.Status.CLOSED
    incident.closure_notes = closure_notes.strip()
    incident.closed_at = timezone.now()
    incident.save()

    log_event(
        organization=incident.organization,
        actor=user,
        action="incident.closed",
        entity_type="Incident",
        entity_id=incident.id,
        details={"closed_at": str(incident.closed_at)},
    )
    return incident


def reopen_incident(*, incident: Incident, user, reopen_reason: str):
    """Reopens a closed incident for re-investigation."""
    if not can_manage_incidents(user, incident.organization_id):
        raise ValidationError("تنها مدیران مجاز به بازگشایی پرونده حادثه مختومه‌شده هستند.")

    if incident.status != Incident.Status.CLOSED:
        raise ValidationError("تنها حوادث در وضعیت مختومه‌شده قابل بازگشایی مجدد هستند.")

    if not reopen_reason.strip():
        raise ValidationError("ذکر دلیل توجیهی بازگشایی پرونده الزامی است.")

    incident.status = Incident.Status.REOPENED
    incident.reopen_reason = reopen_reason.strip()
    incident.closed_at = None
    incident.save()

    log_event(
        organization=incident.organization,
        actor=user,
        action="incident.reopened",
        entity_type="Incident",
        entity_id=incident.id,
        details={"reopen_reason": reopen_reason.strip()},
    )
    return incident
