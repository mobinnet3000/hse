# گزارش مهندسی فاز ۱۲: توسعه نیروی کار، شناسنامه مشاغل، مدیریت پیمانکاران و پایش حضور و غیاب شیفت

## ۱. خلاصه‌ی مدیریتی و اهداف معماری
فاز ۱۲ سامانه **HSE Guard** با هدف ارتقای جامع مدیریت نیروی انسانی و اکیپ‌های عملیاتی به سطح صنعتی پیاده‌سازی گردید. در این فاز، سه محور کلیدی به ساختار نیروی کار اضافه شد:
1. **شناسنامه مشاغل سازمانی و ماتریس انتصابات (`JobPosition`, `EmployeeJobAssignment`)**: امکان تعریف شناسنامه شغلی با سطوح ریسک چهارگانه (`low`, `medium`, `high`, `critical`)، نیازمندی‌های شایستگی، مدارک مورد نیاز و انتصاب پرسنل با تاریخ شروع/پایان و وضعیت شغل اصلی.
2. **مدیریت جامع شرکت‌های پیمانکاری و پرونده مدارک (`ContractorCompany`, `ContractorDocument`, `ContractorWorker`, `ContractorEvaluation`)**:
   - ثبت شرکت‌های پیمانکاری با وضعیت‌های چرخه عمر (`pending`, `approved`, `suspended`, `blacklisted`) و رتبه ایمنی بلادرنگ.
   - ثبت پرونده مدارک ایمنی شرکت پیمانکار (HSE Plan، بیمه‌نامه مسئولیت مدنی، گواهینامه تایید صلاحیت ایمنی و ایزو) با بررسی وضعیت انقضا و اعتبارسنجی توسط کارشناس HSE.
   - ثبت کارگران و پرسنل پیمانکار با رسته تخصصی (`trade`)، کارت ملی یکتا و وضعیت معاینات طب کار.
   - سیستم ارزیابی ادواری پیمانکار (`ContractorEvaluation`) با نمره‌دهی شاخص‌محور و **به‌روزرسانی خودکار رتبه ایمنی پیمانکار (`safety_score`)**.
3. **پایش بلادرنگ حضور و غیاب و تردد شیفت کاری (`AttendanceRecord`)**:
   - ثبت و ردیابی ورود و خروج هر دو دسته پرسنل رسمی و نیروهای پیمانکاری.
   - پشتیبانی از درگاه‌های تردد شامل گیت هوشمند (`gate_scanner`)، دستگاه بیومتریک (`biometric`)، کیوسک موبایل و ثبت دستی.
   - اندپوینت ماتریس تجمیعی شیفت (`/api/v1/workforce/attendance/roster/`) جهت محاسبه آمار بلادرنگ حاضرین، تاخیرها، غایبین و تفکیک رسمی/پیمانکار.

---

## ۲. مشخصات فنی و مدل‌های داده (Data Model)
تمام مدل‌ها در `backend/apps/workforce/models.py` پیاده‌سازی شده و از جداسازی چندمستأجری (`organization_id`)، قفل‌های کلید خارجی، و اعتبارسنجی دقیق متقابل بهره می‌برند:

| مدل | نقش عملیاتی | فیلدهای کلیدی و روابط | اعتبارسنجی‌ها و قیود یکپارچگی |
| :--- | :--- | :--- | :--- |
| `JobPosition` | شناسنامه موقعیت شغلی سازمانی | `organization`, `code`, `title`, `department`, `risk_level`, `required_competencies`, `required_qualifications`, `is_active` | `UniqueConstraint(organization, code)`، جلوگیری از حذف در صورت انتصاب فعال (`PROTECT`) |
| `EmployeeJobAssignment` | انتصاب کارمند به شغل سازمانی | `organization`, `employee`, `job_position`, `start_date`, `end_date`, `is_primary`, `notes` | تطابق مستأجر، عدم امکان تقدم تاریخ پایان بر شروع |
| `ContractorCompany` | شرکت پیمانکار همکار | `organization`, `name`, `registration_no`, `economic_code`, `contact_person`, `contact_phone`, `contact_email`, `status`, `safety_score` | `UniqueConstraint(organization, name)`، محدوده نمره ایمنی ۰ تا ۱۰۰ |
| `ContractorDocument` | مدرک و مجوز ایمنی پیمانکار | `organization`, `contractor`, `document_type`, `title`, `valid_until`, `status`, `verification_notes` | تطابق سازمانی، متد `is_expired` بر اساس تاریخ جاری |
| `ContractorWorker` | کارگر / نیروی عملیاتی پیمانکار | `organization`, `contractor`, `national_id`, `first_name`, `last_name`, `mobile`, `trade`, `is_active` | `UniqueConstraint(organization, national_id)`، تطابق سازمانی پیمانکار |
| `ContractorEvaluation` | ارزیابی ادواری عملکرد HSE پیمانکار | `organization`, `contractor`, `evaluation_date`, `score`, `criteria_scores` (JSON), `findings`, `recommendation` | آپدیت خودکار `contractor.safety_score` حین ذخیره ارزیابی |
| `AttendanceRecord` | تردد و حضور و غیاب شیفت | `organization`, `workplace`, `person_type`, `employee`, `contractor_worker`, `date`, `check_in`, `check_out`, `entry_source`, `status`, `notes` | اعتبارسنجی انحصاری پرسنل رسمی در برابر نیروی پیمانکار |

