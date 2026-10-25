from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q, Count
from django.utils import timezone

from apps.auditlog.services import log_event
from apps.core.access import (
    can_calibrate_equipment,
    can_conduct_asset_work,
    can_manage_equipment,
    is_active_member,
)
from apps.notifications.services import notify_user

from .models import (
    CALIBRATION_DUE_SOON_DAYS,
    MAINTENANCE_DUE_SOON_DAYS,
    CalibrationRecord,
    Equipment,
    MaintenancePlan,
    MaintenanceWorkOrder,
)


READY_BLOCK_MESSAGE = (
    "تجهیز در وضعیت فعلی شرایط آماده‌به‌کار شدن را ندارد: {reason}"
)


def _ensure_member(user, organization_id):
    if not user or not user.is_authenticated or not is_active_member(user, organization_id):
        raise ValidationError("شما عضو فعال این سازمان نیستید.")


def _ensure_manage(user, organization_id):
    _ensure_member(user, organization_id)
    if not can_manage_equipment(user, organization_id):
        raise ValidationError("اجازه مدیریت تجهیزات را ندارید.")


def _ensure_operate(user, organization_id):
    _ensure_member(user, organization_id)
    if not can_conduct_asset_work(user, organization_id):
        raise ValidationError("اجازه ثبت یا اجرای دستورکار نگهداری را ندارید.")


def _ensure_calibrate(user, organization_id):
    _ensure_member(user, organization_id)
    if not can_calibrate_equipment(user, organization_id):
        raise ValidationError("اجازه ثبت کالیبراسیون را ندارید.")


def _validate_related_objects(organization, hazards=None, permits=None):
    if hazards:
        for hazard in hazards:
            if hazard.organization_id != organization.id:
                raise ValidationError("مخاطره مرتبط باید متعلق به همان سازمان باشد.")
    if permits:
        for permit in permits:
            if permit.organization_id != organization.id:
                raise ValidationError("مجوز کار مرتبط باید متعلق به همان سازمان باشد.")


def _validate_responsible(user, organization_id, field_label="مسئول"):
    if user is not None and not is_active_member(user, organization_id):
        raise ValidationError(f"{field_label} باید عضو فعال همان سازمان باشد.")


def _check_code_available(organization_id, code, exclude_pk=None):
    qs = Equipment.objects.filter(organization_id=organization_id, code__iexact=code)
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    if qs.exists():
        raise ValidationError("کد تجهیز در این سازمان تکراری است.")


@transaction.atomic
def create_equipment(*, organization, actor, data):
    _ensure_manage(actor, organization.id)
    payload = dict(data)
    hazards = payload.pop("related_hazards", [])
    permits = payload.pop("related_permits", [])
    payload.pop("organization", None)
    payload.pop("created_by", None)

    code = (payload.get("code") or "").strip()
    if not code:
        raise ValidationError("کد تجهیز الزامی است.")
    payload["code"] = code
    _check_code_available(organization.id, code)

    calibration_required = bool(payload.get("calibration_required", False))
    requested_status = payload.pop("status", None)
    if calibration_required and requested_status == Equipment.Status.READY:
        raise ValidationError(
            "برای تجهیز نیازمند کالیبراسیون، ابتدا کالیبراسیون معتبر ثبت کنید یا وضعیت خارج از سرویس/در حال سرویس انتخاب کنید."
        )
    if requested_status is None:
        requested_status = (
            Equipment.Status.OUT_OF_SERVICE if calibration_required else Equipment.Status.READY
        )
    if requested_status not in Equipment.Status.values:
        raise ValidationError("وضعیت تجهیز نامعتبر است.")

    equipment = Equipment(
        organization=organization,
        created_by=actor,
        status=requested_status,
        **payload,
    )
    equipment.full_clean(exclude=["related_hazards", "related_permits"])
    try:
        equipment.save()
    except IntegrityError as exc:
        raise ValidationError("کد تجهیز در این سازمان تکراری است.") from exc
    _validate_related_objects(organization, hazards, permits)
    equipment.related_hazards.set(hazards)
    equipment.related_permits.set(permits)

    log_event(
        organization=organization,
        actor=actor,
        action="equipment.created",
        entity_type="equipment",
        entity_id=equipment.pk,
        details={
            "code": equipment.code,
            "name": equipment.name,
            "category": equipment.category,
            "status": equipment.status,
            "calibration_required": equipment.calibration_required,
        },
    )
    return equipment


