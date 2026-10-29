from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import LiftApprovalLog, LiftingPlan


class LiftingSafetyError(ValidationError):
    pass


def submit_lifting_plan(lifting_plan: LiftingPlan, user) -> LiftingPlan:
    """Submits a draft lifting plan for engineering review."""
    if lifting_plan.status not in [LiftingPlan.Status.DRAFT, LiftingPlan.Status.REJECTED]:
        raise LiftingSafetyError("فقط طرح‌های در وضعیت پیش‌نویس یا رد شده قابل ارسال جهت بررسی هستند.")

    lifting_plan.recalculate_engineering_parameters()
    lifting_plan.status = LiftingPlan.Status.UNDER_REVIEW
    lifting_plan.reviewed_by = user
    lifting_plan.save()

    LiftApprovalLog.objects.create(
        lifting_plan=lifting_plan,
        user=user,
        action="submitted_for_review",
        notes="طرح باربرداری جهت بررسی و تایید مهندسی ارسال شد.",
    )
    return lifting_plan


@transaction.atomic
def approve_lifting_plan(lifting_plan: LiftingPlan, user, approval_notes: str = "") -> LiftingPlan:
    """Applies rigorous engineering validation gates before approving a lifting plan.

    Hard blocking conditions:
    1. Crane utilization > 100% (Overload)
    2. Ground bearing pressure > Allowable ground pressure (Outrigger punch-through risk)
    3. Sling leg tension > Sling rated WLL
    4. Sling leg tension > Shackle rated WLL
    5. Self-approval block on Critical/Tandem lifts.
    """
    lifting_plan.recalculate_engineering_parameters()

    # Gate 0: Valid Gross Load & Crane Capacity Data
    if lifting_plan.total_gross_weight_kg <= 0:
        raise LiftingSafetyError("خطای باربرداری: وزن ناخالص بار باید بزرگ‌تر از صفر باشد.")
    if lifting_plan.crane_capacity_at_radius_kg <= 0:
        raise LiftingSafetyError(
            "خطای بحرانی ایمنی: ظرفیت نامی جرثقیل در شعاع کاری مربوطه مشخص یا معتبر نیست. تایید طرح باربرداری فاقد داده معتبر جدول بار ممنوع است."
        )

    # Gate 1: Crane Capacity Overload
    if lifting_plan.crane_utilization_pct > 100.0:
        raise LiftingSafetyError(
            f"خطای بحرانی ایمنی: ضریب بهره‌برداری جرثقیل ({lifting_plan.crane_utilization_pct}٪) فراتر از ۱۰۰٪ است! تصویب طرح باربرداری دچار اضافه‌بار اکیداً ممنوع است."
        )

    # Gate 2: Outrigger Ground Bearing Pressure
    if (
        lifting_plan.allowable_ground_pressure_kpa > 0
        and lifting_plan.ground_bearing_pressure_kpa > lifting_plan.allowable_ground_pressure_kpa
    ):
        raise LiftingSafetyError(
            f"خطای ناپایداری فونداسیون: فشار جک‌های تثبیت‌کننده ({lifting_plan.ground_bearing_pressure_kpa} kPa) بیشتر از ظرفیت باربری مجاز زمین ({lifting_plan.allowable_ground_pressure_kpa} kPa) است."
        )

    # Gate 3: Sling Capacity Overload
    if lifting_plan.sling_rated_wll_kg > 0 and lifting_plan.tension_per_leg_kg > lifting_plan.sling_rated_wll_kg:
        raise LiftingSafetyError(
            f"خطای پارگی اسلینگ: کشش در هر شاخه ({lifting_plan.tension_per_leg_kg} kg) بیشتر از ظرفیت باربری ایمن اسلینگ ({lifting_plan.sling_rated_wll_kg} kg) است."
        )

    # Gate 4: Shackle Capacity Overload
    if lifting_plan.shackle_rated_wll_kg > 0 and lifting_plan.tension_per_leg_kg > lifting_plan.shackle_rated_wll_kg:
        raise LiftingSafetyError(
            f"خطای شکست اتصال: کشش وارده ({lifting_plan.tension_per_leg_kg} kg) فراتر از ظرفیت نامی شیکل ({lifting_plan.shackle_rated_wll_kg} kg) است."
        )

    # Gate 5: Four-eyes principle on Critical lifts
    if (
        lifting_plan.category in [LiftingPlan.LiftCategory.CRITICAL, LiftingPlan.LiftCategory.TANDEM]
        and lifting_plan.created_by_id == user.id
    ):
        raise LiftingSafetyError(
            "عدم رعایت اصل چهارچشم: در بارهای بحرانی و تاندم، تهیه کننده طرح نمی‌تواند شخصاً طرح خود را تایید نماید. تاییدیه بازرس ارشد HSE/مهندس ناظر الزامی است."
        )

    lifting_plan.status = LiftingPlan.Status.APPROVED
    lifting_plan.approved_by = user
    lifting_plan.approval_notes = approval_notes
    lifting_plan.save()

    LiftApprovalLog.objects.create(
        lifting_plan=lifting_plan,
        user=user,
        action="approved",
        notes=approval_notes or "طرح باربرداری پس از صحه‌گذاری محاسبات مهندسی تایید گردید.",
    )
    return lifting_plan


def reject_lifting_plan(lifting_plan: LiftingPlan, user, rejection_reason: str) -> LiftingPlan:
    """Rejects a lifting plan with mandatory technical justification."""
    if not rejection_reason or not rejection_reason.strip():
        raise LiftingSafetyError("ذکر دلایل فنی رد طرح باربرداری الزامی است.")

    lifting_plan.status = LiftingPlan.Status.REJECTED
    lifting_plan.rejection_reason = rejection_reason
    lifting_plan.save()

    LiftApprovalLog.objects.create(
        lifting_plan=lifting_plan,
        user=user,
        action="rejected",
        notes=f"طرح رد شد. دلیل: {rejection_reason}",
    )
    return lifting_plan


def supersede_lifting_plan(lifting_plan: LiftingPlan, user, reason: str = "") -> LiftingPlan:
    """Supersedes an approved lifting plan when operational conditions change."""
    lifting_plan.status = LiftingPlan.Status.SUPERSEDED
    lifting_plan.save()

    LiftApprovalLog.objects.create(
        lifting_plan=lifting_plan,
        user=user,
        action="superseded",
        notes=reason or "طرح باطل و منسوخ اعلام شد.",
    )
    return lifting_plan
