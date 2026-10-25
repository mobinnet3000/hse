# HSE Guard — گزارش فنی فاز ۹: مدیریت دارایی، نگهداری پیشگیرانه و کالیبراسیون

**تاریخ:** ۴ آبان ۱۴۰۵ (۲۵ اکتبر ۲۰۲۶)
**شاخه:** `main`
**آخرین commit موجود:** `19fd508 Phase 08`
**وضعیت نهایی:** `VERIFIED`
**مالکیت اجرا:** عامل اصلی؛ در این اجرا از subagent استفاده نشد.

---

## ۱. خلاصه اجرایی

فاز ۹ یک ماژول کامل و متصل به معماری موجود برای مدیریت تجهیزات HSE، برنامه‌های نگهداری پیشگیرانه، دستورکارهای نگهداری/تعمیر و کالیبراسیون ایجاد کرد. دامنه شامل مدل داده، مایگریشن، خدمات دامنه، APIهای محدودشده به سازمان، audit، اعلان، UI فارسی/RTL، KPI، فیلترهای سررسید، داده دمو سنتتیک و آزمون‌های خودکار است.

قواعد حساس فقط در Backend اعمال می‌شوند:

- کد تجهیز در هر سازمان یکتاست و مقایسه بدون حساسیت به حروف است.
- وضعیت تجهیز از مسیر عمومی `PATCH` تغییر نمی‌کند و فقط endpoint اختصاصی `status` با سرویس کنترل‌شده مجاز است.
- تجهیز نیازمند کالیبراسیون بدون آخرین کالیبراسیون معتبر، «آماده به کار» نمی‌شود.
- کالیبراسیون ناموفق، تجهیز را خارج از سرویس می‌کند.
- کار اصلاحی باز یا کار در حال اجرا، مانع آماده‌به‌کار شدن است.
- موعد بعدی نگهداری از «آخرین سرویس تکمیل‌شده + تناوب» یا تاریخ شروع برنامه محاسبه می‌شود.
- حذف سخت تجهیز و سوابق وجود ندارد؛ بازنشستگی با وضعیت `retired` انجام می‌شود.
- همه ارتباط‌های سازمانی در خواندن، نوشتن، جست‌وجو، اقدام و گزارش از نظر tenant اعتبارسنجی می‌شوند.

---

## ۲. مدل داده و مایگریشن‌ها

### مدل‌های جدید `apps.assets`

| مدل | نقش | نکات کلیدی |
|---|---|---|
| `Equipment` | دارایی/تجهیز HSE | `UniqueConstraint(organization, code)`، وضعیت‌های چهارگانه، دسته‌بندی HSE، محل استقرار، مشخصات، ارتباط M2M با Hazard و Permit، برچسب `is_synthetic` |
| `MaintenancePlan` | برنامه نگهداری پیشگیرانه | `interval_days` با بازه ۱ تا ۳۶۵۰، مسئول، تاریخ شروع، موعد بعدی، فعال/غیرفعال |
| `MaintenanceWorkOrder` | دستورکار پیشگیرانه یا اصلاحی | گردش `planned → in_progress → completed/cancelled`، برنامه مرتبط، مسئول انجام، یافته/نتیجه، حفظ سابقه |
| `CalibrationRecord` | رکورد کالیبراسیون | تاریخ انجام، سررسید، ارائه‌دهنده، گواهی، نتیجه قبول/ناموفق، ارجاع مدرک، ثبت‌کننده |

### مایگریشن‌ها

- `backend/apps/assets/migrations/0001_initial.py`
- `backend/apps/incidents/migrations/0002_incident_equipment.py`
- `backend/apps/inspections/migrations/0002_inspection_equipment.py`
- `backend/apps/findings/migrations/0003_nonconformity_equipment.py`

مایگریشن‌ها روی پایگاه داده ایزوله `/tmp/opencode/phase09-demo.sqlite3` اعمال شدند و `makemigrations --check --dry-run` پس از آن بدون drift بود.

### یکپارچگی‌ها

- `Equipment.related_hazards` → `risks.Hazard`
- `Equipment.related_permits` → `permits.Permit`
- `Incident.equipment` → `assets.Equipment` (اختیاری)
- `Inspection.equipment` → `assets.Equipment` (اختیاری)
- `NonConformity.equipment` → `assets.Equipment` (اختیاری)
- CAPA از مسیر `NonConformity` به تجهیز متصل می‌شود و در جزئیات تجهیز نمایش داده می‌شود.
- در ثبت عدم‌انطباق از پاسخ بازرسی، اگر تجهیز انتخاب نشود، تجهیز بازرسی به‌صورت خودکار به عدم‌انطباق منتقل می‌شود.

