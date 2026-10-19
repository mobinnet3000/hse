from django.db import models


class AuditEvent(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.SET_NULL,
        related_name="audit_events",
        null=True,
        blank=True,
    )
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="audit_events",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=50)
    entity_type = models.CharField(max_length=50)
    entity_id = models.PositiveBigIntegerField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "created_at"])]

    def __str__(self):
        return f"{self.action} {self.entity_type}#{self.entity_id}"
