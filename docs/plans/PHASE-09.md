# HSE Guard — برنامه اجرایی فاز ۹: مدیریت دارایی، نگهداری پیشگیرانه و کالیبراسیون

**تاریخ تدوین:** ۴ آبان ۱۴۰۵ (۲۵ اکتبر ۲۰۲۶)
**شاخه:** `main` — آخرین commit: `19fd508 Phase 08`
**وضعیت کلی:** `VERIFIED`
**مالکیت:** عامل اصلی (بدون استفاده از subagent در این اجرا)

---

## ۱. خط مبنای واقعی پیش از شروع

| مورد | نتیجه واقعی |
|---|---|
| Git | شاخه `main...origin/main`؛ تغییرات فاز ۸ در index/staged و working tree موجود است. هیچ commit/push/deploy انجام نشده است. |
| بک‌اند | `171 tests — OK` (آخرین اجرای فاز ۸) |
| فرانت‌اند | `8 files / 36 tests — OK` |
| بیلد | موفق؛ ۴۴ ماژول، خروجی `index-C7BVDX8q.js` |
| Django check | `System check identified no issues (0 silenced).` |
| مایگریشن | بدون drift در فاز ۸؛ مایگریشن جدید فاز ۹ باید ایجاد و بازبینی شود. |
| پایگاه داده | هیچ داده واقعی در `backend/db.sqlite3` وجود ندارد؛ آزمون seed فقط روی `/tmp/opencode/...` انجام می‌شود. |

> تغییرات staged فاز ۸ متعلق به کار قبلی است و حذف/بازنویسی نمی‌شود. در این فاز هیچ `git add` جدیدی انجام نمی‌شود.

---

## ۲. بررسی معماری موجود و تصمیم‌های طراحی

### الگوهای موجود
- اپ‌های Django با `models.py`، `serializers.py`، `services.py`، `views.py`، `urls.py`، `tests.py`.
- ایزولاسیون سازمانی با `accessible_organization_ids`, `is_active_member`, `can_view_organization` و QuerySetهای محدود.
- نقش‌ها در `apps.organizations.models.Membership.Roles` و توابع `apps.core.access`.
- Audit با `apps.auditlog.services.log_event`.
- اعلان با `apps.notifications.services.notify_user`.
- API با DRF، خطاهای ساختاریافته در `apps.core.exceptions` و صفحه‌بندی ۲۵تایی.
- فرانت‌اند React/TS با feature-based pages، `AuthProvider`، `api.ts` و تست‌های Vitest.

### تصمیم‌های فاز ۹
1. اپ جدید `apps.assets` برای Equipment، MaintenancePlan، MaintenanceWorkOrder و CalibrationRecord. اپ جدید موازی با workplaces نیست؛ Workplace فقط محل است و Equipment موجودیت دارایی است.
2. کد تجهیز در هر سازمان یکتا است (`UniqueConstraint(organization, code)`) و کد تکراری با خطای ۴۰۰ واضح رد می‌شود.
3. وضعیت‌ها: `ready`, `under_maintenance`, `out_of_service`, `retired`. وضعیت فقط از endpoint اقدام `POST /equipment/<id>/status/` و سرویس تغییر می‌کند؛ PATCH عمومی نمی‌تواند وضعیت را دور بزند.
4. تناوب نگهداری با `interval_days` (۱ تا ۳۶۵۰ روز) است؛ قاعده محاسبه: `next_due_date = last_completed_on + interval_days`، و در نبود انجام، تاریخ شروع برنامه اولین موعد است.
5. کالیبراسیون در `CalibrationRecord` نگهداری می‌شود؛ رکوردها حذف/بازنویسی نمی‌شوند. اعتبار از آخرین رکورد (`performed_on`, `id`) محاسبه می‌شود.
6. کالیبراسیون الزامی با وضعیت `missing/failed/expired` مانع `ready` شدن تجهیز است. نتیجه `failed` تجهیز را به `out_of_service` می‌برد.
7. کارهای اصلاحی باز (`planned/in_progress`) مانع `ready` شدن تجهیز هستند؛ کارهای پیشگیرانه آینده مانع نیستند.
8. حذف سخت تجهیزات و سوابق ممنوع است؛ بازنشستگی با وضعیت `retired` انجام می‌شود.
9. یکپارچگی: M2M تجهیز با Hazard و Permit؛ FK اختیاری `equipment` در Incident، Inspection و NonConformity. CAPA از مسیر NonConformity به تجهیز متصل می‌شود. همه ارتباط‌ها در سرویس/سریالایزر از نظر سازمان اعتبارسنجی می‌شوند.
10. نقش‌ها:
    - مدیریت تجهیز/برنامه: `org_admin`, `hse_manager`.
    - اجرای نگهداری/ثبت سرویس: `org_admin`, `hse_manager`, `hse_inspector`, `workshop_supervisor`.
    - ثبت کالیبراسیون: `org_admin`, `hse_manager`, `hse_inspector`.
    - مشاهده: همه اعضای فعال سازمان؛ `read_only_auditor` فقط خواندن.
