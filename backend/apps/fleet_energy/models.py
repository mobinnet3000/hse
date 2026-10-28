from django.core.exceptions import ValidationError
from django.db import models


class FleetVehicle(models.Model):
    class VehicleType(models.TextChoices):
        PICKUP = "pickup", "وانت / وانت دوکابین"
        TRUCK = "truck", "کامیون / خاور / تریلی"
        FORKLIFT = "forklift", "لیفتراک صنعتی"
        BUS = "bus", "مینی‌بوس / اتوبوس سرویس پرسنل"
        CRANE_CARRIER = "crane_carrier", "کامیون جرثقیل / کرین"
        EXCAVATOR = "excavator", "بیل مکانیکی / لودر"
        AMBULANCE = "ambulance", "آمبولانس اورژانس سایت"
        FIRE_TRUCK = "fire_truck", "خودروی آتش‌نشانی"

    class FuelType(models.TextChoices):
        GASOLINE = "gasoline", "بنزین"
        DIESEL = "diesel", "گازوئیل"
        CNG = "cng", "گاز طبیعی فشرده (CNG)"
        ELECTRIC = "electric", "برقی"
        HYBRID = "hybrid", "هیبریدی"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="fleet_vehicles",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fleet_vehicles",
    )
    vehicle_code = models.CharField(max_length=60, db_index=True)
    plate_number = models.CharField(max_length=60)
    model_name = models.CharField(max_length=150)
    vehicle_type = models.CharField(max_length=30, choices=VehicleType.choices, default=VehicleType.PICKUP)
    fuel_type = models.CharField(max_length=30, choices=FuelType.choices, default=FuelType.DIESEL)
    assigned_driver = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_vehicles",
    )
    current_odometer_km = models.FloatField(default=0.0)
    current_engine_hours = models.FloatField(default=0.0)
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["vehicle_code"]
        unique_together = [("organization", "vehicle_code")]

    def __str__(self):
        return f"{self.vehicle_code} - {self.model_name} ({self.plate_number})"


class FleetFuelLog(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="fleet_fuel_logs",
    )
    vehicle = models.ForeignKey(
        FleetVehicle,
        on_delete=models.CASCADE,
        related_name="fuel_logs",
    )
    log_date = models.DateField()
    odometer_km = models.FloatField()
    engine_hours = models.FloatField(null=True, blank=True)
    fuel_liters = models.FloatField()
    total_cost_irr = models.FloatField(default=0.0)
    distance_traveled_km = models.FloatField(default=0.0)
    consumption_rate_l_per_100km = models.FloatField(default=0.0)
    driver_name = models.CharField(max_length=150, blank=True)
    receipt_reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-log_date", "-created_at"]

    def save(self, *args, **kwargs):
        # Auto compute distance and consumption if previous log exists
        prev_log = (
            FleetFuelLog.objects.filter(vehicle=self.vehicle, odometer_km__lt=self.odometer_km)
            .order_by("-odometer_km")
            .first()
        )
        if prev_log and self.odometer_km > prev_log.odometer_km:
            dist = self.odometer_km - prev_log.odometer_km
            self.distance_traveled_km = round(dist, 2)
            if dist > 0 and self.fuel_liters > 0:
                self.consumption_rate_l_per_100km = round((self.fuel_liters / dist) * 100.0, 2)

        # Update vehicle current odometer
        if self.odometer_km > self.vehicle.current_odometer_km:
            self.vehicle.current_odometer_km = self.odometer_km
            self.vehicle.save(update_fields=["current_odometer_km"])

        super().save(*args, **kwargs)


