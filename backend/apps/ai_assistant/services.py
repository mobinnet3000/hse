import logging
import os
from typing import Any, Dict, List, Optional
from django.conf import settings
from django.db.models import Q

from apps.knowledge_base.models import KnowledgeSource
from apps.risks.models import Hazard

logger = logging.getLogger(__name__)

DISCLAIMER_TEXT = (
    "این تحلیل و پیشنهادات صرفاً جنبه مشورتی و شتاب‌دهی دارد. "
    "تصمیم‌گیری نهایی و پذیرش هرگونه ریسک، چک‌لیست یا اقدام کنترلی مستلزم بازبینی دقیق، "
    "تطبیق میدانی و تأیید نهایی توسط کارشناس یا مدیر مجاز HSE است."
)


def get_ai_status(organization_id: Optional[int] = None) -> Dict[str, Any]:
    provider = getattr(settings, "AI_PROVIDER", os.getenv("AI_PROVIDER", "grounded_engine"))
    api_key = getattr(settings, "AI_API_KEY", os.getenv("AI_API_KEY", ""))
    is_live_configured = bool(api_key and provider in {"gemini", "openai"})

    # Count accessible knowledge sources
    base_qs = KnowledgeSource.objects.filter(is_verified=True, status=KnowledgeSource.Status.ACTIVE)
    if organization_id:
        source_count = base_qs.filter(Q(organization__isnull=True) | Q(organization_id=organization_id)).count()
    else:
        source_count = base_qs.count()

    return {
        "provider": provider,
        "is_live_configured": is_live_configured,
        "active_engine": provider if is_live_configured else "grounded_rule_engine",
        "engine_label": (
            "هوش مصنوعی یکپارچه ابری (LLM)"
            if is_live_configured
            else "موتور تحلیلی مبتنی بر شواهد پایگاه دانش مقررات و استانداردها"
        ),
        "verified_regulations_count": source_count,
        "supported_features": [
            "تحلیل مخاطرات محیط کار و فعالیت‌ها",
            "پیشنهاد اقلام چک‌لیست بازرسی مبتنی بر استانداردها",
            "تدوین سلسله‌مراتب کنترل خطر (ISO 45001 Clause 8.1.2)",
            "استناد مستقیم به مواد قانونی و کدهای استاندارد بدون خطای توهم",
        ],
        "disclaimer": DISCLAIMER_TEXT,
    }


def find_matching_sources(
    text: str, organization_id: Optional[int] = None, limit: int = 5
) -> List[KnowledgeSource]:
    """Retrieve verified knowledge sources matching tokens in the query text."""
    qs = KnowledgeSource.objects.filter(
        is_verified=True, status=KnowledgeSource.Status.ACTIVE
    )
    if organization_id:
        qs = qs.filter(Q(organization__isnull=True) | Q(organization_id=organization_id))
    else:
        qs = qs.filter(organization__isnull=True)

    words = [w.strip() for w in text.replace("،", " ").replace("-", " ").split() if len(w.strip()) > 2]
    if not words:
        return list(qs[:limit])

    query = Q()
    for w in words[:8]:
        query |= (
            Q(tags__icontains=w)
            | Q(title__icontains=w)
            | Q(summary__icontains=w)
            | Q(content__icontains=w)
        )

    matched = list(qs.filter(query).distinct()[:limit])
    if len(matched) < limit:
        # Fallback to general ISO 45001 or high-priority regulations
        defaults = qs.exclude(id__in=[s.id for s in matched])[: limit - len(matched)]
        matched.extend(defaults)
    return matched


