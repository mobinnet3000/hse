from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.auditlog.services import log_event
from apps.capa.models import CorrectiveAction
from apps.core.access import (
    can_approve_permits,
    can_conduct_shift_handover,
    can_control_permits,
    is_active_member,
)
from apps.incidents.models import Incident
from apps.organizations.models import Organization
from apps.risks.models import Hazard, RiskAssessment
from apps.workplaces.models import Workplace
from .models import Permit, ShiftHandover, SIMOPSConflict


def _assert_competency_ready(permit):
    """Re-evaluate professional competency at every approval/activation boundary."""
    from apps.workforce.services import assert_permit_competencies

    return assert_permit_competencies(permit)


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

    responsible_supervisor = data.get("responsible_supervisor")
    if responsible_supervisor and not is_active_member(responsible_supervisor, organization.id):
        raise ValidationError("سرپرست اجرایی باید عضو فعال همین سازمان باشد.")

    hazards = data.get("related_hazards") or data.get("related_hazard_ids") or []
    hazards = list(hazards)
    if any(hazard.organization_id != organization.id for hazard in hazards):
        raise ValidationError("خطرهای مرتبط باید متعلق به همین سازمان باشند.")

    assigned_employees = list(data.get("assigned_employees") or [])
    if any(employee.organization_id != organization.id for employee in assigned_employees):
        raise ValidationError("کارکنان معرفی‌شده باید متعلق به همین سازمان باشند.")

    valid_from = data.get("valid_from")
    valid_until = data.get("valid_until")
    if not valid_from or not valid_until:
        raise ValidationError("تعیین تاریخ و ساعت شروع و پایان الزامی است.")
    if valid_until <= valid_from:
        raise ValidationError("تاریخ و ساعت پایان باید بعد از تاریخ شروع باشد.")

    permit_type = data.get("permit_type", Permit.PermitType.GENERAL_HIGH_RISK)
    ref_code = generate_reference_code(organization, permit_type)

    contractor = data.get("contractor")
    if contractor and contractor.organization_id != organization.id:
        raise ValidationError("شرکت پیمانکار انتخابی متعلق به این سازمان نیست.")

    permit = Permit(
        organization=organization,
        workplace=workplace,
        contractor=contractor,
        weather_condition_ok=data.get("weather_condition_ok", True),
        weather_notes=data.get("weather_notes", ""),
        reference_code=ref_code,
        permit_type=permit_type,
        title=data["title"],
        description=data["description"],
        work_area=data.get("work_area", ""),
        equipment_involved=data.get("equipment_involved", ""),
        valid_from=valid_from,
        valid_until=valid_until,
        requester=requester,
        responsible_supervisor=responsible_supervisor,
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

    if hazards:
        permit.related_hazards.set(hazards)
    if assigned_employees:
        permit.assigned_employees.set(assigned_employees)

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

    if status_choice != Permit.Status.UNDER_REVIEW:
        raise ValidationError("عملیات بررسی فقط می‌تواند مجوز را به وضعیت «در حال بررسی» منتقل کند.")

    if permit.status not in {Permit.Status.REQUESTED, Permit.Status.UNDER_REVIEW}:
        raise ValidationError("این مجوز در وضعیت قابل بررسی قرار ندارد.")

    if permit.is_expired:
        raise ValidationError("زمان اعتبار مجوز به پایان رسیده و امکان بررسی آن وجود ندارد.")

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

    if permit.status != Permit.Status.UNDER_REVIEW:
        raise ValidationError("تنها مجوزهای در حال بررسی قابل تأیید هستند؛ ابتدا مجوز را بررسی کنید.")

    if timezone.now() > permit.valid_until:
        raise ValidationError("زمان اعتبار مجوز به پایان رسیده و امکان تأیید آن وجود ندارد.")

    competency_result = _assert_competency_ready(permit)

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
        details={
            "reference_code": permit.reference_code,
            "competency_checked": competency_result["has_requirements"],
            "competency_compliant": competency_result["is_compliant"],
        },
    )
    return permit


