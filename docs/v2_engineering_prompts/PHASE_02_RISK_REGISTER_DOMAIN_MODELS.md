# پرامپت اجرایی فاز ۲: مدل‌سازی داده‌ای و دیتابیس ۱۰ مرحله‌ای Risk Register
## PHASE 2: 10-Step Enterprise Risk Register Domain Models (HAER Architecture)

> **دستور برای ایجنت مجری:** در این فاز، ساختار مدل‌های پایگاه‌داده ماژول مدیریت ریسک (`apps.risks`) را دقیقاً منطبق بر ۱۰ مرحله استاندارد تدوین گزارش شناسایی و ارزیابی ریسک (Risk Register) پیاده‌سازی کنید. مدل‌ها باید بر مبنای ۴ بُعد مستقل پیامد (انسان، دارایی، محیط زیست، اعتبار - HAER) و منطق ALARP طراحی شوند.

---

### ۱. مشخصات ایجنت و اسکیل‌های فعال
- **نقش ایجنت (Subagent Role):** `Domain Data Modeler & DB Architect`
- **اسکیل‌های تخصصی مورد استفاده:**
  - `python-backend`: مدل‌سازی جنگو با TextChoices، ولیدیتورهای سفارشی و Clean Methods
  - `database-architect`: مدل‌سازی رابطه بین سناریو، پیامدها، کنترل‌ها و ماتریس ارزیابی
  - `database-schema-design`: بهینه‌سازی ایندکس‌ها، فیلدهای JSON و جامعیت کلیدهای خارجی
  - `database-migrations`: مهاجرت امن داده‌ها بدون شکستگی در دیتابیس فعلی

---

### ۲. نگاشت ۱۰ مرحله استاندارد Risk Register به موجودیت‌های دیتابیس

| ردیف | مرحله استاندارد | کلاس مدل در جنگو | فیلدهای کلیدی |
| :---: | :--- | :--- | :--- |
| **۱** | **محدوده ارزیابی (Assessment Context)** | `RiskRegister` (با ارث‌بری از `EnterpriseContextMixin`) | `organization`, `workplace`, `project_name`, `department`, `site_location`, `area`, `project_phase`, `operation_type`, `client`, `contractor`, `revision_number` |
| **۲** | **فعالیت و وظایف (Activity & Task)** | `RiskActivityTask` | `activity_title`, `description`, `task_name`, `job_steps` (JSON), `work_method`, `equipment_used`, `materials_used`, `personnel_count`, `competency_required`, `duration_frequency`, `simops_details`, `operating_conditions` |
| **۳** | **منابع خطر (Hazard Identification)** | `HazardSource` | `hazard_domain` (`safety`, `occupational_health`, `environment`, `process_safety`), `hazard_category`, `source_description` |
| **۴** | **سناریوی ریسک (Risk Scenario)** | `RiskScenario` | `scenario_title`, `undesired_event`, `initiating_event`, `direct_causes`, `root_causes`, `escalation_factors`, `event_sequence`, `scenario_conditions`, `exposure_pathway` |
| **۵** | **پیامدها (Consequences - HAER)** | `ScenarioConsequence` | `dimension` (`human`, `asset`, `environment`, `reputation`, `operational_continuity`), `consequence_description`, `potential_severity_label` |
| **۶** | **کنترل‌های موجود (Existing Controls)** | `ExistingRiskControl` | `control_description`, `hierarchy_level` (`elimination`, `substitution`, `engineering`, `administrative`, `ppe`), `control_type`, `control_owner`, `inspection_frequency`, `is_effective`, `evidence_reference` |
| **۷** | **ارزیابی اولیه (Initial Risk)** | `InitialRiskScore` | برای هر بُعد: `dimension`, `likelihood` (1..5), `severity` (1..5), `rpn` ($L \times S$), `risk_level` (`low`, `medium`, `high`, `critical`) |
| **۸** | **ارزیابی با کنترل‌های موجود (Current Risk)** | `CurrentRiskScore` | برای هر بُعد: `dimension`, `current_likelihood`, `current_severity`, `current_rpn`, `risk_level`, `justification` |
| **۹** | **اقدامات اصلاحی/تکمیلی (Risk Treatment)** | `RiskTreatmentAction` (متصل به `apps.capa.CAPAAction`) | `action_description`, `action_type`, `hierarchy_level`, `priority` (`urgent`, `high`, `medium`, `low`), `action_owner`, `due_date`, `status`, `completion_evidence`, `verification_result`, `traceability_node` |
| **۱۰** | **ریسک باقیمانده و هدف (Residual & Target)** | `ResidualRiskScore` & `RiskGovernanceApproval` | `residual_likelihood`, `residual_severity`, `residual_rpn`, `target_rpn`, `is_acceptable`, `accepted_by`, `approval_date`, `version_status` (`draft`, `approved`, `superseded`) |

