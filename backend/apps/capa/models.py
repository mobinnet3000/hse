from django.db import models


class CorrectiveAction(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "باز"
        IN_PROGRESS = "in_progress", "در حال انجام"
        PENDING_VERIFICATION = "pending_verification", "در انتظار تأیید"
        COMPLETED = "completed", "تکمیل‌شده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="corrective_actions",
    )
    non_conformity = models.ForeignKey(
        "findings.NonConformity",
        on_delete=models.CASCADE,
        related_name="corrective_actions",
    )
    description = models.TextField()
    responsible = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="corrective_actions_responsible",
        null=True,
        blank=True,
    )
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.OPEN
    )
    result_text = models.TextField(blank=True)
    effectiveness_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="corrective_actions_verified",
        null=True,
        blank=True,
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="corrective_actions_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "-created_at"]

    def __str__(self):
        return f"اقدام #{self.pk}"
