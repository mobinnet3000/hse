from django.core.exceptions import ValidationError
from django.db import models

from .risk import LIKELIHOOD_MAX, LIKELIHOOD_MIN, SEVERITY_MAX, SEVERITY_MIN


class Hazard(models.Model):
    class Category(models.TextChoices):
        PHYSICAL = "physical", "فیزیکی"
        CHEMICAL = "chemical", "شیمیایی"
        BIOLOGICAL = "biological", "زیستی"
        ERGONOMIC = "ergonomic", "ارگونومیک"
        PSYCHOSOCIAL = "psychosocial", "روانی-اجتماعی"
        SAFETY = "safety", "ایمنی"
        ENVIRONMENTAL = "environmental", "محیطی"
        OTHER = "other", "سایر"

    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        ACTIVE = "active", "فعال"
        CLOSED = "closed", "بسته‌شده"

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="hazards"
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="hazards",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=32, choices=Category.choices)
    source = models.CharField(max_length=200, blank=True)
    causes = models.TextField(blank=True)
    consequences = models.TextField(blank=True)
    exposed_persons = models.TextField(blank=True)
    existing_controls = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="hazards_created",
        null=True,
        blank=True,
    )
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

    def __str__(self):
        return self.title


class RiskAssessment(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        PENDING = "pending", "در انتظار تأیید"
        APPROVED = "approved", "تأییدشده"
        REJECTED = "rejected", "ردشده"

    class Level(models.TextChoices):
        LOW = "low", "کم"
        MEDIUM = "medium", "متوسط"
        HIGH = "high", "زیاد"
        CRITICAL = "critical", "بحرانی"

    hazard = models.ForeignKey(
        Hazard, on_delete=models.CASCADE, related_name="assessments"
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="risk_assessments",
    )
    likelihood = models.PositiveSmallIntegerField(
        choices=[(value, str(value)) for value in range(LIKELIHOOD_MIN, LIKELIHOOD_MAX + 1)]
    )
    severity = models.PositiveSmallIntegerField(
        choices=[(value, str(value)) for value in range(SEVERITY_MIN, SEVERITY_MAX + 1)]
    )
    score = models.PositiveSmallIntegerField(editable=False)
    level = models.CharField(max_length=16, choices=Level.choices, editable=False)
    proposed_controls = models.TextField(blank=True)
    implemented_controls = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    assessed_at = models.DateTimeField(null=True, blank=True)
    assessed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="risk_assessments_made",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-assessed_at", "-created_at"]
        indexes = [models.Index(fields=["organization", "level"])]

    def clean(self):
        if self.hazard_id and self.hazard.organization_id != self.organization_id:
            raise ValidationError({"hazard": "خطر باید متعلق به همان سازمان باشد."})

    def __str__(self):
        return f"{self.hazard} — {self.get_level_display()}"