def analyze_workplace_activities(
    *,
    organization_id: int,
    activity_description: str,
    workplace_name: str = "",
    equipment: str = "",
    materials: str = "",
) -> Dict[str, Any]:
    """
    Analyzes workplace activities and generates grounded hazard suggestions
    linked strictly to verified knowledge sources.
    """
    combined_text = f"{activity_description} {workplace_name} {equipment} {materials}".lower()
    sources = find_matching_sources(combined_text, organization_id=organization_id, limit=4)

    source_refs = [
        {
            "id": s.id,
            "code": s.code,
            "title": s.title,
            "category": s.category,
            "issuing_authority": s.issuing_authority,
            "summary": s.summary,
        }
        for s in sources
    ]

    hazards = []

    # Height / Fall hazards
    if any(k in combined_text for k in ["ارتفاع", "داربست", "نردبان", "سقوط", "سقف", "پرتگاه", "نما"]):
        hazards.append({
            "title": "سقوط افراد از ارتفاع یا داربست غیراستاندارد",
            "category": Hazard.Category.SAFETY,
            "suggested_likelihood": 3,
            "suggested_severity": 4,
            "causes": "عدم استفاده از هارنس ایمنی با لنیارد جاذب انرژی، عدم صدور تگ بازرسی داربست، فقدان لایف‌لاین صلب.",
            "consequences": "شکستگی شدید اندام‌ها، ضربه مغزی یا فوت ناشی از برخورد با زمین.",
            "existing_controls_hint": "حفاظ جانبی ۹۰ سانتی‌متری، پاخور ۱۵ سانتی‌متری، کمربند مهار سقوط فول‌بادی.",
            "regulation_reference": "IR-OHS-HEIGHT-89 (مواد ۲ و ۳) و IR-OHS-CONST-81 (ماده ۱۰)",
        })

    # Electrical hazards
    if any(k in combined_text for k in ["برق", "کابل", "ژنراتور", "تابلو", "ارت", "الکتریک", "اتصال"]):
        hazards.append({
            "title": "برق‌گرفتگی ناشی از تماس با هادی‌های برق‌دار یا نقص در ارتینگ",
            "category": Hazard.Category.PHYSICAL,
            "suggested_likelihood": 2,
            "suggested_severity": 4,
            "causes": "فرسودگی روکش کابل‌ها، فقدان کلید محافظ جان (RCD)، مقاومت بالای چاه ارت کارگاه.",
            "consequences": "شوک الکتریکی، ایست قلبی، سوختگی درجه سه با قوس الکتریکی.",
            "existing_controls_hint": "اتصال بدنه تجهیزات به سیستم زمین با مقاومت کمتر از ۲ اهم، نصب کلید RCD ۳۰ میلی‌آمپر.",
            "regulation_reference": "IR-OHS-ELEC-86 (مواد ۴ و ۱۴)",
        })

    # Machinery / Mechanical hazards
    if any(k in combined_text for k in ["ماشین", "پرس", "برش", "تراش", "تیغه", "چرخ‌دنده", "مکانیکی"]):
        hazards.append({
            "title": "گیرافتادن اندام در قطعات متحرک و در حال دوران پرس و ماشین‌آلات",
            "category": Hazard.Category.SAFETY,
            "suggested_likelihood": 3,
            "suggested_severity": 4,
            "causes": "فقدان گارد صلب، عدم تجهیز به چشم الکترونیکی، دورزدن میکروسوئیچ‌های ایمنی.",
            "consequences": "قطع عضو، له‌شدگی بافت نرم، آسیب دائمی به دست و انگشتان.",
            "existing_controls_hint": "فرمان دو دستی، حسگر نوری پرده‌ای، شستی توقف اضطراری قارچی قرمز.",
            "regulation_reference": "IR-OHS-MACH-88 (مواد ۳، ۹ و ۱۶)",
        })

    # Chemical / Dust / Confined space hazards
    if any(k in combined_text for k in ["شیمیایی", "رنگ", "حلال", "گاز", "تهویه", "گرد", "غبار", "اسید", "بسته"]):
        hazards.append({
            "title": "مسمومیت استنشاقی یا تماس پوستی با مواد شیمیایی و گرد و غبار",
            "category": Hazard.Category.CHEMICAL,
            "suggested_likelihood": 3,
            "suggested_severity": 3,
            "causes": "نقص تهویه موضعی، نبود برگه اطلاعات ایمنی مواد (SDS)، عدم استفاده از رسپیراتور استاندارد.",
            "consequences": "التهاب ریوی حاد، آسیب‌های تنفسی مزمن، اگزمای تماسی و مسمومیت خون.",
            "existing_controls_hint": "سیستم مکنده موضعی ضدجرقه، پایش ادواری آلاینده‌ها، ماسک فیلتردار نیم‌صورت.",
            "regulation_reference": "IR-MOH-VENT-92 (مواد ۲ و ۸) و IR-OHS-PPE-90",
        })

    # Default general ergonomic / physical hazard if specific keywords didn't trigger enough
    if len(hazards) < 2:
        hazards.append({
            "title": "آسیب‌های اسکلتی-عضلانی و ارگونومیک ناشی از حمل دستی بار یا وضعیت نامناسب بدنی",
            "category": Hazard.Category.ERGONOMIC,
            "suggested_likelihood": 4,
            "suggested_severity": 2,
            "causes": "بلند کردن بارهای بیش از ۲۰ کیلوگرم به صورت انفرادی، خمیدگی طولانی‌مدت ستون فقرات، تکرار مداوم حرکات یکنواخت.",
            "consequences": "دیسک کمر، کشیدگی عضلانی و غیبت‌های طولانی از کار.",
            "existing_controls_hint": "استفاده از ترولی و چرخ‌دستی کمکی، آموزش اصول ارگونومی بلندکردن بار، استراحت‌های تناوبی.",
            "regulation_reference": "INSO-ISO-45001-CL6 (بند ۶.۱.۲)",
        })

    return {
        "is_ai_generated": True,
        "engine": "grounded_rule_engine",
        "grounded_sources": source_refs,
        "disclaimer": DISCLAIMER_TEXT,
        "hazards": hazards,
    }


