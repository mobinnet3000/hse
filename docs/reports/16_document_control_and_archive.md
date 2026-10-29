# گزارش مهندسی فاز ۱۶: کنترل مدارک، نسخه‌بندی غیرقابل‌تغییر، آرشیو امن و تصدیق مطالعه کارکنان (HSE Document Control & Secure Archive)

## ۱. خلاصه‌ی مدیریتی و اهداف معماری

فاز ۱۶ سامانه **HSE Guard** با هدف ایجاد سیستم یکپارچه، امن و چندمستأجری **کنترل مدارک، بازنگری، نسخه‌بندی غیرقابل‌تغییر و آرشیو راکد** (مطابق با استانداردهای مدیریت کیفیت و ایمنی ISO 45001 بند ۷.۵ «اطلاعات مدون»، ISO 9001 و الزامات قانونی وزارت تعاون، کار و رفاه اجتماعی) در قالب اپلیکیشن اختصاصی `backend/apps/documents/` و رابط کاربری فارسی `frontend/src/features/documents/` طراحی و پیاده‌سازی گردید.

### محورهای کلیدی پیاده‌سازی شده:
1. **شناسنامه و کدگذاری یکتای اسناد (Configurable Document Numbering)**:
   - تخصیص شماره شناسایی یکتا به ازای هر سازمان (مانند `DOC-SOP-HSE-001`).
   - تفکیک اسناد بر اساس ۱۳ دسته‌بندی استاندارد صنعتی (خط‌مشی، روش‌های اجرایی SOP، دستورالعمل‌های کاری WI، فرم‌ها و چک‌لیست‌ها، برگه‌های ایمنی مواد شیمیایی SDS، ارزیابی‌های ریسک و JSA، الگوهای مجوزهای کار PTW، گواهینامه‌ها و استانداردها، محتواهای آموزشی، گزارش‌های ممیزی و بازرسی، پرونده‌های فنی، سوابق زیست‌محیطی و سایر).
2. **سطوح محرمانگی چهارگانه (Confidentiality Hierarchy)**:
   - عمومی (`public`): قابل مشاهده برای عموم ذی‌نفعان و بازرسان.
   - داخلی سازمان (`internal`): قابل مشاهده برای تمامی کاربران احرازهویت‌شده سازمان.
   - محرمانه (`confidential`): محدود به مدیران HSE، ادمین سازمان، بازرسان، سرپرستان کارگاه، مؤلف و مالک سند.
   - به‌شدت محرمانه (`strictly_confidential`): محدود به ادمین سازمان، مدیر HSE، مؤلف سند و بازبین تعیین‌شده.
3. **چرخه حیات و ماشین حالت قانونمند (Lifecycle State Machine)**:
   - حالت‌های ۱۰ گانه: `draft` (پیش‌نویس) → `submitted` (ارسال‌شده) → `under_review` (در حال بررسی) → `approved` (تأییدشده) → `effective` (لازم‌الاجرا و جاری) → `superseded` (منسوخ با نگارش جدید) | `expired` (منقضی‌شده) | `archived` (بایگانی‌شده) | `withdrawn` (ابطال‌شده) و `rejected` (ردشده با ذکر دلیل).
4. **نسخه‌بندی غیرقابل‌تغییر (Immutable Document Versions)**:
   - نگارش‌های پیشین به هیچ عنوان رونویسی یا حذف نمی‌شوند.
   - ثبت شماره نگارش (مانند 1.0, 1.1, 2.0)، متادیتای کامل فایل (نام اصلی، سایز بر حسب بایت، نوع MIME، هش اعتبارسنجی SHA-256، کاربر بارگذار و خلاصه تغییرات Change Summary).
   - با تصویب هر نگارش جدید، نگارش مصوب قبلی به طور خودکار به وضعیت **منسوخ (Superseded)** منتقل شده و تاریخچه آن برای ممیزی قانونی محفوظ می‌ماند.
