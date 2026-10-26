from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models


class EnvironmentalThreshold(models.Model):
    class Category(models.TextChoices):
        WASTEWATER = "wastewater", "پساب و فاضلاب صنعتی"
        STACK_EMISSION = "stack_emission", "انتشار آلاینده‌های دودکش"
        NOISE = "noise", "صدا و آلودگی صوتی"
        HEAT_STRESS = "heat_stress", "استرس حرارتی (WBGT)"
        DUST = "dust", "گرد و غبار و ذرات معلق"
        TOXIC_GAS = "toxic_gas", "گازها و بخارات سمی"

    class LimitType(models.TextChoices):
        MAX_LIMIT = "max_limit", "حداکثر مجاز (Upper Limit)"
        MIN_LIMIT = "min_limit", "حداقل مجاز (Lower Limit)"
        RANGE = "range", "محدوده مجاز (Range)"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="environmental_thresholds",
    )
    name = models.CharField(max_length=200, help_text="عنوان استاندارد حد آستانه")
    category = models.CharField(max_length=32, choices=Category.choices)
    parameter = models.CharField(max_length=64, help_text="شناسه پارامتر نظیر COD, BOD, TSS, NOISE_DBA, WBGT")
    limit_type = models.CharField(max_length=20, choices=LimitType.choices, default=LimitType.MAX_LIMIT)
    limit_value = models.DecimalField(max_digits=10, decimal_places=2, help_text="مقدار حد مجاز یا سقف مجاز")
    min_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="حداقل مجاز در صورت بازه‌ای بودن")
    unit = models.CharField(max_length=32, help_text="واحد اندازه‌گیری، مثال: mg/L, dBA, °C, ppm, Lux")
    standard_reference = models.CharField(max_length=255, blank=True, help_text="مرجع استاندارد قانونی، مثال: استاندارد خروجی محیط زیست")
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "parameter", "category"],
                name="unique_threshold_per_param_category",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.limit_value} {self.unit})"

    def clean(self):
        if self.limit_type == self.LimitType.RANGE:
            if self.min_value is None:
                raise ValidationError({"min_value": "برای حدود بازه‌ای تعیین حداقل مقدار مجاز الزامی است."})
            if self.min_value >= self.limit_value:
                raise ValidationError({"min_value": "حداقل مقدار باید از سقف مجاز کمتر باشد."})

    def evaluate_value(self, value) -> tuple[bool, str]:
        """Evaluate if value exceeds threshold. Returns (is_exceedance, assessment_reason)."""
        val = Decimal(str(value))
        limit_val = Decimal(str(self.limit_value))
        min_val = Decimal(str(self.min_value)) if self.min_value is not None else None

        if self.limit_type == self.LimitType.MAX_LIMIT:
            if val > limit_val:
                return True, f"مقدار اندازه‌گیری‌شده ({val} {self.unit}) بیش از حد مجاز قانونی ({limit_val} {self.unit}) است."
            return False, f"مقدار اندازه‌گیری‌شده ({val} {self.unit}) در محدوده مجاز استاندارد ({limit_val} {self.unit}) قرار دارد."
        elif self.limit_type == self.LimitType.MIN_LIMIT:
            if val < limit_val:
                return True, f"مقدار اندازه‌گیری‌شده ({val} {self.unit}) کمتر از حداقل مجاز ({limit_val} {self.unit}) است."
            return False, f"مقدار اندازه‌گیری‌شده ({val} {self.unit}) مطلوب است."
        elif self.limit_type == self.LimitType.RANGE:
            if min_val is not None and (val < min_val or val > limit_val):
                return True, f"مقدار ({val} {self.unit}) خارج از دامنه مجاز ({min_val} تا {limit_val} {self.unit}) قرار دارد."
            return False, f"مقدار ({val} {self.unit}) در دامنه مجاز استاندارد است."
        return False, "تایید"


