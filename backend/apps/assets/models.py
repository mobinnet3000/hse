from datetime import timedelta

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


CALIBRATION_DUE_SOON_DAYS = 30
MAINTENANCE_DUE_SOON_DAYS = 7


class Equipment(models.Model):
    class Category(models.TextChoices):
        FIRE_EXTINGUISHER = "fire_extinguisher", "خاموش‌کننده حریق"
        PPE = "ppe", "تجهیزات حفاظت فردی قابل ردیابی"
        GAS_DETECTION = "gas_detection", "تجهیزات گازسنجی"
        ELECTRICAL = "electrical", "تجهیزات برقی"
        RESCUE = "rescue", "امداد و نجات"
        LIFTING = "lifting", "تجهیزات بالابر و بارگیری"
        OTHER = "other", "سایر تجهیزات"

    class Status(models.TextChoices):
        READY = "ready", "آماده به کار"
        UNDER_MAINTENANCE = "under_maintenance", "در حال سرویس/تعمیر"
        OUT_OF_SERVICE = "out_of_service", "خارج از سرویس"
        RETIRED = "retired", "بازنشسته"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="equipment",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="equipment",
        null=True,
        blank=True,
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=200)
    category = models.CharField(
        max_length=32, choices=Category.choices, default=Category.OTHER
    )
    category_detail = models.CharField(max_length=120, blank=True)
    manufacturer = models.CharField(max_length=150, blank=True)
    model_number = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    installation_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.READY, db_index=True
    )
    description = models.TextField(blank=True)
    specifications = models.TextField(blank=True)
    calibration_required = models.BooleanField(default=False)
    related_hazards = models.ManyToManyField(
        "risks.Hazard", blank=True, related_name="equipment"
    )
    related_permits = models.ManyToManyField(
        "permits.Permit", blank=True, related_name="equipment"
    )
    is_synthetic = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="equipment_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"], name="unique_equipment_code_per_org"
            )
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "category"]),
            models.Index(fields=["organization", "workplace"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت تجهیز مجاز نیست؛ برای خروج از بهره‌برداری از وضعیت بازنشسته استفاده کنید."
        )

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "محل استقرار باید متعلق به همان سازمان باشد."})
        if self.purchase_date and self.installation_date:
            if self.installation_date < self.purchase_date:
                raise ValidationError(
                    {"installation_date": "تاریخ نصب نمی‌تواند قبل از تاریخ خرید باشد."}
                )

    @property
    def latest_calibration(self):
        if not hasattr(self, "_latest_calibration"):
            self._latest_calibration = self.calibrations.order_by(
                "-performed_on", "-id"
            ).first()
        return self._latest_calibration

    @property
    def calibration_due_on(self):
        record = self.latest_calibration
        return record.next_due_on if record else None

    @property
    def is_calibration_valid(self):
        if not self.calibration_required:
            return True
        record = self.latest_calibration
        if record is None or record.result != CalibrationRecord.Result.PASSED:
            return False
        return record.next_due_on >= timezone.localdate()

    @property
    def calibration_status(self):
        if not self.calibration_required:
            return "not_required"
        record = self.latest_calibration
        if record is None:
            return "missing"
        if record.result == CalibrationRecord.Result.FAILED:
            return "failed"
        today = timezone.localdate()
        if record.next_due_on < today:
            return "expired"
        if record.next_due_on <= today + timedelta(days=CALIBRATION_DUE_SOON_DAYS):
            return "due_soon"
        return "valid"

    def has_open_maintenance_blockers(self):
        return self.work_orders.filter(
            models.Q(status=MaintenanceWorkOrder.Status.IN_PROGRESS)
            | models.Q(
                status=MaintenanceWorkOrder.Status.PLANNED,
                work_type=MaintenanceWorkOrder.WorkType.CORRECTIVE,
            )
        ).exists()

    def maintenance_block_reason(self):
        if not self.is_calibration_valid:
            return "کالیبراسیون تجهیز معتبر نیست."
        if self.has_open_maintenance_blockers():
            return "دستورکار باز اصلاحی یا در حال اجرا برای تجهیز وجود دارد."
        return None


