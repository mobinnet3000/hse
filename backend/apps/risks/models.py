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



# =====================================================================
# 10-Step Enterprise Risk Register Architecture (HAER Model)
# =====================================================================

import uuid
from apps.core.mixins import EnterpriseContextMixin
from django.core.validators import MinValueValidator, MaxValueValidator


class RiskRegister(EnterpriseContextMixin, models.Model):
    """
    مرحله ۱: بستر ارزیابی ریسک و هویت پرونده (Assessment Context)
    """
    class RegisterStatus(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        UNDER_REVIEW = "under_review", "در حال بررسی"
        APPROVED = "approved", "تأییدشده"
        SUPERSEDED = "superseded", "منسوخ‌شده"
        ARCHIVED = "archived", "بایگانی‌شده"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="risk_registers"
    )
    register_code = models.CharField(max_length=64, unique=True, db_index=True, verbose_name="کد شناسایی ارزیابی")
    title = models.CharField(max_length=255, verbose_name="عنوان ارزیابی ریسک")
    revision = models.PositiveIntegerField(default=1, verbose_name="شماره ویرایش")
    status = models.CharField(max_length=20, choices=RegisterStatus.choices, default=RegisterStatus.DRAFT)
    assessment_date = models.DateField(auto_now_add=True)
    next_review_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_registers"
    )
    approved_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_registers"
    )
    risk_acceptance_status = models.CharField(
        max_length=30,
        default="acceptable",
        choices=[
            ("acceptable", "قابل قبول"),
            ("tolerable_alarp", "قابل تحمل در محدوده ALARP"),
            ("unacceptable", "غیرقابل قبول"),
        ],
        verbose_name="وضعیت پذیرش ریسک"
    )
    acceptance_authority = models.CharField(max_length=200, blank=True, verbose_name="مرجع پذیرش ریسک")
    audit_trail_code = models.CharField(max_length=100, blank=True, db_index=True, verbose_name="کد ردپای ممیزی")
    approval_notes = models.TextField(blank=True, verbose_name="توضیحات و شروط تصویب")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "register_code", "status"])]

    def __str__(self):
        return f"{self.register_code} - {self.title} (v{self.revision})"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        if not self.traceability_chain_id:
            from django.utils import timezone
            now = timezone.now()
            count = RiskRegister.objects.filter(created_at__year=now.year).count() + 1
            self.traceability_chain_id = f"TRC-RSK-{now.strftime('%Y%m')}-{count:04d}"
        super().save(*args, **kwargs)

        if is_new:
            try:
                from apps.core.traceability import TraceabilityChain, TraceabilityNode
                chain, _ = TraceabilityChain.objects.get_or_create(
                    organization=self.organization,
                    tracking_code=self.traceability_chain_id,
                    defaults={
                        "title": f"زنجیره ردیابی رجیستر ریسک: {self.title}",
                        "origin_module": "risk_register",
                        "origin_object_id": str(self.id),
                    }
                )
                TraceabilityNode.objects.create(
                    chain=chain,
                    from_module="risk_register",
                    from_id=str(self.id),
                    to_module="risk_register",
                    to_id=str(self.id),
                    relation_type="direct",
                    description=f"ایجاد سند پایه ارزیابی ریسک {self.register_code}",
                )
            except Exception:
                pass


class RiskActivityTask(models.Model):
    """
    مرحله ۲: شناسایی فعالیت و مراحل وظایف (Activity & Task Identification)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    register = models.ForeignKey(RiskRegister, on_delete=models.CASCADE, related_name="activities")
    activity_title = models.CharField(max_length=255, verbose_name="عنوان فعالیت اصلی")
    activity_description = models.TextField(blank=True, verbose_name="شرح فعالیت")
    task_name = models.CharField(max_length=255, verbose_name="وظیفه یا کار اجرایی")
    job_steps = models.JSONField(default=list, blank=True, verbose_name="مراحل انجام کار (گام‌ها)")
    work_method = models.CharField(max_length=255, blank=True, verbose_name="روش اجرای کار / رویه")
    equipment = models.CharField(max_length=255, blank=True, verbose_name="تجهیزات مورد استفاده")
    materials = models.CharField(max_length=255, blank=True, verbose_name="مواد مصرفی و شیمیایی")
    personnel_count = models.PositiveIntegerField(default=1, verbose_name="تعداد افراد درگیر")
    competency = models.CharField(max_length=255, blank=True, verbose_name="تخصص و صلاحیت افراد")
    duration_frequency = models.CharField(max_length=150, blank=True, verbose_name="مدت و تناوب انجام کار")
    simops = models.TextField(blank=True, verbose_name="فعالیت‌های هم‌زمان (SIMOPS)")
    operating_conditions = models.TextField(blank=True, verbose_name="شرایط محیطی و عملیاتی")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.activity_title} - {self.task_name}"


class HazardSource(models.Model):
    """
    مرحله ۳: منابع خطر در ۴ حوزه اصلی (Hazard Identification)
    """
    class HazardDomain(models.TextChoices):
        SAFETY = "safety", "ایمنی (Safety)"
        OCCUPATIONAL_HEALTH = "health", "بهداشت حرفه‌ای (Occupational Health)"
        ENVIRONMENT = "environment", "محیط زیست (Environment)"
        PROCESS_SAFETY = "process", "ایمنی فرآیند (Process Safety)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity_task = models.ForeignKey(RiskActivityTask, on_delete=models.CASCADE, related_name="hazards")
    domain = models.CharField(max_length=30, choices=HazardDomain.choices)
    category = models.CharField(max_length=100, verbose_name="دسته‌بندی خطر")
    description = models.TextField(verbose_name="شرح منبع خطر")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.get_domain_display()}] {self.category}"


class RiskScenario(models.Model):
    """
    مرحله ۴: سناریوی ریسک و مکانیزم تبدیل خطر به حادثه (Risk Scenario Identification)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hazard = models.ForeignKey(HazardSource, on_delete=models.CASCADE, related_name="scenarios")
    scenario_title = models.CharField(max_length=255, verbose_name="عنوان سناریو")
    undesired_event = models.TextField(verbose_name="شرح رویداد ناخواسته")
    initiating_event = models.CharField(max_length=255, verbose_name="رویداد آغازگر")
    direct_causes = models.TextField(verbose_name="علل مستقیم")
    root_causes = models.TextField(blank=True, verbose_name="علل ریشه‌ای یا زمینه‌ای")
    escalation_factors = models.TextField(blank=True, verbose_name="عوامل تشدیدکننده")
    event_sequence = models.JSONField(default=list, blank=True, verbose_name="توالی وقوع رویداد")
    scenario_conditions = models.TextField(blank=True, verbose_name="شرایط وقوع")
    exposure_pathway = models.CharField(max_length=255, blank=True, verbose_name="مسیر مواجهه")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.scenario_title


