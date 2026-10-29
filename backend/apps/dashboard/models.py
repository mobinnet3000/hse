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