class MaintenancePlan(models.Model):
    equipment = models.ForeignKey(
        Equipment, on_delete=models.PROTECT, related_name="maintenance_plans"
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="maintenance_plans",
    )
    title = models.CharField(max_length=200)
    interval_days = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(3650)]
    )
    instructions = models.TextField(blank=True)
    responsible = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="maintenance_plans_responsible",
        null=True,
        blank=True,
    )
    start_date = models.DateField()
    next_due_date = models.DateField(db_index=True)
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="maintenance_plans_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["next_due_date", "title"]
        indexes = [models.Index(fields=["organization", "is_active", "next_due_date"])]

    def __str__(self):
        return f"{self.title} — {self.equipment.code}"

    def delete(self, *args, **kwargs):
        raise ValidationError("حذف سخت برنامه نگهداری مجاز نیست؛ برنامه را غیرفعال کنید.")

    def clean(self):
        if self.equipment_id and self.organization_id != self.equipment.organization_id:
            raise ValidationError({"equipment": "تجهیز باید متعلق به همان سازمان باشد."})
        if self.start_date and not self.next_due_date:
            raise ValidationError({"next_due_date": "موعد بعدی الزامی است."})

    def save(self, *args, **kwargs):
        if not self.next_due_date and self.start_date:
            self.next_due_date = self.start_date
        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        return self.is_active and self.next_due_date < timezone.localdate()

    @property
    def is_due_soon(self):
        today = timezone.localdate()
        return (
            self.is_active
            and today <= self.next_due_date
            <= today + timedelta(days=MAINTENANCE_DUE_SOON_DAYS)
        )


class MaintenanceWorkOrder(models.Model):
    class WorkType(models.TextChoices):
        PREVENTIVE = "preventive", "نگهداری پیشگیرانه"
        CORRECTIVE = "corrective", "تعمیر اصلاحی"

    class Status(models.TextChoices):
        PLANNED = "planned", "برنامه‌ریزی‌شده"
        IN_PROGRESS = "in_progress", "در حال انجام"
        COMPLETED = "completed", "تکمیل‌شده"
        CANCELLED = "cancelled", "لغوشده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="maintenance_work_orders",
    )
    equipment = models.ForeignKey(
        Equipment, on_delete=models.PROTECT, related_name="work_orders"
    )
    plan = models.ForeignKey(
        MaintenancePlan,
        on_delete=models.SET_NULL,
        related_name="work_orders",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200)
    work_type = models.CharField(max_length=16, choices=WorkType.choices)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PLANNED, db_index=True
    )
    assigned_to = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="maintenance_work_orders_assigned",
        null=True,
        blank=True,
    )
    scheduled_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    findings = models.TextField(blank=True)
    result = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="maintenance_work_orders_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_date", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "scheduled_date"]),
        ]

    def __str__(self):
        return f"{self.title} — {self.equipment.code}"

    def delete(self, *args, **kwargs):
        raise ValidationError("حذف سخت دستورکار مجاز نیست؛ در صورت نیاز آن را لغو کنید.")

    def clean(self):
        if self.equipment_id:
            if self.organization_id != self.equipment.organization_id:
                raise ValidationError({"equipment": "تجهیز باید متعلق به همان سازمان باشد."})
            if self.plan_id and self.plan.equipment_id != self.equipment_id:
                raise ValidationError({"plan": "برنامه نگهداری باید متعلق به همین تجهیز باشد."})

    def save(self, *args, **kwargs):
        if self.equipment_id and not self.organization_id:
            self.organization_id = self.equipment.organization_id
        super().save(*args, **kwargs)


class CalibrationRecord(models.Model):
    class Result(models.TextChoices):
        PASSED = "passed", "قبول"
        FAILED = "failed", "ناموفق"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="calibration_records",
    )
    equipment = models.ForeignKey(
        Equipment, on_delete=models.PROTECT, related_name="calibrations"
    )
    performed_on = models.DateField()
    next_due_on = models.DateField(db_index=True)
    provider = models.CharField(max_length=200)
    certificate_number = models.CharField(max_length=100, blank=True)
    result = models.CharField(
        max_length=16, choices=Result.choices, default=Result.PASSED
    )
    notes = models.TextField(blank=True)
    document_reference = models.CharField(max_length=500, blank=True)
    performed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="calibrations_performed",
        null=True,
        blank=True,
    )
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-performed_on", "-id"]
        indexes = [
            models.Index(fields=["organization", "next_due_on"]),
            models.Index(fields=["equipment", "performed_on"]),
        ]

    def __str__(self):
        return f"{self.equipment.code} — {self.performed_on}"

    def delete(self, *args, **kwargs):
        raise ValidationError("حذف سخت رکورد کالیبراسیون مجاز نیست؛ رکورد اصلاحی جدید ثبت کنید.")

    def clean(self):
        if self.equipment_id and self.organization_id != self.equipment.organization_id:
            raise ValidationError({"equipment": "تجهیز باید متعلق به همان سازمان باشد."})
        if self.performed_on and self.next_due_on and self.next_due_on <= self.performed_on:
            raise ValidationError(
                {"next_due_on": "تاریخ سررسید کالیبراسیون باید بعد از تاریخ انجام باشد."}
            )