11. اعلان: تخصیص دستورکار به مسئول و شکست کالیبراسیون برای سازنده/مسئول تجهیز با `notify_user`؛ audit جداگانه برای همه رویدادهای حساس.
12. فایل: آپلود فایل پیاده‌سازی نمی‌شود؛ فقط `document_reference` متنی برای ارجاع به مدرک مجاز است.

---

## ۳. وظایف وابسته

| شناسه | وظیفه | مسئول | وابستگی | فایل‌های مجاز | معیار پذیرش | وضعیت |
|---|---|---|---|---|---|---|
| P09-01 | ثبت برنامه، خط مبنا و طراحی | عامل اصلی | - | `docs/plans/PHASE-09.md` | برنامه با تسک/وابستگی/مدرک | **انجام‌شده** |
| P09-02 | مدل‌ها و مایگریشن‌های assets و اتصال‌های اختیاری | بک‌اند | P09-01 | `backend/apps/assets/models.py`, `apps.py`, `admin.py`, `migrations/`, مدل‌های incidents/inspections/findings | مدل‌ها، قیدها و مایگریشن بدون خطا | **انجام‌شده** |
| P09-03 | دسترسی، سرویس‌ها، گردش وضعیت، محاسبه موعد و کالیبراسیون | بک‌اند | P09-02 | `apps/core/access.py`, `apps/assets/services.py`, `tests.py` | قواعد سروری و آزمون‌های رفتاری | **انجام‌شده** |
| P09-04 | APIها، سریالایزرها، فیلترها، آمار، گزارش CSV و audit/notification | بک‌اند | P09-03 | `apps/assets/serializers.py`, `views.py`, `urls.py`, `apps/reports/*`, `backend/config/urls.py`, `settings.py` | endpointهای واقعی و ایزولاسیون | **انجام‌شده** |
| P09-05 | یکپارچگی اختیاری با Incident/Inspection/NonConformity | بک‌اند | P09-02 | همان مدل‌ها/سریالایزرها/ویوهای مرتبط | ارتباط سازمانی معتبر و نمایش در detail تجهیز | **انجام‌شده** |
| P09-06 | UI تجهیزات، برنامه‌ها، دستورکارها، کالیبراسیون و گزارش | فرانت‌اند | P09-04 | `frontend/src/features/assets/*`, `features/reports/ReportsPage.tsx`, `services/api.ts`, `app/App.tsx`, `layouts/AppLayout.tsx` | صفحه واقعی RTL با حالت‌های loading/error/empty | **انجام‌شده** |
| P09-07 | Seed ایمن و تکرارپذیر | بک‌اند/داده | P09-04 | `apps/incidents/management/commands/seed_demo_data.py` | داده دمو دو سازمان، بدون بازنویسی واقعی/رمز | **انجام‌شده** |
| P09-08 | تست‌های بک‌اند و فرانت‌اند | QA | P09-03..07 | `apps/assets/tests.py`, `frontend/src/features/assets/assets.test.tsx`, `test/mockApi.ts` | پوشش جداسازی، وضعیت، موعد، کالیبراسیون، audit، seed، UI | **انجام‌شده** |
| P09-09 | اجرای واقعی check/migration/test/build | عامل اصلی | P09-08 | - | خروجی واقعی موفق و ثبت‌شده | **انجام‌شده** |
| P09-10 | گزارش فنی و راهنمای دمو | مستندات | P09-09 | `docs/reports/09_asset_maintenance_calibration.md`, `PHASE-09-DEMO-GUIDE.md`, `README.md` | مستندات منطبق با رفتار واقعی | **انجام‌شده** |

---

## ۴. قرارداد API اجراشده