@transaction.atomic
def update_equipment(*, equipment, actor, data):
    _ensure_manage(actor, equipment.organization_id)
    payload = dict(data)
    hazards = payload.pop("related_hazards", None)
    permits = payload.pop("related_permits", None)
    payload.pop("organization", None)
    payload.pop("created_by", None)
    if "code" in payload and payload["code"] != equipment.code:
        raise ValidationError("کد تجهیز پس از ثبت قابل تغییر نیست.")
    payload.pop("code", None)
    payload.pop("status", None)

    old_calibration_required = equipment.calibration_required
    for field, value in payload.items():
        setattr(equipment, field, value)
    equipment.full_clean(exclude=["related_hazards", "related_permits"])

    if (
        not old_calibration_required
        and equipment.calibration_required
        and equipment.status == Equipment.Status.READY
        and not equipment.is_calibration_valid
    ):
        raise ValidationError(
            "فعال‌کردن الزام کالیبراسیون برای تجهیز آماده‌به‌کار، بدون کالیبراسیون معتبر مجاز نیست. ابتدا وضعیت تجهیز را خارج از سرویس کنید."
        )

    if (
        old_calibration_required
        and not equipment.calibration_required
        and equipment.status != Equipment.Status.RETIRED
    ):
        latest = equipment.latest_calibration
        if latest and latest.result == CalibrationRecord.Result.FAILED:
            raise ValidationError(
                "کالیبراسیون ناموفق را نمی‌توان با غیرفعال‌کردن الزام کالیبراسیون نادیده گرفت؛ ابتدا کالیبراسیون قبول ثبت کنید یا تجهیز را بازنشسته کنید."
            )

    equipment.save()
    _validate_related_objects(equipment.organization, hazards, permits)
    if hazards is not None:
        equipment.related_hazards.set(hazards)
    if permits is not None:
        equipment.related_permits.set(permits)

    log_event(
        organization=equipment.organization,
        actor=actor,
        action="equipment.updated",
        entity_type="equipment",
        entity_id=equipment.pk,
        details={"changed_fields": sorted(payload.keys())},
    )
    return equipment


@transaction.atomic
def change_equipment_status(*, equipment, actor, new_status, reason=""):
    _ensure_manage(actor, equipment.organization_id)
    if new_status not in Equipment.Status.values:
        raise ValidationError("وضعیت تجهیز نامعتبر است.")
    old_status = equipment.status
    if old_status == new_status:
        return equipment
    if old_status == Equipment.Status.RETIRED:
        raise ValidationError("تجهیز بازنشسته قابل بازگشت به چرخه بهره‌برداری نیست.")
    if new_status == Equipment.Status.READY:
        block = equipment.maintenance_block_reason()
        if block:
            raise ValidationError(READY_BLOCK_MESSAGE.format(reason=block))

    equipment.status = new_status
    equipment.save(update_fields=["status", "updated_at"])
    log_event(
        organization=equipment.organization,
        actor=actor,
        action="equipment.status_changed",
        entity_type="equipment",
        entity_id=equipment.pk,
        details={
            "old_status": old_status,
            "new_status": new_status,
            "reason": (reason or "").strip(),
        },
    )
    return equipment


@transaction.atomic
def create_maintenance_plan(*, equipment, actor, data):
    _ensure_manage(actor, equipment.organization_id)
    if equipment.status == Equipment.Status.RETIRED:
        raise ValidationError("برای تجهیز بازنشسته نمی‌توان برنامه نگهداری جدید ساخت.")
    payload = dict(data)
    payload.pop("organization", None)
    responsible = payload.get("responsible")
    _validate_responsible(responsible, equipment.organization_id)
    plan = MaintenancePlan(
        equipment=equipment,
        organization=equipment.organization,
        created_by=actor,
        **payload,
    )
    plan.next_due_date = plan.start_date
    plan.full_clean()
    plan.save()
    log_event(
        organization=equipment.organization,
        actor=actor,
        action="maintenance_plan.created",
        entity_type="maintenance_plan",
        entity_id=plan.pk,
        details={
            "equipment_id": equipment.pk,
            "interval_days": plan.interval_days,
            "next_due_date": str(plan.next_due_date),
        },
    )
    return plan