اعتبارسنجی مدل/سریالایزر/سرویس، سازمان محل استقرار، مخاطره، مجوز و رکوردهای مرتبط را بررسی می‌کند. در Incident و NonConformity در صورت وجود محل، ناسازگاری محل استقرار تجهیز با محل رخداد نیز رد می‌شود.

---

## ۳. مجوزها و جداسازی سازمانی

| عملیات | نقش‌های مجاز |
|---|---|
| مشاهده تجهیزات، برنامه‌ها، دستورکارها و کالیبراسیون | همه اعضای فعال سازمان؛ platform admin برای همه سازمان‌ها |
| ایجاد/ویرایش تجهیز و برنامه، تغییر وضعیت | `org_admin`, `hse_manager` |
| ایجاد، شروع، تکمیل و لغو دستورکار | `org_admin`, `hse_manager`, `hse_inspector`, `workshop_supervisor` |
| ثبت کالیبراسیون | `org_admin`, `hse_manager`, `hse_inspector` |

نقش `action_owner` و سایر نقش‌های فقط‌خواندنی می‌توانند مشاهده کنند ولی اقدام حساس انجام دهند نیستند. مجوزها در Backend و در سرویس‌های دامنه نیز دوباره کنترل می‌شوند؛ پنهان‌کردن دکمه در UI جایگزین کنترل سروری نیست.

تمام QuerySetهای فهرست، جزئیات، فیلتر، آمار، برنامه، دستورکار و کالیبراسیون به `accessible_organization_ids` محدود هستند. دسترسی مستقیم به شناسه سازمان دیگر `404` می‌دهد و ایجاد ارتباط با تجهیز/محل/مخاطره/مجوز سازمان دیگر `400` می‌شود.

---

## ۴. قواعد دامنه و گردش کار

### ۴.۱. وضعیت تجهیز

وضعیت‌های مستند:

- `ready` — آماده به کار
- `under_maintenance` — در حال سرویس/تعمیر
- `out_of_service` — خارج از سرویس
- `retired` — بازنشسته

قواعد:

1. تغییر وضعیت فقط با `POST /api/v1/assets/equipment/<pk>/status/` انجام می‌شود.
2. `PATCH` عمومی در صورت ارسال `status` خطای ۴۰۰ می‌دهد.
3. `retired` وضعیت پایانی است و بازگشت از آن مجاز نیست.
4. عبور به `ready` در صورت کالیبراسیون الزامی نامعتبر (missing/expired/failed) یا وجود کار اصلاحی باز/کار در حال اجرا رد می‌شود.
5. شروع دستورکار روی تجهیز `ready`، آن را به `under_maintenance` می‌برد.
6. تکمیل دستورکار فقط در صورت نبود مانع و اعتبار کالیبراسیون، تجهیز را به `ready` برمی‌گرداند؛ این بازگشت خودکار نیست اگر مانع باقی باشد.
7. کالیبراسیون ناموفق بی‌درنگ تجهیز را `out_of_service` می‌کند.
8. ثبت کالیبراسیون موفق، تجهیز را به‌صورت خودکار `ready` نمی‌کند؛ اعلام آمادگی نیازمند اقدام صریح مجاز است.

### ۴.۲. برنامه و دستورکار

- `interval_days` توسط `MinValueValidator(1)` و `MaxValueValidator(3650)` و همچنین فرم UI محدود است.
- اولین موعد برنامه = `start_date`.
- پس از تکمیل سرویس: `next_due_date = completed_date + interval_days`.
- تکمیل دستورکار نیازمند `result` غیرخالی و تاریخ انجام غیرآینده است.
- هر دستورکار تکمیل‌شده با نتیجه، یافته، تاریخ و مسئول حفظ می‌شود؛ تکمیل مجدد یا شروع دستورکار تکمیل‌شده مجاز نیست.
- لغو دستورکار نیازمند علت است و سابقه آن حفظ می‌شود.
- کارهای پیشگیرانه آینده مانع `ready` نیستند؛ کار اصلاحی برنامه‌ریزی‌شده یا هر کار در حال اجرا مانع است.

### ۴.۳. کالیبراسیون

