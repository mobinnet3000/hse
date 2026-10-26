import { useState, type FormEvent } from "react";
import { X, CheckCircle2, XCircle, AlertCircle, ShieldCheck } from "lucide-react";
import { reviewDocument, type ControlledDocument } from "../../services/api";

interface ReviewDocumentModalProps {
  isOpen: boolean;
  document: ControlledDocument | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewDocumentModal({
  isOpen,
  document,
  onClose,
  onSuccess,
}: ReviewDocumentModalProps) {
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [notes, setNotes] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    document?.effective_date || new Date().toISOString().split("T")[0]
  );
  const [nextReviewDate, setNextReviewDate] = useState(document?.next_review_date || "");
  const [expiryDate, setExpiryDate] = useState(document?.expiry_date || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !document) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!document) return;

    if (action === "reject" && !notes.trim()) {
      setError("ذکر علت رد سند و نکات اصلاحی الزامی است.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await reviewDocument(document.id, {
        action,
        notes: notes.trim(),
        reason: notes.trim(),
        effective_date: action === "approve" ? effectiveDate : undefined,
        next_review_date: action === "approve" ? nextReviewDate : undefined,
        expiry_date: action === "approve" ? expiryDate : undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "خطا در ثبت تصمیم ممیزی مدرک.");
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
            <ShieldCheck className="text-primary" size={22} />
            <h3 className="font-bold text-lg">ممیزی، تصویب یا رد مدرک</h3>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </div>

        <div className="my-3 p-3 bg-muted/20 rounded border border-border text-sm">
          <div className="font-semibold text-foreground">{document.title}</div>
          <div className="flex gap-4 text-xs text-muted mt-1 font-mono">
            <span>کد: {document.document_number}</span>
            <span>نگارش: v{document.current_version_number || "1.0"}</span>
            <span>دپارتمان: {document.department || "عمومی"}</span>
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
            <label className="block text-sm font-semibold mb-2">تصمیم ممیزی / مراجع تصویب</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  action === "approve"
                    ? "border-success bg-success/10 text-success font-semibold"
                    : "border-border hover:bg-muted/10 text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="reviewAction"
                  className="hidden"
                  checked={action === "approve"}
                  onChange={() => setAction("approve")}
                />
                <CheckCircle2 size={18} />
                <span>تصویب و ابلاغ مدرک</span>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  action === "reject"
                    ? "border-danger bg-danger/10 text-danger font-semibold"
                    : "border-border hover:bg-muted/10 text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="reviewAction"
                  className="hidden"
                  checked={action === "reject"}
                  onChange={() => setAction("reject")}
                />
                <XCircle size={18} />
                <span>رد و درخواست اصلاحات</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              {action === "approve" ? "توضیحات یا نکات ابلاغ (اختیاری)" : "علت رد و موارد اصلاحی مورد نیاز *"}
            </label>
            <textarea
              className="form-textarea w-full"
              rows={3}
              placeholder={
                action === "approve"
                  ? "توضیحات تکمیلی یا الزامات اجرایی پیوست به ابلاغ..."
                  : "ذکر دقیق بندهای نیازمند اصلاح، عدم انطباق با استاندارد و..."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required={action === "reject"}
            />
          </div>

          {action === "approve" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/10 rounded border border-border">
              <div>
                <label className="block text-xs font-semibold mb-1">تاریخ ابلاغ</label>
                <input
                  type="date"
                  className="form-input w-full text-xs"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">سررسید بازنگری</label>
                <input
                  type="date"
                  className="form-input w-full text-xs"
                  value={nextReviewDate}
                  onChange={(e) => setNextReviewDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">تاریخ انقضا</label>
                <input
                  type="date"
                  className="form-input w-full text-xs"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="modal-footer flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              انصراف
            </button>
            <button
              type="submit"
              className={`btn ${action === "approve" ? "btn-success" : "btn-danger"}`}
              disabled={loading}
            >
              {loading
                ? "در حال ثبت تصمیم..."
                : action === "approve"
                ? "تأیید و ابلاغ سازمانی"
                : "ثبت رد سند"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