```text
GET/POST      /api/v1/assets/equipment/
GET/PATCH     /api/v1/assets/equipment/<pk>/          # وضعیت/کد در PATCH قابل تغییر نیست
POST          /api/v1/assets/equipment/<pk>/status/   # انتقال وضعیت کنترل‌شده
GET           /api/v1/assets/equipment/stats/         # شاخص‌ها و سررسیدها
GET/POST      /api/v1/assets/maintenance-plans/
GET/PATCH     /api/v1/assets/maintenance-plans/<pk>/
GET/POST      /api/v1/assets/maintenance-work-orders/
GET           /api/v1/assets/maintenance-work-orders/<pk>/
POST          .../<pk>/start|complete|cancel/
GET/POST      /api/v1/assets/calibrations/            # فیلتر با equipment
GET           /api/v1/assets/calibrations/<pk>/
GET           /api/v1/reports/export/assets/          # گزارش CSV سررسید/کالیبراسیون
```

فیلترهای اجراشده: `organization`, `workplace`, `category`, `status`, `search`, `calibration_status`, `due`, `equipment`, `is_active`, `result`. همه listها به سازمان‌های مجاز محدود می‌شوند و برای سازگاری با سایر صفحات MVP بدون صفحه‌بندی اجباری برمی‌گردند. فیلترهای `due` شامل `maintenance_overdue`, `maintenance_due_soon`, `calibration_expired`, `calibration_due_soon` هستند. «کالیبراسیون منقضی» بر اساس آخرین رکورد محاسبه می‌شود، نه وجود هر رکورد قدیمی.

---

## ۵. نتیجه واقعی اجرا

| بررسی | خروجی واقعی |
|---|---|
| `python manage.py check` | `System check identified no issues (0 silenced).` |
| `python manage.py makemigrations --check --dry-run` | `No changes detected` |
| `python manage.py test` | `Ran 194 tests in 586.784s — OK` |
| `npm test -- --run` | `9 files / 42 tests — OK` |
| `npm run build` | موفق؛ ۴۵ ماژول، فایل `dist/assets/index-BYvPpXkh.js` |
| `python manage.py check --deploy` | با تنظیمات توسعه: ۶ هشدار موردانتظار (DEBUG/HTTPS/cookie/SECRET_KEY)؛ با `DJANGO_DEBUG=0` و secret قوی: `System check identified no issues (0 silenced).` |
| `npm audit --audit-level=high` | `found 0 vulnerabilities` |
| `git diff --check` و `git diff --cached --check` | بدون خطای whitespace |
| Seed دوبار روی `/tmp/opencode/phase09-demo.sqlite3` | بدون تکرار رکورد؛ ۸ تجهیز، ۵ برنامه، ۳ دستورکار، ۶ کالیبراسیون |
| وضعیت Git | بدون commit/push/deploy؛ تغییرات staged فاز ۸ حفظ شد. |

---

## ۶. لاگ اجرا

| مرحله | اقدام | نتیجه |
|---|---|---|
| ۰ | بررسی Git/مستندات/معماری و خط مبنا | انجام شد؛ تغییرات staged فاز ۸ حفظ می‌شود. |
| ۱ | ثبت برنامه | همین سند |
| ۲ | مدل/مایگریشن | انجام شد؛ `assets.0001` و سه مایگریشن اتصال اختیاری ایجاد و روی پایگاه داده ایزوله اعمال شد. |
| ۳ | سرویس/API/دسترسی | انجام شد؛ گردش وضعیت، محاسبه موعد، کالیبراسیون، audit و اعلان پیاده‌سازی و آزمون شد. |
| ۴ | فرانت‌اند | انجام شد؛ صفحه RTL تجهیزات، فیلترها، KPI، فرم‌ها و جزئیات سوابق. |
| ۵ | Seed | انجام شد؛ ۸ تجهیز، ۵ برنامه، ۳ دستورکار و ۶ کالیبراسیون سنتتیک در دو سازمان. |
| ۶ | تست/بیلد/مستندات | انجام شد؛ ۱۹۳ آزمون بک‌اند، ۴۲ آزمون فرانت‌اند، build موفق و مستندات تکمیل شد. |


---

## ۷. محدودیت‌های باقی‌مانده

- سررسیدها به‌صورت lazy محاسبه می‌شوند؛ scheduler واقعی برای اعلان روزانه در این فاز اضافه نشده است.
- SQLite برای دمو/MVP مناسب است؛ بار نوشتن هم‌زمان بالا در استقرار واقعی باید با پایگاه داده قوی‌تر و پشتیبان‌گیری بررسی شود.
- آپلود فایل مدرک کالیبراسیون پیاده‌سازی نشده و فقط `document_reference` متنی ثبت می‌شود.
- کالیبراسیون توسط ارائه‌دهنده خارجی و گردش تأیید دو مرحله‌ای مستقل برای مدرک کالیبراسیون وجود ندارد.
- حذف سخت تجهیز/سابقه عمداً مسدود است؛ اصلاح خطای ثبت باید با رکورد جدید و audit انجام شود.