5. **مخزن امن فایل‌ها و مقابله با دسترسی غیرمجاز (Secure File Vault)**:
   - نام‌گذاری امن و غیرقابل حدس فایل‌ها در مسیر ایزوله `documents/org_<id>/<uuid>.<ext>` جهت پیشگیری قطعی از حملات پیمایش مسیر (Path Traversal) و حدس‌زدن نام فایل.
   - مسدودسازی دسترسی مستقیم رسانه‌ای (بدون Direct Media URL)؛ دانلود و پیش‌نمایش فایل‌ها صرفاً از طریق اندپوینت‌های احرازهویت‌شده جنگو و با هدر امنیتی `X-Content-Type-Options: nosniff` انجام می‌شود.
   - ثبت رویداد دانلود در لاگ حسابرسی سامانه (`apps.auditlog`).
6. **تصدیق مطالعه و رسید خواندن الکترونیک کارکنان (Read Receipts / Acknowledgment)**:
   - قابلیت تعیین الزام مطالعه برای اسناد حیاتی ایمنی (`requires_acknowledgment=True`).
   - امکان ثبت تصدیق رسمی با امضای دیجیتال کاربر ("مطالعه کردم و متعهد به اجرا هستم") همراه با ثبت مهر زمانی و یادداشت تعهد.
7. **پیوندهای فرآیندی با کلیه ماژول‌های HSE (Cross-Domain Linkage)**:
   - برقراری ارتباط بدون تکرار داده میان اسناد کنترل‌شده و پروانه‌های کار (PTW)، داربست‌ها (Scaffolds)، تجهیزات و ماشین‌آلات (Assets)، حوادث و شبه‌حوادث (Incidents)، ریسک‌ها و نمودارهای پاپیونی (BowTie)، و جنبه‌های زیست‌محیطی (Environment).
8. **داشبورد تحلیلی و شاخص‌های کلیدی (KPIs)**:
   - نمایش بلادرنگ تعداد اسناد کل، اسناد جاری، در انتظار ممیزی، اسناد سررسید بازنگری (زیر ۱۴ روز)، اسناد منقضی‌شده، اسناد راکد بایگانی و نرخ مشارکت تصدیق کارکنان.

---

## ۲. مشخصات مدل‌های داده و معماری پایگاه داده

