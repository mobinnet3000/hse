# HSE Guard Enterprise — Master Architecture & Phase Execution Roadmap (v2)
## نقشه کلان معماری و فازبندی اجرایی نرم‌افزار جامع HSE (نسخه ۲)

این سند مرجع اصلی مهندسی نرم‌افزار، زیرساخت ارتباطی ۲۰ ماژول و دستورالعمل اجرایی فازبندی ماژول **مدیریت ریسک (Risk Management)** به همراه زیرساخت ارتباطات بین‌ماژولی و زیربنای ورود به ماژول‌های بعدی است.

---

## ۱. ساختار کلان ۲۰ ماژول HSE و ماتریس ارتباطات

طبق ماتریس جامع ارتباطات سامانه، ۲۰ ماژول به صورت زیر تعریف شده و ساختار تبادل داده میان آن‌ها یکپارچه می‌گردد:

| ردیف | نام ماژول | نام انگلیسی | ورودی‌های اصلی (Inputs) | پردازش و منطق هسته | خروجی‌های اصلی (Outputs) | مقاصد اصلی خروجی (Destinations) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **مدیریت ریسک** | **Risk Management** | فعالیت‌ها، تجهیزات، مواد، حوادث، بازرسی‌ها، MOC، ناهنجاری‌ها (Anomaly)، الزامات قانونی | ارزیابی ریسک اولیه، فعلی و باقیمانده بر اساس ابعاد ۴ گانه (HAER)، شناسایی سناریوها، موانع کنترلی | **Risk Register**، امتیازات ریسک، اقدامات اصلاحی/تکمیلی (Treatment)، لیست کنترل‌ها | PTW, Incident, Inspection, Training, PPE, Equipment, Occupational Health, MOC, Environmental, Chemical, Emergency, Strategic, KPI, Dashboard |
| **2** | مدیریت حوادث | Incident Management | گزارش حادثه، شبه‌حادثه، آسیب، خسارت، شواهد بررسی | طبقه‌بندی حادثه، تحلیل علل ریشه‌ای (RCA)، متدولوژی‌های ۵Why/Tripod | Incident Register، علل ریشه‌ای، درس‌آموخته‌ها، رویداد محیطی | Risk, Training, Emergency, Audit, KPI, Safety Culture, Environmental, Dashboard, Anomaly |
| **3** | مدیریت مجوز کار | Permit to Work (PTW) | درخواست کار، JSA، ارزیابی ریسک، صلاحیت افراد، وضعیت تجهیزات و مواد | بررسی تداخلات (SIMOPS)، شروط ایمنی، ایزولاسیون (LOTO)، تأییدیه‌ها | مجوز کار معتبر، شرایط ایمن، محدودیت‌ها، تعلیق و ابطال | Risk, Incident, Inspection, Equipment, Chemical, KPI, Dashboard |
| **4** | مدیریت بازرسی | Inspection Management | برنامه بازرسی، چک‌لیست، الزامات، ریسک‌ها، وضعیت تجهیزات، Anomaly | اجرای بازرسی دوره‌ای، ثبت شواهد، امتیازدهی، تشخیص انحرافات | گزارش بازرسی، یافته‌ها، نقص‌ها، عدم‌انطباق‌ها و اقدامات اصلاحی | Risk, Incident, Contractor, Equipment, Audit, KPI, Anomaly, Dashboard |
| **5** | آموزش و شایستگی | Training & Competency | الزامات شغلی، ماتریس شایستگی، ریسک‌ها، حوادث، Anomaly، الزامات PTW | نیازسنجی آموزشی، آزمون شایستگی، صدور و کنترل انقضای گواهینامه‌ها | سوابق آموزش، ارزیابی شایستگی، گواهینامه‌ها، صلاحیت افراد | Risk, PTW, Contractor, Incident, Emergency, KPI, Safety Culture, Strategic, Dashboard |
| **6** | مدیریت HSE پیمانکاران | Contractor HSE | اطلاعات پیمانکار، قرارداد، سوابق حوادث، آموزش، ریسک، بازرسی و ممیزی | پیش‌ارزیابی صلاحیت، رتبه‌بندی ریسک پیمانکار، پایش انطباق حین کار | ارزیابی و رتبه‌بندی پیمانکار، تأیید صلاحیت، گزارش عدم‌انطباق | PTW, Risk, Inspection, Training, Audit, KPI, Strategic, Anomaly, Dashboard |
| **7** | مدیریت محیط زیست | Environmental Management | فعالیت‌ها، پسماند، مصرف آب و انرژی، انتشار آلاینده‌ها، پایش، Anomaly | ارزیابی جنبه‌ها و پیامدهای زیست‌محیطی، تطبیق با حدود مجاز استاندارد | جنبه‌ها و پیامدهای زیست‌محیطی، شاخص‌های کربن و پسماند، عدم‌انطباق | Risk, Incident, Emergency, Audit, KPI, Strategic, Anomaly, Dashboard |
| **8** | بهداشت حرفه‌ای | Occupational Health | عوامل زیان‌آور (فیزیکی، شیمیایی، بیولوژیکی، ارگونومی)، اطلاعات شغلی، طب کار | پایش مواجهه شغلی، ماتریس تناسب شغلی (Fitness for Work)، پرونده سلامت | ارزیابی مواجهه، محدودیت‌های کاری پزشکی، کنترل‌های بهداشتی | Risk, Training, PPE, Contractor, Strategic, KPI, Anomaly, Dashboard |
| **9** | مدیریت شرایط اضطراری | Emergency Management | سناریوهای اضطراری، ریسک‌ها، مواد خطرناک، حوادث، تجهیزات و منابع | تدوین طرح واکنش اضطراری (ERP)، مدیریت سناریو و ارزیابی مانورها | طرح واکنش اضطراری، نتایج مانورها، سطح آمادگی، کمبود منابع | Risk, Incident, Training, Equipment, Environmental, Chemical, KPI, Dashboard, Anomaly |
| **10** | مدیریت تجهیزات حفاظت فردی | PPE Management | الزامات ریسک، مواجهه، شغل، سلامت حرفه‌ای، موجودی و نقص PPE | ماتریس انطباق PPE با خطرات، دوره عمر، مصرف و ثبت عیوب | ماتریس توزیع PPE، سوابق تحویل، کنترل موجودی و تاریخ انقضا | Risk, Occupational Health, Training, Contractor, Inspection, KPI, Anomaly, Dashboard |
| **11** | مدیریت تجهیزات و ماشین‌آلات | Equipment & Machinery | فهرست تجهیزات، مشخصات فنی، سوابق تعمیرات، بازرسی، گواهی‌ها | پایش سلامت فنی، کالیبراسیون، صدور مجوز بهره‌برداری، بازرسی دوره‌ای | وضعیت سلامت تجهیز، تأییدیه فنی، مجوز بهره‌برداری، هشدار نقص | Risk, PTW, Inspection, Incident, Emergency, MOC, KPI, Anomaly, Dashboard |
| **12** | ممیزی و انطباق | Audit & Compliance | استانداردها (ISO 45001/14001)، قوانین ملی، قراردادها، حوادث | ممیزی انطباق قانونی، شناسایی شکاف‌ها (Gap Analysis)، پیگیری CAPA | گزارش ممیزی، عدم‌انطباق‌های سیستمی، شکاف قانونی، فرصت‌های بهبود | Risk, Document, Contractor, Inspection, Strategic, KPI, Anomaly, Dashboard |
| **13** | شاخص‌های عملکرد HSE | HSE KPI | داده‌های حوادث، ریسک، Anomaly، بازرسی، ممیزی، آموزش، پیمانکار، سلامت | محاسبه شاخص‌های پیشرو (Leading) و پسرو (Lagging) نظیر AFR, ASR, LTIFR | فرمول و روند شاخص‌ها، تحلیل انحراف از تارگت، هشدارهای خودکار | Risk, Strategic, Contractor, Management Dashboard |
| **14** | کنترل مستندات | Document Control | خط‌مشی‌ها، استانداردها، روش‌های اجرایی (SOP)، دستورالعمل‌ها، فرم‌ها | کنترل نسخه‌ها، چرخه تأیید اسناد، مدیریت دسترسی، بایگانی امن | نسخه معتبر اسناد، سوابق بازنگری، هشدار انقضا، توزیع کنترل‌شده | تمام ماژول‌ها و نمایش در Dashboard |
| **15** | فرهنگ ایمنی | Safety Culture | رفتارهای ایمن/ناایمن، مشاهدات، نظرسنجی و مشارکت کارکنان | تحلیل رفتار ایمن (BBS)، سنجش بلوغ فرهنگ ایمنی، برنامه‌های تشویقی | شاخص فرهنگ ایمنی، تحلیل الگوهای رفتاری، مداخلات ارتقای فرهنگ | Risk, Incident, Training, Strategic, KPI, Anomaly, Dashboard |
| **16** | مدیریت مواد شیمیایی | Chemical Management | فهرست مواد، برگه اطلاعات ایمنی (SDS)، خطرات، محل نگهداری | دسته‌بندی خطرات بر اساس GHS، ارزیابی سازگاری شیمیایی، کنترل نشت | طبقه‌بندی خطر، الزامات نگهداری و سازگاری، هشدار مواجهه و نشت | Risk, Occupational Health, PPE, Emergency, PTW, Environmental, MOC, Anomaly, Dashboard |
| **17** | مدیریت تغییرات (MOC) | Management of Change (MOC) | درخواست تغییر در فرآیند، تجهیزات، مواد، نیروی انسانی، دستورالعمل‌ها | ارزیابی ریسک تغییر، تأییدیه‌های چندمرحله‌ای، اقدامات پیش از راه‌اندازی | ارزیابی ریسک تغییر، تأییدیه‌ها، چک‌لیست قبل اجرا، الزامات اصلاح سند | Risk, PTW, Equipment, Training, Document, Emergency, Chemical, Dashboard |
| **18** | مدیریت راهبردی HSE | Strategic HSE Management | شاخص‌های کلان، بودجه، ریسک‌های کلان، حوادث، ممیزی، قوانین | تحلیل SWOT و ریسک‌های استراتژیک، هدف‌گذاری کلان و تخصیص منابع | اهداف کلان سالانه، برنامه‌های راهبردی، اولویت‌ها و بودجه مصوب | تمام ماژول‌ها، به‌ویژه KPI و Dashboard |
| **19** | مدیریت گزارش ناهنجاری‌ها | Anomaly Report Management | شرایط ناایمن، رفتار ناایمن، انحراف از روش اجرایی، نقص تجهیزات/PPE | ثبت سریع رویداد، اولویت‌بندی بر اساس ریسک، ارجاع به اقدام اصلاحی | Anomaly Register، طبقه‌بندی علل، ارزیابی ریسک بالقوه، اقدامات فوری | Risk, Incident, Inspection, Training, Contractor, Occupational Health, PPE, Emergency, Environmental |
| **20** | داشبورد مدیریتی | Management Dashboard | تجمیع آنلاین داده‌های ۱۹ ماژول دیگر (KPI, ریسک، حادثه، اقدام و ...) | تحلیل‌های داده‌محور، نمایش گرافیکی روندها، هوش تجاری (BI) | داشبوردهای تعاملی، گزارش‌های مقایسه‌ای، هشدارها و قابلیت Drill-down | مدیران ارشد، مدیران HSE، مدیران پروژه و سرپرستان |

