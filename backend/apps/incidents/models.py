from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from apps.core.mixins import EnterpriseContextMixin


class Incident(EnterpriseContextMixin, models.Model):
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

    class RCAMethod(models.TextChoices):
        FIVE_WHYS = "5_whys", "روش ۵ چرا (5-Whys)"
        FISHBONE = "fishbone", "نمودار استخوان ماهی (Ishikawa)"
        SCAT = "scat", "تحلیل علت و اثر (SCAT)"
        TAPROOT = "taproot", "روش TapRooT"

    class Status(models.TextChoices):
        REPORTED = "reported", "گزارش‌شده"
        UNDER_REVIEW = "under_review", "در حال بررسی اولیه"
        UNDER_INVESTIGATION = "under_investigation", "در حال بررسی و تحلیل ریشه‌ای"
        ACTION_REQUIRED = "action_required", "نیازمند اقدام اصلاحی (CAPA)"
        AWAITING_VERIFICATION = "awaiting_verification", "در انتظار تأیید اثربخشی"
        CLOSED = "closed", "مختومه‌شده"
        REOPENED = "reopened", "بازگشایی‌شده"

    incident_code = models.CharField(max_length=64, blank=True, db_index=True, verbose_name="کد یکتای حادثه")

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
    equipment = models.ForeignKey(
        "assets.Equipment",
        on_delete=models.SET_NULL,
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

    # Investigation & RCA (Phase 2 Operational Loop)
    rca_method = models.CharField(
        max_length=32, choices=RCAMethod.choices, default=RCAMethod.FIVE_WHYS, verbose_name="روش تحلیل ریشه‌ای"
    )
    direct_causes = models.TextField(blank=True, help_text="علل مستقیم، فوری و شرایط بی‌واسطه حادثه")
    root_cause = models.TextField(blank=True, help_text="علت بنیادین و ریشه‌ای کشف‌شده")
    contributing_factors = models.TextField(blank=True, help_text="عوامل تشدیدکننده و زمینه‌ساز")
    five_whys_data = models.JSONField(default=list, blank=True, help_text="لیست سوالات و پاسخ‌های ۵ چرا")
    lessons_learned = models.TextField(blank=True, help_text="درس‌آموخته‌های ایمنی و اقدامات پیشگیرانه تعمیم‌پذیر")
    investigation_completed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    closure_notes = models.TextField(blank=True)
    reopen_reason = models.TextField(blank=True)
    emergency_alert_dispatched = models.BooleanField(default=False)

    # Cross-module relationships (Matrix of 20 modules)
    related_hazard = models.ForeignKey(
        "risks.Hazard",
        on_delete=models.SET_NULL,
        related_name="incidents",
        null=True,
        blank=True,
    )
    related_risk_register = models.ForeignKey(
        "risks.RiskRegister",
        on_delete=models.SET_NULL,
        related_name="incidents",
        null=True,
        blank=True,
        help_text="رجیستر ریسک مرتبط جهت بازنگری ارزیابی ریسک (Direct/Event-Based)"
    )
    related_permit = models.ForeignKey(
        "permits.Permit",
        on_delete=models.SET_NULL,
        related_name="incidents",
        null=True,
        blank=True,
        help_text="مجوز کار فعال حین وقوع رویداد"
    )
    related_anomaly = models.ForeignKey(
        "findings.NonConformity",
        on_delete=models.SET_NULL,
        related_name="escalated_incidents",
        null=True,
        blank=True,
        help_text="ناهنجاری مبدأ در صورت ارجاع و تشدید"
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
        code = self.incident_code or f"#{self.pk}"
        return f"[{self.get_incident_type_display()}] {code}: {self.title}"

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "محل کار باید متعلق به همان سازمان باشد."})
        if self.related_hazard_id and self.related_hazard.organization_id != self.organization_id:
            raise ValidationError({"related_hazard": "مخاطره مرتبط باید متعلق به همان سازمان باشد."})
        if self.equipment_id and self.equipment.organization_id != self.organization_id:
            raise ValidationError({"equipment": "تجهیز مرتبط باید متعلق به همان سازمان باشد."})
        if (
            self.equipment_id
            and self.workplace_id
            and self.equipment.workplace_id
            and self.equipment.workplace_id != self.workplace_id
        ):
            raise ValidationError({"equipment": "محل استقرار تجهیز با محل حادثه هم‌خوان نیست."})

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if not self.incident_code:
            year = timezone.now().year
            count = Incident.objects.filter(organization=self.organization).count() + 1
            self.incident_code = f"INC-{year}-{count:04d}"

        super().save(*args, **kwargs)

        # مدیریت زنجیره ردیابی
        if not self.traceability_chain_id:
            from apps.core.traceability import TraceabilityChain, TraceabilityNode
            parent_chain_id = None
            if self.related_anomaly and self.related_anomaly.traceability_chain_id:
                parent_chain_id = self.related_anomaly.traceability_chain_id
            elif self.related_permit and self.related_permit.traceability_chain_id:
                parent_chain_id = self.related_permit.traceability_chain_id

            if parent_chain_id:
                chain = TraceabilityChain.objects.filter(tracking_code=parent_chain_id).first()
                if chain:
                    TraceabilityNode.objects.get_or_create(
                        chain=chain,
                        from_module="anomalies" if self.related_anomaly else "permits",
                        from_id=str(self.related_anomaly.reference_number if self.related_anomaly else self.related_permit.reference_code),
                        to_module="incidents",
                        to_id=str(self.incident_code),
                        defaults={
                            "relation_type": "automatic",
                            "description": f"تشدید/ارجاع به حادثه {self.incident_code}",
                        }
                    )
                    self.traceability_chain_id = chain.tracking_code
                    Incident.objects.filter(pk=self.pk).update(traceability_chain_id=chain.tracking_code)

            if not self.traceability_chain_id:
                chain_code = f"TRC-{self.incident_code}"
                chain, _ = TraceabilityChain.objects.get_or_create(
                    tracking_code=chain_code,
                    defaults={
                        "organization": self.organization,
                        "title": f"حادثه: {self.title[:45]}",
                        "origin_module": "incidents",
                        "origin_object_id": str(self.pk),
                        "status": "active",
                    }
                )
                TraceabilityNode.objects.get_or_create(
                    chain=chain,
                    from_module="incident_report",
                    from_id=str(self.reported_by_id or "anonymous"),
                    to_module="incidents",
                    to_id=str(self.incident_code),
                    defaults={
                        "relation_type": "direct",
                        "description": f"ثبت واقعه در دفتر رویدادها با کد {self.incident_code}",
                    }
                )
                self.traceability_chain_id = chain.tracking_code
                Incident.objects.filter(pk=self.pk).update(traceability_chain_id=chain.tracking_code)


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


