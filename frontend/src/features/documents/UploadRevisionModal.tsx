import { useState, type FormEvent } from "react";
import { X, History, AlertCircle } from "lucide-react";
import { uploadDocumentRevision, type ControlledDocument } from "../../services/api";

interface UploadRevisionModalProps {
  isOpen: boolean;
  document: ControlledDocument | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadRevisionModal({
  isOpen,
  document,
  onClose,
  onSuccess,
}: UploadRevisionModalProps) {
  const [versionNumber, setVersionNumber] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [submitForReview, setSubmitForReview] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !document) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!document) return;

    if (!file) {
      setError("انتخاب فایل ضمیمه نگارش الزامی است.");
      return;
    }
    if (!versionNumber.trim()) {
      setError("شماره نگارش (مانند 1.1 یا 2.0) الزامی است.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("version_number", versionNumber.trim());
      formData.append("change_summary", changeSummary.trim());
      formData.append("submit_for_review", submitForReview ? "true" : "false");

      await uploadDocumentRevision(document.id, formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "خطا در بارگذاری نگارش جدید مدرک.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} dir="rtl">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "560px" }}
      >
        <div className="modal-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="text-primary" size={22} />
            <h3 className="font-bold text-lg">بارگذاری نگارش جدید مدرک (Revision)</h3>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </div>

        <div className="my-3 p-3 bg-muted/20 rounded border border-border text-sm">
          <div className="font-semibold text-foreground">{document.title}</div>
          <div className="flex gap-4 text-xs text-muted mt-1 font-mono">
            <span>کد سند: {document.document_number}</span>
            <span>آخرین نگارش: v{document.current_version_number || "1.0"}</span>
            <span>وضعیت جاری: {document.status_display}</span>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger flex items-center gap-2 my-3">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">
              شماره نگارش جدید <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-input w-full font-mono"
              placeholder="مثال: 1.1 یا 2.0"
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
              required
            />
            <span className="text-xs text-muted">
              نگارش‌های تاریخی قبلی حفظ شده و هیچ فایلی بازنویسی یا حذف نمی‌گردد.
            </span>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              خلاصه تغییرات نسبت به نگارش قبلی (Change Summary) <span className="text-danger">*</span>
            </label>
            <textarea
              className="form-textarea w-full"
              rows={3}
              placeholder="توضیح دهید چه بندهایی از سند اصلاح، حذف یا اضافه شده است..."
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              فایل سند نگارش جدید <span className="text-danger">*</span>
            </label>
            <input
              type="file"
              className="form-input w-full"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.txt,.jpg,.jpeg,.png,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <span className="text-xs text-muted block mt-1">
              فرمت‌های مجاز: PDF, Word, Excel, PowerPoint, Text, Image (حداکثر ۲۵ مگابایت)
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="submitForReviewRev"
              checked={submitForReview}
              onChange={(e) => setSubmitForReview(e.target.checked)}
              className="form-checkbox"
            />
            <label htmlFor="submitForReviewRev" className="text-sm font-semibold cursor-pointer">
              ارسال مستقیم برای بازنگری و ممیزی مدیر ایمنی
            </label>
          </div>

          <div className="modal-footer flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              انصراف
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "در حال بارگذاری..." : "بارگذاری و ثبت نگارش"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