---

## ۳. امنیت، تفکیک داده سازمانی (Tenant Isolation) و احراز نقش
- تمام ویوهای بک‌اند از `TenantQuerySetMixin` یا `get_queryset()` صریح با فیلتر `organization=request.user.organization` استفاده می‌کنند.
- در متدهای `perform_create` و `perform_update`، فیلد `organization` به عنوان `read_only` تلقی شده و از سشن کاربر تاییدشده تزریق می‌گردد.
- کلیه کلیدهای خارجی اعم از کارمند، شغل، شرکت پیمانکار و کارگاه حین عملیات ایجاد در متد `clean()` از نظر تعلق به همان سازمان بررسی می‌شوند و نشت داده بین سازمان‌ها غیرممکن است.
- عملیات حذف شغل‌های دارای انتصاب فعال توسط کنترل خطای `ProtectedError` مهار شده و پیام خطای ۴۰۰ کاربرپسند فارسی تولید می‌کند.

---

## ۴. نتایج آزمون‌ها و اعتبارسنجی جامع
### بک‌اند (`Django Test Suite`):
- اجرای تست‌های ماژول `apps.workforce`:
  - **۲۲ تست فعال در فایل `apps/workforce/tests.py`**
  - زمان اجرا: **۲۰.۵ ثانیه**
  - وضعیت: **۲۲ از ۲۲ پاس (۱۰۰٪ قبولی)**
  - سناریوهای آزمون‌شده: تفکیک سازمانی مشاغل و پیمانکاران، چرخه حیات پرونده مدارک، محاسبه خودکار نمره ایمنی، مهار حذف سخت مشاغل، و تجمیع شیفت در سرویس Roster.

### فرانت‌اند (`Vitest Suite`):
- اجرای تست‌های فرانت‌اند `frontend/src/features/workforce/workforce.test.tsx`:
  - **۹ تست فعال** (شامل ۳ تست یکپارچگی جدید فاز ۱۲ برای تب‌های پیمانکاران، مشاغل و تردد شیفت)
  - کل آزمون‌های فعال پروژه فرانت‌اند: **۵۴ تست در ۱۱ فایل تست**
  - زمان اجرا: **۶.۱۵ ثانیه**
  - وضعیت: **۵۴ از ۵۴ پاس (۱۰۰٪ قبولی)**
- ساخت نهایی فرانت‌اند (`npm run build`):
  - خروجی TypeScript: **بدون هیچ‌گونه خطای تایپی (۰ خطا)**
  - ایجاد موفق Bundle بیلد تولیدی Vite.

### بذر داده دمو (`Synthetic Demo Data`):
- اجرای فرمان `python manage.py seed_demo_data --force`:
  - ایجاد ۳ شناسنامه شغلی صنعتی با نیازمندی‌های ویژه
  - ۳ انتصاب پرسنلی فعال
  - ۲ شرکت پیمانکاری (تاییدشده و در حال ارزیابی)
  - مدارک HSE Plan و بیمه‌نامه مسئولیت مدنی
  - کارگران ماهر پیمانکاری
  - ارزیابی با نمره ۹۲.۵ و به‌روزرسانی رتبه
  - رکوردهای تردد روز جاری شیفت با احراز هویت بیومتریک و تفکیک پرسنل و پیمانکار
  - تمام داده‌ها مجهز به پرچم `is_synthetic=True`.