from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.core.events import dispatch_hse_event, HSEEventRegistry


@receiver(post_save, sender=Incident)
def incident_saved_event(sender, instance, created, **kwargs):
    # 1. رویداد ثبت رویداد
    if created:
        dispatch_hse_event(
            event_name=HSEEventRegistry.INCIDENT_LOGGED,
            sender_module="incidents",
            payload={
                "incident_id": instance.id,
                "incident_code": instance.incident_code,
                "title": instance.title,
                "description": getattr(instance, "description", "") or instance.title,
                "severity": instance.severity,
                "incident_type": instance.incident_type,
                "traceability_chain_id": instance.traceability_chain_id,
            },
            organization_id=instance.organization_id,
            actor=instance.reported_by,
        )

    # 2. اتصال اعلان‌محور (Event-Based) به Emergency Management در صورت حادثه شدید یا بحرانی
    if instance.severity in [Incident.Severity.MAJOR, Incident.Severity.CRITICAL] and not instance.emergency_alert_dispatched:
        dispatch_hse_event(
            event_name=HSEEventRegistry.INCIDENT_CRITICAL_EMERGENCY,
            sender_module="incidents",
            payload={
                "incident_id": instance.id,
                "incident_code": instance.incident_code,
                "title": instance.title,
                "severity": instance.severity,
                "location": instance.location_details,
                "alert": "هشدار فوری: حادثه بحرانی/عمده نیازمند پاسخ وضعیت اضطراری است",
            },
            organization_id=instance.organization_id,
            actor=instance.reported_by,
        )
        Incident.objects.filter(pk=instance.pk).update(emergency_alert_dispatched=True)

    # 3. اتصال خودکار (Automatic) به HSE KPI برای محاسبه شاخص‌های تکرار و شدت
    dispatch_hse_event(
        event_name=HSEEventRegistry.INCIDENT_KPI_UPDATED,
        sender_module="incidents",
        payload={
            "incident_id": instance.id,
            "injury_count": instance.injury_count,
            "lost_time_days": instance.lost_time_days,
            "property_damage_cost": float(instance.property_damage_cost or 0),
            "severity": instance.severity,
        },
        organization_id=instance.organization_id,
        actor=instance.reported_by,
    )

