from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.auditlog.services import log_event
from apps.capa.models import CorrectiveAction
from apps.core.access import can_approve_permits, can_control_permits, can_conduct_shift_handover
from apps.incidents.models import Incident
from apps.organizations.models import Organization
from apps.risks.models import Hazard, RiskAssessment
from apps.workplaces.models import Workplace
from .models import Permit, ShiftHandover


def generate_reference_code(organization: Organization, permit_type: str) -> str:
    now = timezone.now()
    ym = now.strftime("%Y%m")
    prefix = f"PTW-{ym}"
    with transaction.atomic():
        last = Permit.objects.filter(
            reference_code__startswith=prefix,
        ).order_by("-reference_code").first()
        if last:
            try:
                seq = int(last.reference_code.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = Permit.objects.filter(reference_code__startswith=prefix).count() + 1
        else:
            seq = 1

        while Permit.objects.filter(reference_code=f"{prefix}-{seq:04d}").exists():
            seq += 1
        return f"{prefix}-{seq:04d}"


def request_permit(organization: Organization, requester, data: dict) -> Permit:
    workplace = data.get("workplace")
    if workplace and workplace.organization_id != organization.id:
        raise ValidationError("کارگاه انتخابی متعلق به این سازمان نیست.")

    valid_from = data.get("valid_from")
    valid_until = data.get("valid_until")
    if not valid_from or not valid_until:
        raise ValidationError("تعیین تاریخ و ساعت شروع و پایان الزامی است.")
    if valid_until <= valid_from:
        raise ValidationError("تاریخ و ساعت پایان باید بعد از تاریخ شروع باشد.")

    permit_type = data.get("permit_type", Permit.PermitType.GENERAL_HIGH_RISK)
    ref_code = generate_reference_code(organization, permit_type)

    permit = Permit(
        organization=organization,
        workplace=workplace,
        reference_code=ref_code,
        permit_type=permit_type,
        title=data["title"],
        description=data["description"],
        work_area=data.get("work_area", ""),
        equipment_involved=data.get("equipment_involved", ""),
        valid_from=valid_from,
        valid_until=valid_until,
        requester=requester,
        responsible_supervisor=data.get("responsible_supervisor"),
        assigned_workers=data.get("assigned_workers", ""),
        precautions_taken=data.get("precautions_taken", ""),
        required_ppe=data.get("required_ppe", ""),
        gas_testing_required=data.get("gas_testing_required", False),
        gas_testing_results=data.get("gas_testing_results", ""),
        isolation_loto_required=data.get("isolation_loto_required", False),
        isolation_loto_details=data.get("isolation_loto_details", ""),
        status=Permit.Status.REQUESTED,
        is_synthetic=data.get("is_synthetic", False),
    )
    permit.full_clean()
    permit.save()

    hazards = data.get("related_hazards") or data.get("related_hazard_ids")
    if hazards:
        permit.related_hazards.set(hazards)

    log_event(
        organization=organization,
        actor=requester,
        action="permit.requested",
        entity_type="Permit",
        entity_id=permit.id,
        details={"reference_code": permit.reference_code, "title": permit.title},
    )
    return permit


def review_permit(permit: Permit, user, status_choice: str, review_notes: str = "") -> Permit:
    if not can_approve_permits(user, permit.organization_id):
        raise ValidationError("شما اجازه بررسی مجوزهای کار در این سازمان را ندارید.")

    if permit.status not in {Permit.Status.REQUESTED, Permit.Status.UNDER_REVIEW}:
        raise ValidationError("این مجوز در وضعیت قابل بررسی قرار ندارد.")

    permit.status = Permit.Status.UNDER_REVIEW
    permit.review_notes = review_notes
    permit.save(update_fields=["status", "review_notes", "updated_at"])

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.reviewed",
        entity_type="Permit",
        entity_id=permit.id,
        details={"status": permit.status, "notes": review_notes},
    )
    return permit


