import calendar
from datetime import date, timedelta

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


COMPETENCY_DUE_SOON_DAYS = 30
PPE_REPLACEMENT_DUE_SOON_DAYS = 30


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


class Employee(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="employees",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="employees",
        null=True,
        blank=True,
    )
    employee_no = models.CharField(max_length=64)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    job_title = models.CharField(max_length=120, blank=True)
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="employees",
        null=True,
        blank=True,
        help_text="حساب ورود اختیاری؛ کارکنان بدون حساب نیز قابل ثبت هستند.",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name", "employee_no"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "employee_no"],
                name="unique_employee_no_per_org",
            ),
            models.UniqueConstraint(
                fields=["organization", "user"],
                condition=Q(user__isnull=False),
                name="unique_employee_user_per_org",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["organization", "workplace"]),
        ]

    def __str__(self):
        return f"{self.employee_no} — {self.full_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت کارمند مجاز نیست؛ برای خروج از چرخه، کارمند را غیرفعال کنید."
        )

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "محل کار باید متعلق به همان سازمان باشد."})


class TrainingCourse(models.Model):
    class DeliveryType(models.TextChoices):
        IN_PERSON = "in_person", "حضوری"
        PRACTICAL = "practical", "عملی"
        ONLINE = "online", "آنلاین"
        BLENDED = "blended", "ترکیبی"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="training_courses",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=200)
    category = models.CharField(
        max_length=120,
        help_text="دسته آموزشی قابل تنظیم در سازمان؛ مثال: ایمنی عمومی، آتش‌نشانی",
    )
    description = models.TextField(blank=True)
    objectives = models.TextField(blank=True)
    duration_minutes = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(100000)]
    )
    delivery_type = models.CharField(
        max_length=16, choices=DeliveryType.choices, default=DeliveryType.IN_PERSON
    )
    is_mandatory = models.BooleanField(default=False)
    requires_renewal = models.BooleanField(default=False)
    validity_months = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(600)],
    )
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="training_courses_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_training_course_code_per_org",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["organization", "category"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.title}"

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت دوره آموزشی مجاز نیست؛ سابقه آموزش باید حفظ شود. دوره را غیرفعال کنید."
        )

    def clean(self):
        if self.requires_renewal and not self.validity_months:
            raise ValidationError(
                {"validity_months": "برای دوره نیازمند تمدید، مدت اعتبار الزامی است."}
            )


class TrainingSession(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "برنامه‌ریزی‌شده"
        IN_PROGRESS = "in_progress", "در حال برگزاری"
        COMPLETED = "completed", "برگزارشده"
        CANCELLED = "cancelled", "لغوشده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="training_sessions",
    )
    course = models.ForeignKey(
        TrainingCourse, on_delete=models.PROTECT, related_name="sessions"
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="training_sessions",
        null=True,
        blank=True,
    )
    instructor_name = models.CharField(max_length=150, blank=True)
    scheduled_on = models.DateField()
    duration_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(100000)],
    )
    capacity = models.PositiveIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1)]
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.SCHEDULED, db_index=True
    )
    notes = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="training_sessions_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_on", "-id"]
        indexes = [
            models.Index(fields=["organization", "status", "scheduled_on"]),
            models.Index(fields=["organization", "course"]),
        ]

    def __str__(self):
        return f"{self.course.title} — {self.scheduled_on}"

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت نوبت آموزشی مجاز نیست؛ نوبت را لغو کنید تا سابقه حفظ شود."
        )

    def clean(self):
        if self.course_id and self.course.organization_id != self.organization_id:
            raise ValidationError({"course": "دوره باید متعلق به همان سازمان باشد."})
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "محل برگزاری باید متعلق به همان سازمان باشد."})

    @property
    def is_completed(self):
        return self.status == self.Status.COMPLETED

    @property
    def attendance_count(self):
        return self.attendances.count()