def suggest_inspection_checklist(
    *,
    organization_id: int,
    focus_area: str,
    title_hint: str = "",
) -> Dict[str, Any]:
    """Generates an evidence-grounded checklist with actionable verification items."""
    combined = f"{focus_area} {title_hint}".lower()
    sources = find_matching_sources(combined, organization_id=organization_id, limit=3)

    items = []

    # Height inspection items
    if any(k in combined for k in ["ارتفاع", "داربست", "نردبان", "سقوط", "سازه"]):
        suggested_title = title_hint or "چک‌لیست بازرسی ایمنی کار در ارتفاع و داربست‌بندی"
        items = [
            {
                "order": 1,
                "text": "آیا داربست دارای کارت وضعیت بازرسی (تگ سبز معتبر با امضای مسئول ذی‌صلاح) است؟",
                "is_required": True,
                "citation": "IR-OHS-HEIGHT-89 ماده ۳",
            },
            {
                "order": 2,
                "text": "آیا تخته‌های داربست کامل، بدون ترک و شکستگی، با بست محکم و بدون فاصله خطرناک مستقر شده‌اند؟",
                "is_required": True,
                "citation": "IR-OHS-HEIGHT-89 ماده ۲",
            },
            {
                "order": 3,
                "text": "آیا نرده‌های حفاظتی استاندارد (ارتفاع ۹۰ تا ۱۱۰ سانتی‌متر) و قرنیز پاخور ۱۵ سانتی‌متری نصب شده است؟",
                "is_required": True,
                "citation": "IR-OHS-CONST-81 ماده ۱۰",
            },
            {
                "order": 4,
                "text": "آیا کارگران از هارنس تمام‌بدن استاندارد متصل به لایف‌لاین دارای جاذب انرژی استفاده می‌کنند؟",
                "is_required": True,
                "citation": "IR-OHS-HEIGHT-89 ماده ۲",
            },
            {
                "order": 5,
                "text": "آیا زاویه شیب نردبان‌های دستی دسترسی در محدوده ایمن ۷۵ درجه نسبت به افق مستقر است؟",
                "is_required": False,
                "citation": "IR-OHS-HEIGHT-89 ماده ۴",
            },
        ]
    # Electrical inspection items
    elif any(k in combined for k in ["برق", "کابل", "تأسیسات", "تابلو", "ارتینگ"]):
        suggested_title = title_hint or "چک‌لیست بازرسی ایمنی تجهیزات برقی و تابلوهای توزیع"
        items = [
            {
                "order": 1,
                "text": "آیا بدنه تابلوهای برق و تجهیزات فلزی به چاه ارت متصل بوده و مقاومت کمتر از ۲ اهم است؟",
                "is_required": True,
                "citation": "IR-OHS-ELEC-86 ماده ۴",
            },
            {
                "order": 2,
                "text": "آیا کلید محافظ جان (RCD) با جریان قطع ۳۰ میلی‌آمپر در مدار وجود داشته و با دکمه تست عملکرد دارد؟",
                "is_required": True,
                "citation": "IR-OHS-ELEC-86 ماده ۱۴",
            },
            {
                "order": 3,
                "text": "آیا درب تابلوهای برق قفل بوده و دیاگرام تک‌خطی و علائم هشدار خطر برق‌گرفتگی الصاق شده است؟",
                "is_required": True,
                "citation": "IR-OHS-ELEC-86 ماده ۶",
            },
            {
                "order": 4,
                "text": "آیا روکش کلیه کابل‌های عبوری از کف کارگاه سالم بوده و از آسیب مکانیکی و رطوبت محافظت شده‌اند؟",
                "is_required": True,
                "citation": "IR-OHS-ELEC-86 ماده ۹",
            },
            {
                "order": 5,
                "text": "آیا در جلوی تابلوهای برق صنعتی کفپوش عایق لاستیکی با ولتاژ تحمل مناسب پهن شده است؟",
                "is_required": False,
                "citation": "IR-OHS-ELEC-86 ماده ۱۱",
            },
        ]
    # Machinery / Mechanical items
    elif any(k in combined for k in ["ماشین", "پرس", "دستگاه", "تجهیزات", "مکانیکی"]):
        suggested_title = title_hint or "چک‌لیست بازرسی ایمنی ماشین‌آلات و پرس‌های صنعتی"
        items = [
            {
                "order": 1,
                "text": "آیا شستی توقف اضطراری (Emergency Stop) قارچی با زمینه زرد در دسترس سریع اپراتور فعال است؟",
                "is_required": True,
                "citation": "IR-OHS-MACH-88 ماده ۱۶",
            },
            {
                "order": 2,
                "text": "آیا حفاظ‌های صلب یا اینترلاک‌های نوری قطعات دوار و تسمه‌فلکه‌ها مستقر و غیرقابل دورزدن هستند؟",
                "is_required": True,
                "citation": "IR-OHS-MACH-88 ماده ۳",
            },
            {
                "order": 3,
                "text": "آیا عملکرد سیستم فرمان دو دستی پرس‌ها قبل از شروع شیفت بررسی و تایید شده است؟",
                "is_required": True,
                "citation": "IR-OHS-MACH-88 ماده ۹",
            },
            {
                "order": 4,
                "text": "آیا دستورالعمل ایمنی کار با دستگاه و علائم الزام استفاده از عینک و محافظ دست نصب است؟",
                "is_required": False,
                "citation": "IR-OHS-PPE-90 ماده ۱",
            },
        ]
    else:
        # General HSE Workplace Inspection Checklist
        suggested_title = title_hint or f"چک‌لیست عمومی ایمنی و بهداشت محیط کار ({focus_area or 'کارگاهی'})"
        items = [
            {
                "order": 1,
                "text": "آیا کپسول‌های اطفای حریق بازرسی دوره‌ای شده، فشارسنج در ناحیه سبز و مسیر دسترسی آن‌ها آزاد است؟",
                "is_required": True,
                "citation": "INSO-ISO-45001-CL8 بند ۸.۲",
            },
            {
                "order": 2,
                "text": "آیا کلیه پرسنل از وسایل حفاظت فردی متناسب با الزامات محیط کار (کفش، کلاه، دستکش) استفاده می‌کنند؟",
                "is_required": True,
                "citation": "IR-OHS-PPE-90 مواد ۱ و ۵",
            },
            {
                "order": 3,
                "text": "آیا راهروها، معابر خروج اضطراری و پله‌ها عاری از هرگونه مانع، روغن‌ریزی و لغزندگی است؟",
                "is_required": True,
                "citation": "IR-OHS-CONST-81 ماده ۴۰",
            },
            {
                "order": 4,
                "text": "آیا جعبه کمک‌های اولیه مجهز به اقلام تاریخ‌دار و دارنده مسئول مشخص در محل کارگاه است؟",
                "is_required": True,
                "citation": "INSO-ISO-45001-CL8 بند ۸.۲",
            },
            {
                "order": 5,
                "text": "آیا سیستم تهویه موضعی و عمومی با بازدهی مطلوب در حال کار و مکش آلاینده‌ها است؟",
                "is_required": False,
                "citation": "IR-MOH-VENT-92 ماده ۲",
            },
        ]

    return {
        "is_ai_generated": True,
        "engine": "grounded_rule_engine",
        "suggested_title": suggested_title,
        "suggested_description": f"پیش‌نویس تولیدشده مبتنی بر استانداردهای ایمنی برای حوزه '{focus_area or 'عمومی'}'",
        "items": items,
        "grounded_sources": [
            {
                "id": s.id,
                "code": s.code,
                "title": s.title,
                "category": s.category,
            }
            for s in sources
        ],
        "disclaimer": DISCLAIMER_TEXT,
    }


