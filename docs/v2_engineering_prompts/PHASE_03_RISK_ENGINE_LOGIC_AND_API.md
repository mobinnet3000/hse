# پرامپت اجرایی فاز ۳: موتور محاسبات ماتریس ریسک، منطق تجاری و APIهای REST
## PHASE 3: Risk Calculation Engine, Business Logic & RESTful API Endpoints

> **دستور برای ایجنت مجری:** در این فاز، موتور محاسباتی ارزیابی ریسک (محاسبه خودکار RPN ابعاد چهارگانه HAER، ماتریس پذیرش ریسک بر اساس اصل ALARP، طبقه‌بندی سطوح شدت و احتمال) به همراه سریالایزرهای تودرتو و ویوست‌های DRF پیاده‌سازی می‌شوند.

---

### ۱. مشخصات ایجنت و اسکیل‌های فعال
- **نقش ایجنت (Subagent Role):** `Backend API & Calculation Engine Specialist`
- **اسکیل‌های تخصصی مورد استفاده:**
  - `python-backend`: توسعه پیشرفته با Django REST Framework (DRF)
  - `api-design`: طراحی اندپوینت‌های تمیز، استاندارد، صفحه‌بندی‌شده و نسخه‌بندی‌شده
  - `api-designer`: مدیریت خطاها، کدهای وضعیت HTTP، مستندسازی OpenAPI/Swagger
  - `error-handling`: مدیریت استثناها، ترنزکشن‌های پایگاه‌داده و اعتبارسنجی ورودی
  - `code-quality`: کدنویسی تمیز با Type Hinting و تفکیک لایه‌های سرویس (Service Layer)

---

### ۲. نیازمندی‌های منطق محاسباتی (Engine Specification)

#### الف) فرمول‌های محاسباتی ارزیابی
1. **عدد اولویت ریسک در هر بُعد (Dimension RPN):**
   $$RPN_{\text{dimension}} = \text{Likelihood} \times \text{Severity} \quad (1 \le RPN \le 25)$$
   - **L-H, S-H** $\rightarrow RPN_H$ (Human)
   - **L-A, S-A** $\rightarrow RPN_A$ (Asset)
   - **L-E, S-E** $\rightarrow RPN_E$ (Environment)
   - **L-R, S-R** $\rightarrow RPN_R$ (Reputation)

2. **سطح کلی ریسک سناریو (Overall Scenario Risk):**
   $$\text{Overall RPN} = \max(RPN_H, RPN_A, RPN_E, RPN_R)$$
   - امتیاز ۱ تا ۴: **ریسک پایین / سبز (Low / Acceptable)**
   - امتیاز ۵ تا ۹: **ریسک متوسط / زرد (Medium / Tolerable - ALARP)**
   - امتیاز ۱۰ تا ۱۵: **ریسک بالا / نارنجی (High / Undesirable)**
   - امتیاز ۱۶ تا ۲۵: **ریسک بحرانی / قرمز (Critical / Unacceptable)**

3. **اثربخشی کنترل‌ها و کاهش شدت/احتمال:**
   - کنترل‌های پیشگیرانه (Preventive Controls) $\rightarrow$ احتمال وقوع (Likelihood) را کاهش می‌دهند.
   - کنترل‌های کاهنده پیامد (Mitigative Controls) $\rightarrow$ شدت مورد انتظار (Severity) را کاهش می‌دهند.

---

### ۳. ساختار سرویس محاسباتی در `backend/apps/risks/services.py`

