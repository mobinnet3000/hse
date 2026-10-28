from django.core.exceptions import ValidationError
from django.db import models


class PSSRReview(models.Model):
    class ReviewType(models.TextChoices):
        NEW_INSTALLATION = "new_installation", "تأسیسات و خطوط جدید"
        MAJOR_MODIFICATION = "major_modification", "تغییرات عمده مهندسی و فرایندی (MOC)"
        POST_TURNAROUND = "post_turnaround", "راه‌اندازی مجدد پس از اورهال / تعمیرات اساسی"
        TEMPORARY_CHANGE = "temporary_change", "تغییرات موقت عملیاتی"
        INCIDENT_RESTART = "incident_restart", "راه‌اندازی مجدد پس از توقف اضطراری / حادثه"

    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        IN_PROGRESS = "in_progress", "در حال ممیزی و بررسی میدانی"
        ACTION_ITEMS_PENDING = "action_items_pending", "در انتظار رفع اقدامات اصلاحی"
        APPROVED = "approved", "تصویب‌شده - مجوز راه‌اندازی صادر شد"
        REJECTED = "rejected", "رد شده - عدم امکان راه‌اندازی ایمن"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="pssr_reviews",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="pssr_reviews",
    )
    pssr_number = models.CharField(max_length=60, db_index=True)
    project_or_system_name = models.CharField(max_length=200)
    review_type = models.CharField(max_length=40, choices=ReviewType.choices, default=ReviewType.NEW_INSTALLATION)
    target_startup_date = models.DateField()
    actual_startup_date = models.DateField(null=True, blank=True)

    # Lead and Approver
    leader = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_pssr_reviews",
    )
    approver = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_pssr_reviews",
    )

    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    final_signoff_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("organization", "pssr_number")]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["workplace", "target_startup_date"]),
        ]

    def __str__(self):
        return f"{self.pssr_number} - {self.project_or_system_name} ({self.get_status_display()})"

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "کارگاه باید متعلق به سازمان جاری باشد."})


class PSSRChecklistItem(models.Model):
    class Category(models.TextChoices):
        MECHANICAL_COMPLETION = "mechanical_completion", "تکمیل مکانیکی، لوله‌کشی و آزمون‌های فشار"
        PROCESS_SAFETY = "process_safety", "تجهیزات کاهش فشار، شیرهای اطمینان (PSV) و سیستم‌های فرآیندی"
        ELECTRICAL_INSTRUMENT = "electrical_instrument", "سیستم‌های ابزاردقیق، اینترلاک و خاموشی اضطراری (ESD)"
        PROCEDURES_DOCUMENTS = "procedures_documents", "دستورالعمل‌های بهره‌برداری (SOP)، نقشه‌های As-Built و SDS"
        TRAINING_COMPETENCY = "training_competency", "آموزش و احراز صلاحیت اپراتورها و پرسنل راه‌اندازی"
        EMERGENCY_RESPONSE = "emergency_response", "تجهیزات اعلام و اطفای حریق، چشم‌شوی‌ها و مسیرهای فرار"
        ENVIRONMENTAL_SAFEGUARDS = "environmental_safeguards", "تمهیدات زیست‌محیطی، مهار نشتی و مدیریت پسماند"

    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "در انتظار بررسی"
        COMPLIANT = "compliant", "منطبق و مورد تایید"
        NON_COMPLIANT = "non_compliant", "عدم‌انطباق (نیازمند اصلاح)"
        NOT_APPLICABLE = "not_applicable", "غیرقابل‌اعمال (N/A)"

    pssr = models.ForeignKey(PSSRReview, on_delete=models.CASCADE, related_name="checklist_items")
    category = models.CharField(max_length=40, choices=Category.choices)
    item_text = models.CharField(max_length=300)
    verification_status = models.CharField(
        max_length=30, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )
    is_critical = models.BooleanField(default=True, help_text="در صورت عدم‌انطباق، مانع صدور مجوز نهایی راه‌اندازی می‌شود")
    verified_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)
    comments = models.TextField(blank=True)
    evidence_ref = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "id"]

    def __str__(self):
        return f"[{self.get_category_display()}] {self.item_text[:50]}"


class PSSROutstandingAction(models.Model):
    class ActionStatus(models.TextChoices):
        OPEN = "open", "باز / در حال انجام"
        RESOLVED = "resolved", "رفع‌شده و تاییدشده"
        WAIVED = "waived", "معاف‌شده با تایید مدیر مهندسی"

    pssr = models.ForeignKey(PSSRReview, on_delete=models.CASCADE, related_name="outstanding_actions")
    checklist_item = models.ForeignKey(
        PSSRChecklistItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="actions"
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    responsible = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)
    target_date = models.DateField()
    is_pre_startup = models.BooleanField(
        default=True, help_text="اقدام حیاتی پیش از راه‌اندازی (باید قبل از استارت‌آپ رفع شود)"
    )
    status = models.CharField(max_length=30, choices=ActionStatus.choices, default=ActionStatus.OPEN)
    resolution_notes = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="resolved_pssr_actions"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["is_pre_startup", "target_date"]

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"
