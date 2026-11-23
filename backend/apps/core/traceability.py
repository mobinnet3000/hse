import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _


class TraceabilityChain(models.Model):
    """
    زنجیره ردیابی کلان از حادثه/ناهنجاری تا ارزیابی ریسک، اقدام اصلاحی و راستی‌آزمایی
    Incident ID -> Risk ID -> CAPA ID -> Verification ID
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='traceability_chains'
    )
    tracking_code = models.CharField(max_length=64, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    origin_module = models.CharField(max_length=50)  # e.g. 'incidents', 'findings', 'inspections', 'risks'
    origin_object_id = models.CharField(max_length=64)
    status = models.CharField(max_length=32, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'tracking_code']),
            models.Index(fields=['origin_module', 'origin_object_id']),
        ]

    def __str__(self):
        return f"{self.tracking_code} - {self.title}"


class TraceabilityNode(models.Model):
    """
    گره‌های متوالی در زنجیره ردیابی با انواع ۶ گانه ارتباط
    """
    RELATION_TYPES = [
        ('direct', 'مستقیم (Direct)'),
        ('automatic', 'خودکار (Automatic)'),
        ('approval_based', 'تأییدمحور (Approval-Based)'),
        ('event_based', 'اعلان‌محور (Event-Based)'),
        ('bidirectional', 'دوسویه (Bidirectional)'),
        ('analytical', 'تحلیلی (Analytical)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chain = models.ForeignKey(
        TraceabilityChain,
        on_delete=models.CASCADE,
        related_name='nodes'
    )
    from_module = models.CharField(max_length=50)
    from_id = models.CharField(max_length=64)
    to_module = models.CharField(max_length=50)
    to_id = models.CharField(max_length=64)
    relation_type = models.CharField(max_length=30, choices=RELATION_TYPES, default='direct')
    description = models.TextField(blank=True)
    actor = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='traceability_actions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['chain', 'created_at']),
            models.Index(fields=['to_module', 'to_id']),
            models.Index(fields=['from_module', 'from_id']),
        ]

    def __str__(self):
        return f"{self.from_module}({self.from_id}) -> {self.to_module}({self.to_id})"
