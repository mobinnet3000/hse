# پرامپت اجرایی فاز ۱: زیرساخت داده‌های مشترک، باس رویداد و زنجیره ردیابی
## PHASE 1: Shared Core Foundation, Event Bus & Enterprise Traceability Engine

> **دستور برای ایجنت مجری:** این فاز پایه و اساس ارتباطی تمام ۲۰ ماژول سامانه HSE را پیاده‌سازی می‌کند. با اجرای این فاز، زیرساخت تبادل داده بر اساس ۴ اصل معماری (عدم افزونگی، اطلاعات پایه مشترک، زنجیره ردیابی و تفکیک دسترسی) مستقر می‌شود.

---

### ۱. مشخصات ایجنت و اسکیل‌های فعال
- **نقش ایجنت (Subagent Role):** `Core Platform & Event Architect`
- **اسکیل‌های تخصصی مورد استفاده:**
  - `backend`: اصول طراحی بک‌اند مقیاس‌پذیر و توزیع‌شده
  - `python-backend`: فریم‌ورک جنگو، الگوهای مدل‌سازی و سیگنال‌های پیشرفته
  - `database-architect`: مدل‌سازی دیتابیس و مدیریت روابط بدون افزونگی
  - `database-schema-design`: ساخت ایندکس‌های بهینه، کلیدهای خارجی و یکپارچگی ارجاعی
  - `system-designer`: معماری ارتباطات بین‌ماژولی و الگوهای Pub/Sub
  - `event-architect`: طراحی باس رویداد (Event-Driven Architecture)

---

### ۲. اهداف فنی فاز ۱
1. **ساخت ماژول زنجیره ردیابی جامع (`apps.core.traceability`):**
   - ایجاد مدل `TraceabilityChain` و `TraceabilityNode` با امکان ردیابی پیوسته:
     $$\text{Incident ID} \longrightarrow \text{Risk ID} \longrightarrow \text{CAPA ID} \longrightarrow \text{Verification ID}$$
   - ثبت متادیتا، برچسب زمانی، کاربر اقدام‌کننده و نوع ارتباط (Direct, Automatic, Approval, Event-Based).
2. **پیاده‌سازی باس رویدادهای داخلی سامانه (`HSEEventBus`):**
   - ایجاد یک مکانیزم سبک، همگام/ناهمگام بر بستر سیگنال‌های جنگو برای ارتباط بدون اتصال سست (Decoupled) میان ماژول‌ها.
   - رجیستری رویدادهای استاندارد (نظیر `RISK_REASSESSMENT_REQUIRED`, `INCIDENT_REGISTERED`, `MOC_APPROVED`, `ANOMALY_ESCALATED`).
3. **مدل‌های پایه مشترک (`SharedContextMixin` و `BaseEnterpriseModel`):**
   - انتزاع اطلاعات سازمان، سایت/پروژه، پیمانکار، واحد سازمانی، فاز پروژه و محیط عملیاتی در سطح هسته.
   - تضمین Tenant-Isolation و عدم تعریف جداگانه پروژه‌ها و نفرات در ماژول‌های مختلف.
4. **لایه‌بندی سطوح دسترسی داده‌های حساس (RBAC & Confidentiality):**
   - فیلتر کردن اطلاعات محرمانه (مانند پرونده‌های بهداشت و پزشکی کارکنان در تبادل با سایر بخش‌ها).

---

### ۳. ساختار فایل‌ها و کدهای مورد نیاز

