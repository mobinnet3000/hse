import uuid
from django.db import models
from django.utils import timezone


class AIAssessment(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        READY_FOR_ANALYSIS = "ready_for_analysis", "آماده تحلیل هوشمند"
        PROCESSING = "processing", "در حال پردازش هوش مصنوعی"
        ANALYSIS_FAILED = "analysis_failed", "خطا در تحلیل"
        ANALYZED = "analyzed", "تحلیل‌شده (نیازمند بررسی)"
        EDITING = "editing", "در حال ویرایش چک‌لیست"
        VALIDATED = "validated", "اعتبارسنجی‌شده"
        APPROVED = "approved", "تأییدشده توسط کارشناس"
        CHECKLIST_GENERATED = "checklist_generated", "چک‌لیست رسمی صادر شد"
        ARCHIVED = "archived", "بایگانی‌شده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="ai_assessments",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_assessments",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_ai_assessments",
    )
    title = models.CharField(max_length=250, default="ارزیابی هوشمند خطرات محیط کار")
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    analysis_version = models.PositiveIntegerField(default=1)

    # 9-Step Comprehensive Form Data
    input_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="اطلاعات ساختاریافته ۹ مرحله‌ای محیط کار، فعالیت‌ها، تجهیزات و شرایط",
    )

    # AI Analysis & Hazard Findings
    analysis_result = models.JSONField(
        default=dict,
        blank=True,
        help_text="خروجی ساختاریافته تحلیل خطرات، پیامدها، سناریوها و پیشنهادهای AvalAI",
    )

    # Editable Checklist Draft
    checklist_draft = models.JSONField(
        default=dict,
        blank=True,
        help_text="پیش‌نویس ویرایش‌پذیر چک‌لیست شامل بخش‌ها، سوالات و معیارهای بازرسی",
    )

    # Provider & Observability Metadata
    ai_model = models.CharField(max_length=100, blank=True)
    provider_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="اطلاعات متادیتا نظیر تعداد توکن، زمان تاخیر و شناسه درخواست ارائه‌دهنده",
    )
    error_message = models.TextField(blank=True)

    # Approval and Final Checklist Conversion
    approved_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_ai_assessments",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_notes = models.TextField(blank=True)

    generated_checklist = models.ForeignKey(
        "checklists.Checklist",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="originating_ai_assessments",
    )

    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "workplace"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"


class AIGenerationLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assessment = models.ForeignKey(
        AIAssessment,
        on_delete=models.CASCADE,
        related_name="generation_logs",
    )
    provider = models.CharField(max_length=50, default="avalai")
    endpoint = models.CharField(max_length=200)
    model = models.CharField(max_length=100)
    status_code = models.IntegerField(null=True, blank=True)
    duration_ms = models.FloatField(default=0.0)
    prompt_tokens = models.IntegerField(null=True, blank=True)
    completion_tokens = models.IntegerField(null=True, blank=True)
    total_tokens = models.IntegerField(null=True, blank=True)
    request_id = models.CharField(max_length=150, blank=True)
    is_success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        status_text = "موفق" if self.is_success else "ناموفق"
        return f"Log {self.model} - {status_text} ({self.duration_ms}ms)"
