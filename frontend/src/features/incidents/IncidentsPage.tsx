import { X, ArrowUpRight, BookOpen, Lightbulb, Link2 } from "lucide-react";
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
  fetchRiskRegisters,
  fetchWorkplaces,
  linkIncidentCapa,
  linkIncidentToRisk,
  recordIncidentRCA,
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
  type RiskRegisterItem,
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
  const [isLinkRiskModalOpen, setIsLinkRiskModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [riskRegisters, setRiskRegisters] = useState<RiskRegisterItem[]>([]);
  const [selectedRiskRegisterId, setSelectedRiskRegisterId] = useState("");

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

  // Investigate & RCA form state (Phase 2 Comprehensive RCA Studio)
  const [investigateForm, setInvestigateForm] = useState({
    rca_method: "5_whys",
    direct_causes: "",
    root_cause: "",
    contributing_factors: "",
    five_whys_data: [
      { why_number: 1, question: "چرا رویداد اتفاق افتاد؟", answer: "" },
      { why_number: 2, question: "چرا این وضعیت پیش آمد؟", answer: "" },
      { why_number: 3, question: "چرا مانع کنترلی عمل نکرد؟", answer: "" },
      { why_number: 4, question: "چرا انحراف متوقف نشد؟", answer: "" },
      { why_number: 5, question: "علت ریشه‌ای سیستمی چه بود؟", answer: "" },
    ],
    lessons_learned: "",
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
      organizationId ? fetchRiskRegisters(organizationId).catch(() => []) : Promise.resolve([]),
    ])
      .then(([incList, statsData, registers]) => {
        setIncidents(incList);
        setStats(statsData);
        setRiskRegisters(registers || []);
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
          rca_method: (detail as any).rca_method || "5_whys",
          direct_causes: (detail as any).direct_causes || "",
          root_cause: detail.root_cause || "",
          contributing_factors: detail.contributing_factors || "",
          five_whys_data: (detail as any).five_whys_data && (detail as any).five_whys_data.length > 0
            ? (detail as any).five_whys_data
            : [
                { why_number: 1, question: "چرا رویداد اتفاق افتاد؟", answer: "" },
                { why_number: 2, question: "چرا این وضعیت پیش آمد؟", answer: "" },
                { why_number: 3, question: "چرا مانع کنترلی عمل نکرد؟", answer: "" },
                { why_number: 4, question: "چرا انحراف متوقف نشد؟", answer: "" },
                { why_number: 5, question: "علت ریشه‌ای سیستمی چه بود؟", answer: "" },
              ],
          lessons_learned: (detail as any).lessons_learned || "",
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

  // Submit Comprehensive RCA Investigation
  const handleInvestigateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      const updated = await recordIncidentRCA(selectedIncident.id, investigateForm);
      setSelectedIncident(updated);
      setIsInvestigateModalOpen(false);
      setActionSubmitting(false);
      loadData();
    } catch (err) {
      setActionError(errorMessage(err));
      setActionSubmitting(false);
    }
  };

  // Submit Link Risk Register
  const handleLinkRiskSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !selectedRiskRegisterId) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      const updated = await linkIncidentToRisk(selectedIncident.id, selectedRiskRegisterId);
      setSelectedIncident(updated);
      setIsLinkRiskModalOpen(false);
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
                    <span className="badge" style={{ backgroundColor: "rgba(109, 40, 217, 0.15)", color: "var(--ai-primary)" }}>
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
              <span style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", background: selectedIncident.incident_type === "incident" ? "var(--danger-subtle)" : "var(--warning-subtle)", color: selectedIncident.incident_type === "incident" ? "var(--danger-fg)" : "var(--warning-fg)", fontWeight: "bold" }}>
                {selectedIncident.incident_type_display}
              </span>
              <span style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", background: "var(--bg-subtle)", color: "var(--text-primary)", fontWeight: "bold" }}>
                شدت: {selectedIncident.severity_display}
              </span>
              <span style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", background: "var(--info-subtle)", color: "var(--info-fg)", fontWeight: "bold" }}>
                وضعیت: {selectedIncident.status_display}
              </span>
              {selectedIncident.workplace_name && (
                <span style={{ padding: "0.25rem 0.6rem", borderRadius: "4px", background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                  کارگاه: {selectedIncident.workplace_name}
                </span>
              )}
            </div>

            {/* Description & Impact */}
            <div style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>شرح واقعه و اقدامات فوری</h3>
              <p style={{ background: "var(--bg-subtle)", padding: "0.75rem", borderRadius: "6px", fontSize: "0.9rem", lineHeight: "1.6", margin: 0 }}>
                {selectedIncident.description}
              </p>
              {selectedIncident.immediate_actions_taken && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  <strong>اقدامات فوری انجام‌شده: </strong>{selectedIncident.immediate_actions_taken}
                </div>
              )}
              {selectedIncident.location_details && (
                <div style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  <strong>موقعیت دقیق: </strong>{selectedIncident.location_details}
                </div>
              )}
            </div>

            {/* Metrics & Impact */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem", background: "var(--bg-subtle)", padding: "0.75rem", borderRadius: "6px" }}>
              <div><strong>تعداد مصدومین:</strong> {selectedIncident.injury_count} نفر</div>
              <div><strong>روزهای غیبت از کار:</strong> {selectedIncident.lost_time_days} روز</div>
              <div><strong>خسارت تخمینی:</strong> {selectedIncident.property_damage_cost ? Number(selectedIncident.property_damage_cost).toLocaleString("fa-IR") + " ریال" : "نامشخص"}</div>
              {selectedIncident.environmental_impact && <div><strong>پیامد محیط‌زیستی:</strong> {selectedIncident.environmental_impact}</div>}
            </div>

            {/* Investigation & RCA Section */}
            <div style={{ marginBottom: "1.25rem", border: "1px solid var(--border-strong)", borderRadius: "6px", padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1rem", color: "var(--text-primary)", margin: 0 }}>نتایج ریشه‌یابی و تحلیل علل وقوع (RCA)</h3>
                {selectedIncident.can_investigate && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setIsInvestigateModalOpen(true);
                    }}
                    style={{ background: "var(--text-secondary)", color: "var(--text-inverse)", border: "none", padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" }}
                  >
                    ویرایش / ثبت ریشه‌یابی
                  </button>
                )}
              </div>
              {selectedIncident.root_cause ? (
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", background: "rgba(37, 99, 235, 0.12)", color: "#2563eb", padding: "0.15rem 0.5rem", borderRadius: "10px", fontWeight: 700 }}>
                      متدولوژی: {selectedIncident.rca_method_display || selectedIncident.rca_method || "۵ چرا"}
                    </span>
                    {selectedIncident.investigation_completed_at && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                        تاریخ تکمیل: {new Date(selectedIncident.investigation_completed_at).toLocaleDateString("fa-IR")}
                      </span>
                    )}
                  </div>
                  {selectedIncident.direct_causes && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <strong style={{ color: "#d97706", fontSize: "0.85rem" }}>علل مستقیم و شرایط فوری:</strong>
                      <p style={{ margin: "0.2rem 0", fontSize: "0.875rem" }}>{selectedIncident.direct_causes}</p>
                    </div>
                  )}
                  {selectedIncident.five_whys_data && selectedIncident.five_whys_data.length > 0 && selectedIncident.five_whys_data.some(w => w.answer) && (
                    <div style={{ background: "var(--bg-subtle)", padding: "0.5rem 0.75rem", borderRadius: "6px", marginBottom: "0.5rem" }}>
                      <strong style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>مراحل ۵ چرا:</strong>
                      <ul style={{ margin: "0.25rem 0 0", paddingRight: "1.2rem", fontSize: "0.8rem" }}>
                        {selectedIncident.five_whys_data.map(w => w.answer ? (
                          <li key={w.why_number} style={{ marginBottom: 2 }}>
                            چرا {w.why_number}: {w.answer}
                          </li>
                        ) : null)}
                      </ul>
                    </div>
                  )}
                  <div style={{ marginBottom: "0.5rem" }}>
                    <strong style={{ color: "var(--danger-fg)" }}>علت ریشه‌ای اصلی (Root Cause):</strong>
                    <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", fontWeight: 600 }}>{selectedIncident.root_cause}</p>
                  </div>
                  {selectedIncident.contributing_factors && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <strong style={{ color: "var(--warning)" }}>عوامل کمکی و زمینه‌ساز:</strong>
                      <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>{selectedIncident.contributing_factors}</p>
                    </div>
                  )}
                  {selectedIncident.lessons_learned && (
                    <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "6px", padding: "0.75rem", marginTop: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#059669", fontWeight: 700, fontSize: "0.85rem", marginBottom: 3 }}>
                        <Lightbulb size={14} /> درس‌آموخته‌های ایمنی (Lessons Learned):
                      </div>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-primary)", lineHeight: "1.5" }}>{selectedIncident.lessons_learned}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
                  هنوز تحلیل علت ریشه‌ای برای این حادثه ثبت نشده است.
                </p>
              )}
            </div>

            {/* Matrix & Traceability Wiring Section */}
            <div style={{ marginBottom: "1.25rem", border: "1px solid var(--border-strong)", borderRadius: "6px", padding: "1rem", background: "rgba(99, 102, 241, 0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1rem", color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Link2 size={16} color="#6366f1" /> اتصالات بین‌ماژولی و زنجیره ردیابی
                </h3>
                {!selectedIncident.related_risk_register && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setSelectedRiskRegisterId(riskRegisters[0]?.id || "");
                      setIsLinkRiskModalOpen(true);
                    }}
                    style={{ background: "#2563eb", color: "#fff", border: "none", padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}
                  >
                    + اتصال به رجیستر ریسک
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.8rem" }}>
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>کد ردیابی کلان: </span>
                  <span style={{ fontFamily: "monospace", color: "#6366f1", fontWeight: 700 }}>{selectedIncident.traceability_chain_id || "—"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>ناهنجاری مبدأ: </span>
                  <strong>{selectedIncident.related_anomaly_code || "ندارد (ثبت مستقل)"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>مجوز کار مرتبط: </span>
                  <strong>{selectedIncident.related_permit_code || "ندارد"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>رجیستر ریسک پیوندخورده: </span>
                  <strong style={{ color: selectedIncident.related_risk_register_code ? "#2563eb" : "var(--text-muted)" }}>
                    {selectedIncident.related_risk_register_code || "هنوز متصل نشده"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Linked CAPAs Section */}
            <div style={{ marginBottom: "1.25rem", border: "1px solid var(--border-strong)", borderRadius: "6px", padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1rem", color: "var(--text-primary)", margin: 0 }}>اقدامات اصلاحی متناظر (CAPA)</h3>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setIsLinkCapaModalOpen(true);
                  }}
                  style={{ background: "var(--success)", color: "var(--text-inverse)", border: "none", padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" }}
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
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>هیچ اقدام اصلاحی متصلی یافت نشد.</p>
              )}
            </div>

            {/* Attachments Section */}
            {selectedIncident.attachments && selectedIncident.attachments.length > 0 && (
              <div style={{ marginBottom: "1.25rem", background: "var(--bg-subtle)", padding: "0.75rem", borderRadius: "6px" }}>
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
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", borderTop: "1px solid var(--border-default)", paddingTop: "1rem" }}>
              {selectedIncident.can_review && selectedIncident.status === "reported" && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setIsReviewModalOpen(true);
                  }}
                  style={{ background: "var(--info)", color: "var(--text-inverse)", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
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
                  style={{ background: "var(--success)", color: "var(--text-inverse)", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}
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
                  style={{ background: "var(--danger)", color: "var(--text-inverse)", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
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

      {/* Investigate & RCA Studio Modal */}
      {isInvestigateModalOpen && selectedIncident && (
        <div className="modal-overlay" onClick={() => setIsInvestigateModalOpen(false)}>
          <form className="modal-container" style={{ maxWidth: "700px", maxHeight: "90vh", overflowY: "auto" }} onSubmit={handleInvestigateSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <BookOpen size={20} color="#2563eb" />
                <h3 className="modal-title">استودیوی تحلیل ریشه‌ای (RCA) و درس‌آموخته‌ها — {selectedIncident.incident_code || `#${selectedIncident.id}`}</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setIsInvestigateModalOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
            </div>
            {actionError && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{actionError}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>متدولوژی تحلیل علل ریشه‌ای (RCA Method)</label>
                <select
                  className="form-input"
                  value={investigateForm.rca_method}
                  onChange={(e) => setInvestigateForm({ ...investigateForm, rca_method: e.target.value })}
                >
                  <option value="5_whys">روش ۵ چرا (5-Whys)</option>
                  <option value="fishbone">نمودار استخوان ماهی (Ishikawa)</option>
                  <option value="scat">تکنیک تحلیل علت و معلول (SCAT)</option>
                  <option value="taproot">متدولوژی ریشه‌یابی خطای انسانی (TapRooT)</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>علل مستقیم و شرایط فوری حادثه</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: لغزش پای اپراتور روی سطح آلوده به روغن"
                  value={investigateForm.direct_causes}
                  onChange={(e) => setInvestigateForm({ ...investigateForm, direct_causes: e.target.value })}
                />
              </div>
            </div>

            {/* 5-Whys Interactive Builder */}
            <div style={{ background: "var(--bg-subtle)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
              <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 700 }}>
                مراحل ۵ گانه استخراج علت (5-Whys Sequence)
              </h4>
              {investigateForm.five_whys_data.map((why, idx) => (
                <div key={why.why_number} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "0.75rem", marginBottom: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                    چرای شماره {why.why_number}:
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: "0.85rem" }}
                    placeholder={`پاسخ چرای ${why.why_number}...`}
                    value={why.answer}
                    onChange={(e) => {
                      const updatedWhys = [...investigateForm.five_whys_data];
                      updatedWhys[idx].answer = e.target.value;
                      setInvestigateForm({ ...investigateForm, five_whys_data: updatedWhys });
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>علت ریشه‌ای اصلی (Root Cause) *</label>
              <textarea
                required
                rows={3}
                placeholder="علت بنیادین سیستمی، فنی یا سازمانی که باعث وقوع این رویداد گردید..."
                value={investigateForm.root_cause}
                onChange={(e) => setInvestigateForm({ ...investigateForm, root_cause: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>عوامل کمکی، شرایط زمینه‌ساز و خطاهای انسانی (Contributing Factors)</label>
              <textarea
                rows={2}
                placeholder="خستگی پرسنل، روشنایی نامناسب، نبود دستورالعمل به‌روز..."
                value={investigateForm.contributing_factors}
                onChange={(e) => setInvestigateForm({ ...investigateForm, contributing_factors: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ background: "rgba(16, 185, 129, 0.08)", padding: "0.75rem", borderRadius: "8px", border: "1px dashed #10b981" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#059669", marginBottom: "0.4rem", fontWeight: 700, fontSize: "0.9rem" }}>
                <Lightbulb size={16} />
                <label style={{ margin: 0, color: "#059669" }}>درس‌آموخته‌های ایمنی قابل تعمیم (Lessons Learned)</label>
              </div>
              <textarea
                rows={3}
                placeholder="اقدامات و هشدارهای آموزنده جهت انتقال به سایر کارگاه‌ها، جلسات TBM و برنامه‌های آموزشی..."
                value={investigateForm.lessons_learned}
                onChange={(e) => setInvestigateForm({ ...investigateForm, lessons_learned: e.target.value })}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsInvestigateModalOpen(false)}>انصراف</button>
              <button type="submit" disabled={actionSubmitting} className="btn btn-primary" style={{ fontWeight: 700 }}>
                {actionSubmitting ? "در حال ثبت…" : "ثبت و انتشار ریشه‌یابی"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Link Risk Register Modal */}
      {isLinkRiskModalOpen && selectedIncident && (
        <div className="modal-overlay" onClick={() => setIsLinkRiskModalOpen(false)}>
          <form className="modal-container" style={{ maxWidth: "520px" }} onSubmit={handleLinkRiskSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ArrowUpRight size={20} color="#2563eb" />
                <h3 className="modal-title">اتصال مستقیم حادثه به رجیستر ریسک</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setIsLinkRiskModalOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
            </div>
            {actionError && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{actionError}</div>}
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              اتصال حادثه {selectedIncident.incident_code || `#${selectedIncident.id}`} به رجیستر ریسک جهت بازنگری احتمال و شدت سناریوهای شناسایی‌شده در فاز ۱.
            </p>
            <div className="form-group">
              <label>انتخاب رجیستر ریسک هدف *</label>
              <select
                required
                className="form-input"
                value={selectedRiskRegisterId}
                onChange={(e) => setSelectedRiskRegisterId(e.target.value)}
              >
                <option value="">انتخاب رجیستر ریسک...</option>
                {riskRegisters.map((rr) => (
                  <option key={rr.id} value={rr.id}>
                    [{rr.register_code}] {rr.title} — {rr.department || "عمومی"}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsLinkRiskModalOpen(false)}>انصراف</button>
              <button type="submit" disabled={actionSubmitting || !selectedRiskRegisterId} className="btn btn-primary">
                {actionSubmitting ? "در حال اتصال…" : "اتصال و به‌روزرسانی زنجیره ردیابی"}
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