INCOMPATIBLE_RULES = [
    (
        Permit.PermitType.HOT_WORK,
        Permit.PermitType.CONFINED_SPACE,
        SIMOPSConflict.Severity.CRITICAL_BLOCK,
        SIMOPSConflict.ConflictType.INCOMPATIBLE_TYPES,
        "همزمانی کار گرم با ورود به فضای بسته در یک کارگاه به دلیل خطرات تجمیع بخارات اشتعال‌پذیر و مسمومیت حاد بلاک است.",
    ),
    (
        Permit.PermitType.CONFINED_SPACE,
        Permit.PermitType.HOT_WORK,
        SIMOPSConflict.Severity.CRITICAL_BLOCK,
        SIMOPSConflict.ConflictType.INCOMPATIBLE_TYPES,
        "همزمانی ورود به فضای بسته با کار گرم در یک کارگاه به دلیل خطرات تجمیع بخارات اشتعال‌پذیر و مسمومیت حاد بلاک است.",
    ),
    (
        Permit.PermitType.WORK_AT_HEIGHT,
        Permit.PermitType.EXCAVATION,
        SIMOPSConflict.Severity.CRITICAL_BLOCK,
        SIMOPSConflict.ConflictType.HEIGHT_OVERHEAD,
        "کار در ارتفاع هم‌راستا با عملیات گودبرداری یا فعالیت زیرین به دلیل ریسک سقوط ابزار، اجسام و لغزش خاک ممنوع و بلاک است.",
    ),
    (
        Permit.PermitType.EXCAVATION,
        Permit.PermitType.WORK_AT_HEIGHT,
        SIMOPSConflict.Severity.CRITICAL_BLOCK,
        SIMOPSConflict.ConflictType.HEIGHT_OVERHEAD,
        "عملیات گودبرداری در زیر فعالیت کار در ارتفاع به دلیل خطرات سقوط تجهیزات و ناپایداری بلاک است.",
    ),
    (
        Permit.PermitType.HOT_WORK,
        Permit.PermitType.HOT_WORK,
        SIMOPSConflict.Severity.WARNING,
        SIMOPSConflict.ConflictType.SPATIAL_OVERLAP,
        "هم‌پوشانی دو عملیات کار گرم در یک کارگاه؛ نیازمند حضور تیم اطفای حریق مستقل برای هر نقطه و فاصله‌گذاری ایمن.",
    ),
    (
        Permit.PermitType.ELECTRICAL_ISOLATION,
        Permit.PermitType.HOT_WORK,
        SIMOPSConflict.Severity.WARNING,
        SIMOPSConflict.ConflictType.ISOLATION_CONFLICT,
        "همزمانی ایزولاسیون با کار گرم؛ نیازمند بازبینی کامل نقاط دشارژ الکتریکی و تایید مجدد فرم LOTO است.",
    ),
]


def evaluate_simops_conflicts(permit: Permit, persist: bool = True) -> list[SIMOPSConflict]:
    """Detect spatial-temporal overlaps with active/approved/suspended permits in the same workplace."""
    if not permit.workplace_id or not permit.valid_from or not permit.valid_until:
        return []

    overlapping_permits = (
        Permit.objects.filter(
            organization_id=permit.organization_id,
            workplace_id=permit.workplace_id,
            status__in=[Permit.Status.APPROVED, Permit.Status.ACTIVE, Permit.Status.SUSPENDED],
            valid_from__lt=permit.valid_until,
            valid_until__gt=permit.valid_from,
        )
        .exclude(pk=permit.pk)
    )

    detected_conflicts = []
    for other in overlapping_permits:
        rule_match = None
        for p1, p2, sev, c_type, desc in INCOMPATIBLE_RULES:
            if permit.permit_type == p1 and other.permit_type == p2:
                rule_match = (sev, c_type, desc)
                break

        if not rule_match:
            rule_match = (
                SIMOPSConflict.Severity.WARNING,
                SIMOPSConflict.ConflictType.SPATIAL_OVERLAP,
                f"همزمانی اجرای مجوز «{permit.title}» با «{other.title}» در کارگاه یکسان ({permit.workplace.name if permit.workplace else 'کارگاه'}).",
            )

        severity, conflict_type, description = rule_match

        if persist and permit.pk:
            conflict, _ = SIMOPSConflict.objects.update_or_create(
                organization_id=permit.organization_id,
                permit_a=permit,
                permit_b=other,
                workplace_id=permit.workplace_id,
                defaults={
                    "conflict_type": conflict_type,
                    "severity": severity,
                    "description": description,
                    "is_resolved": permit.simops_override_approved or other.simops_override_approved,
                    "override_approved": permit.simops_override_approved,
                    "override_by": permit.simops_override_by,
                    "override_reason": permit.simops_override_reason,
                    "override_at": permit.simops_override_at,
                },
            )
            detected_conflicts.append(conflict)
        else:
            detected_conflicts.append(
                SIMOPSConflict(
                    organization_id=permit.organization_id,
                    permit_a=permit,
                    permit_b=other,
                    workplace=permit.workplace,
                    conflict_type=conflict_type,
                    severity=severity,
                    description=description,
                    is_resolved=permit.simops_override_approved,
                )
            )

    return detected_conflicts