class EnvironmentalAspect(models.Model):
    class Condition(models.TextChoices):
        NORMAL = "normal", "شرایط عادی (Normal)"
        ABNORMAL = "abnormal", "شرایط غیرعادی (Abnormal)"
        EMERGENCY = "emergency", "شرایط اضطراری (Emergency)"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="environmental_aspects",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.CASCADE,
        related_name="environmental_aspects",
    )
    activity_or_process = models.CharField(max_length=200, help_text="فعالیت، فرآیند یا تجهیز مرتبط")
    aspect = models.CharField(max_length=255, help_text="جنبه زیست‌محیطی (ورودی یا خروجی اثرگذار بر محیط)")
    impact = models.CharField(max_length=255, help_text="پیامد زیست‌محیطی (تغییر ایجادشده در محیط)")
    condition = models.CharField(max_length=20, choices=Condition.choices, default=Condition.NORMAL)
    severity_score = models.IntegerField(default=1, help_text="شدت پیامد از ۱ تا ۵")
    probability_score = models.IntegerField(default=1, help_text="احتمال وقوع از ۱ تا ۵")
    significance_score = models.IntegerField(default=1, help_text="نمره بارزی = شدت × احتمال")
    is_significant = models.BooleanField(default=False, help_text="جنبه بارز زیست‌محیطی (نیازمند برنامه کنترلی)")
    control_measures = models.TextField(blank=True, help_text="اقدامات و تمهیدات کنترلی جاری")
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-significance_score", "-created_at"]

    def __str__(self):
        return f"{self.aspect} -> {self.impact} (بارزی: {self.significance_score})"

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "کارگاه باید متعلق به همان سازمان باشد."})
        if not (1 <= self.severity_score <= 5):
            raise ValidationError({"severity_score": "شدت باید بین ۱ تا ۵ باشد."})
        if not (1 <= self.probability_score <= 5):
            raise ValidationError({"probability_score": "احتمال باید بین ۱ تا ۵ باشد."})

    def save(self, *args, **kwargs):
        self.significance_score = self.severity_score * self.probability_score
        self.is_significant = self.significance_score >= 12 or self.severity_score == 5
        super().save(*args, **kwargs)


class WasteRecord(models.Model):
    class WasteType(models.TextChoices):
        HAZARDOUS = "hazardous", "پسماند خطرناک و ویژه"
        NON_HAZARDOUS = "non_hazardous", "پسماند عادی و غیرخطرناک"
        RECYCLABLE = "recyclable", "پسماند صنعتی قابل بازیافت"

    class Unit(models.TextChoices):
        KG = "kg", "کیلوگرم"
        TON = "ton", "تن"
        LITER = "liter", "لیتر"
        DRUM = "drum", "بشکه ۲۲۰ لیتری"

    class Status(models.TextChoices):
        STORED = "stored", "انبارش موقت در سایت"
        TRANSFERRED = "transferred", "بارگیری و حمل به مقصد"
        DISPOSED = "disposed", "امحاء / بازیافت نهایی"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="waste_records",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.CASCADE,
        related_name="waste_records",
    )
    waste_name = models.CharField(max_length=200, help_text="نام پسماند یا جریان ضایعات")
    waste_type = models.CharField(max_length=20, choices=WasteType.choices, default=WasteType.NON_HAZARDOUS)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=16, choices=Unit.choices, default=Unit.KG)
    storage_location = models.CharField(max_length=200, help_text="محل نگهداری و دپو موقت در کارگاه")
    generation_date = models.DateField(help_text="تاریخ تولید یا ثبت پسماند")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.STORED)
    consignment_number = models.CharField(max_length=100, blank=True, help_text="شماره بارنامه یا مانیفست حمل پسماند")
    contractor = models.ForeignKey(
        "workforce.ContractorCompany",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="waste_shipments",
        help_text="پیمانکار حمل و بازیافت مجاز",
    )
    disposal_facility = models.CharField(max_length=200, blank=True, help_text="نام مرکز یا لندفیل مجاز امحاء")
    disposal_method = models.CharField(max_length=200, blank=True, help_text="روش دفع: زباله‌سوز، بازیافت، لندفیل و...")
    disposal_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-generation_date", "-created_at"]

    def __str__(self):
        return f"{self.waste_name} ({self.quantity} {self.get_unit_display()})"

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "کارگاه باید متعلق به همان سازمان باشد."})
        if self.contractor_id and self.contractor.organization_id != self.organization_id:
            raise ValidationError({"contractor": "پیمانکار باید متعلق به همان سازمان باشد."})
        if self.quantity <= 0:
            raise ValidationError({"quantity": "مقدار پسماند باید عددی مثبت باشد."})