class TrainingAttendance(models.Model):
    class AttendanceStatus(models.TextChoices):
        REGISTERED = "registered", "ثبت‌نام‌شده"
        ATTENDED = "attended", "حاضر"
        ABSENT = "absent", "غایب"
        CANCELLED = "cancelled", "لغوشده"

    class AssessmentResult(models.TextChoices):
        PENDING = "pending", "در انتظار نتیجه"
        PASSED = "passed", "قبول"
        FAILED = "failed", "مردود"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="training_attendances",
    )
    session = models.ForeignKey(
        TrainingSession, on_delete=models.PROTECT, related_name="attendances"
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name="training_attendances"
    )
    attendance_status = models.CharField(
        max_length=16,
        choices=AttendanceStatus.choices,
        default=AttendanceStatus.REGISTERED,
    )
    assessment_result = models.CharField(
        max_length=16,
        choices=AssessmentResult.choices,
        default=AssessmentResult.PENDING,
    )
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    completed_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="training_attendances_recorded",
        null=True,
        blank=True,
    )
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__last_name", "employee__first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "employee"],
                name="unique_training_attendance_per_session_employee",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "employee"]),
            models.Index(fields=["organization", "assessment_result"]),
        ]

    def __str__(self):
        return f"{self.session} — {self.employee}"

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت سابقه حضور آموزشی مجاز نیست؛ نتیجه را اصلاح یا ثبت جلسه جدید کنید."
        )

    def clean(self):
        if self.session_id and self.session.organization_id != self.organization_id:
            raise ValidationError({"session": "نوبت آموزشی باید متعلق به همان سازمان باشد."})
        if self.employee_id and self.employee.organization_id != self.organization_id:
            raise ValidationError({"employee": "کارمند باید متعلق به همان سازمان باشد."})
        if self.session_id and self.employee_id:
            if self.employee.organization_id != self.session.organization_id:
                raise ValidationError("کارمند و نوبت آموزشی باید متعلق به یک سازمان باشند.")
        if self.assessment_result in {
            self.AssessmentResult.PASSED,
            self.AssessmentResult.FAILED,
        }:
            if self.attendance_status != self.AttendanceStatus.ATTENDED:
                raise ValidationError(
                    "ثبت نتیجه قبولی یا مردودی تنها برای فرد حاضر در دوره مجاز است."
                )
            if not self.completed_on:
                raise ValidationError(
                    {"completed_on": "برای ثبت نتیجه، تاریخ تکمیل الزامی است."}
                )
            if self.completed_on > timezone.localdate():
                raise ValidationError({"completed_on": "تاریخ تکمیل نمی‌تواند در آینده باشد."})
            if self.session_id and self.completed_on < self.session.scheduled_on:
                raise ValidationError(
                    {"completed_on": "تاریخ تکمیل نمی‌تواند قبل از تاریخ برگزاری باشد."}
                )
            if self.session_id and self.session.status != TrainingSession.Status.COMPLETED:
                raise ValidationError(
                    "ثبت نتیجه قبولی/مردودی تنها پس از برگزاری و تکمیل نوبت آموزشی مجاز است."
                )
        else:
            if self.completed_on:
                raise ValidationError(
                    {"completed_on": "تا زمان ثبت نتیجه، تاریخ تکمیل نباید ثبت شود."}
                )

    @property
    def is_passed(self):
        return self.assessment_result == self.AssessmentResult.PASSED


class Competency(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="competencies",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    allowed_activities = models.TextField(
        blank=True, help_text="فعالیت‌های مجاز یا انواع کاری که این صلاحیت پوشش می‌دهد."
    )
    is_mandatory = models.BooleanField(default=False)
    validity_months = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(600)],
        help_text="خالی بودن به معنای صلاحیت بدون انقضای تعریف‌شده است.",
    )
    accepted_courses = models.ManyToManyField(
        TrainingCourse,
        blank=True,
        related_name="competencies",
        help_text="دوره‌های آموزشی قابل قبول برای کسب یا تمدید این صلاحیت.",
    )
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="competencies_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_competency_code_per_org",
            )
        ]
        indexes = [models.Index(fields=["organization", "is_active"])]

    def __str__(self):
        return f"{self.code} — {self.name}"

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت صلاحیت مجاز نیست؛ صلاحیت را غیرفعال کنید تا سوابق حفظ شوند."
        )


