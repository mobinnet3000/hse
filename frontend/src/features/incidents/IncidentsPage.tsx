import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  ApiRequestError,
  closeIncident,
  createIncident,
  fetchCorrectiveActions,
  fetchHazards,
  fetchIncidentDetail,
  fetchIncidents,
  fetchIncidentStats,
  fetchOrganizations,
  fetchWorkplaces,
  investigateIncident,
  linkIncidentCapa,
  reopenIncident,
  reviewIncident,
  type CorrectiveAction,
  type CreateIncidentPayload,
  type Hazard,
  type IncidentDetail,
  type IncidentListItem,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentSummaryStats,
  type IncidentType,
  type Organization,
  type Workplace,
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

const TYPE_LABELS: Record<IncidentType, string> = {
  incident: "حادثه",
  near_miss: "شبه‌حادثه (Near-Miss)",
  unsafe_act: "عمل ناایمن",
  unsafe_condition: "شرایط ناایمن",
};

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  minor: "جزئی",
  moderate: "متوسط",
  major: "عمده",
  critical: "بحرانی",
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  reported: "گزارش‌شده",
  under_review: "در حال بررسی اولیه",
  under_investigation: "در حال ریشه‌یابی",
  action_required: "نیازمند اقدام اصلاحی",
  awaiting_verification: "در انتظار اثربخشی",
  closed: "مختومه‌شده",
  reopened: "بازگشایی مجدد",
};

