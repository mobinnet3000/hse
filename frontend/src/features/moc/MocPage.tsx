import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Filter,
  Layers,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  ApiRequestError,
  approveMOCRisk,
  authorizeMOC,
  closeMOC,
  createMOC,
  fetchMOCDetail,
  fetchMOCList,
  fetchOrganizations,
  fetchRiskRegisters,
  fetchWorkplaces,
  submitMOC,
  type ChangeRequest,
  type Organization,
  type RiskRegisterItem,
  type Workplace,
} from "../../services/api";

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "خطای نامشخص در ارتباط با سرور";
}

const TYPE_LABELS: Record<string, string> = {
  process: "فرایندی (تغییر خطوط، پارامترهای عملیاتی یا متریال)",
  equipment: "تجهیزات و ماشین‌آلات (تعویض، اضافه یا حذف)",
  procedural: "رویه و دستورالعمل (SOP / مجوزها)",
  material: "مواد اولیه، کاتالیست یا مواد شیمیایی",
  organizational: "ساختار سازمانی یا پرسنل کلیدی",
};

const CATEGORY_LABELS: Record<string, string> = {
  permanent: "دائمی",
  temporary: "موقت (دارای انقضای مشخص)",
  emergency: "فوری / اضطراری",
};

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "پیش‌نویس", bg: "bg-stone-100", text: "text-stone-700" },
  submitted: { label: "در انتظار ارزیابی ریسک", bg: "bg-amber-100", text: "text-amber-800" },
  risk_assessed: { label: "ارزیابی ریسک انجام‌شده", bg: "bg-blue-100", text: "text-blue-800" },
  under_review: { label: "در حال بررسی کمیته", bg: "bg-indigo-100", text: "text-indigo-800" },
  approved: { label: "مجاز به اجرا (تأیید نهایی)", bg: "bg-emerald-100", text: "text-emerald-800" },
  rejected: { label: "رد شده", bg: "bg-rose-100", text: "text-rose-800" },
  implemented: { label: "اجرا شده", bg: "bg-teal-100", text: "text-teal-800" },
  closed: { label: "مختومه‌شده و اسناد به‌روزشده", bg: "bg-slate-200", text: "text-slate-800" },
};