def check_permit_gatekeeper_prerequisites(permit: Permit) -> dict:
    """Evaluate pre-job gatekeeper safety checks (contractor, competency, LOTO, gas, weather, SIMOPS)."""
    checks = {
        "is_ready_for_activation": True,
        "blockers": [],
        "warnings": [],
        "contractor": {"status": "ok", "message": "پرسنل داخلی یا بدون پیمانکار"},
        "competency": {"status": "ok", "message": "صلاحیت‌های الزامی احراز شده است"},
        "loto": {"status": "ok", "message": "ایزولاسیون LOTO نیاز نیست یا انجام شده است"},
        "gas_testing": {"status": "ok", "message": "گازسنجی نیاز نیست یا نتایج ثبت شده است"},
        "weather": {"status": "ok", "message": "شرایط جوی مساعد است"},
        "simops": {"status": "ok", "conflicts_count": 0, "conflicts": []},
    }

    # 1. Contractor check
    if permit.contractor_id:
        contractor = permit.contractor
        from apps.workforce.models import ContractorCompany
        if contractor.status != ContractorCompany.Status.APPROVED:
            msg = f"شرکت پیمانکار «{contractor.name}» در وضعیت «{contractor.get_status_display()}» قرار دارد و مجاز به کار نیست."
            checks["is_ready_for_activation"] = False
            checks["blockers"].append(msg)
            checks["contractor"] = {"status": "fail", "message": msg}
        elif contractor.safety_score < 70.0:
            msg = f"رتبه ایمنی پیمانکار ({contractor.safety_score}/100) کمتر از حد آستانه مجاز (۷۰) است."
            checks["is_ready_for_activation"] = False
            checks["blockers"].append(msg)
            checks["contractor"] = {"status": "fail", "message": msg}
        else:
            checks["contractor"] = {
                "status": "ok",
                "message": f"پیمانکار تاییدشده «{contractor.name}» (رتبه ایمنی: {contractor.safety_score})",
            }

    # 2. Competencies
    try:
        from apps.workforce.services import assert_permit_competencies
        comp_res = assert_permit_competencies(permit)
        if comp_res.get("has_requirements") and not comp_res.get("is_compliant"):
            missing = comp_res.get("missing_summary", "")
            msg = f"نقص صلاحیت پرسنل: {missing}"
            checks["is_ready_for_activation"] = False
            checks["blockers"].append(msg)
            checks["competency"] = {"status": "fail", "message": msg, "details": comp_res}
        else:
            checks["competency"] = {"status": "ok", "message": "صلاحیت پرسنل تایید شده است.", "details": comp_res}
    except Exception as exc:
        msg = f"عدم تطابق صلاحیت: {str(exc)}"
        checks["is_ready_for_activation"] = False
        checks["blockers"].append(msg)
        checks["competency"] = {"status": "fail", "message": msg}

    # 3. Gas testing
    if permit.gas_testing_required:
        if not permit.gas_testing_results or not permit.gas_testing_results.strip():
            msg = "گازسنجی اتمسفر الزامی است اما نتایج اندازه‌گیری ثبت نشده است."
            checks["is_ready_for_activation"] = False
            checks["blockers"].append(msg)
            checks["gas_testing"] = {"status": "fail", "message": msg}

    # 4. LOTO isolation
    if permit.isolation_loto_required:
        if not permit.isolation_loto_details or not permit.isolation_loto_details.strip():
            msg = "ایزولاسیون مکانیکی/برقی (LOTO) الزامی است اما جزئیات قطع انرژی ثبت نشده است."
            checks["is_ready_for_activation"] = False
            checks["blockers"].append(msg)
            checks["loto"] = {"status": "fail", "message": msg}

    # 5. Weather
    if not permit.weather_condition_ok:
        msg = f"شرایط جوی برای اجرای این مجوز نامساعد اعلام شده است ({permit.weather_notes or 'نامساعد'})."
        checks["is_ready_for_activation"] = False
        checks["blockers"].append(msg)
        checks["weather"] = {"status": "fail", "message": msg}

    # 6. SIMOPS
    conflicts = evaluate_simops_conflicts(permit, persist=True)
    blocking_conflicts = [
        c for c in conflicts
        if c.severity == SIMOPSConflict.Severity.CRITICAL_BLOCK and not c.is_resolved and not permit.simops_override_approved
    ]
    warning_conflicts = [
        c for c in conflicts
        if c.severity == SIMOPSConflict.Severity.WARNING or c.is_resolved or permit.simops_override_approved
    ]

    checks["simops"] = {
        "status": "fail" if blocking_conflicts else ("warning" if warning_conflicts else "ok"),
        "conflicts_count": len(conflicts),
        "blocking_count": len(blocking_conflicts),
        "conflicts": [
            {
                "id": c.id,
                "other_permit_code": c.permit_b.reference_code,
                "other_permit_title": c.permit_b.title,
                "severity": c.severity,
                "conflict_type": c.conflict_type,
                "description": c.description,
                "is_resolved": c.is_resolved,
            }
            for c in conflicts
        ],
    }

    if blocking_conflicts:
        checks["is_ready_for_activation"] = False
        checks["blockers"].append(
            f"تعارض بحرانی همزمانی عملیات (SIMOPS): {len(blocking_conflicts)} تداخل با مجوزهای فعال کارگاه وجود دارد که مانع از شروع کار است."
        )

    for w in warning_conflicts:
        checks["warnings"].append(f"هشدار SIMOPS: {w.description}")

    # 7. Scaffold Tag & Inspection Check (Phase 15)
    if permit.scaffold_id:
        from apps.scaffolds.services import validate_scaffold_for_permit
        is_safe, sc_msg, sc_details = validate_scaffold_for_permit(permit.scaffold)
        checks["scaffold"] = sc_details
        if not is_safe:
            checks["is_ready_for_activation"] = False
            checks["blockers"].append(sc_msg)
        elif sc_details.get("status") == "warning":
            checks["warnings"].append(sc_msg)
    elif permit.permit_type == Permit.PermitType.WORK_AT_HEIGHT:
        checks["warnings"].append("توجه: این مجوز از نوع کار در ارتفاع است اما داربست مشخصی به آن الصاق نشده است.")

    return checks


