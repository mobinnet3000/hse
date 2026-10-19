from django.core.exceptions import ValidationError
from django.db import models


class Incident(models.Model):
    class IncidentType(models.TextChoices):
        INCIDENT = "incident", "حادثه ناشی از کار"
        NEAR_MISS = "near_miss", "شبه‌حادثه (Near-Miss)"
        UNSAFE_ACT = "unsafe_act", "عمل ناایمن"
        UNSAFE_CONDITION = "unsafe_condition", "شرایط ناایمن"

    class Severity(models.TextChoices):
        MINOR = "minor", "جزئی (سطح ۱)"
        MODERATE = "moderate", "متوسط (سطح ۲)"
        MAJOR = "major", "شدید (سطح ۳)"
        CRITICAL = "critical", "بحرانی / فاجعه‌بار (سطح ۴)"

    class Status(models.TextChoices):
        REPORTED = "reported", "گزارش‌شده"
        UNDER_REVIEW = "under_review", "در حال بررسی اولیه"
        UNDER_INVESTIGATION = "under_investigation", "در حال بررسی و تحلیل ریشه‌ای"
        ACTION_REQUIRED = "action_required", "نیازمند اقدام اصلاحی (CAPA)"
        AWAITING_VERIFICATION = "awaiting_verification", "در انتظار تأیید اثربخشی"
        CLOSED = "closed", "مختومه‌شده"
        REOPENED = "reopened", "بازگشایی‌شده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="incidents",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="incidents",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200)
    incident_type = models.CharField(
        max_length=32, choices=IncidentType.choices, default=IncidentType.INCIDENT
    )
    severity = models.CharField(
        max_length=20, choices=Severity.choices, default=Severity.MINOR
    )
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.REPORTED
    )
    occurred_at = models.DateTimeField()
    reported_at = models.DateTimeField(auto_now_add=True)
    reported_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="reported_incidents",
        null=True,
        blank=True,
    )
    assigned_investigator = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="assigned_incidents",
        null=True,
        blank=True,
    )
    location_details = models.CharField(max_length=255, blank=True)
    description = models.TextField()
    immediate_actions_taken = models.TextField(blank=True)

    # Impact details
    injury_count = models.PositiveIntegerField(default=0)
    lost_time_days = models.PositiveIntegerField(default=0)
    environmental_impact = models.TextField(blank=True)
    property_damage_cost = models.DecimalField(
        max_digits=15, decimal_places=0, null=True, blank=True
    )

    # Investigation & RCA
    root_cause = models.TextField(blank=True)
    contributing_factors = models.TextField(blank=True)
    investigation_completed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    closure_notes = models.TextField(blank=True)
    reopen_reason = models.TextField(blank=True)

    # Cross-module relationships
    related_hazard = models.ForeignKey(
        "risks.Hazard",
        on_delete=models.SET_NULL,
        related_name="incidents",
        null=True,
        blank=True,
    )
    related_corrective_actions = models.ManyToManyField(
        "capa.CorrectiveAction",
        blank=True,
        related_name="incidents",
    )

    # Synthetic demo flag
    is_synthetic = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "severity"]),
            models.Index(fields=["organization", "incident_type"]),
            models.Index(fields=["occurred_at"]),
        ]

    def __str__(self):
        return f"[{self.get_incident_type_display()}] {self.title} (#{self.pk})"

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "محل کار باید متعلق به همان سازمان باشد."})
        if self.related_hazard_id and self.related_hazard.organization_id != self.organization_id:
            raise ValidationError({"related_hazard": "مخاطره مرتبط باید متعلق به همان سازمان باشد."})


class IncidentAttachment(models.Model):
    incident = models.ForeignKey(
        Incident, on_delete=models.CASCADE, related_name="attachments"
    )
    title = models.CharField(max_length=150)
    attachment_type = models.CharField(max_length=50, default="photo")
    file_url = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.title} ({self.incident_id})"
