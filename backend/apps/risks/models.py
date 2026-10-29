from django.core.exceptions import ValidationError
from django.db import models

from .risk import LIKELIHOOD_MAX, LIKELIHOOD_MIN, SEVERITY_MAX, SEVERITY_MIN


class Hazard(models.Model):
    class Category(models.TextChoices):
        PHYSICAL = "physical", "فیزیکی"
        CHEMICAL = "chemical", "شیمیایی"
        BIOLOGICAL = "biological", "زیستی"
        ERGONOMIC = "ergonomic", "ارگونومیک"
        PSYCHOSOCIAL = "psychosocial", "روانی-اجتماعی"
        SAFETY = "safety", "ایمنی"
        ENVIRONMENTAL = "environmental", "محیطی"
        OTHER = "other", "سایر"

    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        ACTIVE = "active", "فعال"
        CLOSED = "closed", "بسته‌شده"

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="hazards"
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="hazards",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=32, choices=Category.choices)
    source = models.CharField(max_length=200, blank=True)
    causes = models.TextField(blank=True)
    consequences = models.TextField(blank=True)
    exposed_persons = models.TextField(blank=True)
    existing_controls = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="hazards_owned",
        null=True,
        blank=True,
    )
    review_date = models.DateField(null=True, blank=True)
    reassessment_needed = models.BooleanField(default=False)
    reassessment_reason = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="hazards_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "status"])]

    def clean(self):
        if self.workplace_id and self.workplace.organization_id != self.organization_id:
            raise ValidationError(
                {"workplace": "محل کار باید متعلق به همان سازمان باشد."}
            )

    def __str__(self):
        return self.title


class RiskAssessment(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        PENDING = "pending", "در انتظار تأیید"
        APPROVED = "approved", "تأییدشده"
        REJECTED = "rejected", "ردشده"

    class Level(models.TextChoices):
        LOW = "low", "کم"
        MEDIUM = "medium", "متوسط"
        HIGH = "high", "زیاد"
        CRITICAL = "critical", "بحرانی"

    hazard = models.ForeignKey(
        Hazard, on_delete=models.CASCADE, related_name="assessments"
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="risk_assessments",
    )
    likelihood = models.PositiveSmallIntegerField(
        choices=[(value, str(value)) for value in range(LIKELIHOOD_MIN, LIKELIHOOD_MAX + 1)]
    )
    severity = models.PositiveSmallIntegerField(
        choices=[(value, str(value)) for value in range(SEVERITY_MIN, SEVERITY_MAX + 1)]
    )
    score = models.PositiveSmallIntegerField(editable=False)
    level = models.CharField(max_length=16, choices=Level.choices, editable=False)
    proposed_controls = models.TextField(blank=True)
    implemented_controls = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    assessed_at = models.DateTimeField(null=True, blank=True)
    assessed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="risk_assessments_made",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-assessed_at", "-created_at"]
        indexes = [models.Index(fields=["organization", "level"])]

    def clean(self):
        if self.hazard_id and self.hazard.organization_id != self.organization_id:
            raise ValidationError({"hazard": "خطر باید متعلق به همان سازمان باشد."})

    def __str__(self):
        return f"{self.hazard} — {self.get_level_display()}"


class BowTieDiagram(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        ACTIVE = "active", "فعال"
        UNDER_REVIEW = "under_review", "در حال بازنگری"
        ARCHIVED = "archived", "بایگانی‌شده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="bowtie_diagrams",
    )
    hazard = models.ForeignKey(
        Hazard,
        on_delete=models.CASCADE,
        related_name="bowtie_diagrams",
    )
    top_event = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="bowtie_diagrams_owned",
        null=True,
        blank=True,
    )
    target_review_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="bowtie_diagrams_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "status"])]

    def clean(self):
        if self.hazard_id and self.hazard.organization_id != self.organization_id:
            raise ValidationError({"hazard": "خطر باید متعلق به همان سازمان باشد."})

    def __str__(self):
        return f"پاپیونی: {self.top_event}"


class BowTieThreat(models.Model):
    diagram = models.ForeignKey(
        BowTieDiagram,
        on_delete=models.CASCADE,
        related_name="threats",
    )
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=64, blank=True)
    order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title


class BowTieConsequence(models.Model):
    class Severity(models.TextChoices):
        LOW = "low", "کم"
        MEDIUM = "medium", "متوسط"
        HIGH = "high", "زیاد"
        CRITICAL = "critical", "بحرانی"

    diagram = models.ForeignKey(
        BowTieDiagram,
        on_delete=models.CASCADE,
        related_name="consequences",
    )
    title = models.CharField(max_length=255)
    severity_level = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.MEDIUM,
    )
    order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title


