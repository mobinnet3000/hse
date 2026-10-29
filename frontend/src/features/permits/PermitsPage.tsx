import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  activatePermit,
  acknowledgeShiftHandover,
  approvePermit,
  cancelPermit,
  closePermit,
  completePermit,
  createPermit,
  createShiftHandover,
  fetchMemberships,
  fetchOrganizations,
  fetchPermitDetail,
  fetchPermits,
  fetchPermitStats,
  fetchShiftHandovers,
  fetchShiftSafetySummary,
  fetchWorkplaces,
  rejectPermit,
  resumePermit,
  reviewPermit,
  suspendPermit,
  type Membership,
  type Organization,
  type PermitDetail,
  type PermitListItem,
  type PermitStatus,
  type PermitSummaryStats,
  type PermitType,
  type ShiftHandoverItem,
  type ShiftSafetySummary,
  type ShiftType,
  type Workplace,
  ApiRequestError,
} from "../../services/api";

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "خطای نامشخص در ارتباط با سرور";
}

/** Format a Date for a <input type="datetime-local"> using local time (not UTC). */
function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** Convert a local datetime-local value to an ISO timestamp for the API. */
function localInputToIso(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

const SHIFT_HANDOVER_ROLES = new Set([
  "org_admin",
  "hse_manager",
  "workshop_supervisor",
  "hse_inspector",
]);

const PERMIT_TYPE_LABELS: Record<PermitType, string> = {
  hot_work: "کار گرم و شعله",
  work_at_height: "کار در ارتفاع",
  confined_space: "ورود به فضای بسته",
  electrical_isolation: "ایزولاسیون برقی و انرژی (LOTO)",
  excavation: "حفاری و گودبرداری",
  general_high_risk: "سایر فعالیت‌های پرخطر",
};

const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  requested: "درخواست‌شده",
  under_review: "در حال بررسی اولیه",
  approved: "تأییدشده",
  active: "فعال و در حال اجرا",
  suspended: "معلق‌شده",
  completed: "اتمام کار عملیاتی",
  closed: "مختومه‌شده",
  rejected: "ردشده",
  cancelled: "لغوشده",
  expired: "منقضی‌شده",
};

const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  morning: "شیفت صبح (۰۷:۰۰ الی ۱۵:۰۰)",
  evening: "شیفت عصر (۱۵:۰۰ الی ۲۳:۰۰)",
  night: "شیفت شب (۲۳:۰۰ الی ۰۷:۰۰)",
};