export function MocPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [riskRegisters, setRiskRegisters] = useState<RiskRegisterItem[]>([]);
  const [mocList, setMocList] = useState<ChangeRequest[]>([]);
  const [selectedMoc, setSelectedMoc] = useState<ChangeRequest | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showRiskModal, setShowRiskModal] = useState<boolean>(false);
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    title: "",
    change_type: "process" as ChangeRequest["change_type"],
    category: "permanent" as ChangeRequest["category"],
    workplace: "",
    reason_for_change: "",
    description: "",
    risk_assessment_required: true,
    document_revision_required: false,
    document_revisions_notes: "",
    training_required: false,
    training_notes: "",
    project_name: "",
    area: "",
  });

  // Risk Assessment Form State
  const [riskAssessmentForm, setRiskAssessmentForm] = useState({
    risk_notes: "",
    is_approved: true,
    risk_register: "",
  });

  // Close Form State
  const [closureNotes, setClosureNotes] = useState("");

  // Load organizations
  useEffect(() => {
    fetchOrganizations()
      .then((orgs) => {
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setOrganizationId(orgs[0].id);
        }
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // Load workplaces and MOCs
  useEffect(() => {
    if (!organizationId) return;
    loadMocs();
    fetchWorkplaces(organizationId)
      .then(setWorkplaces)
      .catch(() => {});
    fetchRiskRegisters(organizationId)
      .then(setRiskRegisters)
      .catch(() => {});
  }, [organizationId, statusFilter]);

  async function loadMocs() {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMOCList(
        organizationId,
        statusFilter === "all" ? undefined : statusFilter
      );
      setMocList(data);
      if (selectedMoc) {
        const refreshed = data.find((m) => m.id === selectedMoc.id);
        if (refreshed) setSelectedMoc(refreshed);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectMoc(moc: ChangeRequest) {
    try {
      const detail = await fetchMOCDetail(moc.id);
      setSelectedMoc(detail);
    } catch (err) {
      setSelectedMoc(moc);
    }
  }

  async function handleCreateMOC(e: FormEvent) {
    e.preventDefault();
    if (!organizationId) return;
    setActionLoading(true);
    setError(null);
    try {
      const created = await createMOC({
        organization: organizationId,
        workplace: createForm.workplace ? Number(createForm.workplace) : null,
        title: createForm.title,
        change_type: createForm.change_type,
        category: createForm.category,
        reason_for_change: createForm.reason_for_change,
        description: createForm.description,
        risk_assessment_required: createForm.risk_assessment_required,
        document_revision_required: createForm.document_revision_required,
        document_revisions_notes: createForm.document_revisions_notes,
        training_required: createForm.training_required,
        training_notes: createForm.training_notes,
      });
      setShowCreateModal(false);
      setActionSuccess(`درخواست تغییر ${created.moc_number} با موفقیت ثبت شد.`);
      setCreateForm({
        title: "",
        change_type: "process",
        category: "permanent",
        workplace: "",
        reason_for_change: "",
        description: "",
        risk_assessment_required: true,
        document_revision_required: false,
        document_revisions_notes: "",
        training_required: false,
        training_notes: "",
        project_name: "",
        area: "",
      });
      await loadMocs();
      setSelectedMoc(created);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitMOC(id: number) {
    setActionLoading(true);
    setError(null);
    try {
      const updated = await submitMOC(id);
      setActionSuccess(`درخواست تغییر ${updated.moc_number} جهت ارزیابی ریسک ثبت شد.`);
      setSelectedMoc(updated);
      await loadMocs();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproveRisk(e: FormEvent) {
    e.preventDefault();
    if (!selectedMoc) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await approveMOCRisk(selectedMoc.id, {
        risk_notes: riskAssessmentForm.risk_notes,
        is_approved: riskAssessmentForm.is_approved,
        risk_register: riskAssessmentForm.risk_register || undefined,
      });
      setShowRiskModal(false);
      setActionSuccess("نتیجه ارزیابی و تأییدیه ریسک تغییر با موفقیت ثبت شد.");
      setSelectedMoc(updated);
      await loadMocs();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAuthorizeMOC(id: number) {
    setActionLoading(true);
    setError(null);
    try {
      const updated = await authorizeMOC(id);
      setActionSuccess(`مجوز اجرای تغییر ${updated.moc_number} با موفقیت صادر شد.`);
      setSelectedMoc(updated);
      await loadMocs();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCloseMOC(e: FormEvent) {
    e.preventDefault();
    if (!selectedMoc) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await closeMOC(selectedMoc.id, { closure_notes: closureNotes });
      setShowCloseModal(false);
      setActionSuccess(`درخواست تغییر ${updated.moc_number} با موفقیت مختومه شد.`);
      setSelectedMoc(updated);
      await loadMocs();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  // Statistics calculation
  const totalCount = mocList.length;
  const pendingRiskCount = mocList.filter((m) => m.status === "submitted").length;
  const underReviewCount = mocList.filter((m) => m.status === "under_review").length;
  const approvedCount = mocList.filter((m) => m.status === "approved" || m.status === "implemented").length;
  const closedCount = mocList.filter((m) => m.status === "closed").length;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 md:p-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-stone-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold shadow-sm">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                مدیریت یکپارچه تغییرات (Management of Change - MOC)
              </h1>
              <p className="text-sm text-stone-500 mt-0.5">
                فاز ۳: کنترل تغییرات فرایندی، مکانیکی، سندی و سازمانی با اتصال الزام‌آور به تحلیل و تأییدیه ریسک
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {organizations.length > 1 && (
            <select
              className="bg-white border border-stone-300 text-stone-800 text-sm rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              value={organizationId ?? ""}
              onChange={(e) => setOrganizationId(Number(e.target.value))}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            ثبت درخواست تغییر جدید (MOC)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 my-6">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <span className="text-xs text-stone-500 block">کل تغییرات ثبت‌شده</span>
          <span className="text-2xl font-bold text-stone-800 mt-1 block">{totalCount}</span>
        </div>
        <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs text-amber-700 block">در انتظار ارزیابی ریسک</span>
          <span className="text-2xl font-bold text-amber-900 mt-1 block">{pendingRiskCount}</span>
        </div>
        <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 shadow-sm">
          <span className="text-xs text-indigo-700 block">در حال بررسی کمیته MOC</span>
          <span className="text-2xl font-bold text-indigo-900 mt-1 block">{underReviewCount}</span>
        </div>
        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-sm">
          <span className="text-xs text-emerald-700 block">دارای مجوز اجرا (Authorized)</span>
          <span className="text-2xl font-bold text-emerald-900 mt-1 block">{approvedCount}</span>
        </div>
        <div className="bg-stone-100 p-4 rounded-xl border border-stone-200 shadow-sm">
          <span className="text-xs text-stone-600 block">مختومه‌شده و اسناد بازنگری‌شده</span>
          <span className="text-2xl font-bold text-stone-800 mt-1 block">{closedCount}</span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: List & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Filter and List */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
          {/* Filter Bar */}
          <div className="p-4 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-600">
              <Filter className="w-3.5 h-3.5" />
              <span>فیلتر وضعیت:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-700"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="draft">پیش‌نویس</option>
              <option value="submitted">در انتظار ارزیابی ریسک</option>
              <option value="under_review">در حال بررسی کمیته</option>
              <option value="approved">دارای مجوز اجرا (Approved)</option>
              <option value="implemented">اجراشده</option>
              <option value="closed">مختومه‌شده</option>
            </select>
          </div>

          {/* List Items */}
          <div className="divide-y divide-stone-100 overflow-y-auto max-h-[680px]">
            {loading ? (
              <div className="p-8 text-center text-stone-400 text-sm">در حال بارگذاری لیست تغییرات...</div>
            ) : mocList.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-sm">موردی برای نمایش یافت نشد.</div>
            ) : (
              mocList.map((moc) => {
                const isSelected = selectedMoc?.id === moc.id;
                const statusMeta = STATUS_LABELS[moc.status] || {
                  label: moc.status_display || moc.status,
                  bg: "bg-stone-100",
                  text: "text-stone-700",
                };
                return (
                  <div
                    key={moc.id}
                    onClick={() => handleSelectMoc(moc)}
                    className={`p-4 cursor-pointer transition text-right hover:bg-stone-50 ${
                      isSelected ? "bg-emerald-50/40 border-r-4 border-emerald-700" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-stone-600 tracking-wider">
                        {moc.moc_number}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.text}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <h3 className="font-semibold text-stone-900 text-sm line-clamp-1">{moc.title}</h3>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-1">{moc.reason_for_change}</p>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-100 pt-2">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {CATEGORY_LABELS[moc.category] || moc.category_display}
                      </span>
                      {moc.risk_assessment_required && (
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            moc.risk_approved ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {moc.risk_approved ? "ریسک تأییدشده" : "نیازمند تأیید ریسک"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Selected MOC Details */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-stone-200 shadow-sm p-6 flex flex-col justify-between min-h-[600px]">
          {selectedMoc ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="border-b border-stone-200 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-extrabold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                      {selectedMoc.moc_number}
                    </span>
                    {selectedMoc.traceability_chain_id && (
                      <span className="font-mono text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded flex items-center gap-1 border border-stone-200">
                        <LinkIcon className="w-3 h-3" />
                        {selectedMoc.traceability_chain_id}
                      </span>
                    )}
                  </div>

                  {(() => {
                    const meta = STATUS_LABELS[selectedMoc.status] || {
                      label: selectedMoc.status_display || selectedMoc.status,
                      bg: "bg-stone-100",
                      text: "text-stone-700",
                    };
                    return (
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${meta.bg} ${meta.text}`}>
                        {meta.label}
                      </span>
                    );
                  })()}
                </div>

                <h2 className="text-xl font-bold text-stone-900 mt-2">{selectedMoc.title}</h2>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs bg-stone-50 p-4 rounded-lg border border-stone-200">
                <div>
                  <span className="text-stone-500 block">نوع تغییر:</span>
                  <span className="font-medium text-stone-800 mt-0.5 block">
                    {TYPE_LABELS[selectedMoc.change_type] || selectedMoc.change_type_display}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">طبقه‌بندی زمانی:</span>
                  <span className="font-medium text-stone-800 mt-0.5 block">
                    {CATEGORY_LABELS[selectedMoc.category] || selectedMoc.category_display}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">ثبت‌کننده:</span>
                  <span className="font-medium text-stone-800 mt-0.5 block">
                    {selectedMoc.requested_by_name || "کارشناس فنی"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">تجهیز مرتبط:</span>
                  <span className="font-medium text-stone-800 mt-0.5 block">
                    {selectedMoc.related_equipment_name || "کل واحد / عمومی"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">نیاز به بازنگری اسناد:</span>
                  <span className="font-medium text-stone-800 mt-0.5 block">
                    {selectedMoc.document_revision_required ? "بله (P&ID / SOP)" : "خیر"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">نیاز به آموزش پرسنل:</span>
                  <span className="font-medium text-stone-800 mt-0.5 block">
                    {selectedMoc.training_required ? "بله" : "خیر"}
                  </span>
                </div>
              </div>

              {/* Reason & Description */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    دلیل و توجیه فنی تغییر:
                  </h4>
                  <p className="text-sm text-stone-800 bg-white p-3 rounded-lg border border-stone-200 whitespace-pre-line leading-relaxed">
                    {selectedMoc.reason_for_change}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    شرح جزئیات تغییر و دامنه اجرا:
                  </h4>
                  <p className="text-sm text-stone-800 bg-white p-3 rounded-lg border border-stone-200 whitespace-pre-line leading-relaxed">
                    {selectedMoc.description}
                  </p>
                </div>
              </div>

              {/* Risk Assessment & Approval Section (Approval-Based Wire) */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-800" />
                    <h3 className="font-bold text-sm text-stone-900">
                      وضعیت ارزیابی ریسک تغییر (Risk Assessment Gatekeeper)
                    </h3>
                  </div>

                  {selectedMoc.risk_assessment_required ? (
                    selectedMoc.risk_approved ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تأییدیه ریسک صادر شد
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                        <Clock className="w-3.5 h-3.5" />
                        در انتظار تأییدیه ارزیابی ریسک
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-stone-500">ارزیابی ریسک غیرالزامی</span>
                  )}
                </div>

                {selectedMoc.risk_assessment_notes ? (
                  <div className="bg-white p-3 rounded-lg border border-stone-200 text-xs space-y-1.5">
                    <div className="flex justify-between text-stone-400">
                      <span>ارزیاب: {selectedMoc.risk_assessor_name || "کارشناس ارزیابی ریسک"}</span>
                      {selectedMoc.related_risk_register_code && (
                        <span className="font-mono text-emerald-700 font-bold">
                          رجیستر متصل: {selectedMoc.related_risk_register_code}
                        </span>
                      )}
                    </div>
                    <p className="text-stone-800 font-medium">{selectedMoc.risk_assessment_notes}</p>
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">
                    طبق پروتکل‌های ایمنی، صدور مجوز اجرای این تغییر نیازمند بررسی اثرات بر ایمنی فرایند و خطرات محیطی توسط ماژول مدیریت ریسک می‌باشد.
                  </p>
                )}

                {/* Risk assessment button if pending */}
                {selectedMoc.status === "submitted" && (
                  <div className="pt-2">
                    <button
                      onClick={() => setShowRiskModal(true)}
                      className="text-xs bg-amber-700 hover:bg-amber-800 text-white font-medium px-3.5 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      ثبت ارزیابی و تأییدیه ریسک (MOC ➔ Risk)
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="border-t border-stone-200 pt-4 flex flex-wrap items-center justify-end gap-3">
                {selectedMoc.status === "draft" && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleSubmitMOC(selectedMoc.id)}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    ثبت نهایی و ارسال به ارزیابی ریسک
                  </button>
                )}

                {selectedMoc.status === "under_review" && (
                  <button
                    disabled={actionLoading || (selectedMoc.risk_assessment_required && !selectedMoc.risk_approved)}
                    onClick={() => handleAuthorizeMOC(selectedMoc.id)}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <FileCheck className="w-4 h-4" />
                    صدور مجوز نهایی اجرای تغییر (Authorize MOC)
                  </button>
                )}

                {(selectedMoc.status === "approved" || selectedMoc.status === "implemented") && (
                  <button
                    onClick={() => setShowCloseModal(true)}
                    className="bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    مختومه‌سازی و تایید به‌روزرسانی اسناد (Close MOC)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-stone-400 py-20">
              <FileText className="w-12 h-12 stroke-1 mb-2 text-stone-300" />
              <p className="text-sm">یک درخواست تغییر را از لیست سمت راست انتخاب نمایید.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create MOC */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full p-6 text-right my-8">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <h3 className="font-bold text-lg text-stone-900">ثبت درخواست جدید مدیریت تغییر (MOC)</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMOC} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">عنوان تغییر *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: جایگزینی پمپ سانتریفیوژ واحد تقطیر با نوع با راندمان بالا"
                  className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">واحد / محل استقرار (Workplace)</label>
                  <select
                    className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                    value={createForm.workplace}
                    onChange={(e) => setCreateForm({ ...createForm, workplace: e.target.value })}
                  >
                    <option value="">-- کل واحد / عمومی --</option>
                    {workplaces.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ناحیه عملیاتی / بخش (Area)</label>
                  <input
                    type="text"
                    placeholder="مثال: واحد تفکیک گاز، مخازن کروی"
                    className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                    value={createForm.area}
                    onChange={(e) => setCreateForm({ ...createForm, area: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">نوع تغییر *</label>
                  <select
                    className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                    value={createForm.change_type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, change_type: e.target.value as ChangeRequest["change_type"] })
                    }
                  >
                    <option value="process">فرایندی (متریال، پارامترهای عملیاتی)</option>
                    <option value="equipment">تجهیزات و ماشین‌آلات</option>
                    <option value="procedural">رویه و دستورالعمل (SOP)</option>
                    <option value="material">مواد شیمیایی یا کاتالیست</option>
                    <option value="organizational">ساختار سازمانی یا پرسنل</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">طبقه‌بندی زمانی *</label>
                  <select
                    className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                    value={createForm.category}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, category: e.target.value as ChangeRequest["category"] })
                    }
                  >
                    <option value="permanent">دائمی</option>
                    <option value="temporary">موقت (دارای انقضای مشخص)</option>
                    <option value="emergency">فوری / اضطراری</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">دلیل و توجیه فنی تغییر *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="علت درخواست، معایب سیستم فعلی و اهداف تغییر..."
                  className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                  value={createForm.reason_for_change}
                  onChange={(e) => setCreateForm({ ...createForm, reason_for_change: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">شرح جزئیات فنی تغییر *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="مشخصات فنی، الزامات متریال، ابعاد، مراحل نصب و اجرا..."
                  className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>

              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={createForm.risk_assessment_required}
                    onChange={(e) => setCreateForm({ ...createForm, risk_assessment_required: e.target.checked })}
                    className="rounded text-emerald-700 focus:ring-emerald-700"
                  />
                  <span>نیاز به ارزیابی ریسک و تحلیل خطرات (MOC ➔ Risk Gatekeeper)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={createForm.document_revision_required}
                    onChange={(e) => setCreateForm({ ...createForm, document_revision_required: e.target.checked })}
                    className="rounded text-emerald-700 focus:ring-emerald-700"
                  />
                  <span>نیاز به بازنگری و اصلاح نقشه‌های P&ID یا دستورالعمل‌های عملیاتی</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={createForm.training_required}
                    onChange={(e) => setCreateForm({ ...createForm, training_required: e.target.checked })}
                    className="rounded text-emerald-700 focus:ring-emerald-700"
                  />
                  <span>نیاز به آموزش پرسنل بهره‌برداری پیش از راه‌اندازی</span>
                </label>
              </div>

              <div className="pt-4 border-t border-stone-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  ثبت پیش‌نویس تغییر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Risk Assessment & Approval */}
      {showRiskModal && selectedMoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full p-6 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-bold text-base text-stone-900">
                ارزیابی و صدور تأییدیه ریسک تغییر ({selectedMoc.moc_number})
              </h3>
              <button onClick={() => setShowRiskModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApproveRisk} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  شرح تحلیل ریسک و تدابیر کنترلی الزامی *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="نتایج HAZOP / FMEA، خطرات اضافه شونده به سیستم، حفاظ‌های فنی مورد نیاز و الزامات ایمنی پیش از اجرا..."
                  className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                  value={riskAssessmentForm.risk_notes}
                  onChange={(e) => setRiskAssessmentForm({ ...riskAssessmentForm, risk_notes: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  اتصال به پرونده رجیستر ریسک (اختیاری)
                </label>
                <select
                  className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                  value={riskAssessmentForm.risk_register}
                  onChange={(e) => setRiskAssessmentForm({ ...riskAssessmentForm, risk_register: e.target.value })}
                >
                  <option value="">-- بدون پیوند مستقیم --</option>
                  {riskRegisters.map((rr) => (
                    <option key={rr.id} value={rr.id}>
                      {rr.register_code} - {rr.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-800">
                  <input
                    type="radio"
                    name="is_approved"
                    checked={riskAssessmentForm.is_approved}
                    onChange={() => setRiskAssessmentForm({ ...riskAssessmentForm, is_approved: true })}
                  />
                  <span>تأیید ریسک و ارجاع به کمیته تغییرات جهت صدور مجوز اجرا</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-800">
                  <input
                    type="radio"
                    name="is_approved"
                    checked={!riskAssessmentForm.is_approved}
                    onChange={() => setRiskAssessmentForm({ ...riskAssessmentForm, is_approved: false })}
                  />
                  <span>عدم تأیید (ریسک غیرقابل‌قبول / رد تغییر)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-stone-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRiskModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  ثبت ارزیابی ریسک
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close MOC */}
      {showCloseModal && selectedMoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full p-6 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-bold text-base text-stone-900">
                مختومه‌سازی و تایید نهایی تغییر ({selectedMoc.moc_number})
              </h3>
              <button onClick={() => setShowCloseModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseMOC} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  گزارش پایانی و اقدامات اصلاح مستندات *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="تأیید به‌روزرسانی P&ID، تحویل و راه‌اندازی موفقیت‌آمیز، آموزش اپراتورها و ثبت در سوابق نگهداری..."
                  className="w-full text-sm border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-700"
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t border-stone-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-stone-900 hover:bg-black text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  مختومه‌سازی نهایی MOC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