مدل‌های داده در فایل [`backend/apps/documents/models.py`](file:///c:/Users/meck/Documents/hse/backend/apps/documents/models.py) تعریف شده و با مایگریشن `documents.0001_initial` بدون کوچک‌ترین تداخل به پایگاه داده اعمال شدند:

| مدل / کلاس | نقش و هدف | فیلدهای کلیدی | قیود و شاخص‌ها (Indexes & Constraints) |
| :--- | :--- | :--- | :--- |
| `Document` | شناسنامه اصلی سند کنترل‌شده | `organization`, `document_number`, `title`, `description`, `category`, `confidentiality`, `status`, `department`, `workplace`, `owner`, `author`, `assigned_reviewer`, `current_version`, `effective_date`, `next_review_date`, `expiry_date`, `retention_years`, `archived_at`, `archived_reason`, `archived_by`, `tags`, `requires_acknowledgment`, `is_synthetic` | `UniqueConstraint(organization, document_number)`، ایندکس‌های مرکب `(organization, status)`، `(organization, category)`، `next_review_date` و `expiry_date` |
| `DocumentVersion` | نگارش‌های تاریخی غیرقابل‌تغییر | `document`, `version_number`, `file`, `original_filename`, `file_size_bytes`, `file_hash_sha256`, `mime_type`, `change_summary`, `uploaded_by`, `status`, `reviewed_by`, `reviewed_at`, `review_notes`, `created_at` | `UniqueConstraint(document, version_number)`، ایندکس `file_hash_sha256` و `(document, status)` |
| `DocumentAcknowledgment` | ثبت تصدیق مطالعه کارکنان | `document`, `version`, `user`, `acknowledged_at`, `signature_note`, `is_synthetic` | `UniqueConstraint(document, version, user)` جهت جلوگیری از تصدیق تکراری |
| `DocumentReviewLog` | ردپای تصمیم‌گیری ممیزی | `document`, `version`, `reviewer`, `action`, `decision_reason`, `created_at` | مرتب‌سازی نزولی بر اساس زمان ثبت رویداد |
| `DocumentLink` | پیوند فرآیندی با سایر ماژول‌ها | `document`, `target_type`, `target_id`, `link_title`, `link_note`, `created_by`, `created_at` | ایندکس مرکب `(target_type, target_id)` |

---

## ۳. خدمات هسته دامنه (Domain Services)

کلیه عملیات حساس کسب‌وکار در فایل [`backend/apps/documents/services.py`](file:///c:/Users/meck/Documents/hse/backend/apps/documents/services.py) با پشتیبانی کامل از تراکنش‌های اتمیک (`@transaction.atomic`) پیاده‌سازی شده‌اند:

1. `validate_uploaded_file`:
   - اعتبارسنجی پسوند فایل بر اساس فهرست سفید مجاز (PDF, DOCX, XLSX, PPTX, TXT, تصاویر و CSV).
   - مسدودسازی قطعی پسوندهای اجرایی و اسکریپتی خطرناک (`.exe`, `.py`, `.sh`, `.bat`, `.js`, `.vbs`, `.ps1`).
   - کنترل سقف حجم فایل (حداکثر ۲۵ مگابایت).
   - محاسبه هش رمزنگاری SHA-256 به منظور تضمین تمامیت و عدم دستکاری محتوا (Tamper-Evidence).
2. `create_document_with_initial_version`:
   - بررسی عدم تکراری بودن شماره سند در محدوده سازمان.
   - ایجاد شناسنامه سند و ضمیمه اختیاری نگارش نخستین (v1.0) همراه با ثبت لاگ حسابرسی.
3. `create_document_revision`:
   - ایجاد نگارش جدید با متادیتای مستقل بدون بازنویسی نسخه‌های قبلی.
   - امکان ارسال مستقیم برای ممیزی و ارسال اعلان خودکار به بازبین تعیین‌شده.
4. `approve_document_version`:
   - کنترل سطح دسترسی ممیز/تصویب‌کننده (`HSE_MANAGER`, `ORG_ADMIN`, `assigned_reviewer`).
   - تغییر وضعیت تمام نگارش‌های مصوب قبلی به **منسوخ (Superseded)**.
   - فعال‌سازی نگارش جدید به عنوان نگارش جاری (`current_version`) و تنظیم وضعیت سند بر اساس تاریخ ابلاغ (`effective` یا `approved`).
   - ثبت لاگ رسمی تصویب و ارسال اعلان سیستمی به مؤلف و مسئول سند.
5. `reject_document_version`:
   - الزام به ذکر علت رد سند و نکات اصلاحی مورد نیاز.
   - تغییر وضعیت نگارش و سند به `rejected` و ارسال اعلان به مؤلف جهت بازنگری.
6. `archive_document` و `restore_document`:
   - بایگانی اسناد از رده خارج با ذکر اجباری دلیل بایگانی.
   - بازیابی اسناد از حالت راکد در صورت نیازهای ممیزی تاریخی.
7. `record_document_acknowledgment`:
   - ثبت مطالعه سند توسط کاربر برای نگارش فعال جاری بدون امکان ثبت تکراری.
8. `get_document_summary`:
   - محاسبه تجمیعی شاخص‌های داشبورد، دسته‌بندی‌ها و هشدارهای سررسید بازنگری.

---

## ۴. امنیت و کنترل‌های حفاظتی چندمستأجری (Multi-Tenancy)

- **ایزولاسیون کامل سازمان‌ها (Tenant Isolation)**: کوئری‌ست‌ها به طور سخت‌گیرانه با `organization_id__in=accessible_organization_ids(request.user)` فیلتر می‌شوند. کاربر سازمان الف به هیچ عنوان قادر به مشاهده، دانلود یا ویرایش اسناد سازمان ب نمی‌باشد.
- **کنترل محرمانگی در سطح شیء (Object-Level Confidentiality)**:
  - اسناد `strictly_confidential` فقط برای ادمین، مدیر HSE، مؤلف و بازبین اختصاصی قابل رویت است.
  - حتی اگر شناسه سندی از طریق حدس یا کوئری مستقیم درخواست شود، فریم‌ورک پاسخ ۴۰۴ یا ۴۰۳ استاندارد بازمی‌گرداند.
- **استریم امن فایل‌ها (Secure File Streaming)**:
  - اندپوینت `/api/v1/documents/documents/<id>/versions/<ver_id>/download/` فاقد هرگونه نشانی مستقیم فیزیکی روی دیسک است.
  - فایل به صورت استریم `FileResponse` با هدر `X-Content-Type-Options: nosniff` و نام اصلی امن بازگردانده می‌شود.
  - هر بار دانلود فایل، یک رکورد لاگ حسابرسی (`action="download_document"`) ثبت می‌نماید.

---

## ۵. داده‌های آزمایشی ترکیبی (Synthetic Demo Data)

اسکریپت فرمان [`backend/apps/incidents/management/commands/seed_demo_data.py`](file:///c:/Users/meck/Documents/hse/backend/apps/incidents/management/commands/seed_demo_data.py) با رعایت کامل تکرارپذیری، عدم تخریب داده‌های واقعی و با نشانه‌گذاری شفاف `is_synthetic=True` به ۹ سناریوی کاربردی مجهز گردید:

1. **دستورالعمل چندنگارشی (DOC-SOP-HSE-001)**: دستورالعمل کار در ارتفاع با نگارش ۱.۰ منسوخ‌شده و نگارش ۲.۰ مصوب جاری متصل به داربست‌های فاز ۱۵.
2. **پیش‌نویس در انتظار ممیزی (DOC-WI-CS-004)**: دستورالعمل ورود به فضاهای بسته با نگارش ۱.۰ در وضعیت `under_review`.
3. **مدرک ردشده با دلایل ممیزی (DOC-SOP-HOT-002)**: دستورالعمل کار گرم ردشده به دلیل عدم تکمیل ماتریس فاصله ایمنی مخازن گاز.
4. **گواهینامه در آستانه انقضا (DOC-CERT-ISO-45001)**: گواهینامه ایزو ۴۵۰۰۱ با تاریخ انقضا ۱۲ روز آینده (هشدار زرد).
5. **سابقه زیست‌محیطی منقضی‌شده (DOC-CERT-ENV-2023)**: تأییدیه پایش خروجی دودکش با تاریخ انقضای ۲۰ روز گذشته (هشدار قرمز).
6. **گزارش به‌شدت محرمانه (DOC-CONF-INV-2026-09)**: گزارش فنی و حقوقی RCA سقوط سرباره با سطح محرمانگی `strictly_confidential`.
7. **طرح واکنش در شرایط اضطراری دارای تصدیق پرسنل (DOC-ERP-PLAN-001)**: طرح ERP همراه با ثبت تصدیق مطالعه رسمی توسط سرپرست و بازرس.
8. **سند بایگانی‌شده با تاریخچه کامل (DOC-LEGACY-WASTE-2019)**: آیین‌نامه تفکیک پسماند سال ۱۳۹۸ بایگانی‌شده به همراه دلایل خروج از رده.
9. **ایزولاسیون بین‌سازمانی (PETRO-SOP-POLY-01)**: دستورالعمل واحد پلیمریزاسیون پتروشیمی سپهر، غیرقابل رویت در مجتمع فولاد البرز.

---

## ۶. رابط کاربری فرانت‌اند (React / TypeScript / Persian RTL)

در مسیر `frontend/src/features/documents/` مجموعه‌ای از کامپوننت‌های مدرن و هماهنگ با دیزاین سیستم پیاده‌سازی شدند:
- **[`DocumentsPage.tsx`](file:///c:/Users/meck/Documents/hse/frontend/src/features/documents/DocumentsPage.tsx)**: صفحه اصلی شامل ۶ کارت شاخص آماری، زبانه فیلترهای سریع (همه، جاری، در انتظار ممیزی، پیش‌نویس، سررسید/منقضی، بایگانی راکد)، فیلدهای جستجوی متنی، فیلتر دسته‌بندی، محرمانگی، جدول جامع اسناد با برچسب‌های رنگی استاندارد و دکمه‌های عملیاتی سریع.
- **[`CreateDocumentModal.tsx`](file:///c:/Users/meck/Documents/hse/frontend/src/features/documents/CreateDocumentModal.tsx)**: مودال ثبت شناسنامه و بارگذاری فایل ضمیمه نگارش اولیه با کنترل‌های اعتبارسنجی فرمت و حجم.
- **[`DocumentDetailModal.tsx`](file:///c:/Users/meck/Documents/hse/frontend/src/features/documents/DocumentDetailModal.tsx)**: مودال جامع شناسنامه سند با ۵ زبانه مجزا (شناسنامه و دانلود فایل، تاریخچه نگارش‌ها و مقایسه هش‌ها، فرآیند ممیزی و تصمیمات، تصدیق‌های مطالعه کارکنان با دکمه ثبت امضا، و پیوندهای فرآیندی با سایر ماژول‌ها).
- **[`ReviewDocumentModal.tsx`](file:///c:/Users/meck/Documents/hse/frontend/src/features/documents/ReviewDocumentModal.tsx)**: مودال ممیزی جهت انتخاب تصویب یا رد سند، اجبار به ثبت دلیل برای رد، و تنظیم تاریخ‌های ابلاغ و بازنگری.
- **[`UploadRevisionModal.tsx`](file:///c:/Users/meck/Documents/hse/frontend/src/features/documents/UploadRevisionModal.tsx)**: بارگذاری نگارش جدید همراه با ثبت شماره ویرایش و خلاصه تغییرات.
- **[`ArchiveDocumentModal.tsx`](file:///c:/Users/meck/Documents/hse/frontend/src/features/documents/ArchiveDocumentModal.tsx)**: بایگانی راکد مدرک با الزام به ذکر دلیل قانونی یا فنی.
- **ناوبری یکپارچه**: افزودن برگه «کنترل مدارک و آرشیو» در نوار کناری ([`Sidebar.tsx`](file:///c:/Users/meck/Documents/hse/frontend/src/components/layout/Sidebar.tsx))، عنوان هدر ([`Header.tsx`](file:///c:/Users/meck/Documents/hse/frontend/src/components/layout/Header.tsx))، و ساختار روتینگ نرم‌افزار ([`App.tsx`](file:///c:/Users/meck/Documents/hse/frontend/src/app/App.tsx)).

---

## ۷. کارنامه آزمون‌ها و اعتبارسنجی نهایی (Verification Gate)

| لایه آزمون | دستور اجرا | تعداد آزمون‌ها | وضعیت | جزئیات عملکرد |
| :--- | :--- | :--- | :--- | :--- |
| **سلامت سیستمی جنگو** | `python backend/manage.py check` | بررسی سیستمی | **Pass (0 issues)** | بدون هیچ خطا یا اخطار خاموش‌شده |
| **انطباق مایگریشن‌ها** | `python backend/manage.py makemigrations --check --dry-run` | بررسی انحراف مدل‌ها | **Pass (No changes)** | انطباق ۱۰۰٪ مدل‌ها با مایگریشن‌ها |
| **آزمون‌های متمرکز اسناد** | `python backend/manage.py test apps.documents` | ۱۵ تست | **Pass (15/15)** | پوشش کامل اعتبارسنجی فایل، یکتایی شماره، نسخه‌بندی، ممیزی، محرمانگی و دانلود امن |
| **رگرسیون کامل بک‌اند** | `python backend/manage.py test apps.*` | **۲۴۴ تست** | **Pass (244/244)** | پاس شدن ۱۰۰٪ تمام تست‌های پیشین و جدید بدون هیچ رگرسیون |
| **تست‌های واحد فرانت‌اند** | `npm test -- --run` | **۷۰ تست در ۱۴ سوئیت** | **Pass (70/70)** | پاس شدن کامل تست‌های Vitest شامل ۴ تست اختصاصی اسناد |
| **بیلد نهایی فرانت‌اند** | `npm run build` | تایپ‌اسکریپت و Vite | **Pass (Clean Build)** | تولید بسته بدون کوچک‌ترین خطای تایپ‌اسکریپت در ۲ ثانیه |
| **تکرارپذیری دیتای دمو** | `python backend/manage.py seed_demo_data` | ۲ بار اجرای متوالی | **Pass (Exit Code 0)** | اجرای اتمیک و ۱۰۰٪ تکرارپذیر بدون رونویسی داده‌های واقعی |
| **بررسی گیت و فرمت** | `git diff --check` | خطوط و فاصله‌ها | **Pass (Clean)** | بدون خطای فضای خالی در انتهای فایل‌ها |

**نتیجه نهایی دروازه کنترل کیفیت: تأیید قطعی و مستند (VERIFIED)**