export function PermitsPage() {
  const { user } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState<"ptw" | "handover">("ptw");

  // Organizations & Workplaces
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  // Permits state
  const [permits, setPermits] = useState<PermitListItem[]>([]);
  const [stats, setStats] = useState<PermitSummaryStats | null>(null);
  const [permitsLoading, setPermitsLoading] = useState(true);
  const [permitsError, setPermitsError] = useState<string | null>(null);

  // Permit Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterWorkplace, setFilterWorkplace] = useState("");

  // Detail Modal
  const [selectedPermit, setSelectedPermit] = useState<PermitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Action Modals for Permits
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Submitting status
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Shift Handovers state
  const [handovers, setHandovers] = useState<ShiftHandoverItem[]>([]);
  const [safetySummary, setSafetySummary] = useState<ShiftSafetySummary | null>(null);
  const [handoversLoading, setHandoversLoading] = useState(false);
  const [handoversError, setHandoversError] = useState<string | null>(null);
  const [isCreateHandoverModalOpen, setIsCreateHandoverModalOpen] = useState(false);
  const [selectedHandoverForAck, setSelectedHandoverForAck] = useState<ShiftHandoverItem | null>(null);

  // Load organizations on initial mount
  useEffect(() => {
    fetchOrganizations()
      .then((orgs) => {
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setSelectedOrgId(orgs[0].id);
        }
      })
      .catch((err) => setPermitsError(errorMessage(err)));
  }, []);

  // Load workplaces when selected organization changes
  useEffect(() => {
    if (!selectedOrgId) return;
    fetchWorkplaces(selectedOrgId)
      .then(setWorkplaces)
      .catch(() => setWorkplaces([]));
  }, [selectedOrgId]);

  // Load organization members (used for incoming shift supervisor selection)
  useEffect(() => {
    if (!selectedOrgId) {
      setMemberships([]);
      return;
    }
    fetchMemberships(selectedOrgId)
      .then(setMemberships)
      .catch(() => setMemberships([]));
  }, [selectedOrgId]);

  const currentMembership = memberships.find((m) => m.user === user?.id && m.is_active);
  const canConductHandover =
    user?.global_role === "platform_admin" ||
    (currentMembership ? SHIFT_HANDOVER_ROLES.has(currentMembership.role) : false);

  // Load permits and stats
  const reloadPermits = () => {
    if (!selectedOrgId) return;
    setPermitsLoading(true);
    setPermitsError(null);

    const params: Record<string, string | number> = { organization: selectedOrgId };
    if (filterWorkplace) params.workplace = filterWorkplace;
    if (filterType) params.permit_type = filterType;
    if (filterStatus) params.status = filterStatus;
    if (search.trim()) params.search = search.trim();

    Promise.all([fetchPermits(params), fetchPermitStats(selectedOrgId)])
      .then(([items, statsData]) => {
        setPermits(items);
        setStats(statsData);
      })
      .catch((err) => setPermitsError(errorMessage(err)))
      .finally(() => setPermitsLoading(false));
  };

  useEffect(() => {
    reloadPermits();
  }, [selectedOrgId, filterWorkplace, filterType, filterStatus]);

  // Load handovers and safety summary
  const reloadHandovers = () => {
    if (!selectedOrgId) return;
    setHandoversLoading(true);
    setHandoversError(null);

    const wpId = filterWorkplace ? parseInt(filterWorkplace, 10) : undefined;
    Promise.all([
      fetchShiftHandovers({ organization: selectedOrgId, workplace: wpId || "" }),
      fetchShiftSafetySummary(selectedOrgId, wpId),
    ])
      .then(([items, safety]) => {
        setHandovers(items);
        setSafetySummary(safety);
      })
      .catch((err) => setHandoversError(errorMessage(err)))
      .finally(() => setHandoversLoading(false));
  };

  useEffect(() => {
    if (activeMainTab === "handover") {
      reloadHandovers();
    }
  }, [activeMainTab, selectedOrgId, filterWorkplace]);

  const openPermitDetail = (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    fetchPermitDetail(id)
      .then((detail) => setSelectedPermit(detail))
      .catch((err) => setDetailError(errorMessage(err)))
      .finally(() => setDetailLoading(false));
  };

  // Helper badge color
  const getStatusBadgeClass = (status: PermitStatus) => {
    switch (status) {
      case "active":
        return "badge-success";
      case "approved":
        return "badge-info";
      case "requested":
      case "under_review":
        return "badge-warning";
      case "suspended":
      case "rejected":
      case "expired":
        return "badge-danger";
      case "completed":
      case "closed":
      case "cancelled":
      default:
        return "badge-secondary";
    }
  };

  return (
    <div className="permits-page" dir="rtl">
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2>مدیریت پروانه‌های کار (PTW) و تحویل شیفت</h2>
          <p className="muted" style={{ margin: 0 }}>
            صدور مجوزهای ایمنی، کنترل میدان، رعایت تفکیک وظایف و ثبت گزارش ایمنی تحویل شیفت
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <label htmlFor="org-select" style={{ fontWeight: 500 }}>
            سازمان:
          </label>
          <select
            id="org-select"
            value={selectedOrgId || ""}
            onChange={(e) => setSelectedOrgId(Number(e.target.value))}
            style={{ padding: "0.4rem 0.8rem", borderRadius: "4px" }}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="sub-tabs" style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid var(--border-color, #e2e8f0)", marginBottom: "1.5rem" }}>
        <button
          type="button"
          className={`tab-btn ${activeMainTab === "ptw" ? "active" : ""}`}
          onClick={() => setActiveMainTab("ptw")}
          style={{
            padding: "0.6rem 1.2rem",
            background: "none",
            border: "none",
            borderBottom: activeMainTab === "ptw" ? "3px solid var(--primary-color, #0284c7)" : "none",
            fontWeight: activeMainTab === "ptw" ? "bold" : "normal",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          📋 پروانه‌های کار (Permit to Work)
        </button>
        <button
          type="button"
          className={`tab-btn ${activeMainTab === "handover" ? "active" : ""}`}
          onClick={() => setActiveMainTab("handover")}
          style={{
            padding: "0.6rem 1.2rem",
            background: "none",
            border: "none",
            borderBottom: activeMainTab === "handover" ? "3px solid var(--primary-color, #0284c7)" : "none",
            fontWeight: activeMainTab === "handover" ? "bold" : "normal",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          🔄 تحویل و تحول شیفت (Shift Handover)
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PERMITS TO WORK (PTW)                             */}
      {/* ======================================================== */}
      {activeMainTab === "ptw" && (
        <div className="ptw-content">
          {/* KPI Cards */}
          {stats && (
            <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <div className="kpi-card" style={{ padding: "1rem", borderRadius: "8px", background: "var(--card-bg, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)" }}>
                <span className="muted" style={{ fontSize: "0.85rem" }}>کل مجوزها</span>
                <h3 style={{ margin: "0.3rem 0 0", color: "#1e293b" }}>{stats.total_permits}</h3>
              </div>
              <div className="kpi-card" style={{ padding: "1rem", borderRadius: "8px", background: "var(--card-bg, #f0fdf4)", border: "1px solid #bbf7d0" }}>
                <span style={{ fontSize: "0.85rem", color: "#166534" }}>مجوزهای فعال و در حال اجرا</span>
                <h3 style={{ margin: "0.3rem 0 0", color: "#15803d" }}>{stats.active_count}</h3>
              </div>
              <div className="kpi-card" style={{ padding: "1rem", borderRadius: "8px", background: "var(--card-bg, #fefce8)", border: "1px solid #fef08a" }}>
                <span style={{ fontSize: "0.85rem", color: "#854d0e" }}>در انتظار بررسی و تأیید</span>
                <h3 style={{ margin: "0.3rem 0 0", color: "#a16207" }}>{stats.requested_count + stats.approved_count}</h3>
              </div>
              <div className="kpi-card" style={{ padding: "1rem", borderRadius: "8px", background: "var(--card-bg, #fef2f2)", border: "1px solid #fecaca" }}>
                <span style={{ fontSize: "0.85rem", color: "#991b1b" }}>معلق‌شده یا منقضی</span>
                <h3 style={{ margin: "0.3rem 0 0", color: "#b91c1c" }}>{stats.suspended_count + stats.expired_count}</h3>
              </div>
            </div>
          )}

          {/* Action & Filter Bar */}
          <div className="filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "1.5rem", background: "var(--card-bg, #f8fafc)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-color, #e2e8f0)" }}>
            <input
              type="text"
              placeholder="جستجو در عنوان، کد رهگیری، تجهیزات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") reloadPermits(); }}
              style={{ flex: "1 1 220px", padding: "0.5rem 0.8rem", borderRadius: "4px", border: "1px solid var(--border-color, #cbd5e1)" }}
            />
            <select
              value={filterWorkplace}
              onChange={(e) => setFilterWorkplace(e.target.value)}
              style={{ padding: "0.5rem 0.8rem", borderRadius: "4px", border: "1px solid var(--border-color, #cbd5e1)" }}
            >
              <option value="">همه کارگاه‌ها</option>
              {workplaces.map((wp) => (
                <option key={wp.id} value={wp.id}>
                  {wp.name}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: "0.5rem 0.8rem", borderRadius: "4px", border: "1px solid var(--border-color, #cbd5e1)" }}
            >
              <option value="">همه انواع مجوز</option>
              {Object.entries(PERMIT_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: "0.5rem 0.8rem", borderRadius: "4px", border: "1px solid var(--border-color, #cbd5e1)" }}
            >
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(PERMIT_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={reloadPermits}
              className="btn btn-secondary"
              style={{ padding: "0.5rem 1rem" }}
            >
              🔍 فیلتر
            </button>
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setIsCreateModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ marginLeft: "auto", padding: "0.5rem 1.2rem", fontWeight: "bold" }}
            >
              + درخواست مجوز جدید
            </button>
          </div>

          {/* Permits Table */}
          {permitsLoading ? (
            <p className="centered muted">در حال بارگذاری اطلاعات مجوزهای کار…</p>
          ) : permitsError ? (
            <div className="error-box" style={{ padding: "1rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px" }}>
              {permitsError}
            </div>
          ) : permits.length === 0 ? (
            <div className="empty-box" style={{ textAlign: "center", padding: "3rem", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
              <p className="muted" style={{ fontSize: "1.1rem", margin: "0 0 1rem" }}>هیچ مجوزی مطابق با فیلترهای جاری یافت نشد.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                ثبت اولین درخواست مجوز
              </button>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--table-header, #f1f5f9)", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "0.75rem", textAlign: "right" }}>کد رهگیری</th>
                    <th style={{ padding: "0.75rem", textAlign: "right" }}>عنوان و شرح</th>
                    <th style={{ padding: "0.75rem", textAlign: "right" }}>محل کار</th>
                    <th style={{ padding: "0.75rem", textAlign: "right" }}>نوع مجوز</th>
                    <th style={{ padding: "0.75rem", textAlign: "center" }}>الزامات ایمنی</th>
                    <th style={{ padding: "0.75rem", textAlign: "center" }}>وضعیت</th>
                    <th style={{ padding: "0.75rem", textAlign: "right" }}>اعتبار زمانی</th>
                    <th style={{ padding: "0.75rem", textAlign: "center" }}>اقدامات</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "0.75rem", fontFamily: "monospace", fontWeight: "bold" }}>
                        {p.reference_code}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <div style={{ fontWeight: 600 }}>{p.title}</div>
                        <span className="muted" style={{ fontSize: "0.8rem" }}>درخواست‌دهنده: {p.requester_name}</span>
                      </td>
                      <td style={{ padding: "0.75rem" }}>{p.workplace_name || "—"}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <span style={{ fontSize: "0.85rem", background: "#e0f2fe", color: "#0369a1", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                          {PERMIT_TYPE_LABELS[p.permit_type] || p.permit_type_display}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.85rem" }}>
                        {p.gas_testing_required && (
                          <span title="نیاز به گازسنجی" style={{ display: "inline-block", margin: "0 0.2rem", color: "#d97706" }}>
                            💨 گازسنجی
                          </span>
                        )}
                        {p.isolation_loto_required && (
                          <span title="نیاز به قفل و برچسب‌گذاری (LOTO)" style={{ display: "inline-block", margin: "0 0.2rem", color: "#dc2626" }}>
                            🔒 LOTO
                          </span>
                        )}
                        {!p.gas_testing_required && !p.isolation_loto_required && <span className="muted">—</span>}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        <span className={`badge ${getStatusBadgeClass(p.status)}`} style={{ padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.85rem" }}>
                          {PERMIT_STATUS_LABELS[p.status] || p.status_display}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem" }}>
                        <div>از: {new Date(p.valid_from).toLocaleString("fa-IR")}</div>
                        <div>تا: {new Date(p.valid_until).toLocaleString("fa-IR")}</div>
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => openPermitDetail(p.id)}
                          style={{ padding: "0.3rem 0.75rem", cursor: "pointer" }}
                        >
                          مشاهده و اقدامات
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SHIFT HANDOVER                                    */}
      {/* ======================================================== */}
      {activeMainTab === "handover" && (
        <div className="handover-content">
          {/* Outstanding Safety Alert Banner */}
          {safetySummary && (
            <div className="safety-summary-banner" style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "1.2rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                <h4 style={{ margin: 0, color: "#92400e", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  ⚠️ خلاصه وضعیت ایمنی شیفت در کارگاه جاری (Safety Handover Snapshot)
                </h4>
                {canConductHandover && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsCreateHandoverModalOpen(true)}
                    style={{ padding: "0.4rem 1rem", fontSize: "0.9rem" }}
                  >
                    + ثبت تحویل شیفت جدید
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                <div style={{ background: "white", padding: "0.75rem", borderRadius: "6px", border: "1px solid #fef08a" }}>
                  <div style={{ fontSize: "0.85rem", color: "#854d0e" }}>مجوزهای فعال / معلق در کارگاه:</div>
                  <strong style={{ fontSize: "1.2rem", color: "#b45309" }}>{safetySummary.active_permits_count}</strong>
                  {safetySummary.active_permits.length > 0 && (
                    <ul style={{ margin: "0.5rem 0 0", paddingRight: "1rem", fontSize: "0.8rem", color: "#78350f" }}>
                      {safetySummary.active_permits.map((ap) => (
                        <li key={ap.id}>[{ap.code}] {ap.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ background: "white", padding: "0.75rem", borderRadius: "6px", border: "1px solid #fef08a" }}>
                  <div style={{ fontSize: "0.85rem", color: "#854d0e" }}>خطرات فعال حل‌نشده:</div>
                  <strong style={{ fontSize: "1.2rem", color: "#b45309" }}>{safetySummary.unresolved_hazards_count}</strong>
                  {safetySummary.unresolved_hazards.length > 0 && (
                    <ul style={{ margin: "0.5rem 0 0", paddingRight: "1rem", fontSize: "0.8rem", color: "#78350f" }}>
                      {safetySummary.unresolved_hazards.map((hz) => (
                        <li key={hz.id}>{hz.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ background: "white", padding: "0.75rem", borderRadius: "6px", border: "1px solid #fef08a" }}>
                  <div style={{ fontSize: "0.85rem", color: "#854d0e" }}>اقدامات اصلاحی باز / در جریان:</div>
                  <strong style={{ fontSize: "1.2rem", color: "#b45309" }}>{safetySummary.open_capas_count}</strong>
                </div>
                <div style={{ background: "white", padding: "0.75rem", borderRadius: "6px", border: "1px solid #fef08a" }}>
                  <div style={{ fontSize: "0.85rem", color: "#854d0e" }}>حوادث ثبت‌شده اخیر (۷ روز گذشته):</div>
                  <strong style={{ fontSize: "1.2rem", color: "#b45309" }}>{safetySummary.recent_incidents_count}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Handover List */}
          {handoversLoading ? (
            <p className="centered muted">در حال بارگذاری گزارش‌های تحویل شیفت…</p>
          ) : handoversError ? (
            <div className="error-box" style={{ padding: "1rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px" }}>
              {handoversError}
            </div>
          ) : handovers.length === 0 ? (
            <div className="empty-box" style={{ textAlign: "center", padding: "3rem", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
              <p className="muted" style={{ fontSize: "1.1rem", margin: "0 0 1rem" }}>هیچ گزارش تحویل شیفتی در این سازمان ثبت نشده است.</p>
              {canConductHandover ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setIsCreateHandoverModalOpen(true)}
                >
                  ثبت اولین تحویل شیفت
                </button>
              ) : (
                <span className="muted">برای ثبت تحویل شیفت باید نقش سرپرست کارگاه، بازرس HSE یا مدیر HSE داشته باشید.</span>
              )}
            </div>
          ) : (
            <div className="handover-list" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {handovers.map((sh) => (
                <div
                  key={sh.id}
                  className="handover-card"
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "1.2rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                    <div>
                      <span style={{ fontWeight: "bold", fontSize: "1.05rem" }}>
                        تاریخ: {new Date(sh.shift_date).toLocaleDateString("fa-IR")}
                      </span>
                      <span style={{ marginRight: "0.75rem", background: "#e0e7ff", color: "#3730a3", padding: "0.2rem 0.6rem", borderRadius: "4px", fontSize: "0.85rem" }}>
                        {SHIFT_TYPE_LABELS[sh.shift_type] || sh.shift_type_display}
                      </span>
                      <span className="muted" style={{ marginRight: "0.75rem", fontSize: "0.9rem" }}>
                        کارگاه: {sh.workplace_name || "—"}
                      </span>
                    </div>
                    <div>
                      <span className={`badge ${sh.status === "acknowledged" ? "badge-success" : "badge-warning"}`} style={{ padding: "0.3rem 0.7rem", borderRadius: "4px" }}>
                        {sh.status === "acknowledged" ? "تأیید و تحویل‌گرفته‌شده" : "در انتظار تحویل و تأیید"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
                    <div>
                      <span className="muted">سرپرست تحویل‌دهنده (خروجی):</span> <strong>{sh.outgoing_supervisor_name || "—"}</strong>
                    </div>
                    <div>
                      <span className="muted">سرپرست تحویل‌گیرنده (ورودی):</span> <strong>{sh.incoming_supervisor_name || "تعیین‌نشده"}</strong>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
                    <div><strong>شرح شیفت و رویدادها:</strong> {sh.handover_notes}</div>
                    {sh.safety_concerns && <div style={{ color: "#b91c1c", marginTop: "0.4rem" }}><strong>ملاحظات و خطرات فوری:</strong> {sh.safety_concerns}</div>}
                    {sh.equipment_status && <div style={{ marginTop: "0.4rem" }}><strong>وضعیت تجهیزات و خطوط:</strong> {sh.equipment_status}</div>}
                  </div>

                  {sh.active_permits && sh.active_permits.length > 0 && (
                    <div style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                      <span className="muted">مجوزهای کار متصل به این شیفت:</span>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                        {sh.active_permits.map((ap) => (
                          <span key={ap.id} style={{ background: "#f1f5f9", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                            {ap.reference_code}: {ap.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {sh.status === "acknowledged" ? (
                    <div style={{ fontSize: "0.85rem", color: "#15803d", borderTop: "1px dashed #cbd5e1", paddingTop: "0.5rem" }}>
                      ✓ در تاریخ {new Date(sh.acknowledged_at!).toLocaleString("fa-IR")} توسط <strong>{sh.acknowledged_by_name}</strong> تحویل گرفته شد.
                      {sh.acknowledgement_notes && <span style={{ marginRight: "0.5rem" }}>ملاحظات: {sh.acknowledgement_notes}</span>}
                    </div>
                  ) : sh.can_acknowledge ? (
                    <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-success"
                        onClick={() => setSelectedHandoverForAck(sh)}
                        style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                      >
                        ✓ تأیید و تحویل‌گیری این شیفت
                      </button>
                    </div>
                  ) : (
                    <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "0.5rem", fontSize: "0.85rem", color: "#92400e" }}>
                      ⏳ در انتظار تأیید {sh.incoming_supervisor_name || "سرپرست تحویل‌گیرنده"}؛ فقط تحویل‌گیرنده تعیین‌شده می‌تواند این گزارش را تأیید کند.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {detailLoading && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px" }}>در حال بارگذاری جزئیات مجوز...</div>
        </div>
      )}
      {detailError && (
        <div className="error-box" style={{ padding: "1rem", background: "#fee2e2", color: "#b91c1c", margin: "1rem 0" }}>
          {detailError}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: PERMIT DETAIL & WORKFLOW ACTIONS                  */}
      {/* ======================================================== */}
      {selectedPermit && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "white", borderRadius: "8px", maxWidth: "800px", width: "90%", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>
                  [{selectedPermit.reference_code}] {selectedPermit.title}
                </h3>
                <span className={`badge ${getStatusBadgeClass(selectedPermit.status)}`} style={{ marginTop: "0.3rem", display: "inline-block" }}>
                  {PERMIT_STATUS_LABELS[selectedPermit.status] || selectedPermit.status_display}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPermit(null)}
                style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Basic Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
              <div><span className="muted">نوع مجوز:</span> <strong>{PERMIT_TYPE_LABELS[selectedPermit.permit_type]}</strong></div>
              <div><span className="muted">کارگاه:</span> <strong>{selectedPermit.workplace_name || "—"}</strong></div>
              <div><span className="muted">موقعیت دقیق:</span> <strong>{selectedPermit.work_area || "—"}</strong></div>
              <div><span className="muted">تجهیزات درگیر:</span> <strong>{selectedPermit.equipment_involved || "—"}</strong></div>
              <div><span className="muted">درخواست‌کننده:</span> <strong>{selectedPermit.requester_name}</strong></div>
              <div><span className="muted">سرپرست کارگاه:</span> <strong>{selectedPermit.responsible_supervisor_name || "تعیین‌نشده"}</strong></div>
              <div><span className="muted">تأییدکننده:</span> <strong>{selectedPermit.approver_name || "در انتظار تأیید"}</strong></div>
              <div><span className="muted">نفرات اجرایی مجاز:</span> <strong>{selectedPermit.assigned_workers || "—"}</strong></div>
              <div><span className="muted">شروع اعتبار:</span> <strong>{new Date(selectedPermit.valid_from).toLocaleString("fa-IR")}</strong></div>
              <div><span className="muted">پایان اعتبار:</span> <strong>{new Date(selectedPermit.valid_until).toLocaleString("fa-IR")}</strong></div>
            </div>

            {/* Description */}
            <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.9rem" }}>
              <strong>شرح فعالیت:</strong>
              <p style={{ margin: "0.3rem 0 0" }}>{selectedPermit.description}</p>
            </div>

            {/* Personnel & Competency Verification (Phase 10) */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem", fontSize: "0.9rem", background: selectedPermit.competency_validation?.is_compliant === false ? "#fff5f5" : "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>ارزیابی صلاحیت نفرات اجرایی (Competency Check):</strong>
                {selectedPermit.competency_validation && (
                  <span
                    style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      backgroundColor: selectedPermit.competency_validation.is_compliant ? "#e8f5e9" : "#ffebee",
                      color: selectedPermit.competency_validation.is_compliant ? "#2e7d32" : "#c62828",
                    }}
                  >
                    {selectedPermit.competency_validation.is_unknown
                      ? "⚠️ صلاحیت نفرات نامشخص است"
                      : selectedPermit.competency_validation.has_requirements
                        ? selectedPermit.competency_validation.is_compliant
                          ? "✓ صلاحیت‌ها احراز شد"
                          : "⚠️ عدم احراز صلاحیت الزامی"
                        : "بدون الزام صلاحیت خاص"}
                  </span>
                )}
              </div>

              {selectedPermit.assigned_employee_details && selectedPermit.assigned_employee_details.length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span className="muted">کارکنان معرفی‌شده ساختاریافته:</span>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                    {selectedPermit.assigned_employee_details.map((emp) => (
                      <span key={emp.id} style={{ background: "#e2e8f0", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem" }}>
                        {emp.full_name} ({emp.employee_no}) - {emp.job_title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedPermit.competency_validation?.reason && (
                <div style={{ marginTop: "0.5rem", color: "#c62828", fontSize: "0.85rem" }}>
                  {selectedPermit.competency_validation.reason}
                </div>
              )}

              {selectedPermit.competency_validation?.people && selectedPermit.competency_validation.people.length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span className="muted">صلاحیت هر نفر:</span>
                  <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.25rem" }}>
                    {selectedPermit.competency_validation.people.map((person) => (
                      <div key={person.employee_id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "0.4rem 0.55rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                          <strong>{person.full_name} ({person.employee_no})</strong>
                          <span className="muted" style={{ fontSize: "0.75rem" }}>{person.source_display ?? person.source}</span>
                        </div>
                        {person.checks.length === 0 ? (
                          <div className="muted" style={{ fontSize: "0.8rem" }}>صلاحیت الزامی برای این نوع مجوز تعریف نشده است.</div>
                        ) : (
                          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                            {person.checks.map((check) => (
                              <span
                                key={check.competency_id}
                                title={check.expires_on ? `انقضا: ${new Date(`${check.expires_on}T12:00:00`).toLocaleDateString("fa-IR")}` : undefined}
                                style={{
                                  padding: "0.15rem 0.45rem",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  background: check.is_valid ? "#e8f5e9" : "#ffebee",
                                  color: check.is_valid ? "#2e7d32" : "#c62828",
                                }}
                              >
                                {check.competency_name}: {check.status_display}
                                {check.expires_on ? ` — ${new Date(`${check.expires_on}T12:00:00`).toLocaleDateString("fa-IR")}` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {person.checks.some((check) => check.blocking_reason) && (
                          <div style={{ color: "#c62828", fontSize: "0.75rem", marginTop: "0.2rem" }}>
                            {person.checks.filter((check) => check.blocking_reason).map((check) => check.blocking_reason).join(" | ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPermit.competency_validation?.blocking_reasons && selectedPermit.competency_validation.blocking_reasons.length > 0 && (
                <div style={{ marginTop: "0.5rem", color: "#c62828", fontSize: "0.85rem" }}>
                  <strong>موانع تأیید/فعال‌سازی مجوز:</strong>
                  <ul style={{ margin: "0.25rem 0 0", paddingRight: "1.2rem" }}>
                    {selectedPermit.competency_validation.blocking_reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Precautions & PPE */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
              <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px" }}>
                <strong>تمهیدات ایمنی الزامی:</strong>
                <p style={{ margin: "0.3rem 0 0" }}>{selectedPermit.precautions_taken || "تمهیدات خاصی درج نشده است."}</p>
              </div>
              <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px" }}>
                <strong>تجهیزات حفاظت فردی (PPE):</strong>
                <p style={{ margin: "0.3rem 0 0" }}>{selectedPermit.required_ppe || "تجهیزات عمومی"}</p>
              </div>
            </div>

            {/* Control Verifications */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
              <strong>اعتبارسنجی کنترل‌های میدانی (پیش از فعال‌سازی):</strong>
              <div style={{ marginTop: "0.5rem" }}>
                <div>
                  <strong>گازسنجی:</strong> {selectedPermit.gas_testing_required ? (selectedPermit.gas_testing_results ? `✓ ${selectedPermit.gas_testing_results}` : "⚠️ الزامی (هنوز ثبت نشده است)") : "عدم نیاز"}
                </div>
                <div style={{ marginTop: "0.3rem" }}>
                  <strong>ایزولاسیون و LOTO:</strong> {selectedPermit.isolation_loto_required ? (selectedPermit.isolation_loto_details ? `✓ ${selectedPermit.isolation_loto_details}` : "⚠️ الزامی (هنوز ثبت نشده است)") : "عدم نیاز"}
                </div>
                {selectedPermit.controls_verified && (
                  <div style={{ marginTop: "0.5rem", color: "#15803d", fontWeight: "bold" }}>
                    ✓ کنترل‌ها توسط {selectedPermit.controls_verified_by_name} در تاریخ {new Date(selectedPermit.controls_verified_at!).toLocaleString("fa-IR")} تایید شد.
                  </div>
                )}
              </div>
            </div>

            {/* Workflow notes & Reasons */}
            {selectedPermit.review_notes && (
              <div style={{ background: "#eff6ff", padding: "0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.85rem", color: "#1e40af" }}>
                <strong>یادداشت‌های بررسی و تأیید:</strong> {selectedPermit.review_notes}
              </div>
            )}
            {selectedPermit.suspension_reason && (
              <div style={{ background: "#fef2f2", padding: "0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.85rem", color: "#991b1b" }}>
                <strong>علت تعلیق کار:</strong> {selectedPermit.suspension_reason}
              </div>
            )}
            {selectedPermit.rejection_reason && (
              <div style={{ background: "#fef2f2", padding: "0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.85rem", color: "#991b1b" }}>
                <strong>علت رد مجوز:</strong> {selectedPermit.rejection_reason}
              </div>
            )}
            {selectedPermit.closure_summary && (
              <div style={{ background: "#f0fdf4", padding: "0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.85rem", color: "#166534" }}>
                <strong>خلاصه ترخیص و مختومه‌سازی:</strong> {selectedPermit.closure_summary}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "flex-end" }}>
              {selectedPermit.status === "expired" && (
                <div style={{ width: "100%", background: "#fef2f2", color: "#991b1b", padding: "0.65rem", borderRadius: "6px", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  ⚠️ اعتبار زمانی این مجوز پایان یافته است. فعال‌سازی، تعلیق یا ازسرگیری مجاز نیست؛ فقط مختومه‌سازی نهایی یا لغو پرونده امکان‌پذیر است.
                </div>
              )}
              {/* Requested / Under Review */}
              {selectedPermit.can_approve &&
                (selectedPermit.status === "requested" || selectedPermit.status === "under_review") && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsReviewModalOpen(true)}
                  >
                    📝 بررسی اولیه
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => setIsApproveModalOpen(true)}
                  >
                    ✓ تأیید مجوز (SoD)
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setIsRejectModalOpen(true)}
                  >
                    ✕ رد مجوز
                  </button>
                </>
              )}

              {/* Approved -> Activate */}
              {selectedPermit.status === "approved" && selectedPermit.can_control && (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => setIsActivateModalOpen(true)}
                >
                  ⚡ فعال‌سازی و تأیید کنترل‌های میدانی
                </button>
              )}

              {/* Active -> Suspend or Complete */}
              {selectedPermit.status === "active" && selectedPermit.can_control && (
                <>
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={() => setIsSuspendModalOpen(true)}
                  >
                    ⏸ تعلیق موقت کار
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!confirm("آیا از اعلام اتمام کارهای اجرایی تحت این مجوز اطمینان دارید؟")) return;
                      setActionSubmitting(true);
                      try {
                        const updated = await completePermit(selectedPermit.id);
                        setSelectedPermit(updated);
                        reloadPermits();
                      } catch (err) {
                        alert(errorMessage(err));
                      } finally {
                        setActionSubmitting(false);
                      }
                    }}
                  >
                    🏁 اتمام کار عملیاتی
                  </button>
                </>
              )}

              {/* Suspended -> Resume */}
              {selectedPermit.status === "suspended" && selectedPermit.can_control && (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={async () => {
                    if (!confirm("آیا شرایط رفع نقص گردیده و مجوز آماده ازسرگیری است؟")) return;
                    setActionSubmitting(true);
                    try {
                      const updated = await resumePermit(selectedPermit.id);
                      setSelectedPermit(updated);
                      reloadPermits();
                    } catch (err) {
                      alert(errorMessage(err));
                    } finally {
                      setActionSubmitting(false);
                    }
                  }}
                >
                  ▶ ازسرگیری مجدد کار
                </button>
              )}

              {/* Completed or Expired -> Close */}
              {selectedPermit.can_control &&
                (selectedPermit.status === "completed" ||
                  selectedPermit.status === "expired" ||
                  selectedPermit.status === "active") && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCloseModalOpen(true)}
                >
                  🔒 مختومه‌سازی نهایی
                </button>
              )}

              {/* Cancel (if not closed/cancelled) */}
              {selectedPermit.can_cancel && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsCancelModalOpen(true)}
                  style={{ color: "#b91c1c" }}
                >
                  لغو مجوز
                </button>
              )}

              {!selectedPermit.can_approve &&
                !selectedPermit.can_control &&
                !selectedPermit.can_cancel &&
                selectedPermit.status !== "closed" &&
                selectedPermit.status !== "cancelled" && (
                  <span className="muted" style={{ fontSize: "0.85rem", alignSelf: "center" }}>
                    شما برای این وضعیت اقدام عملیاتی مجاز ندارید.
                  </span>
                )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedPermit(null)}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE NEW PERMIT                                 */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <CreatePermitModal
          organizationId={selectedOrgId!}
          workplaces={workplaces}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(newPermit) => {
            setIsCreateModalOpen(false);
            reloadPermits();
            openPermitDetail(newPermit.id);
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL: REVIEW PERMIT                                     */}
      {/* ======================================================== */}
      {isReviewModalOpen && selectedPermit && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="modal-content" style={{ background: "white", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h4>بررسی اولیه مجوز کار</h4>
            {actionError && <div style={{ color: "red", marginBottom: "0.5rem" }}>{actionError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setActionSubmitting(true);
                setActionError(null);
                const formData = new FormData(e.currentTarget);
                try {
                  const updated = await reviewPermit(selectedPermit.id, {
                    status: "under_review",
                    review_notes: formData.get("notes") as string,
                  });
                  setIsReviewModalOpen(false);
                  setSelectedPermit(updated);
                  reloadPermits();
                } catch (err) {
                  setActionError(errorMessage(err));
                } finally {
                  setActionSubmitting(false);
                }
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label>یادداشت‌های بررسی و کنترل شرایط:</label>
                <textarea name="notes" rows={3} style={{ width: "100%", padding: "0.5rem" }} required />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsReviewModalOpen(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary" disabled={actionSubmitting}>
                  {actionSubmitting ? "در حال ثبت…" : "ثبت وضعیت در حال بررسی"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: APPROVE PERMIT                                    */}
      {/* ======================================================== */}
      {isApproveModalOpen && selectedPermit && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="modal-content" style={{ background: "white", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h4>تأیید پروانه کار</h4>
            <div style={{ background: "#fef3c7", padding: "0.75rem", borderRadius: "6px", fontSize: "0.85rem", color: "#92400e", marginBottom: "1rem" }}>
              ⚠️ طبق اصل تفکیک وظایف (Separation of Duties)، درخواست‌دهنده مجوز نمی‌تواند خودش اقدام به تأیید مجوز کند.
            </div>
            {actionError && <div style={{ color: "red", marginBottom: "0.5rem" }}>{actionError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setActionSubmitting(true);
                setActionError(null);
                const formData = new FormData(e.currentTarget);
                try {
                  const updated = await approvePermit(selectedPermit.id, {
                    notes: formData.get("notes") as string,
                  });
                  setIsApproveModalOpen(false);
                  setSelectedPermit(updated);
                  reloadPermits();
                } catch (err) {
                  setActionError(errorMessage(err));
                } finally {
                  setActionSubmitting(false);
                }
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label>توضیحات و شروط تأیید:</label>
                <textarea name="notes" rows={3} style={{ width: "100%", padding: "0.5rem" }} placeholder="اختیاری..." />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsApproveModalOpen(false)}>انصراف</button>
                <button type="submit" className="btn btn-success" disabled={actionSubmitting}>
                  {actionSubmitting ? "در حال ثبت…" : "تأیید قطعی مجوز"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ACTIVATE PERMIT WITH CONTROLS                     */}
      {/* ======================================================== */}
      {isActivateModalOpen && selectedPermit && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="modal-content" style={{ background: "white", padding: "1.5rem", borderRadius: "8px", maxWidth: "550px", width: "90%" }}>
            <h4>اعتبارسنجی کنترل‌های میدانی و فعال‌سازی</h4>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              قبل از فعال‌سازی، نتایج گازسنجی و مشخصات ایزولاسیون مکانیکی/برقی باید احراز شوند.
            </p>
            {actionError && <div style={{ color: "red", marginBottom: "0.5rem" }}>{actionError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setActionSubmitting(true);
                setActionError(null);
                const formData = new FormData(e.currentTarget);
                try {
                  const updated = await activatePermit(selectedPermit.id, {
                    gas_testing_results: formData.get("gas_testing_results") as string,
                    isolation_loto_details: formData.get("isolation_loto_details") as string,
                  });
                  setIsActivateModalOpen(false);
                  setSelectedPermit(updated);
                  reloadPermits();
                } catch (err) {
                  setActionError(errorMessage(err));
                } finally {
                  setActionSubmitting(false);
                }
              }}
            >
              {selectedPermit.gas_testing_required && (
                <div style={{ marginBottom: "1rem" }}>
                  <label><strong>نتایج گازسنجی اتمسفر (الزامی):</strong></label>
                  <input
                    type="text"
                    name="gas_testing_results"
                    defaultValue={selectedPermit.gas_testing_results}
                    placeholder="مثال: O2: 20.9%, LEL: 0%, H2S: 0 ppm"
                    required
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              )}
              {selectedPermit.isolation_loto_required && (
                <div style={{ marginBottom: "1rem" }}>
                  <label><strong>جزئیات قفل‌گذاری و ایزولاسیون LOTO (الزامی):</strong></label>
                  <textarea
                    name="isolation_loto_details"
                    defaultValue={selectedPermit.isolation_loto_details}
                    placeholder="شماره قفل، تگ، سوئیچ اصلی قطع و فلنج کور نصب‌شده..."
                    required
                    rows={3}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsActivateModalOpen(false)}>انصراف</button>
                <button type="submit" className="btn btn-success" disabled={actionSubmitting}>
                  {actionSubmitting ? "در حال فعال‌سازی…" : "تأیید کنترل‌ها و فعال‌سازی پروانه"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: SUSPEND PERMIT                                    */}
      {/* ======================================================== */}
      {isSuspendModalOpen && selectedPermit && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="modal-content" style={{ background: "white", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h4>تعلیق موقت مجوز کار</h4>
            {actionError && <div style={{ color: "red", marginBottom: "0.5rem" }}>{actionError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setActionSubmitting(true);
                setActionError(null);
                const formData = new FormData(e.currentTarget);
                try {
                  const updated = await suspendPermit(selectedPermit.id, {
                    reason: formData.get("reason") as string,
                  });
                  setIsSuspendModalOpen(false);
                  setSelectedPermit(updated);
                  reloadPermits();
                } catch (err) {
                  setActionError(errorMessage(err));
                } finally {
                  setActionSubmitting(false);
                }
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label><strong>علت تعلیق عملیات (الزامی):</strong></label>
                <textarea name="reason" required rows={3} style={{ width: "100%", padding: "0.5rem" }} placeholder="تغییر شرایط جوی، نقص سیستم تهویه، بروز نشتی..." />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsSuspendModalOpen(false)}>انصراف</button>
                <button type="submit" className="btn btn-warning" disabled={actionSubmitting}>
                  {actionSubmitting ? "در حال تعلیق…" : "تعلیق مجوز"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CLOSE PERMIT                                      */}
      {/* ======================================================== */}
      {isCloseModalOpen && selectedPermit && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="modal-content" style={{ background: "white", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h4>مختومه‌سازی و ترخیص نهایی پروانه</h4>
            {actionError && <div style={{ color: "red", marginBottom: "0.5rem" }}>{actionError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setActionSubmitting(true);
                setActionError(null);
                const formData = new FormData(e.currentTarget);
                try {
                  const updated = await closePermit(selectedPermit.id, {
                    closure_summary: formData.get("closure_summary") as string,
                  });
                  setIsCloseModalOpen(false);
                  setSelectedPermit(updated);
                  reloadPermits();
                } catch (err) {
                  setActionError(errorMessage(err));
                } finally {
                  setActionSubmitting(false);
                }
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label>خلاصه ترخیص و وضعیت پاکسازی محوطه:</label>
                <textarea
                  name="closure_summary"
                  required
                  rows={3}
                  defaultValue="کار پایان یافته، قفل‌ها باز شدند و محوطه پاکسازی گردید."
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCloseModalOpen(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary" disabled={actionSubmitting}>
                  {actionSubmitting ? "در حال مختومه‌سازی…" : "ثبت ترخیص و خاتمه"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REJECT PERMIT                                     */}
      {/* ======================================================== */}
      {isRejectModalOpen && selectedPermit && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="modal-content" style={{ background: "white", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h4>رد درخواست مجوز کار</h4>
            {actionError && <div style={{ color: "red", marginBottom: "0.5rem" }}>{actionError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setActionSubmitting(true);
                setActionError(null);
                const formData = new FormData(e.currentTarget);
                try {
                  const updated = await rejectPermit(selectedPermit.id, {
                    reason: formData.get("reason") as string,
                  });
                  setIsRejectModalOpen(false);
                  setSelectedPermit(updated);
                  reloadPermits();
                } catch (err) {
                  setActionError(errorMessage(err));
                } finally {
                  setActionSubmitting(false);
                }
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label><strong>علت رد درخواست (الزامی):</strong></label>
                <textarea name="reason" required rows={3} style={{ width: "100%", padding: "0.5rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRejectModalOpen(false)}>انصراف</button>
                <button type="submit" className="btn btn-danger" disabled={actionSubmitting}>
                  {actionSubmitting ? "در حال رد…" : "رد قطعی درخواست"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CANCEL PERMIT                                     */}
      {/* ======================================================== */}
      {isCancelModalOpen && selectedPermit && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="modal-content" style={{ background: "white", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h4>لغو مجوز کار</h4>
            {actionError && <div style={{ color: "red", marginBottom: "0.5rem" }}>{actionError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setActionSubmitting(true);
                setActionError(null);
                const formData = new FormData(e.currentTarget);
                try {
                  const updated = await cancelPermit(selectedPermit.id, {
                    reason: formData.get("reason") as string,
                  });
                  setIsCancelModalOpen(false);
                  setSelectedPermit(updated);
                  reloadPermits();
                } catch (err) {
                  setActionError(errorMessage(err));
                } finally {
                  setActionSubmitting(false);
                }
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label>علت لغو:</label>
                <textarea name="reason" rows={3} style={{ width: "100%", padding: "0.5rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCancelModalOpen(false)}>انصراف</button>
                <button type="submit" className="btn btn-outline" style={{ color: "#b91c1c" }} disabled={actionSubmitting}>
                  {actionSubmitting ? "در حال لغو…" : "لغو مجوز"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE SHIFT HANDOVER                             */}
      {/* ======================================================== */}
      {isCreateHandoverModalOpen && (
        <CreateShiftHandoverModal
          organizationId={selectedOrgId!}
          workplaces={workplaces}
          memberships={memberships}
          currentUserId={user?.id ?? null}
          activePermits={permits.filter((p) => p.status === "active" || p.status === "suspended")}
          onClose={() => setIsCreateHandoverModalOpen(false)}
          onSuccess={() => {
            setIsCreateHandoverModalOpen(false);
            reloadHandovers();
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL: ACKNOWLEDGE SHIFT HANDOVER                        */}
      {/* ======================================================== */}
      {selectedHandoverForAck && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="modal-content" style={{ background: "white", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h4>تأیید و پذیرش تحویل شیفت</h4>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              سرپرست ورودی با تأیید این فرم، مسئولیت پایش مجوزهای کار و وضعیت ایمنی کارگاه را بر عهده می‌گیرد.
            </p>
            {actionError && <div style={{ color: "red", marginBottom: "0.5rem" }}>{actionError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setActionSubmitting(true);
                setActionError(null);
                const formData = new FormData(e.currentTarget);
                try {
                  await acknowledgeShiftHandover(selectedHandoverForAck.id, {
                    acknowledgement_notes: formData.get("notes") as string,
                  });
                  setSelectedHandoverForAck(null);
                  reloadHandovers();
                } catch (err) {
                  setActionError(errorMessage(err));
                } finally {
                  setActionSubmitting(false);
                }
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label>ملاحظات سرپرست تحویل‌گیرنده:</label>
                <textarea name="notes" rows={3} style={{ width: "100%", padding: "0.5rem" }} placeholder="اختیاری..." />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedHandoverForAck(null)}>انصراف</button>
                <button type="submit" className="btn btn-success" disabled={actionSubmitting}>
                  {actionSubmitting ? "در حال ثبت…" : "تأیید قطعی تحویل شیفت"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// SUB-COMPONENT: CREATE PERMIT MODAL
// =========================================================

interface CreatePermitModalProps {
  organizationId: number;
  workplaces: Workplace[];
  onClose: () => void;
  onSuccess: (permit: PermitDetail) => void;
}

function CreatePermitModal({ organizationId, workplaces, onClose, onSuccess }: CreatePermitModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      organization: organizationId,
      workplace: fd.get("workplace") ? Number(fd.get("workplace")) : null,
      permit_type: fd.get("permit_type"),
      title: fd.get("title"),
      description: fd.get("description"),
      work_area: fd.get("work_area"),
      equipment_involved: fd.get("equipment_involved"),
      valid_from: localInputToIso(fd.get("valid_from")),
      valid_until: localInputToIso(fd.get("valid_until")),
      assigned_workers: fd.get("assigned_workers"),
      precautions_taken: fd.get("precautions_taken"),
      required_ppe: fd.get("required_ppe"),
      gas_testing_required: fd.get("gas_testing_required") === "on",
      isolation_loto_required: fd.get("isolation_loto_required") === "on",
    };

    try {
      const created = await createPermit(payload);
      onSuccess(created);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  const defaultFrom = toLocalDateTimeInput(new Date(now.getTime() + 30 * 60000));
  const defaultUntil = toLocalDateTimeInput(new Date(now.getTime() + 8 * 3600000));

  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <div className="modal-content" style={{ background: "white", borderRadius: "8px", maxWidth: "650px", width: "90%", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>درخواست صدور مجوز کار جدید (PTW)</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>✕</button>
        </div>

        {error && <div style={{ color: "red", background: "#fee2e2", padding: "0.75rem", borderRadius: "4px", marginBottom: "1rem" }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label htmlFor="permit-workplace"><strong>محل کار / کارگاه:</strong></label>
              <select id="permit-workplace" name="workplace" required style={{ width: "100%", padding: "0.5rem" }}>
                <option value="">انتخاب کارگاه...</option>
                {workplaces.map((wp) => (
                  <option key={wp.id} value={wp.id}>{wp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="permit-type"><strong>نوع فعالیت پرخطر:</strong></label>
              <select id="permit-type" name="permit_type" required style={{ width: "100%", padding: "0.5rem" }}>
                {Object.entries(PERMIT_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="permit-title"><strong>عنوان پروانه کار:</strong></label>
            <input id="permit-title" type="text" name="title" required placeholder="مثال: جوشکاری خط لوله هیدرولیک کوره ۳" style={{ width: "100%", padding: "0.5rem" }} />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="permit-description"><strong>شرح دقیق دامنه و عملیات کار:</strong></label>
            <textarea id="permit-description" name="description" required rows={3} style={{ width: "100%", padding: "0.5rem" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label>موقعیت یا سوله دقیق:</label>
              <input type="text" name="work_area" placeholder="سوله شماره ۱، دهانه ۴" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <div>
              <label>تجهیزات و خطوط درگیر:</label>
              <input type="text" name="equipment_involved" placeholder="الکتروموتور نقاله M-12" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label><strong>تاریخ و ساعت آغاز اعتبار:</strong></label>
              <input type="datetime-local" name="valid_from" defaultValue={defaultFrom} required style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <div>
              <label><strong>تاریخ و ساعت پایان اعتبار:</strong></label>
              <input type="datetime-local" name="valid_until" defaultValue={defaultUntil} required style={{ width: "100%", padding: "0.5rem" }} />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>نفرات اجرایی مجاز:</label>
            <input type="text" name="assigned_workers" placeholder="نام تکنسین‌ها یا پیمانکار مجری" style={{ width: "100%", padding: "0.5rem" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label>تمهیدات ایمنی اولیه:</label>
              <textarea name="precautions_taken" rows={2} placeholder="کپسول اطفاء حریق، عایق‌بندی..." style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <div>
              <label>تجهیزات حفاظت فردی (PPE):</label>
              <textarea name="required_ppe" rows={2} placeholder="هارنس، شیلد، دستکش عایق..." style={{ width: "100%", padding: "0.5rem" }} />
            </div>
          </div>

          <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", display: "flex", gap: "2rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" name="gas_testing_required" />
              <span>نیاز به گازسنجی اتمسفر دارد</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" name="isolation_loto_required" />
              <span>نیاز به ایزولاسیون مکانیکی/برقی (LOTO) دارد</span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>انصراف</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "در حال ثبت…" : "ثبت و ارسال درخواست"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================
// SUB-COMPONENT: CREATE SHIFT HANDOVER MODAL
// =========================================================

interface CreateShiftHandoverModalProps {
  organizationId: number;
  workplaces: Workplace[];
  memberships: Membership[];
  currentUserId: number | null;
  activePermits: PermitListItem[];
  onClose: () => void;
  onSuccess: () => void;
}

function CreateShiftHandoverModal({
  organizationId,
  workplaces,
  memberships,
  currentUserId,
  activePermits,
  onClose,
  onSuccess,
}: CreateShiftHandoverModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPermits, setSelectedPermits] = useState<number[]>(activePermits.map((p) => p.id));

  const incomingCandidates = memberships.filter(
    (membership) =>
      membership.is_active &&
      membership.user !== currentUserId &&
      SHIFT_HANDOVER_ROLES.has(membership.role)
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const incomingSupervisor = fd.get("incoming_supervisor");
    const payload = {
      organization: organizationId,
      workplace: Number(fd.get("workplace")),
      shift_date: fd.get("shift_date"),
      shift_type: fd.get("shift_type"),
      incoming_supervisor: incomingSupervisor ? Number(incomingSupervisor) : null,
      handover_notes: fd.get("handover_notes"),
      safety_concerns: fd.get("safety_concerns"),
      equipment_status: fd.get("equipment_status"),
      active_permit_ids: selectedPermits,
    };

    try {
      await createShiftHandover(payload);
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <div className="modal-content" style={{ background: "white", borderRadius: "8px", maxWidth: "600px", width: "90%", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>ثبت تحویل شیفت جدید</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>✕</button>
        </div>

        {error && <div style={{ color: "red", background: "#fee2e2", padding: "0.75rem", borderRadius: "4px", marginBottom: "1rem" }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label><strong>کارگاه:</strong></label>
              <select name="workplace" required style={{ width: "100%", padding: "0.5rem" }}>
                {workplaces.map((wp) => (
                  <option key={wp.id} value={wp.id}>{wp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label><strong>نوع شیفت:</strong></label>
              <select name="shift_type" required style={{ width: "100%", padding: "0.5rem" }}>
                <option value="morning">شیفت صبح</option>
                <option value="evening">شیفت عصر</option>
                <option value="night">شیفت شب</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label><strong>تاریخ شیفت:</strong></label>
            <input type="date" name="shift_date" defaultValue={today} required style={{ width: "100%", padding: "0.5rem" }} />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="handover-incoming-supervisor"><strong>سرپرست تحویل‌گیرنده (اختیاری):</strong></label>
            <select
              id="handover-incoming-supervisor"
              name="incoming_supervisor"
              defaultValue=""
              style={{ width: "100%", padding: "0.5rem" }}
            >
              <option value="">بدون تعیین شخص خاص</option>
              {incomingCandidates.map((membership) => (
                <option key={membership.id} value={membership.user}>
                  {membership.full_name || membership.username} — {membership.role_display}
                </option>
              ))}
            </select>
            <small className="muted">
              در صورت تعیین، فقط همین شخص می‌تواند گزارش تحویل شیفت را تأیید کند.
            </small>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label><strong>شرح رخدادها و روند کاری شیفت (الزامی):</strong></label>
            <textarea name="handover_notes" required rows={3} placeholder="روند تولید، تعمیرات انجام‌شده..." style={{ width: "100%", padding: "0.5rem" }} />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>خطرات فوری و ملاحظات ایمنی:</label>
            <textarea name="safety_concerns" rows={2} placeholder="نشت سیال، لغزندگی، نیاز به دیده‌بانی حریق..." style={{ width: "100%", padding: "0.5rem" }} />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>وضعیت تجهیزات و ماشین‌آلات:</label>
            <input type="text" name="equipment_status" placeholder="کوره فعال، نقاله شماره ۲ تحت سرویس..." style={{ width: "100%", padding: "0.5rem" }} />
          </div>

          {activePermits.length > 0 && (
            <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem" }}>
              <label style={{ fontWeight: "bold" }}>مجوزهای کار فعال جهت الصاق به این تحویل شیفت:</label>
              <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {activePermits.map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedPermits.includes(p.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedPermits([...selectedPermits, p.id]);
                        else setSelectedPermits(selectedPermits.filter((id) => id !== p.id));
                      }}
                    />
                    <span>[{p.reference_code}] {p.title} ({PERMIT_STATUS_LABELS[p.status]})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>انصراف</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "در حال ثبت…" : "ثبت گزارش شیفت"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
