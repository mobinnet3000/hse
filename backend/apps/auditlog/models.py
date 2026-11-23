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


from apps.core.mixins import EnterpriseContextMixin
from apps.core.traceability import TraceabilityChain, TraceabilityNode

class AuditPlan(EnterpriseContextMixin, models.Model):
    """
    ماژول ممیزی و انطباق (Audit & Compliance)
    برنامه‌ریزی و اجرای ممیزی‌های داخلی و خارجی HSE بر اساس استانداردهای ISO 45001, ISO 14001 و الزامات قانونی
    """
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "برنامه‌ریزی‌شده"
        IN_PROGRESS = "in_progress", "در حال اجرا"
        COMPLETED = "completed", "تکمیل‌شده و گزارش صادرشده"
        CANCELLED = "cancelled", "لغوشده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="audit_plans",
        verbose_name="سازمان",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="audit_plans",
        verbose_name="دامنه ممیزی / سایت",
    )
    audit_code = models.CharField(max_length=64, unique=True, db_index=True, verbose_name="کد یکتای ممیزی")
    title = models.CharField(max_length=255, verbose_name="عنوان ممیزی")
    audit_standard = models.CharField(
        max_length=150,
        default="ISO 45001:2018 / ISO 14001:2015",
        verbose_name="استاندارد یا مرجع قانونی ممیزی",
    )
    planned_date = models.DateField(verbose_name="تاریخ برنامه‌ریزی‌شده")
    conducted_date = models.DateField(null=True, blank=True, verbose_name="تاریخ واقعی اجرا")
    lead_auditor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audits_led",
        verbose_name="سر‌ممیز HSE",
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.SCHEDULED,
        verbose_name="وضعیت ممیزی",
    )
    scope_summary = models.TextField(blank=True, verbose_name="دامنه و اهداف ممیزی")
    executive_summary = models.TextField(blank=True, verbose_name="خلاصه گزارش ممیزی و نتیجه‌گیری")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-planned_date"]
        verbose_name = "برنامه ممیزی"
        verbose_name_plural = "برنامه‌های ممیزی"

    def __str__(self):
        return f"{self.audit_code} — {self.title} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if not self.audit_code:
            import datetime
            year = datetime.date.today().year
            count = AuditPlan.objects.filter(planned_date__year=year).count() + 1
            self.audit_code = f"AUD-{year}-{count:04d}"
        super().save(*args, **kwargs)
        if not self.traceability_chain_id:
            tracking_code = f"TRC-AUD-{self.pk:04d}"
            chain, _ = TraceabilityChain.objects.get_or_create(
                organization=self.organization,
                tracking_code=tracking_code,
                defaults={
                    "title": f"ممیزی انطباق HSE: {self.title}",
                    "origin_module": "audit",
                    "origin_object_id": str(self.pk),
                },
            )
            self.traceability_chain_id = tracking_code
            TraceabilityNode.objects.create(
                chain=chain,
                from_module="organizations",
                from_id=str(self.organization_id),
                to_module="audit",
                to_id=self.audit_code,
                relation_type="direct",
                description=f"برنامه‌ریزی ممیزی {self.audit_standard}: {self.title}",
            )
            super().save(update_fields=["audit_code", "traceability_chain_id"])


class AuditFinding(models.Model):
    """
    یافته‌های ممیزی: عدم انطباق‌های عمده، جزئی، مشاهدات و فرصت‌های بهبود
    اتصال مستقیم به اقدامات اصلاحی (CAPA)
    """
    class FindingType(models.TextChoices):
        MAJOR_NC = "major_nonconformity", "عدم انطباق عمده (Major NC)"
        MINOR_NC = "minor_nonconformity", "عدم انطباق جزئی (Minor NC)"
        OBSERVATION = "observation", "مشاهده (Observation)"
        OFI = "opportunity_for_improvement", "فرصت بهبود (OFI)"

    audit_plan = models.ForeignKey(
        AuditPlan,
        on_delete=models.CASCADE,
        related_name="findings",
        verbose_name="طرح ممیزی مربوطه",
    )
    finding_type = models.CharField(
        max_length=32,
        choices=FindingType.choices,
        default=FindingType.MINOR_NC,
        verbose_name="نوع یافته",
    )
    standard_clause = models.CharField(max_length=64, blank=True, verbose_name="بند استاندارد")
    description = models.TextField(verbose_name="شرح عدم انطباق یا یافته ممیزی")
    evidence = models.TextField(blank=True, verbose_name="شواهد عینی ممیزی")
    related_capa = models.ForeignKey(
        "capa.CorrectiveAction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_findings",
        verbose_name="اقدام اصلاحی متصل",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["finding_type", "-created_at"]
        verbose_name = "یافته ممیزی"
        verbose_name_plural = "یافته‌های ممیزی"

    def __str__(self):
        return f"[{self.get_finding_type_display()}] {self.description[:50]}"