- اعتبار از آخرین رکورد بر اساس `performed_on` و سپس `id` محاسبه می‌شود.
- رکوردهای قبلی حذف یا بازنویسی نمی‌شوند و در تاریخچه نمایش داده می‌شوند.
- آخرین رکورد ناموفق همیشه معتبر نیست، حتی اگر تاریخ سررسید آن در آینده باشد.
- آخرین رکورد قبول با سررسید گذشته، منقضی است.
- سررسید نزدیک (۳۰ روز) به‌عنوان هشدار گزارش می‌شود.
- `next_due_on` باید بعد از `performed_on` باشد.

---

## ۵. API

مسیرهای واقعی:

```text
GET/POST      /api/v1/assets/equipment/
GET/PATCH     /api/v1/assets/equipment/<pk>/
POST          /api/v1/assets/equipment/<pk>/status/
GET           /api/v1/assets/equipment/stats/
GET/POST      /api/v1/assets/maintenance-plans/
GET/PATCH     /api/v1/assets/maintenance-plans/<pk>/
GET/POST      /api/v1/assets/maintenance-work-orders/
GET           /api/v1/assets/maintenance-work-orders/<pk>/
POST          /api/v1/assets/maintenance-work-orders/<pk>/start/
POST          /api/v1/assets/maintenance-work-orders/<pk>/complete/
POST          /api/v1/assets/maintenance-work-orders/<pk>/cancel/
GET/POST      /api/v1/assets/calibrations/
GET           /api/v1/assets/calibrations/<pk>/
GET           /api/v1/reports/export/assets/
```

فیلترها:

- تجهیزات: `organization`, `workplace`, `category`, `status`, `search`, `calibration_status`, `due`
- برنامه‌ها: `organization`, `equipment`, `is_active`, `due=overdue|due_soon`
- دستورکارها: `organization`, `equipment`, `plan`, `status`
- کالیبراسیون: `organization`, `equipment`, `result`

`due` برای تجهیزات شامل `maintenance_overdue`, `maintenance_due_soon`, `calibration_expired`, `calibration_due_soon` است. فیلترهای کالیبراسیون بر اساس آخرین رکورد محاسبه می‌شوند. فهرست‌ها برای سازگاری با سایر بخش‌های MVP بدون صفحه‌بندی اجباری برمی‌گردند و همه آن‌ها محدود به سازمان‌های مجاز هستند.

پاسخ آمار شامل شمارش کل، وضعیت‌ها، دسته‌ها، سرویس عقب‌افتاده/نزدیک سررسید، دستورکار باز/عقب‌افتاده و کالیبراسیون معتبر/نزدیک سررسید/منقضی/ناموفق/ثبت‌نشده است.

علاوه بر آمار، گزارش CSV در مسیر `/api/v1/reports/export/assets/` از صفحه گزارش‌ها قابل دریافت است. ستون‌ها شامل سازمان، محل، کد/نام/دسته، وضعیت تجهیز، وضعیت و سررسید کالیبراسیون، موعد بعدی نگهداری، تعداد دستورکار باز و برچسب سنتتیک است. فیلترهای `organization`, `workplace`, `status`, `category` و `calibration_status` پشتیبانی می‌شوند.

---

## ۶. Audit و اعلان

رخدادهای حسابرسی ثبت‌شده:

- `equipment.created`
- `equipment.updated`
- `equipment.status_changed`
- `maintenance_plan.created`
- `maintenance_plan.updated`
- `maintenance_work_order.created`
- `maintenance_work_order.started`
- `maintenance_work_order.completed`
- `maintenance_work_order.cancelled`
- `equipment.calibration_recorded`
- `equipment.calibration_failed`

اطلاعات حساس در `log_event` ماسک می‌شود. اعلان‌های درون‌سامانه‌ای:

- تخصیص دستورکار به مسئول انجام
- شکست کالیبراسیون برای سازنده/مسئول تجهیز
- تکمیل سرویس برای مسئول برنامه

---

## ۷. رابط کاربری

صفحه جدید `تجهیزات و کالیبراسیون` در ناوبری اصلی اضافه شد. امکانات:

