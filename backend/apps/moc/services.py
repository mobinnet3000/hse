from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.moc.models import ChangeRequest
from apps.core.events import dispatch_hse_event, HSEEventRegistry
from apps.core.traceability import TraceabilityChain, TraceabilityNode
from apps.auditlog.services import log_event


def submit_change_request(*, moc: ChangeRequest, user) -> ChangeRequest:
    if moc.status != ChangeRequest.Status.DRAFT:
        raise ValidationError("تنها درخواست‌های تغییر در وضعیت پیش‌نویس قابل ثبت هستند.")

    moc.status = ChangeRequest.Status.SUBMITTED
    moc.save(update_fields=["status", "updated_at"])

    dispatch_hse_event(
        event_name=HSEEventRegistry.MOC_SUBMITTED,
        sender_module="moc",
        payload={"moc_id": moc.id, "moc_number": moc.moc_number, "title": moc.title},
        organization_id=moc.organization_id,
        actor=user,
    )
    return moc


def record_risk_assessment_for_moc(
    *,
    moc: ChangeRequest,
    assessor,
    risk_notes: str,
    risk_register=None,
    is_approved: bool = True,
) -> ChangeRequest:
    """
    ثبت نتایج ارزیابی ریسک تغییر (Approval-Based Matrix Wiring با ماژول مدیریت ریسک)
    """
    if moc.status in {ChangeRequest.Status.CLOSED, ChangeRequest.Status.REJECTED}:
        raise ValidationError("امکان ارزیابی ریسک برای MOC مختومه یا رده‌شده وجود ندارد.")

    moc.risk_assessed = True
    moc.risk_approved = is_approved
    moc.risk_assessor = assessor
    moc.risk_assessment_notes = risk_notes.strip()
    moc.risk_assessed_at = timezone.now()
    if risk_register:
        moc.related_risk_register = risk_register

    if is_approved:
        moc.status = ChangeRequest.Status.UNDER_REVIEW
    else:
        moc.status = ChangeRequest.Status.REJECTED

    moc.save()

    # ثبت گره ردیابی تحلیلی/تأییدی با رجیستر ریسک
    if moc.traceability_chain_id:
        chain = TraceabilityChain.objects.filter(tracking_code=moc.traceability_chain_id).first()
        if chain:
            TraceabilityNode.objects.create(
                chain=chain,
                from_module="moc",
                from_id=moc.moc_number,
                to_module="risks",
                to_id=risk_register.register_code if risk_register else f"RISK-{moc.moc_number}",
                relation_type="approval_based",
                description=f"ارزیابی ریسک تغییر: {'تأیید' if is_approved else 'عدم تأیید'} بر پایه تحلیل خطرات تغییر",
                actor=assessor,
            )

    dispatch_hse_event(
        event_name=HSEEventRegistry.MOC_RISK_ASSESSED,
        sender_module="moc",
        payload={
            "moc_id": moc.id,
            "moc_number": moc.moc_number,
            "risk_approved": is_approved,
            "risk_register_id": str(risk_register.id) if risk_register else None,
        },
        organization_id=moc.organization_id,
        actor=assessor,
    )
    return moc


def authorize_change_request(*, moc: ChangeRequest, approver) -> ChangeRequest:
    """
    تأیید نهایی و مجوز اجرای تغییر (Authorization)
    شرط سخت: در صورت نیاز به ارزیابی ریسک، حتماً باید تأییدیه ریسک (Approval-Based) اخذ شده باشد.
    """
    if moc.risk_assessment_required and not moc.risk_approved:
        raise ValidationError("اجرای تغییر تا پیش از تصویب و اخذ تأییدیه ارزیابی ریسک مجاز نیست.")

    if moc.status not in {ChangeRequest.Status.SUBMITTED, ChangeRequest.Status.RISK_ASSESSED, ChangeRequest.Status.UNDER_REVIEW}:
        raise ValidationError("وضعیت فعلی تغییر امکان تأیید و صدور مجوز اجرا را ندارد.")

    moc.status = ChangeRequest.Status.APPROVED
    moc.approved_by = approver
    moc.approved_at = timezone.now()
    moc.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    # گره تصویب تغییر
    if moc.traceability_chain_id:
        chain = TraceabilityChain.objects.filter(tracking_code=moc.traceability_chain_id).first()
        if chain:
            TraceabilityNode.objects.create(
                chain=chain,
                from_module="moc",
                from_id=moc.moc_number,
                to_module="moc_committee",
                to_id=f"AUTH-{moc.moc_number}",
                relation_type="approval_based",
                description=f"صدور مجوز اجرای تغییرات توسط {approver.get_full_name() or approver.username}",
                actor=approver,
            )

    # انتشار رویداد رسمی جهت فعال‌سازی listener های ماژول‌های مقصد (مانند Risk, PTW, Equipment)
    dispatch_hse_event(
        event_name=HSEEventRegistry.MOC_AUTHORIZED,
        sender_module="moc",
        payload={
            "moc_id": moc.id,
            "moc_number": moc.moc_number,
            "title": moc.title,
            "change_type": moc.change_type,
            "equipment_id": moc.related_equipment_id,
            "project_name": moc.project_name or "پروژه MOC",
            "traceability_chain_id": moc.traceability_chain_id,
        },
        organization_id=moc.organization_id,
        actor=approver,
    )
    return moc


def close_change_request(*, moc: ChangeRequest, user, closure_notes: str = "") -> ChangeRequest:
    if moc.status != ChangeRequest.Status.APPROVED and moc.status != ChangeRequest.Status.IMPLEMENTED:
        raise ValidationError("تنها تغییرات تأییدشده یا اجراشده قابل مختومه‌سازی هستند.")

    moc.status = ChangeRequest.Status.CLOSED
    moc.closed_by = user
    moc.closed_at = timezone.now()
    moc.closure_notes = closure_notes.strip()
    moc.save(update_fields=["status", "closed_by", "closed_at", "closure_notes", "updated_at"])

    dispatch_hse_event(
        event_name=HSEEventRegistry.MOC_CLOSED,
        sender_module="moc",
        payload={"moc_id": moc.id, "moc_number": moc.moc_number},
        organization_id=moc.organization_id,
        actor=user,
    )
    return moc
