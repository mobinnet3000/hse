from datetime import date, timedelta
from typing import Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.auditlog.services import log_event
from apps.findings.models import NonConformity

from .models import Scaffold, ScaffoldInspection, ScaffoldTagLog


def record_scaffold_inspection(
    scaffold: Scaffold,
    inspector_name: str,
    result_tag: str,
    inspection_date: Optional[date] = None,
    validity_days: int = 7,
    base_plates_ok: bool = True,
    bracing_ok: bool = True,
    guardrails_ok: bool = True,
    toeboards_ok: bool = True,
    planks_decking_ok: bool = True,
    ties_anchors_ok: bool = True,
    ladder_access_ok: bool = True,
    findings: str = "",
    restrictions_notes: str = "",
    inspector=None,
    is_synthetic: bool = False,
) -> ScaffoldInspection:
    """Record a thorough scaffold inspection, update tag status and history, and create CAPA on red tag."""
    insp_date = inspection_date or timezone.now().date()
    now_dt = timezone.now()

    # Rule: If any structural checkpoint is False, result tag must be RED_UNSAFE
    checkpoints = [
        base_plates_ok,
        bracing_ok,
        guardrails_ok,
        toeboards_ok,
        planks_decking_ok,
        ties_anchors_ok,
        ladder_access_ok,
    ]
    if not all(checkpoints):
        result_tag = Scaffold.TagStatus.RED_UNSAFE

    prev_tag = scaffold.tag_status

    with transaction.atomic():
        nc = None
        if result_tag == Scaffold.TagStatus.RED_UNSAFE:
            failed_parts = []
            if not base_plates_ok:
                failed_parts.append("پایه‌ها و کفی‌های جک")
            if not bracing_ok:
                failed_parts.append("مهاربندهای ضربدری")
            if not guardrails_ok:
                failed_parts.append("نرده‌های حفاظتی استاندارد")
            if not toeboards_ok:
                failed_parts.append("قرنیز محافظ پا")
            if not planks_decking_ok:
                failed_parts.append("تخته‌بندی و عرشه سکو")
            if not ties_anchors_ok:
                failed_parts.append("مهار و اتصال به سازه صلب")
            if not ladder_access_ok:
                failed_parts.append("نردبان و ورودی دسترسی")

            reason_desc = "، ".join(failed_parts) if failed_parts else (findings or "عدم احراز ایمنی در بازرسی")
            nc = NonConformity.objects.create(
                organization=scaffold.organization,
                workplace=scaffold.workplace,
                severity=NonConformity.Severity.CRITICAL,
                source=NonConformity.Source.OTHER,
                status=NonConformity.Status.OPEN,
                description=(
                    f"نقص بحرانی داربست با برچسب {scaffold.tag_number} در «{scaffold.location_details}». "
                    f"علت رد ایمنی و نصب تگ قرمز: {reason_desc}."
                ),
            )

        inspection = ScaffoldInspection.objects.create(
            organization=scaffold.organization,
            scaffold=scaffold,
            inspection_date=insp_date,
            inspector=inspector,
            inspector_name=inspector_name,
            result_tag=result_tag,
            validity_days=validity_days,
            base_plates_ok=base_plates_ok,
            bracing_ok=bracing_ok,
            guardrails_ok=guardrails_ok,
            toeboards_ok=toeboards_ok,
            planks_decking_ok=planks_decking_ok,
            ties_anchors_ok=ties_anchors_ok,
            ladder_access_ok=ladder_access_ok,
            findings=findings,
            restrictions_notes=restrictions_notes,
            non_conformity=nc,
            is_synthetic=is_synthetic,
        )

        # Update Scaffold
        scaffold.tag_status = result_tag
        scaffold.last_inspection_date = insp_date
        scaffold.next_inspection_due = insp_date + timedelta(days=validity_days)

        if result_tag == Scaffold.TagStatus.GREEN_SAFE:
            scaffold.current_tag_valid_until = now_dt + timedelta(days=validity_days)
            scaffold.yellow_restrictions = ""
        elif result_tag == Scaffold.TagStatus.YELLOW_RESTRICTED:
            scaffold.current_tag_valid_until = now_dt + timedelta(days=validity_days)
            scaffold.yellow_restrictions = restrictions_notes or "استفاده مشروط با اتصال مداوم هارنس به لایف‌لاین مستقل."
        elif result_tag == Scaffold.TagStatus.RED_UNSAFE:
            scaffold.current_tag_valid_until = None
            scaffold.yellow_restrictions = ""

        scaffold.save()

        # Record Tag History
        if prev_tag != result_tag or True:
            ScaffoldTagLog.objects.create(
                organization=scaffold.organization,
                scaffold=scaffold,
                previous_tag=prev_tag,
                new_tag=result_tag,
                changed_by=inspector,
                reason=f"نتیجه بازرسی فنی داربست ({inspection_name_display(result_tag)}). {findings}".strip(),
                valid_until=scaffold.current_tag_valid_until,
            )

        if inspector:
            log_event(
                organization=scaffold.organization,
                actor=inspector,
                action="scaffold.inspected",
                entity_type="Scaffold",
                entity_id=scaffold.id,
                details={
                    "tag_number": scaffold.tag_number,
                    "result_tag": result_tag,
                    "previous_tag": prev_tag,
                    "non_conformity_id": nc.id if nc else None,
                },
            )

    return inspection