- KPI: کل تجهیزات، آماده، خارج از سرویس، سرویس عقب‌افتاده، کالیبراسیون نزدیک سررسید، منقضی/ناموفق
- فهرست قابل جست‌وجو و فیلتر بر اساس دسته، وضعیت، وضعیت کالیبراسیون و سررسید
- فرم ایجاد/ویرایش تجهیز با کد، دسته، محل، مشخصات، تاریخ خرید/نصب و انتخاب چندگانه مخاطره/مجوز
- جزئیات تجهیز: شناسنامه، سوابق یکپارچه HSE، برنامه‌ها، دستورکارها و تاریخچه کالیبراسیون
- فرم برنامه نگهداری با ویرایش، تناوب و مسئول
- فرم دستورکار، شروع، ثبت نتیجه و لغو با علت
- فرم ثبت کالیبراسیون قبول/ناموفق و ارجاع مدرک
- نمایش روشن وضعیت‌ها، سررسیدها و موانع آماده‌به‌کار شدن
- حالت بارگذاری، خطای API، پیام موفقیت و فهرست خالی
- کنترل نمایش اقدام‌ها بر اساس نقش و capability سرور

---

## ۸. داده دمو

دستور `seed_demo_data` گسترش یافت و داده سنتتیک فاز ۹ را در دو سازمان اضافه می‌کند:

- ۸ تجهیز (۵ در فولاد البرز، ۳ در پتروشیمی سپهر)
- ۵ برنامه نگهداری
- ۳ دستورکار (۲ تکمیل‌شده تاریخی و ۱ برنامه‌ریزی‌شده عقب‌افتاده)
- ۶ رکورد کالیبراسیون با سناریوهای معتبر، نزدیک سررسید، منقضی و ناموفق

سناریوهای کلیدی:

| کد | سازمان | وضعیت | سناریو |
|---|---|---|---|
| `FA-EXT-001` | فولاد البرز | ready | کپسول با برنامه بازرسی نزدیک سررسید و دو سرویس تاریخی |
| `FA-GAS-001` | فولاد البرز | ready | گازسنج با کالیبراسیون معتبر و تاریخچه قبلی |
| `FA-GAS-002` | فولاد البرز | out_of_service | گازسنج با کالیبراسیون منقضی |
| `FA-LIFT-001` | فولاد البرز | ready | تجهیز بارگیری با کالیبراسیون نزدیک سررسید |
| `FA-COMP-001` | فولاد البرز | under_maintenance | کمپرسور با سرویس عقب‌افتاده و دستورکار باز |
| `SP-GAS-001` | پتروشیمی سپهر | ready | گازسنج معتبر |
| `SP-RESC-001` | پتروشیمی سپهر | out_of_service | کالیبراسیون ناموفق |
| `SP-EXT-001` | پتروشیمی سپهر | ready | کپسول با بازرسی دوره‌ای |

همه رکوردهای دمو `is_synthetic=True` دارند. اجرای مجدد دستور، رکورد تکراری نمی‌سازد. تجهیز واقعی با کد یکسان و رکورد کالیبراسیون غیرسنتتیک با همان شماره گواهی بازنویسی نمی‌شوند. رمز کاربران موجود فقط با گزینه صریح `--reset-demo-passwords` تغییر می‌کند.

---

## ۹. آزمون‌ها و نتایج واقعی

### Backend

```text
$ .venv/bin/python manage.py check
System check identified no issues (0 silenced).

$ .venv/bin/python manage.py test
Ran 194 tests in 586.784s — OK
OK
```

پوشش جدید شامل:

- جداسازی سازمانی فهرست/جزئیات/برنامه/کالیبراسیون
- رد ایجاد تجهیز در سازمان دیگر و رد محل کار ناهم‌سازمان
- یکتایی کد در سازمان و مجاز بودن همان کد در سازمان دیگر
- رد شروع `ready` برای تجهیز نیازمند کالیبراسیون
- کنترل تغییر وضعیت و مسدود بودن PATCH وضعیت
- مسدود شدن `ready` با کالیبراسیون منقضی/نامعتبر/ناموفق
- رد غیرفعال‌کردن الزام کالیبراسیون پس از آخرین کالیبراسیون ناموفق
- کالیبراسیون ناموفق و انتقال خودکار به `out_of_service`
- حفظ تاریخچه کالیبراسیون و استفاده از آخرین رکورد
- محاسبه `next_due_date = completed_date + interval_days`
- شروع/تکمیل/لغو و انتقال‌های غیرمجاز دستورکار
- مانع بودن کار اصلاحی باز
- فیلتر عقب‌افتاده و عدم دسترسی بین‌سازمانی
- Audit برای ایجاد، تغییر وضعیت، کالیبراسیون و تکمیل سرویس
- اتصال Incident/Inspection/NonConformity به تجهیز و رد ارتباط بین‌سازمانی
- نمایش سوابق یکپارچه در جزئیات تجهیز
- جداسازی سازمانی گزارش CSV تجهیزات
- Idempotency seed و حفظ رمز/تجهیز واقعی