def _latest_completed_date(plan):
    return (
        plan.work_orders.filter(status=MaintenanceWorkOrder.Status.COMPLETED)
        .exclude(completed_date__isnull=True)
        .order_by("-completed_date", "-id")
        .values_list("completed_date", flat=True)
        .first()
    )


def calculate_next_due_date(*, plan, completed_on=None):
    """Rule: next due = last completed service + interval, else plan start date."""
    base = completed_on or _latest_completed_date(plan) or plan.start_date
    return base + timedelta(days=plan.interval_days)


@transaction.atomic
def update_maintenance_plan(*, plan, actor, data):
    _ensure_manage(actor, plan.organization_id)
    payload = dict(data)
    payload.pop("organization", None)
    payload.pop("equipment", None)
    if "responsible" in payload:
        _validate_responsible(payload["responsible"], plan.organization_id)
    for field, value in payload.items():
        setattr(plan, field, value)
    plan.next_due_date = calculate_next_due_date(plan=plan)
    plan.full_clean()
    plan.save()
    log_event(
        organization=plan.organization,
        actor=actor,
        action="maintenance_plan.updated",
        entity_type="maintenance_plan",
        entity_id=plan.pk,
        details={"changed_fields": sorted(payload.keys())},
    )
    return plan


@transaction.atomic
def create_maintenance_work_order(*, equipment, actor, data):
    _ensure_operate(actor, equipment.organization_id)
    if equipment.status == Equipment.Status.RETIRED:
        raise ValidationError("برای تجهیز بازنشسته نمی‌توان دستورکار جدید ایجاد کرد.")
    payload = dict(data)
    payload.pop("organization", None)
    payload.pop("equipment", None)
    payload.pop("status", None)
    plan = payload.get("plan")
    if plan is not None:
        if plan.equipment_id != equipment.id:
            raise ValidationError("برنامه نگهداری باید متعلق به همین تجهیز باشد.")
        if not plan.is_active:
            raise ValidationError("برنامه نگهداری غیرفعال است.")
        if not payload.get("title"):
            payload["title"] = plan.title
        if not payload.get("work_type"):
            payload["work_type"] = MaintenanceWorkOrder.WorkType.PREVENTIVE
    assigned_to = payload.get("assigned_to")
    _validate_responsible(assigned_to, equipment.organization_id, "مسئول انجام")
    if not (payload.get("title") or "").strip():
        raise ValidationError("عنوان دستورکار الزامی است.")
    if not payload.get("scheduled_date"):
        payload["scheduled_date"] = timezone.localdate()
    if not payload.get("work_type"):
        payload["work_type"] = MaintenanceWorkOrder.WorkType.CORRECTIVE

    order = MaintenanceWorkOrder(
        organization=equipment.organization,
        equipment=equipment,
        created_by=actor,
        **payload,
    )
    order.full_clean()
    order.save()
    if order.assigned_to_id:
        notify_user(
            user=order.assigned_to,
            organization=equipment.organization,
            title="دستورکار نگهداری جدید",
            message=f"دستورکار «{order.title}» برای تجهیز {equipment.code} به شما تخصیص یافت. موعد: {order.scheduled_date}",
        )
    log_event(
        organization=equipment.organization,
        actor=actor,
        action="maintenance_work_order.created",
        entity_type="maintenance_work_order",
        entity_id=order.pk,
        details={
            "equipment_id": equipment.pk,
            "work_type": order.work_type,
            "scheduled_date": str(order.scheduled_date),
        },
    )
    return order


