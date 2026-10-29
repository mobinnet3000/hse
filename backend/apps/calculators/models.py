from django.db import models


class CalculationRecord(models.Model):
    class CalculatorType(models.TextChoices):
        UNIT_CONVERTER = "unit_converter", "تبدیل واحدهای مهندسی"
        HSE_RATES = "hse_rates", "نرخ‌های حوادث و عملکرد HSE (LTIFR/TRIR/SR)"
        NOISE = "noise", "صدا و دوز مواجهه شغلی"
        RIGGING_CRANE = "rigging_crane", "محاسبات باربرداری، اسلینگ و جرثقیل"
        ENERGY_FLEET = "energy_fleet", "مصرف انرژی و سوخت ناوگان"
        EXCAVATION = "excavation", "هندسه و شیب گودبرداری ایمن"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="calculation_records",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calculation_records",
    )
    calculator_type = models.CharField(max_length=40, choices=CalculatorType.choices)
    title = models.CharField(max_length=200, blank=True)
    input_params = models.JSONField(default=dict)
    results = models.JSONField(default=dict)
    notes = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "calculator_type"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.get_calculator_type_display()} - {self.title or self.id}"