class WastewaterEmissionRecord(models.Model):
    class Category(models.TextChoices):
        WASTEWATER = "wastewater", "پساب خروجی تصفیه‌خانه"
        STACK_EMISSION = "stack_emission", "آلاینده خروجی دودکش (Stack)"
        AMBIENT_AIR = "ambient_air", "هوای پاک پیرامونی (Ambient)"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="wastewater_emission_records",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.CASCADE,
        related_name="wastewater_emission_records",
    )
    sampling_point = models.CharField(max_length=200, help_text="نقطه نمونه‌برداری دقیق")
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.WASTEWATER)
    sample_date = models.DateField(help_text="تاریخ نمونه‌برداری")
    parameter = models.CharField(max_length=64, help_text="پارامتر مورد سنجش، مثال: COD, BOD5, TSS, SO2, NOx, CO")
    measured_value = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=32, help_text="واحد اندازه‌گیری، مثال: mg/L, ppm, mg/Nm3")
    threshold = models.ForeignKey(
        EnvironmentalThreshold,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wastewater_records",
    )
    standard_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_exceedance = models.BooleanField(default=False, help_text="تخطی از حد استاندارد مجاز")
    laboratory_name = models.CharField(max_length=200, blank=True, help_text="نام آزمایشگاه معتمد همکار")
    test_report_number = models.CharField(max_length=100, blank=True, help_text="شماره برگه گزارش آزمایشگاهی")
    non_conformity = models.ForeignKey(
        "findings.NonConformity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="environmental_records",
        help_text="عدم انطباق ثبتی در صورت تخطی از حد مجاز",
    )
    notes = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-sample_date", "-created_at"]

    def __str__(self):
        return f"{self.sampling_point} - {self.parameter}: {self.measured_value} {self.unit}"

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "کارگاه باید متعلق به همان سازمان باشد."})
        if self.threshold_id and self.threshold.organization_id != self.organization_id:
            raise ValidationError({"threshold": "حد آستانه باید متعلق به همان سازمان باشد."})


class OccupationalHygieneRecord(models.Model):
    class Category(models.TextChoices):
        NOISE = "noise", "صدا و آلودگی صوتی ممتد"
        HEAT_STRESS = "heat_stress", "استرس حرارتی و گرمازدگی (WBGT)"
        LIGHTING = "lighting", "شدت روشنایی موضعی و عمومی (Lux)"
        DUST_PARTICULATE = "dust_particulate", "گرد و غبار قابل استنشاق (PM10/PM2.5)"
        CHEMICAL_VAPOR = "chemical_vapor", "گازها، بخارات اسیدی و حلال‌ها"

    class AssessmentResult(models.TextChoices):
        ACCEPTABLE = "acceptable", "مجاز و ایمن (کمتر از حد آستانه)"
        WARNING = "warning", "در آستانه هشدار (۸۰٪ تا ۱۰۰٪ حد مجاز)"
        UNACCEPTABLE = "unacceptable", "غیرمجاز و بحرانی (فراتر از حد مجاز TLV)"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="hygiene_records",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.CASCADE,
        related_name="hygiene_records",
    )
    category = models.CharField(max_length=32, choices=Category.choices)
    location_details = models.CharField(max_length=200, help_text="ایستگاه کاری یا محل استقرار اپراتور")
    survey_date = models.DateField(help_text="تاریخ سنجش و ارزیابی عوامل زیان‌آور")
    surveyor_name = models.CharField(max_length=150, help_text="نام کارشناس یا شرکت ارزیاب بهداشت حرفه‌ای")
    measured_value = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=32, help_text="واحد سنجش، مثال: dBA, °C, Lux, mg/m3, ppm")
    threshold = models.ForeignKey(
        EnvironmentalThreshold,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hygiene_records",
    )
    standard_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="حد مجاز تماس شغلی (OEL / TLV)")
    is_exceedance = models.BooleanField(default=False)
    assessment_result = models.CharField(max_length=20, choices=AssessmentResult.choices, default=AssessmentResult.ACCEPTABLE)
    control_recommendation = models.TextField(blank=True, help_text="توصیه‌های کنترلی فنی، مدیریتی یا تجهیزات حفاظت فردی")
    non_conformity = models.ForeignKey(
        "findings.NonConformity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hygiene_records",
        help_text="عدم انطباق ثبتی در صورت مخاطره‌آمیز بودن",
    )
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-survey_date", "-created_at"]

    def __str__(self):
        return f"{self.get_category_display()} ({self.location_details}): {self.measured_value} {self.unit}"

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "کارگاه باید متعلق به همان سازمان باشد."})
        if self.threshold_id and self.threshold.organization_id != self.organization_id:
            raise ValidationError({"threshold": "حد آستانه باید متعلق به همان سازمان باشد."})
