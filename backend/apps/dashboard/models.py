from django.db import models


class HSEIndicatorConfig(models.Model):
    class IndicatorType(models.TextChoices):
        LEADING = "leading", "شاخص پیشرو / پیشگیرانه (Leading Indicator)"
        LAGGING = "lagging", "شاخص پسرو / پیامدی (Lagging Indicator)"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="indicator_configs",
    )
    indicator_code = models.CharField(max_length=60, db_index=True)
    name = models.CharField(max_length=200)
    indicator_type = models.CharField(
        max_length=20, choices=IndicatorType.choices, default=IndicatorType.LEADING
    )
    target_value = models.FloatField(default=100.0)
    warning_threshold = models.FloatField(default=80.0)
    unit = models.CharField(max_length=30, default="%")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["indicator_type", "indicator_code"]
        unique_together = [("organization", "indicator_code")]

    def __str__(self):
        return f"{self.name} ({self.get_indicator_type_display()}) - Target: {self.target_value}{self.unit}"


from apps.core.mixins import EnterpriseContextMixin
from apps.core.traceability import TraceabilityChain, TraceabilityNode

class HSEStrategicGoal(EnterpriseContextMixin, models.Model):
    """
    ماژول مدیریت راهبردی HSE (Strategic HSE Management)
    اهداف کلان سالانه، محورهای راهبردی، شاخص هدف و کنترل تحقق برنامه‌های بالادستی
    """
    class Priority(models.TextChoices):
        CRITICAL = "critical", "بحرانی / اولویت اول"
        HIGH = "high", "بالا"
        MEDIUM = "medium", "متوسط"

    class Pillar(models.TextChoices):
        ZERO_HARM = "zero_harm", "صفر حوادث انسانی (Zero Harm)"
        SUSTAINABILITY = "sustainability", "پایداری محیط زیست و کربن خنثی"
        CULTURE = "culture", "نهادینه‌سازی فرهنگ ایمنی فراگیر"
        COMPLIANCE = "compliance", "انطباق ۱۰۰٪ با مقررات قانونی و ممیزی"

    class GoalStatus(models.TextChoices):
        ON_TRACK = "on_track", "طبق برنامه (On Track)"
        AT_RISK = "at_risk", "در معرض انحراف (At Risk)"
        DELAYED = "delayed", "عقب‌افتاده از هدف (Delayed)"
        ACHIEVED = "achieved", "محقق‌شده کامل (Achieved)"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="strategic_goals",
        verbose_name="سازمان",
    )
    fiscal_year = models.CharField(max_length=16, default="1403-1404", verbose_name="سال مالی / دوره")
    title = models.CharField(max_length=255, verbose_name="عنوان هدف راهبردی")
    pillar = models.CharField(
        max_length=32,
        choices=Pillar.choices,
        default=Pillar.ZERO_HARM,
        verbose_name="محور راهبردی",
    )
    target_metric = models.CharField(max_length=120, verbose_name="شاخص کمی سنجش")
    baseline_value = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="مقدار مبنا")
    target_value = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="مقدار هدف")
    current_value = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="مقدار جاری محقق‌شده")
    unit = models.CharField(max_length=32, default="درصد", verbose_name="واحد سنجش")
    deadline = models.DateField(verbose_name="مهلت تحقق")
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.HIGH,
        verbose_name="اولویت سازمانی",
    )
    status = models.CharField(
        max_length=20,
        choices=GoalStatus.choices,
        default=GoalStatus.ON_TRACK,
        verbose_name="وضعیت تحقق",
    )
    action_plan_summary = models.TextField(blank=True, verbose_name="برنامه اقدام اجرایی برای دستیابی به هدف")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["priority", "deadline"]
        verbose_name = "هدف راهبردی HSE"
        verbose_name_plural = "اهداف راهبردی HSE"

    def __str__(self):
        return f"[{self.get_pillar_display()}] {self.title} ({self.current_value}/{self.target_value} {self.unit})"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if not self.traceability_chain_id:
            tracking_code = f"TRC-STR-{self.pk:04d}"
            chain, _ = TraceabilityChain.objects.get_or_create(
                organization=self.organization,
                tracking_code=tracking_code,
                defaults={
                    "title": f"هدف راهبردی: {self.title}",
                    "origin_module": "strategic_hse",
                    "origin_object_id": str(self.pk),
                },
            )
            self.traceability_chain_id = tracking_code
            TraceabilityNode.objects.create(
                chain=chain,
                from_module="organizations",
                from_id=str(self.organization_id),
                to_module="strategic_hse",
                to_id=str(self.pk),
                relation_type="direct",
                description=f"تعریف هدف راهبردی {self.title} در محور {self.get_pillar_display()}",
            )
            super().save(update_fields=["traceability_chain_id"])


class HSEBudgetProgram(EnterpriseContextMixin, models.Model):
    """
    تخصیص و پایش بودجه اقدامات و پروژه‌های HSE
    """
    class Category(models.TextChoices):
        PPE_EQUIPMENT = "ppe_equipment", "خرید تجهیزات ایمنی و فردی (PPE)"
        TRAINING = "training", "آموزش، فرهنگ‌سازی و سنجش صلاحیت"
        ENGINEERING = "engineering", "اصلاحات فنی، ایمن‌سازی و مدیریت تغییر (MOC)"
        HEALTH = "occupational_health", "طب کار و پایش سلامت شغلی"
        ENVIRONMENT = "environment", "مدیریت پسماند، پساب و محیط زیست"
        EMERGENCY = "emergency", "تجهیزات آتش‌نشانی و مانور بحران"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="budget_programs",
        verbose_name="سازمان",
    )
    fiscal_year = models.CharField(max_length=16, default="1403-1404", verbose_name="سال مالی")
    program_name = models.CharField(max_length=200, verbose_name="عنوان برنامه / ردیف بودجه")
    category = models.CharField(max_length=32, choices=Category.choices, verbose_name="سرفصل بودجه")
    allocated_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0, verbose_name="مبلغ مصوب (میلیون ریال)")
    spent_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0, verbose_name="مبلغ هزینه شده (میلیون ریال)")
    notes = models.TextField(blank=True, verbose_name="توضیحات و مصوبات")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "-allocated_amount"]
        verbose_name = "برنامه بودجه HSE"
        verbose_name_plural = "برنامه‌های بودجه HSE"

    def __str__(self):
        return f"{self.program_name}: {self.spent_amount}/{self.allocated_amount} میلیون ریال"

    @property
    def utilization_percentage(self):
        if self.allocated_amount > 0:
            return round((self.spent_amount / self.allocated_amount) * 100, 1)
        return 0.0