class Barrier(models.Model):
    class BarrierType(models.TextChoices):
        PREVENTIVE = "preventive", "پیشگیرانه"
        MITIGATIVE = "mitigative", "کاهنده/تخفیفی"

    class Nature(models.TextChoices):
        ENGINEERING = "engineering", "مهندسی"
        ADMINISTRATIVE = "administrative", "مدیریتی/رویه"
        HUMAN_ACTION = "human_action", "اقدام انسانی"
        PHYSICAL = "physical", "فیزیکی/سخت‌افزاری"

    class Effectiveness(models.TextChoices):
        EFFECTIVE = "effective", "مؤثر"
        PARTIALLY_EFFECTIVE = "partially_effective", "تا حدودی مؤثر"
        INEFFECTIVE = "ineffective", "نامؤثر/معیوب"
        NOT_TESTED = "not_tested", "آزمایش‌نشده"

    class Status(models.TextChoices):
        OPERATIONAL = "operational", "عملیاتی"
        IMPAIRED = "impaired", "مختل"
        DECOMMISSIONED = "decommissioned", "از رده خارج"

    diagram = models.ForeignKey(
        BowTieDiagram,
        on_delete=models.CASCADE,
        related_name="barriers",
    )
    threat = models.ForeignKey(
        BowTieThreat,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="preventive_barriers",
    )
    consequence = models.ForeignKey(
        BowTieConsequence,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="mitigative_barriers",
    )
    barrier_type = models.CharField(
        max_length=20,
        choices=BarrierType.choices,
    )
    nature = models.CharField(
        max_length=30,
        choices=Nature.choices,
        default=Nature.ENGINEERING,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_critical = models.BooleanField(default=False)
    owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="barriers_owned",
        null=True,
        blank=True,
    )
    current_effectiveness = models.CharField(
        max_length=25,
        choices=Effectiveness.choices,
        default=Effectiveness.NOT_TESTED,
    )
    related_asset = models.ForeignKey(
        "assets.Equipment",
        on_delete=models.SET_NULL,
        related_name="barriers",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPERATIONAL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["barrier_type", "id"]

    def clean(self):
        if self.barrier_type == self.BarrierType.PREVENTIVE and not self.threat_id:
            raise ValidationError({"threat": "مانع پیشگیرانه باید به یک تهدید متصل باشد."})
        if self.barrier_type == self.BarrierType.MITIGATIVE and not self.consequence_id:
            raise ValidationError({"consequence": "مانع کاهنده باید به یک پیامد متصل باشد."})
        if self.related_asset_id and self.related_asset.organization_id != self.diagram.organization_id:
            raise ValidationError({"related_asset": "تجهیز مرتبط باید متعلق به همان سازمان باشد."})

    def __str__(self):
        return f"{self.name} ({self.get_barrier_type_display()})"


class BarrierAssessment(models.Model):
    barrier = models.ForeignKey(
        Barrier,
        on_delete=models.CASCADE,
        related_name="assessments",
    )
    effectiveness = models.CharField(
        max_length=25,
        choices=Barrier.Effectiveness.choices,
    )
    assessed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="barrier_assessments",
        null=True,
        blank=True,
    )
    assessment_date = models.DateField()
    evidence_reference = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-assessment_date", "-created_at"]

    def __str__(self):
        return f"ارزیابی {self.barrier.name} — {self.get_effectiveness_display()}"


class HCMSControlMatrix(models.Model):
    class Hierarchy(models.TextChoices):
        ELIMINATION = "elimination", "حذف"
        SUBSTITUTION = "substitution", "جایگزینی"
        ENGINEERING = "engineering", "کنترل مهندسی"
        ADMINISTRATIVE = "administrative", "کنترل اداری"
        PPE = "ppe", "تجهیزات حفاظت فردی"

    class Status(models.TextChoices):
        IMPLEMENTED = "implemented", "پیاده‌سازی‌شده"
        IN_PROGRESS = "in_progress", "در حال پیاده‌سازی"
        PLANNED = "planned", "برنامه‌ریزی‌شده"
        FAILED = "failed", "ناموفق/معیوب"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="hcms_controls",
    )
    hazard = models.ForeignKey(
        Hazard,
        on_delete=models.CASCADE,
        related_name="hcms_controls",
    )
    barrier = models.ForeignKey(
        Barrier,
        on_delete=models.SET_NULL,
        related_name="hcms_entries",
        null=True,
        blank=True,
    )
    control_title = models.CharField(max_length=255)
    hierarchy_of_control = models.CharField(
        max_length=25,
        choices=Hierarchy.choices,
    )
    implementation_status = models.CharField(
        max_length=25,
        choices=Status.choices,
        default=Status.IMPLEMENTED,
    )
    review_frequency_days = models.PositiveIntegerField(default=90)
    last_reviewed_at = models.DateField(null=True, blank=True)
    next_review_due = models.DateField(null=True, blank=True)
    responsible_owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="hcms_controls_owned",
        null=True,
        blank=True,
    )
    initial_risk_score = models.PositiveSmallIntegerField(default=15)
    residual_likelihood = models.PositiveSmallIntegerField(
        choices=[(v, str(v)) for v in range(LIKELIHOOD_MIN, LIKELIHOOD_MAX + 1)],
        default=2,
    )
    residual_severity = models.PositiveSmallIntegerField(
        choices=[(v, str(v)) for v in range(SEVERITY_MIN, SEVERITY_MAX + 1)],
        default=3,
    )
    residual_score = models.PositiveSmallIntegerField(editable=False, default=6)
    residual_level = models.CharField(
        max_length=16,
        choices=RiskAssessment.Level.choices,
        editable=False,
        default=RiskAssessment.Level.MEDIUM,
    )
    reassessment_trigger = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "residual_level"])]

    def clean(self):
        if self.hazard_id and self.hazard.organization_id != self.organization_id:
            raise ValidationError({"hazard": "خطر باید متعلق به همان سازمان باشد."})
        if self.barrier_id and self.barrier.diagram.organization_id != self.organization_id:
            raise ValidationError({"barrier": "مانع کنترلی باید متعلق به همان سازمان باشد."})

    def __str__(self):
        return f"{self.control_title} ({self.get_hierarchy_of_control_display()})"


class RiskAssessmentTemplate(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="risk_templates",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    industry = models.CharField(max_length=100)
    category = models.CharField(max_length=32, choices=Hazard.Category.choices)
    standard_code = models.CharField(max_length=100, blank=True)
    version = models.CharField(max_length=20, default="1.0")
    typical_threats = models.TextField(blank=True)
    typical_consequences = models.TextField(blank=True)
    recommended_barriers = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title", "version"]

    def __str__(self):
        return f"{self.title} (v{self.version})"

