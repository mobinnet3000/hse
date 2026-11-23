import React, { useEffect, useState } from "react";
import {
  X,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Building2,
  HardHat,
  GitBranch,
  FileCheck,
  Check,
} from "lucide-react";
import {
  fetchRiskRegisterDetail,
  approveRiskRegister,
  type RiskRegisterDetail,
} from "../../../services/api";

interface Props {
  registerId: string | null;
  onClose: () => void;
  onApproveSuccess?: () => void;
}

export const RiskRegisterDetailDrawer: React.FC<Props> = ({
  registerId,
  onClose,
  onApproveSuccess,
}) => {
  const [data, setData] = useState<RiskRegisterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  // Approval input state
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalAuthority, setApprovalAuthority] = useState("شورای عالی حفاظت فنی مجتمع");
  const [approvalNotes, setApprovalNotes] = useState("تصویب رسمی با شرط استقرار مستمر مراقب و بازرسی هفتگی");
  const [acceptanceStatus, setAcceptanceStatus] = useState("acceptable");

  useEffect(() => {
    if (!registerId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchRiskRegisterDetail(registerId)
      .then((res) => setData(res))
      .catch((err) => setError(err.message || "خطا در دریافت جزئیات ارزیابی ریسک"))
      .finally(() => setLoading(false));
  }, [registerId]);

  if (!registerId) return null;

  const handleApprove = async () => {
    if (!registerId) return;
    setApproving(true);
    try {
      await approveRiskRegister(registerId, {
        acceptance_authority: approvalAuthority,
        approval_notes: approvalNotes,
        risk_acceptance_status: acceptanceStatus,
      });
      const updated = await fetchRiskRegisterDetail(registerId);
      setData(updated);
      setShowApproveDialog(false);
      onApproveSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در تصویب ارزیابی ریسک");
    } finally {
      setApproving(false);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-rose-950/70 border-rose-600/80 text-rose-300";
      case "high":
        return "bg-orange-950/60 border-orange-500/70 text-orange-300";
      case "medium":
        return "bg-amber-950/60 border-amber-500/70 text-amber-300";
      default:
        return "bg-emerald-950/60 border-emerald-600/70 text-emerald-300";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs font-farsi" dir="rtl">
      <div className="bg-slate-900 border-r border-slate-800 w-full max-w-3xl h-full flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 font-mono">
                  {data?.register_code || "در حال بارگذاری..."}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  ویرایش {data?.revision || 1}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-1">{data?.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
              در حال دریافت جزئیات پرونده ارزیابی ریسک...
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Status and Traceability banner */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        data.status === "approved"
                          ? "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                          : "bg-amber-950/60 text-amber-300 border-amber-800"
                      }`}
                    >
                      {data.status_display}
                    </span>
                    <span className="text-xs text-slate-400">تاریخ ارزیابی: {data.assessment_date}</span>
                    {data.next_review_date && (
                      <span className="text-xs text-slate-400">| موعد بازنگری: {data.next_review_date}</span>
                    )}
                  </div>

                  {data.status !== "approved" && (
                    <button
                      type="button"
                      disabled={approving}
                      onClick={() => setShowApproveDialog(true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 shadow-sm transition disabled:opacity-50"
                    >
                      تصویب و صدور ردپای رسمی
                    </button>
                  )}
                </div>

                {/* Traceability Node info */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 border-t border-slate-800 pt-2 font-mono">
                  <GitBranch className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>شناسه ردیابی:</span>
                  <span className="text-amber-300 font-bold">
                    {data.traceability_chain_id || `TRC-RSK-${data.register_code.replace("RR-", "")}`}
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded font-sans">
                    متصل به Incident / CAPA / Audit
                  </span>
                </div>

                {/* Audit Trail Code */}
                {data.audit_trail_code && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>کد ممیزی یکپارچه:</span>
                    <span className="text-emerald-300">{data.audit_trail_code}</span>
                  </div>
                )}
              </div>

              {/* Approval Modal Box */}
              {showApproveDialog && (
                <div className="p-4 bg-slate-950 border border-amber-500 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>تصویب رسمی پرونده و فعال‌سازی چرخه عمر ریسک (مرحله ۱۱)</span>
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-slate-300 mb-1">وضعیت پذیرش ریسک:</label>
                      <select
                        value={acceptanceStatus}
                        onChange={(e) => setAcceptanceStatus(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                      >
                        <option value="acceptable">قابل قبول (Broadly Acceptable)</option>
                        <option value="tolerable_alarp">قابل تحمل در محدوده ALARP</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">مرجع یا شخص تاییدکننده صلاحیت:</label>
                      <input
                        type="text"
                        value={approvalAuthority}
                        onChange={(e) => setApprovalAuthority(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">شروط یا یادداشت‌های تصویب:</label>
                      <textarea
                        rows={2}
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowApproveDialog(false)}
                        className="px-3 py-1.5 rounded-xl text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
                      >
                        انصراف
                      </button>
                      <button
                        type="button"
                        disabled={approving}
                        onClick={handleApprove}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {approving ? "در حال ثبت..." : "تایید و تصویب نهایی ✓"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Context Summary (Step 1) */}
              <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
                <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>اطلاعات زمینه سازمانی (Assessment Context - مرحله ۱)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-slate-400">
                  <div>
                    <span className="text-slate-500">پروژه:</span> {data.project_name || "-"}
                  </div>
                  <div>
                    <span className="text-slate-500">واحد سازمانی:</span> {data.department || "-"}
                  </div>
                  <div>
                    <span className="text-slate-500">محل فعالیت:</span> {data.site_location || "-"}
                  </div>
                  <div>
                    <span className="text-slate-500">ناحیه:</span> {data.area || "-"}
                  </div>
                  <div>
                    <span className="text-slate-500">فاز پروژه:</span> {data.project_phase || "-"}
                  </div>
                  <div>
                    <span className="text-slate-500">نوع عملیات:</span> {data.operation_type || "-"}
                  </div>
                  <div>
                    <span className="text-slate-500">کارفرما:</span> {data.client_name || "-"}
                  </div>
                  <div>
                    <span className="text-slate-500">پیمانکار:</span> {data.contractor_name || "-"}
                  </div>
                  <div>
                    <span className="text-slate-500">ثبت‌کننده:</span> {data.created_by_name || "-"}
                  </div>
                </div>
              </div>

              {/* Governance & Sign-off Details (Step 11) */}
              {(data.approved_by_name || data.acceptance_authority || data.approval_notes) && (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2 text-xs">
                  <h4 className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4" />
                    <span>حاکمیت، تاییدیه و پذیرش ریسک (مرحله ۱۱)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500">وضعیت پذیرش:</span>{" "}
                      <span className="text-emerald-400 font-bold">
                        {data.risk_acceptance_status === "acceptable" ? "قابل قبول" : data.risk_acceptance_status || "تاییدشده"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">مرجع پذیرش:</span> {data.acceptance_authority || data.approved_by_name}
                    </div>
                  </div>
                  {data.approval_notes && (
                    <div className="text-[11px] text-slate-400 bg-slate-900 p-2 rounded-xl mt-1">
                      شروط تصویب: {data.approval_notes}
                    </div>
                  )}
                </div>
              )}

              {/* Activities, Hazards, Scenarios & Controls (Steps 2 through 10) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <HardHat className="w-4 h-4 text-blue-400" />
                  <span>فعالیت‌ها، منابع خطر، سناریوها و ماتریس HAER ({data.activities.length})</span>
                </h4>

                {data.activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4"
                  >
                    {/* Activity Info (Step 2) */}
                    <div className="border-b border-slate-800 pb-2">
                      <div className="text-xs font-bold text-slate-200">{act.activity_title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        وظیفه: {act.task_name} | تجهیزات: {act.equipment || "-"} | مواد: {act.materials || "-"} | نفرات:{" "}
                        {act.personnel_count} نفر ({act.competency || "صلاحیت عمومی"})
                      </div>
                      {act.job_steps && act.job_steps.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {act.job_steps.map((st, i) => (
                            <span key={i} className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-300">
                              گام {i + 1}: {st}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Hazards inside Activity (Step 3) */}
                    {act.hazards.map((hz) => (
                      <div key={hz.id} className="pl-2 border-r-2 border-slate-700 pr-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-semibold text-amber-300">
                            [{hz.domain_display}] {hz.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{hz.description}</p>

                        {/* Scenarios (Step 4) */}
                        {hz.scenarios.map((sc) => (
                          <div
                            key={sc.id}
                            className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-200">
                                {sc.scenario_title}
                              </span>
                              {sc.overall_current_risk && (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-mono border ${getRiskBadge(
                                    sc.overall_current_risk.overall_level
                                  )}`}
                                >
                                  RPN جاری = {sc.overall_current_risk.overall_rpn}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-400">
                              رویداد ناخواسته: {sc.undesired_event}
                            </p>

                            {/* 4-way Conceptual Distinction Callout (Step 4) */}
                            <div className="p-2 bg-slate-950 rounded-xl text-[10px] border border-slate-800 text-slate-400 grid grid-cols-2 gap-1.5">
                              <div><span className="text-amber-400 font-bold">منبع خطر:</span> {hz.category}</div>
                              <div><span className="text-amber-400 font-bold">رویداد:</span> {sc.undesired_event || "رخداد حادثه"}</div>
                              <div><span className="text-amber-400 font-bold">سناریو:</span> {sc.scenario_title}</div>
                              <div><span className="text-amber-400 font-bold">علت آغازگر:</span> {sc.initiating_event || "-"}</div>
                            </div>

                            {/* HAER Scores Badges (Steps 7, 8, 10) */}
                            <div className="space-y-1">
                              <div className="text-[10px] text-slate-500 font-semibold">ارزیابی ابعاد پیامد (HAER):</div>
                              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                                {sc.scores
                                  .filter((s) => s.phase === "current")
                                  .map((s) => (
                                    <div
                                      key={s.id}
                                      className="p-1.5 bg-slate-950 rounded-lg text-center border border-slate-800"
                                    >
                                      <div className="text-[9px] text-slate-400">{s.dimension_display || s.dimension}</div>
                                      <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">
                                        RPN={s.rpn} ({s.likelihood}×{s.severity})
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>

                            {/* Existing Controls (Step 6) */}
                            {sc.existing_controls.length > 0 && (
                              <div className="text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                                <span className="text-slate-500 font-semibold">کنترل‌های موجود: </span>
                                {sc.existing_controls.map((c) => (
                                  <span
                                    key={c.id}
                                    className="inline-block mr-1 px-1.5 py-0.5 bg-slate-800 rounded text-[10px]"
                                  >
                                    {c.description} ({c.hierarchy_display || c.hierarchy})
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Treatments (Step 9) */}
                            {sc.treatments.length > 0 && (
                              <div className="text-[11px] text-emerald-400 border-t border-slate-800/60 pt-2 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  اقدام اصلاحی: {sc.treatments[0].action_description} (مهلت:{" "}
                                  {sc.treatments[0].due_date})
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