---

## ۲. الگوهای تبادل داده و قوانین معماری زیرساخت

### الف) ۶ نوع تبادل اطلاعات در نرم‌افزار
1. **مستقیم (Direct):** انتقال همزمان داده در یک تراکنش (مثلاً استخراج الزامات کنترلی ارزیابی ریسک در صدور PTW).
2. **خودکار (Automatic):** ارسال رویداد و به‌روزرسانی بدون مداخله کاربر (مثلاً محاسبه مجدد KPIها پس از ثبت حادثه).
3. **تأییدمحور (Approval-Based):** اعمال اثرات ماژول پس از تصویب مراجع ذی‌صلاح (مثلاً تغییر ارزیابی ریسک پس از تأییدیه MOC).
4. **دوسویه (Bidirectional):** تبادل پویا در هر دو جهت (مثلاً بین Equipment و Inspection برای ثبت سوابق بازرسی و هشدار نقص فنی).
5. **تحلیلی (Analytical):** ارسال داده‌های تجمعی به موتور هوش مصنوعی یا سیستم تحلیل داده و دریافت خروجی‌های پیش‌بینانه.
6. **اعلان‌محور (Event-Based):** تریگر شدن بر اساس وقوع رخداد خاص (مثلاً انتقال از Incident به Emergency در صورت حوادث بحرانی سطح ۳).

