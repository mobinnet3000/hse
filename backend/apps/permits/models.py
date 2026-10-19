from django.core.exceptions import ValidationError
from django.db import models


class Permit(models.Model):
    class PermitType(models.TextChoices):
        HOT_WORK = "hot_work", "کار گرم (شعله، جوشکاری و برش)"
        WORK_AT_HEIGHT = "work_at_height", "کار در ارتفاع"
        CONFINED_SPACE = "confined_space", "ورود به فضای بسته"
        ELECTRICAL_ISOLATION = "electrical_isolation", "ایزولاسیون برقی و انرژی (LOTO)"
        EXCAVATION = "excavation", "حفاری و گودبرداری"
        GENERAL_HIGH_RISK = "general_high_risk", "سایر کارهای پرخطر"

    class Status(models.TextChoices):
        REQUESTED = "requested", "درخواست‌شده"
        UNDER_REVIEW = "under_review", "در حال بررسی"
        APPROVED = "approved", "تأییدشده"
        ACTIVE = "active", "فعال و در حال اجرا"
        SUSPENDED = "suspended", "معلق‌شده"
        COMPLETED = "completed", "اتمام کار عملیاتی"
        CLOSED = "closed", "مختومه‌شده"
        REJECTED = "rejected", "ردشده"
        CANCELLED = "cancelled", "لغوشده"
        EXPIRED = "expired", "منقضی‌شده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="permits",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="permits",
        null=True,
        blank=True,
    )
    reference_code = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="کد مرجع یکتا، مثال: PTW-202610-0001",
    )
    permit_type = models.CharField(
        max_length=32,
        choices=PermitType.choices,
    )
    title = models.CharField(max_length=200)
    description = models.TextField(help_text="شرح دقیق فعالیت و دامنه کار")
    work_area = models.CharField(max_length=200, blank=True, help_text="موقعیت مکانی یا سوله")
    equipment_involved = models.CharField(
        max_length=200, blank=True, help_text="تجهیزات، خطوط لوله یا دستگاه‌های مرتبط"
    )

    # Timeframe
    valid_from = models.DateTimeField(help_text="زمان آغاز اعتبار مجوز")
    valid_until = models.DateTimeField(help_text="زمان پایان اعتبار مجوز")
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_completion = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    # Personnel and Roles
    requester = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="permits_requested",
    )
    responsible_supervisor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="permits_supervised",
        null=True,
        blank=True,
        help_text="سرپرست اجرایی کارگاه",
    )
    approver = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="permits_approved",
        null=True,
        blank=True,
        help_text="مدیر HSE یا مقام مجاز صادرکننده مجوز",
    )
    closed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="permits_closed",
        null=True,
        blank=True,
    )
    assigned_workers = models.TextField(
        blank=True,
        help_text="اسامی یا شماره پرسنلی افراد مجاز به کار تحت این مجوز",
    )

    # Hazards, Precautions & Controls
    related_hazards = models.ManyToManyField(
        "risks.Hazard",
        blank=True,
        related_name="permits",
    )
    precautions_taken = models.TextField(
        blank=True,
        help_text="تمهیدات ایمنی و کنترلی اتخاذشده قبل از شروع کار",
    )
    required_ppe = models.TextField(
        blank=True,
        help_text="تجهیزات حفاظت فردی الزامی (هارنس، ماسک تنفسی، شیلد و...)",
    )
    gas_testing_required = models.BooleanField(
        default=False,
        help_text="آیا گازسنجی اتمسفر الزامی است؟",
    )
    gas_testing_results = models.TextField(
        blank=True,
        help_text="مقادیر اندازه‌گیری‌شده گازها (O2, LEL, H2S, CO) و زمان سنجش",
    )
    isolation_loto_required = models.BooleanField(
        default=False,
        help_text="آیا قفل و تگ‌گذاری و ایزولاسیون مکانیکی/برقی الزامی است؟",
    )
    isolation_loto_details = models.TextField(
        blank=True,
        help_text="شرح نقاط قطع انرژی، برچسب‌ها، شماره قفل و کلید",
    )
    controls_verified = models.BooleanField(
        default=False,
        help_text="تأییدیه اجرای شروط ایمنی قبل از آغاز عملیات",
    )
    controls_verified_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="permits_controls_verified",
        null=True,
        blank=True,
    )
    controls_verified_at = models.DateTimeField(null=True, blank=True)

    # Workflow notes
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.REQUESTED,
        db_index=True,
    )
    review_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    suspension_reason = models.TextField(blank=True)
    closure_summary = models.TextField(blank=True)

    # Synthetic demo flag
    is_synthetic = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-valid_from", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "permit_type"]),
            models.Index(fields=["valid_from", "valid_until"]),
        ]

    def __str__(self):
        return f"[{self.reference_code}] {self.title} ({self.get_status_display()})"

    def clean(self):
        if self.valid_until and self.valid_from and self.valid_until <= self.valid_from:
            raise ValidationError({"valid_until": "زمان پایان اعتبار باید بعد از زمان شروع باشد."})

        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "محل کار باید متعلق به همان سازمان باشد."})