def approve_permit(permit: Permit, user, notes: str = "") -> Permit:
    if not can_approve_permits(user, permit.organization_id):
        raise ValidationError("شما مجوز تأیید پروانه کار در این سازمان را ندارید.")

    # Separation of duties invariant
    if permit.requester_id == user.id:
        raise ValidationError("درخواست‌دهنده مجوز به دلیل رعایت اصل تفکیک وظایف (Separation of Duties) مجاز به تأیید مجوز خود نیست.")

    if permit.status not in {Permit.Status.REQUESTED, Permit.Status.UNDER_REVIEW}:
        raise ValidationError("تنها مجوزهای در انتظار بررسی قابل تأیید هستند.")

    if timezone.now() > permit.valid_until:
        raise ValidationError("زمان اعتبار مجوز به پایان رسیده و امکان تأیید آن وجود ندارد.")

    permit.status = Permit.Status.APPROVED
    permit.approver = user
    if notes:
        permit.review_notes = (permit.review_notes + "\n" + notes).strip()
    permit.save(update_fields=["status", "approver", "review_notes", "updated_at"])

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.approved",
        entity_type="Permit",
        entity_id=permit.id,
        details={"reference_code": permit.reference_code},
    )
    return permit


def verify_controls_and_activate(permit: Permit, user, gas_results: str = "", loto_details: str = "") -> Permit:
    if not can_control_permits(user, permit.organization_id):
        raise ValidationError("شما مجوز اعتبارسنجی کنترل‌ها و فعال‌سازی این پروانه کار را ندارید.")

    if permit.status not in {Permit.Status.APPROVED, Permit.Status.SUSPENDED}:
        raise ValidationError("تنها مجوزهای تأییدشده یا معلق‌شده قابل فعال‌سازی هستند.")

    now = timezone.now()
    if now > permit.valid_until:
        raise ValidationError("اعتبار زمانی مجوز منقضی شده است و امکان فعال‌سازی آن وجود ندارد.")

    # Verify required gas testing
    if permit.gas_testing_required:
        results = gas_results or permit.gas_testing_results
        if not results or not results.strip():
            raise ValidationError("انجام و ثبت نتایج گازسنجی اتمسفر برای این مجوز الزامی است.")
        permit.gas_testing_results = results

    # Verify required LOTO
    if permit.isolation_loto_required:
        details = loto_details or permit.isolation_loto_details
        if not details or not details.strip():
            raise ValidationError("ثبت مشخصات ایزولاسیون مکانیکی/برقی و قفل و تگ‌گذاری الزامی است.")
        permit.isolation_loto_details = details

    permit.controls_verified = True
    permit.controls_verified_by = user
    permit.controls_verified_at = now
    permit.status = Permit.Status.ACTIVE
    if not permit.actual_start:
        permit.actual_start = now

    permit.save()

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.activated",
        entity_type="Permit",
        entity_id=permit.id,
        details={"reference_code": permit.reference_code},
    )
    return permit


def suspend_permit(permit: Permit, user, reason: str) -> Permit:
    if not can_control_permits(user, permit.organization_id):
        raise ValidationError("شما مجوز تعلیق پروانه کار را ندارید.")

    if permit.status != Permit.Status.ACTIVE:
        raise ValidationError("تنها مجوزهای فعال قابل تعلیق موقت هستند.")

    if not reason or not reason.strip():
        raise ValidationError("درج دلیل تعلیق کار الزامی است.")

    permit.status = Permit.Status.SUSPENDED
    permit.suspension_reason = reason.strip()
    permit.save(update_fields=["status", "suspension_reason", "updated_at"])

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.suspended",
        entity_type="Permit",
        entity_id=permit.id,
        details={"reference_code": permit.reference_code, "reason": reason},
    )
    return permit


def resume_permit(permit: Permit, user) -> Permit:
    if not can_control_permits(user, permit.organization_id):
        raise ValidationError("شما مجوز ازسرگیری پروانه کار را ندارید.")

    if permit.status != Permit.Status.SUSPENDED:
        raise ValidationError("تنها مجوزهای معلق‌شده امکان ازسرگیری دارند.")

    if timezone.now() > permit.valid_until:
        raise ValidationError("زمان اعتبار مجوز به پایان رسیده و امکان ازسرگیری آن وجود ندارد.")

    permit.status = Permit.Status.ACTIVE
    permit.save(update_fields=["status", "updated_at"])

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.resumed",
        entity_type="Permit",
        entity_id=permit.id,
        details={"reference_code": permit.reference_code},
    )
    return permit


