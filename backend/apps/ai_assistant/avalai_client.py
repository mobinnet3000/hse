import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Tuple

from config.settings import env_bool

logger = logging.getLogger(__name__)


class AvalAIError(Exception):
    """Base exception for AvalAI integration failures."""
    pass


class AvalAIConfigurationError(AvalAIError):
    pass


class AvalAIConnectionError(AvalAIError):
    pass


class AvalAIRateLimitError(AvalAIError):
    pass


class AvalAIResponseError(AvalAIError):
    pass


def get_avalai_config() -> Dict[str, Any]:
    return {
        "api_key": os.getenv("AVALAI_API_KEY", "").strip(),
        "base_url": os.getenv("AVALAI_BASE_URL", "https://api.avalai.ir/v1").strip().rstrip("/"),
        "model": os.getenv("AVALAI_MODEL", "deepseek-v4.1-flash").strip() or "deepseek-v4.1-flash",
        "timeout": int(os.getenv("AVALAI_TIMEOUT", "90")),
        "max_retries": int(os.getenv("AVALAI_MAX_RETRIES", "2")),
        "enabled": env_bool("AVALAI_ENABLED", True),
        "max_output_tokens": int(os.getenv("AVALAI_MAX_OUTPUT_TOKENS", "8000")),
    }


def get_avalai_service_status() -> Dict[str, Any]:
    cfg = get_avalai_config()
    key = cfg["api_key"]
    has_key = bool(key and key != "<TEST_KEY_PLACEHOLDER>")
    masked_key = f"{key[:3]}...{key[-3:]}" if has_key and len(key) >= 8 else ("تنظیم‌نشده" if not has_key else "***")
    
    return {
        "provider": "AvalAI (شبکه پردازش هوش مصنوعی)",
        "enabled": cfg["enabled"],
        "base_url": cfg["base_url"],
        "configured_model": cfg["model"],
        "has_api_key": has_key,
        "masked_api_key": masked_key,
        "timeout_seconds": cfg["timeout"],
        "max_retries": cfg["max_retries"],
        "max_output_tokens": cfg["max_output_tokens"],
        "status": "ready" if (cfg["enabled"] and has_key) else ("unconfigured" if not has_key else "disabled"),
    }