class EmployeeCompetency(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "فعال"
        SUSPENDED = "suspended", "تعلیق‌شده"
        REVOKED = "revoked", "لغوشده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="employee_competencies",
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name="competency_records"
    )
    competency = models.ForeignKey(
        Competency, on_delete=models.PROTECT, related_name="employee_records"
    )
    achieved_on = models.DateField()
    expires_on = models.DateField(null=True, blank=True)
    source_course = models.ForeignKey(
        TrainingCourse,
        on_delete=models.SET_NULL,
        related_name="employee_competencies",
        null=True,
        blank=True,
    )
    source_session = models.ForeignKey(
        TrainingSession,
        on_delete=models.SET_NULL,
        related_name="employee_competencies",
        null=True,
        blank=True,
    )
    certificate_number = models.CharField(max_length=120, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="employee_competencies_recorded",
        null=True,
        blank=True,
    )
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-achieved_on", "-id"]
        indexes = [
            models.Index(fields=["organization", "employee", "competency"]),
            models.Index(fields=["organization", "expires_on"]),
        ]

    def __str__(self):
        return f"{self.employee} — {self.competency}"

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت سابقه صلاحیت مجاز نیست؛ وضعیت را تعلیق یا لغو کنید و سابقه را حفظ نمایید."
        )

    def save(self, *args, **kwargs):
        if self.expires_on is None and self.competency_id and self.achieved_on:
            validity_months = self.competency.validity_months
            if validity_months:
                self.expires_on = add_months(self.achieved_on, validity_months)
        super().save(*args, **kwargs)

    def clean(self):
        if self.employee_id and self.employee.organization_id != self.organization_id:
            raise ValidationError({"employee": "کارمند باید متعلق به همان سازمان باشد."})
        if self.competency_id and self.competency.organization_id != self.organization_id:
            raise ValidationError({"competency": "صلاحیت باید متعلق به همان سازمان باشد."})
        if self.source_course_id and self.source_course.organization_id != self.organization_id:
            raise ValidationError({"source_course": "دوره منبع باید متعلق به همان سازمان باشد."})
        if self.source_session_id and self.source_session.organization_id != self.organization_id:
            raise ValidationError({"source_session": "نوبت آموزشی منبع باید متعلق به همان سازمان باشد."})
        if self.achieved_on and self.achieved_on > timezone.localdate():
            raise ValidationError({"achieved_on": "تاریخ احراز نمی‌تواند در آینده باشد."})
        if self.expires_on and self.expires_on <= self.achieved_on:
            raise ValidationError({"expires_on": "تاریخ انقضا باید بعد از تاریخ احراز باشد."})

    @property
    def effective_status(self):
        if self.status == self.Status.REVOKED:
            return "revoked"
        if self.status == self.Status.SUSPENDED:
            return "suspended"
        today = timezone.localdate()
        if self.expires_on and self.expires_on < today:
            return "expired"
        if (
            self.expires_on
            and self.expires_on <= today + timedelta(days=COMPETENCY_DUE_SOON_DAYS)
        ):
            return "expiring_soon"
        return "valid"

    @property
    def is_valid(self):
        return self.effective_status in {"valid", "expiring_soon"}

    @property
    def days_until_expiry(self):
        if not self.expires_on:
            return None
        return (self.expires_on - timezone.localdate()).days


class PPEItem(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="ppe_items",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=200)
    category = models.CharField(
        max_length=120,
        help_text="دسته حفاظت قابل تنظیم؛ مثال: حفاظت سر، چشم و صورت، تنفس",
    )
    description = models.TextField(blank=True)
    usage_requirements = models.TextField(blank=True)
    sizes = models.CharField(max_length=250, blank=True)
    replacement_interval_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(3650)],
        help_text="بازه تعویض پیشنهادی؛ تضمین قطعی ایمنی نیست.",
    )
    inspection_required = models.BooleanField(default=False)
    is_durable = models.BooleanField(
        default=True,
        help_text="تجهیز بادوام در برابر مصرفی؛ برای اقلام سریال‌دار نیز استفاده می‌شود.",
    )
    tracks_serial = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="ppe_items_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_ppe_item_code_per_org",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["organization", "category"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت کاتالوگ PPE مجاز نیست؛ قلم را غیرفعال کنید تا سوابق حفظ شوند."
        )


class PPEStock(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="ppe_stocks",
    )
    item = models.ForeignKey(PPEItem, on_delete=models.PROTECT, related_name="stocks")
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="ppe_stocks",
        null=True,
        blank=True,
    )
    location_name = models.CharField(max_length=150, default="انبار مرکزی")
    quantity_on_hand = models.PositiveIntegerField(default=0)
    quantity_minimum = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["item__name", "location_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "item", "workplace", "location_name"],
                name="unique_ppe_stock_location",
            ),
            models.CheckConstraint(
                check=Q(quantity_on_hand__gte=0),
                name="ppe_stock_on_hand_non_negative",
            ),
            models.CheckConstraint(
                check=Q(quantity_minimum__gte=0),
                name="ppe_stock_minimum_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["organization", "item"]),
        ]

    def __str__(self):
        return f"{self.item.code} @ {self.location_name}"

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت موجودی PPE مجاز نیست؛ موجودی را صفر و انبار را غیرفعال کنید."
        )

    def clean(self):
        if self.item_id and self.item.organization_id != self.organization_id:
            raise ValidationError({"item": "قلم PPE باید متعلق به همان سازمان باشد."})
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "محل نگهداری باید متعلق به همان سازمان باشد."})
        if self.quantity_on_hand < 0:
            raise ValidationError({"quantity_on_hand": "موجودی نمی‌تواند منفی باشد."})

    @property
    def is_below_minimum(self):
        return self.quantity_on_hand < self.quantity_minimum