def inspection_name_display(tag_choice: str) -> str:
    mapping = {
        Scaffold.TagStatus.GREEN_SAFE: "تگ سبز - ایمن و تاییدشده",
        Scaffold.TagStatus.YELLOW_RESTRICTED: "تگ زرد - مشروط و محدود",
        Scaffold.TagStatus.RED_UNSAFE: "تگ قرمز - غیـرایمن و مسدود",
        Scaffold.TagStatus.DISMANTLED: "برچیده‌شده",
    }
    return mapping.get(tag_choice, tag_choice)


def change_scaffold_tag(
    scaffold: Scaffold,
    new_tag: str,
    reason: str,
    actor=None,
    valid_until=None,
    yellow_restrictions: str = "",
) -> Scaffold:
    """Manually modify scaffold tag status (e.g. adverse weather, engineering changes, dismantling)."""
    if not reason or not reason.strip():
        raise ValidationError("درج علت تغییر تگ داربست الزامی است.")

    prev_tag = scaffold.tag_status

    with transaction.atomic():
        scaffold.tag_status = new_tag
        if new_tag == Scaffold.TagStatus.GREEN_SAFE:
            scaffold.current_tag_valid_until = valid_until or (timezone.now() + timedelta(days=scaffold.inspection_interval_days))
            scaffold.yellow_restrictions = ""
        elif new_tag == Scaffold.TagStatus.YELLOW_RESTRICTED:
            scaffold.current_tag_valid_until = valid_until or (timezone.now() + timedelta(days=scaffold.inspection_interval_days))
            scaffold.yellow_restrictions = yellow_restrictions.strip() or "دسترسی محدود با تایید ناظر."
        elif new_tag in (Scaffold.TagStatus.RED_UNSAFE, Scaffold.TagStatus.DISMANTLED):
            scaffold.current_tag_valid_until = None
            scaffold.yellow_restrictions = ""

        scaffold.save()

        ScaffoldTagLog.objects.create(
            organization=scaffold.organization,
            scaffold=scaffold,
            previous_tag=prev_tag,
            new_tag=new_tag,
            changed_by=actor,
            reason=reason.strip(),
            valid_until=scaffold.current_tag_valid_until,
        )

        if actor:
            log_event(
                organization=scaffold.organization,
                actor=actor,
                action="scaffold.tag_modified",
                entity_type="Scaffold",
                entity_id=scaffold.id,
                details={
                    "tag_number": scaffold.tag_number,
                    "previous_tag": prev_tag,
                    "new_tag": new_tag,
                    "reason": reason,
                },
            )

    return scaffold


def validate_scaffold_for_permit(scaffold: Scaffold) -> tuple[bool, str, dict]:
    """Validate scaffold readiness for permit to work gatekeeper checks."""
    if scaffold.tag_status == Scaffold.TagStatus.RED_UNSAFE:
        return (
            False,
            f"داربست شماره {scaffold.tag_number} در وضعیت «تگ قرمز (خطرناک و اکیداً ممنوع)» قرار دارد و امکان کار روی آن وجود ندارد.",
            {"status": "fail", "tag_status": scaffold.tag_status, "reason": "red_tag"},
        )

    if scaffold.tag_status == Scaffold.TagStatus.DISMANTLED:
        return (
            False,
            f"داربست شماره {scaffold.tag_number} برچیده شده است.",
            {"status": "fail", "tag_status": scaffold.tag_status, "reason": "dismantled"},
        )

    if scaffold.is_inspection_overdue:
        return (
            False,
            f"مهلت بازرسی ادواری داربست شماره {scaffold.tag_number} منقضی شده است (موعد: {scaffold.next_inspection_due}) و نیاز به بازرسی مجدد دارد.",
            {"status": "fail", "tag_status": scaffold.tag_status, "reason": "inspection_overdue"},
        )

    if scaffold.tag_status == Scaffold.TagStatus.YELLOW_RESTRICTED:
        return (
            True,  # Allowed conditionally with warning
            f"هشدار: داربست شماره {scaffold.tag_number} دارای تگ زرد (مشروط) است: {scaffold.yellow_restrictions}",
            {"status": "warning", "tag_status": scaffold.tag_status, "restrictions": scaffold.yellow_restrictions},
        )

    return (
        True,
        f"داربست شماره {scaffold.tag_number} با تگ سبز معتبر تایید شده است.",
        {"status": "ok", "tag_status": scaffold.tag_status, "valid_until": str(scaffold.current_tag_valid_until)},
    )