#### الف) ایجاد مدل‌های ردیابی در `backend/apps/core/traceability.py`
```python
# backend/apps/core/traceability.py
import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _

class TraceabilityChain(models.Model):
    """
    نماینده یک زنجیره ردیابی کلان از حادثه/ناهنجاری تا ارزیابی ریسک و اقدام اصلاحی
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('organizations.Organization', on_delete=models.CASCADE, related_name='traceability_chains')
    tracking_code = models.CharField(max_length=64, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    origin_module = models.CharField(max_length=50) # e.g. 'incidents', 'findings', 'inspections'
    origin_object_id = models.CharField(max_length=64)
    status = models.CharField(max_length=32, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'tracking_code']),
            models.Index(fields=['origin_module', 'origin_object_id']),
        ]

class TraceabilityNode(models.Model):
    """
    گره‌های متوالی در زنجیره ردیابی
    """
    RELATION_TYPES = [
        ('direct', 'مستقیم (Direct)'),
        ('automatic', 'خودکار (Automatic)'),
        ('approval_based', 'تأییدمحور (Approval-Based)'),
        ('event_based', 'اعلان‌محور (Event-Based)'),
        ('bidirectional', 'دوسویه (Bidirectional)'),
        ('analytical', 'تحلیلی (Analytical)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chain = models.ForeignKey(TraceabilityChain, on_delete=models.CASCADE, related_name='nodes')
    from_module = models.CharField(max_length=50)
    from_id = models.CharField(max_length=64)
    to_module = models.CharField(max_length=50)
    to_id = models.CharField(max_length=64)
    relation_type = models.CharField(max_length=30, choices=RELATION_TYPES, default='direct')
    description = models.TextField(blank=True)
    actor = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['chain', 'created_at']),
            models.Index(fields=['to_module', 'to_id']),
        ]
```

#### ب) پیاده‌سازی Event Bus در `backend/apps/core/events.py`
```python
# backend/apps/core/events.py
import logging
from django.dispatch import Signal

logger = logging.getLogger(__name__)

# رویدادهای استاندارد تبادل بین‌ماژولی
hse_signal_event = Signal() # sender, event_name, payload, organization_id, actor

class HSEEventRegistry:
    RISK_ASSESSMENT_APPROVED = "risk.assessment.approved"
    RISK_REASSESSMENT_TRIGGERED = "risk.reassessment.triggered"
    INCIDENT_LOGGED = "incident.logged"
    MOC_AUTHORIZED = "moc.authorized"
    INSPECTION_DEFECT_FOUND = "inspection.defect.found"
    ANOMALY_SUBMITTED = "anomaly.submitted"
    CAPA_VERIFIED = "capa.verified"

def dispatch_hse_event(event_name: str, sender_module: str, payload: dict, organization_id: int, actor=None):
    """
    ارسال متمرکز رویداد به تمام شنوندگان ثبت‌شده با ثبت لاگ ساختاریافته
    """
    logger.info(f"[HSE Event Bus] Event: {event_name} from {sender_module} (Org: {organization_id})")
    hse_signal_event.send(
        sender=sender_module,
        event_name=event_name,
        payload=payload,
        organization_id=organization_id,
        actor=actor
    )
```

#### ج) میکسین اطلاعات زمینه مشترک سازمانی در `backend/apps/core/mixins.py`
```python
# فیلدهای مشترک مطابق با نیازمندی Assessment Context
class EnterpriseContextMixin(models.Model):
    department = models.CharField(max_length=150, blank=True, verbose_name="واحد سازمانی")
    site_location = models.CharField(max_length=200, blank=True, verbose_name="محل اجرای فعالیت")
    area = models.CharField(max_length=150, blank=True, verbose_name="بخش یا ناحیه عملیاتی")
    project_phase = models.CharField(max_length=100, blank=True, verbose_name="فاز پروژه")
    operation_type = models.CharField(max_length=100, blank=True, verbose_name="نوع عملیات")
    client_name = models.CharField(max_length=200, blank=True, verbose_name="نام کارفرما")
    contractor = models.ForeignKey('organizations.Contractor', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="پیمانکار")

    class Meta:
        abstract = True
```

---

### ۴. اقدامات اعتبارسنجی و بررسی صحت خروجی
1. اجرای دستور `python manage.py makemigrations core` و `python manage.py migrate core`.
2. ایجاد تست اتوماتیک برای تأیید ثبت موفق یک زنجیره ردیابی از نوع `INC-001 -> RSK-001 -> CAPA-001`.
3. تست عدم امکان دسترسی تداخل‌دار میان سازمان‌های مجزا (Multi-tenant isolation).