def verify_controls_and_activate(permit: Permit, user, gas_results: str = "", loto_details: str = "") -> Permit:
    if not can_control_permits(user, permit.organization_id):
        raise ValidationError("شما مجوز اعتبارسنجی کنترل‌ها و فعال‌سازی این پروانه کار را ندارید.")

    if permit.status not in {Permit.Status.APPROVED, Permit.Status.SUSPENDED}:
        raise ValidationError("تنها مجوزهای تأییدشده یا معلق‌شده قابل فعال‌سازی هستند.")

    now = timezone.now()
    if now > permit.valid_until:
        raise ValidationError("اعتبار زمانی مجوز منقضی شده است و امکان فعال‌سازی آن وجود ندارد.")

    # Update gas results if provided
    if gas_results:
        permit.gas_testing_results = gas_results.strip()
    if loto_details:
        permit.isolation_loto_details = loto_details.strip()

    # Pre-job gatekeeper safety check
    gatekeeper = check_permit_gatekeeper_prerequisites(permit)
    if not gatekeeper["is_ready_for_activation"]:
        raise ValidationError(f"عدم احراز شرایط ایمنی پیش از شروع کار: {'; '.join(gatekeeper['blockers'])}")

    permit.controls_verified = True
    permit.controls_verified_by = user
    permit.controls_verified_at = now
    permit.status = Permit.Status.ACTIVE
    if not permit.actual_start:
        permit.actual_start = now

    permit.save()

    comp_status = gatekeeper.get("competency", {}).get("status")
    comp_compliant = (comp_status == "ok") or (comp_status is None)
    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.activated",
        entity_type="Permit",
        entity_id=permit.id,
        details={
            "reference_code": permit.reference_code,
            "gatekeeper_passed": True,
            "competency_compliant": comp_compliant,
        },
    )
    return permit