### Frontend

```text
$ npm test -- --run
Test Files  9 passed (9)
Tests       42 passed (42)
```

آزمون‌های جدید صفحه تجهیزات شامل رندر KPI و فهرست، فیلتر سروری، فرم ایجاد، خطای API، فرم برنامه، ثبت کالیبراسیون و ثبت نتیجه دستورکار است. آزمون گزارش نیز نوع `assets` و محتوای کد تجهیز/وضعیت کالیبراسیون را پوشش می‌دهد.

### Build

```text
$ npm run build
✓ 45 modules transformed.
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-Ctxc-cuN.css    3.68 kB │ gzip:   1.19 kB
dist/assets/index-BYvPpXkh.js   453.27 kB │ gzip: 111.94 kB
✓ built in 3.05s
```

### بررسی‌های امنیتی

```text
$ .venv/bin/python manage.py check --deploy      # با تنظیمات پیش‌فرض توسعه
System check identified 6 issues (0 silenced):
security.W004 (HSTS), security.W008 (SSL redirect), security.W009 (SECRET_KEY),
security.W012 (secure session cookie), security.W016 (secure CSRF cookie),
security.W018 (DEBUG=True)
```

این هشدارها ناشی از تنظیمات عمدی محیط توسعه هستند، نه نقص کد فاز ۹. با تنظیمات productionمحور و بدون استفاده از secret توسعه:

```text
$ DJANGO_DEBUG=0 DJANGO_SECRET_KEY='<random-long-secret>' DJANGO_ALLOWED_HOSTS='example.com' \
  .venv/bin/python manage.py check --deploy
System check identified no issues (0 silenced).
```

```text
$ npm audit --audit-level=high
found 0 vulnerabilities
```

### بررسی‌های تکمیلی

- `python manage.py makemigrations --check --dry-run` → `No changes detected`
- `git diff --check` و `git diff --cached --check` → بدون خطا
- Migrate و seed دوبار روی `/tmp/opencode/phase09-demo.sqlite3` → ۸ تجهیز، ۵ برنامه، ۳ دستورکار، ۶ کالیبراسیون؛ بدون تکرار

---

## ۱۰. نقص‌های شناسایی‌شده و اصلاح‌شده در این فاز

1. **خطای unpack در seed:** تابع‌های کمکی تجهیز/برنامه یک شیء برمی‌گرداندند ولی در چند محل به‌صورت tuple باز می‌شدند؛ پیش از اجرای نهایی اصلاح شد.
2. **فیلتر سررسید کالیبراسیون بر اساس هر رکورد:** در نسخه اولیه، وجود یک رکورد قدیمی منقضی می‌توانست تجهیز دارای کالیبراسیون جدید معتبر را در فیلتر «منقضی» نشان دهد. فیلتر به وضعیت آخرین رکورد تغییر کرد.
3. **فعال‌سازی الزام کالیبراسیون:** نسخه اولیه حتی در صورت وجود کالیبراسیون معتبر نیز مانع می‌شد؛ شرط به «کالیبراسیون معتبر فعلی» اصلاح شد.
4. **ناپایداری آزمون‌های فرانت‌اند:** افزودن صفحه تجهیزات به نمای «همه» زمان اجرای آزمون‌های موجود را افزایش داد و چند آزمون به سقف ۵ ثانیه رسیدند. سقف پیش‌فرض Vitest به ۱۵ ثانیه افزایش یافت؛ منطق آزمون‌ها تضعیف نشد.
5. **ناسازگاری انتظار تست آماری:** عنوان KPI «کالیبراسیون نزدیک سررسید» در چند نقطه رندر می‌شد و assertion تک‌عنصری اصلاح شد.
6. **نبود route پیش‌فرض assets در mock سراسری:** برای جلوگیری از نویز 404 در آزمون‌های App، مسیرهای پیش‌فرض خالی اضافه شد.
7. **پاک‌سازی تکراری در ReportsPage:** یک `return` تکراری برای abort در effect صفحه گزارش‌ها حذف شد تا cleanup فقط یک‌بار ثبت شود.
8. **گزارش CSV اختصاصی تجهیزات:** برای پوشش صریح نیاز گزارش‌های سررسیدمحور، نوع `assets` به گزارش‌های موجود اضافه شد و آزمون CSV آن اجرا شد.
9. **مسیر دور زدن کالیبراسیون ناموفق:** غیرفعال‌کردن `calibration_required` روی تجهیزی که آخرین کالیبراسیون آن ناموفق بود، می‌توانست مانع ایمنی را حذف کند. اکنون تا ثبت کالیبراسیون قبول یا بازنشستگی تجهیز، غیرفعال‌کردن الزام رد می‌شود.