class PPEAssignment(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "در استفاده"
        RETURNED = "returned", "برگشت‌داده‌شده"
        REPLACED = "replaced", "تعویض‌شده"
        DISPOSED = "disposed", "خارج‌شده از سرویس"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="ppe_assignments",
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name="ppe_assignments"
    )
    item = models.ForeignKey(
        PPEItem, on_delete=models.PROTECT, related_name="assignments"
    )
    stock = models.ForeignKey(
        PPEStock, on_delete=models.PROTECT, related_name="assignments"
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    serial_number = models.CharField(max_length=120, blank=True)
    issued_on = models.DateField()
    condition_on_issue = models.CharField(max_length=120, default="سالم")
    replacement_due_on = models.DateField(null=True, blank=True)
    returned_on = models.DateField(null=True, blank=True)
    return_condition = models.TextField(blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )
    issued_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="ppe_assignments_issued",
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-issued_on", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "item", "serial_number"],
                condition=Q(status="active") & ~Q(serial_number=""),
                name="unique_active_ppe_serial_per_item",
            ),
            models.CheckConstraint(
                check=Q(quantity__gt=0),
                name="ppe_assignment_quantity_positive",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "employee"]),
            models.Index(fields=["organization", "replacement_due_on"]),
        ]

    def __str__(self):
        return f"{self.item.code} → {self.employee.full_name}"

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "حذف سخت تحویل PPE مجاز نیست؛ برگشت، تعویض یا خارج‌سازی را به‌صورت رویداد ثبت کنید."
        )

    def save(self, *args, **kwargs):
        if (
            self.replacement_due_on is None
            and self.item_id
            and self.issued_on
            and self.item.replacement_interval_days
        ):
            self.replacement_due_on = self.issued_on + timedelta(
                days=self.item.replacement_interval_days
            )
        super().save(*args, **kwargs)

    def clean(self):
        if self.employee_id and self.employee.organization_id != self.organization_id:
            raise ValidationError({"employee": "کارمند باید متعلق به همان سازمان باشد."})
        if self.item_id and self.item.organization_id != self.organization_id:
            raise ValidationError({"item": "قلم PPE باید متعلق به همان سازمان باشد."})
        if self.stock_id:
            if self.stock.organization_id != self.organization_id:
                raise ValidationError({"stock": "انبار باید متعلق به همان سازمان باشد."})
            if self.item_id and self.stock.item_id != self.item_id:
                raise ValidationError({"stock": "قلم PPE با انبار انتخاب‌شده هم‌خوان نیست."})
        if self.issued_on and self.issued_on > timezone.localdate():
            raise ValidationError({"issued_on": "تاریخ تحویل نمی‌تواند در آینده باشد."})
        if self.replacement_due_on and self.issued_on:
            if self.replacement_due_on < self.issued_on:
                raise ValidationError(
                    {"replacement_due_on": "موعد تعویض نمی‌تواند قبل از تاریخ تحویل باشد."}
                )
        if self.status in {
            self.Status.RETURNED,
            self.Status.REPLACED,
            self.Status.DISPOSED,
        } and not self.returned_on:
            raise ValidationError(
                {"returned_on": "برای تحویل بسته‌شده، تاریخ برگشت/تعویض/خروج الزامی است."}
            )

    @property
    def usage_status(self):
        if self.status != self.Status.ACTIVE:
            return self.status
        if not self.replacement_due_on:
            return "in_use"
        today = timezone.localdate()
        if self.replacement_due_on < today:
            return "overdue"
        if self.replacement_due_on <= today + timedelta(days=PPE_REPLACEMENT_DUE_SOON_DAYS):
            return "due_soon"
        return "in_use"

    @property
    def is_replacement_overdue(self):
        return self.usage_status == "overdue"


class PPEAssignmentEvent(models.Model):
    class EventType(models.TextChoices):
        ISSUED = "issued", "تحویل"
        RETURNED = "returned", "برگشت"
        REPLACED = "replaced", "تعویض"
        DISPOSED = "disposed", "خروج از سرویس"
        RENEWED = "renewed", "تمدید/تحویل مجدد"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="ppe_assignment_events",
    )
    assignment = models.ForeignKey(
        PPEAssignment, on_delete=models.PROTECT, related_name="events"
    )
    event_type = models.CharField(max_length=16, choices=EventType.choices)
    occurred_on = models.DateField()
    quantity = models.PositiveIntegerField(default=1)
    condition = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="ppe_events_recorded",
        null=True,
        blank=True,
    )
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_on", "-id"]
        indexes = [
            models.Index(fields=["organization", "event_type"]),
            models.Index(fields=["assignment", "occurred_on"]),
        ]

    def __str__(self):
        return f"{self.get_event_type_display()} — {self.assignment}"

    def delete(self, *args, **kwargs):
        raise ValidationError("حذف رویداد PPE مجاز نیست؛ تاریخچه باید حفظ شود.")
