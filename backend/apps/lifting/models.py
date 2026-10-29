import math
from django.core.exceptions import ValidationError
from django.db import models


class CraneSpecification(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="crane_specifications",
    )
    model_name = models.CharField(max_length=150)
    manufacturer = models.CharField(max_length=150, blank=True)
    max_capacity_tonnes = models.FloatField()
    boom_length_min_m = models.FloatField()
    boom_length_max_m = models.FloatField()
    equipment = models.ForeignKey(
        "assets.Equipment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="crane_specifications",
    )
    # Load chart matrix format: [{"boom_length_m": 20.0, "radius_m": 8.0, "capacity_kg": 25000.0}, ...]
    load_chart_data = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["model_name"]
        unique_together = [("organization", "model_name")]

    def __str__(self):
        return f"{self.model_name} ({self.max_capacity_tonnes}T)"

    def lookup_capacity(self, boom_length_m: float, radius_m: float) -> float:
        """Looks up rated capacity from the chart.

        Finds closest match or returns conservative lower bound.
        """
        if not self.load_chart_data:
            return self.max_capacity_tonnes * 1000.0

        # Filter for points covering at least this boom length and radius
        valid_booms = [pt for pt in self.load_chart_data if pt.get("boom_length_m", 0) >= boom_length_m]
        if not valid_booms:
            valid_booms = self.load_chart_data

        min_boom = min(pt.get("boom_length_m", boom_length_m) for pt in valid_booms)
        at_boom = [pt for pt in valid_booms if pt.get("boom_length_m") == min_boom]

        valid_radii = [pt for pt in at_boom if pt.get("radius_m", 0) >= radius_m]
        if valid_radii:
            min_r = min(pt.get("radius_m", radius_m) for pt in valid_radii)
            matches = [pt for pt in valid_radii if pt.get("radius_m") == min_r]
            return float(matches[0].get("capacity_kg", 0.0))
        return 0.0