### ب) ۴ اصل معماری بنیادین
1. **اطلاعات پایه مشترک (Single Source of Truth):** هویت سازمان، واحدها، پروژه‌ها، پرسنل، پیمانکاران، تجهیزات و مواد شیمیایی در ماژول‌های مجزا تکثیر نمی‌شوند؛ بلکه به موجودیت‌های مرجع متصل می‌گردند.
2. **جلوگیری از اطلاعات تکراری و افزونگی (Zero Redundancy):** داده‌های مرزی با ارجاع (Foreign Key / UUID) و رویدادهای همگام‌ساز مدیریت می‌شوند. ثبت یک حادثه مستقیماً فرم ارزیابی ریسک مرتبط را آپدیت می‌کند.
3. **زنجیره ردیابی جامع (Traceability Chain):** تمام وقایع باید قابلیت ردیابی متوالی داشته باشند:
   $$\text{Incident ID} \longrightarrow \text{Risk ID} \longrightarrow \text{CAPA ID} \longrightarrow \text{Verification ID}$$
4. **مالکیت داده و تفکیک دسترسی (RBAC & Tenant Isolation):** داده‌های حساس به‌ویژه در بهداشت حرفه‌ای (پرونده‌های پزشکی و بیماری‌ها) دارای رمزنگاری و ایزولاسیون دسترسی هستند و ماژول‌های دیگر صرفاً وضعیت عملیاتی (مثل محدودیت کاری مجاز) را دریافت می‌کنند.