def test_avalai_connection() -> Dict[str, Any]:
    """
    Sends a lightweight test ping to AvalAI to verify API key validity, latency, and model availability.
    """
    cfg = get_avalai_config()
    api_key = cfg["api_key"]
    if not api_key or api_key == "<TEST_KEY_PLACEHOLDER>":
        return {
            "success": False,
            "latency_ms": 0.0,
            "status": "unconfigured",
            "message": "کلید دسترسی AvalAI (AVALAI_API_KEY) در سرور تنظیم نشده است. سیستم در حال حاضر از شبیه‌ساز آفلاین استفاده می‌کند.",
            "model": cfg["model"],
            "base_url": cfg["base_url"],
        }

    endpoint_url = f"{cfg['base_url']}/chat/completions"
    payload = {
        "model": cfg["model"],
        "messages": [
            {"role": "user", "content": "پاسخ تک کلمه‌ای بده: آنلاین"}
        ],
        "thinking": {"type": "disabled"},
        "max_tokens": 50,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    t0 = time.time()
    try:
        req = urllib.request.Request(endpoint_url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=12) as res:
            duration_ms = round((time.time() - t0) * 1000, 1)
            body = res.read().decode("utf-8")
            data = json.loads(body)
            msg = data.get("choices", [{}])[0].get("message", {})
            reply = (msg.get("content") or msg.get("reasoning_content") or "آنلاین").strip()
            return {
                "success": True,
                "latency_ms": duration_ms,
                "status": "connected",
                "message": f"ارتباط با سرور AvalAI با موفقیت برقرار شد. زمان پاسخ: {duration_ms} میلی‌ثانیه.",
                "model": cfg["model"],
                "base_url": cfg["base_url"],
                "reply": reply,
            }
    except Exception as e:
        duration_ms = round((time.time() - t0) * 1000, 1)
        return {
            "success": False,
            "latency_ms": duration_ms,
            "status": "error",
            "message": f"خطا در برقراری ارتباط با AvalAI: {str(e)}",
            "model": cfg["model"],
            "base_url": cfg["base_url"],
        }


SYSTEM_PROMPT_WORKPLACE_ANALYSIS = """You are an expert, certified Senior Industrial HSE (Health, Safety, and Environment) Auditor and Safety Engineering Consultant.
Your task is to analyze the provided workplace information, identify concrete workplace hazards, evaluate their realistic consequences, and generate a comprehensive, structured, actionable HSE inspection checklist.

CRITICAL INSTRUCTIONS:
1. Base your analysis STRICTLY on all 9 dimensions of supplied workplace information:
   (1) General Workplace Profile
   (2) Physical Environment & Industrial Hygiene
   (3) Processes & Hazardous Operations
   (4) Machinery & Mechanical Equipment
   (5) Hazardous Materials & Chemicals
   (6) Existing Safety Controls & PPE
   (7) Historical Incidents & Near-misses
   (8) Emergency Preparedness & Response
   (9) Regulatory Context & Specific Directives
2. Clearly distinguish between:
   - "reported": explicitly stated in the input
   - "inferred": logically derived from the combination of activities, equipment, or materials
   - "potential": plausible hazards that require on-site field verification
3. Do NOT fabricate measurements, numbers, or regulatory certifications not provided in the input.
4. If measurements, ventilation values, or inspection statuses are missing, explicitly record them in "missing_information" and "uncertainties".
5. All user-facing titles, descriptions, recommendations, criteria, and checklist items MUST be in fluent, professional PERSIAN (فارسی).
6. Return a STRICT, VALID JSON OBJECT matching the requested schema. No conversational filler, no markdown codeblocks outside JSON.
7. CRITICAL JSON FORMATTING & QUOTE RULE:
   - Inside Persian string values, NEVER use unescaped ASCII double quotation marks ("). Use Persian quotes (« ») or single quotes (' ') when referring to standards, equipment names, or phrases.
   - Keep descriptions, criteria, and recommendations concise, impactful, and direct to ensure the entire JSON response is fully completed within the token limit.
8. COMPREHENSIVE COVERAGE AND DEPTH REQUIREMENTS:
   - Identify between 8 and 12 concrete, high-priority hazards across mechanical, electrical, chemical, ergonomic, fire/explosion, physical agents, and emergency categories.
   - Produce a rich inspection checklist with 4 to 5 structured sections (e.g. ایمنی ماشین‌آلات و پرس‌ها، کار با مواد شیمیایی و حریق، عوامل فیزیکی و ارگونومی، آمادگی شرایط اضطراری، حفاظت فردی و مجوزهای کار).
   - Each section MUST contain 3 to 4 objective, actionable checklist items (generating between 15 and 20 inspection items total).
   - Ensure the JSON is completely closed and valid.

JSON OUTPUT STRUCTURE:
{
  "assessment_summary": {
    "title": "عنوان ارزیابی",
    "workplace_description": "خلاصه محیط کار و محدوده ارزیابی",
    "industry": "صنعت مربوطه",
    "workplace_type": "نوع محیط کار",
    "scope": "دامنه ارزیابی",
    "analysis_limitations": ["محدودیت‌های این تحلیل"]
  },
  "data_quality": {
    "missing_information": ["اطلاعات نامشخص یا ناقص"],
    "uncertainties": ["نقاط ابهام و نامعین"],
    "assumptions": ["فرضیات کلیدی مهندسی"]
  },
  "hazards": [
    {
      "temporary_id": "H1",
      "title": "عنوان خطر",
      "description": "شرح خطر و نحوه وقوع",
      "hazard_category": "mechanical|electrical|chemical|physical|ergonomic|biological|fire_explosion|working_at_height|confined_space|general",
      "source_classification": "reported|inferred|potential",
      "related_activity": "فعالیت مرتبط",
      "related_equipment": "تجهیز مرتبط",
      "exposed_groups": ["گروه‌های در معرض آسیب"],
      "exposure_route": "مسیر مواجهه",
      "possible_consequences": ["پیامدهای محتمل"],
      "proposed_probability": 3,
      "proposed_severity": 3,
      "proposed_risk_level": "medium",
      "recommended_controls": ["اقدام کنترلی پیشنهادی طبق سلسله‌مراتب کنترلی"],
      "inspection_evidence": ["مدرک یا مشاهده لازم برای بازرسی"],
      "requires_field_verification": true
    }
  ],
  "recommended_controls": ["پیشنهادهای کلیدی حذف و مهندسی خطرات"],
  "emergency_considerations": ["ملاحظات شرایط اضطراری"],
  "expert_review_items": ["مواردی که نیازمند نظر کارشناس رسمی یا تست تخصصی است"],
  "checklist": {
    "title": "عنوان چک‌لیست بازرسی جامع",
    "description": "شرح و هدف چک‌لیست",
    "sections": [
      {
        "temporary_id": "SEC-1",
        "title": "عنوان بخش (مثلاً: ایمنی تجهیزات برش و پرس)",
        "description": "شرح الزامات این بخش",
        "order": 1,
        "items": [
          {
            "temporary_id": "CHK-1",
            "title": "عنوان واضح سوال بازرسی",
            "inspection_criterion": "معیار دقیق و عینی انطباق یا شرایط ایمن قابل مشاهده",
            "description": "توضیح تکمیلی",
            "category": "safety",
            "related_hazard_ids": ["H1"],
            "evidence_required": ["مشاهده حفاظ", "بررسی برچسب کالیبراسیون"],
            "recommended_controls": ["نصب حفاظ اینترلاک"],
            "response_type": "yes_no_na",
            "is_critical": true,
            "requires_measurement": false,
            "measurement_unit": null,
            "order": 1
          }
        ]
      }
    ]
  },
  "overall_notes": ["نکات کلی و توصیه‌های تکمیلی"]
}
"""


def _build_user_prompt(input_data: Dict[str, Any]) -> str:
    """
    Exhaustively compiles all 9 steps of the workplace profile into a structured Persian engineering prompt.
    Fully compatible with both AssessmentWizard payload and backend unit test scenario dictionaries.
    """
    general = input_data.get("general_info", {})
    env = input_data.get("physical_environment") or input_data.get("environmental_conditions") or {}
    act_proc = input_data.get("activities_and_processes") or {}
    activities_list = input_data.get("activities") or []
    machinery = input_data.get("machinery_and_equipment") or input_data.get("equipment") or []
    materials = input_data.get("materials_and_chemicals") or input_data.get("materials") or []
    controls = input_data.get("existing_controls") or {}
    personnel = input_data.get("personnel_ppe") or {}
    special_hazards = input_data.get("special_hazards") or []
    incidents = input_data.get("historical_incidents") or []
    emergency = input_data.get("emergency_readiness") or {}
    regulatory = input_data.get("regulatory_context") or {}
    extra_text = input_data.get("additional_description") or ""

    lines = [
        "# مشخصات ۹گانه محیط کار جهت تحلیل جامع HSE و تدوین چک‌لیست بازرسی تخصصی:",
        "",
        "## ۱. مشخصات عمومی و سازمانی محیط کار:",
        f"- عنوان ارزیابی: {general.get('title') or general.get('workplace_name') or 'کارگاه صنعتی'}",
        f"- نام کارگاه / سایت: {general.get('workplace_name', 'کارگاه اصلی')}",
        f"- نوع محیط کار / کاربری: {general.get('workshop_type') or general.get('workplace_type', 'صنعتی / تولیدی')}",
        f"- صنعت و حوزه فعالیت: {general.get('industry_type') or general.get('industry', 'تولیدی و صنعتی')}",
        f"- فضای کار: {general.get('indoor_outdoor', 'سرپوشیده')}",
        f"- تعداد شاغلین: {general.get('worker_count') or general.get('employee_count', 'نامشخص')} نفر",
        f"- شیفت‌های کاری: {general.get('shift_count', 1)} شیفت ({general.get('shift_duration', 8)} ساعته)",
    ]

    contractor_present = general.get("contractor_present")
    if contractor_present is not None:
        lines.append(f"- حضور پیمانکار در کارگاه: {'بله' if contractor_present else 'خیر'} (تعداد: {general.get('contractor_count', 0)} نفر)")
    spec_groups = general.get("special_groups")
    if spec_groups:
        sg_text = "، ".join(spec_groups) if isinstance(spec_groups, list) else str(spec_groups)
        lines.append(f"- گروه‌های آسیب‌پذیر یا دارای ریسک ویژه: {sg_text}")
    if general.get("objective"):
        lines.append(f"- هدف ارزیابی: {general.get('objective')}")

    # 2. Physical Environment
    lines.append("\n## ۲. شرایط محیط فیزیکی و بهداشت حرفه‌ای:")
    if env:
        if env.get("area_sqm"):
            lines.append(f"- مساحت کارگاه: {env.get('area_sqm')} متر مربع")
        if env.get("ceiling_height_meters"):
            lines.append(f"- ارتفاع سقف: {env.get('ceiling_height_meters')} متر")
        vent = env.get("ventilation_type") or env.get("ventilation")
        if vent:
            lines.append(f"- وضعیت سیستم تهویه: {vent}")
        light = env.get("lighting_condition") or env.get("lighting")
        if light:
            lines.append(f"- شرایط روشنایی محیط: {light}")
        noise = env.get("noise_level") or env.get("noise")
        if noise:
            noise_val = f"{noise.get('value')} {noise.get('unit', 'dBA')}" if isinstance(noise, dict) else str(noise)
            lines.append(f"- تراز صوت و آلودگی صوتی: {noise_val}")
        temp = env.get("temperature_condition") or env.get("temperature")
        if temp:
            lines.append(f"- دما و شرایط حرارتی: {temp}")
        hum = env.get("humidity_condition") or env.get("humidity")
        if hum:
            lines.append(f"- رطوبت نسبی محیط: {hum}")
        housekeep = env.get("housekeeping_status")
        if housekeep:
            lines.append(f"- وضعیت نظم و انضباط کارگاهی (Housekeeping / 5S): {housekeep}")
    else:
        lines.append("- اطلاعات تفکیکی محیط فیزیکی ثبت نشده است.")

    # 3. Activities & Processes
    lines.append("\n## ۳. فعالیت‌ها، فرآیندهای کاری و عملیات پرخطر:")
    if act_proc:
        primary = act_proc.get("primary_processes", [])
        if primary:
            lines.append("- فرآیندهای اصلی کارگاه:")
            for p in primary:
                lines.append(f"  * {p}")
        hazardous = act_proc.get("hazardous_operations", [])
        if hazardous:
            lines.append("- عملیات و مانورهای پرخطر:")
            for h in hazardous:
                lines.append(f"  * {h}")
        handling = act_proc.get("material_handling", [])
        if handling:
            lines.append("- روش‌های حمل و جابجایی بار و مواد:")
            for m in handling:
                lines.append(f"  * {m}")
    elif activities_list:
        for idx, act in enumerate(activities_list, 1):
            lines.append(f"{idx}. {act.get('name', '')}: {act.get('description', '')} (فراوانی: {act.get('frequency', '')}, پرسنل درگیر: {act.get('workers_count', '')})")
    else:
        lines.append("- فرآیند تفکیکی ثبت نشده است.")

    # 4. Machinery & Equipment
    lines.append("\n## ۴. ماشین‌آلات، ادوات مکانیکی و پرس‌ها:")
    if machinery:
        for idx, eq in enumerate(machinery, 1):
            eq_name = eq.get("name", f"تجهیز {idx}")
            eq_type = eq.get("type", "")
            eq_guard = eq.get("guarding_status") or eq.get("guarding", "نامشخص")
            eq_maint = eq.get("maintenance_status") or eq.get("defects", "ثبت‌نشده")
            eq_devices = eq.get("safety_devices") or eq.get("emergency_stop")
            dev_text = ("، ".join(eq_devices) if isinstance(eq_devices, list) else str(eq_devices)) if eq_devices else "فاقد اطلاعات"
            lines.append(f"{idx}. {eq_name} ({eq_type}) | حفاظ: {eq_guard} | وضعیت نگهداری: {eq_maint} | ادوات ایمنی و استپ اضطراری: {dev_text}")
    else:
        lines.append("- ماشین‌آلات اختصاصی معرفی نشده است.")

    # 5. Materials & Chemicals
    lines.append("\n## ۵. مواد، ترکیبات شیمیایی و انبارش:")
    if materials:
        for idx, mat in enumerate(materials, 1):
            m_name = mat.get("name", f"ماده {idx}")
            m_class = mat.get("classification") or mat.get("chemical_name", "")
            m_storage = mat.get("storage_method") or mat.get("storage", "نامشخص")
            m_vol = mat.get("approximate_volume") or mat.get("quantity", "نامشخص")
            m_sds = mat.get("msds_available") if mat.get("msds_available") is not None else mat.get("sds_available", "نامشخص")
            sds_text = "دارد" if m_sds is True else ("ندارد" if m_sds is False else str(m_sds))
            lines.append(f"{idx}. {m_name} ({m_class}) | مقدار: {m_vol} | روش انبارداری: {m_storage} | برگه SDS: {sds_text}")
    else:
        lines.append("- ماده شیمیایی خاصی ثبت نشده است.")

    # 6. Existing Controls & PPE
    lines.append("\n## ۶. اقدامات کنترلی موجود و تجهیزات حفاظت فردی (PPE):")
    if isinstance(controls, dict):
        eng = controls.get("engineering_controls")
        if eng:
            lines.append(f"- کنترل‌های مهندسی: {'، '.join(eng) if isinstance(eng, list) else eng}")
        adm = controls.get("administrative_controls")
        if adm:
            lines.append(f"- کنترل‌های مدیریتی: {'، '.join(adm) if isinstance(adm, list) else adm}")
        ppe = controls.get("ppe_provided") or controls.get("ppe_used") or personnel.get("ppe_used")
        if ppe:
            lines.append(f"- تجهیزات حفاظت فردی در حال استفاده: {'، '.join(ppe) if isinstance(ppe, list) else ppe}")
        permits = controls.get("permits_required") or controls.get("ptw")
        if permits:
            lines.append(f"- پروانه‌های کار (PTW) الزامی: {'، '.join(permits) if isinstance(permits, list) else permits}")
        for k, v in controls.items():
            if k not in ("engineering_controls", "administrative_controls", "ppe_provided", "permits_required"):
                lines.append(f"- {k}: {v}")
    if personnel:
        if personnel.get("roles"):
            lines.append(f"- نقش‌ها و عناوین شغلی: {personnel.get('roles')}")
        if personnel.get("training_status"):
            lines.append(f"- وضعیت آموزش‌های ایمنی: {personnel.get('training_status')}")

    # 7. Historical Incidents
    lines.append("\n## ۷. سوابق حوادث و شبه‌حوادث پیشین:")
    if incidents:
        for idx, inc in enumerate(incidents, 1):
            i_type = inc.get("incident_type", "حادثه")
            i_date = inc.get("date_or_period", "گذشته")
            i_desc = inc.get("description", "")
            i_sev = inc.get("severity", "")
            lines.append(f"{idx}. [{i_date}] {i_type} (شدت: {i_sev}) - شرح: {i_desc}")
    else:
        lines.append("- سابقه حادثه جدی ثبت نشده یا اطلاعات در دست نیست.")

    # 8. Emergency Readiness
    lines.append("\n## ۸. وضعیت آمادگی و واکنش در شرایط اضطراری:")
    if emergency:
        lines.append(f"- کپسول‌های آتش‌نشانی در دسترس: {'بله' if emergency.get('fire_extinguishers_available') else 'خیر'}")
        lines.append(f"- دوش و چشم‌شوی اضطراری: {'بله' if emergency.get('eyewash_available') else 'خیر'}")
        lines.append(f"- جعبه کمک‌های اولیه آماده: {'بله' if emergency.get('first_aid_kit_available') else 'خیر'}")
        lines.append(f"- علامت‌گذاری خروجی‌های اضطراری: {'بله' if emergency.get('emergency_exits_marked') else 'خیر'}")
        lines.append(f"- نقشه و پلان تخلیه اضطراری: {'بله' if emergency.get('evacuation_plan_exists') else 'خیر'}")
        if emergency.get("trained_first_aiders") is not None:
            lines.append(f"- تعداد امدادگران آموزش‌دیده: {emergency.get('trained_first_aiders')} نفر")
    else:
        lines.append("- اطلاعات شرایط اضطراری ثبت نشده است.")

    # 9. Regulatory Context & Extra Directives
    lines.append("\n## ۹. چارچوب مقرراتی، استانداردهای حاکم و الزامات تکمیلی:")
    if regulatory:
        stds = regulatory.get("applicable_standards")
        if stds:
            lines.append(f"- استانداردهای الزامی: {'، '.join(stds) if isinstance(stds, list) else stds}")
        pols = regulatory.get("internal_policies")
        if pols:
            lines.append(f"- خط‌مشی‌های داخلی: {'، '.join(pols) if isinstance(pols, list) else pols}")
        permits_spec = regulatory.get("special_permits")
        if permits_spec:
            lines.append(f"- مجوزهای قانونی ویژه: {'، '.join(permits_spec) if isinstance(permits_spec, list) else permits_spec}")
    if special_hazards:
        lines.append("- خطرات ویژه علامت‌خورده:")
        for sh in special_hazards:
            lines.append(f"  * {sh.get('type', sh) if isinstance(sh, dict) else sh}: {sh.get('details', '') if isinstance(sh, dict) else ''}")
    if extra_text:
        lines.append(f"\n- دستورالعمل اختصاصی کارفرما / کارشناس HSE:\n{extra_text}")

    return "\n".join(lines)


def call_avalai_chat_completions(
    system_prompt: str,
    user_prompt: str,
    model: str = "",
    timeout: int = 90,
    max_retries: int = 2,
    max_output_tokens: int = 8000,
) -> Tuple[str, Dict[str, Any], float]:
    """
    Invokes the AvalAI chat completions endpoint using standard urllib.
    Returns: (raw_content_string, metadata_dict, duration_ms)
    """
    cfg = get_avalai_config()
    api_key = cfg["api_key"]
    if not api_key or api_key == "<TEST_KEY_PLACEHOLDER>":
        raise AvalAIConfigurationError("کلید دسترسی AvalAI (AVALAI_API_KEY) در متغیرهای محیطی سرور تنظیم نشده است.")
    if not cfg["enabled"]:
        raise AvalAIConfigurationError("سرویس هوش مصنوعی AvalAI در تنظیمات سرور غیرفعال شده است (AVALAI_ENABLED=False).")

    active_model = model or cfg["model"]
    endpoint_url = f"{cfg['base_url']}/chat/completions"

    payload = {
        "model": active_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "thinking": {"type": "disabled"},
        "response_format": {"type": "json_object"},
        "max_tokens": max_output_tokens,
        "temperature": 0.2,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "HSE-Guard-AI-Engine/1.0",
        "Connection": "close",
    }

    req_data = json.dumps(payload).encode("utf-8")
    last_err = None

    for attempt in range(max_retries + 1):
        t0 = time.time()
        try:
            req = urllib.request.Request(endpoint_url, data=req_data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=timeout) as response:
                duration_ms = round((time.time() - t0) * 1000, 1)
                body = response.read().decode("utf-8")
                res_json = json.loads(body)

                choices = res_json.get("choices", [])
                if not choices:
                    raise AvalAIResponseError("پاسخ دریافتی از AvalAI فاقد انتخاب (choice) محتوایی بود.")

                msg = choices[0].get("message", {})
                raw_content = msg.get("content")
                if raw_content is None:
                    raw_content = msg.get("reasoning_content") or ""
                content = str(raw_content).strip()
                if not content:
                    raise AvalAIResponseError("محتوای بازگشتی از مدل هوش مصنوعی خالی است.")

                usage = res_json.get("usage", {})
                metadata = {
                    "provider": "avalai",
                    "model": active_model,
                    "request_id": res_json.get("id", ""),
                    "status_code": response.status,
                    "duration_ms": duration_ms,
                    "prompt_tokens": usage.get("prompt_tokens"),
                    "completion_tokens": usage.get("completion_tokens"),
                    "total_tokens": usage.get("total_tokens"),
                    "finish_reason": choices[0].get("finish_reason", "stop"),
                }
                return content, metadata, duration_ms

        except urllib.error.HTTPError as e:
            duration_ms = round((time.time() - t0) * 1000, 1)
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.warning("AvalAI HTTP Error %d on attempt %d: %s", e.code, attempt, err_body[:200])

            if e.code == 401:
                raise AvalAIConfigurationError("احراز هویت با AvalAI ناموفق بود (کلید API معتبر نیست یا منقضی شده است).")
            elif e.code == 429:
                if attempt < max_retries:
                    time.sleep(2 ** attempt)
                    continue
                raise AvalAIRateLimitError("سقف درخواست‌های مجاز AvalAI (Rate Limit) تکمیل شده است. لطفاً کمی بعد تلاش کنید.")
            elif e.code in (500, 502, 503, 504):
                if attempt < max_retries:
                    time.sleep(2 ** attempt)
                    continue
                raise AvalAIConnectionError(f"سرور AvalAI موقتاً با خطای {e.code} مواجه شد.")
            else:
                raise AvalAIResponseError(f"خطای ارائه‌دهنده هوش مصنوعی ({e.code}): درخواست معتبر نبود.")

        except (urllib.error.URLError, TimeoutError, ConnectionResetError, OSError) as e:
            duration_ms = round((time.time() - t0) * 1000, 1)
            logger.warning("AvalAI Connection Error on attempt %d: %s", attempt, str(e))
            if attempt < max_retries:
                time.sleep(2 ** attempt)
                continue
            raise AvalAIConnectionError(f"برقراری ارتباط با AvalAI با وقفه زمانی ({timeout}s) یا خطای شبکه متوقف شد: {str(e)}")

        except json.JSONDecodeError:
            raise AvalAIResponseError("پاسخ دریافتی از سرور AvalAI با فرمت استاندارد JSON مطابقت ندارد.")

    raise AvalAIConnectionError("تلاش‌های مکرر برای ارتباط با سرویس AvalAI به نتیجه نرسید.")
