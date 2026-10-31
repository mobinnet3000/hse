import React, { useState } from "react";
import { ShieldCheck, AlertTriangle, X, Check, FileCheck, Building2, ClipboardList } from "lucide-react";
import type { AIAssessmentDetail } from "../../../services/api";

interface AssessmentApprovalModalProps {
  assessment: AIAssessmentDetail;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void>;
  loading: boolean;
}

export const AssessmentApprovalModal: React.FC<AssessmentApprovalModalProps> = ({
  assessment,
  isOpen,
  onClose,
  onConfirm,
  loading,
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState(
    "کلیه بندهای پیشنهادی و معیارهای پذیرش با استانداردها و شرایط کارگاه مطابقت داده شد و مورد تأیید است."
  );

  if (!isOpen) return null;

  const draft = assessment.checklist_draft;
  const totalItems = draft?.sections?.reduce((acc, s) => acc + s.items.length, 0) || 0;
  const criticalItems =
    draft?.sections?.reduce(
      (acc, s) => acc + s.items.filter((i) => i.is_critical).length,
      0
    ) || 0;

  const handleApprove = async () => {
    if (!confirmed || loading) return;
    await onConfirm(notes);
  };

  const presetNotes = [
    "کلیه بندهای پیشنهادی و معیارهای پذیرش با استانداردها و شرایط کارگاه مطابقت داده شد و مورد تأیید است.",
    "مورد بازبینی میدانی کارشناس ایمنی قرار گرفت و با توجه به ریسک‌های شناسایی‌شده، صدور رسمی چک‌لیست تأیید می‌شود.",
    "تأیید با الزام اولویت‌دهی به بازرسی بندهای بحرانی (Critical Stop-Work) در شیفت کاری آتی.",
  ];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden transform animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white border border-white/20 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                دروازه نظارت و تأیید انسانی (Human Approval Gate)
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                الزام حاکمیتی و انطباق با استاندارد ایمنی ISO 45001
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Summary Overview Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <FileCheck className="w-4 h-4 text-slate-400" />
                عنوان ارزیابی:
              </span>
              <strong className="text-slate-900 font-bold">{assessment.title}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Building2 className="w-4 h-4 text-slate-400" />
                کارگاه هدف:
              </span>
              <strong className="text-slate-900 font-bold">{assessment.workplace_name || "کارگاه ثبت‌شده"}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <ClipboardList className="w-4 h-4 text-slate-400" />
                مشخصات چک‌لیست:
              </span>
              <span className="font-bold text-slate-900 font-mono">
                {draft?.sections?.length || 0} بخش / {totalItems} بند بازرسی
                {criticalItems > 0 && (
                  <span className="text-rose-600 font-bold mr-1">({criticalItems} بند بحرانی)</span>
                )}
              </span>
            </div>
          </div>

          {/* Operational Impact Notice */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              با تأیید نهایی، یک رکورد چک‌لیست رسمی جدید به صورت تراکنشی در ماژول بازرسی‌های HSE Guard ایجاد شده و فوراً برای بازرسان میدانی قابل تخصیص و ارزیابی خواهد بود.
            </p>
          </div>

          {/* Reviewer Audit Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              یادداشت و ملاحظات تأییدکننده (ثبت در لاگ ممیزی سیستم):
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed"
              placeholder="توضیحات و مستندات بررسی توسط کارشناس/مدیر HSE..."
            />
            {/* Quick preset selector */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 self-center">متن‌های پیش‌فرض:</span>
              {presetNotes.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNotes(preset)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                >
                  نمونه {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Human Sign-off Checkbox */}
          <div className="pt-2 bg-emerald-50/40 p-3 rounded-xl border border-emerald-200/80">
            <label className="flex items-start gap-2.5 text-xs font-semibold text-slate-900 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="leading-relaxed">
                اینجانب تأیید می‌نمایم که خطرات شناسایی‌شده و بندهای پیش‌نویس چک‌لیست توسط مسئول ذی‌صلاح بررسی گردیده، انطباق با قوانین و استانداردهای HSE احراز شده و مسئولیت صحت محتوا پذیرفته می‌شود.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white cursor-pointer transition-colors"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={!confirmed || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-extrabold hover:bg-emerald-700 active:scale-98 disabled:opacity-40 transition-all shadow-md shadow-emerald-200 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            {loading ? "در حال ثبت تأیید و صدور..." : "تأیید نهایی و صدور چک‌لیست"}
          </button>
        </div>
      </div>
    </div>
  );
};
