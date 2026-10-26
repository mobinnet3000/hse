# HSE Guard — سامانه جامع مدیریت ایمنی، بهداشت و محیط زیست (MVP Release v1.0)

سامانه تحت وب HSE Guard برای پایش و مدیریت فرآیندهای ایمنی، ارزیابی ریسک، بازرسی‌های ادواری، ثبت عدم‌انطباق‌ها، پیگیری اقدامات اصلاحی و پیشگیرانه (CAPA)، داشبورد مدیریتی، خروجی گزارش‌ها و حسابرسی رخدادها طراحی شده است.

---

## ۱. پشته فناوری
- **Backend:** Python 3.12+ / Django 5.2 / Django REST Framework
- **Frontend:** Node.js 20+ / React 19 / TypeScript / Vite
- **پایگاه داده:** SQLite (توسعه و MVP)
- **احراز هویت:** Session-based با محافظت کامل CSRF و جداسازی چندسازمانی (Multi-Tenant)

---

## ۲. راه‌اندازی محیط توسعه (Development)

### راه‌اندازی Backend
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

#### ارتقای کاربر به مدیر پلتفرم (Platform Admin):
```powershell
python manage.py shell -c "from apps.accounts.models import User; u=User.objects.get(username='admin'); u.global_role='platform_admin'; u.save()"
```

### راه‌اندازی Frontend
```powershell
cd frontend
npm install
npm run dev
```
سامانه در آدرس `http://localhost:5173` در دسترس خواهد بود.

---

## ۳. قابلیت‌های تکمیل‌شده (فازهای ۱ تا ۱۰)

| ماژول | مسیر API | شرح عملکرد |
|---|---|---|
| **احراز هویت** | `/api/v1/auth/` | ثبت‌نام، ورود، خروج، سشن و CSRF Token |
| **سازمان‌ها و اعضا** | `/api/v1/organizations/` | مدیریت سازمان‌ها و انتساب کاربران با نقش‌های سازمانی |
| **محل‌های کار** | `/api/v1/workplaces/` | کارگاه‌ها و واحدهای عملیاتی زیرمجموعه هر سازمان |
| **خطرات و ریسک** | `/api/v1/risks/` | شناسایی خطرات، ماتریس ۵×۵، محاسبه سروری امتیاز و طبقه ریسک |
| **چک‌لیست‌ها** | `/api/v1/checklists/` | طراحی قالب‌های بازرسی و آیتم‌های دارای اولویت |
| **بازرسی‌ها** | `/api/v1/inspections/` | اجرای بازرسی، ثبت پاسخ‌ها (منطبق/نامنطبق) و نهایی‌سازی |
| **عدم‌انطباق‌ها** | `/api/v1/non-conformities/` | ثبت مستقیم یا از پاسخ‌های بازرسی، ارزیابی شدت و بستن |
| **اقدامات اصلاحی** | `/api/v1/corrective-actions/` | تخصیص به مسئول، مهلت، گردش وضعیت و تأیید اثربخشی |
| **داشبورد مدیریتی** | `/api/v1/dashboard/metrics/` | شاخص‌های تحلیلی تجمیعی تفکیک‌شده به سازمان و مهلت‌های نزدیک/گذشته |
| **گزارش‌ها و اکسل** | `/api/v1/reports/export/<type>/` | خروجی استریم CSV (سازگار با Excel) با انکودینگ UTF-8 BOM |
| **اعلان‌های درون‌سامانه‌ای**| `/api/v1/notifications/` | اعلان‌های سیستمی، تخصیص اقدام، هشدار مهلت و سررسید |
| **گزارش حسابرسی** | `/api/v1/audit-logs/` | ثبت فقط-خواندنی عملیات حساس با حذف خودکار اطلاعات محرمانه |
| **پایگاه دانش و مقررات** | `/api/v1/knowledge-base/` | مخزن قوانین، آیین‌نامه‌ها، استانداردهای ملی و دستورالعمل‌های معتبر |
| **حوادث و شبه‌حوادث** | `/api/v1/incidents/` | ثبت حوادث، شبه‌حوادث، اعمال ناایمن، تحلیل ریشه‌ای (RCA)، اتصال به CAPA و مخاطرات و پیش‌شرط‌های اختتام |
| **پروانه‌های کار و تحویل شیفت** | `/api/v1/permits/` | صدور مجوزهای کار گرم، ارتفاع، فضای بسته، حفاری، LOTO، تفکیک وظایف (SoD)، اعتبارسنجی کنترل‌ها و تحویل شیفت |
| **تجهیزات، نگهداری و کالیبراسیون** | `/api/v1/assets/` | ثبت دارایی HSE با کد یکتا، برنامه نگهداری پیشگیرانه، دستورکار سرویس/تعمیر، کالیبراسیون با تاریخچه و جلوگیری از آماده‌سازی تجهیز ناایمن، KPI، فیلترهای سررسید و گزارش CSV |
| **آموزش، صلاحیت و تجهیزات PPE** | `/api/v1/workforce/` | مدیریت پرسنل (با/بدون حساب سامانه)، دوره‌ها و نوبت‌های آموزشی، احراز صلاحیت، اتصال الزامات صلاحیت به مجوزهای پرخطر PTW، انبارداری و تحویل اتمیک تجهیزات PPE |

