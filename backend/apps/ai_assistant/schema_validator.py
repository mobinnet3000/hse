import json
import logging
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)


class SchemaValidationError(Exception):
    pass


def calculate_risk_level(probability: int, severity: int) -> Tuple[int, str]:
    """
    Computes server-side risk score according to HSE Guard 5x5 matrix.
    Scale: 1-25
    Levels:
      1-4   : low
      5-9   : medium
      10-14 : high
      15-25 : critical
    """
    prob = max(1, min(5, int(probability or 3)))
    sev = max(1, min(5, int(severity or 3)))
    score = prob * sev

    if score <= 4:
        level = "low"
    elif score <= 9:
        level = "medium"
    elif score <= 14:
        level = "high"
    else:
        level = "critical"

    return score, level


def repair_truncated_json(raw: str) -> Dict[str, Any]:
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        raw = "\n".join(lines).strip()

    # Pass 1: Direct JSON load
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    import re
    start_idx = raw.find("{")
    if start_idx == -1:
        raise SchemaValidationError("هیچ شیء JSON معتبری در خروجی مدل یافت نشد.")
    s = raw[start_idx:]

    # Pass 2: Progressive backward trim & structural repair
    # Handles arbitrary truncations: inside key name, after colon, inside string value,
    # or inside nested array/object elements.
    max_trim = min(1200, len(s))
    last_json_error = None

    for trim_len in range(0, max_trim):
        candidate = s[:len(s) - trim_len].rstrip()
        if not candidate:
            continue

        # Strip trailing dangling commas, colons, or whitespace
        candidate = re.sub(r'[,:\s]+$', '', candidate)

        # Track bracket stack and string state
        in_string = False
        escape = False
        stack = []
        for char in candidate:
            if escape:
                escape = False
                continue
            if char == '\\':
                escape = True
                continue
            if char == '"':
                in_string = not in_string
                continue
            if not in_string:
                if char in '{[':
                    stack.append(char)
                elif char == '}':
                    if stack and stack[-1] == '{':
                        stack.pop()
                elif char == ']':
                    if stack and stack[-1] == '[':
                        stack.pop()

        if in_string:
            candidate += '"'

        # Check if candidate ends with an incomplete key inside an object
        # e.g., candidate ends with '"incomplete_key"' and top of stack is '{'
        # In JSON, a key in an object MUST have ': <value>'. Without it, '{"key"}' causes Expecting ':' delimiter!
        match_trailing_key = re.search(r'([{,]\s*)"[^"]+"\s*$', candidate)
        if match_trailing_key and stack and stack[-1] == '{':
            candidate = candidate[:match_trailing_key.start() + 1]
            candidate = re.sub(r'[,:\s]+$', '', candidate)

        # If candidate ends with colon, complete with null
        if candidate.endswith(':'):
            candidate += ' null'

        # Close all remaining open brackets in reverse order
        closed = candidate
        for open_bracket in reversed(stack):
            if open_bracket == '{':
                closed += '}'
            elif open_bracket == '[':
                closed += ']'

        try:
            return json.loads(closed)
        except json.JSONDecodeError as e:
            last_json_error = e

    err_msg = str(last_json_error) if last_json_error else "عدم تطابق پرانتزها و براکت‌های JSON"
    raise SchemaValidationError(f"پاسخ مدل هوش مصنوعی ساختار معتبر JSON ندارد: {err_msg}")