```python
# backend/apps/risks/services.py
from typing import Dict, Any, List
from django.db import transaction
from .models import RiskRegister, RiskScenario, DimensionScoreSet, DimensionConsequence

class RiskMatrixCalculator:
    """
    موتور مستقل محاسبات ریسک بر مبنای استاندارد ۵×۵ و ابعاد HAER
    """
    @staticmethod
    def calculate_rpn(likelihood: int, severity: int) -> int:
        if not (1 <= likelihood <= 5 and 1 <= severity <= 5):
            raise ValueError("مقادیر احتمال و شدت باید بین ۱ تا ۵ باشند.")
        return likelihood * severity

    @staticmethod
    def classify_level(rpn: int) -> str:
        if rpn <= 4:
            return "low"
        elif rpn <= 9:
            return "medium"
        elif rpn <= 15:
            return "high"
        return "critical"

    @classmethod
    def evaluate_scenario_scores(cls, scenario: RiskScenario, phase: str, score_data: List[Dict[str, Any]]):
        """
        محاسبه و ذخیره همزمان امتیازات ابعاد ۴ گانه
        """
        created_scores = []
        with transaction.atomic():
            for item in score_data:
                dim = item['dimension']
                l = int(item['likelihood'])
                s = int(item['severity'])
                rpn = cls.calculate_rpn(l, s)
                lvl = cls.classify_level(rpn)
                target = item.get('target_rpn')

                score_obj, _ = DimensionScoreSet.objects.update_or_create(
                    scenario=scenario,
                    phase=phase,
                    dimension=dim,
                    defaults={
                        'likelihood': l,
                        'severity': s,
                        'target_rpn': target
                    }
                )
                created_scores.append(score_obj)
        return created_scores
```

---

### ۴. طراحی اندپوینت‌های REST در `backend/apps/risks/views.py` و `urls.py`

| متد HTTP | آدرس اندپوینت (URL) | شرح عملیات |
| :--- | :--- | :--- |
| `GET` | `/api/v1/risks/registers/` | لیست رجیسترهای ارزیابی ریسک با فیلتر پروژه، واحد، وضعیت و تاریخ |
| `POST` | `/api/v1/risks/registers/` | ثبت شناسنامه اولیه ارزیابی ریسک (مرحله ۱: Context) |
| `GET` | `/api/v1/risks/registers/<id>/` | دریافت پرونده کامل ارزیابی به همراه درخت فعالیت‌ها و سناریوها |
| `POST` | `/api/v1/risks/registers/<id>/activities/` | افزودن وظایف و مراحل کار (مرحله ۲: Activity & Task) |
| `POST` | `/api/v1/risks/activities/<id>/hazards/` | ثبت منابع خطر شناسایی‌شده (مرحله ۳: Hazard Identification) |
| `POST` | `/api/v1/risks/hazards/<id>/scenarios/` | ثبت سناریوی رویداد ناخواسته و علل (مرحله ۴: Risk Scenario) |
| `POST` | `/api/v1/risks/scenarios/<id>/controls/` | ثبت کنترل‌های موجود و سطح سلسله‌مراتب (مرحله ۶) |
| `POST` | `/api/v1/risks/scenarios/<id>/evaluate/` | محاسبه و ثبت امتیازات ۴ گانه (مراحل ۷، ۸ و ۱۰: Initial, Current, Residual) |
| `POST` | `/api/v1/risks/scenarios/<id>/treatments/` | تعریف اقدام اصلاحی جدید و تولید شناسه ردیابی CAPA (مرحله ۹) |
| `POST` | `/api/v1/risks/registers/<id>/approve/` | تصویب، قفل نسخه و صدور مجوز چرخه عمر |
| `GET` | `/api/v1/risks/matrix-summary/` | تجمیع آماری هیت‌مپ ۵×۵ برای تفکیک بعد انسانی، دارایی، محیطی و اعتباری |

---

### ۵. سریالایزرهای تودرتو و اعتبارسنجی‌ها در `backend/apps/risks/serializers.py`
- استفاده از `ModelSerializer` برای بازنمایی سلسله‌مراتبی:
  `RiskRegisterSerializer` $\rightarrow$ `ActivityTaskSerializer` $\rightarrow$ `HazardSourceSerializer` $\rightarrow$ `RiskScenarioSerializer`.
- اعتبارسنجی سطح دسترسی و تطابق سازمان کاربر با سازمان سند (Multi-Tenancy Guard).
- فیلدهای محاسباتی `overall_rpn` و `overall_risk_level` به صورت `SerializerMethodField`.
