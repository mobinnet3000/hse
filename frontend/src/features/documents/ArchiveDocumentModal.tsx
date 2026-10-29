import { useState, type FormEvent } from "react";
import { X, Archive, AlertCircle } from "lucide-react";
import { archiveDocument, type ControlledDocument } from "../../services/api";

interface ArchiveDocumentModalProps {
  isOpen: boolean;
  document: ControlledDocument | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ArchiveDocumentModal({
  isOpen,
  document,
  onClose,
  onSuccess,
}: ArchiveDocumentModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !document) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!document) return;

    if (!reason.trim()) {
      setError("ذکر علت بایگانی سند الزامی است.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await archiveDocument(document.id, { reason: reason.trim() });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "خطا در بایگانی سند.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} dir="rtl">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "500px" }}
      >
        <div className="modal-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="text-warning" size={22} />
            <h3 className="font-bold text-lg">بایگانی راکد مدرک کنترل‌شده</h3>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </div>

        <div className="my-3 p-3 bg-muted/20 rounded border border-border text-sm">
          <div className="font-semibold text-foreground">{document.title}</div>
          <div className="text-xs text-muted mt-1 font-mono">
            کد سند: {document.document_number} | وضعیت جاری: {document.status_display}
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
              علت بایگانی یا خروج از رده <span className="text-danger">*</span>
            </label>
            <textarea
              className="form-textarea w-full"
              rows={3}
              placeholder="توضیح دهید به چه علت این مدرک بایگانی می‌گردد (مثلاً: ابطال فرآیند، جایگزینی با استاندارد جدید، تصمیم کمیته HSE و...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="modal-footer flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              انصراف
            </button>
            <button type="submit" className="btn btn-warning" disabled={loading}>
              {loading ? "در حال بایگانی..." : "تأیید و بایگانی سند"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