```powershell
# بذرپاشی مقررات ملی و استانداردهای پیش‌فرض HSE
python manage.py seed_knowledge_base

# بذرپاشی داده‌های نمایشی جامع و سناریوهای تستی چندمستأجری (با برچسب is_synthetic=True)
python manage.py seed_demo_data

# برای دموی فاز ۱۰:
python manage.py seed_demo_data
```

> **مستندات تکمیلی پیش از فاز ۱۱:**
> - [گزارش ممیزی ۱۰ فاز نخست](docs/reports/PRE_PHASE_11_PRODUCT_AUDIT.md)
> - [راهنمای جامع سناریوی دمو](docs/reports/PRE_PHASE_11-DEMO-GUIDE.md)
> - [مستندات سیستم طراحی و UI/UX](docs/reports/PRE_PHASE_11-UI-UX.md)
> - [برنامه اجرایی تکمیل محصول](docs/plans/PRE_PHASE_11_PRODUCT_COMPLETION.md)

---

## ۴. سطوح دسترسی و نقش‌ها (RBAC)

1. **مدیر پلتفرم (Platform Admin):** دسترسی به تمام سازمان‌ها، مدیریت کلان و حسابرسی جامع.
2. **مدیر سازمان (Org Admin):** مدیریت کاربران و ساختار سازمانی، تصویب ریسک، بازرسی، CAPA و گزارش‌ها.
3. **مدیر HSE (HSE Manager):** مدیریت چک‌لیست‌ها، تأیید ارزیابی ریسک، تأیید اقدامات اصلاحی، مشاهده حسابرسی.
4. **بازرس HSE (HSE Inspector):** انجام بازرسی‌های میدانی، ثبت مشاهدات و ثبت عدم‌انطباق.
5. **سرپرست کارگاه / کارشناس:** ثبت خطرات و پیگیری اقدامات مرتبط با کارگاه.
6. **مسئول اجرا (Action Owner):** مشاهده اقدامات محوله، ثبت گزارش پیشرفت و ارسال برای بررسی.
7. **حسابرس فقط-خواندنی (Read-Only Auditor):** دسترسی صرفاً خواندنی به گزارش‌ها و رویدادهای حسابرسی سازمان.

در ماژول تجهیزات، `org_admin` و `hse_manager` تجهیز/برنامه/وضعیت را مدیریت می‌کنند؛ `hse_inspector` و `workshop_supervisor` دستورکار اجرا می‌کنند؛ کالیبراسیون توسط `org_admin`، `hse_manager` و `hse_inspector` ثبت می‌شود. همه اعضای فعال می‌توانند بخوانند، اما عملیات حساس در Backend کنترل می‌شود.

---

## ۵. راهنمای استقرار واقعی (Production Deployment)

### ۱. تنظیم متغیرهای محیطی (`backend/.env`)
```env
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=یک_رشته_تصادفی_و_امن_با_حداقل_پنجاه_کاراکتر_غیرقابل_حدس
DJANGO_ALLOWED_HOSTS=hse.example.com,192.168.1.100
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SECURE_HSTS_SECONDS=31536000
FRONTEND_ORIGIN=https://hse.example.com
DATABASE_PATH=db.sqlite3
```

### ۲. اعتبارسنجی تنظیمات استقرار
دستور زیر تنظیمات امنیتی محیط عملیاتی را بررسی می‌کند:
```powershell
python manage.py check --deploy
```
نتیجه مورد انتظار: `System check identified no issues (0 silenced)`.

