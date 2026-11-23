# پرامپت اجرایی فاز ۴: ماتریس ارتباطات بین‌ماژولی و یکپارچه‌سازی با ۱۹ ماژول دیگر
## PHASE 4: Cross-Module Integration Matrix & Event-Driven Interconnections

> **دستور برای ایجنت مجری:** در این فاز، تمام اتصالات ورودی و خروجی ماژول مدیریت ریسک با ۱۹ ماژول دیگر سامانه، دقیقاً طبق ماتریس ارتباطات مشخص‌شده در سند مستندات، بر بستر `HSEEventBus` و زنجیره ردیابی (`TraceabilityChain`) پیاده‌سازی می‌شوند. هیچ ماژولی نباید دیتای تکراری ذخیره کند.

---

### ۱. مشخصات ایجنت و اسکیل‌های فعال
- **نقش ایجنت (Subagent Role):** `Integration & Distributed Bus Engineer`
- **اسکیل‌های تخصصی مورد استفاده:**
  - `system-designer`: طراحی الگوهای اتصال و وابستگی معکوس میان ماژول‌ها
  - `event-architect`: پیاده‌سازی لیسنرهای رویداد، انتشار سیگنال و مدیریت Deadlock
  - `microservices-patterns`: طراحی قراردادهای ماژولار در بستر معماری مدولار جنگو
  - `websocket-realtime`: ارسال نوتیفیکیشن‌های بلادرنگ در صورت بالا رفتن ریسک یا رخداد بحرانی

---

### ۲. نگاشت ارتباطات ماژول مدیریت ریسک با سایر ماژول‌ها

```
                        ┌───────────────────────────────────────────────┐
                        │              INPUTS (ورودی‌ها)                 │
                        │ - Incidents (حوادث و درس‌آموخته‌ها)          │
                        │ - MOC (درخواست‌های تغییرات فرآیندی/فنی)       │
                        │ - Inspections (عدم‌انطباق‌ها و بازرسی‌ها)      │
                        │ - Anomaly Reports (شرایط و رفتارهای ناایمن)    │
                        │ - Legal & Standards (الزامات قانونی)          │
                        └───────────────────────┬───────────────────────┘
                                                │
                                                ▼
                        ┌───────────────────────────────────────────────┐
                        │      ماژول مدیریت ریسک (RISK MANAGEMENT)       │
                        │      شناسنامه سناریوها، ابعاد ۴ گانه و ALARP     │
                        └───────────────────────┬───────────────────────┘
                                                │
       ┌────────────────────────────────────────┼────────────────────────────────────────┐
       ▼                                        ▼                                        ▼
┌──────────────┐                       ┌─────────────────┐                      ┌─────────────────┐
│     PTW      │                       │ Training & PPE  │                      │ Occupational    │
│ مجوز کار با  │                       │ ماتریس شایستگی  │                      │     Health      │
│ شروط کنترلی  │                       │ و الزامات PPE   │                      │ حدود مجاز مواجهه│
└──────────────┘                       └─────────────────┘                      └─────────────────┘
       │                                        │                                        │
       ▼                                        ▼                                        ▼
┌──────────────┐                       ┌─────────────────┐                      ┌─────────────────┐
│  Emergency   │                       │   Contractor    │                      │  KPI/Dashboard  │
│ سناریوهای حاد│                       │ ارزیابی صلاحیت  │                      │ توزیع و هشدارهای│
│ طرح واکنش    │                       │ و رتبه ریسک     │                      │ ریسک‌های بحرانی │
└──────────────┘                       └─────────────────┘                      └─────────────────┘
```

---

### ۳. پیاده‌سازی لیسنرهای ورودی (Input Event Handlers)

در فایل `backend/apps/risks/listeners.py`:

