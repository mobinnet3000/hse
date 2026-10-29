import { useState, useEffect } from "react";
import {
  X,
  FileText,
  Download,
  Eye,
  History,
  CheckCircle2,
  Clock,
  Shield,
  Tag,
  Share2,
  Archive,
  RefreshCw,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import {
  fetchDocumentDetail,
  getDocumentDownloadUrl,
  acknowledgeDocument,
  restoreDocument,
  submitDocumentForReview,
  type ControlledDocument,
} from "../../services/api";

interface DocumentDetailModalProps {
  isOpen: boolean;
  documentId: number | null;
  onClose: () => void;
  onRefresh: () => void;
  onOpenReview: (doc: ControlledDocument) => void;
  onOpenRevision: (doc: ControlledDocument) => void;
  onOpenArchive: (doc: ControlledDocument) => void;
  currentUser?: { id: number; username: string };
}

type TabKey = "overview" | "versions" | "reviews" | "acknowledgments" | "links";

export function DocumentDetailModal({
  isOpen,
  documentId,
  onClose,
  onRefresh,
  onOpenReview,
  onOpenRevision,
  onOpenArchive,
  currentUser,
}: DocumentDetailModalProps) {
  const [doc, setDoc] = useState<ControlledDocument | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState("");
  const [ackLoading, setAckLoading] = useState(false);

  useEffect(() => {
    if (isOpen && documentId) {
      loadDocument(documentId);
      setActiveTab("overview");
      setAckNote("");
    }
  }, [isOpen, documentId]);

  async function loadDocument(id: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocumentDetail(id);
      setDoc(data);
    } catch (err: any) {
      setError(err?.message || "خطا در دریافت جزئیات مدرک.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge() {
    if (!doc) return;
    setAckLoading(true);
    try {
      await acknowledgeDocument(doc.id, { signature_note: ackNote.trim() });
      await loadDocument(doc.id);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "خطا در ثبت تصدیق مطالعه.");
    } finally {
      setAckLoading(false);
    }
  }

  async function handleSubmitReview() {
    if (!doc) return;
    try {
      await submitDocumentForReview(doc.id);
      await loadDocument(doc.id);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "خطا در ارسال برای ممیزی.");
    }
  }

  async function handleRestore() {
    if (!doc) return;
    if (!confirm("آیا از بازیابی این سند از حالت بایگانی اطمینان دارید؟")) return;
    try {
      await restoreDocument(doc.id);
      await loadDocument(doc.id);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "خطا در بازیابی سند.");
    }
  }

  if (!isOpen) return null;

  function renderStatusBadge(status: string, statusDisplay: string) {
    let badgeClass = "badge-secondary";
    if (status === "effective" || status === "approved") badgeClass = "badge-success";
    else if (status === "under_review" || status === "submitted") badgeClass = "badge-warning";
    else if (status === "rejected" || status === "expired") badgeClass = "badge-danger";
    else if (status === "archived") badgeClass = "badge-muted";

    return <span className={`badge ${badgeClass}`}>{statusDisplay}</span>;
  }

  function renderConfidentialityBadge(conf: string, confDisplay: string) {
    let color = "text-muted border-border";
    if (conf === "strictly_confidential") color = "text-danger border-danger bg-danger/10";
    else if (conf === "confidential") color = "text-warning border-warning bg-warning/10";
    else if (conf === "public") color = "text-success border-success bg-success/10";

    return (
      <span className={`px-2 py-0.5 text-xs rounded border font-semibold ${color}`}>
        {confDisplay}
      </span>
    );
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "0 بایت";
    const k = 1024;
    const sizes = ["بایت", "کیلوبایت", "مگابایت"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  const hasAcknowledged = Boolean(
    currentUser &&
      doc?.acknowledgments?.some((a) => a.user === currentUser.id)
  );

  return (
    <div className="modal-backdrop" onClick={onClose} dir="rtl">
      <div
        className="modal-content modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "880px", maxHeight: "92vh", overflowY: "auto" }}
      >
        <div className="modal-header flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{doc?.title || "جزئیات مدرک کنترل‌شده"}</h3>
                {doc && renderStatusBadge(doc.status, doc.status_display)}
                {doc && renderConfidentialityBadge(doc.confidentiality, doc.confidentiality_display)}
              </div>
              <p className="text-xs text-muted font-mono mt-0.5">
                کد شناسایی یکتا: {doc?.document_number} | دسته‌بندی: {doc?.category_display}
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border my-3 gap-2 overflow-x-auto text-sm">
          <button
            className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            <Eye size={16} />
            شناسنامه و فایل جاری
          </button>

          <button
            className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "versions"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
            onClick={() => setActiveTab("versions")}
          >
            <History size={16} />
            تاریخچه نگارش‌ها ({doc?.versions?.length || doc?.versions_count || 0})
          </button>

          <button
            className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "reviews"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
            onClick={() => setActiveTab("reviews")}
          >
            <Shield size={16} />
            فرآیند ممیزی و تصمیمات ({doc?.review_logs?.length || 0})
          </button>

          <button
            className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "acknowledgments"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
            onClick={() => setActiveTab("acknowledgments")}
          >
            <UserCheck size={16} />
            تصدیق مطالعه ({doc?.acknowledgments?.length || doc?.acknowledgments_count || 0})
          </button>

          <button
            className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "links"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
            onClick={() => setActiveTab("links")}
          >
            <Share2 size={16} />
            پیوندهای فرآیندی ({doc?.cross_links?.length || 0})
          </button>
        </div>

        {loading && (
          <div className="py-12 text-center text-muted">
            <div className="spinner mb-2" />
            <p>در حال فراخوانی مشخصات سند از مخزن امن...</p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger my-4 flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!loading && doc && (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Current Version File Card */}
                {doc.current_version_filename ? (
                  <div className="p-4 bg-muted/20 border border-primary/30 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {doc.current_version_filename}
                        </span>
                        <span className="badge badge-primary font-mono text-xs">
                          v{doc.current_version_number}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted font-mono">
                        <span>حجم: {formatBytes(doc.current_version_size)}</span>
                        {doc.current_version_hash && (
                          <span title="SHA-256 Tamper-Evident Hash">
                            هش امنیتی: {doc.current_version_hash.substring(0, 16)}…
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={getDocumentDownloadUrl(doc.id, doc.current_version_id || undefined)}
                        className="btn btn-primary btn-sm flex items-center gap-1.5"
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Download size={15} />
                        دانلود امن فایل
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/10 border border-border rounded-lg text-center text-muted text-sm">
                    هنوز فایلی برای نگارش جاری این سند بارگذاری نشده است.
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-2.5 bg-muted/10 rounded border border-border">
                    <span className="text-xs text-muted block mb-0.5">واحد متولی</span>
                    <span className="font-semibold">{doc.department || "تعیین نشده"}</span>
                  </div>

                  <div className="p-2.5 bg-muted/10 rounded border border-border">
                    <span className="text-xs text-muted block mb-0.5">کارگاه مرتبط</span>
                    <span className="font-semibold">{doc.workplace_name || "عمومی / سراسری"}</span>
                  </div>

                  <div className="p-2.5 bg-muted/10 rounded border border-border">
                    <span className="text-xs text-muted block mb-0.5">مسئول نگهداری (Owner)</span>
                    <span className="font-semibold">{doc.owner_name || "-"}</span>
                  </div>

                  <div className="p-2.5 bg-muted/10 rounded border border-border">
                    <span className="text-xs text-muted block mb-0.5">تدوین‌کننده (Author)</span>
                    <span className="font-semibold">{doc.author_name || "-"}</span>
                  </div>

                  <div className="p-2.5 bg-muted/10 rounded border border-border">
                    <span className="text-xs text-muted block mb-0.5">تاریخ ابلاغ / لازم‌الاجرا</span>
                    <span className="font-semibold font-mono">{doc.effective_date || "نامشخص"}</span>
                  </div>

                  <div className="p-2.5 bg-muted/10 rounded border border-border">
                    <span className="text-xs text-muted block mb-0.5">سررسید بازنگری دوره‌ای</span>
                    <span
                      className={`font-semibold font-mono ${
                        doc.is_review_overdue ? "text-danger" : doc.is_review_due_soon ? "text-warning" : ""
                      }`}
                    >
                      {doc.next_review_date || "تعیین نشده"}
                      {doc.is_review_overdue && " (گذشته)"}
                      {doc.is_review_due_soon && " (به زودی)"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-muted/10 rounded border border-border">
                    <span className="text-xs text-muted block mb-0.5">تاریخ پایان اعتبار (انقضا)</span>
                    <span
                      className={`font-semibold font-mono ${doc.is_expired ? "text-danger" : ""}`}
                    >
                      {doc.expiry_date || "نامحدود"}
                      {doc.is_expired && " (منقضی)"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-muted/10 rounded border border-border">
                    <span className="text-xs text-muted block mb-0.5">دوره نگهداری راکد</span>
                    <span className="font-semibold">{doc.retention_years || 5} سال</span>
                  </div>
                </div>

                {/* Description */}
                {doc.description && (
                  <div className="p-3 bg-muted/10 rounded border border-border text-sm">
                    <span className="text-xs font-semibold text-muted block mb-1">
                      شرح و هدف سند
                    </span>
                    <p className="text-foreground leading-relaxed">{doc.description}</p>
                  </div>
                )}

                {/* Tags */}
                {doc.tags && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag size={15} className="text-muted" />
                    {doc.tags.split(",").map((t, idx) => (
                      <span key={idx} className="badge badge-secondary text-xs">
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Archival Reason if archived */}
                {doc.status === "archived" && doc.archived_reason && (
                  <div className="p-3 bg-warning/10 border border-warning text-warning-foreground rounded text-sm">
                    <div className="font-semibold flex items-center gap-2">
                      <Archive size={16} />
                      علت بایگانی سند:
                    </div>
                    <p className="mt-1">{doc.archived_reason}</p>
                    {doc.archived_by_name && (
                      <span className="text-xs text-muted mt-2 block">
                        بایگانی‌شده توسط: {doc.archived_by_name} در {doc.archived_at}
                      </span>
                    )}
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="pt-3 border-t border-border flex flex-wrap items-center gap-2">
                  {(doc.status === "draft" || doc.status === "rejected") && (
                    <button
                      className="btn btn-primary btn-sm flex items-center gap-1.5"
                      onClick={handleSubmitReview}
                    >
                      <Clock size={15} />
                      ارسال برای بازنگری و ممیزی
                    </button>
                  )}

                  {doc.status === "under_review" && (
                    <button
                      className="btn btn-success btn-sm flex items-center gap-1.5"
                      onClick={() => onOpenReview(doc)}
                    >
                      <CheckCircle2 size={15} />
                      ممیزی، تصویب یا رد سند
                    </button>
                  )}

                  {doc.status !== "archived" && (
                    <button
                      className="btn btn-secondary btn-sm flex items-center gap-1.5"
                      onClick={() => onOpenRevision(doc)}
                    >
                      <History size={15} />
                      بارگذاری نگارش جدید (Revision)
                    </button>
                  )}

                  {doc.status !== "archived" && (
                    <button
                      className="btn btn-warning btn-sm flex items-center gap-1.5"
                      onClick={() => onOpenArchive(doc)}
                    >
                      <Archive size={15} />
                      بایگانی سند
                    </button>
                  )}

                  {doc.status === "archived" && (
                    <button
                      className="btn btn-secondary btn-sm flex items-center gap-1.5"
                      onClick={handleRestore}
                    >
                      <RefreshCw size={15} />
                      بازیابی از بایگانی
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* VERSIONS TAB */}
            {activeTab === "versions" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">نگارش‌های تاریخی و فایل‌های ثبت‌شده</h4>
                  {doc.status !== "archived" && (
                    <button
                      className="btn btn-primary btn-sm flex items-center gap-1.5"
                      onClick={() => onOpenRevision(doc)}
                    >
                      <History size={15} />
                      افزودن نگارش جدید
                    </button>
                  )}
                </div>

                <div className="table-responsive">
                  <table className="table w-full text-sm">
                    <thead>
                      <tr>
                        <th>نگارش</th>
                        <th>نام فایل</th>
                        <th>حجم</th>
                        <th>هش امنیتی SHA-256</th>
                        <th>وضعیت</th>
                        <th>ثبت‌کننده</th>
                        <th>تاریخ</th>
                        <th>عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(doc.versions || []).map((ver) => (
                        <tr key={ver.id}>
                          <td className="font-mono font-bold">v{ver.version_number}</td>
                          <td>
                            <div className="font-semibold">{ver.original_filename}</div>
                            {ver.change_summary && (
                              <div className="text-xs text-muted">{ver.change_summary}</div>
                            )}
                          </td>
                          <td className="font-mono text-xs">{formatBytes(ver.file_size_bytes)}</td>
                          <td className="font-mono text-xs" title={ver.file_hash_sha256}>
                            {ver.file_hash_sha256 ? ver.file_hash_sha256.substring(0, 12) + "…" : "-"}
                          </td>
                          <td>
                            <span
                              className={`badge text-xs ${
                                ver.status === "approved"
                                  ? "badge-success"
                                  : ver.status === "superseded"
                                  ? "badge-secondary"
                                  : ver.status === "under_review"
                                  ? "badge-warning"
                                  : ver.status === "rejected"
                                  ? "badge-danger"
                                  : "badge-muted"
                              }`}
                            >
                              {ver.status_display}
                            </span>
                          </td>
                          <td className="text-xs">{ver.uploaded_by_name || "-"}</td>
                          <td className="text-xs font-mono">
                            {new Date(ver.created_at).toLocaleDateString("fa-IR")}
                          </td>
                          <td>
                            <a
                              href={ver.download_url}
                              className="btn btn-secondary btn-xs flex items-center gap-1"
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                            >
                              <Download size={13} />
                              دانلود
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REVIEWS TAB */}
            {activeTab === "reviews" && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">تاریخچه گردش کار، ممیزی و ابلاغ</h4>
                {(!doc.review_logs || doc.review_logs.length === 0) ? (
                  <p className="text-sm text-muted py-6 text-center">
                    هنوز سابقه ممیزی یا تصمیم‌گیری برای این مدرک ثبت نشده است.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {doc.review_logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-muted/10 border border-border rounded-lg text-sm flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">
                              {log.action_display}
                            </span>
                            {log.version_number && (
                              <span className="badge badge-secondary text-xs font-mono">
                                نگارش v{log.version_number}
                              </span>
                            )}
                          </div>
                          {log.decision_reason && (
                            <p className="text-xs text-muted leading-relaxed">
                              {log.decision_reason}
                            </p>
                          )}
                        </div>
                        <div className="text-left text-xs text-muted whitespace-nowrap">
                          <div>توسط: {log.reviewer_name || "سامانه"}</div>
                          <div className="font-mono mt-0.5">
                            {new Date(log.created_at).toLocaleString("fa-IR")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ACKNOWLEDGMENTS TAB */}
            {activeTab === "acknowledgments" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">تصدیق‌های ثبت‌شده توسط پرسنل (Read Receipts)</h4>
                  <span className="badge badge-primary text-xs">
                    مجموع: {doc.acknowledgments?.length || 0} نفر
                  </span>
                </div>

                {/* Acknowledgment Submission Card */}
                {doc.requires_acknowledgment && !hasAcknowledged && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                      <UserCheck size={18} />
                      <span>ثبت تصدیق مطالعه و آگاهی از الزامات سند جاری</span>
                    </div>
                    <p className="text-xs text-muted">
                      با ثبت تصدیق، اعلام می‌دارید که متن نگارش جاری این سند را مطالعه نموده و به اجرای
                      بندهای ایمنی آن در محیط کار متعهد می‌باشید.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        className="form-input flex-1 text-xs"
                        placeholder="یادداشت یا توضیحات تکمیلی (اختیاری)"
                        value={ackNote}
                        onChange={(e) => setAckNote(e.target.value)}
                      />
                      <button
                        className="btn btn-primary btn-sm flex items-center gap-1.5 justify-center"
                        onClick={handleAcknowledge}
                        disabled={ackLoading}
                      >
                        <CheckCircle2 size={16} />
                        {ackLoading ? "در حال ثبت..." : "مطالعه کردم و متعهد به اجرا هستم"}
                      </button>
                    </div>
                  </div>
                )}

                {hasAcknowledged && (
                  <div className="p-3 bg-success/10 border border-success text-success text-sm rounded-lg flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    <span>شما مطالعه و رعایت الزامات این سند را تصدیق نموده‌اید.</span>
                  </div>
                )}

                <div className="table-responsive">
                  <table className="table w-full text-sm">
                    <thead>
                      <tr>
                        <th>نام کاربر</th>
                        <th>نگارش تصدیق‌شده</th>
                        <th>تاریخ و زمان</th>
                        <th>یادداشت / تأییدیه</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(doc.acknowledgments || []).map((ack) => (
                        <tr key={ack.id}>
                          <td className="font-semibold">{ack.user_name}</td>
                          <td className="font-mono text-xs">v{ack.version_number}</td>
                          <td className="text-xs font-mono">
                            {new Date(ack.acknowledged_at).toLocaleString("fa-IR")}
                          </td>
                          <td className="text-xs text-muted">{ack.signature_note || "-"}</td>
                        </tr>
                      ))}
                      {(!doc.acknowledgments || doc.acknowledgments.length === 0) && (
                        <tr>
                          <td colSpan={4} className="text-center text-muted py-6">
                            هنوز هیچ تصدیقی برای این سند ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LINKS TAB */}
            {activeTab === "links" && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">پیوندهای یکپارچه با سایر ماژول‌های HSE</h4>
                {(!doc.cross_links || doc.cross_links.length === 0) ? (
                  <p className="text-sm text-muted py-6 text-center">
                    این مدرک هنوز به مجوز کار، داربست، تجهیزات یا حوادث پیوند داده نشده است.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {doc.cross_links.map((link) => (
                      <div
                        key={link.id}
                        className="p-3 bg-muted/10 border border-border rounded-lg text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="badge badge-secondary text-xs">
                            {link.target_type_display} #{link.target_id}
                          </span>
                          <span className="text-xs text-muted font-mono">
                            {new Date(link.created_at).toLocaleDateString("fa-IR")}
                          </span>
                        </div>
                        <div className="font-semibold text-foreground">{link.link_title || "پیوند مدرک"}</div>
                        {link.link_note && (
                          <div className="text-xs text-muted">{link.link_note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
