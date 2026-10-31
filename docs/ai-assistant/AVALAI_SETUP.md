# راهنمای راه‌اندازی و اتصال به AvalAI
## پیکربندی ارائه‌دهنده هوش مصنوعی در سامانه HSE Guard

---

## ۱. پیش‌نیازها و متغیرهای محیطی

برای اتصال به ارائه‌دهنده ابری هوش مصنوعی AvalAI، متغیرهای محیطی زیر در فایل `backend/.env` یا در تنظیمات محیط استیجینگ/پروداکشن پیکربندی می‌شوند:

```bash
# کلید امنیتی اختصاصی دریافت شده از پنل کاربری AvalAI
AVALAI_API_KEY=aa-your-actual-api-key-here

# آدرس سرور پایه API (پروتکل استاندارد OpenAI Chat Completions)
AVALAI_BASE_URL=https://api.avalai.ir/v1

# مدل زبانی مورد استفاده (پیش‌فرض: gpt-4o-mini)
AVALAI_MODEL=gpt-4o-mini

# حداکثر زمان انتظار بر حسب ثانیه (پیش‌فرض: ۴۵ ثانیه)
AVALAI_TIMEOUT=45

# تعداد تلاش مجدد در صورت بروز قطعی موقت شبکه (پیش‌فرض: ۲ مرتبه)
AVALAI_MAX_RETRIES=2

# سقف توکن‌های خروجی (پیش‌فرض: ۳۵۰۰ توکن)
AVALAI_MAX_OUTPUT_TOKENS=3500

# فعال‌سازی موتور فال‌بک آفلاین در شرایط عدم دسترسی به اینترنت (پیش‌فرض: True)
AVALAI_OFFLINE_FALLBACK=True
```

---

## ۲. بررسی وضعیت سلامت سرویس (Health Check)

جهت بررسی وضعیت اتصال و پیکربندی AvalAI در بک‌اند:
- **اندپوینت وضعیت**: `GET /api/v1/ai-assistant/assessments/service-status/`
- **پاسخ نمونه در زمان اتصال فعال**:
```json
{
  "service_status": "ready",
  "provider": "avalai",
  "base_url": "https://api.avalai.ir/v1",
  "model": "gpt-4o-mini",
  "api_key_configured": true,
  "offline_mode_allowed": true,
  "message": "سرویس هوش مصنوعی AvalAI متصل و فعال است."
}
```

- **پاسخ نمونه در حالت توسعه آفلاین یا بدون کلید**:
```json
{
  "service_status": "simulated_mock",
  "provider": "avalai",
  "base_url": "https://api.avalai.ir/v1",
  "model": "gpt-4o-mini",
  "api_key_configured": false,
  "offline_mode_allowed": true,
  "message": "کلید AvalAI پیکربندی نشده است؛ سیستم در حالت شبیه‌ساز دانش‌بنیان آفلاین عمل می‌کند."
}
```

---

## ۳. رفتار در زمان قطعی یا خطای شبکه (Fail-Safe Strategy)

1. **مکانیسم تلاش مجدد (Exponential Backoff)**: در صورت بروز خطای شبکه یا خطای ۵xx سرور AvalAI، کلاینت تا سقف `max_retries` با تأخیر تصاعدی مجدداً تلاش می‌کند.
2. **فال‌بک آفلاین اسکیما-محور**: در صورتی که اتصال به اینترنت برقرار نباشد یا سرویس در محیط ایزوله هوابند (Air-Gapped) اجرا شود و `AVALAI_OFFLINE_FALLBACK=True` باشد، یک تحلیل تخصصی و پیش‌نویس چک‌لیست معتبر بر پایه قوانین ملی حفاظت فنی به صورت درجا تولید می‌شود تا عملیات ارزیابی و بازرسی مختل نگردد.
3. **گزارش شفاف خطا**: در صورتی که حالت آفلاین غیرفعال باشد، خطای دقیق همراه با کد HTTP 502 به همراه پیام راهنما به زبان فارسی به کاربر نمایش داده می‌شود.
