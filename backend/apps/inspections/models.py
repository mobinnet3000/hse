from django.db import models


class Inspection(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        IN_PROGRESS = "in_progress", "در حال اجرا"
        COMPLETED = "completed", "تکمیل‌شده"
        CANCELLED = "cancelled", "لغوشده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="inspections",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="inspections",
        null=True,
        blank=True,
    )
    checklist = models.ForeignKey(
        "checklists.Checklist",
        on_delete=models.PROTECT,
        related_name="inspections",
    )
    title = models.CharField(max_length=200, blank=True)
    inspector = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="inspections_conducted",
        null=True,
        blank=True,
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    performed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="inspections_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "status"])]

    def __str__(self):
        return self.title or f"بازرسی #{self.pk}"


class InspectionResponse(models.Model):
    class Result(models.TextChoices):
        BLANK = "", "بدون پاسخ"
        CONFORM = "conform", "مطابق"
        NONCONFORM = "nonconform", "نامنطبق"
        NOT_APPLICABLE = "not_applicable", "غیرقابل‌اعمال"

    inspection = models.ForeignKey(
        Inspection, on_delete=models.CASCADE, related_name="responses"
    )
    item = models.ForeignKey(
        "checklists.ChecklistItem",
        on_delete=models.SET_NULL,
        related_name="responses",
        null=True,
        blank=True,
    )
    item_text = models.CharField(max_length=500)
    is_required = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    result = models.CharField(
        max_length=16, choices=Result.choices, blank=True, default=Result.BLANK
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.item_text
