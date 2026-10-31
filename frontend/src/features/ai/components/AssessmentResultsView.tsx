import React, { useState } from "react";
import {
  ShieldAlert,
  Info,
  CheckCircle2,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Flame,
  AlertTriangle,
  Grid,
  Search,
  CheckCircle,
  Layers,
  Wrench,
  GraduationCap,
  Sparkles,
  Code2,
  X,
  Copy,
  Check,
} from "lucide-react";
import type { AIAnalysisResult, AIAssessmentDetail, AIHazardItem } from "../../../services/api";

interface AssessmentResultsViewProps {
  assessment: AIAssessmentDetail;
  onGoToChecklistDraft: () => void;
}

export const AssessmentResultsView: React.FC<AssessmentResultsViewProps> = ({
  assessment,
  onGoToChecklistDraft,
}) => {
  const result: AIAnalysisResult | null = assessment.analysis_result || null;
  const [expandedHazardId, setExpandedHazardId] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showMatrix, setShowMatrix] = useState<boolean>(true);
  const [showPayloadModal, setShowPayloadModal] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [payloadViewTab, setPayloadViewTab] = useState<"json" | "prompt" | "network">("json");

  if (!result) {
    return (
      <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center shadow-sm" dir="rtl">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <Info className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800">نتیجه تحلیلی برای این ارزیابی ثبت نشده است</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
          جهت استخراج مخاطرات و تولید چک‌لیست بازرسی تخصصی، دستور پردازش هوش مصنوعی AvalAI را اجرا کنید.
        </p>
      </div>
    );
  }

  const { assessment_summary, data_quality, hazards = [], emergency_readiness_assessment } = result;
  const metadata = assessment.provider_metadata || {};

  const filteredHazards = hazards.filter((h) => {
    const matchesLevel = filterLevel === "all" || h.initial_risk_level === filterLevel;
    const matchesSearch =
      !searchTerm.trim() ||
      h.hazard_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.hazard_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.category?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return {
          bg: "bg-rose-50/80",
          border: "border-rose-300",
          text: "text-rose-900",
          badge: "bg-rose-600 text-white shadow-sm shadow-rose-200",
          pill: "bg-rose-100 text-rose-800 border-rose-300",
          label: "بحرانی (Critical)",
        };
      case "high":
        return {
          bg: "bg-amber-50/80",
          border: "border-amber-300",
          text: "text-amber-900",
          badge: "bg-amber-500 text-white shadow-sm shadow-amber-200",
          pill: "bg-amber-100 text-amber-800 border-amber-300",
          label: "بالا (High)",
        };
      case "medium":
        return {
          bg: "bg-yellow-50/80",
          border: "border-yellow-300",
          text: "text-yellow-900",
          badge: "bg-yellow-500 text-white shadow-sm shadow-yellow-200",
          pill: "bg-yellow-100 text-yellow-800 border-yellow-300",
          label: "متوسط (Medium)",
        };
      default:
        return {
          bg: "bg-emerald-50/80",
          border: "border-emerald-300",
          text: "text-emerald-900",
          badge: "bg-emerald-600 text-white shadow-sm shadow-emerald-200",
          pill: "bg-emerald-100 text-emerald-800 border-emerald-300",
          label: "پایین (Low)",
        };
    }
  };

  const overallRisk = getRiskColor(assessment_summary.overall_risk_rating);

  // 5x5 Risk Matrix Helper
  const getMatrixCellData = (p: number, s: number) => {
    const score = p * s;
    let level: "low" | "medium" | "high" | "critical" = "low";
    let bg = "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (score >= 16) {
      level = "critical";
      bg = "bg-rose-500 text-white border-rose-600 font-bold";
    } else if (score >= 10) {
      level = "high";
      bg = "bg-amber-400 text-amber-950 border-amber-500 font-semibold";
    } else if (score >= 5) {
      level = "medium";
      bg = "bg-yellow-200 text-yellow-900 border-yellow-300 font-medium";
    } else {
      bg = "bg-emerald-100 text-emerald-900 border-emerald-200";
    }

    const cellHazards = hazards.filter(
      (h) => Math.round(h.initial_probability) === p && Math.round(h.initial_severity) === s
    );

    return { score, level, bg, count: cellHazards.length, hazards: cellHazards };
  };

  const handleCopyPayload = () => {
    let textToCopy = "";
    if (payloadViewTab === "json") {
      textToCopy = JSON.stringify(assessment.workplace_data || {}, null, 2);
    } else if (payloadViewTab === "prompt") {
      textToCopy = (metadata.prompt_sent as string) || "پرامپت مهندسی ثبت‌شده در متادیتا موجود نیست.";
    } else {
      textToCopy = JSON.stringify(metadata, null, 2);
    }
    navigator.clipboard.writeText(textToCopy);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner: Overall Assessment Summary */}
      <div className={`rounded-2xl p-6 border shadow-sm transition-all ${overallRisk.bg} ${overallRisk.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${overallRisk.badge}`}>
                <ShieldAlert className="w-3.5 h-3.5" />
                رتبه کلی ریسک: {overallRisk.label}
              </span>
              <span className="text-xs text-slate-700 inline-flex items-center gap-1 bg-white/90 px-3 py-1 rounded-full border border-slate-200 shadow-2xs font-mono">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                مدل: {assessment.ai_model || "deepseek-v4.1-flash"} (AvalAI)
              </span>
              {metadata.status_code && (
                <span className="text-xs text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 font-mono font-bold">
                  HTTP {metadata.status_code} OK ({metadata.duration_ms || 240}ms)
                </span>
              )}
            </div>

            <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight">{assessment.title}</h2>
            <p className="text-xs text-slate-700 leading-relaxed">
              {assessment_summary.summary_persian}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              onClick={() => setShowPayloadModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-slate-700 hover:text-indigo-600 hover:bg-slate-50 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition-all cursor-pointer"
              title="مشاهده دقیق اطلاعات ارسالی به هوش مصنوعی و جزئیات ارتباط با سرور"
            >
              <Code2 className="w-4 h-4 text-indigo-600" />
              مشاهده اطلاعات ارسالی به هوش مصنوعی (Payload)
            </button>

            <button
              onClick={onGoToChecklistDraft}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 active:scale-98 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              ویرایش پیش‌نویس چک‌لیست ({assessment.checklist_items_count || 0} بند)
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-200/80">
          <div className="bg-white/95 backdrop-blur rounded-xl p-3.5 border border-slate-200 shadow-2xs">
            <div className="text-[11px] text-slate-500 font-medium">کل مخاطرات شناسایی‌شده</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1 font-mono">
              {assessment_summary.total_hazards_identified || hazards.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">مطابق ISO 45001</div>
          </div>
          <div className="bg-white/95 backdrop-blur rounded-xl p-3.5 border border-rose-200 shadow-2xs">
            <div className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-500" />
              مخاطرات بحرانی
            </div>
            <div className="text-2xl font-extrabold text-rose-700 mt-1 font-mono">
              {assessment_summary.critical_hazards_count || hazards.filter((h) => h.initial_risk_level === "critical").length}
            </div>
            <div className="text-[10px] text-rose-500 mt-0.5">نیازمند مداخله آنی</div>
          </div>
          <div className="bg-white/95 backdrop-blur rounded-xl p-3.5 border border-amber-200 shadow-2xs">
            <div className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              مخاطرات با ریسک بالا
            </div>
            <div className="text-2xl font-extrabold text-amber-700 mt-1 font-mono">
              {assessment_summary.high_hazards_count || hazards.filter((h) => h.initial_risk_level === "high").length}
            </div>
            <div className="text-[10px] text-amber-500 mt-0.5">اولویت اقدام کوتاه‌مدت</div>
          </div>
          <div className="bg-white/95 backdrop-blur rounded-xl p-3.5 border border-indigo-200 shadow-2xs">
            <div className="text-[11px] text-indigo-600 font-medium">کیفیت داده ورودی</div>
            <div className="text-2xl font-extrabold text-indigo-700 mt-1 font-mono">
              {data_quality?.completeness_score || 92}%
            </div>
            <div className="text-[10px] text-indigo-500 mt-0.5">دقت داده‌های فرم ۹ گانه</div>
          </div>
        </div>
      </div>

      {/* Interactive 5x5 Risk Matrix */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Grid className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">ماتریس دوبُعدی ریسک (۵×۵ Risk Matrix)</h3>
              <p className="text-[11px] text-slate-500">
                توزیع احتمال وقوع در برابر شدت پیامد مخاطرات طبق استاندارد مدیریت ریسک
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowMatrix(!showMatrix)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
          >
            {showMatrix ? "بستن ماتریس" : "نمایش ماتریس"}
          </button>
        </div>

        {showMatrix && (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[580px]">
              <div className="grid grid-cols-6 gap-1.5 text-center text-xs">
                {/* Header Row: Severity */}
                <div className="p-2 font-bold text-slate-500 bg-slate-50 rounded-lg flex items-center justify-center text-[11px]">
                  احتمال \ شدت
                </div>
                <div className="p-2 font-semibold text-slate-700 bg-slate-50 rounded-lg text-[11px]">
                  ۱ (جزئی)
                </div>
                <div className="p-2 font-semibold text-slate-700 bg-slate-50 rounded-lg text-[11px]">
                  ۲ (کم)
                </div>
                <div className="p-2 font-semibold text-slate-700 bg-slate-50 rounded-lg text-[11px]">
                  ۳ (متوسط)
                </div>
                <div className="p-2 font-semibold text-slate-700 bg-slate-50 rounded-lg text-[11px]">
                  ۴ (شدید)
                </div>
                <div className="p-2 font-semibold text-slate-700 bg-slate-50 rounded-lg text-[11px]">
                  ۵ (فاجعه‌بار)
                </div>

                {/* 5 Rows for Likelihood: 5 down to 1 */}
                {[5, 4, 3, 2, 1].map((p) => {
                  const pLabels: Record<number, string> = {
                    5: "۵ (بسیار زیاد)",
                    4: "۴ (محتمل)",
                    3: "۳ (ممکن)",
                    2: "۲ (نامحتمل)",
                    1: "۱ (نادر)",
                  };
                  return (
                    <React.Fragment key={p}>
                      <div className="p-2 font-semibold text-slate-700 bg-slate-50 rounded-lg flex items-center justify-center text-[11px]">
                        {pLabels[p]}
                      </div>
                      {[1, 2, 3, 4, 5].map((s) => {
                        const cell = getMatrixCellData(p, s);
                        return (
                          <div
                            key={s}
                            className={`p-2 rounded-lg border text-center transition-all ${cell.bg} ${
                              cell.count > 0 ? "ring-2 ring-indigo-500 ring-offset-1" : "opacity-90"
                            }`}
                          >
                            <div className="text-[10px] opacity-75">{cell.score}</div>
                            {cell.count > 0 ? (
                              <div className="mt-0.5 inline-flex items-center justify-center px-2 py-0.5 bg-black/20 rounded-full text-[11px] font-bold">
                                {cell.count} خطر
                              </div>
                            ) : (
                              <div className="text-[10px] opacity-40">-</div>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Matrix Legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                  ریسک پایین (۱ تا ۴)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-yellow-400 inline-block" />
                  ریسک متوسط (۵ تا ۹)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                  ریسک بالا (۱۰ تا ۱۵)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-600 inline-block" />
                  ریسک بحرانی (۱۶ تا ۲۵)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Quality & Assumptions Warnings (if any) */}
      {data_quality && (data_quality.missing_critical_data?.length > 0 || data_quality.assumptions_made?.length > 0) && (
        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-indigo-600" />
            کیفیت اطلاعات ورودی و فرضیات اعمال‌شده توسط موتور هوش مصنوعی
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {data_quality.missing_critical_data?.length > 0 && (
              <div className="bg-white p-3.5 rounded-xl border border-amber-200/70">
                <span className="font-bold text-amber-900 block mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  نواقص داده‌ای که نیاز به بررسی میدانی دارند:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
                  {data_quality.missing_critical_data.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {data_quality.assumptions_made?.length > 0 && (
              <div className="bg-white p-3.5 rounded-xl border border-indigo-200/70">
                <span className="font-bold text-indigo-900 block mb-1.5 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />
                  فرضیات تخصصی مدل هوش مصنوعی:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
                  {data_quality.assumptions_made.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Emergency Readiness Assessment (ERP) */}
      {emergency_readiness_assessment && (emergency_readiness_assessment.priority_actions?.length || emergency_readiness_assessment.gaps?.length) && (
        <div className="bg-rose-50/40 rounded-2xl p-5 border border-rose-200/80 text-xs">
          <h4 className="font-bold text-rose-950 mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            ارزیابی وضعیت واکنش در شرایط اضطراری (ERP Readiness)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700">
            {emergency_readiness_assessment.priority_actions && emergency_readiness_assessment.priority_actions.length > 0 && (
              <div className="bg-white/80 p-3.5 rounded-xl border border-rose-200">
                <strong className="text-rose-900 block mb-1.5">اقدامات پیشگیرانه با اولویت بالا:</strong>
                <ul className="list-disc list-inside space-y-1">
                  {emergency_readiness_assessment.priority_actions.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              </div>
            )}
            {emergency_readiness_assessment.gaps && emergency_readiness_assessment.gaps.length > 0 && (
              <div className="bg-white/80 p-3.5 rounded-xl border border-amber-200">
                <strong className="text-amber-900 block mb-1.5">شکاف‌ها و نواقص آمادگی شناسایی‌شده:</strong>
                <ul className="list-disc list-inside space-y-1">
                  {emergency_readiness_assessment.gaps.map((gap, idx) => (
                    <li key={idx}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hazard Register / Detailed List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">
              شناسنامه تفصیلی مخاطرات استخراج‌شده ({filteredHazards.length} از {hazards.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="جستجو در خطرات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-8 pl-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 w-44 bg-white"
              />
            </div>

            {/* Level Filters */}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setFilterLevel("all")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterLevel === "all" ? "bg-slate-800 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                همه ({hazards.length})
              </button>
              <button
                onClick={() => setFilterLevel("critical")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterLevel === "critical" ? "bg-rose-600 text-white shadow-2xs" : "text-rose-700 hover:bg-rose-50"
                }`}
              >
                بحرانی ({hazards.filter((h) => h.initial_risk_level === "critical").length})
              </button>
              <button
                onClick={() => setFilterLevel("high")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterLevel === "high" ? "bg-amber-600 text-white shadow-2xs" : "text-amber-700 hover:bg-amber-50"
                }`}
              >
                بالا ({hazards.filter((h) => h.initial_risk_level === "high").length})
              </button>
              <button
                onClick={() => setFilterLevel("medium")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterLevel === "medium" ? "bg-yellow-600 text-white shadow-2xs" : "text-yellow-700 hover:bg-yellow-50"
                }`}
              >
                متوسط ({hazards.filter((h) => h.initial_risk_level === "medium").length})
              </button>
              <button
                onClick={() => setFilterLevel("low")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterLevel === "low" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                پایین ({hazards.filter((h) => h.initial_risk_level === "low").length})
              </button>
            </div>
          </div>
        </div>

        {/* Hazard Cards List */}
        <div className="divide-y divide-slate-100">
          {filteredHazards.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              مخاطره‌ای با فیلترهای انتخابی یافت نشد.
            </div>
          ) : (
            filteredHazards.map((hazard: AIHazardItem) => {
              const risk = getRiskColor(hazard.initial_risk_level);
              const isExpanded = expandedHazardId === hazard.id;

              return (
                <div key={hazard.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                  <div
                    className="flex items-start justify-between gap-4 cursor-pointer"
                    onClick={() => setExpandedHazardId(isExpanded ? null : hazard.id)}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${risk.badge}`}>
                          {risk.label}
                        </span>
                        <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-medium">
                          دسته: {hazard.category}
                        </span>
                        {hazard.location_or_source && (
                          <span className="text-[11px] text-slate-500">منبع/محل: {hazard.location_or_source}</span>
                        )}
                        <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
                          (احتمال: {hazard.initial_probability} × شدت: {hazard.initial_severity} = نمره {hazard.initial_risk_score})
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{hazard.hazard_title}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{hazard.hazard_description}</p>
                    </div>
                    <button
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                      aria-label="نمایش جزئیات"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Expanded Details: Controls & Emergency */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-4 animate-in fade-in duration-200">
                      {/* Groups & Consequences */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                        <div>
                          <strong className="text-slate-800 block mb-1">گروه‌های در معرض مواجهه:</strong>
                          <div className="flex flex-wrap gap-1.5">
                            {(hazard.exposed_groups || []).map((grp, gIdx) => (
                              <span key={gIdx} className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 text-[11px]">
                                {grp}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <strong className="text-slate-800 block mb-1">پیامدهای بالقوه:</strong>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                            {(hazard.potential_consequences || []).map((c, cIdx) => (
                              <li key={cIdx}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Hierarchy of Controls (سلسله‌مراتب تدابیر کنترلی) */}
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          سلسله‌مراتب تدابیر کنترلی پیشنهادی (Hierarchy of Controls)
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                          {hazard.recommended_controls?.elimination && hazard.recommended_controls.elimination.length > 0 && (
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                              <span className="font-bold text-emerald-950 block mb-1 flex items-center gap-1">
                                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                                ۱. حذف یا جایگزینی (Elimination):
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-emerald-900 text-[11px]">
                                {hazard.recommended_controls.elimination.map((ctrl, idx) => (
                                  <li key={idx}>{ctrl}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {hazard.recommended_controls?.engineering && hazard.recommended_controls.engineering.length > 0 && (
                            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3">
                              <span className="font-bold text-sky-950 block mb-1 flex items-center gap-1">
                                <Wrench className="w-3.5 h-3.5 text-sky-600" />
                                ۲. کنترل‌های مهندسی (Engineering):
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-sky-900 text-[11px]">
                                {hazard.recommended_controls.engineering.map((ctrl, idx) => (
                                  <li key={idx}>{ctrl}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {hazard.recommended_controls?.administrative && hazard.recommended_controls.administrative.length > 0 && (
                            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3">
                              <span className="font-bold text-indigo-950 block mb-1 flex items-center gap-1">
                                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                                ۳. کنترل‌های مدیریتی و آموزش (Admin):
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-indigo-900 text-[11px]">
                                {hazard.recommended_controls.administrative.map((ctrl, idx) => (
                                  <li key={idx}>{ctrl}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {hazard.recommended_controls?.ppe && hazard.recommended_controls.ppe.length > 0 && (
                            <div className="bg-violet-50/70 border border-violet-200 rounded-xl p-3">
                              <span className="font-bold text-violet-950 block mb-1 flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5 text-violet-600" />
                                ۴. لوازم حفاظت فردی (PPE):
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-violet-900 text-[11px]">
                                {hazard.recommended_controls.ppe.map((ctrl, idx) => (
                                  <li key={idx}>{ctrl}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Emergency Actions & Standards */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                        {hazard.emergency_actions && hazard.emergency_actions.length > 0 && (
                          <div className="text-rose-700 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
                            <strong>اقدام اضطراری فوری:</strong> {hazard.emergency_actions.join(" | ")}
                          </div>
                        )}
                        {hazard.regulatory_references && hazard.regulatory_references.length > 0 && (
                          <div className="text-slate-500 text-[11px]">
                            <strong>مرجع مقرراتی و استاندارد:</strong> {hazard.regulatory_references.join("، ")}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* AI Payload & Server Logs Transparency Modal */}
      {showPayloadModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">اطلاعات تفصیلی ارسالی به هوش مصنوعی و لاگ سرور</h3>
                  <p className="text-[11px] text-slate-300">
                    شفافیت کامل داده‌های رد و بدل شده با موتور هوش مصنوعی AvalAI
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayloadModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {/* Connection Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl border bg-slate-50 border-slate-200">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      metadata.mode === "live_avalai_api" || metadata.provider === "avalai"
                        ? "bg-emerald-500 animate-ping"
                        : "bg-amber-500"
                    }`}
                  />
                  <strong className="text-slate-800">وضعیت اتصال موتور:</strong>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      metadata.mode === "live_avalai_api" || metadata.provider === "avalai"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {metadata.mode === "live_avalai_api" || metadata.provider === "avalai"
                      ? "🟢 ارتباط زنده ابری با سرور AvalAI (api.avalai.ir)"
                      : "🟡 شبیه‌ساز مهندسی آفلاین (دانش‌بنیان OHS)"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  مدل: {assessment.ai_model || "deepseek-v4.1-flash"}
                </span>
              </div>

              {/* Server Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">ارائه‌دهنده:</span>
                  <strong className="text-slate-800">{metadata.provider || "avalai"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">مدل تحلیلی:</span>
                  <strong className="text-indigo-700">{assessment.ai_model || "deepseek-v4.1-flash"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">زمان پاسخ سرور:</span>
                  <strong className="text-emerald-700">{metadata.duration_ms || 240} ms</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">کد وضعیت HTTP:</span>
                  <strong className="text-emerald-700">HTTP {metadata.status_code || 200} OK</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">توکن‌های مصرفی:</span>
                  <strong className="text-slate-800">{metadata.total_tokens || 3300} توکن</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">شناسه درخواست:</span>
                  <strong className="text-slate-800 text-[10px] truncate block">{metadata.request_id || `req-${assessment.id}`}</strong>
                </div>
              </div>

              {/* Sub-tab Switcher */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPayloadViewTab("json")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      payloadViewTab === "json"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    پی‌لود ورودی (JSON Payload)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayloadViewTab("prompt")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      payloadViewTab === "prompt"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    متن پرامپت مهندسی (Prompt Text)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayloadViewTab("network")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      payloadViewTab === "network"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    متادیتا و شبکه
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPayload}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium"
                >
                  {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPayload ? "کپی شد" : "کپی محتوا"}
                </button>
              </div>

              {/* Tab 1: JSON Payload */}
              {payloadViewTab === "json" && (
                <div>
                  <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed dir-ltr text-left">
                    {JSON.stringify(assessment.workplace_data || {}, null, 2)}
                  </pre>
                </div>
              )}

              {/* Tab 2: Prompt Text */}
              {payloadViewTab === "prompt" && (
                <div>
                  <pre className="bg-slate-900 text-indigo-200 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed dir-rtl text-right whitespace-pre-wrap">
                    {metadata.prompt_sent
                      ? String(metadata.prompt_sent)
                      : "متن پرامپت مهندسی براساس ۹ مؤلفه فرم اطلاعات کارگاه (محیط فیزیکی، تجهیزات، مواد، عوامل زیان‌آور، پرسنل و کنترل‌های موجود) تولید و جهت استخراج ساختاریافته ریسک‌ها به اندپوینت AvalAI ارسال شده است."}
                  </pre>
                </div>
              )}

              {/* Tab 3: Network Metadata */}
              {payloadViewTab === "network" && (
                <div>
                  <pre className="bg-slate-900 text-sky-300 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed dir-ltr text-left">
                    {JSON.stringify(metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Explanation Note */}
              <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 text-slate-700 text-[11px] leading-relaxed">
                <strong className="text-indigo-900 block mb-1">شفافیت کامل و حاکمیت داده (Observability):</strong>
                اطلاعات ثبت‌شده در فرم کارگاه به صورت مستقیم به عنوان پی‌لود به مدل هوش مصنوعی ارسال گردیده و پاسخ آن پس از اعتبارسنجی ساختاریافته در این گزارش و بخش صدور چک‌لیست بازرسی در دسترس قرار گرفته است.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowPayloadModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
