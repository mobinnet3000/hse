from django.db import models
from django.utils import timezone
from apps.core.mixins import EnterpriseContextMixin


class Inspection(EnterpriseContextMixin, models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        IN_PROGRESS = "in_progress", "در حال اجرا"
        COMPLETED = "completed", "تکمیل‌شده"
        CANCELLED = "cancelled", "لغوشده"

    class ResultChoice(models.TextChoices):
        PASS = "pass", "تأیید کامل (انطباق)"
        CONDITIONAL = "conditional", "مشروط به رفع نقص"
        FAIL = "fail", "رد شده (دارای نقص بحرانی)"

    inspection_code = models.CharField(max_length=64, blank=True, db_index=True, verbose_name="کد یکتای بازرسی")
    overall_result = models.CharField(
        max_length=20,
        choices=ResultChoice.choices,
        default=ResultChoice.PASS,
        verbose_name="نتیجه کلی بازرسی",
    )
    defects_count = models.PositiveIntegerField(default=0, verbose_name="تعداد عدم انطباق‌ها و نقایص")

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
    equipment = models.ForeignKey(
        "assets.Equipment",
        on_delete=models.SET_NULL,
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

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.equipment_id and self.equipment.organization_id != self.organization_id:
            raise ValidationError({"equipment": "تجهیز مرتبط باید متعلق به همان سازمان باشد."})
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "محل کار باید متعلق به همان سازمان باشد."})

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        now = timezone.now()
        if not self.inspection_code:
            count = Inspection.objects.filter(created_at__year=now.year).count() + 1
            self.inspection_code = f"INS-{now.year}-{count:04d}"

        if not self.title:
            self.title = f"بازرسی {self.inspection_code}"

        if not self.traceability_chain_id:
            self.traceability_chain_id = f"TRC-{self.inspection_code}"

        super().save(*args, **kwargs)

        if is_new:
            try:
                from apps.core.traceability import TraceabilityChain, TraceabilityNode
                chain, _ = TraceabilityChain.objects.get_or_create(
                    organization=self.organization,
                    tracking_code=self.traceability_chain_id,
                    defaults={
                        "title": f"زنجیره ردیابی بازرسی: {self.title}",
                        "origin_module": "inspections",
                        "origin_object_id": str(self.inspection_code),
                    }
                )
                TraceabilityNode.objects.create(
                    chain=chain,
                    from_module="inspections",
                    from_id=str(self.inspection_code),
                    to_module="inspections",
                    to_id=str(self.inspection_code),
                    relation_type="direct",
                    description=f"برنامه‌ریزی و ثبت بازرسی {self.inspection_code}",
                )
            except Exception:
                pass


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