class LiftingPlan(models.Model):
    class LiftCategory(models.TextChoices):
        STANDARD = "standard", "باربرداری استاندارد (زیر ۷۵٪ ظرفیت)"
        CRITICAL = "critical", "باربرداری بحرانی (بالای ۷۵٪ ظرفیت یا بالای خطوط زنده)"
        COMPLEX = "complex", "باربرداری پیچیده (دونقطه یا بار نامتقارن)"
        TANDEM = "tandem", "باربرداری همزمان با دو جرثقیل (Tandem Lift)"

    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        UNDER_REVIEW = "under_review", "تحت بررسی مهندسی"
        APPROVED = "approved", "تصویب‌شده و مجاز"
        REJECTED = "rejected", "رد شده"
        SUPERSEDED = "superseded", "منسوخ / باطل‌شده"

    class SlingType(models.TextChoices):
        WIRE_ROPE = "wire_rope", "سیم‌بکسل فولادی (Wire Rope)"
        SYNTHETIC_WEBBING = "synthetic_webbing", "تسمه مصنوعی تخت (Synthetic Webbing)"
        CHAIN = "chain", "زنجیر فولادی گرید ۸۰/۱۰۰ (Alloy Chain)"
        ROUND_SLING = "round_sling", "تسمه گرد بی‌پایان (Round Sling)"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="lifting_plans",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="lifting_plans",
    )
    plan_number = models.CharField(max_length=60, db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=30, choices=LiftCategory.choices, default=LiftCategory.STANDARD)
    planned_date = models.DateField()

    # Personnel
    lift_supervisor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervised_lifting_plans",
    )
    rigger_name = models.CharField(max_length=150, blank=True)
    operator_name = models.CharField(max_length=150, blank=True)

    # Crane info
    crane = models.ForeignKey(
        CraneSpecification,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lifting_plans",
    )
    boom_length_m = models.FloatField(default=15.0)
    lift_radius_m = models.FloatField(default=6.0)
    crane_capacity_at_radius_kg = models.FloatField(default=0.0)
    crane_utilization_pct = models.FloatField(default=0.0)

    # Load & Rigging Weights
    load_description = models.CharField(max_length=255)
    load_weight_kg = models.FloatField(default=0.0)
    rigging_hardware_weight_kg = models.FloatField(default=0.0)
    hook_block_weight_kg = models.FloatField(default=0.0)
    total_gross_weight_kg = models.FloatField(default=0.0)

    # Rigging Arrangement
    sling_type = models.CharField(max_length=30, choices=SlingType.choices, default=SlingType.WIRE_ROPE)
    num_sling_legs = models.IntegerField(default=2)
    sling_angle_to_horizontal_deg = models.FloatField(default=60.0)
    tension_per_leg_kg = models.FloatField(default=0.0)
    sling_rated_wll_kg = models.FloatField(default=0.0)
    shackle_rated_wll_kg = models.FloatField(default=0.0)

    # Ground & Environment
    outrigger_pad_area_sqm = models.FloatField(default=1.0)
    ground_bearing_pressure_kpa = models.FloatField(default=0.0)
    allowable_ground_pressure_kpa = models.FloatField(default=250.0)
    wind_speed_limit_mps = models.FloatField(default=9.8)  # max ~ 35 km/h
    exclusion_zone_radius_m = models.FloatField(default=15.0)

    # Integration
    permit = models.ForeignKey(
        "permits.Permit",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lifting_plans",
    )

    # Workflow & Status
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_lifting_plans",
    )
    reviewed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_lifting_plans",
    )
    approved_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_lifting_plans",
    )
    approval_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    pre_lift_checklist = models.JSONField(default=list, blank=True)
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("organization", "plan_number")]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["workplace", "planned_date"]),
        ]

    def __str__(self):
        return f"{self.plan_number} - {self.title} ({self.get_status_display()})"

    def clean(self):
        if self.crane_id and self.crane.organization_id != self.organization_id:
            raise ValidationError({"crane": "جرثقیل انتخاب شده متعلق به این سازمان نیست."})
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError({"workplace": "کارگاه انتخاب شده متعلق به این سازمان نیست."})

    def recalculate_engineering_parameters(self):
        """Recalculates total gross load, sling tension, crane utilization, and outrigger pressure."""
        self.total_gross_weight_kg = (
            self.load_weight_kg + self.rigging_hardware_weight_kg + self.hook_block_weight_kg
        )

        # Lookup capacity if crane provided and capacity is 0
        if self.crane:
            chart_cap = self.crane.lookup_capacity(self.boom_length_m, self.lift_radius_m)
            if chart_cap > 0:
                self.crane_capacity_at_radius_kg = chart_cap

        if self.crane_capacity_at_radius_kg > 0:
            self.crane_utilization_pct = round(
                (self.total_gross_weight_kg / self.crane_capacity_at_radius_kg) * 100.0, 2
            )

        # Sling Tension
        angle = max(1.0, min(90.0, self.sling_angle_to_horizontal_deg))
        effective_legs = 2 if self.num_sling_legs == 4 else max(1, self.num_sling_legs)
        rad = math.radians(angle)
        sin_val = math.sin(rad)
        if sin_val > 0:
            self.tension_per_leg_kg = round(self.total_gross_weight_kg / (effective_legs * sin_val), 2)

        # Ground bearing pressure: approx crane + load / 4 pads * 1.5 eccentricity
        crane_wt = (self.crane.max_capacity_tonnes * 1000.0) if self.crane else 25000.0
        total_sys = crane_wt + self.total_gross_weight_kg
        max_reaction_kg = (total_sys / 4.0) * 1.5
        max_force_kn = (max_reaction_kg * 9.80665) / 1000.0
        if self.outrigger_pad_area_sqm > 0:
            self.ground_bearing_pressure_kpa = round(max_force_kn / self.outrigger_pad_area_sqm, 2)

        # Category auto-assignment if utilization > 75%
        if self.crane_utilization_pct >= 75.0 and self.category == self.LiftCategory.STANDARD:
            self.category = self.LiftCategory.CRITICAL


class LiftApprovalLog(models.Model):
    lifting_plan = models.ForeignKey(
        LiftingPlan,
        on_delete=models.CASCADE,
        related_name="approval_logs",
    )
    user = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=40)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
