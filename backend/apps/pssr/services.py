from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import PSSRChecklistItem, PSSROutstandingAction, PSSRReview


class PSSRSafetyError(ValidationError):
    pass


DEFAULT_PSSR_CHECKLIST_TEMPLATE = [
    # Mechanical Completion
    ("mechanical_completion", "کلیه آزمون‌های فشار هیدروستاتیک و پنوماتیک خطوط و مخازن با موفقیت انجام و مدارک آن تایید شده است.", True),
    ("mechanical_completion", "تست شست‌وشو، فلاشینگ خطوط و تمیزکاری داخلی تجهیزات به اتمام رسیده است.", False),
    ("mechanical_completion", "تکیه‌گاه‌ها، مهاربندی‌ها و فنرهای نگهدارنده خطوط لوله (Spring Hangers) در وضعیت مجاز قرار دارند.", True),

    # Process Safety & Pressure Relief
    ("process_safety", "شیرهای اطمینان فشار (PSV) کالیبره، پلمپ و منیفولد تخلیه آن‌ها به مشعل یا محل ایمن متصل است.", True),
    ("process_safety", "دیسک‌های شکست (Rupture Discs) با مشخصات صحیح مهندسی نصب و نشانگر فشار بین دیسک و PSV سالم است.", True),
    ("process_safety", "شیرهای تخلیه اضطراری (BDV) در زمان مجاز آزمون شده و عملکرد بدون نقص دارند.", True),

    # Electrical & Instrumentation
    ("electrical_instrument", "حلقه‌های کنترلی (Control Loops) تست سرد و گرم شده و کالیبراسیون سنسورها نهایی است.", True),
    ("electrical_instrument", "سامانه خاموشی اضطراری (ESD) و اینترلاک‌های ایمنی به صورت ۱۰۰٪ بررسی و تایید شده‌اند.", True),
    ("electrical_instrument", "هم‌بندی ارتینگ مخازن، پایپینگ و سیستم حفاظت در برابر صاعقه اندازه‌گیری شده و زیر ۵ اهم است.", True),

    # Procedures & Documents
    ("procedures_documents", "دستورالعمل‌های بهره‌برداری نرمال و شرایط اضطراری (SOP & EOP) تدوین و در دسترس اتاق کنترل قرار دارد.", True),
    ("procedures_documents", "نقشه‌های P&ID و PFD به صورت چون‌ساخت (As-Built) نهایی و تحویل واحد بهره‌برداری شده است.", False),
    ("procedures_documents", "برگه‌های اطلاعات ایمنی مواد شیمیایی (SDS) در کلیه محل‌های مصرف نصب شده است.", True),

    # Training & Competency
    ("training_competency", "اپراتورهای بهره‌برداری و نوبت‌کاران آموزش‌های تخصصی تجهیزات جدید را فرا گرفته‌اند.", True),
    ("training_competency", "سناریوهای مانور شرایط اضطراری و توقف ناگهانی با پرسنل شیفت مرور شده است.", False),

    # Emergency Response
    ("emergency_response", "دتکتورهای گاز، دود و شعله (F&G) کالیبره بوده و با پنل مرکزی اتاق کنترل لینک هستند.", True),
    ("emergency_response", "سیستم‌های آب آتش‌نشانی، هایدرانت‌ها و فوم در وضعیت آماده‌به‌کار قرار دارند.", True),
    ("emergency_response", "دوش‌ها و چشم‌شوی‌های اضطراری تست شده و فشار و دمای آب آن‌ها استاندارد است.", True),

    # Environmental Safeguards
    ("environmental_safeguards", "حوضچه‌های بتنی مهار نشتی (Bund Walls) عایق‌بندی شده و دریچه‌های خروج مسدود هستند.", True),
    ("environmental_safeguards", "مسیرهای هدایت پساب صنعتی به سیستم تصفیه فاضلاب متصل و مورد آزمایش قرار گرفته است.", True),
]


def populate_default_checklist(pssr: PSSRReview) -> None:
    """Populates standard multi-discipline PSSR questions if review checklist is empty."""
    if pssr.checklist_items.exists():
        return

    items = [
        PSSRChecklistItem(
            pssr=pssr,
            category=cat,
            item_text=txt,
            is_critical=crit,
            verification_status=PSSRChecklistItem.VerificationStatus.PENDING,
        )
        for cat, txt, crit in DEFAULT_PSSR_CHECKLIST_TEMPLATE
    ]
    PSSRChecklistItem.objects.bulk_create(items)


@transaction.atomic
def approve_pssr_review(pssr: PSSRReview, user, signoff_notes: str = "") -> PSSRReview:
    """Enforces absolute gatekeeper rules before granting startup approval.

    Gates:
    1. Zero critical items may be non-compliant or pending.
    2. Zero pre-startup outstanding actions may remain open.
    """
    # Gate 1: Critical Checklist Verification
    unresolved_critical = pssr.checklist_items.filter(
        is_critical=True,
        verification_status__in=[
            PSSRChecklistItem.VerificationStatus.NON_COMPLIANT,
            PSSRChecklistItem.VerificationStatus.PENDING,
        ],
    )
    if unresolved_critical.exists():
        count = unresolved_critical.count()
        raise PSSRSafetyError(
            f"صدور مجوز راه‌اندازی مسدود شد: تعداد {count} بند حیاتی و بحرانی ایمنی در چک‌لیست هنوز در وضعیت عدم‌انطباق یا در انتظار بررسی قرار دارند."
        )

    # Gate 2: Pre-startup Actions
    open_pre_startup_actions = pssr.outstanding_actions.filter(
        is_pre_startup=True,
        status=PSSROutstandingAction.ActionStatus.OPEN,
    )
    if open_pre_startup_actions.exists():
        count = open_pre_startup_actions.count()
        raise PSSRSafetyError(
            f"صدور مجوز راه‌اندازی مسدود شد: تعداد {count} اقدام اصلاحی حیاتی پیش از راه‌اندازی (Pre-Startup) هنوز برطرف و تایید نشده است."
        )

    pssr.status = PSSRReview.Status.APPROVED
    pssr.approver = user
    pssr.actual_startup_date = timezone.now().date()
    pssr.final_signoff_notes = signoff_notes
    pssr.save()
    return pssr


def reject_pssr_review(pssr: PSSRReview, user, reason: str) -> PSSRReview:
    """Rejects startup authorization with mandatory technical reason."""
    if not reason or not reason.strip():
        raise PSSRSafetyError("ذکر دلایل فنی رد راه‌اندازی الزامی است.")

    pssr.status = PSSRReview.Status.REJECTED
    pssr.rejection_reason = reason
    pssr.save()
    return pssr
