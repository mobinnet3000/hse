# پرامپت اجرایی فاز ۶: آزمون‌های جامع، امنیت OWASP و داده‌های دمو
## PHASE 6: End-to-End Testing Suite, Security Hardening & Industrial Demo Seeder

> **دستور برای ایجنت مجری:** در این فاز نهایی، تمامی لایه‌های ماژول ریسک از نظر صحت عملکرد محاسباتی، ایزولاسیون چندمستأجری (Multi-Tenancy)، امنیت داده‌های محرمانه (OWASP & Field-Level Security) و تست‌های خودکار بک‌اند و فرانت‌اند ارزیابی می‌شوند. همچنین یک اسکریپت سیدر جامع داده‌های صنعتی واقعی (صنایع نفت، گاز، پتروشیمی، معدن و ساختمان) ایجاد می‌گردد.

---

### ۱. مشخصات ایجنت و اسکیل‌های فعال
- **نقش ایجنت (Subagent Role):** `QA, Security & Audit Specialist`
- **اسکیل‌های تخصصی مورد استفاده:**
  - `test-architect`: طراحی هرم تست (Unit, Integration, E2E)
  - `testing-strategies`: تدوین سناریوهای مرزی (Edge Cases)، خطاها و تست‌های فرمول‌ها
  - `testing-automation`: اجرای تست‌های اتوماتیک در Django Test Runner و Vitest
  - `security-hardening`: پیاده‌سازی گاردها و سیاست‌های امنیتی
  - `security-owasp`: محافظت در برابر آسیب‌پذیری‌های متداول وب و نشت اطلاعات
  - `code-review`: بازبینی کیفیت، خوانایی و استاندارد بودن کد

---

### ۲. سناریوهای آزمون‌های خودکار بک‌اند (`backend/apps/risks/tests_v2.py`)

1. **تست موتور محاسبات RPN و تطبیق سطوح HAER:**
   - تست مقادیر مرزی ($L=1..5, S=1..5$).
   - تأیید اینکه برای $L=4, S=4 \Rightarrow RPN=16$ و سطح ریسک بحرانی (`critical`) باشد.
   - محاسبه مستقل برای هر یک از ابعاد: Human, Asset, Environment, Reputation.
2. **تست یکپارچگی زنجیره ردیابی (Traceability Chain Verification):**
   - ایجاد یک حادثه نمونه در `apps.incidents` و انتشار رویداد `INCIDENT_LOGGED`.
   - تأیید ثبت خودکار نود `TraceabilityNode` با ردیابی پیوسته:
     `INC-100` $\rightarrow$ `RSK-200` $\rightarrow$ `CAPA-300` $\rightarrow$ `VER-400`.
3. **تست تفکیک مستأجران (Tenant Isolation Guard):**
   - کاربر سازمان A تحت هیچ شرایطی نباید قادر به مشاهده یا ویرایش رجیستر ارزیابی ریسک سازمان B باشد.
4. **تست محرمانگی اطلاعات بهداشت حرفه‌ای (Occupational Health Privacy):**
   - داده‌های پزشکی و پرونده‌های بیماری کارکنان هرگز نباید در پاسخ‌های عمومی API ماژول ریسک نشت کند.

```python
# backend/apps/risks/tests_v2.py
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.organizations.models import Organization
from apps.risks.models import RiskRegister, RiskActivityTask, HazardSource, RiskScenario, DimensionScoreSet
from apps.risks.services import RiskMatrixCalculator

User = get_user_model()

class RiskEngineTestSuite(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="پتروشیمی خلیج فارس")
        self.user = User.objects.create_user(username="hse_expert", password="password123")
        self.register = RiskRegister.objects.create(
            organization=self.org,
            register_code="RR-2026-001",
            title="ارزیابی ریسک عملیات تعمیرات اساسی (Overhaul)",
            created_by=self.user
        )

    def test_rpn_calculation_and_classification(self):
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(1, 1), 1)
        self.assertEqual(RiskMatrixCalculator.classify_level(1), "low")

        self.assertEqual(RiskMatrixCalculator.calculate_rpn(3, 3), 9)
        self.assertEqual(RiskMatrixCalculator.classify_level(9), "medium")

        self.assertEqual(RiskMatrixCalculator.calculate_rpn(4, 3), 12)
        self.assertEqual(RiskMatrixCalculator.classify_level(12), "high")

        self.assertEqual(RiskMatrixCalculator.calculate_rpn(5, 4), 20)
        self.assertEqual(RiskMatrixCalculator.classify_level(20), "critical")

    def test_haer_dimension_independence(self):
        task = RiskActivityTask.objects.create(
            register=self.register,
            activity_title="جوشکاری در مخازن هیدروکربوری",
            task_name="برشکاری لوله ورودی"
        )
        hazard = HazardSource.objects.create(
            activity_task=task,
            domain="safety",
            category="آتش‌سوزی و انفجار",
            description="وجود گاز محبوس در مخزن"
        )
        scenario = RiskScenario.objects.create(
            hazard=hazard,
            scenario_title="تخلیه ناقص گاز و جرقه جوشکاری منجر به اشتعال",
            undesired_event="انفجار موضعی در هدر خط لوله",
            initiating_event="جرقه مشعل برشکاری",
            direct_causes="عدم گازسنجی معتبر قبل از شروع کار"
        )

        # ارزیابی بعد انسانی (Human): احتمال 3، شدت 4 -> RPN = 12 (High)
        s_human = DimensionScoreSet.objects.create(
            scenario=scenario,
            phase="initial",
            dimension="human",
            likelihood=3,
            severity=4
        )
        # ارزیابی بعد دارایی (Asset): احتمال 4، شدت 5 -> RPN = 20 (Critical)
        s_asset = DimensionScoreSet.objects.create(
            scenario=scenario,
            phase="initial",
            dimension="asset",
            likelihood=4,
            severity=5
        )

        self.assertEqual(s_human.rpn, 12)
        self.assertEqual(s_human.risk_level, "high")
        self.assertEqual(s_asset.rpn, 20)
        self.assertEqual(s_asset.risk_level, "critical")
```

---

### ۳. اسکریپت داده‌های دمو با سناریوهای واقعی ایران (`backend/scripts/seed_risk_register_v2.py`)
این اسکریپت شامل سناریوهای کامل صنعتی زیر است:
1. **صنعت نفت و پتروشیمی:** کار در فضای بسته مخزن اتیلن و مواجهه با گاز سمی $H_2S$.
2. **صنعت حفاری و معدن:** ریزش دیواره در گودبرداری‌های عمیق و کار ماشین‌آلات سنگین.
3. **صنعت ساختمانی و نیروگاهی:** عملیات باربرداری سنگین با تاورکرین و سقوط بار در مجاورت خطوط انتقال برق فشار قوی.

---

### ۴. اقدامات اعتبارسنجی
1. اجرای دستور `python manage.py test apps.risks.tests_v2` و پاس شدن ۱۰۰٪ تست‌ها.
2. اجرای سیدر با دستور `python manage.py runscript seed_risk_register_v2`.
3. بررسی تست‌های کلاینت فرانت‌اند با `npm test -- --run`.