def validate_and_normalize_ai_response(raw_json: Any) -> Dict[str, Any]:
    """
    Validates that the AI response matches the strict HSE Guard output schema.
    Repairs missing non-critical keys with safe defaults, and calculates server-side risk scores.
    """
    if isinstance(raw_json, str):
        data = repair_truncated_json(raw_json)
    elif isinstance(raw_json, dict):
        data = raw_json
    else:
        raise SchemaValidationError("ساختار داده پاسخ هوش مصنوعی باید از نوع دیکشنری JSON باشد.")

    # 1. Assessment Summary
    summary = data.get("assessment_summary", {})
    if not isinstance(summary, dict):
        summary = {}
    normalized_summary = {
        "title": str(summary.get("title") or "ارزیابی شناسایی خطرات محیط کار"),
        "workplace_description": str(summary.get("workplace_description") or ""),
        "industry": str(summary.get("industry") or "صنعتی"),
        "workplace_type": str(summary.get("workplace_type") or "کارگاه"),
        "scope": str(summary.get("scope") or "کلیه فعالیت‌ها و تجهیزات معرفی‌شده"),
        "analysis_limitations": [str(x) for x in summary.get("analysis_limitations", []) if x],
    }

    # 2. Data Quality & Gaps
    data_quality = data.get("data_quality", {})
    if not isinstance(data_quality, dict):
        data_quality = {}
    normalized_data_quality = {
        "missing_information": [str(x) for x in data_quality.get("missing_information", []) if x],
        "uncertainties": [str(x) for x in data_quality.get("uncertainties", []) if x],
        "assumptions": [str(x) for x in data_quality.get("assumptions", []) if x],
    }

    # 3. Hazards
    raw_hazards = data.get("hazards", [])
    if not isinstance(raw_hazards, list):
        raw_hazards = []

    normalized_hazards = []
    for idx, h in enumerate(raw_hazards, start=1):
        if not isinstance(h, dict):
            continue
        prob = h.get("proposed_probability", 3)
        sev = h.get("proposed_severity", 3)
        try:
            prob_int = int(prob) if prob is not None else 3
            sev_int = int(sev) if sev is not None else 3
        except (ValueError, TypeError):
            prob_int, sev_int = 3, 3

        score, level = calculate_risk_level(prob_int, sev_int)

        source_cls = str(h.get("source_classification", "inferred")).lower()
        if source_cls not in ("reported", "inferred", "potential"):
            source_cls = "inferred"

        title_val = str(h.get("hazard_title") or h.get("title") or f"خطر شماره {idx}")
        desc_val = str(h.get("hazard_description") or h.get("description") or "")
        cat_val = str(h.get("hazard_category") or h.get("category") or "general")
        consequences = [str(x) for x in (h.get("potential_consequences") or h.get("possible_consequences") or []) if x]
        controls = [str(x) for x in h.get("recommended_controls", []) if x]
        evidences = [str(x) for x in (h.get("inspection_evidence") or h.get("evidence_required") or []) if x]

        hazard_item = {
            "id": str(h.get("id") or h.get("temporary_id") or f"H{idx}"),
            "temporary_id": str(h.get("temporary_id") or f"H{idx}"),
            "hazard_title": title_val,
            "title": title_val,
            "hazard_description": desc_val,
            "description": desc_val,
            "hazard_category": cat_val,
            "category": cat_val,
            "source_classification": source_cls,
            "related_activity": str(h.get("related_activity") or ""),
            "related_equipment": str(h.get("related_equipment") or ""),
            "exposed_groups": [str(x) for x in h.get("exposed_groups", []) if x],
            "exposure_route": str(h.get("exposure_route") or ""),
            "potential_consequences": consequences,
            "possible_consequences": consequences,
            "initial_probability": prob_int,
            "proposed_probability": prob_int,
            "initial_severity": sev_int,
            "proposed_severity": sev_int,
            "initial_risk_score": score,
            "calculated_score": score,
            "initial_risk_level": level,
            "proposed_risk_level": level,
            "recommended_controls": controls,
            "emergency_actions": [str(x) for x in h.get("emergency_actions", []) if x],
            "inspection_evidence": evidences,
            "requires_field_verification": bool(h.get("requires_field_verification", True)),
        }
        normalized_hazards.append(hazard_item)

    # 4. Checklist Structure
    raw_checklist = data.get("checklist", {})
    if not isinstance(raw_checklist, dict):
        raw_checklist = {}

    checklist_title = str(raw_checklist.get("title") or f"چک‌لیست بازرسی: {normalized_summary['title']}")
    checklist_desc = str(raw_checklist.get("description") or "چک‌لیست جامع بازرسی تخصصی محیط کار")
    raw_sections = raw_checklist.get("sections", [])
    if not isinstance(raw_sections, list) or len(raw_sections) == 0:
        # Fallback section if model produced flat items
        raw_sections = [
            {
                "temporary_id": "SEC-1",
                "title": "الزامات عمومی و فنی ایمنی",
                "description": "بخش کلی بازرسی",
                "order": 1,
                "items": raw_checklist.get("items", []),
            }
        ]

    normalized_sections = []
    global_item_counter = 1
    for s_idx, sec in enumerate(raw_sections, start=1):
        if not isinstance(sec, dict):
            continue
        s_title = str(sec.get("title") or f"بخش {s_idx}")
        s_desc = str(sec.get("description") or "")
        s_order = int(sec.get("order") or s_idx)
        raw_items = sec.get("items", [])
        if not isinstance(raw_items, list):
            raw_items = []

        normalized_items = []
        for i_idx, itm in enumerate(raw_items, start=1):
            if not isinstance(itm, dict):
                itm = {"title": str(itm)}

            item_title = str(itm.get("title") or f"بند بازرسی {global_item_counter}")
            criterion = str(itm.get("inspection_criterion") or itm.get("description") or "بررسی انطباق میدانی با الزامات ایمنی")
            response_type = str(itm.get("response_type") or "yes_no_na")
            if response_type not in ("yes_no_na", "score", "text", "measurement"):
                response_type = "yes_no_na"

            normalized_items.append({
                "temporary_id": str(itm.get("temporary_id") or f"CHK-{global_item_counter}"),
                "title": item_title,
                "inspection_criterion": criterion,
                "description": str(itm.get("description") or ""),
                "category": str(itm.get("category") or "safety"),
                "related_hazard_ids": [str(x) for x in itm.get("related_hazard_ids", []) if x],
                "evidence_required": [str(x) for x in itm.get("evidence_required", []) if x],
                "recommended_controls": [str(x) for x in itm.get("recommended_controls", []) if x],
                "response_type": response_type,
                "is_critical": bool(itm.get("is_critical", False)),
                "requires_measurement": bool(itm.get("requires_measurement", False)),
                "measurement_unit": itm.get("measurement_unit"),
                "order": int(itm.get("order") or i_idx),
            })
            global_item_counter += 1

        normalized_sections.append({
            "temporary_id": str(sec.get("temporary_id") or f"SEC-{s_idx}"),
            "title": s_title,
            "description": s_desc,
            "order": s_order,
            "items": normalized_items,
        })

    normalized_checklist = {
        "title": checklist_title,
        "description": checklist_desc,
        "sections": normalized_sections,
    }

    return {
        "assessment_summary": normalized_summary,
        "data_quality": normalized_data_quality,
        "hazards": normalized_hazards,
        "recommended_controls": [str(x) for x in data.get("recommended_controls", []) if x],
        "emergency_considerations": [str(x) for x in data.get("emergency_considerations", []) if x],
        "expert_review_items": [str(x) for x in data.get("expert_review_items", []) if x],
        "checklist": normalized_checklist,
        "overall_notes": [str(x) for x in data.get("overall_notes", []) if x],
    }


