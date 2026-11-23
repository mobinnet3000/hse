from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from apps.core.mixins import EnterpriseContextMixin


class NonConformity(EnterpriseContextMixin, models.Model):
    class Severity(models.TextChoices):
        LOW = "low", "کم"
        MEDIUM = "medium", "متوسط"
        HIGH = "high", "زیاد"
        CRITICAL = "critical", "بحرانی"

    class Source(models.TextChoices):
        INSPECTION = "inspection", "بازرسی"
        MANUAL = "manual", "ثبت دستی"
        ANOMALY_REPORT = "anomaly_report", "گزارش ناهنجاری / مشاهده"
        INCIDENT = "incident", "حادثه / شبه‌حادثه"
        AUDIT = "audit", "ممیزی"
        OTHER = "other", "سایر"

    class CategoryFlag(models.TextChoices):
        SAFETY = "safety", "ایمنی (Safety)"
        HEALTH = "health", "بهداشت و ارگونومی (Health)"
        ENVIRONMENT = "environment", "محیط‌زیست (Environment)"
        PPE = "ppe", "تجهیزات حفاظت فردی (PPE)"
        PROCEDURAL = "procedural", "فرآیندی و رویه‌ای (Procedural)"

    class AnomalyType(models.TextChoices):
        UNSAFE_ACT = "unsafe_act", "عمل ناایمن (Unsafe Act)"
        UNSAFE_CONDITION = "unsafe_condition", "شرایط ناایمن (Unsafe Condition)"
        NEAR_MISS = "near_miss", "مشاهده شبه‌حادثه (Near Miss)"
        INSPECTION_FINDING = "inspection_finding", "یافته بازرسی (Inspection Finding)"
        CONTRACTOR_DEVIATION = "contractor_deviation", "انحراف پیمانکار (Contractor Deviation)"
        EQUIPMENT_DEFECT = "equipment_defect", "نقص فنی تجهیز (Equipment Defect)"
        ENVIRONMENTAL_DEVIATION = "environmental_deviation", "انحراف زیست‌محیطی (Environmental Deviation)"
        PROCEDURAL_VIOLATION = "procedural_violation", "نقض دستورالعمل / روش اجرایی (Procedural Violation)"

    class Priority(models.TextChoices):
        LOW = "low", "عادی / کم"
        MEDIUM = "medium", "متوسط"
        HIGH = "high", "بالا / فوری"
        URGENT = "urgent", "بحرانی / اضطراری"

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
    equipment = models.ForeignKey(
        "assets.Equipment",
        on_delete=models.SET_NULL,
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
    reference_number = models.CharField(max_length=60, blank=True, db_index=True)
    description = models.TextField()
    anomaly_type = models.CharField(
        max_length=40, choices=AnomalyType.choices, default=AnomalyType.INSPECTION_FINDING
    )
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.MEDIUM)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    source = models.CharField(
        max_length=20, choices=Source.choices, default=Source.MANUAL
    )
    reporter_name = models.CharField(max_length=150, blank=True)
    location_details = models.CharField(max_length=255, blank=True)
    category_flag = models.CharField(
        max_length=32, choices=CategoryFlag.choices, default=CategoryFlag.SAFETY, verbose_name="حوزه ناهنجاری"
    )
    potential_likelihood = models.PositiveSmallIntegerField(default=2, help_text="احتمال وقوع بالقوه (۱ تا ۵)")
    potential_severity = models.PositiveSmallIntegerField(default=2, help_text="شدت پیامد بالقوه (۱ تا ۵)")
    risk_score = models.IntegerField(default=4)
    immediate_containment = models.TextField(blank=True, help_text="اقدام مهار و کنترل فوری در صحنه")
    target_deadline = models.DateField(null=True, blank=True)

    # اتصالات ماتریس ۲۰ ماژول
    related_risk_register = models.ForeignKey(
        "risks.RiskRegister",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="anomalies",
        help_text="رجیستر یا ارزیابی ریسک مرتبط"
    )
    related_incident = models.ForeignKey(
        "incidents.Incident",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="anomalies",
        help_text="حادثه مرتبط در صورت وقوع یا تشدید"
    )
    contractor = models.ForeignKey(
        "workforce.ContractorCompany",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="anomalies",
        help_text="پیمانکار مربوطه"
    )
    escalated_to_incident = models.BooleanField(default=False)
    escalated_to_risk = models.BooleanField(default=False)
    closure_notes = models.TextField(blank=True)

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
    reopened_count = models.IntegerField(default=0)
    reopened_reason = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "anomaly_type"]),
        ]

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError(
                {"workplace": "محل کار باید متعلق به همان سازمان باشد."}
            )
        if self.inspection_id and self.inspection.organization_id != self.organization_id:
            raise ValidationError({"inspection": "بازرسی باید متعلق به همان سازمان باشد."})
        if self.equipment_id and self.equipment.organization_id != self.organization_id:
            raise ValidationError({"equipment": "تجهیز مرتبط باید متعلق به همان سازمان باشد."})
        if (
            self.equipment_id
            and self.workplace_id
            and self.equipment.workplace_id
            and self.equipment.workplace_id != self.workplace_id
        ):
            raise ValidationError({"equipment": "محل استقرار تجهیز با محل عدم‌انطباق هم‌خوان نیست."})

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if self.potential_likelihood and self.potential_severity:
            self.risk_score = self.potential_likelihood * self.potential_severity

        if not self.reference_number:
            prefix = "ANM" if self.anomaly_type != self.AnomalyType.INSPECTION_FINDING else "NC"
            year = timezone.now().year
            count = NonConformity.objects.filter(organization=self.organization).count() + 1
            self.reference_number = f"{prefix}-{year}-{count:04d}"

        super().save(*args, **kwargs)

        # مدیریت زنجیره ردیابی یکپارچه
        if not self.traceability_chain_id:
            from apps.core.traceability import TraceabilityChain, TraceabilityNode
            chain_code = f"TRC-{self.reference_number}"
            chain, _ = TraceabilityChain.objects.get_or_create(
                tracking_code=chain_code,
                defaults={
                    "organization": self.organization,
                    "title": f"ناهنجاری: {self.description[:45]}",
                    "origin_module": "anomalies",
                    "origin_object_id": str(self.pk),
                    "status": "active",
                }
            )
            TraceabilityNode.objects.get_or_create(
                chain=chain,
                from_module="field_observation",
                from_id=str(self.reporter_name or "observer"),
                to_module="anomalies",
                to_id=str(self.reference_number),
                defaults={
                    "relation_type": "direct",
                    "description": f"ثبت مشاهده ناهنجاری با شناسه {self.reference_number}",
                }
            )
            self.traceability_chain_id = chain.tracking_code
            NonConformity.objects.filter(pk=self.pk).update(traceability_chain_id=chain.tracking_code)

        if is_new:
            from apps.core.events import dispatch_hse_event, HSEEventRegistry
            dispatch_hse_event(
                event_name=HSEEventRegistry.ANOMALY_SUBMITTED,
                sender_module="findings",
                payload={
                    "anomaly_id": self.id,
                    "reference_number": self.reference_number,
                    "anomaly_type": self.anomaly_type,
                    "category_flag": self.category_flag,
                    "risk_score": self.risk_score,
                    "severity": self.severity,
                    "traceability_chain_id": self.traceability_chain_id,
                },
                organization_id=self.organization_id,
                actor=self.created_by,
            )

    @property
    def is_overdue(self) -> bool:
        if self.status != self.Status.CLOSED and self.target_deadline:
            return timezone.now().date() > self.target_deadline
        return False

    def __str__(self):
        return f"{self.reference_number or f'عدم‌انطباق #{self.pk}'}: {self.description[:40]}"


class AnomalyEvidence(models.Model):
    non_conformity = models.ForeignKey(
        NonConformity,
        on_delete=models.CASCADE,
        related_name="evidences",
    )
    file = models.FileField(upload_to="anomalies/%Y/%m/")
    caption = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Evidence for {self.non_conformity_id}"