### ۳. تنظیمات امنیتی تعبیه‌شده
در حالت `DEBUG=False`:
- فعال‌سازی خودکار فلگ‌های `SESSION_COOKIE_SECURE=True` و `CSRF_COOKIE_SECURE=True`
- فعال‌سازی کوکی‌های `HttpOnly` با ساختار `SameSite=Lax`
- هدرهای امنیتی `HSTS (Strict-Transport-Security)` با پشتیبانی از Preload
- ممانعت از Clickjacking با `X_FRAME_OPTIONS = "DENY"`
- پالایش و ماسک‌کردن خودکار مقادیر حساس (مانند رمز عبور و توکن‌ها) در لاگ‌های حسابرسی

### ۴. ساخت بیلد فرانت‌اند
```powershell
cd frontend
npm run build
```
فایل‌های خروجی در مسیر `frontend/dist/` تولید شده و توسط وب‌سرور (مانند Nginx) سرو می‌شوند.

### ۵. زمان‌بندی بررسی مهلت‌ها و اعلان‌های خودکار
برای پایش روزانه مهلت اقدامات اصلاحی و صدور خودکار اعلان‌های سررسیدگذشته و نزدیک به سررسید، دستور مدیریتی زیر تعبیه شده است:
```powershell
python manage.py check_deadlines
```
این دستور با جلوگیری از تولید اعلان تکراری طراحی شده و در سرور عملیاتی از طریق **Cron Job** (در لینوکس) یا **Task Scheduler** (در ویندوز) اجرا می‌شود:
```cron
# نمونه زمان‌بندی روزانه در ساعت ۸:۰۰ صبح
0 8 * * * /path/to/venv/bin/python /path/to/hse/backend/manage.py check_deadlines
```
*شفاف‌سازی معماری:* سرویس صف ناهمگام (Celery/Redis) و درگاه‌های پیامک/ایمیل برای نسخه MVP اضافه نشده‌اند و این فرآیند به‌صورت استاندارد و سبک از طریق Cron زمان‌بندی می‌شود.

---

## ۶. پشتیبان‌گیری و بازیابی (Backup & Disaster Recovery)

### پشتیبان‌گیری از پایگاه داده SQLite
برای جلوگیری از تداخل حین تراکنش‌ها، پشتیبان‌گیری با دستور برخط SQLite انجام می‌شود:
```bash
# لینوکس / مک / پاورشل با دستور sqlite3
sqlite3 backend/db.sqlite3 ".backup 'backups/hse_backup_$(date +%Y%m%d_%H%M%S).sqlite3'"
```
یا با اسکریپت پایتون بدون نیاز به باینری مجزا:
```powershell
python -c "import sqlite3, shutil, datetime; con=sqlite3.connect('db.sqlite3'); bck=sqlite3.connect(f'backup_{datetime.datetime.now():%Y%m%d_%H%M}.sqlite3'); con.backup(bck); bck.close(); con.close()"
```

### پشتیبان‌گیری از فایل‌های ضمیمه (Media)
پوشه `backend/media` شامل مستندات و شواهد آپلودشده است:
```powershell
Compress-Archive -Path backend\media -DestinationPath "backups\media_backup_$(Get-Date -Format 'yyyyMMdd').zip"
```

### فرآیند بازیابی (Restore)
1. توقف وب‌سرور یا سرویس‌های متصل به پایگاه داده.
2. جایگزینی فایل `db.sqlite3` با فایل پشتیبان موردنظر.
3. بازگردانی پوشه `media/` در صورت نیاز.
4. اجرای `python manage.py migrate --check` جهت اطمینان از سلامت پایگاه داده.
5. راه‌اندازی مجدد وب‌سرور.

---

## ۷. فرامین آزمون و راستی‌آزمایی

| دستور | شرح | نتیجه واقعی |
|---|---|---|
| `python manage.py check` | بررسی سلامت کدهای جنگو | ✅ 0 issues |
| `python manage.py makemigrations --check` | بررسی نبود تغییرات مهاجرت‌نشده | ✅ No changes detected |
| `python manage.py test` | اجرای کلیه آزمون‌های بک‌اند | ✅ ۲۱۱ تست موفق |
| `npm test` | اجرای کلیه آزمون‌های فرانت‌اند | ✅ ۴۸ تست در ۱۰ فایل موفق |
| `npm run build` | کامپایل TypeScript و بیلد نهایی Vite | ✅ بدون خطا در ۱.۳ ثانیه |
| `npm audit` | بررسی آسیب‌پذیری‌های وابستگی‌های فرانت‌اند | ✅ 0 vulnerabilities |
| `python manage.py check_deadlines` | بررسی و اجرای فرمان اعلان مهلت‌ها | ✅ موفق با صدور خروجی |