def generate_scenario_mock_analysis(workplace_name: str = "کارگاه تراشکاری و اسکلت فلزی") -> Dict[str, Any]:
    """
    Generates a deterministic, realistic HSE analysis matching Section 15 of the mandate
    (metal fabrication and industrial machinery workshop). Used for unit tests, offline dev,
    or when AvalAI API key is omitted.
    """
    return {
        "assessment_summary": {
            "title": f"ارزیابی ایمنی و شناسایی خطرات کارگاه {workplace_name}",
            "workplace_description": "کارگاه صنعتی ساخت سازه‌های فلزی، برشکاری، جوشکاری، ماشین‌کاری و انبارش قطعات سنگین",
            "industry": "صنایع فلزی و ساخت تجهیزات صنعتی",
            "workplace_type": "کارگاه تولیدی صنعتی",
            "scope": "خطوط برش، جوشکاری قوسی، پرس هیدرولیک، سنگ‌زنی و حمل‌ونقل بار با جرثقیل سقفی و لیفتراک",
            "analysis_limitations": [
                "عدم دسترسی به سنجش دسی‌بل‌متر تراز صوتی در شرایط اوج بار کاری",
                "نامشخص بودن دبی واقعی سیستم تهویه موضعی در ایستگاه‌های جوشکاری",
            ],
        },
        "data_quality": {
            "missing_information": [
                "تاریخچه آخرین آزمون هیدروستاتیک و بازرسی ادواری مخزن کمپرسور باد",
                "شناسنامه فنی و تست چاه ارت متصل به دستگاه‌های جوش و پرس",
            ],
            "uncertainties": [
                "میزان غلظت فیوم‌های فلزی منگنز و اکسید آهن در هوای تنفسی سالن",
            ],
            "assumptions": [
                "پرس هیدرولیک فاقد پرده نوری (Light Curtain) استاندارد فرض شده است مگر خلاف آن ثابت شود.",
            ],
        },
        "hazards": [
            {
                "temporary_id": "H1",
                "title": "خطر گیر افتادن و له‌شدگی دست در پرس هیدرولیک",
                "description": "نقطه عمل پرس هیدرولیک در صورت عدم وجود فرمان دودستی یا پرده نوری می‌تواند منجر به قطع عضو اپراتور گردد.",
                "hazard_category": "mechanical",
                "source_classification": "reported",
                "related_activity": "پرس‌کاری و فرم‌دهی ورق‌های فولادی",
                "related_equipment": "پرس هیدرولیک ۱۰۰ تن",
                "exposed_groups": ["اپراتور پرس", "کمک‌اپراتور"],
                "exposure_route": "تماس مستقیم فیزیکی با سمبه و ماتریس",
                "possible_consequences": ["له‌شدگی بافت", "قطع انگشتان یا دست"],
                "proposed_probability": 3,
                "proposed_severity": 5,
                "calculated_score": 15,
                "proposed_risk_level": "critical",
                "recommended_controls": [
                    "نصب سامانه فرمان دودستی همزمان (Two-hand control)",
                    "نصب حفاظ نوری الکترواپتیکال اینترلاک‌شده با مدار هیدرولیک",
                ],
                "inspection_evidence": ["مشاهده حفاظ", "بررسی تست توقف اضطراری"],
                "requires_field_verification": True,
            },
            {
                "temporary_id": "H2",
                "title": "استنشاق فیوم‌های جوشکاری و کمبود تهویه موضعی",
                "description": "تولید دود ناشی از الکترودهای جوشکاری قوسی و عدم مکش کافی باعث تجمع گازها و دود در ارتفاع تنفسی می‌شود.",
                "hazard_category": "chemical",
                "source_classification": "inferred",
                "related_activity": "جوشکاری اسکلت فلزی با الکترود دستی",
                "related_equipment": "رکتیفایر جوشکاری",
                "exposed_groups": ["جوشکاران", "کارگران مجاور"],
                "exposure_route": "استنشاق ریوی",
                "possible_consequences": ["تب دود فلزی", "آسیب مزمن ریوی", "تحریک مجاری تنفسی"],
                "proposed_probability": 4,
                "proposed_severity": 3,
                "calculated_score": 12,
                "proposed_risk_level": "high",
                "recommended_controls": [
                    "تجهیز کارگاه به هودهای بازویی متحرک تهویه موضعی (LEV)",
                    "تأمین ماسک‌های تنفسی استاندارد FFP2 یا FFP3",
                ],
                "inspection_evidence": ["بررسی سلامت فن‌های تخلیه", "تست دبی مکش"],
                "requires_field_verification": True,
            },
            {
                "temporary_id": "H3",
                "title": "پرتاب براده و پلیسه در حین سنگ‌زنی و برش",
                "description": "سنگ‌فرزها با سرعت دورانی بالا کار کرده و در صورت نبود حفاظ یا عینک سنگ‌زنی براده‌های داغ به چشم پرتاب می‌شوند.",
                "hazard_category": "mechanical",
                "source_classification": "reported",
                "related_activity": "سنگ‌زنی و پلیسه‌گیری قطعات برشی",
                "related_equipment": "سنگ‌فرز آهنگری دستی",
                "exposed_groups": ["اپراتور فرز", "پرسنل ترددکننده"],
                "exposure_route": "پرتاب فیزیکی ترکش و براده به چشم و صورت",
                "possible_consequences": ["جراحت قرنیه", "از دست دادن بینایی", "سوختگی پوست"],
                "proposed_probability": 4,
                "proposed_severity": 3,
                "calculated_score": 12,
                "proposed_risk_level": "high",
                "recommended_controls": [
                    "الزام حفاظ فلزی فابریک صفحه سنگ روی تمامی فرزها",
                    "استفاده اجباری از شیلد محافظ کامل صورت همراه با عینک ضدضربه",
                ],
                "inspection_evidence": ["بررسی ظاهری زاویه حفاظ فرز", "تست سلامت صفحه سنگ"],
                "requires_field_verification": True,
            },
            {
                "temporary_id": "H4",
                "title": "سقوط بار در اثر خرابی سیم‌بکسل جرثقیل سقفی",
                "description": "حمل تیرآهن و ورق‌های سنگین با جرثقیل سقفی در صورت فرسودگی سیم‌بکسل یا قلاب منجر به سقوط بار روی پرسنل می‌شود.",
                "hazard_category": "mechanical",
                "source_classification": "potential",
                "related_activity": "جابجایی و باربرداری قطعات سنگین فولادی",
                "related_equipment": "جرثقیل سقفی ۵ تن",
                "exposed_groups": ["ریگر", "اپراتور جرثقیل", "کلیه حاضرین در سالن"],
                "exposure_route": "سقوط ثقلی بار",
                "possible_consequences": ["مرگبار", "له‌شدگی شدید", "تخریب سازه"],
                "proposed_probability": 2,
                "proposed_severity": 5,
                "calculated_score": 10,
                "proposed_risk_level": "high",
                "recommended_controls": [
                    "بازرسی روزانه سیم‌بکسل و ضامن شیطانک قلاب",
                    "تست ادواری و صدور گواهی سلامت ۶ ماهه جرثقیل",
                    "تعیین خط قرمز حریم باربرداری و ممانعت از ایستادن زیر بار",
                ],
                "inspection_evidence": ["دفترچه ثبت بازرسی جرثقیل", "برچسب سرتیفیکیت معتبر"],
                "requires_field_verification": True,
            },
            {
                "temporary_id": "H5",
                "title": "مواجهه مداوم با صدای فراتر از حد مجاز شغلی",
                "description": "عملکرد همزمان پرس‌ها، برشکاری و سنگ‌زنی تراز صوتی بالاتر از ۸۵ دسی‌بل ایجاد می‌کند.",
                "hazard_category": "physical",
                "source_classification": "inferred",
                "related_activity": "عملیات عمومی ساخت و مونتاژ",
                "related_equipment": "کمپرسور، اره نواری، سنگ‌فرز",
                "exposed_groups": ["کلیه شاغلین سالن"],
                "exposure_route": "امواج صوتی هوابرد",
                "possible_consequences": ["افت شنوایی حسی-عصبی ناشی از کار (NIHL)", "استرس و خستگی"],
                "proposed_probability": 4,
                "proposed_severity": 2,
                "calculated_score": 8,
                "proposed_risk_level": "medium",
                "recommended_controls": [
                    "عایق‌بندی صوتی اتاقک کمپرسور",
                    "توزیع ایرپلاگ و ایرماف متناسب با تراز صدا",
                    "سنجش سالانه تراز مواجهه صوت و ادیومتری پرسنل",
                ],
                "inspection_evidence": ["سوابق ادیومتری طب کار", "گزارش اندازه‌گیری عوامل زیان‌آور"],
                "requires_field_verification": True,
            },
        ],
        "recommended_controls": [
            "تجهیز سریع پرس‌های مکانیکی و هیدرولیکی به پرده نوری و استپ اضطراری",
            "اجرای سامانه جامع قرنطینه و قفل‌گذاری انرژی (LOTO) در تعمیرات",
            "طراحی ایستگاه‌های ارگونومیک جوشکاری همراه با تهویه مکنده موضعی",
        ],
        "emergency_considerations": [
            "در دسترس بودن کپسول‌های پودر و گاز CO2 در فاصله کمتر از ۱۰ متری ایستگاه‌های جوش",
            "روشن و آزاد بودن مسیرهای خروج اضطراری و عدم سد معبر توسط پالت‌ها",
            "کلید قطع برق اضطراری اصلی سالن در دسترس سرپرست کارگاه باشد",
        ],
        "expert_review_items": [
            "بازرسی فنی چاه ارت توسط کارشناس رسمی دادگستری یا بازرس واجد صلاحیت وزارت کار",
            "تست ضخامت‌سنجی التراسونیک بدنه مخزن تحت فشار باد",
        ],
        "checklist": {
            "title": f"چک‌لیست بازرسی ایمنی و بهداشت حرفه‌ای کارگاه {workplace_name}",
            "description": "چک‌لیست تدوین‌شده با هوش مصنوعی HSE Guard برای پایش میدانی ماشین‌آلات، خطرات فیزیکی، شیمیایی و ارگونومی",
            "sections": [
                {
                    "temporary_id": "SEC-1",
                    "title": "ایمنی ماشین‌آلات، پرس‌ها و تجهیزات دوار",
                    "description": "بررسی حفاظ‌ها، میکروسوئیچ‌ها و سیستم‌های اینترلاک دستگاه‌ها",
                    "order": 1,
                    "items": [
                        {
                            "temporary_id": "CHK-1",
                            "title": "آیا پرس هیدرولیک دارای حفاظ مناسب، کلید فرمان دودستی یا پرده نوری سالم است؟",
                            "inspection_criterion": "در زمان پایین آمدن فک پرس، امکان ورود دست به ناحیه خطر وجود نداشته باشد و با برداشتن دست یا قطع نور پرده، جک بلافاصله متوقف شود.",
                            "description": "تست عملکرد با تکه چوب یا قطع چشمی",
                            "category": "safety",
                            "related_hazard_ids": ["H1"],
                            "evidence_required": ["مشاهده میدانی عملکرد سنسور نوری", "بررسی زمان پاسخ توقف"],
                            "recommended_controls": ["تنظیم سنسور پرده نوری", "کالیبراسیون شیر اطمینان"],
                            "response_type": "yes_no_na",
                            "is_critical": True,
                            "requires_measurement": False,
                            "measurement_unit": None,
                            "order": 1,
                        },
                        {
                            "temporary_id": "CHK-2",
                            "title": "آیا سنگ‌فرزهای دستی مجهز به حفاظ زاویه‌دار فابریک و دسته جانبی استاندارد هستند؟",
                            "inspection_criterion": "حفاظ فلزی باید حداقل ۱۸۰ درجه محیط صفحه سنگ را پوشش داده و جهت پاشش جرقه را به سمت زمین هدایت کند.",
                            "description": "بررسی عدم ترک یا لقی صفحه",
                            "category": "safety",
                            "related_hazard_ids": ["H3"],
                            "evidence_required": ["مشاهده چشمی کلیه سنگ‌فرزهای موجود در خط"],
                            "recommended_controls": ["جمع‌آوری فرزهای فاقد حفاظ"],
                            "response_type": "yes_no_na",
                            "is_critical": True,
                            "requires_measurement": False,
                            "measurement_unit": None,
                            "order": 2,
                        },
                        {
                            "temporary_id": "CHK-3",
                            "title": "آیا شستی‌های توقف اضطراری (Emergency Stop) ماشین‌آلات سالم، قارچی و قرمز رنگ هستند؟",
                            "inspection_criterion": "با فشردن شستی قارچی، برق تغذیه دستگاه قطع شده و تا زمان ریست دستی کلید، دستگاه مجدداً روشن نشود.",
                            "description": "آزمون عملکرد توقف اضطراری در حالت بی‌باری",
                            "category": "safety",
                            "related_hazard_ids": ["H1", "H3"],
                            "evidence_required": ["تست عملیاتی شستی توقف اضطراری"],
                            "recommended_controls": ["تعویض شستی‌های معیوب"],
                            "response_type": "yes_no_na",
                            "is_critical": True,
                            "requires_measurement": False,
                            "measurement_unit": None,
                            "order": 3,
                        },
                    ],
                },
                {
                    "temporary_id": "SEC-2",
                    "title": "ایمنی عملیات گرم، جوشکاری و خطرات حریق",
                    "description": "پایش سیستم‌های تهویه، کابل‌ها، کپسول‌ها و تمهیدات پیشگیری از حریق",
                    "order": 2,
                    "items": [
                        {
                            "temporary_id": "CHK-4",
                            "title": "آیا سیستم تهویه موضعی (مکش موضعی) در ایستگاه‌های جوشکاری فعال و متصل است؟",
                            "inspection_criterion": "دهانه مکنده بازویی در فاصله ۳۰ تا ۵۰ سانتی‌متری قوس الکتریکی قرار گرفته و دود را به بیرون یا فیلتر هدایت کند.",
                            "description": "بررسی جهت مکش با آزمون دود یا لمس جریان هوا",
                            "category": "health",
                            "related_hazard_ids": ["H2"],
                            "evidence_required": ["مشاهده وضعیت هودها و کانال‌های تخلیه"],
                            "recommended_controls": ["نصب بازویی مکنده موضعی"],
                            "response_type": "yes_no_na",
                            "is_critical": False,
                            "requires_measurement": True,
                            "measurement_unit": "m3/h",
                            "order": 1,
                        },
                        {
                            "temporary_id": "CHK-5",
                            "title": "آیا کپسول‌های آتش‌نشانی مناسب در محدوده ۱۰ متری ایستگاه‌های جوشکاری مستقر و شارژ هستند؟",
                            "inspection_criterion": "مانومتر کپسول در محدوده سبز، پلمپ سالم، تاریخ شارژ معتبر و دسترسی کاملاً بدون مانع باشد.",
                            "description": "بررسی کارت بازرسی ماهانه خاموش‌کننده‌ها",
                            "category": "safety",
                            "related_hazard_ids": ["H2"],
                            "evidence_required": ["کارت بازرسی کپسول", "عقربه فشارسنج"],
                            "recommended_controls": ["شارژ مجدد یا جایگزینی کپسول"],
                            "response_type": "yes_no_na",
                            "is_critical": True,
                            "requires_measurement": False,
                            "measurement_unit": None,
                            "order": 2,
                        },
                    ],
                },
                {
                    "temporary_id": "SEC-3",
                    "title": "باربرداری، لیفتراک و حمل‌ونقل مواد",
                    "description": "بررسی سیم‌بکسل‌ها، قلاب جرثقیل سقفی، دوشاخه لیفتراک و راه‌های تردد",
                    "order": 3,
                    "items": [
                        {
                            "temporary_id": "CHK-6",
                            "title": "آیا قلاب جرثقیل سقفی مجهز به ضامن شیطانک ایمنی سالم است و سیم‌بکسل فاقد زدگی است؟",
                            "inspection_criterion": "ضامن قلاب فنری و بسته باشد، سیم‌بکسل فاقد پیچ‌خوردگی (کینک)، رشته‌رشته شدن یا سوختگی باشد.",
                            "description": "بازرسی بصری قلاب و کابل جرثقیل",
                            "category": "safety",
                            "related_hazard_ids": ["H4"],
                            "evidence_required": ["مشاهده چشمی ضامن و سیم‌بکسل", "تست بالا/پایین میکروسوئیچ محدودکننده ارتفاع"],
                            "recommended_controls": ["تعویض سیم‌بکسل آسیب‌دیده", "نصب ضامن قلاب"],
                            "response_type": "yes_no_na",
                            "is_critical": True,
                            "requires_measurement": False,
                            "measurement_unit": None,
                            "order": 1,
                        },
                        {
                            "temporary_id": "CHK-7",
                            "title": "آیا خطوط تردد لیفتراک و عابر پیاده در کف سالن با رنگ زرد صنعتی تفکیک شده است؟",
                            "inspection_criterion": "مسیرهای عبور مشخص، عاری از هرگونه قطعه یا ضایعات بوده و راهروها حداقل ۱ متر پهن‌تر از عریض‌ترین بار لیفتراک باشند.",
                            "description": "بررسی وضعیت خط‌کشی و نظم و انضباط (5S)",
                            "category": "safety",
                            "related_hazard_ids": ["H4"],
                            "evidence_required": ["مشاهده کف کارگاه و معابر تردد"],
                            "recommended_controls": ["خط‌کشی مجدد کف سالن", "پاکسازی مسیر عبور"],
                            "response_type": "yes_no_na",
                            "is_critical": False,
                            "requires_measurement": False,
                            "measurement_unit": None,
                            "order": 2,
                        },
                    ],
                },
                {
                    "temporary_id": "SEC-4",
                    "title": "تجهیزات حفاظت فردی (PPE) و بهداشت محیط",
                    "description": "الزام استفاده از عینک، شیلد، کفش ایمنی، گوشی و ماسک تنفسی",
                    "order": 4,
                    "items": [
                        {
                            "temporary_id": "CHK-8",
                            "title": "آیا کارگران شاغل در سنگ‌زنی و جوشکاری از شیلد، عینک مناسب و کفش ایمنی استفاده می‌کنند؟",
                            "inspection_criterion": "کلیه شاغلین در زمان انجام کار عملیاتی باید ملبس به کفش ایمنی سرپنجه فولادی و محافظ چشمی استاندارد باشند.",
                            "description": "پایش رفتار ایمن پرسنل",
                            "category": "safety",
                            "related_hazard_ids": ["H3"],
                            "evidence_required": ["مشاهده چشمی پرسنل در حال کار"],
                            "recommended_controls": ["توزیع PPE مناسب", "آموزش و تذکر رفتاری"],
                            "response_type": "yes_no_na",
                            "is_critical": True,
                            "requires_measurement": False,
                            "measurement_unit": None,
                            "order": 1,
                        },
                        {
                            "temporary_id": "CHK-9",
                            "title": "آیا جعبه کمک‌های اولیه کارگاه تکمیل، دارای تاریخ مصرف معتبر و در دسترس است؟",
                            "inspection_criterion": "جعبه در محل مناسب نصب شده، دارای گاز استریل، بتادین، باند، پماد سوختگی و شست‌وشوی چشمی باشد.",
                            "description": "بررسی چک‌لیست اقلام جعبه امداد",
                            "category": "health",
                            "related_hazard_ids": ["H3", "H1"],
                            "evidence_required": ["مشاهده برچسب تاریخ و محتویات جعبه"],
                            "recommended_controls": ["تأمین اقلام مصرف‌شده امدادی"],
                            "response_type": "yes_no_na",
                            "is_critical": False,
                            "requires_measurement": False,
                            "measurement_unit": None,
                            "order": 2,
                        },
                    ],
                },
            ],
        },
        "overall_notes": [
            "این تحلیل توسط دستیار هوشمند HSE Guard و با رعایت استانداردهای ارزیابی ریسک صنعتی تدوین شده است.",
            "پیش از صدور نهایی چک‌لیست، کلیه بندها توسط کارشناس یا مدیر HSE سازمان مورد بازبینی و انطباق میدانی قرار گیرد.",
        ],
    }
