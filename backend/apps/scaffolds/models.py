from datetime import date, timedelta
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Scaffold(models.Model):
    class ScaffoldType(models.TextChoices):
        TUBE_COUPLER = "tube_coupler", "لوله‌ای و بستی سنتی (Tube & Coupler)"
        MODULAR_SYSTEM = "modular_system", "سیستم پیش‌ساخته مدولار (کاپلاک / رینگی)"
        MOBILE_TOWER = "mobile_tower", "برجک متحرک چرخ‌دار (Mobile Tower)"
        SUSPENDED = "suspended", "داربست معلق / کلایمر (Suspended)"
        CANTILEVER = "cantilever", "طره‌ای و کنسولی (Cantilever)"

    class LoadDuty(models.TextChoices):
        LIGHT_DUTY = "light_duty", "سبک کار (Light Duty - 75 kg/m²)"
        MEDIUM_DUTY = "medium_duty", "متوسط کار (Medium Duty - 150 kg/m²)"
        HEAVY_DUTY = "heavy_duty", "سنگین کار (Heavy Duty - 225 kg/m²)"
        SPECIAL_DUTY = "special_duty", "فوق سنگین و بارگذاری خاص (Special Duty)"

    class TagStatus(models.TextChoices):
        GREEN_SAFE = "green_safe", "تگ سبز (ایمن و مجاز جهت استفاده)"
        YELLOW_RESTRICTED = "yellow_restricted", "تگ زرد (مشروط و دارای محدودیت دسترسی)"
        RED_UNSAFE = "red_unsafe", "تگ قرمز (خطرناک و اکیداً ممنوع)"
        DISMANTLED = "dismantled", "برچیده‌شده (Dismantled)"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="scaffolds",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.CASCADE,
        related_name="scaffolds",
    )
    tag_number = models.CharField(
        max_length=64,
        help_text="شماره یکتای برچسب و شناسنامه داربست، مثال: SCF-2026-001",
    )
    scaffold_type = models.CharField(
        max_length=32,
        choices=ScaffoldType.choices,
        default=ScaffoldType.MODULAR_SYSTEM,
    )
    load_duty = models.CharField(
        max_length=32,
        choices=LoadDuty.choices,
        default=LoadDuty.MEDIUM_DUTY,
    )
    location_details = models.CharField(
        max_length=255,
        help_text="موقعیت دقیق استقرار داربست در کارگاه",
    )
    height_meters = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=2.00,
        help_text="ارتفاع داربست به متر",
    )
    length_meters = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=4.00,
        help_text="طول داربست به متر",
    )
    width_meters = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=1.50,
        help_text="عرض داربست به متر",
    )
    contractor = models.ForeignKey(
        "workforce.ContractorCompany",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="erected_scaffolds",
        help_text="شرکت پیمانکار برپاکننده داربست",
    )
    erected_by = models.CharField(
        max_length=150,
        blank=True,
        help_text="نام سرپرست یا اکیپ داربست‌بند",
    )
    erection_date = models.DateField(
        help_text="تاریخ اتمام برپایی و تحویل اولیه",
    )
    intended_use = models.TextField(
        help_text="کاربری مورد نظر (جوشکاری، سندبلاست، تعمیرات و...)",
    )
    tag_status = models.CharField(
        max_length=24,
        choices=TagStatus.choices,
        default=TagStatus.RED_UNSAFE,
    )
    current_tag_valid_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="مهلت اعتبار برچسب جاری",
    )
    yellow_restrictions = models.TextField(
        blank=True,
        help_text="شرح محدودیت‌ها و شروط مجاز در صورت نصب تگ زرد (استفاده از لایف‌لاین و...)",
    )
    inspection_interval_days = models.IntegerField(
        default=7,
        help_text="دوره بازرسی ادواری الزامی (به روز، پیش‌فرض ۷ روز)",
    )
    last_inspection_date = models.DateField(null=True, blank=True)
    next_inspection_due = models.DateField(null=True, blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "tag_number"],
                name="unique_scaffold_tag_per_org",
            )
        ]

    def __str__(self):
        return f"{self.tag_number} ({self.get_tag_status_display()}) - {self.location_details}"

    @property
    def is_inspection_overdue(self) -> bool:
        if self.tag_status == self.TagStatus.DISMANTLED:
            return False
        if not self.next_inspection_due:
            return True
        return self.next_inspection_due < date.today()

    @property
    def is_usable_for_work(self) -> bool:
        if self.tag_status == self.TagStatus.GREEN_SAFE and not self.is_inspection_overdue:
            return True
        return False

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "کارگاه باید متعلق به همان سازمان باشد."})
        if self.contractor_id and self.contractor.organization_id != self.organization_id:
            raise ValidationError({"contractor": "پیمانکار باید متعلق به همان سازمان باشد."})