def suspend_permit(permit: Permit, user, reason: str) -> Permit:
    if not can_control_permits(user, permit.organization_id):
        raise ValidationError("شما مجوز تعلیق پروانه کار را ندارید.")

    if permit.status != Permit.Status.ACTIVE:
        raise ValidationError("تنها مجوزهای فعال قابل تعلیق موقت هستند.")

    if permit.is_expired:
        raise ValidationError("زمان اعتبار مجوز به پایان رسیده و امکان تعلیق آن وجود ندارد.")

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


def resume_permit(permit: Permit, user, resumption_notes: str = "") -> Permit:
    if not can_control_permits(user, permit.organization_id):
        raise ValidationError("شما مجوز ازسرگیری پروانه کار را ندارید.")

    if permit.status != Permit.Status.SUSPENDED:
        raise ValidationError("تنها مجوزهای معلق‌شده امکان ازسرگیری دارند.")

    if timezone.now() > permit.valid_until:
        raise ValidationError("زمان اعتبار مجوز به پایان رسیده و امکان ازسرگیری آن وجود ندارد.")

    if resumption_notes:
        permit.resumption_notes = resumption_notes.strip()

    gatekeeper = check_permit_gatekeeper_prerequisites(permit)
    if not gatekeeper["is_ready_for_activation"]:
        raise ValidationError(f"عدم امکان ازسرگیری به دلیل موانع ایمنی: {'; '.join(gatekeeper['blockers'])}")

    permit.status = Permit.Status.ACTIVE
    permit.save(update_fields=["status", "resumption_notes", "updated_at"])

    log_event(
        organization=permit.organization,
        actor=user,
        action="permit.resumed",
        entity_type="Permit",
        entity_id=permit.id,
        details={
            "reference_code": permit.reference_code,
            "resumption_notes": resumption_notes,
        },
    )
    return permit


def override_simops_conflict(conflict: SIMOPSConflict, user, reason: str) -> SIMOPSConflict:
    if not can_approve_permits(user, conflict.organization_id):
        raise ValidationError("تنها مدیر HSE یا مقام مجاز صادرکننده مجاز به تایید بای‌پس تداخل همزمانی است.")

    if not reason or not reason.strip():
        raise ValidationError("درج دلیل و تمهیدات کنترلی جبرانی برای بای‌پس SIMOPS الزامی است.")

    now = timezone.now()
    conflict.is_resolved = True
    conflict.override_approved = True
    conflict.override_by = user
    conflict.override_reason = reason.strip()
    conflict.override_at = now
    conflict.save(update_fields=["is_resolved", "override_approved", "override_by", "override_reason", "override_at"])

    # Update permit_a
    permit_a = conflict.permit_a
    permit_a.simops_override_approved = True
    permit_a.simops_override_reason = reason.strip()
    permit_a.simops_override_by = user
    permit_a.simops_override_at = now
    permit_a.save(update_fields=["simops_override_approved", "simops_override_reason", "simops_override_by", "simops_override_at", "updated_at"])

    log_event(
        organization=conflict.organization,
        actor=user,
        action="simops.override_approved",
        entity_type="SIMOPSConflict",
        entity_id=conflict.id,
        details={
            "permit_a": permit_a.reference_code,
            "permit_b": conflict.permit_b.reference_code,
            "reason": reason,
        },
    )
    return conflict


