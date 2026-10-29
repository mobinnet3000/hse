import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Search,
  Plus,
  Download,
  Eye,
  History,
  CheckCircle2,
  Clock,
  Archive,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  FolderLock,
  UserCheck,
} from "lucide-react";
import {
  fetchDocuments,
  fetchDocumentSummary,
  getDocumentDownloadUrl,
  type ControlledDocument,
  type DocumentSummary,
} from "../../services/api";
import { useAuth } from "../auth/AuthContext";
import { CreateDocumentModal } from "./CreateDocumentModal";
import { DocumentDetailModal } from "./DocumentDetailModal";
import { ReviewDocumentModal } from "./ReviewDocumentModal";
import { UploadRevisionModal } from "./UploadRevisionModal";
import { ArchiveDocumentModal } from "./ArchiveDocumentModal";

type FilterTab = "all" | "effective" | "pending_review" | "draft" | "review_due" | "archived";

export function DocumentsPage() {
  const { user } = useAuth();

  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedConfidentiality, setSelectedConfidentiality] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [reviewDoc, setReviewDoc] = useState<ControlledDocument | null>(null);
  const [revisionDoc, setRevisionDoc] = useState<ControlledDocument | null>(null);
  const [archiveDoc, setArchiveDoc] = useState<ControlledDocument | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab, selectedCategory, selectedConfidentiality, selectedStatus]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = {};

      if (activeTab === "effective") params.filter_type = "effective";
      else if (activeTab === "pending_review") params.filter_type = "pending_review";
      else if (activeTab === "draft") params.filter_type = "draft";
      else if (activeTab === "review_due") params.filter_type = "review_due";
      else if (activeTab === "archived") params.filter_type = "archived";

      if (selectedCategory) params.category = selectedCategory;
      if (selectedConfidentiality) params.confidentiality = selectedConfidentiality;
      if (selectedStatus) params.status = selectedStatus;
      if (search.trim()) params.search = search.trim();

      const [docsData, summaryData] = await Promise.all([
        fetchDocuments(params),
        fetchDocumentSummary(),
      ]);

      setDocuments(Array.isArray(docsData) ? docsData : (docsData as any)?.results ?? []);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err?.message || "خطا در دریافت فهرست اسناد کنترل‌شده.");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadData();
  }

  // Client-side search optimization if needed
  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.document_number.toLowerCase().includes(q) ||
        (d.tags && d.tags.toLowerCase().includes(q)) ||
        (d.department && d.department.toLowerCase().includes(q))
    );
  }, [documents, search]);

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

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="text-primary" size={28} />
            <h1 className="text-2xl font-bold text-foreground">
              کنترل مدارک، نسخه‌بندی و آرشیو امن HSE
            </h1>
          </div>
          <p className="text-muted text-sm mt-1">
            سامانه یکپارچه مدیریت خط‌مشی‌ها، روش‌های اجرایی (SOP)، دستورالعمل‌ها، نگارش‌های غیرقابل‌تغییر،
            گردش کار ممیزی، تصدیق مطالعه کارکنان و بایگانی اسناد معتبر.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn btn-secondary flex items-center gap-1.5"
            onClick={loadData}
            title="به‌روزرسانی داده‌ها"
          >
            <RefreshCw size={16} />
            <span>بازخوانی</span>
          </button>

          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={18} />
            <span>ثبت و بارگذاری سند جدید</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card p-3.5 border border-border bg-card">
            <div className="flex items-center justify-between text-muted text-xs font-semibold">
              <span>کل اسناد کنترل‌شده</span>
              <FileCheck size={16} className="text-primary" />
            </div>
            <div className="text-2xl font-bold mt-2 text-foreground">
              {summary.total_documents}
            </div>
            <span className="text-[11px] text-muted">کلیه مستندات ثبت‌شده</span>
          </div>

          <div className="card p-3.5 border border-success/30 bg-success/5">
            <div className="flex items-center justify-between text-success text-xs font-semibold">
              <span>لازم‌الاجرا و جاری</span>
              <CheckCircle2 size={16} />
            </div>
            <div className="text-2xl font-bold mt-2 text-success">
              {summary.effective_documents}
            </div>
            <span className="text-[11px] text-success/80">دارای نگارش مصوب فعال</span>
          </div>

          <div className="card p-3.5 border border-warning/30 bg-warning/5">
            <div className="flex items-center justify-between text-warning text-xs font-semibold">
              <span>در انتظار ممیزی</span>
              <Clock size={16} />
            </div>
            <div className="text-2xl font-bold mt-2 text-warning">
              {summary.under_review_documents}
            </div>
            <span className="text-[11px] text-warning/80">کارتابل ممیزی و تصویب</span>
          </div>

          <div className="card p-3.5 border border-danger/30 bg-danger/5">
            <div className="flex items-center justify-between text-danger text-xs font-semibold">
              <span>سررسید / منقضی</span>
              <AlertTriangle size={16} />
            </div>
            <div className="text-2xl font-bold mt-2 text-danger">
              {summary.review_due_soon + summary.expiring_soon}
            </div>
            <span className="text-[11px] text-danger/80">نیازمند بازنگری فوری</span>
          </div>

          <div className="card p-3.5 border border-border bg-card">
            <div className="flex items-center justify-between text-muted text-xs font-semibold">
              <span>بایگانی راکد</span>
              <Archive size={16} className="text-muted" />
            </div>
            <div className="text-2xl font-bold mt-2 text-foreground">
              {summary.archived_documents}
            </div>
            <span className="text-[11px] text-muted">اسناد منسوخ راکد</span>
          </div>

          <div className="card p-3.5 border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between text-primary text-xs font-semibold">
              <span>تصدیق مطالعه (Acks)</span>
              <UserCheck size={16} />
            </div>
            <div className="text-2xl font-bold mt-2 text-primary">
              {summary.total_acknowledgments}
            </div>
            <span className="text-[11px] text-primary/80">رسید الکترونیک کارکنان</span>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="card p-4 border border-border bg-card space-y-4">
        {/* Quick Tabs */}
        <div className="flex border-b border-border gap-2 overflow-x-auto text-sm pb-1">
          <button
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-colors ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:bg-muted/10 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("all")}
          >
            همه اسناد
          </button>

          <button
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-colors ${
              activeTab === "effective"
                ? "bg-success text-white"
                : "text-muted hover:bg-muted/10 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("effective")}
          >
            لازم‌الاجرا و جاری
          </button>

          <button
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-colors ${
              activeTab === "pending_review"
                ? "bg-warning text-white"
                : "text-muted hover:bg-muted/10 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("pending_review")}
          >
            در انتظار ممیزی ({summary?.under_review_documents || 0})
          </button>

          <button
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-colors ${
              activeTab === "draft"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted hover:bg-muted/10 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("draft")}
          >
            پیش‌نویس‌ها
          </button>

          <button
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-colors ${
              activeTab === "review_due"
                ? "bg-danger text-white"
                : "text-muted hover:bg-muted/10 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("review_due")}
          >
            سررسید بازنگری و انقضا
          </button>

          <button
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-colors ${
              activeTab === "archived"
                ? "bg-muted text-foreground"
                : "text-muted hover:bg-muted/10 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("archived")}
          >
            بایگانی راکد
          </button>
        </div>

        {/* Search & Select Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <form onSubmit={handleSearchSubmit} className="relative md:col-span-2">
            <input
              type="text"
              className="form-input w-full pr-9 pl-4 text-sm"
              placeholder="جستجو در عنوان، شماره سند، برچسب‌ها و شرح..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute right-3 top-2.5 text-muted pointer-events-none" size={17} />
          </form>

          <div>
            <select
              className="form-select w-full text-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">همه دسته‌بندی‌ها</option>
              <option value="procedure">روش اجرایی استاندارد (SOP)</option>
              <option value="policy">خط‌مشی و بیانیه کلان (Policy)</option>
              <option value="work_instruction">دستورالعمل کاری (WI)</option>
              <option value="form">فرم و چک‌لیست کنترلی</option>
              <option value="sds">برگه اطلاعات ایمنی مواد (SDS)</option>
              <option value="risk_assessment">ارزیابی ریسک (JSA/HIRA)</option>
              <option value="certificate">گواهینامه و استاندارد</option>
              <option value="training_material">محتوای آموزشی</option>
              <option value="inspection_audit">گزارش ممیزی و بازرسی</option>
              <option value="environmental_record">سوابق زیست‌محیطی</option>
            </select>
          </div>

          <div>
            <select
              className="form-select w-full text-sm"
              value={selectedConfidentiality}
              onChange={(e) => setSelectedConfidentiality(e.target.value)}
            >
              <option value="">همه سطوح محرمانگی</option>
              <option value="internal">داخلی سازمان (Internal)</option>
              <option value="public">عمومی (Public)</option>
              <option value="confidential">محرمانه (Confidential)</option>
              <option value="strictly_confidential">به‌شدت محرمانه</option>
            </select>
          </div>

          <div>
            <select
              className="form-select w-full text-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="effective">لازم‌الاجرا و جاری</option>
              <option value="under_review">در حال بررسی و ممیزی</option>
              <option value="draft">پیش‌نویس</option>
              <option value="rejected">ردشده / اصلاحیه</option>
              <option value="expired">منقضی‌شده</option>
              <option value="archived">بایگانی‌شده</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center gap-2">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Document Register Table */}
      <div className="card border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted">
            <div className="spinner mb-2" />
            <p>در حال بارگذاری اسناد و مدارک کنترل‌شده...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-16 text-center text-muted space-y-3">
            <FolderLock size={42} className="mx-auto text-muted/50" />
            <p className="text-base font-semibold">مدرکی مطابق با فیلترهای انتخابی یافت نشد.</p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              می‌توانید فیلترها را ریست کنید یا با کلیک بر روی دکمه «ثبت و بارگذاری سند جدید»، نخستین مدرک
              سازمان را ثبت نمایید.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table w-full text-sm">
              <thead>
                <tr>
                  <th>شناسه یکتای مدرک</th>
                  <th>عنوان و دپارتمان</th>
                  <th>دسته‌بندی</th>
                  <th>نگارش جاری</th>
                  <th>محرمانگی</th>
                  <th>وضعیت ابلاغ</th>
                  <th>سررسید بازنگری</th>
                  <th>تصدیق مطالعه</th>
                  <th className="text-center">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/10 transition-colors">
                    {/* Document Number */}
                    <td>
                      <div className="font-mono font-bold text-foreground">
                        {doc.document_number}
                      </div>
                      <div className="text-[11px] text-muted">
                        ثبت: {new Date(doc.created_at).toLocaleDateString("fa-IR")}
                      </div>
                    </td>

                    {/* Title & Department */}
                    <td className="max-w-[280px]">
                      <div className="font-semibold text-foreground line-clamp-1">{doc.title}</div>
                      <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
                        <span>{doc.department || "واحد عمومی"}</span>
                        {doc.workplace_name && <span>• {doc.workplace_name}</span>}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="text-xs font-medium">{doc.category_display}</td>

                    {/* Version & File Info */}
                    <td>
                      {doc.current_version_number ? (
                        <div className="space-y-0.5">
                          <span className="badge badge-primary text-xs font-mono font-bold">
                            v{doc.current_version_number}
                          </span>
                          <div className="text-[11px] text-muted font-mono" title={doc.current_version_filename}>
                            {formatBytes(doc.current_version_size)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">فاقد نگارش</span>
                      )}
                    </td>

                    {/* Confidentiality */}
                    <td>{renderConfidentialityBadge(doc.confidentiality, doc.confidentiality_display)}</td>

                    {/* Status */}
                    <td>{renderStatusBadge(doc.status, doc.status_display)}</td>

                    {/* Review Due Date */}
                    <td className="text-xs font-mono">
                      {doc.next_review_date ? (
                        <span
                          className={
                            doc.is_review_overdue
                              ? "text-danger font-bold"
                              : doc.is_review_due_soon
                              ? "text-warning font-bold"
                              : "text-muted"
                          }
                        >
                          {doc.next_review_date}
                          {doc.is_review_overdue && " (گذشته)"}
                          {doc.is_review_due_soon && " (نزدیک)"}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>

                    {/* Acknowledgments */}
                    <td>
                      {doc.requires_acknowledgment ? (
                        <span className="badge badge-secondary text-xs flex items-center gap-1 w-fit">
                          <UserCheck size={13} className="text-primary" />
                          <span>{doc.acknowledgments_count} نفر</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted">عدم نیاز</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          className="btn btn-secondary btn-xs flex items-center gap-1"
                          onClick={() => setSelectedDocId(doc.id)}
                          title="مشاهده جزئیات کامل، نگارش‌ها و ممیزی"
                        >
                          <Eye size={13} />
                          <span>جزئیات</span>
                        </button>

                        {doc.current_version_id && (
                          <a
                            href={getDocumentDownloadUrl(doc.id, doc.current_version_id)}
                            className="btn btn-secondary btn-xs flex items-center gap-1 text-primary"
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            title="دانلود امن فایل جاری"
                          >
                            <Download size={13} />
                          </a>
                        )}

                        {doc.status === "under_review" && (
                          <button
                            className="btn btn-success btn-xs flex items-center gap-1"
                            onClick={() => setReviewDoc(doc)}
                            title="تصویب یا رد سند"
                          >
                            <CheckCircle2 size={13} />
                          </button>
                        )}

                        {doc.status !== "archived" && (
                          <button
                            className="btn btn-secondary btn-xs flex items-center gap-1"
                            onClick={() => setRevisionDoc(doc)}
                            title="بارگذاری نگارش جدید"
                          >
                            <History size={13} />
                          </button>
                        )}

                        {doc.status !== "archived" && (
                          <button
                            className="btn btn-warning btn-xs flex items-center gap-1"
                            onClick={() => setArchiveDoc(doc)}
                            title="بایگانی راکد"
                          >
                            <Archive size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateDocumentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={loadData}
      />

      <DocumentDetailModal
        isOpen={Boolean(selectedDocId)}
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
        onRefresh={loadData}
        onOpenReview={(d) => setReviewDoc(d)}
        onOpenRevision={(d) => setRevisionDoc(d)}
        onOpenArchive={(d) => setArchiveDoc(d)}
        currentUser={user ? { id: user.id, username: user.username } : undefined}
      />

      <ReviewDocumentModal
        isOpen={Boolean(reviewDoc)}
        document={reviewDoc}
        onClose={() => setReviewDoc(null)}
        onSuccess={loadData}
      />

      <UploadRevisionModal
        isOpen={Boolean(revisionDoc)}
        document={revisionDoc}
        onClose={() => setRevisionDoc(null)}
        onSuccess={loadData}
      />

      <ArchiveDocumentModal
        isOpen={Boolean(archiveDoc)}
        document={archiveDoc}
        onClose={() => setArchiveDoc(null)}
        onSuccess={loadData}
      />
    </div>
  );
}
