from django.core.exceptions import ValidationError
from django.db import models


class KnowledgeSource(models.Model):
    class Category(models.TextChoices):
        REGULATION = "regulation", "آیین‌نامه و مقررات دولتی"
        STANDARD = "standard", "استاندارد ملی / بین‌المللی"
        LAW = "law", "قانون مصوب"
        INTERNAL_PROCEDURE = "internal_procedure", "دستورالعمل درون‌سازمانی"
        GUIDELINE = "guideline", "راهنما و خط‌مشی"

    class Status(models.TextChoices):
        ACTIVE = "active", "معتبر و لازم‌الاجرا"
        UNDER_REVISION = "under_revision", "در حال بازنگری"
        SUPERSEDED = "superseded", "منسوخ / جایگزین‌شده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="knowledge_sources",
        null=True,
        blank=True,
        help_text="در صورت خالی بودن، این منبع استاندارد/مقررات عمومی و سراسری است.",
    )
    title = models.CharField(max_length=255)
    code = models.CharField(max_length=100, db_index=True)
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.REGULATION)
    issuing_authority = models.CharField(max_length=200, blank=True)
    effective_date = models.DateField(null=True, blank=True)
    version = models.CharField(max_length=50, blank=True, default="1.0")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    is_verified = models.BooleanField(
        default=True,
        help_text="تأییدیه اصالت و مطابقت با آخرین مصوبات مراجع قانونی یا سازمان",
    )
    summary = models.TextField(blank=True)
    content = models.TextField(help_text="متن کامل یا خلاصه مواد، بندها و الزامات فنی")
    tags = models.CharField(
        max_length=255,
        blank=True,
        help_text="برچسب‌های کلیدی با کاما جدا شوند (مثلاً: ارتفاع، داربست، سقوط)",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="knowledge_sources_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "code"]
        indexes = [
            models.Index(fields=["category", "status"]),
            models.Index(fields=["code"]),
            models.Index(fields=["organization"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.title}"

    def clean(self):
        if self.organization_id and not self.organization.is_active:
            raise ValidationError({"organization": "سازمان انتخابی فعال نیست."})