class DimensionConsequence(models.TextChoices):
    HUMAN = "human", "انسانی (Human)"
    ASSET = "asset", "دارایی و تجهیزات (Asset)"
    ENVIRONMENT = "environment", "محیط زیست (Environment)"
    REPUTATION = "reputation", "اعتبار و جایگاه (Reputation)"
    OPERATIONAL = "operational", "تداوم عملیات (Operational Continuity)"


class RiskControl(models.Model):
    """
    مرحله ۶: کنترل‌های موجود و سلسله‌مراتب کنترل (Existing Controls)
    """
    class HierarchyOfControl(models.TextChoices):
        ELIMINATION = "elimination", "حذف خطر (Elimination)"
        SUBSTITUTION = "substitution", "جایگزینی (Substitution)"
        ENGINEERING = "engineering", "کنترل مهندسی (Engineering)"
        ADMINISTRATIVE = "administrative", "کنترل مدیریتی (Administrative)"
        PPE = "ppe", "تجهیزات حفاظت فردی (PPE)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scenario = models.ForeignKey(RiskScenario, on_delete=models.CASCADE, related_name="existing_controls")
    description = models.TextField(verbose_name="شرح کنترل")
    hierarchy = models.CharField(max_length=30, choices=HierarchyOfControl.choices)
    control_type = models.CharField(max_length=100, blank=True, verbose_name="نوع کنترل")
    control_owner = models.CharField(max_length=150, blank=True, verbose_name="مسئول کنترل")
    inspection_frequency = models.CharField(max_length=100, blank=True, verbose_name="تناوب بازرسی")
    is_effective = models.BooleanField(default=True, verbose_name="اثربخشی دارد؟")
    effectiveness_evidence = models.TextField(blank=True, verbose_name="شواهد اثربخشی")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.get_hierarchy_display()}] {self.description[:40]}"


class DimensionScoreSet(models.Model):
    """
    مراحل ۷، ۸ و ۱۰: ارزیابی ریسک در ابعاد ۴ گانه (Initial, Current, Residual)
    """
    class ScorePhase(models.TextChoices):
        INITIAL = "initial", "ارزیابی اولیه (بدون کنترل)"
        CURRENT = "current", "ارزیابی فعلی (با کنترل‌های موجود)"
        RESIDUAL = "residual", "ارزیابی باقیمانده (پس از اقدام اصلاحی)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scenario = models.ForeignKey(RiskScenario, on_delete=models.CASCADE, related_name="scores")
    phase = models.CharField(max_length=20, choices=ScorePhase.choices)
    dimension = models.CharField(max_length=20, choices=DimensionConsequence.choices)
    likelihood = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    severity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    rpn = models.PositiveSmallIntegerField(editable=False)
    risk_level = models.CharField(max_length=20, editable=False)
    target_rpn = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('scenario', 'phase', 'dimension')
        ordering = ["dimension", "phase"]

    def save(self, *args, **kwargs):
        self.rpn = self.likelihood * self.severity
        if self.rpn <= 4:
            self.risk_level = 'low'
        elif self.rpn <= 9:
            self.risk_level = 'medium'
        elif self.rpn <= 15:
            self.risk_level = 'high'
        else:
            self.risk_level = 'critical'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_dimension_display()} ({self.get_phase_display()}): RPN={self.rpn} ({self.risk_level})"


class RiskTreatmentAction(models.Model):
    """
    مرحله ۹: اقدامات اصلاحی و تکمیلی (Risk Treatment)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scenario = models.ForeignKey(RiskScenario, on_delete=models.CASCADE, related_name="treatments")
    action_description = models.TextField(verbose_name="شرح اقدام")
    hierarchy = models.CharField(max_length=30, choices=RiskControl.HierarchyOfControl.choices)
    priority = models.CharField(
        max_length=20,
        choices=[('urgent', 'فوری'), ('high', 'بالا'), ('medium', 'متوسط'), ('low', 'پایین')],
        default='high'
    )
    action_owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_risk_treatments"
    )
    due_date = models.DateField()
    status = models.CharField(
        max_length=20,
        default='pending',
        choices=[
            ('pending', 'در انتظار'),
            ('in_progress', 'در حال انجام'),
            ('completed', 'تکمیل‌شده'),
            ('verified', 'راستی‌آزمایی‌شده')
        ]
    )
    completion_evidence = models.TextField(blank=True)
    verification_result = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_risk_treatments"
    )
    traceability_node_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action_description[:50]} ({self.get_status_display()})"