class EnergyConsumptionLog(models.Model):
    class UtilityType(models.TextChoices):
        ELECTRICITY = "electricity", "برق سراسری / صنعتی (kWh)"
        NATURAL_GAS = "natural_gas", "گاز طبیعی (متر مکعب)"
        WATER = "water", "آب صنعتی / آشامیدنی (متر مکعب)"
        DIESEL_GEN = "diesel_gen", "سوخت دیزل ژنراتور اضطراری (لیتر)"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="energy_consumption_logs",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="energy_consumption_logs",
    )
    utility_type = models.CharField(max_length=30, choices=UtilityType.choices, default=UtilityType.ELECTRICITY)
    meter_identifier = models.CharField(max_length=100)
    period_start = models.DateField()
    period_end = models.DateField()
    consumption_value = models.FloatField()
    unit = models.CharField(max_length=20, default="kWh")
    tariff_rate_irr = models.FloatField(default=0.0)
    total_cost_irr = models.FloatField(default=0.0)
    carbon_emissions_kg_co2 = models.FloatField(default=0.0)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-period_end"]

    def save(self, *args, **kwargs):
        if self.tariff_rate_irr > 0 and self.total_cost_irr == 0.0:
            self.total_cost_irr = round(self.consumption_value * self.tariff_rate_irr, 2)
        # Carbon emissions factor
        if self.utility_type == self.UtilityType.ELECTRICITY:
            self.carbon_emissions_kg_co2 = round(self.consumption_value * 0.55, 2)
        elif self.utility_type == self.UtilityType.NATURAL_GAS:
            self.carbon_emissions_kg_co2 = round(self.consumption_value * 1.9, 2)
        elif self.utility_type == self.UtilityType.DIESEL_GEN:
            self.carbon_emissions_kg_co2 = round(self.consumption_value * 2.68, 2)
        super().save(*args, **kwargs)


class ExcavationOperation(models.Model):
    class SoilType(models.TextChoices):
        ROCK = "rock", "سنگ پایدار (Solid Rock)"
        TYPE_A = "type_a", "خاک تیپ A (چسبنده مقاوم، مقاومت فشاری بالای ۱۵۰ kPa)"
        TYPE_B = "type_b", "خاک تیپ B (سیلت، ماسه رسی، مقاومت فشاری ۵۰ تا ۱۵۰ kPa)"
        TYPE_C = "type_c", "خاک تیپ C (شن و ماسه سست، زیر ۵۰ kPa یا آبدار)"

    class ProtectiveSystem(models.TextChoices):
        SLOPING = "sloping", "شیب‌بندی استاندارد دیواره (Sloping)"
        BENCHING = "benching", "پله‌بندی دیواره (Benching)"
        TRENCH_BOX = "trench_box", "جعبه محافظ ترانشه (Trench Box / Shield)"
        SHORING = "shoring", "سازه نگهبان و شمع‌کوبی هیدرولیکی (Shoring)"
        NONE_SHALLOW = "none_shallow", "بدون نیاز به مهار (عمق کمتر از ۱.۵ متر)"

    class Status(models.TextChoices):
        PLANNED = "planned", "برنامه‌ریزی‌شده"
        ACTIVE = "active", "در حال حفاری و خاکبرداری"
        INSPECTED_SAFE = "inspected_safe", "بازرسی‌شده و ایمن"
        BACKFILLED = "backfilled", "پرشده و خاتمه‌یافته"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="excavation_operations",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="excavation_operations",
    )
    project_name = models.CharField(max_length=200)
    reference_code = models.CharField(max_length=60, db_index=True)
    soil_type = models.CharField(max_length=30, choices=SoilType.choices, default=SoilType.TYPE_B)
    depth_m = models.FloatField()
    length_m = models.FloatField()
    bottom_width_m = models.FloatField()
    top_width_m = models.FloatField(default=0.0)
    volume_m3 = models.FloatField(default=0.0)
    protective_system = models.CharField(
        max_length=30, choices=ProteiveSystem.choices if "ProteiveSystem" in locals() else ProtectiveSystem.choices, default=ProtectiveSystem.SLOPING
    )
    permit = models.ForeignKey(
        "permits.Permit",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="excavations",
    )
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PLANNED)
    competent_person = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervised_excavations",
    )
    daily_inspection_passed = models.BooleanField(default=True)
    inspection_notes = models.TextField(blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("organization", "reference_code")]

    def save(self, *args, **kwargs):
        # Auto calculate geometry
        from apps.calculators.formulas import calculate_excavation_geometry
        geom = calculate_excavation_geometry(
            depth_m=self.depth_m,
            length_m=self.length_m,
            bottom_width_m=self.bottom_width_m,
            soil_type=self.soil_type,
        )
        self.top_width_m = geom["top_width_m"]
        self.volume_m3 = geom["volume_m3"]
        super().save(*args, **kwargs)