---

### ۳. پیاده‌سازی کدهای مدل در `backend/apps/risks/models.py`

```python
# backend/apps/risks/models.py
import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from apps.core.mixins import EnterpriseContextMixin

class RiskRegister(EnterpriseContextMixin, models.Model):
    """
    مرحله ۱: بستر ارزیابی ریسک و هویت پرونده
    """
    class RegisterStatus(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        UNDER_REVIEW = "under_review", "در حال بررسی"
        APPROVED = "approved", "تأییدشده"
        SUPERSEDED = "superseded", "منسوخ‌شده"
        ARCHIVED = "archived", "بایگانی‌شده"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('organizations.Organization', on_delete=models.CASCADE, related_name='risk_registers')
    register_code = models.CharField(max_length=64, unique=True, db_index=True, verbose_name="کد شناسایی ارزیابی")
    title = models.CharField(max_length=255, verbose_name="عنوان ارزیابی ریسک")
    revision = models.PositiveIntegerField(default=1, verbose_name="شماره ویرایش")
    status = models.CharField(max_length=20, choices=RegisterStatus.choices, default=RegisterStatus.DRAFT)
    assessment_date = models.DateField(auto_now_add=True)
    next_review_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='created_registers')
    approved_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_registers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['organization', 'register_code', 'status'])]

    def __str__(self):
        return f"{self.register_code} - {self.title} (v{self.revision})"

class RiskActivityTask(models.Model):
    """
    مرحله ۲: شناسایی فعالیت و مراحل وظایف
    """
    register = models.ForeignKey(RiskRegister, on_delete=models.CASCADE, related_name='activities')
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

    def __str__(self):
        return f"{self.activity_title} - {self.task_name}"

class HazardSource(models.Model):
    """
    مرحله ۳: منابع خطر در ۴ حوزه اصلی
    """
    class HazardDomain(models.TextChoices):
        SAFETY = "safety", "ایمنی (Safety)"
        OCCUPATIONAL_HEALTH = "health", "بهداشت حرفه‌ای (Health)"
        ENVIRONMENT = "environment", "محیط زیست (Environment)"
        PROCESS_SAFETY = "process", "ایمنی فرآیند (Process Safety)"

    activity_task = models.ForeignKey(RiskActivityTask, on_delete=models.CASCADE, related_name='hazards')
    domain = models.CharField(max_length=30, choices=HazardDomain.choices)
    category = models.CharField(max_length=100, verbose_name="دسته‌بندی خطر")
    description = models.TextField(verbose_name="شرح منبع خطر")

    def __str__(self):
        return f"[{self.get_domain_display()}] {self.category}"

class RiskScenario(models.Model):
    """
    مرحله ۴: سناریوی ریسک و مکانیزم تبدیل خطر به حادثه
    """
    hazard = models.ForeignKey(HazardSource, on_delete=models.CASCADE, related_name='scenarios')
    scenario_title = models.CharField(max_length=255, verbose_name="عنوان سناریو")
    undesired_event = models.TextField(verbose_name="شرح رویداد ناخواسته")
    initiating_event = models.CharField(max_length=255, verbose_name="رویداد آغازگر")
    direct_causes = models.TextField(verbose_name="علل مستقیم")
    root_causes = models.TextField(blank=True, verbose_name="علل ریشه‌ای یا زمینه‌ای")
    escalation_factors = models.TextField(blank=True, verbose_name="عوامل تشدیدکننده")
    event_sequence = models.JSONField(default=list, blank=True, verbose_name="توالی وقوع رویداد")
    scenario_conditions = models.TextField(blank=True, verbose_name="شرایط وقوع")
    exposure_pathway = models.CharField(max_length=255, blank=True, verbose_name="مسیر مواجهه")

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
    مرحله ۶: کنترل‌های موجود و سلسله‌مراتب کنترل
    """
    class HierarchyOfControl(models.TextChoices):
        ELIMINATION = "elimination", "حذف خطر (Elimination)"
        SUBSTITUTION = "substitution", "جایگزینی (Substitution)"
        ENGINEERING = "engineering", "کنترل مهندسی (Engineering)"
        ADMINISTRATIVE = "administrative", "کنترل مدیریتی (Administrative)"
        PPE = "ppe", "تجهیزات حفاظت فردی (PPE)"

    scenario = models.ForeignKey(RiskScenario, on_delete=models.CASCADE, related_name='existing_controls')
    description = models.TextField(verbose_name="شرح کنترل")
    hierarchy = models.CharField(max_length=30, choices=HierarchyOfControl.choices)
    control_type = models.CharField(max_length=100, blank=True, verbose_name="نوع کنترل")
    control_owner = models.CharField(max_length=150, blank=True, verbose_name="مسئول کنترل")
    inspection_frequency = models.CharField(max_length=100, blank=True, verbose_name="تناوب بازرسی")
    is_effective = models.BooleanField(default=True, verbose_name="اثربخشی دارد؟")
    effectiveness_evidence = models.TextField(blank=True, verbose_name="شواهد اثربخشی")

class DimensionScoreSet(models.Model):
    """
    مراحل ۷، ۸ و ۱۰: ارزیابی ریسک در ابعاد ۴ گانه به صورت اولیه، فعلی و باقیمانده
    """
    class ScorePhase(models.TextChoices):
        INITIAL = "initial", "ارزیابی اولیه (بدون کنترل)"
        CURRENT = "current", "ارزیابی فعلی (با کنترل‌های موجود)"
        RESIDUAL = "residual", "ارزیابی باقیمانده (پس از اقدام اصلاحی)"

    scenario = models.ForeignKey(RiskScenario, on_delete=models.CASCADE, related_name='scores')
    phase = models.CharField(max_length=20, choices=ScorePhase.choices)
    dimension = models.CharField(max_length=20, choices=DimensionConsequence.choices)
    likelihood = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    severity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    rpn = models.PositiveSmallIntegerField(editable=False) # L * S
    risk_level = models.CharField(max_length=20, editable=False) # low, medium, high, critical
    target_rpn = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        unique_together = ('scenario', 'phase', 'dimension')

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

class RiskTreatmentAction(models.Model):
    """
    مرحله ۹: اقدامات اصلاحی و تکمیلی (Treatment)
    """
    scenario = models.ForeignKey(RiskScenario, on_delete=models.CASCADE, related_name='treatments')
    action_description = models.TextField(verbose_name="شرح اقدام")
    hierarchy = models.CharField(max_length=30, choices=RiskControl.HierarchyOfControl.choices)
    priority = models.CharField(max_length=20, choices=[('urgent', 'فوری'), ('high', 'بالا'), ('medium', 'متوسط'), ('low', 'پایین')])
    action_owner = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='assigned_risk_treatments')
    due_date = models.DateField()
    status = models.CharField(max_length=20, default='pending', choices=[('pending', 'در انتظار'), ('in_progress', 'در حال انجام'), ('completed', 'تکمیل‌شده'), ('verified', 'راستی‌آزمایی‌شده')])
    completion_evidence = models.TextField(blank=True)
    verification_result = models.TextField(blank=True)
    verified_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_risk_treatments')
    traceability_node_id = models.CharField(max_length=64, blank=True)
```

---

### ۴. اقدامات اعتبارسنجی
1. اجرای `python manage.py makemigrations risks` و اعمال با `python manage.py migrate risks`.
2. اطمینان از اینکه مهاجرت روی دیتابیس `sqlite3` به درستی اجرا می‌شود و روابط کلید خارجی کامپکت هستند.
3. اعتبارسنجی ولیدیشن شرطی $RPN = L \times S$ و تطابق سطوح ریسک سبز/زرد/نارنجی/قرمز.