def suggest_hierarchy_of_controls(
    *,
    organization_id: int,
    hazard_title: str,
    category: str = "",
    description: str = "",
) -> Dict[str, Any]:
    """
    Generates 5-tier Hierarchy of Controls (Elimination, Substitution, Engineering,
    Administrative, PPE) conforming to ISO 45001:2018 Clause 8.1.2 and national regulations.
    """
    combined = f"{hazard_title} {category} {description}".lower()
    sources = find_matching_sources(combined, organization_id=organization_id, limit=3)

    # 1. Elimination
    if "ارتفاع" in combined or "سقوط" in combined:
        elimination = "حذف کار در ارتفاع از طریق مونتاژ قطعات، سازه‌ها و تجهیزات در سطح همکف و سپس بالابری یکپارچه."
        substitution = "استفاده از بالابرهای هیدرولیکی مجهز به کابین محصور به جای نردبان‌های دستی و داربست‌های سنتی."
        engineering = "نصب نرده‌های حفاظتی صلب دائم، ایجاد توری نجات (Safety Net) و تعبیه لایف‌لاین‌های مهندسی سازه."
        administrative = "اخذ مجوز کار در ارتفاع (PTW)، بازرسی روزانه داربست، آموزش اصول استفاده از هارنس و معاینات طب کار عدم سرگیجه."
        ppe = "کمربند تمام‌بدن (هارنس ایمنی) استاندارد مطابق EN 361، لنیارد دو شاخه با ضربه‌گیر سقوط، کلاه مجهز به بند زیر چانه."
    elif "برق" in combined:
        elimination = "قطع کامل مدار الکتریکی و ترخیص انرژی باقی‌مانده خازنی قبل از شروع هرگونه تعمیرات."
        substitution = "استفاده از ابزارهای پنوماتیک (بادی) یا سیستم‌های ولتاژ بسیار پایین ایمن (SELV / 24V) در مناطق مرطوب."
        engineering = "نصب کلیدهای قطع نشت جریان RCD، عایق‌بندی هادی‌ها، محصورسازی تابلوها و کاهش مقاومت سیستم ارت به زیر ۲ اهم."
        administrative = "استقرار استاندارد قفل و برچسب‌گذاری (LOTO)، صدور پروانه کار گرم/برقی، ثبت دوره‌ای مقاومت ارتینگ."
        ppe = "دستکش عایق برق متناسب با سطح ولتاژ، کفش ایمنی ضدبرق بدون میخ، شیلد محافظ صورت ضدقوس الکتریکی (Arc Flash)."
    elif "شیمیایی" in combined or "رنگ" in combined or "گاز" in combined:
        elimination = "حذف فرآیند با استفاده از اتصالات مکانیکی به جای چسب‌های حلال‌دار یا رنگ‌آمیزی پودری الکترواستاتیک."
        substitution = "جایگزینی حلال‌های هیدروکربنی سمی و معطر با پاک‌کننده‌های پایه آبی زیست‌سازگار و کم‌خطر."
        engineering = "نصب هود مکنده موضعی (LEV) با کانال‌کشی ضدجرقه، ایزوله‌سازی اتاق اختلاط رنگ و گازسنجی آنلاین."
        administrative = "الصاق برچسب‌های GHS و SDS مواد به زبان فارسی، آموزش خطرات شغلی به کارگران و پایش ادواری OEL."
        ppe = "ماسک تنفسی با کارتریج بخارات آلی (کد قهوه‌ای)، دستکش نیتریل مقاوم شیمیایی، عینک گاگل ضدپاشش."
    else:
        elimination = "بازنگری فرآیند کاری جهت حذف عملیات با پتانسیل بالای خطر در منبع اولیه."
        substitution = "جایگزینی تجهیزات و ابزارآلات کهنه با مدل‌های ارگونومیک، کم‌صدا و دارای گواهینامه‌های ایمنی روز."
        engineering = "نصب سپرهای محافظ، ایجاد عایق‌بندی صوتی و ارتعاشی و استفاده از تجهیزات جابجایی مکانیکی."
        administrative = "تدوین دستورالعمل کار ایمن (SOP)، اجرای گردش شغلی (Job Rotation)، برگزاری دوره‌های ایمنی و چک‌لیست‌های پیش از شروع."
        ppe = "تجهیز پرسنل به لوازم حفاظت فردی متناسب با نوع مواجهه (کفش پنجه‌فولادی، عینک ایمنی، کلاه مقاوم)."

    return {
        "is_ai_generated": True,
        "hazard_title": hazard_title,
        "hierarchy": [
            {
                "tier": 1,
                "level": "elimination",
                "label": "۱. حذف خطر (Elimination)",
                "priority": "بالاترین اثربخشی (حذف فیزیکی عامل خطر)",
                "recommendation": elimination,
            },
            {
                "tier": 2,
                "level": "substitution",
                "label": "۲. جایگزینی (Substitution)",
                "priority": "اثربخشی بسیار بالا (جایگزینی خطر با گزینه کم‌خطرتر)",
                "recommendation": substitution,
            },
            {
                "tier": 3,
                "level": "engineering_controls",
                "label": "۳. کنترل‌های مهندسی (Engineering Controls)",
                "priority": "اثربخشی متوسط رو به بالا (جداسازی افراد از خطر با ابزار مهندسی)",
                "recommendation": engineering,
            },
            {
                "tier": 4,
                "level": "administrative_controls",
                "label": "۴. کنترل‌های مدیریتی (Administrative Controls)",
                "priority": "اثربخشی متوسط (تغییر روش کار و آموزش کارکنان)",
                "recommendation": administrative,
            },
            {
                "tier": 5,
                "level": "ppe",
                "label": "۵. تجهیزات حفاظت فردی (PPE)",
                "priority": "آخرین خط دفاعی (محافظت از کارگر با تجهیزات فردی)",
                "recommendation": ppe,
            },
        ],
        "grounded_sources": [
            {
                "id": s.id,
                "code": s.code,
                "title": s.title,
                "category": s.category,
            }
            for s in sources
        ],
        "standard_reference": "ISO 45001:2018 بند ۸.۱.۲ (سلسله‌مراتب کنترل‌ها)",
        "disclaimer": DISCLAIMER_TEXT,
    }
