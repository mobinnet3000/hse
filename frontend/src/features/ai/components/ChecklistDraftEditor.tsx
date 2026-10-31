import React, { useState } from "react";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  AlertCircle,
  Save,
  ShieldCheck,
  Flame,
  Search,
  ChevronDown,
  ChevronUp,
  Camera,
  FileCheck,
  Eye,
  Gauge,
} from "lucide-react";
import type {
  AIChecklistDraft,
  AIChecklistSection,
  AIChecklistItem,
} from "../../../services/api";

interface ChecklistDraftEditorProps {
  initialDraft: AIChecklistDraft;
  assessmentId: number;
  onSaveDraft: (draft: AIChecklistDraft) => Promise<void>;
  onValidateDraft: () => Promise<{ is_valid: boolean; errors?: string[]; message?: string }>;
  onRequestApproval: () => void;
  canApprove: boolean;
  isSaving: boolean;
  isValidating: boolean;
}

export const ChecklistDraftEditor: React.FC<ChecklistDraftEditorProps> = ({
  initialDraft,
  assessmentId: _assessmentId,
  onSaveDraft,
  onValidateDraft,
  onRequestApproval,
  canApprove,
  isSaving,
  isValidating,
}) => {
  const [draft, setDraft] = useState<AIChecklistDraft>({
    title: initialDraft?.title || "چک‌لیست بازرسی تخصصی محیط کار",
    description: initialDraft?.description || "",
    sections: initialDraft?.sections || [],
  });

  const [validationResult, setValidationResult] = useState<{
    is_valid: boolean;
    errors?: string[];
    message?: string;
  } | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [itemSearch, setItemSearch] = useState<string>("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string | number, boolean>>({});

  // Update Title/Description
  const handleTitleChange = (val: string) => {
    setDraft({ ...draft, title: val });
    setHasUnsavedChanges(true);
  };

  const handleDescChange = (val: string) => {
    setDraft({ ...draft, description: val });
    setHasUnsavedChanges(true);
  };

  // Toggle Section Collapse
  const toggleSection = (id: string | number) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Sections management
  const handleAddSection = () => {
    const newSection: AIChecklistSection = {
      id: `sec-${Date.now()}`,
      title: "بخش جدید بازرسی",
      items: [
        {
          id: `item-${Date.now()}`,
          title: "معیار یا سوال بازرسی را وارد کنید",
          inspection_criterion: "معیار پذیرش استاندارد بر اساس آیین‌نامه",
          response_type: "yes_no_na",
          is_critical: false,
          evidence_required: ["مشاهده عینی"],
        },
      ],
    };
    setDraft({ ...draft, sections: [...draft.sections, newSection] });
    setHasUnsavedChanges(true);
  };

  const handleRemoveSection = (secIdx: number) => {
    if (!window.confirm("آیا از حذف کامل این بخش و کلیه بندهای آن اطمینان دارید؟")) return;
    const updated = draft.sections.filter((_, idx) => idx !== secIdx);
    setDraft({ ...draft, sections: updated });
    setHasUnsavedChanges(true);
  };

  const handleSectionTitleChange = (secIdx: number, val: string) => {
    const updated = [...draft.sections];
    updated[secIdx].title = val;
    setDraft({ ...draft, sections: updated });
    setHasUnsavedChanges(true);
  };

  const handleMoveSection = (secIdx: number, direction: "up" | "down") => {
    if (direction === "up" && secIdx === 0) return;
    if (direction === "down" && secIdx === draft.sections.length - 1) return;
    const targetIdx = direction === "up" ? secIdx - 1 : secIdx + 1;
    const updated = [...draft.sections];
    const [moved] = updated.splice(secIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setDraft({ ...draft, sections: updated });
    setHasUnsavedChanges(true);
  };

  // Items management inside section
  const handleAddItem = (secIdx: number) => {
    const newItem: AIChecklistItem = {
      id: `item-${Date.now()}`,
      title: "",
      inspection_criterion: "",
      response_type: "yes_no_na",
      is_critical: false,
      evidence_required: ["مشاهده عینی"],
    };
    const updated = [...draft.sections];
    updated[secIdx].items = [...updated[secIdx].items, newItem];
    setDraft({ ...draft, sections: updated });
    setHasUnsavedChanges(true);
  };

  const handleRemoveItem = (secIdx: number, itemIdx: number) => {
    const updated = [...draft.sections];
    updated[secIdx].items = updated[secIdx].items.filter((_, idx) => idx !== itemIdx);
    setDraft({ ...draft, sections: updated });
    setHasUnsavedChanges(true);
  };

  const handleUpdateItem = (
    secIdx: number,
    itemIdx: number,
    field: keyof AIChecklistItem,
    val: any
  ) => {
    const updated = [...draft.sections];
    updated[secIdx].items[itemIdx] = {
      ...updated[secIdx].items[itemIdx],
      [field]: val,
    };
    setDraft({ ...draft, sections: updated });
    setHasUnsavedChanges(true);
  };

  const handleToggleEvidence = (secIdx: number, itemIdx: number, evidenceName: string) => {
    const item = draft.sections[secIdx].items[itemIdx];
    const currentList = item.evidence_required || [];
    const exists = currentList.includes(evidenceName);
    const updatedEvidence = exists
      ? currentList.filter((e) => e !== evidenceName)
      : [...currentList, evidenceName];
    handleUpdateItem(secIdx, itemIdx, "evidence_required", updatedEvidence);
  };

  const handleMoveItem = (secIdx: number, itemIdx: number, direction: "up" | "down") => {
    const items = draft.sections[secIdx].items;
    if (direction === "up" && itemIdx === 0) return;
    if (direction === "down" && itemIdx === items.length - 1) return;
    const targetIdx = direction === "up" ? itemIdx - 1 : itemIdx + 1;
    const updatedItems = [...items];
    const [moved] = updatedItems.splice(itemIdx, 1);
    updatedItems.splice(targetIdx, 0, moved);

    const updated = [...draft.sections];
    updated[secIdx].items = updatedItems;
    setDraft({ ...draft, sections: updated });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    await onSaveDraft(draft);
    setHasUnsavedChanges(false);
  };

  const handleValidate = async () => {
    if (hasUnsavedChanges) {
      await onSaveDraft(draft);
      setHasUnsavedChanges(false);
    }
    const res = await onValidateDraft();
    setValidationResult(res);
  };

  const totalItems = draft.sections.reduce((acc, s) => acc + s.items.length, 0);
  const criticalItems = draft.sections.reduce(
    (acc, s) => acc + s.items.filter((i) => i.is_critical).length,
    0
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Action Bar (Sticky with Glassmorphism) */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 p-5 sticky top-2 z-20">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              ویرایشگر تعاملی پیش‌نویس چک‌لیست بازرسی
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              بندهای بازرسی، معیارهای پذیرش و نوع پاسخ‌ها را بر اساس شرایط میدانی شخصی‌سازی کنید.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Save Status Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                hasUnsavedChanges
                  ? "bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-200/60 shadow-sm"
                  : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? (
                "در حال ذخیره..."
              ) : hasUnsavedChanges ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  ذخیره تغییرات پیش‌نویس *
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  پیش‌نویس ذخیره شد
                </span>
              )}
            </button>

            {/* Validation Button */}
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition-colors shadow-sm cursor-pointer"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              {isValidating ? "در حال اعتبارسنجی..." : "اعتبارسنجی ساختار"}
            </button>

            {/* Approve Gate Button */}
            <button
              onClick={onRequestApproval}
              disabled={!canApprove}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-extrabold hover:bg-emerald-700 active:scale-98 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              تأیید نهایی و صدور چک‌لیست رسمی
            </button>
          </div>
        </div>

        {/* Title, Statistics, and Description */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              عنوان چک‌لیست بازرسی *
            </label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">خلاصه آماری پیش‌نویس</label>
            <div className="flex items-center justify-around h-10 px-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
              <span className="font-sans text-slate-700">{draft.sections.length} بخش</span>
              <span className="text-slate-300">|</span>
              <span className="font-sans text-slate-700">{totalItems} بند بازرسی</span>
              <span className="text-slate-300">|</span>
              <span className="font-sans text-rose-600 font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                {criticalItems} بحرانی
              </span>
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              توضیحات و حوزه کاربرد چک‌لیست
            </label>
            <input
              type="text"
              value={draft.description || ""}
              onChange={(e) => handleDescChange(e.target.value)}
              placeholder="مثال: چک‌لیست بازرسی روزانه خطوط تولید و کارگاه جوشکاری..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Validation Result Box */}
        {validationResult && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs ${
              validationResult.is_valid
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : "bg-rose-50 border-rose-300 text-rose-900"
            }`}
          >
            {validationResult.is_valid ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">
                  {validationResult.message || "پیش‌نویس چک‌لیست با موفقیت اعتبارسنجی شد و آماده صدور رسمی در سیستم است."}
                </span>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 font-bold mb-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  خطاهای ساختاری نیازمند اصلاح:
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {(validationResult.errors || []).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="جستجو در متن بندها یا معیارهای پذیرش..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddSection}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            افزودن بخش جدید
          </button>
        </div>
      </div>

      {/* Sections & Items Editor */}
      <div className="space-y-4">
        {draft.sections.map((section, secIdx) => {
          const isCollapsed = collapsedSections[section.id || secIdx];
          const visibleItems = section.items.filter((item) => {
            if (!itemSearch.trim()) return true;
            const q = itemSearch.toLowerCase();
            return (
              item.title?.toLowerCase().includes(q) ||
              item.inspection_criterion?.toLowerCase().includes(q)
            );
          });

          return (
            <div
              key={section.id || secIdx}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all"
            >
              {/* Section Header */}
              <div className="bg-slate-50/90 px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 max-w-xl">
                  <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    {secIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => handleSectionTitleChange(secIdx, e.target.value)}
                    placeholder="عنوان بخش بازرسی..."
                    className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium ml-2 font-mono">
                    ({section.items.length} بند)
                  </span>

                  <button
                    type="button"
                    onClick={() => handleMoveSection(secIdx, "up")}
                    disabled={secIdx === 0}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md disabled:opacity-20 cursor-pointer"
                    title="انتقال بخش به بالا"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveSection(secIdx, "down")}
                    disabled={secIdx === draft.sections.length - 1}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md disabled:opacity-20 cursor-pointer"
                    title="انتقال بخش به پایین"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddItem(secIdx)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> افزودن بند
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(secIdx)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                    title="حذف کامل این بخش"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id || secIdx)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                    title={isCollapsed ? "باز کردن بخش" : "جمع کردن بخش"}
                  >
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Items List inside Section */}
              {!isCollapsed && (
                <div className="divide-y divide-slate-100 p-2">
                  {visibleItems.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      {itemSearch ? "بندی مطابق با عبارت جستجو یافت نشد." : "این بخش هنوز فاقد بند بازرسی است."}
                    </div>
                  ) : (
                    visibleItems.map((item, itemIdx) => (
                      <div
                        key={item.id || itemIdx}
                        className={`p-4 hover:bg-slate-50/70 transition-colors space-y-3 rounded-xl border ${
                          item.is_critical
                            ? "border-rose-300 bg-rose-50/20 shadow-2xs"
                            : "border-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 shrink-0 mt-1">
                            <span>{secIdx + 1}.{itemIdx + 1}</span>
                            {item.is_critical && (
                              <Flame className="w-3.5 h-3.5 text-rose-600" />
                            )}
                          </div>

                          <div className="flex-1 space-y-2.5">
                            {/* Item Question/Title */}
                            <div>
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => handleUpdateItem(secIdx, itemIdx, "title", e.target.value)}
                                placeholder="سوال یا مورد بازرسی (مثال: آیا سوئیچ اضطراری دستگاه به درستی عمل می‌کند؟)"
                                className={`w-full px-3 py-2 text-xs font-bold rounded-lg border focus:ring-2 focus:ring-indigo-500 ${
                                  item.is_critical
                                    ? "text-rose-950 border-rose-300 bg-white"
                                    : "text-slate-800 border-slate-300 bg-white"
                                }`}
                              />
                            </div>

                            {/* Criteria & Options Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              <div className="md:col-span-2">
                                <input
                                  type="text"
                                  value={item.inspection_criterion}
                                  onChange={(e) =>
                                    handleUpdateItem(secIdx, itemIdx, "inspection_criterion", e.target.value)
                                  }
                                  placeholder="معیار پذیرش دقیق (مثال: توقف کامل موتور در کمتر از ۰.۵ ثانیه پس از فشردن کلید قارچی)"
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg bg-white"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={item.response_type}
                                  onChange={(e) =>
                                    handleUpdateItem(secIdx, itemIdx, "response_type", e.target.value)
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
                                >
                                  <option value="yes_no_na">بله / خیر / نامربوط (استاندارد)</option>
                                  <option value="yes_no">بله / خیر صریح</option>
                                  <option value="score_1_5">امتیازی (۱ تا ۵)</option>
                                  <option value="text">تشریحی و متنی</option>
                                  <option value="photo">الزام الصاق عکس</option>
                                </select>
                              </div>
                            </div>

                            {/* Badges: Critical, Evidence Types & Item Controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px]">
                              <div className="flex flex-wrap items-center gap-3">
                                {/* Critical Toggle */}
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={item.is_critical}
                                    onChange={(e) =>
                                      handleUpdateItem(secIdx, itemIdx, "is_critical", e.target.checked)
                                    }
                                    className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                                  />
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-bold ${
                                      item.is_critical
                                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                                        : "text-slate-600"
                                    }`}
                                  >
                                    بند بحرانی (Critical Stop-Work)
                                  </span>
                                </label>

                                {/* Evidence Requirement Pills */}
                                <div className="flex items-center gap-1 text-[10px]">
                                  <span className="text-slate-400">شواهد:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleEvidence(secIdx, itemIdx, "مشاهده عینی")}
                                    className={`px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${
                                      item.evidence_required?.includes("مشاهده عینی")
                                        ? "bg-indigo-100 text-indigo-800 border-indigo-300 font-bold"
                                        : "bg-white text-slate-500 border-slate-200"
                                    }`}
                                  >
                                    <Eye className="w-2.5 h-2.5 inline ml-1" />
                                    مشاهده عینی
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleEvidence(secIdx, itemIdx, "مدرک فنی")}
                                    className={`px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${
                                      item.evidence_required?.includes("مدرک فنی")
                                        ? "bg-teal-100 text-teal-800 border-teal-300 font-bold"
                                        : "bg-white text-slate-500 border-slate-200"
                                    }`}
                                  >
                                    <FileCheck className="w-2.5 h-2.5 inline ml-1" />
                                    مدرک فنی
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleEvidence(secIdx, itemIdx, "سنجش ابزاری")}
                                    className={`px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${
                                      item.evidence_required?.includes("سنجش ابزاری")
                                        ? "bg-sky-100 text-sky-800 border-sky-300 font-bold"
                                        : "bg-white text-slate-500 border-slate-200"
                                    }`}
                                  >
                                    <Gauge className="w-2.5 h-2.5 inline ml-1" />
                                    سنجش ابزاری
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleEvidence(secIdx, itemIdx, "عکسبرداری")}
                                    className={`px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${
                                      item.evidence_required?.includes("عکسبرداری")
                                        ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                                        : "bg-white text-slate-500 border-slate-200"
                                    }`}
                                  >
                                    <Camera className="w-2.5 h-2.5 inline ml-1" />
                                    عکسبرداری
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveItem(secIdx, itemIdx, "up")}
                                  disabled={itemIdx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-20 cursor-pointer"
                                  title="انتقال به بالا"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveItem(secIdx, itemIdx, "down")}
                                  disabled={itemIdx === section.items.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-20 cursor-pointer"
                                  title="انتقال به پایین"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(secIdx, itemIdx)}
                                  className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                                  title="حذف بند"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Section Button */}
        <div className="text-center pt-3">
          <button
            type="button"
            onClick={handleAddSection}
            className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-dashed border-slate-300 rounded-2xl text-xs font-bold text-slate-600 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            افزودن بخش بازرسی جدید
          </button>
        </div>
      </div>
    </div>
  );
};
