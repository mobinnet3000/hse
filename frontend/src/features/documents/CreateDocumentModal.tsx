import { useState, type FormEvent } from "react";
import { X, Upload, FileText, AlertCircle } from "lucide-react";
import {
  createDocument,
  type DocumentCategoryType,
  type ConfidentialityType,
} from "../../services/api";

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId?: number;
}

const CATEGORIES: Array<{ value: DocumentCategoryType; label: string }> = [
  { value: "procedure", label: "روش اجرایی استاندارد (SOP / Procedure)" },
  { value: "policy", label: "خط‌مشی و بیانیه کلان (Policy)" },
  { value: "work_instruction", label: "دستورالعمل کاری و ایمنی (Work Instruction)" },
  { value: "form", label: "فرم، لاگ‌شیت و چک‌لیست کنترلی (Form/Checklist)" },
  { value: "sds", label: "برگه اطلاعات ایمنی مواد شیمیایی (SDS / MSDS)" },
  { value: "risk_assessment", label: "شناسایی خطرات و ارزیابی ریسک (JSA / HIRA)" },
  { value: "permit_template", label: "الگوی مجوزهای کار (PTW Template)" },
  { value: "certificate", label: "گواهینامه، استاندارد و تأییدیه فنی (Certificate)" },
  { value: "training_material", label: "جزوه و محتوای آموزشی (Training Material)" },
  { value: "inspection_audit", label: "گزارش ممیزی و بازرسی جامع (Audit / Inspection)" },
  { value: "technical_file", label: "پرونده فنی و نقشه‌های ایمنی (Technical File)" },
  { value: "environmental_record", label: "سوابق و مستندات زیست‌محیطی (Environmental Record)" },
  { value: "other", label: "سایر مستندات کنترل‌شده (Other)" },
];

const CONFIDENTIALITY_LEVELS: Array<{ value: ConfidentialityType; label: string }> = [
  { value: "internal", label: "داخلی سازمان (Internal - کلیه پرسنل)" },
  { value: "public", label: "عمومی (Public)" },
  { value: "confidential", label: "محرمانه (Confidential - مدیران و بازرسان)" },
  { value: "strictly_confidential", label: "به‌شدت محرمانه (Strictly Confidential - مدیریت ارشد)" },
];

export function CreateDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  organizationId,
}: CreateDocumentModalProps) {
  const [docNumber, setDocNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocumentCategoryType>("procedure");
  const [confidentiality, setConfidentiality] = useState<ConfidentialityType>("internal");
  const [department, setDepartment] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [retentionYears, setRetentionYears] = useState(5);
  const [tags, setTags] = useState("");
  const [requiresAck, setRequiresAck] = useState(false);

  const [versionNumber, setVersionNumber] = useState("1.0");
  const [changeSummary, setChangeSummary] = useState("نگارش اولیه سند");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!docNumber.trim() || !title.trim()) {
      setError("شماره سند و عنوان مدرک الزامی است.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (organizationId) {
        formData.append("organization", String(organizationId));
      }
      formData.append("document_number", docNumber.trim().toUpperCase());
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category", category);
      formData.append("confidentiality", confidentiality);
      if (department.trim()) formData.append("department", department.trim());
      if (effectiveDate) formData.append("effective_date", effectiveDate);
      if (nextReviewDate) formData.append("next_review_date", nextReviewDate);
      if (expiryDate) formData.append("expiry_date", expiryDate);
      formData.append("retention_years", String(retentionYears));
      if (tags.trim()) formData.append("tags", tags.trim());
      formData.append("requires_acknowledgment", requiresAck ? "true" : "false");

      if (file) {
        formData.append("file", file);
        formData.append("version_number", versionNumber.trim() || "1.0");
        formData.append("change_summary", changeSummary.trim() || "نگارش اولیه");
      }

      await createDocument(formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "خطا در ثبت و بارگذاری مدرک.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} dir="rtl">
      <div
        className="modal-content modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "750px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="text-primary" size={22} />
            <h3 className="font-bold text-lg">ثبت و بارگذاری مدرک کنترل‌شده جدید</h3>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="alert alert-danger flex items-center gap-2 my-3">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                شماره / شناسه یکتای مدرک <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-input w-full font-mono"
                placeholder="مثال: DOC-SOP-005"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                required
              />
              <span className="text-xs text-muted">الگوی استاندارد: DOC-SOP-XXX یا EHS-POL-XXX</span>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                عنوان مدرک <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="مثال: دستورالعمل کار در ارتفاع و پیشگیری از سقوط"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">دسته‌بندی مدرک</label>
              <select
                className="form-select w-full"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategoryType)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">سطح محرمانگی</label>
              <select
                className="form-select w-full"
                value={confidentiality}
                onChange={(e) => setConfidentiality(e.target.value as ConfidentialityType)}
              >
                {CONFIDENTIALITY_LEVELS.map((cl) => (
                  <option key={cl.value} value={cl.value}>
                    {cl.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">دپارتمان / واحد متولی</label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="مثال: واحد ایمنی و حفاظت فنی"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">کلمات کلیدی / برچسب‌ها</label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="مثال: ارتفاع, هارنس, داربست"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">شرح، هدف و دامنه کاربرد</label>
            <textarea
              className="form-textarea w-full"
              rows={2}
              placeholder="توضیح مختصر در خصوص هدف تدوین، دامنه الزام و واحد‌های مشمول..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">تاریخ ابلاغ / لازم‌الاجرا</label>
              <input
                type="date"
                className="form-input w-full"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">سررسید بازنگری دوره‌ای</label>
              <input
                type="date"
                className="form-input w-full"
                value={nextReviewDate}
                onChange={(e) => setNextReviewDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">تاریخ پایان اعتبار (انقضا)</label>
              <input
                type="date"
                className="form-input w-full"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">دوره نگهداری راکد (سال)</label>
              <input
                type="number"
                min={1}
                max={50}
                className="form-input w-full"
                value={retentionYears}
                onChange={(e) => setRetentionYears(Number(e.target.value) || 5)}
              />
            </div>
          </div>

          <div className="p-3 bg-muted/20 rounded-md border border-border space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Upload size={16} className="text-primary" />
              ضمیمه فایل نگارش اولیه (نسخه‌بندی ایمن)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">شماره نگارش</label>
                <input
                  type="text"
                  className="form-input w-full font-mono text-sm"
                  placeholder="1.0"
                  value={versionNumber}
                  onChange={(e) => setVersionNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">خلاصه تغییرات نگارش</label>
                <input
                  type="text"
                  className="form-input w-full text-sm"
                  placeholder="تدوین اولیه سند"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">انتخاب فایل ضمیمه</label>
              <input
                type="file"
                className="form-input w-full text-sm"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.txt,.jpg,.jpeg,.png,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <span className="text-xs text-muted block mt-1">
                فرمت‌های مجاز: PDF, Word, Excel, PowerPoint, Text, Image (حداکثر ۲۵ مگابایت)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="requiresAck"
              checked={requiresAck}
              onChange={(e) => setRequiresAck(e.target.checked)}
              className="form-checkbox"
            />
            <label htmlFor="requiresAck" className="text-sm font-semibold cursor-pointer">
              الزام ثبت تصدیق و مطالعه توسط کارکنان (Read Receipt / Acknowledgment)
            </label>
          </div>

          <div className="modal-footer flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              انصراف
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "در حال ثبت مدرک..." : "ثبت و بارگذاری مدرک"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