@transaction.atomic
def start_maintenance_work_order(*, order, actor):
    _ensure_operate(actor, order.organization_id)
    if order.status != MaintenanceWorkOrder.Status.PLANNED:
        raise ValidationError("فقط دستورکار برنامه‌ریزی‌شده قابل شروع است.")
    order.status = MaintenanceWorkOrder.Status.IN_PROGRESS
    order.save(update_fields=["status", "updated_at"])
    equipment_status = None
    if order.equipment.status == Equipment.Status.READY:
        order.equipment.status = Equipment.Status.UNDER_MAINTENANCE
        order.equipment.save(update_fields=["status", "updated_at"])
        equipment_status = order.equipment.status
    log_event(
        organization=order.organization,
        actor=actor,
        action="maintenance_work_order.started",
        entity_type="maintenance_work_order",
        entity_id=order.pk,
        details={"equipment_id": order.equipment_id, "equipment_status": equipment_status},
    )
    return order


@transaction.atomic
def complete_maintenance_work_order(*, order, actor, completed_date=None, findings="", result=""):
    _ensure_operate(actor, order.organization_id)
    if order.status not in {
        MaintenanceWorkOrder.Status.PLANNED,
        MaintenanceWorkOrder.Status.IN_PROGRESS,
    }:
        raise ValidationError("این دستورکار در وضعیت قابل تکمیل نیست.")
    if not (result or "").strip():
        raise ValidationError("ثبت نتیجه سرویس الزامی است.")
    completed_on = completed_date or timezone.localdate()
    if completed_on > timezone.localdate():
        raise ValidationError("تاریخ انجام نمی‌تواند در آینده باشد.")

    order.status = MaintenanceWorkOrder.Status.COMPLETED
    order.completed_date = completed_on
    order.findings = (findings or "").strip()
    order.result = result.strip()
    order.save(
        update_fields=["status", "completed_date", "findings", "result", "updated_at"]
    )

    if order.plan_id:
        order.plan.next_due_date = calculate_next_due_date(
            plan=order.plan, completed_on=completed_on
        )
        order.plan.save(update_fields=["next_due_date", "updated_at"])

    auto_ready = False
    equipment = order.equipment
    if (
        equipment.status == Equipment.Status.UNDER_MAINTENANCE
        and not equipment.has_open_maintenance_blockers()
        and equipment.is_calibration_valid
    ):
        equipment.status = Equipment.Status.READY
        equipment.save(update_fields=["status", "updated_at"])
        auto_ready = True

    log_event(
        organization=order.organization,
        actor=actor,
        action="maintenance_work_order.completed",
        entity_type="maintenance_work_order",
        entity_id=order.pk,
        details={
            "equipment_id": order.equipment_id,
            "completed_date": str(completed_on),
            "plan_next_due_date": str(order.plan.next_due_date) if order.plan_id else None,
            "equipment_became_ready": auto_ready,
        },
    )
    if order.plan_id and order.plan.responsible_id:
        notify_user(
            user=order.plan.responsible,
            organization=order.organization,
            title="سرویس نگهداری تکمیل شد",
            message=f"دستورکار «{order.title}» تکمیل شد. موعد بعدی: {order.plan.next_due_date}",
        )
    return order


@transaction.atomic
def cancel_maintenance_work_order(*, order, actor, reason):
    _ensure_operate(actor, order.organization_id)
    if order.status not in {
        MaintenanceWorkOrder.Status.PLANNED,
        MaintenanceWorkOrder.Status.IN_PROGRESS,
    }:
        raise ValidationError("این دستورکار قابل لغو نیست.")
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError("علت لغو دستورکار الزامی است.")
    order.status = MaintenanceWorkOrder.Status.CANCELLED
    order.cancellation_reason = reason
    order.save(update_fields=["status", "cancellation_reason", "updated_at"])
    log_event(
        organization=order.organization,
        actor=actor,
        action="maintenance_work_order.cancelled",
        entity_type="maintenance_work_order",
        entity_id=order.pk,
        details={"equipment_id": order.equipment_id, "reason": reason},
    )
    return order


