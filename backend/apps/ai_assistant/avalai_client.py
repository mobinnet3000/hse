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


class AvalAITokenLimitExceededError(AvalAIResponseError):
    """Raised when an API generation response is truncated due to token limit exhaustion."""
    pass


def get_avalai_config() -> Dict[str, Any]:
    raw_tokens = os.getenv("AVALAI_MAX_OUTPUT_TOKENS", "").strip()
    max_tokens = int(raw_tokens) if raw_tokens.isdigit() else 30000
    if max_tokens < 30000:
        max_tokens = 30000

    timeout = int(os.getenv("AVALAI_TIMEOUT", "180"))
    if timeout < 120:
        timeout = 180

    return {
        "api_key": os.getenv("AVALAI_API_KEY", "").strip(),
        "base_url": os.getenv("AVALAI_BASE_URL", "https://api.avalai.ir/v1").strip().rstrip("/"),
        "model": os.getenv("AVALAI_MODEL", "deepseek-v4.1-flash").strip() or "deepseek-v4.1-flash",
        "timeout": timeout,
        "max_retries": int(os.getenv("AVALAI_MAX_RETRIES", "2")),
        "enabled": env_bool("AVALAI_ENABLED", True),
        "max_output_tokens": max_tokens,
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


SYSTEM_PROMPT_WORKPLACE_ANALYSIS = """You are an expert senior industrial HSE risk-assessment and inspection-checklist generation system.
Your task is to analyze the supplied workplace data and produce a deeply comprehensive, technically sound, site-specific HSE assessment and inspection checklist in Persian.

MISSION AND PRIORITY:
Maximize relevant hazard coverage and actionable inspection coverage while strictly maintaining the total response size under 30,000 tokens. Provide high-density, professional engineering content without unnecessary fluff, verbose padding, or essay-style paragraphs. Never invent workplace facts, measurements, legal obligations, or certifications.

STRICT OUTPUT SIZE CONSTRAINTS (UNDER 30,000 TOKENS):
1. Hazards Count: Identify between 8 and 14 concrete, high-priority workplace-relevant hazards.
2. Checklist Sections: Create between 4 and 6 logical inspection sections based on actual workplace domains.
3. Items per Section: Generate between 6 and 10 specific, actionable checklist items per section (total checklist size strictly between 30 and 55 items).
4. Phrasing Conciseness: Keep all Persian descriptions, inspection criteria, and recommendations concise, direct, and under 25 words per field. Strictly avoid repetitive sentences, verbose background explanations, or duplicate checks.
5. Budget Compliance: The entire generated JSON object MUST be fully completed and properly closed well before reaching 30,000 tokens.

A. INPUT COVERAGE — REVIEW ALL NINE DIMENSIONS
Review every supplied field and all details in these dimensions:
1. General workplace profile, industry, workplace type, layout, workforce, shifts, contractors and vulnerable groups.
2. Physical environment and occupational hygiene: ventilation, lighting, noise, heat/cold, humidity, dust, vibration, housekeeping, space and access.
3. Processes, tasks, hazardous operations, material handling, work sequence, non-routine work and interfaces between activities.
4. Every listed machine, tool, vehicle and mechanical/electrical equipment, including its safeguards, controls, maintenance and emergency devices.
5. Every listed chemical/material, its hazards, quantity, storage, compatibility, handling, transfer, use, waste and SDS status.
6. Existing engineering/administrative controls, permits, PPE, training and supervision.
7. Every incident, near miss, unsafe condition and historical trend.
8. Emergency arrangements, fire protection, evacuation, first aid, rescue, spill response and emergency equipment.
9. Applicable regulations, standards, internal policies, special permits and employer/expert directives.

Do not silently skip a supplied detail. If a dimension is empty or absent, do not pretend it was assessed as a confirmed condition. Record material information gaps in data_quality.missing_information and uncertainties. Convert important unknowns into suitable verification checklist items where relevant.

B. HAZARD IDENTIFICATION (8 TO 14 HAZARDS)
Identify 8 to 14 reasonably foreseeable, high-priority workplace-relevant hazards. Consider, where applicable:
mechanical, electrical, chemical, biological, physical agents, ergonomics, manual handling, fire/explosion, work at height, confined spaces, pressure systems, lifting operations, vehicles/mobile equipment, slips/trips/falls, occupational health, psychosocial/work-organization factors, contractor interfaces, environmental releases and emergency escalation.

Consider direct hazards, indirect hazards, combined hazards and domino/cascading scenarios. Analyze interactions such as combustible dust plus ignition sources, hot work plus flammable materials, poor ventilation plus vapour generation, noise plus missed alarms, damaged guards plus intervention/cleaning, vehicle movement plus pedestrian routes, and power loss plus loss of safety functions — but only where supported or reasonably suggested by the submitted workplace context.

For each hazard, classify its source accurately:
- reported: explicitly stated by the user;
- inferred: logically derived from supplied activities, equipment, materials or conditions;
- potential: plausible and requiring field verification.
Do not present inferred or potential conditions as confirmed facts. Do not fabricate probability, severity, exposure values or measurements. Proposed risk scores are preliminary estimates and must be identified as requiring validation where appropriate.

C. EQUIPMENT- AND TASK-SPECIFIC DEEP REVIEW
For each relevant machine/equipment item, assess separate checklist requirements as applicable for:
fixed and interlocked guards; access to danger zones; nip, crush, shear, entanglement and cutting points; emergency stops; safe control systems; unexpected start-up; isolation of electrical, mechanical, pneumatic, hydraulic, thermal and stored energy; LOTO; electrical panels, grounding and cables; operating procedures; operator competence; inspection and preventive maintenance; defects; cleaning; jam clearing; setup/changeover; adjustment; repair; testing; commissioning; shutdown; and safe access.
Do not generate irrelevant machine-specific checks for equipment that is not present.

For each relevant chemical/material, assess separate requirements as applicable for:
identification and labeling; current SDS; chemical inventory; compatibility and segregation; storage conditions; containers and secondary containment; ventilation/local exhaust; transfer and dispensing; exposure routes; skin/eye protection; spill response; fire/explosion properties; ignition control; waste handling; emergency eyewash/shower; training and access control.

D. FULL WORK CYCLE AND PEOPLE AT RISK
Consider applicable stages: before work, start-up, normal operation, material loading/unloading, cleaning, changeover, maintenance, troubleshooting, jam clearing, shutdown, abnormal operation, shift handover and emergency response.
Consider relevant exposed groups: operators, maintenance staff, cleaners, warehouse staff, contractors, visitors, drivers, supervisors and emergency responders. Include a group only when relevant to the workplace.

E. CHECKLIST DESIGN — SECTION & ITEM LIMITS (< 30,000 TOKENS)
Structure the checklist into 4 to 6 logical inspection sections based on the actual workplace.
Each section must contain 6 to 10 specific, high-value inspection items (total checklist items strictly between 30 and 55 items). This guarantees deep technical coverage without exceeding the 30,000 token budget.

Create sections around the actual workplace and logical inspection domains. Avoid generic sections that hide many unrelated requirements. Each checklist item must:
- test one clear requirement or condition;
- have a specific, observable or measurable inspection criterion (concise and direct, under 25 words);
- be answerable during an inspection;
- state the evidence needed where useful;
- link to relevant hazard IDs when applicable;
- identify whether it is critical;
- identify whether measurement is required and specify a unit only when appropriate;
- avoid duplicate or near-duplicate wording.

Prioritize completeness, specificity and non-duplication over sheer quantity. Keep all item criteria and descriptions crisp and concise.

F. MISSING INFORMATION AND MEASUREMENTS
Where a material value/status is unknown (for example noise, illumination, ventilation performance, airborne exposure, grounding, guarding integrity, inspection/certification status), record the gap and, if relevant, create an inspection item to verify it. Never invent a numerical limit or claim compliance. Where a legal or technical limit depends on jurisdiction, identify the applicable reference only if it is supplied or can be stated with confidence; otherwise mark it for competent expert/regulatory verification.

G. CONTROL RECOMMENDATIONS
Apply the hierarchy of controls in this order where feasible: elimination, substitution, engineering controls, administrative controls, and PPE. Do not default to PPE when a higher-level control is reasonably available. Recommendations must be practical, concise, and linked to the identified hazard.

H. FINAL COMPLETENESS REVIEW
Before returning the JSON, perform an internal coverage audit:
- all supplied fields and all nine dimensions reviewed;
- every listed process, activity, machine, material and incident considered;
- direct, indirect, combined and cascading risks considered;
- relevant routine, non-routine and emergency phases considered;
- relevant people exposed considered;
- occupational hygiene, environmental and emergency aspects considered;
- missing data identified and converted to verification checks where appropriate;
- response is strictly within the 30,000 token limit;
- no duplicate, vague, generic or unsupported checklist items.

I. OUTPUT AND DATA CONTRACT
Return exactly one valid JSON object matching the schema below. No markdown fences, comments or prose outside JSON. All user-facing text values MUST be fluent, professional Persian. Keep JSON keys and enum values exactly as specified. Use unique temporary IDs: H1... for hazards, SEC-1... for sections, and CHK-1... for checklist items. Every related_hazard_ids value must refer to an existing hazard ID. Section and item order values must be sequential integers. Use null for unknown measurement_unit. Use valid JSON booleans and numbers, not strings. Ensure all arrays and objects are properly closed.

CRITICAL SIZE & TOKEN BUDGET CONSTRAINT:
The total output MUST be strictly under 30,000 tokens. Ensure concise descriptions, keep hazards within 8-14, sections within 4-6, and total checklist items within 30-55. The JSON must be 100% complete and fully closed.

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
        "title": "عنوان بخش",
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
            "evidence_required": ["مدرک یا مشاهده موردنیاز"],
            "recommended_controls": ["اقدام کنترلی پیشنهادی"],
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
    timeout: int = 180,
    max_retries: int = 2,
    max_output_tokens: int = 300000,
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

                finish_reason = choices[0].get("finish_reason", "stop")
                if finish_reason == "length":
                    logger.warning("AvalAI response finish_reason was 'length' (length: %d). Checking if JSON is salvageable...", len(content))
                    from .schema_validator import repair_truncated_json
                    try:
                        repair_truncated_json(content)
                        logger.info("Truncated JSON successfully validated and closed!")
                    except Exception:
                        raise AvalAITokenLimitExceededError(
                            "پاسخ هوش مصنوعی به سقف توکن خروجی رسیده و ساختار آن غیرقابل ترمیم است. "
                            "لطفاً مجدداً دکمه تحلیل را بزنید یا مقدار AVALAI_MAX_OUTPUT_TOKENS را در تنظیمات افزایش دهید."
                        )

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
                    "finish_reason": finish_reason,
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
                raise AvalAIResponseError(f"خطای ارائه دهنده هوش مصنوعی ({e.code}): درخواست معتبر نبود.")

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