```python
# backend/apps/risks/listeners.py
import logging
from django.dispatch import receiver
from apps.core.events import hse_signal_event, HSEEventRegistry
from apps.core.traceability import TraceabilityChain, TraceabilityNode
from .models import RiskRegister, RiskScenario, RiskTreatmentAction

logger = logging.getLogger(__name__)

@receiver(hse_signal_event)
def handle_cross_module_events(sender, event_name, payload, organization_id, actor=None, **kwargs):
    """
    دریافت رویدادهای سایر ماژول‌ها و همگام‌سازی ارزیابی ریسک بدون افزونگی داده
    """
    # ۱. دریافت ورودی از ماژول حوادث (Incident -> Risk)
    if event_name == HSEEventRegistry.INCIDENT_LOGGED:
        incident_id = payload.get('incident_id')
        hazard_category = payload.get('hazard_category')
        description = payload.get('description')
        
        logger.info(f"دریافت حادثه {incident_id} برای بازنگری در رجیستر ریسک.")
        # جستجو یا علامت‌گذاری سناریوهای متناظر برای بازنگری (Reassessment Required)
        scenarios = RiskScenario.objects.filter(
            hazard__activity_task__register__organization_id=organization_id,
            hazard__category=hazard_category
        )
        for sc in scenarios:
            # ایجاد نود ردیابی
            chain = TraceabilityChain.objects.filter(origin_object_id=str(incident_id)).first()
            if chain:
                TraceabilityNode.objects.create(
                    chain=chain,
                    from_module='incidents',
                    from_id=str(incident_id),
                    to_module='risks',
                    to_id=str(sc.id),
                    relation_type='automatic',
                    description=f"الزام به بازنگری ریسک به علت رخداد حادثه: {description}",
                    actor=actor
                )

    # ۲. دریافت ورودی از ماژول MOC (تغییرات تأییدشده -> Risk Assessment)
    elif event_name == HSEEventRegistry.MOC_AUTHORIZED:
        moc_id = payload.get('moc_id')
        change_title = payload.get('title')
        logger.info(f"دریافت درخواست MOC {moc_id}. تشکیل پیش‌نویس ارزیابی ریسک تغییر.")

    # ۳. دریافت ورودی از گزارش‌های Anomaly
    elif event_name == HSEEventRegistry.ANOMALY_SUBMITTED:
        anomaly_id = payload.get('anomaly_id')
        severity = payload.get('severity')
        logger.info(f"تحلیل ناهنجاری {anomaly_id} با شدت {severity} در ماتریس ریسک.")
```

---

### ۴. پیاده‌سازی خروجی‌ها به ماژول‌های مقصد (Outputs to Destinations)

1. **انتقال به PTW (Permit to Work):**
   - اندپوینت سرویس داخلی: `get_active_controls_for_activity(activity_id, task_id)`
   - ماژول PTW قبل از صدور پروانه کار گرم/فضای بسته، الزامات کنترلی ارزیابی ریسک را استخراج کرده و در چک‌لیست تأییدیه قرار می‌دهد.

2. **انتقال به بهداشت حرفه‌ای (Occupational Health):**
   - استخراج خطرات حوزه سلامت (صدا، ارگونومی، غبار، مواد شیمیایی) و ارسال به پرونده سلامت پرسنل.
   - **قانون دسترسی و محرمانگی:** ارزیابی ریسک تنها شناسه مخاطره شغلی و حدود مجاز مواجهه را دریافت می‌کند؛ سوابق پزشکی فردی هرگز در ماژول ریسک ثبت نمی‌شوند.

3. **انتقال به تجهیزات حفاظت فردی (PPE Management):**
   - هرگاه در مرحله ۶ یا ۹، سلسله‌مراتب کنترل سطح PPE انتخاب شود، لیست اقلام PPE مستقیماً در ماتریس نیازمندی تجهیزات حفاظت فردی ماژول ۱۰ شارژ می‌شود.

4. **انتقال به شاخص‌های کلیدی عملکرد و داشبورد (KPI & Dashboard):**
   - پس از هر ارزیابی ریسک جدید یا تغییر در امتیاز باقیمانده، رویداد `RISK_ASSESSMENT_APPROVED` ساطع شده و کانتورهای زیر به‌روزرسانی می‌شوند:
     - تعداد کل ریسک‌های بحرانی (Critical RPN)
     - شاخص پوشش اقدامات اصلاحی (CAPA Implementation Ratio)
     - درصد ریسک‌های پذیرفته‌شده در محدوده ALARP

---

### ۵. اقدامات اعتبارسنجی
1. اتصال سیگنال در `apps/risks/apps.py` درون تابع `ready()`.
2. اجرای تست انتشار فرضی یک حادثه و بررسی ایجاد خودکار گره ردیابی در جدول `TraceabilityNode`.
3. تست عدم امکان ایجاد تسک‌های تکراری هنگام دریافت هشدارهای هم‌زمان.