@transaction.atomic
def record_calibration(*, equipment, actor, data):
    _ensure_calibrate(actor, equipment.organization_id)
    if equipment.status == Equipment.Status.RETIRED:
        raise ValidationError("برای تجهیز بازنشسته نمی‌توان کالیبراسیون جدید ثبت کرد.")
    payload = dict(data)
    payload.pop("organization", None)
    payload.pop("equipment", None)
    record = CalibrationRecord(
        equipment=equipment,
        organization=equipment.organization,
        performed_by=actor,
        **payload,
    )
    record.full_clean()
    record.save()

    equipment_status = None
    if record.result == CalibrationRecord.Result.FAILED:
        if equipment.status != Equipment.Status.OUT_OF_SERVICE:
            equipment.status = Equipment.Status.OUT_OF_SERVICE
            equipment.save(update_fields=["status", "updated_at"])
            equipment_status = equipment.status
        if equipment.created_by_id:
            notify_user(
                user=equipment.created_by,
                organization=equipment.organization,
                title="کالیبراسیون ناموفق تجهیز",
                message=f"کالیبراسیون تجهیز {equipment.code} ناموفق بود و تجهیز خارج از سرویس شد. بررسی فنی لازم است.",
            )

    log_event(
        organization=equipment.organization,
        actor=actor,
        action=(
            "equipment.calibration_failed"
            if record.result == CalibrationRecord.Result.FAILED
            else "equipment.calibration_recorded"
        ),
        entity_type="calibration_record",
        entity_id=record.pk,
        details={
            "equipment_id": equipment.pk,
            "result": record.result,
            "performed_on": str(record.performed_on),
            "next_due_on": str(record.next_due_on),
            "equipment_status": equipment_status,
        },
    )
    return record


def equipment_stats(queryset):
    today = timezone.localdate()
    equipment = list(queryset)
    ids = [item.id for item in equipment]
    plans = MaintenancePlan.objects.filter(equipment_id__in=ids, is_active=True)
    work_orders = MaintenanceWorkOrder.objects.filter(
        equipment_id__in=ids,
        status__in=[
            MaintenanceWorkOrder.Status.PLANNED,
            MaintenanceWorkOrder.Status.IN_PROGRESS,
        ],
    )
    by_status = {choice: 0 for choice in Equipment.Status.values}
    by_category = {choice: 0 for choice in Equipment.Category.values}
    calibration = {"not_required": 0, "missing": 0, "valid": 0, "due_soon": 0, "expired": 0, "failed": 0}
    for item in equipment:
        by_status[item.status] = by_status.get(item.status, 0) + 1
        by_category[item.category] = by_category.get(item.category, 0) + 1
        calibration[item.calibration_status] = calibration.get(item.calibration_status, 0) + 1

    return {
        "total_equipment": len(equipment),
        "by_status": by_status,
        "by_category": by_category,
        "ready_count": by_status.get(Equipment.Status.READY, 0),
        "under_maintenance_count": by_status.get(Equipment.Status.UNDER_MAINTENANCE, 0),
        "out_of_service_count": by_status.get(Equipment.Status.OUT_OF_SERVICE, 0),
        "retired_count": by_status.get(Equipment.Status.RETIRED, 0),
        "maintenance_overdue_count": plans.filter(next_due_date__lt=today).count(),
        "maintenance_due_soon_count": plans.filter(
            next_due_date__gte=today,
            next_due_date__lte=today + timedelta(days=MAINTENANCE_DUE_SOON_DAYS),
        ).count(),
        "open_work_order_count": work_orders.count(),
        "overdue_work_order_count": work_orders.filter(scheduled_date__lt=today).count(),
        "calibration_due_soon_count": calibration["due_soon"],
        "calibration_expired_count": calibration["expired"],
        "calibration_failed_count": calibration["failed"],
        "calibration_missing_count": calibration["missing"],
        "calibration_valid_count": calibration["valid"],
        "calibration_invalid_count": calibration["missing"]
        + calibration["expired"]
        + calibration["failed"],
        "calibration_due_soon_days": CALIBRATION_DUE_SOON_DAYS,
        "maintenance_due_soon_days": MAINTENANCE_DUE_SOON_DAYS,
    }
