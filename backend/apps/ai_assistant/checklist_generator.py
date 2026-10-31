import logging
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.auditlog.services import log_event
from apps.checklists.models import Checklist, ChecklistItem
from .models import AIAssessment

logger = logging.getLogger(__name__)


@transaction.atomic
def generate_real_checklist_from_assessment(
    assessment: AIAssessment,
    user,
) -> Checklist:
    """
    Transforms an approved/validated AI checklist draft into a real, first-class HSE Guard Checklist.
    Enforces idempotency, tenant isolation, and transactional integrity.
    """
    # 1. Idempotency protection
    if assessment.generated_checklist_id:
        logger.info("Assessment %s already has generated checklist %s; returning existing.", assessment.id, assessment.generated_checklist_id)
        return assessment.generated_checklist

    # 2. Gatekeeper: Must be explicitly APPROVED
    if assessment.status != AIAssessment.Status.APPROVED:
        raise ValidationError(
            f"صدور چک‌لیست رسمی تنها پس از تأیید نهایی توسط مدیر/کارشناس مجاز امکان‌پذیر است. (وضعیت فعلی: {assessment.get_status_display()})"
        )

    draft = assessment.checklist_draft or {}
    title = (draft.get("title") or assessment.title or "چک‌لیست بازرسی تخصصی HSE").strip()
    description = (draft.get("description") or f"تولیدشده توسط دستیار هوشمند HSE بر اساس ارزیابی {assessment.title}").strip()
    sections = draft.get("sections", [])

    if not sections:
        raise ValidationError("پیش‌نویس چک‌لیست فاقد بخش‌ها یا سوالات بازرسی است.")

    # 3. Create the Real Checklist Entity
    checklist = Checklist.objects.create(
        organization=assessment.organization,
        title=title,
        description=description,
        is_active=True,
        created_by=user,
    )

    items_to_create = []
    global_order = 1

    for s_idx, sec in enumerate(sections, start=1):
        sec_title = sec.get("title", f"بخش {s_idx}").strip()
        sec_items = sec.get("items", [])

        for i_idx, itm in enumerate(sec_items, start=1):
            raw_title = itm.get("title", f"بند {global_order}").strip()
            criterion = itm.get("inspection_criterion", "").strip()
            evidence = itm.get("evidence_required", [])
            is_critical = itm.get("is_critical", False)

            # Build rich item text that renders clearly inside standard ChecklistItem
            parts = []
            if is_critical:
                parts.append("[بحرانی]")
            parts.append(f"[{sec_title}]")
            parts.append(raw_title)

            extra_lines = []
            if criterion:
                extra_lines.append(f"معیار پذیرش: {criterion}")
            if evidence:
                evidence_str = "، ".join(evidence) if isinstance(evidence, list) else str(evidence)
                extra_lines.append(f"شواهد الزامی: {evidence_str}")

            if extra_lines:
                full_text = " ".join(parts) + " — " + " | ".join(extra_lines)
            else:
                full_text = " ".join(parts)

            # Max length safety for ChecklistItem.text (500 chars)
            if len(full_text) > 495:
                full_text = full_text[:492] + "..."

            items_to_create.append(
                ChecklistItem(
                    checklist=checklist,
                    order=global_order,
                    text=full_text,
                    is_required=True,
                )
            )
            global_order += 1

    if items_to_create:
        ChecklistItem.objects.bulk_create(items_to_create)

    # 4. Link & Update Assessment
    assessment.generated_checklist = checklist
    assessment.status = AIAssessment.Status.CHECKLIST_GENERATED
    assessment.save(update_fields=["generated_checklist", "status", "updated_at"])

    # 5. Audit Log
    log_event(
        organization=assessment.organization,
        actor=user,
        action="ai.checklist_generated",
        entity_type="Checklist",
        entity_id=checklist.id,
        details={
            "assessment_id": assessment.id,
            "checklist_title": checklist.title,
            "items_count": len(items_to_create),
        },
    )

    logger.info("Successfully generated real Checklist %s with %d items from Assessment %s", checklist.id, len(items_to_create), assessment.id)
    return checklist