---

## ۳. نقشه فازهای اجرایی ماژول مدیریت ریسک (Risk Management)

برای پیاده‌سازی گام‌به‌گام و تضمین اینکه زیرساخت این ماژول برای تمامی ماژول‌های بعدی آماده است، پوشه `docs/v2_engineering_prompts/` به شرح زیر طراحی و فایل‌بندی شده است:

```
docs/v2_engineering_prompts/
├── 00_MASTER_ROADMAP.md                     <-- این سند (سند مرجع کلان معماری)
├── PHASE_01_SHARED_CORE_AND_TRACEABILITY.md  <-- زیرساخت داده‌های مشترک، باس رویداد و زنجیره ردیابی
├── PHASE_02_RISK_REGISTER_DOMAIN_MODELS.md  <-- مدل‌های ده‌مرحله‌ای دیتا مدل Risk Register (HAER)
├── PHASE_03_RISK_ENGINE_LOGIC_AND_API.md    <-- موتور محاسبات RPN، ماتریس ریسک و اندپوینت‌های API
├── PHASE_04_INTER_MODULE_COMMUNICATION_MATRIX.md <-- پیاده‌سازی اتصالات ۱۹ ماژول دیگر با ماژول ریسک
├── PHASE_05_FRONTEND_ENTERPRISE_RISK_UX.md  <-- فرانت‌اند React/TypeScript، ویزارد ۱۰ مرحله‌ای و هیت‌مپ
└── PHASE_06_VERIFICATION_TESTING_AND_SECURITY.md <-- تست‌های جامع، ایزولاسیون امنیتی و دیتای نمایشی
```

---

## ۴. ماتریس تخصیص ساب‌ایجنت‌ها و اسکیل‌ها (Subagent & Skill Matrix)

| فاز | ساب‌ایجنت مسئول (Subagent Role) | اسکیل‌های کلیدی مورد استفاده | خروجی ملموس |
| :--- | :--- | :--- | :--- |
| **فاز ۱** | `Core Platform & Event Architect` | `backend`, `python-backend`, `database-architect`, `database-schema-design`, `system-designer`, `event-architect` | پکیج `apps.core.traceability`، موتور `hse_event_bus`، مدل‌های پایه اشتراکی |
| **فاز ۲** | `Domain Data Modeler & DB Architect` | `python-backend`, `database-architect`, `database-schema-design`, `database-migrations` | بازآفرینی کامل `apps/risks/models.py` شامل ۱۰ مرحله استاندارد |
| **فاز ۳** | `Backend API & Calculation Engine Specialist` | `python-backend`, `api-design`, `api-designer`, `error-handling`, `code-quality` | موتور محاسبه $RPN=L \times S$ برای ابعاد HAER، چرخه‌عمر اسناد و APIهای REST |
| **فاز ۴** | `Integration & Distributed Bus Engineer` | `system-designer`, `microservices-patterns`, `event-architect`, `websocket-realtime` | سینک مستقیم و رویدادمحور ماژول ریسک با حوادث، بازرسی، PTW، پرسنل و داشبورد |
| **فاز ۵** | `Frontend & RTL UX Engineering Specialist` | `frontend`, `react-patterns`, `forms-validation`, `tailwind-ui`, `ui-design`, `ux-design` | ویزارد ۱۰ مرحله‌ای فارسی RTL، ماتریس تعاملی ۵×۵ و کامپوننت ردیابی زنجیره |
| **فاز ۶** | `QA, Security & Audit Specialist` | `test-architect`, `testing-strategies`, `testing-automation`, `security-hardening`, `security-owasp` | ۳۰+ تست جدید بک‌اند و فرانت‌اند، ممیزی امنیتی OWASP و لود دیتای صنایع نفت/گاز/معدن |