def complete_work(permit: Permit, user) -> Permit:
    if not can_control_permits(user, permit.organization_id):
        raise ValidationError("شما اجازه اعلام اتمام کار را ندارید.")

    if permit.status != Permit.Status.ACTIVE:
        raise ValidationError("تنها مجوزهای در حال اجرا قابل اعلام اتمام کار هستند.")

    permit.status = Permit.Status.COMPLETED
    permit.actual_completion = timezone.now()
    permit.save(update_fields=["status", "actual_completion", "updated_at"])

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.completed",
        entity_type="Permit",
        entity_id=permit.id,
        details={"reference_code": permit.reference_code},
    )
    return permit


def close_permit(permit: Permit, user, closure_summary: str = "") -> Permit:
    if not can_control_permits(user, permit.organization_id):
        raise ValidationError("شما مجوز مختومه‌سازی پروانه کار را ندارید.")

    if permit.status not in {Permit.Status.COMPLETED, Permit.Status.ACTIVE, Permit.Status.EXPIRED}:
        raise ValidationError("مجوز برای مختومه‌سازی باید در وضعیت اتمام، فعال یا منقضی باشد.")

    permit.status = Permit.Status.CLOSED
    permit.closed_by = user
    permit.closed_at = timezone.now()
    permit.closure_summary = closure_summary or "کار پایان یافته، محوطه پاکسازی و خط تحویل گردید."
    permit.save(update_fields=["status", "closed_by", "closed_at", "closure_summary", "updated_at"])

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.closed",
        entity_type="Permit",
        entity_id=permit.id,
        details={"reference_code": permit.reference_code, "closure_summary": permit.closure_summary},
    )
    return permit


def reject_permit(permit: Permit, user, reason: str) -> Permit:
    if not can_approve_permits(user, permit.organization_id):
        raise ValidationError("شما مجوز رد درخواست پروانه کار را ندارید.")

    if permit.status not in {Permit.Status.REQUESTED, Permit.Status.UNDER_REVIEW}:
        raise ValidationError("امکان رد این مجوز وجود ندارد.")

    if not reason or not reason.strip():
        raise ValidationError("ذکر دلیل رد درخواست الزامی است.")

    permit.status = Permit.Status.REJECTED
    permit.rejection_reason = reason.strip()
    permit.save(update_fields=["status", "rejection_reason", "updated_at"])

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.rejected",
        entity_type="Permit",
        entity_id=permit.id,
        details={"reference_code": permit.reference_code, "reason": reason},
    )
    return permit


def cancel_permit(permit: Permit, user, reason: str = "") -> Permit:
    if not (can_control_permits(user, permit.organization_id) or permit.requester_id == user.id):
        raise ValidationError("شما اجازه لغو این مجوز را ندارید.")

    if permit.status in {Permit.Status.CLOSED, Permit.Status.CANCELLED}:
        raise ValidationError("این مجوز قبلاً مختومه یا لغو شده است.")

    permit.status = Permit.Status.CANCELLED
    if reason:
        permit.review_notes = (permit.review_notes + f"\nدلیل لغو: {reason}").strip()
    permit.save(update_fields=["status", "review_notes", "updated_at"])

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.cancelled",
        entity_type="Permit",
        entity_id=permit.id,
        details={"reference_code": permit.reference_code, "reason": reason},
    )
    return permit


# =========================================================
# Shift Handover Services
# =========================================================