export function IncidentsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [availableCapas, setAvailableCapas] = useState<CorrectiveAction[]>([]);

  // List & Stats
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [stats, setStats] = useState<IncidentSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [workplaceFilter, setWorkplaceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Detail Modal
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Action Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isInvestigateModalOpen, setIsInvestigateModalOpen] = useState(false);
  const [isLinkCapaModalOpen, setIsLinkCapaModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);

  // Action forms state
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Report form state
  const [reportForm, setReportForm] = useState<CreateIncidentPayload>({
    organization: 0,
    workplace: null,
    title: "",
    incident_type: "incident",
    severity: "minor",
    occurred_at: new Date().toISOString().slice(0, 16),
    location_details: "",
    description: "",
    immediate_actions_taken: "",
    injury_count: 0,
    lost_time_days: 0,
    environmental_impact: "",
    property_damage_cost: 0,
    related_hazard: null,
  });

  // Review form state
  const [reviewForm, setReviewForm] = useState({
    status: "under_investigation" as "under_review" | "under_investigation" | "closed",
    assigned_investigator_id: null as number | null,
    review_notes: "",
  });

  // Investigate form state
  const [investigateForm, setInvestigateForm] = useState({
    root_cause: "",
    contributing_factors: "",
    immediate_actions_taken: "",
  });

  // Link CAPA form state
  const [selectedCapaId, setSelectedCapaId] = useState<number | null>(null);

  // Close & Reopen form state
  const [closureNotes, setClosureNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  // Load organizations on mount
  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(controller.signal)
      .then((items) => {
        setOrganizations(items);
        if (items.length > 0) {
          setOrganizationId(items[0].id);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(errorMessage(err));
        }
      });
    return () => controller.abort();
  }, []);

  // When organizationId changes, load workplaces, hazards, capas
  useEffect(() => {
    if (!organizationId) return;

    const controller = new AbortController();
    fetchWorkplaces(organizationId, controller.signal)
      .then(setWorkplaces)
      .catch(() => {});

    fetchHazards(organizationId, {}, controller.signal)
      .then(setHazards)
      .catch(() => {});

    fetchCorrectiveActions(organizationId, controller.signal)
      .then(setAvailableCapas)
      .catch(() => {});

    return () => controller.abort();
  }, [organizationId]);

  // Load Incidents and Stats
  const loadData = () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();

    const params: Parameters<typeof fetchIncidents>[0] = {};
    if (organizationId) params.organization = organizationId;
    if (workplaceFilter) params.workplace = workplaceFilter;
    if (typeFilter) params.incident_type = typeFilter;
    if (severityFilter) params.severity = severityFilter;
    if (statusFilter) params.status = statusFilter;
    if (search.trim()) params.search = search.trim();
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    Promise.all([
      fetchIncidents(params, controller.signal),
      fetchIncidentStats(organizationId || undefined, controller.signal),
    ])
      .then(([incList, statsData]) => {
        setIncidents(incList);
        setStats(statsData);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(errorMessage(err));
          setLoading(false);
        }
      });

    return () => controller.abort();
  };

  useEffect(() => {
    const cancel = loadData();
    return () => cancel();
  }, [organizationId, workplaceFilter, typeFilter, severityFilter, statusFilter, search, dateFrom, dateTo]);

  // Open Incident Details
  const handleOpenDetail = (incidentId: number) => {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedIncident(null);
    fetchIncidentDetail(incidentId)
      .then((detail) => {
        setSelectedIncident(detail);
        setDetailLoading(false);
        // Pre-fill forms with incident data
        setInvestigateForm({
          root_cause: detail.root_cause || "",
          contributing_factors: detail.contributing_factors || "",
          immediate_actions_taken: detail.immediate_actions_taken || "",
        });
        setReviewForm({
          status: "under_investigation",
          assigned_investigator_id: detail.assigned_investigator || null,
          review_notes: detail.review_notes || "",
        });
        setClosureNotes(detail.closure_notes || "");
      })
      .catch((err) => {
        setDetailError(errorMessage(err));
        setDetailLoading(false);
      });
  };

  // Submit new incident report
  const handleReportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      await createIncident({
        ...reportForm,
        organization: organizationId,
        workplace: reportForm.workplace ? Number(reportForm.workplace) : null,
        related_hazard: reportForm.related_hazard ? Number(reportForm.related_hazard) : null,
        injury_count: Number(reportForm.injury_count || 0),
        lost_time_days: Number(reportForm.lost_time_days || 0),
        property_damage_cost: reportForm.property_damage_cost ? Number(reportForm.property_damage_cost) : 0,
      });
      setIsReportModalOpen(false);
      setActionSubmitting(false);
      // Reset form
      setReportForm({
        organization: organizationId,
        workplace: null,
        title: "",
        incident_type: "incident",
        severity: "minor",
        occurred_at: new Date().toISOString().slice(0, 16),
        location_details: "",
        description: "",
        immediate_actions_taken: "",
        injury_count: 0,
        lost_time_days: 0,
        environmental_impact: "",
        property_damage_cost: 0,
        related_hazard: null,
      });
      loadData();
    } catch (err) {
      setActionError(errorMessage(err));
      setActionSubmitting(false);
    }
  };

  // Submit Review
  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      const updated = await reviewIncident(selectedIncident.id, reviewForm);
      setSelectedIncident(updated);
      setIsReviewModalOpen(false);
      setActionSubmitting(false);
      loadData();
    } catch (err) {
      setActionError(errorMessage(err));
      setActionSubmitting(false);
    }
  };

  // Submit Investigation
  const handleInvestigateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      const updated = await investigateIncident(selectedIncident.id, investigateForm);
      setSelectedIncident(updated);
      setIsInvestigateModalOpen(false);
      setActionSubmitting(false);
      loadData();
    } catch (err) {
      setActionError(errorMessage(err));
      setActionSubmitting(false);
    }
  };

  // Submit Link CAPA
  const handleLinkCapaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !selectedCapaId) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      const updated = await linkIncidentCapa(selectedIncident.id, selectedCapaId);
      setSelectedIncident(updated);
      setIsLinkCapaModalOpen(false);
      setSelectedCapaId(null);
      setActionSubmitting(false);
      loadData();
    } catch (err) {
      setActionError(errorMessage(err));
      setActionSubmitting(false);
    }
  };

  // Submit Close
  const handleCloseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      const updated = await closeIncident(selectedIncident.id, { closure_notes: closureNotes });
      setSelectedIncident(updated);
      setIsCloseModalOpen(false);
      setActionSubmitting(false);
      loadData();
    } catch (err) {
      setActionError(errorMessage(err));
      setActionSubmitting(false);
    }
  };

  // Submit Reopen
  const handleReopenSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      const updated = await reopenIncident(selectedIncident.id, { reopen_reason: reopenReason });
      setSelectedIncident(updated);
      setIsReopenModalOpen(false);
      setActionSubmitting(false);
      loadData();
    } catch (err) {
      setActionError(errorMessage(err));
      setActionSubmitting(false);
    }
  };

  return (
    <div className="incidents-container" dir="rtl" style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>مدیریت حوادث، شبه‌حوادث و شرایط ناایمن</h1>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>ثبت رویداد، ریشه‌یابی و پیگیری تا بستن اقدامات اصلاحی متناظر</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {organizations.length > 1 && (
            <select
              aria-label="انتخاب سازمان"
              value={organizationId ?? ""}
              onChange={(e) => setOrganizationId(Number(e.target.value))}
              style={{ width: "auto", minWidth: "160px" }}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setReportForm((prev) => ({ ...prev, organization: organizationId || 0 }));
              setActionError(null);
              setIsReportModalOpen(true);
            }}
          >
            + ثبت حادثه یا شبه‌حادثه جدید
          </button>
        </div>
      </div>

      {/* KPI Stats Summary */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card" style={{ borderRight: "4px solid var(--primary)" }}>
            <span className="muted" style={{ fontSize: "0.875rem" }}>کل حوادث و رویدادها</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--text-primary)", marginTop: "0.25rem" }}>{stats.total_incidents}</div>
          </div>
          <div className="stat-card" style={{ borderRight: "4px solid var(--warning)" }}>
            <span className="muted" style={{ fontSize: "0.875rem" }}>شبه‌حوادث (Near-Miss)</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--warning)", marginTop: "0.25rem" }}>{stats.near_miss_count}</div>
          </div>
          <div className="stat-card" style={{ borderRight: "4px solid var(--info)" }}>
            <span className="muted" style={{ fontSize: "0.875rem" }}>در حال بررسی و اقدام</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--info)", marginTop: "0.25rem" }}>{stats.under_investigation_count}</div>
          </div>
          <div className="stat-card" style={{ borderRight: "4px solid var(--success)" }}>
            <span className="muted" style={{ fontSize: "0.875rem" }}>پرونده‌های مختومه‌شده</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--success)", marginTop: "0.25rem" }}>{stats.closed_count}</div>
          </div>
          <div className="stat-card" style={{ borderRight: "4px solid var(--danger)" }}>
            <span className="muted" style={{ fontSize: "0.875rem" }}>روزهای کاری از دست رفته (LTI)</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--danger)", marginTop: "0.25rem" }}>{stats.total_lost_time_days}</div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="filters-card">
        <div className="filter-grid">
          <div>
            <label style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>جستجو</label>
            <input
              type="text"
              placeholder="جستجو در عنوان یا شرح..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>نوع رویداد</label>
            <select
              aria-label="فیلتر نوع رویداد"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">همه انواع</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>سطح شدت</label>
            <select
              aria-label="فیلتر سطح شدت"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">همه شدت‌ها</option>
              {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>وضعیت</label>
            <select
              aria-label="فیلتر وضعیت"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>محل کارگاه</label>
            <select
              aria-label="فیلتر کارگاه"
              value={workplaceFilter}
              onChange={(e) => setWorkplaceFilter(e.target.value)}
            >
              <option value="">همه کارگاه‌ها</option>
              {workplaces.map((wp) => (
                <option key={wp.id} value={wp.id}>{wp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>از تاریخ</label>
            <input
              type="date"
              aria-label="از تاریخ"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>تا تاریخ</label>
            <input
              type="date"
              aria-label="تا تاریخ"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {detailLoading && (
        <div style={{ textAlign: "center", padding: "1rem", color: "var(--primary)", fontWeight: "bold" }}>
          در حال بارگذاری پرونده…
        </div>
      )}
      {detailError && (
        <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
          {detailError}
        </div>
      )}

      {/* Main List */}
      {loading ? (
        <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>در حال دریافت اطلاعات حوادث و رویدادها…</p>
      ) : error ? (
        <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      ) : incidents.length === 0 ? (
        <div className="empty-state">
          <p className="muted" style={{ fontSize: "1.1rem" }}>هیچ رویداد یا حادثه‌ای مطابق فیلترهای جاری یافت نشد.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {incidents.map((item) => (
            <div key={item.id} className="incident-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span className="badge badge-neutral">
                    #{item.id}
                  </span>
                  <span className={`badge ${item.incident_type === "incident" ? "badge-danger" : "badge-warning"}`}>
                    {item.incident_type_display}
                  </span>
                  <span className={`badge ${item.severity === "critical" ? "badge-danger" : item.severity === "major" ? "badge-warning" : "badge-info"}`}>
                    شدت: {item.severity_display}
                  </span>
                  <span className="badge badge-neutral">
                    وضعیت: {item.status_display}
                  </span>
                  {item.is_synthetic && (
                    <span className="badge" style={{ backgroundColor: "rgba(109, 40, 217, 0.15)", color: "#8b5cf6" }}>
                      داده آزمایشی
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => handleOpenDetail(item.id)}
                >
                  مشاهده و مدیریت پرونده
                </button>
              </div>

              <h2 style={{ margin: "0.25rem 0", fontSize: "1.1rem", fontWeight: "bold" }}>{item.title}</h2>

              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.85rem", flexWrap: "wrap" }} className="muted">
                <span>محل: {item.workplace_name || "نامشخص"}</span>
                <span>زمان وقوع: {new Date(item.occurred_at).toLocaleString("fa-IR")}</span>
                <span>گزارش‌دهنده: {item.reported_by_name || "ناشناس"}</span>
                {item.assigned_investigator_name && <span>مسئول بررسی: {item.assigned_investigator_name}</span>}
                {item.injury_count > 0 && <span style={{ color: "var(--danger)", fontWeight: "bold" }}>مصدوم: {item.injury_count} نفر</span>}
                {item.lost_time_days > 0 && <span style={{ color: "var(--danger)", fontWeight: "bold" }}>غیبت: {item.lost_time_days} روز</span>}
                <span>اقدام اصلاحی مرتبط: {item.capa_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="modal-overlay" onClick={() => setSelectedIncident(null)}>
          <div className="modal-container" style={{ maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ margin: 0, fontSize: "1.25rem" }}>پرونده حادثه #{selectedIncident.id}: {selectedIncident.title}</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedIncident(null)}
                aria-label="بستن"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", background: selectedIncident.incident_type === "incident" ? "#fee2e2" : "#fef3c7", color: selectedIncident.incident_type === "incident" ? "#991b1b" : "#92400e", fontWeight: "bold" }}>
                {selectedIncident.incident_type_display}
              </span>
              <span style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", background: "#f1f5f9", color: "#0f172a", fontWeight: "bold" }}>
                شدت: {selectedIncident.severity_display}
              </span>
              <span style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", background: "#dbeafe", color: "#1e40af", fontWeight: "bold" }}>
                وضعیت: {selectedIncident.status_display}
              </span>
              {selectedIncident.workplace_name && (
                <span style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", background: "#f8fafc", color: "#475569" }}>
                  کارگاه: {selectedIncident.workplace_name}
                </span>
              )}
            </div>

            {/* Description & Impact */}
            <div style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1rem", color: "#334155", marginBottom: "0.5rem" }}>شرح واقعه و اقدامات فوری</h3>
              <p style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", fontSize: "0.9rem", lineHeight: "1.6", margin: 0 }}>
                {selectedIncident.description}
              </p>
              {selectedIncident.immediate_actions_taken && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#475569" }}>
                  <strong>اقدامات فوری انجام‌شده: </strong>{selectedIncident.immediate_actions_taken}
                </div>
              )}
              {selectedIncident.location_details && (
                <div style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "#475569" }}>
                  <strong>موقعیت دقیق: </strong>{selectedIncident.location_details}
                </div>
              )}
            </div>

            {/* Metrics & Impact */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem", background: "#f1f5f9", padding: "0.75rem", borderRadius: "6px" }}>
              <div><strong>تعداد مصدومین:</strong> {selectedIncident.injury_count} نفر</div>
              <div><strong>روزهای غیبت از کار:</strong> {selectedIncident.lost_time_days} روز</div>
              <div><strong>خسارت تخمینی:</strong> {selectedIncident.property_damage_cost ? Number(selectedIncident.property_damage_cost).toLocaleString("fa-IR") + " ریال" : "نامشخص"}</div>
              {selectedIncident.environmental_impact && <div><strong>پیامد محیط‌زیستی:</strong> {selectedIncident.environmental_impact}</div>}
            </div>

            {/* Investigation & RCA Section */}
            <div style={{ marginBottom: "1.25rem", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1rem", color: "#1e293b", margin: 0 }}>نتایج ریشه‌یابی و تحلیل علل وقوع (RCA)</h3>
                {selectedIncident.can_investigate && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setIsInvestigateModalOpen(true);
                    }}
                    style={{ background: "#475569", color: "#fff", border: "none", padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" }}
                  >
                    ویرایش / ثبت ریشه‌یابی
                  </button>
                )}
              </div>
              {selectedIncident.root_cause ? (
                <div>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <strong style={{ color: "#b91c1c" }}>علت ریشه‌ای اصلی (Root Cause):</strong>
                    <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>{selectedIncident.root_cause}</p>
                  </div>
                  {selectedIncident.contributing_factors && (
                    <div>
                      <strong style={{ color: "#d97706" }}>عوامل کمکی و زمینه‌ساز:</strong>
                      <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>{selectedIncident.contributing_factors}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>
                  هنوز تحلیل علت ریشه‌ای برای این حادثه ثبت نشده است.
                </p>
              )}
            </div>

            {/* Linked CAPAs Section */}
            <div style={{ marginBottom: "1.25rem", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1rem", color: "#1e293b", margin: 0 }}>اقدامات اصلاحی متناظر (CAPA)</h3>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setIsLinkCapaModalOpen(true);
                  }}
                  style={{ background: "#059669", color: "#fff", border: "none", padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" }}
                >
                  + اتصال اقدام اصلاحی
                </button>
              </div>
              {selectedIncident.related_corrective_actions && selectedIncident.related_corrective_actions.length > 0 ? (
                <ul style={{ margin: 0, paddingRight: "1.2rem", fontSize: "0.85rem" }}>
                  {selectedIncident.related_corrective_actions.map((capa) => (
                    <li key={capa.id} style={{ marginBottom: "0.25rem" }}>
                      #{capa.id}: {capa.description} — <span style={{ fontWeight: "bold" }}>وضعیت: {capa.status_display}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>هیچ اقدام اصلاحی متصلی یافت نشد.</p>
              )}
            </div>

            {/* Attachments Section */}
            {selectedIncident.attachments && selectedIncident.attachments.length > 0 && (
              <div style={{ marginBottom: "1.25rem", background: "#f8fafc", padding: "0.75rem", borderRadius: "6px" }}>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>پیوست‌ها و مدارک حادثه</h4>
                <ul style={{ margin: 0, paddingRight: "1.2rem", fontSize: "0.85rem" }}>
                  {selectedIncident.attachments.map((att) => (
                    <li key={att.id}>
                      {att.title} ({att.attachment_type}) {att.description && `— ${att.description}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Workflow Action Buttons */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
              {selectedIncident.can_review && selectedIncident.status === "reported" && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setIsReviewModalOpen(true);
                  }}
                  style={{ background: "#2563eb", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  بررسی اولیه و تعیین بازرس
                </button>
              )}

              {selectedIncident.can_close && selectedIncident.status !== "closed" && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setIsCloseModalOpen(true);
                  }}
                  style={{ background: "#16a34a", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}
                >
                  مختومه‌سازی پرونده
                </button>
              )}

              {selectedIncident.can_close && selectedIncident.status === "closed" && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setIsReopenModalOpen(true);
                  }}
                  style={{ background: "#dc2626", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  بازگشایی مجدد پرونده
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Incident Modal */}
      {isReportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsReportModalOpen(false)}>
          <form className="modal-container" style={{ maxWidth: "600px" }} onSubmit={handleReportSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">ثبت رویداد، حادثه یا شبه‌حادثه جدید</h2>
              <button type="button" className="modal-close-btn" onClick={() => setIsReportModalOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
                {actionError}
              </div>
            )}

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label htmlFor="incident-title">عنوان رویداد *</label>
                <input
                  id="incident-title"
                  type="text"
                  required
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label htmlFor="incident-type">نوع رویداد *</label>
                  <select
                    id="incident-type"
                    value={reportForm.incident_type}
                    onChange={(e) => setReportForm({ ...reportForm, incident_type: e.target.value as IncidentType })}
                  >
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="incident-severity">سطح شدت *</label>
                  <select
                    id="incident-severity"
                    value={reportForm.severity}
                    onChange={(e) => setReportForm({ ...reportForm, severity: e.target.value as IncidentSeverity })}
                  >
                    {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label htmlFor="incident-workplace">محل کارگاه</label>
                  <select
                    id="incident-workplace"
                    value={reportForm.workplace ?? ""}
                    onChange={(e) => setReportForm({ ...reportForm, workplace: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">انتخاب کارگاه (اختیاری)</option>
                    {workplaces.map((wp) => (
                      <option key={wp.id} value={wp.id}>{wp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="incident-occurred-at">زمان وقوع *</label>
                  <input
                    id="incident-occurred-at"
                    type="datetime-local"
                    required
                    value={reportForm.occurred_at}
                    onChange={(e) => setReportForm({ ...reportForm, occurred_at: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="incident-location">موقعیت دقیق در کارگاه</label>
                <input
                  id="incident-location"
                  type="text"
                  placeholder="مثال: پای کوره شماره ۳، کنار تابلوی برق"
                  value={reportForm.location_details}
                  onChange={(e) => setReportForm({ ...reportForm, location_details: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="incident-description">شرح حادثه / رویداد *</label>
                <textarea
                  id="incident-description"
                  required
                  rows={3}
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="incident-immediate-actions">اقدامات فوری انجام‌شده</label>
                <textarea
                  id="incident-immediate-actions"
                  rows={2}
                  placeholder="مثال: قطع برق، انتقال مصدوم به درمانگاه، محصورسازی محوطه"
                  value={reportForm.immediate_actions_taken}
                  onChange={(e) => setReportForm({ ...reportForm, immediate_actions_taken: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label>تعداد مصدومین</label>
                  <input
                    type="number"
                    min="0"
                    value={reportForm.injury_count}
                    onChange={(e) => setReportForm({ ...reportForm, injury_count: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label>روزهای غیبت (LTI)</label>
                  <input
                    type="number"
                    min="0"
                    value={reportForm.lost_time_days}
                    onChange={(e) => setReportForm({ ...reportForm, lost_time_days: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label>مخاطره مرتبط (اختیاری)</label>
                <select
                  value={reportForm.related_hazard ?? ""}
                  onChange={(e) => setReportForm({ ...reportForm, related_hazard: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">انتخاب از مخاطرات شناسایی‌شده</option>
                  {hazards.map((haz) => (
                    <option key={haz.id} value={haz.id}>{haz.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsReportModalOpen(false)}
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={actionSubmitting}
                className="btn btn-danger"
              >
                {actionSubmitting ? "در حال ثبت…" : "ثبت گزارش رویداد"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && selectedIncident && (
        <div className="modal-overlay" onClick={() => setIsReviewModalOpen(false)}>
          <form className="modal-container" style={{ maxWidth: "500px" }} onSubmit={handleReviewSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">بررسی اولیه و تعیین بازرس برای پرونده #{selectedIncident.id}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsReviewModalOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
            </div>
            {actionError && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{actionError}</div>}
            <div className="form-group">
              <label>وضعیت بعدی</label>
              <select
                value={reviewForm.status}
                onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value as any })}
              >
                <option value="under_investigation">ارجاع به بازرس و شروع ریشه‌یابی (under_investigation)</option>
                <option value="under_review">نیازمند بررسی تکمیلی (under_review)</option>
                <option value="closed">بستن فوری به دلیل نامعتبر بودن گزارش (closed)</option>
              </select>
            </div>
            <div className="form-group">
              <label>یادداشت بررسی مدیر HSE</label>
              <textarea
                rows={3}
                value={reviewForm.review_notes}
                onChange={(e) => setReviewForm({ ...reviewForm, review_notes: e.target.value })}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsReviewModalOpen(false)}>انصراف</button>
              <button type="submit" disabled={actionSubmitting} className="btn btn-primary">
                {actionSubmitting ? "در حال ثبت…" : "تأیید و ارجاع"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Investigate Modal */}
      {isInvestigateModalOpen && selectedIncident && (
        <div className="modal-overlay" onClick={() => setIsInvestigateModalOpen(false)}>
          <form className="modal-container" style={{ maxWidth: "600px" }} onSubmit={handleInvestigateSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">ثبت نتایج ریشه‌یابی و تحلیل علل (RCA) - پرونده #{selectedIncident.id}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsInvestigateModalOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
            </div>
            {actionError && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{actionError}</div>}
            <div className="form-group">
              <label>علت ریشه‌ای وقوع (Root Cause - ۵ چرا) *</label>
              <textarea
                required
                rows={4}
                placeholder="تحلیل ریشه‌ای و پاسخ به ۵ چرا را وارد کنید..."
                value={investigateForm.root_cause}
                onChange={(e) => setInvestigateForm({ ...investigateForm, root_cause: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>عوامل کمکی و خطاهای زمینه‌ساز</label>
              <textarea
                rows={2}
                value={investigateForm.contributing_factors}
                onChange={(e) => setInvestigateForm({ ...investigateForm, contributing_factors: e.target.value })}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsInvestigateModalOpen(false)}>انصراف</button>
              <button type="submit" disabled={actionSubmitting} className="btn btn-primary">
                {actionSubmitting ? "در حال ثبت…" : "ثبت ریشه‌یابی"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Link CAPA Modal */}
      {isLinkCapaModalOpen && selectedIncident && (
        <div className="modal-overlay" onClick={() => setIsLinkCapaModalOpen(false)}>
          <form className="modal-container" style={{ maxWidth: "500px" }} onSubmit={handleLinkCapaSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">اتصال اقدام اصلاحی به پرونده #{selectedIncident.id}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsLinkCapaModalOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
            </div>
            {actionError && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{actionError}</div>}
            <div className="form-group">
              <label>انتخاب اقدام اصلاحی *</label>
              <select
                required
                value={selectedCapaId ?? ""}
                onChange={(e) => setSelectedCapaId(Number(e.target.value))}
              >
                <option value="">انتخاب اقدام اصلاحی (CAPA)</option>
                {availableCapas.map((c) => (
                  <option key={c.id} value={c.id}>#{c.id}: {c.description} ({c.status_display})</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsLinkCapaModalOpen(false)}>انصراف</button>
              <button type="submit" disabled={actionSubmitting || !selectedCapaId} className="btn btn-primary">
                {actionSubmitting ? "در حال ثبت…" : "اتصال اقدام"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close Incident Modal */}
      {isCloseModalOpen && selectedIncident && (
        <div className="modal-overlay" onClick={() => setIsCloseModalOpen(false)}>
          <form className="modal-container" style={{ maxWidth: "500px" }} onSubmit={handleCloseSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--success)" }}>مختومه‌سازی نهایی پرونده حادثه #{selectedIncident.id}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsCloseModalOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
            </div>
            <p className="muted" style={{ fontSize: "0.85rem", margin: "0.25rem 0 1rem" }}>
              نکته: جهت بستن پرونده‌های با شدت متوسط یا بالاتر، ثبت علت ریشه‌ای و تکمیل کلیه اقدامات اصلاحی متناظر الزامی است.
            </p>
            {actionError && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{actionError}</div>}
            <div className="form-group">
              <label>توضیحات و خلاصه اختتام پرونده *</label>
              <textarea
                required
                rows={3}
                placeholder="تأییدیه اجرای اقدامات اصلاحی و عدم تکرار رویداد..."
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsCloseModalOpen(false)}>انصراف</button>
              <button type="submit" disabled={actionSubmitting} className="btn btn-primary" style={{ backgroundColor: "var(--success)" }}>
                {actionSubmitting ? "در حال بستن…" : "مختومه‌سازی پرونده"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reopen Incident Modal */}
      {isReopenModalOpen && selectedIncident && (
        <div className="modal-overlay" onClick={() => setIsReopenModalOpen(false)}>
          <form className="modal-container" style={{ maxWidth: "500px" }} onSubmit={handleReopenSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--danger)" }}>بازگشایی مجدد پرونده حادثه #{selectedIncident.id}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsReopenModalOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
            </div>
            {actionError && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{actionError}</div>}
            <div className="form-group">
              <label>دلیل بازگشایی مجدد پرونده *</label>
              <textarea
                required
                rows={3}
                placeholder="دلیل نیاز به بازنگری یا کشف شواهد جدید..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsReopenModalOpen(false)}>انصراف</button>
              <button type="submit" disabled={actionSubmitting} className="btn btn-danger">
                {actionSubmitting ? "در حال ثبت…" : "تأیید بازگشایی"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