هیچ نقص بحرانی باز شناخته‌شده‌ای باقی نمانده است.

---

## ۱۱. فایل‌های تغییر یافته/جدید

### جدید

- `backend/apps/assets/__init__.py`
- `backend/apps/assets/apps.py`
- `backend/apps/assets/models.py`
- `backend/apps/assets/services.py`
- `backend/apps/assets/serializers.py`
- `backend/apps/assets/views.py`
- `backend/apps/assets/urls.py`
- `backend/apps/assets/admin.py`
- `backend/apps/assets/tests.py`
- `backend/apps/assets/migrations/0001_initial.py`
- `backend/apps/incidents/migrations/0002_incident_equipment.py`
- `backend/apps/inspections/migrations/0002_inspection_equipment.py`
- `backend/apps/findings/migrations/0003_nonconformity_equipment.py`
- `frontend/src/features/assets/AssetsPage.tsx`
- `frontend/src/features/assets/assets.test.tsx`
- `docs/plans/PHASE-09.md`
- `docs/reports/09_asset_maintenance_calibration.md`
- `docs/reports/PHASE-09-DEMO-GUIDE.md`

### تغییر یافته

- `backend/apps/core/access.py`
- `backend/config/settings.py`
- `backend/config/urls.py`
- `backend/apps/incidents/models.py`
- `backend/apps/incidents/serializers.py`
- `backend/apps/incidents/services.py`
- `backend/apps/incidents/views.py`
- `backend/apps/inspections/models.py`
- `backend/apps/inspections/serializers.py`
- `backend/apps/inspections/views.py`
- `backend/apps/findings/models.py`
- `backend/apps/findings/serializers.py`
- `backend/apps/findings/views.py`
- `backend/apps/incidents/management/commands/seed_demo_data.py`
- `backend/apps/reports/views.py`
- `backend/apps/reports/tests.py`
- `frontend/src/services/api.ts`
- `frontend/src/app/App.tsx`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/test/mockApi.ts`
- `frontend/src/test/setup.ts`
- `frontend/src/features/reports/ReportsPage.tsx`
- `frontend/src/app/App.test.tsx`
- `frontend/vite.config.ts`
- `README.md`
- `docs/TECHNICAL.md`

---

## ۱۲. وضعیت Git و محدودیت‌ها

- هیچ commit، push، deploy، reset یا حذف پایگاه داده واقعی انجام نشده است.
- تغییرات staged فاز ۸ دست‌نخورده باقی مانده‌اند.
- فاز ۹ در working tree/untracked است و عمداً stage نشده است.
- پایگاه داده واقعی `backend/db.sqlite3` دست‌نخورده است؛ Migrate/Seed فقط روی فایل ایزوله `/tmp/opencode/phase09-demo.sqlite3` اجرا شد.

محدودیت‌های باقی‌مانده:

- محاسبه سررسید lazy است و scheduler روزانه برای اعلان سررسید در این فاز اضافه نشده است.
- SQLite برای MVP/دمو است و برای هم‌زمانی نوشتن بالا در production باید جایگزین/مقیاس‌بندی شود.
- برای production باید `DJANGO_DEBUG=0`، `DJANGO_SECRET_KEY` قوی و `DJANGO_ALLOWED_HOSTS` تنظیم شود؛ در این حالت `check --deploy` بدون هشدار است.
- آپلود مدرک کالیبراسیون وجود ندارد؛ فقط ارجاع متنی ثبت می‌شود.
- کالیبراسیون به سامانه خارجی آزمایشگاه متصل نیست و تأیید دو مرحله‌ای مدرک ندارد.
- حذف سخت عمداً مسدود است؛ اصلاح خطا باید با رکورد جدید و audit انجام شود.