def get_outstanding_safety_summary(organization_id: int, workplace_id: int = None) -> dict:
    """Collects real-time safety metrics for shift handover."""
    permits_qs = Permit.objects.filter(organization_id=organization_id)
    if workplace_id:
        permits_qs = permits_qs.filter(workplace_id=workplace_id)

    active_permits = list(permits_qs.filter(status__in=[Permit.Status.ACTIVE, Permit.Status.SUSPENDED]))
    active_count = len(active_permits)

    hazards_qs = Hazard.objects.filter(organization_id=organization_id)
    if workplace_id:
        hazards_qs = hazards_qs.filter(workplace_id=workplace_id)
    unresolved_hazards = list(hazards_qs.filter(status=Hazard.Status.ACTIVE))

    # Overdue or open CAPAs
    capas_qs = CorrectiveAction.objects.filter(organization_id=organization_id)
    if workplace_id:
        capas_qs = capas_qs.filter(non_conformity__workplace_id=workplace_id)
    open_capas = list(capas_qs.filter(status__in=[CorrectiveAction.Status.OPEN, CorrectiveAction.Status.IN_PROGRESS]))

    # Recent incidents (last 7 days)
    seven_days_ago = timezone.now() - timedelta(days=7)
    incidents_qs = Incident.objects.filter(organization_id=organization_id, occurred_at__gte=seven_days_ago)
    if workplace_id:
        incidents_qs = incidents_qs.filter(workplace_id=workplace_id)
    recent_incidents = list(incidents_qs)

    return {
        "active_permits_count": active_count,
        "active_permits": [{"id": p.id, "code": p.reference_code, "title": p.title, "type": p.permit_type, "status": p.status} for p in active_permits],
        "unresolved_hazards_count": len(unresolved_hazards),
        "unresolved_hazards": [{"id": h.id, "title": h.title, "category": h.category} for h in unresolved_hazards[:5]],
        "open_capas_count": len(open_capas),
        "open_capas": [{"id": c.id, "desc": c.description, "due_date": str(c.due_date) if c.due_date else None, "status": c.status} for c in open_capas[:5]],
        "recent_incidents_count": len(recent_incidents),
        "recent_incidents": [{"id": i.id, "title": i.title, "severity": i.severity, "type": i.incident_type} for i in recent_incidents[:5]],
    }


def create_shift_handover(organization: Organization, user, data: dict) -> ShiftHandover:
    if not can_conduct_shift_handover(user, organization.id):
        raise ValidationError("شما مجوز ثبت تحویل و تحول شیفت را ندارید.")

    workplace = data.get("workplace")
    if not workplace or workplace.organization_id != organization.id:
        raise ValidationError("کارگاه انتخابی نامعتبر است.")

    handover = ShiftHandover(
        organization=organization,
        workplace=workplace,
        shift_type=data["shift_type"],
        shift_date=data["shift_date"],
        outgoing_supervisor=user,
        incoming_supervisor=data.get("incoming_supervisor"),
        handover_notes=data["handover_notes"],
        safety_concerns=data.get("safety_concerns", ""),
        equipment_status=data.get("equipment_status", ""),
        outstanding_actions_summary=data.get("outstanding_actions_summary", ""),
        unresolved_hazards_summary=data.get("unresolved_hazards_summary", ""),
        status=ShiftHandover.Status.SUBMITTED,
        is_synthetic=data.get("is_synthetic", False),
    )
    handover.full_clean()
    handover.save()

    active_permits = data.get("active_permits") or data.get("active_permit_ids")
    if active_permits is not None:
        handover.active_permits.set(active_permits)
    else:
        # Auto-attach active permits in that workplace
        auto_permits = Permit.objects.filter(
            organization=organization,
            workplace=workplace,
            status__in=[Permit.Status.ACTIVE, Permit.Status.SUSPENDED],
        )
        handover.active_permits.set(auto_permits)

    log_event(
        organization=organization,
        actor=user,
        action="shift_handover.submitted",
        entity_type="ShiftHandover",
        entity_id=handover.id,
        details={"shift_type": handover.shift_type, "shift_date": str(handover.shift_date)},
    )
    return handover


def acknowledge_shift_handover(handover: ShiftHandover, user, notes: str = "") -> ShiftHandover:
    if not can_conduct_shift_handover(user, handover.organization_id):
        raise ValidationError("شما مجوز تأیید و تحویل شیفت در این کارگاه را ندارید.")

    if handover.status == ShiftHandover.Status.ACKNOWLEDGED:
        raise ValidationError("این تحویل شیفت قبلاً تأیید شده است.")

    if handover.outgoing_supervisor_id == user.id:
        raise ValidationError("سرپرست تحویل‌دهنده نمی‌تواند خودش گزارش تحویل را تأیید کند.")

    handover.status = ShiftHandover.Status.ACKNOWLEDGED
    handover.acknowledged_by = user
    handover.acknowledged_at = timezone.now()
    if notes:
        handover.acknowledgement_notes = notes.strip()
    handover.save(update_fields=["status", "acknowledged_by", "acknowledged_at", "acknowledgement_notes", "updated_at"])

    log_event(
        organization=handover.organization,
        actor=user,
        action="shift_handover.acknowledged",
        entity_type="ShiftHandover",
        entity_id=handover.id,
        details={"shift_type": handover.shift_type, "notes": notes},
    )
    return handover