class ScaffoldInspection(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="scaffold_inspections",
    )
    scaffold = models.ForeignKey(
        Scaffold,
        on_delete=models.CASCADE,
        related_name="inspections",
    )
    inspection_date = models.DateField(default=timezone.now)
    inspector = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conducted_scaffold_inspections",
    )
    inspector_name = models.CharField(
        max_length=150,
        help_text="نام بازرس یا داربست‌بند ذی‌صلاح",
    )
    result_tag = models.CharField(
        max_length=24,
        choices=Scaffold.TagStatus.choices,
        help_text="برچسب نتیجه بازرسی",
    )
    validity_days = models.IntegerField(
        default=7,
        help_text="مدت اعتبار این بازرسی (روز)",
    )
    # Checkpoints
    base_plates_ok = models.BooleanField(
        default=True,
        help_text="کفی‌های جک فلزی و تخته زیرپایی (Sole/Base Plates)",
    )
    bracing_ok = models.BooleanField(
        default=True,
        help_text="بادبندهای طولی، عرضی و مهاربندهای ضربدری (Bracing)",
    )
    guardrails_ok = models.BooleanField(
        default=True,
        help_text="حفاظ‌های میانی و فوقانی با ارتفاع استاندارد (Guardrails)",
    )
    toeboards_ok = models.BooleanField(
        default=True,
        help_text="قرنیزهای محافظ پا با ارتفاع ۱۵ سانتی‌متر (Toeboards)",
    )
    planks_decking_ok = models.BooleanField(
        default=True,
        help_text="تخته‌بندی کامل سکو بدون فاصله و شکستگی (Decking)",
    )
    ties_anchors_ok = models.BooleanField(
        default=True,
        help_text="مهاربندی و انکر به اسکلت صلب سازه (Ties & Anchors)",
    )
    ladder_access_ok = models.BooleanField(
        default=True,
        help_text="نردبان و ورودی دسترسی ایمن با شیب مجاز (Ladder Access)",
    )
    findings = models.TextField(
        blank=True,
        help_text="یافته‌های بازرسی و نواقص احتمالی",
    )
    restrictions_notes = models.TextField(
        blank=True,
        help_text="تمهیدات ویژه در صورت صدور تگ زرد",
    )
    non_conformity = models.ForeignKey(
        "findings.NonConformity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scaffold_inspections",
        help_text="عدم انطباق ثبتی در صورت عدم تایید داربست",
    )
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-inspection_date", "-created_at"]

    def __str__(self):
        return f"بازرسی {self.scaffold.tag_number} ({self.get_result_tag_display()}) در {self.inspection_date}"

    def clean(self):
        if self.scaffold_id and self.scaffold.organization_id != self.organization_id:
            raise ValidationError({"scaffold": "داربست باید متعلق به همان سازمان باشد."})


class ScaffoldTagLog(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="scaffold_tag_logs",
    )
    scaffold = models.ForeignKey(
        Scaffold,
        on_delete=models.CASCADE,
        related_name="tag_history",
    )
    previous_tag = models.CharField(max_length=24, choices=Scaffold.TagStatus.choices)
    new_tag = models.CharField(max_length=24, choices=Scaffold.TagStatus.choices)
    changed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scaffold_tag_changes",
    )
    reason = models.TextField(help_text="دلیل تغییر تگ (بازرسی هفتگی، تغییر شرایط جوی، نقص فنی، برچیدن)")
    valid_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.scaffold.tag_number}: {self.previous_tag} -> {self.new_tag}"