class PermitAttachment(models.Model):
    permit = models.ForeignKey(
        Permit,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    title = models.CharField(max_length=150)
    attachment_type = models.CharField(
        max_length=50,
        default="document",
        help_text="photo, gas_test, checklist, isolation_cert",
    )
    file_url = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.title} ({self.permit.reference_code})"


class ShiftHandover(models.Model):
    class ShiftType(models.TextChoices):
        MORNING = "morning", "شیفت صبح (۰۶:۰۰ الی ۱۴:۰۰)"
        EVENING = "evening", "شیفت عصر (۱۴:۰۰ الی ۲۲:۰۰)"
        NIGHT = "night", "شیفت شب (۲۲:۰۰ الی ۰۶:۰۰)"

    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        SUBMITTED = "submitted", "ثبت‌شده و در انتظار تأیید تحویل‌گیرنده"
        ACKNOWLEDGED = "acknowledged", "تأیید و تحویل‌گرفته‌شده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="shift_handovers",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="shift_handovers",
    )
    shift_type = models.CharField(max_length=16, choices=ShiftType.choices)
    shift_date = models.DateField(help_text="تاریخ شیفت کاری")
    outgoing_supervisor = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="handovers_given",
        help_text="سرپرست یا مسئول تحویل‌دهنده شیفت",
    )
    incoming_supervisor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="handovers_received",
        null=True,
        blank=True,
        help_text="سرپرست یا مسئول تحویل‌گیرنده شیفت",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    # Narrative reports
    handover_notes = models.TextField(help_text="شرح فعالیت‌ها، وقایع و اقدامات مهم شیفت")
    safety_concerns = models.TextField(
        blank=True,
        help_text="مخاطرات ویژه، شواهد ناایمن یا شرایط اضطراری نیازمند پیگیری",
    )
    equipment_status = models.TextField(
        blank=True,
        help_text="وضعیت ماشین‌آلات، توقفات خط و پایش‌های تجهیزاتی",
    )

    # Linked safety state
    active_permits = models.ManyToManyField(
        Permit,
        blank=True,
        related_name="shift_handovers",
        help_text="مجوزهای کار فعال یا معلق در حین تحویل شیفت",
    )
    outstanding_actions_summary = models.TextField(
        blank=True,
        help_text="خلاصه اقدامات اصلاحی باز، سررسیدگذشته یا فوری کارگاه",
    )
    unresolved_hazards_summary = models.TextField(
        blank=True,
        help_text="خلاصه خطرات پرخطر یا بحرانی نیازمند کنترل مداوم",
    )

    # Acknowledgement
    acknowledged_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="handovers_acknowledged",
        null=True,
        blank=True,
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledgement_notes = models.TextField(
        blank=True,
        help_text="توضیحات یا نکات سرپرست تحویل‌گیرنده",
    )

    # Synthetic demo flag
    is_synthetic = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-shift_date", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "workplace"]),
            models.Index(fields=["shift_date", "shift_type"]),
        ]

    def __str__(self):
        return f"تحویل شیفت {self.get_shift_type_display()} - {self.workplace.name} ({self.shift_date})"

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "محل کار باید متعلق به همان سازمان باشد."})