def complete_work(permit: Permit, user) -> Permit:
    if not can_control_permits(user, permit.organization_id):
        raise ValidationError("شما اجازه اعلام اتمام کار را ندارید.")

    if permit.status != Permit.Status.ACTIVE:
        raise ValidationError("تنها مجوزهای در حال اجرا قابل اعلام اتمام کار هستند.")

    if permit.is_expired:
        raise ValidationError("زمان اعتبار مجوز به پایان رسیده و امکان اعلام اتمام کار وجود ندارد.")

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

    if permit.status in {Permit.Status.REJECTED, Permit.Status.CLOSED, Permit.Status.CANCELLED}:
        raise ValidationError("مجوزهای ردشده، مختومه یا لغوشده قابل مختومه‌سازی مجدد نیستند.")

    # Completed/active permits are closable. Any other non-terminal status is
    # closable only after its validity window has elapsed; this matches the UI,
    # which exposes closure for the effective "expired" status.
    if permit.status not in {Permit.Status.COMPLETED, Permit.Status.ACTIVE, Permit.Status.EXPIRED} and not permit.is_expired:
        raise ValidationError("مجوز برای مختومه‌سازی باید اتمام‌یافته، فعال یا منقضی باشد.")

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
    is_controller = can_control_permits(user, permit.organization_id)
    is_requester = permit.requester_id == user.id
    if not (is_controller or is_requester):
        raise ValidationError("شما اجازه لغو این مجوز را ندارید.")

    if permit.status in {
        Permit.Status.COMPLETED,
        Permit.Status.REJECTED,
        Permit.Status.CLOSED,
        Permit.Status.CANCELLED,
    }:
        raise ValidationError("مجوزهای اتمام‌یافته، ردشده، مختومه یا لغوشده قابل لغو نیستند.")

    # A requester may withdraw a permit before field work starts. Once the
    # permit is active, only a controller may cancel it; active work must be
    # suspended first so the safety decision stays with the field controller.
    if not is_controller and permit.status not in {
        Permit.Status.REQUESTED,
        Permit.Status.UNDER_REVIEW,
        Permit.Status.APPROVED,
    }:
        raise ValidationError("پس از فعال‌شدن کار، لغو مجوز فقط توسط کنترل‌کننده میدانی مجاز است.")

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
    now = timezone.now()
    permits_qs = Permit.objects.filter(organization_id=organization_id)
    if workplace_id:
        permits_qs = permits_qs.filter(workplace_id=workplace_id)

    active_permits = list(
        permits_qs.filter(
            status__in=[Permit.Status.ACTIVE, Permit.Status.SUSPENDED],
            valid_until__gt=now,
        )
    )
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


@transaction.atomic
def create_shift_handover(organization: Organization, user, data: dict) -> ShiftHandover:
    if not can_conduct_shift_handover(user, organization.id):
        raise ValidationError("شما مجوز ثبت تحویل و تحول شیفت را ندارید.")

    workplace = data.get("workplace")
    if not workplace or workplace.organization_id != organization.id:
        raise ValidationError("کارگاه انتخابی نامعتبر است.")

    incoming_supervisor = data.get("incoming_supervisor")
    if incoming_supervisor:
        if not is_active_member(incoming_supervisor, organization.id):
            raise ValidationError("سرپرست تحویل‌گیرنده باید عضو فعال همین سازمان باشد.")
        if not can_conduct_shift_handover(incoming_supervisor, organization.id):
            raise ValidationError("سرپرست تحویل‌گیرنده باید نقش مجاز برای تحویل شیفت داشته باشد.")
        if incoming_supervisor.id == user.id:
            raise ValidationError("سرپرست تحویل‌دهنده و تحویل‌گیرنده نمی‌توانند یک نفر باشند.")

    handover = ShiftHandover(
        organization=organization,
        workplace=workplace,
        shift_type=data["shift_type"],
        shift_date=data["shift_date"],
        outgoing_supervisor=user,
        incoming_supervisor=incoming_supervisor,
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
        active_permits = list(active_permits)
        if any(permit.organization_id != organization.id for permit in active_permits):
            raise ValidationError("مجوزهای الصاق‌شده باید متعلق به همین سازمان باشند.")
        if any(
            permit.workplace_id is not None and permit.workplace_id != workplace.id
            for permit in active_permits
        ):
            raise ValidationError("مجوزهای الصاق‌شده باید متعلق به همان کارگاه تحویل شیفت باشند.")
        if any(
            permit.status not in {Permit.Status.ACTIVE, Permit.Status.SUSPENDED}
            or permit.is_expired
            for permit in active_permits
        ):
            raise ValidationError("تنها مجوزهای فعال یا معلق و معتبر قابل الصاق به تحویل شیفت هستند.")
        handover.active_permits.set(active_permits)
    else:
        # Auto-attach active permits in that workplace
        auto_permits = Permit.objects.filter(
            organization=organization,
            workplace=workplace,
            status__in=[Permit.Status.ACTIVE, Permit.Status.SUSPENDED],
            valid_until__gt=timezone.now(),
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

    if handover.incoming_supervisor_id and handover.incoming_supervisor_id != user.id:
        raise ValidationError("تنها سرپرست تحویل‌گیرنده تعیین‌شده می‌تواند این تحویل شیفت را تأیید کند.")

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
