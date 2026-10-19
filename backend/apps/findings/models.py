from django.core.exceptions import ValidationError
from django.db import models


class NonConformity(models.Model):
    class Severity(models.TextChoices):
        LOW = "low", "کم"
        MEDIUM = "medium", "متوسط"
        HIGH = "high", "زیاد"
        CRITICAL = "critical", "بحرانی"

    class Source(models.TextChoices):
        INSPECTION = "inspection", "بازرسی"
        MANUAL = "manual", "ثبت دستی"
        OTHER = "other", "سایر"

    class Status(models.TextChoices):
        OPEN = "open", "باز"
        IN_PROGRESS = "in_progress", "در حال رسیدگی"
        READY_FOR_REVIEW = "ready_for_review", "آماده بررسی"
        CLOSED = "closed", "بسته‌شده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="non_conformities",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="non_conformities",
        null=True,
        blank=True,
    )
    inspection = models.ForeignKey(
        "inspections.Inspection",
        on_delete=models.SET_NULL,
        related_name="non_conformities",
        null=True,
        blank=True,
    )
    inspection_response = models.OneToOneField(
        "inspections.InspectionResponse",
        on_delete=models.SET_NULL,
        related_name="non_conformity",
        null=True,
        blank=True,
    )
    description = models.TextField()
    severity = models.CharField(max_length=16, choices=Severity.choices)
    source = models.CharField(
        max_length=16, choices=Source.choices, default=Source.MANUAL
    )
    responsible = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="non_conformities_responsible",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.OPEN
    )
    evidence_text = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="non_conformities_created",
        null=True,
        blank=True,
    )
    closed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="non_conformities_closed",
        null=True,
        blank=True,
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "status"])]

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError(
                {"workplace": "محل کار باید متعلق به همان سازمان باشد."}
            )
        if self.inspection_id and self.inspection.organization_id != self.organization_id:
            raise ValidationError({"inspection": "بازرسی باید متعلق به همان سازمان باشد."})

    def __str__(self):
        return f"عدم‌انطباق #{self.pk}"
