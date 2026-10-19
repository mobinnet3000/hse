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
          <p style={{ color: "#666", margin: "0.25rem 0 0" }}>ثبت رویداد، ریشه‌یابی و پیگیری تا بستن اقدامات اصلاحی متناظر</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {organizations.length > 1 && (
            <select
              aria-label="انتخاب سازمان"
              value={organizationId ?? ""}
              onChange={(e) => setOrganizationId(Number(e.target.value))}
              style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setReportForm((prev) => ({ ...prev, organization: organizationId || 0 }));
              setActionError(null);
              setIsReportModalOpen(true);
            }}
            style={{ backgroundColor: "#dc2626", color: "#fff", border: "none", padding: "0.6rem 1.2rem", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            + ثبت حادثه یا شبه‌حادثه جدید
          </button>
        </div>
      </div>

      {/* KPI Stats Summary */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>کل حوادث و رویدادها</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#0f172a", marginTop: "0.25rem" }}>{stats.total_incidents}</div>
          </div>
          <div style={{ background: "#fef3c7", padding: "1rem", borderRadius: "8px", border: "1px solid #fde68a" }}>
            <span style={{ fontSize: "0.875rem", color: "#92400e" }}>شبه‌حوادث (Near-Miss)</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#b45309", marginTop: "0.25rem" }}>{stats.near_miss_count}</div>
          </div>
          <div style={{ background: "#e0f2fe", padding: "1rem", borderRadius: "8px", border: "1px solid #bae6fd" }}>
            <span style={{ fontSize: "0.875rem", color: "#0369a1" }}>در حال بررسی و اقدام</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#0284c7", marginTop: "0.25rem" }}>{stats.under_investigation_count}</div>
          </div>
          <div style={{ background: "#dcfce7", padding: "1rem", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
            <span style={{ fontSize: "0.875rem", color: "#166534" }}>پرونده‌های مختومه‌شده</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#15803d", marginTop: "0.25rem" }}>{stats.closed_count}</div>
          </div>
          <div style={{ background: "#fee2e2", padding: "1rem", borderRadius: "8px", border: "1px solid #fecaca" }}>
            <span style={{ fontSize: "0.875rem", color: "#991b1b" }}>روزهای کاری از دست رفته (LTI)</span>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#b91c1c", marginTop: "0.25rem" }}>{stats.total_lost_time_days}</div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>جستجو</label>
            <input
              type="text"
              placeholder="جستجو در عنوان یا شرح..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>نوع رویداد</label>
            <select
              aria-label="فیلتر نوع رویداد"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              <option value="">همه انواع</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>سطح شدت</label>
            <select
              aria-label="فیلتر سطح شدت"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              <option value="">همه شدت‌ها</option>
              {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>وضعیت</label>
            <select
              aria-label="فیلتر وضعیت"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>محل کارگاه</label>
            <select
              aria-label="فیلتر کارگاه"
              value={workplaceFilter}
              onChange={(e) => setWorkplaceFilter(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              <option value="">همه کارگاه‌ها</option>
              {workplaces.map((wp) => (
                <option key={wp.id} value={wp.id}>{wp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>از تاریخ</label>
            <input
              type="date"
              aria-label="از تاریخ"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>تا تاریخ</label>
            <input
              type="date"
              aria-label="تا تاریخ"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>
        </div>
      </div>

      {detailLoading && (
        <div style={{ textAlign: "center", padding: "1rem", color: "#2563eb", fontWeight: "bold" }}>
          در حال بارگذاری پرونده…
        </div>
      )}
      {detailError && (
        <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
          {detailError}
        </div>
      )}

      {/* Main List */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>در حال دریافت اطلاعات حوادث و رویدادها…</p>
      ) : error ? (
        <div style={{ padding: "1rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "8px", marginBottom: "1rem" }}>
          {error}
        </div>
      ) : incidents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
          <p style={{ color: "#64748b", fontSize: "1.1rem" }}>هیچ رویداد یا حادثه‌ای مطابق فیلترهای جاری یافت نشد.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {incidents.map((item) => (
            <div
              key={item.id}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: "#f1f5f9", color: "#475569" }}>
                    #{item.id}
                  </span>
                  <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: item.incident_type === "incident" ? "#fee2e2" : "#fef3c7", color: item.incident_type === "incident" ? "#991b1b" : "#92400e", fontWeight: "bold" }}>
                    {item.incident_type_display}
                  </span>
                  <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: item.severity === "critical" ? "#dc2626" : item.severity === "major" ? "#ea580c" : item.severity === "moderate" ? "#d97706" : "#65a30d", color: "#fff", fontWeight: "bold" }}>
                    شدت: {item.severity_display}
                  </span>
                  <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: "#f3f4f6", color: "#374151" }}>
                    وضعیت: {item.status_display}
                  </span>
                  {item.is_synthetic && (
                    <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", borderRadius: "4px", background: "#ede9fe", color: "#6d28d9" }}>
                      داده آزمایشی
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenDetail(item.id)}
                  style={{ background: "#2563eb", color: "#fff", border: "none", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  مشاهده و مدیریت پرونده
                </button>
              </div>

              <h2 style={{ margin: "0.25rem 0", fontSize: "1.1rem", fontWeight: "bold" }}>{item.title}</h2>

              <div style={{ display: "flex", gap: "1.5rem", color: "#64748b", fontSize: "0.85rem", flexWrap: "wrap" }}>
                <span>محل: {item.workplace_name || "نامشخص"}</span>
                <span>زمان وقوع: {new Date(item.occurred_at).toLocaleString("fa-IR")}</span>
                <span>گزارش‌دهنده: {item.reported_by_name || "ناشناس"}</span>
                {item.assigned_investigator_name && <span>مسئول بررسی: {item.assigned_investigator_name}</span>}
                {item.injury_count > 0 && <span style={{ color: "#dc2626", fontWeight: "bold" }}>مصدوم: {item.injury_count} نفر</span>}
                {item.lost_time_days > 0 && <span style={{ color: "#dc2626", fontWeight: "bold" }}>غیبت: {item.lost_time_days} روز</span>}
                <span>اقدام اصلاحی مرتبط: {item.capa_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: "8px", maxWidth: "800px", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>پرونده حادثه #{selectedIncident.id}: {selectedIncident.title}</h2>
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b" }}
              >
                ×
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
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "1rem" }}>
          <form onSubmit={handleReportSubmit} style={{ background: "#fff", borderRadius: "8px", maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.25rem", borderBottom: "1px solid #eee", paddingBottom: "0.5rem" }}>ثبت رویداد، حادثه یا شبه‌حادثه جدید</h2>

            {actionError && (
              <div style={{ padding: "0.5rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "4px", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
                {actionError}
              </div>
            )}

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div>
                <label htmlFor="incident-title" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>عنوان رویداد *</label>
                <input
                  id="incident-title"
                  type="text"
                  required
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                  style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label htmlFor="incident-type" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>نوع رویداد *</label>
                  <select
                    id="incident-type"
                    value={reportForm.incident_type}
                    onChange={(e) => setReportForm({ ...reportForm, incident_type: e.target.value as IncidentType })}
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  >
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="incident-severity" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>سطح شدت *</label>
                  <select
                    id="incident-severity"
                    value={reportForm.severity}
                    onChange={(e) => setReportForm({ ...reportForm, severity: e.target.value as IncidentSeverity })}
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  >
                    {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label htmlFor="incident-workplace" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>محل کارگاه</label>
                  <select
                    id="incident-workplace"
                    value={reportForm.workplace ?? ""}
                    onChange={(e) => setReportForm({ ...reportForm, workplace: e.target.value ? Number(e.target.value) : null })}
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  >
                    <option value="">انتخاب کارگاه (اختیاری)</option>
                    {workplaces.map((wp) => (
                      <option key={wp.id} value={wp.id}>{wp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="incident-occurred-at" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>زمان وقوع *</label>
                  <input
                    id="incident-occurred-at"
                    type="datetime-local"
                    required
                    value={reportForm.occurred_at}
                    onChange={(e) => setReportForm({ ...reportForm, occurred_at: e.target.value })}
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="incident-location" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>موقعیت دقیق در کارگاه</label>
                <input
                  id="incident-location"
                  type="text"
                  placeholder="مثال: پای کوره شماره ۳، کنار تابلوی برق"
                  value={reportForm.location_details}
                  onChange={(e) => setReportForm({ ...reportForm, location_details: e.target.value })}
                  style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div>
                <label htmlFor="incident-description" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>شرح حادثه / رویداد *</label>
                <textarea
                  id="incident-description"
                  required
                  rows={3}
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div>
                <label htmlFor="incident-immediate-actions" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>اقدامات فوری انجام‌شده</label>
                <textarea
                  id="incident-immediate-actions"
                  rows={2}
                  placeholder="مثال: قطع برق، انتقال مصدوم به درمانگاه، محصورسازی محوطه"
                  value={reportForm.immediate_actions_taken}
                  onChange={(e) => setReportForm({ ...reportForm, immediate_actions_taken: e.target.value })}
                  style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>تعداد مصدومین</label>
                  <input
                    type="number"
                    min="0"
                    value={reportForm.injury_count}
                    onChange={(e) => setReportForm({ ...reportForm, injury_count: Number(e.target.value) })}
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>روزهای غیبت (LTI)</label>
                  <input
                    type="number"
                    min="0"
                    value={reportForm.lost_time_days}
                    onChange={(e) => setReportForm({ ...reportForm, lost_time_days: Number(e.target.value) })}
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>مخاطره مرتبط (اختیاری)</label>
                <select
                  value={reportForm.related_hazard ?? ""}
                  onChange={(e) => setReportForm({ ...reportForm, related_hazard: e.target.value ? Number(e.target.value) : null })}
                  style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="">انتخاب از مخاطرات شناسایی‌شده</option>
                  {hazards.map((haz) => (
                    <option key={haz.id} value={haz.id}>{haz.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                style={{ padding: "0.5rem 1rem", border: "1px solid #ccc", background: "#f8fafc", borderRadius: "4px", cursor: "pointer" }}
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={actionSubmitting}
                style={{ padding: "0.5rem 1.2rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              >
                {actionSubmitting ? "در حال ثبت…" : "ثبت گزارش رویداد"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && selectedIncident && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "1rem" }}>
          <form onSubmit={handleReviewSubmit} style={{ background: "#fff", borderRadius: "8px", maxWidth: "500px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, fontSize: "1.1rem" }}>بررسی اولیه و تعیین بازرس برای پرونده #{selectedIncident.id}</h3>
            {actionError && <div style={{ padding: "0.5rem", background: "#fee2e2", color: "#b91c1c", marginBottom: "0.75rem", fontSize: "0.85rem" }}>{actionError}</div>}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>وضعیت بعدی</label>
              <select
                value={reviewForm.status}
                onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value as any })}
                style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value="under_investigation">ارجاع به بازرس و شروع ریشه‌یابی (under_investigation)</option>
                <option value="under_review">نیازمند بررسی تکمیلی (under_review)</option>
                <option value="closed">بستن فوری به دلیل نامعتبر بودن گزارش (closed)</option>
              </select>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>یادداشت بررسی مدیر HSE</label>
              <textarea
                rows={3}
                value={reviewForm.review_notes}
                onChange={(e) => setReviewForm({ ...reviewForm, review_notes: e.target.value })}
                style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" onClick={() => setIsReviewModalOpen(false)} style={{ padding: "0.4rem 0.8rem", border: "1px solid #ccc", background: "#f8fafc", borderRadius: "4px" }}>انصراف</button>
              <button type="submit" disabled={actionSubmitting} style={{ padding: "0.4rem 1rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px" }}>
                {actionSubmitting ? "در حال ثبت…" : "تأیید و ارجاع"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Investigate Modal */}
      {isInvestigateModalOpen && selectedIncident && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "1rem" }}>
          <form onSubmit={handleInvestigateSubmit} style={{ background: "#fff", borderRadius: "8px", maxWidth: "600px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, fontSize: "1.1rem" }}>ثبت نتایج ریشه‌یابی و تحلیل علل (RCA) - پرونده #{selectedIncident.id}</h3>
            {actionError && <div style={{ padding: "0.5rem", background: "#fee2e2", color: "#b91c1c", marginBottom: "0.75rem", fontSize: "0.85rem" }}>{actionError}</div>}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>علت ریشه‌ای وقوع (Root Cause - ۵ چرا) *</label>
              <textarea
                required
                rows={4}
                placeholder="تحلیل ریشه‌ای و پاسخ به ۵ چرا را وارد کنید..."
                value={investigateForm.root_cause}
                onChange={(e) => setInvestigateForm({ ...investigateForm, root_cause: e.target.value })}
                style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>عوامل کمکی و خطاهای زمینه‌ساز</label>
              <textarea
                rows={2}
                value={investigateForm.contributing_factors}
                onChange={(e) => setInvestigateForm({ ...investigateForm, contributing_factors: e.target.value })}
                style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" onClick={() => setIsInvestigateModalOpen(false)} style={{ padding: "0.4rem 0.8rem", border: "1px solid #ccc", background: "#f8fafc", borderRadius: "4px" }}>انصراف</button>
              <button type="submit" disabled={actionSubmitting} style={{ padding: "0.4rem 1rem", background: "#475569", color: "#fff", border: "none", borderRadius: "4px" }}>
                {actionSubmitting ? "در حال ثبت…" : "ثبت ریشه‌یابی"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Link CAPA Modal */}
      {isLinkCapaModalOpen && selectedIncident && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "1rem" }}>
          <form onSubmit={handleLinkCapaSubmit} style={{ background: "#fff", borderRadius: "8px", maxWidth: "500px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, fontSize: "1.1rem" }}>اتصال اقدام اصلاحی به پرونده #{selectedIncident.id}</h3>
            {actionError && <div style={{ padding: "0.5rem", background: "#fee2e2", color: "#b91c1c", marginBottom: "0.75rem", fontSize: "0.85rem" }}>{actionError}</div>}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>انتخاب اقدام اصلاحی *</label>
              <select
                required
                value={selectedCapaId ?? ""}
                onChange={(e) => setSelectedCapaId(Number(e.target.value))}
                style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value="">انتخاب اقدام اصلاحی (CAPA)</option>
                {availableCapas.map((c) => (
                  <option key={c.id} value={c.id}>#{c.id}: {c.description} ({c.status_display})</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" onClick={() => setIsLinkCapaModalOpen(false)} style={{ padding: "0.4rem 0.8rem", border: "1px solid #ccc", background: "#f8fafc", borderRadius: "4px" }}>انصراف</button>
              <button type="submit" disabled={actionSubmitting || !selectedCapaId} style={{ padding: "0.4rem 1rem", background: "#059669", color: "#fff", border: "none", borderRadius: "4px" }}>
                {actionSubmitting ? "در حال ثبت…" : "اتصال اقدام"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close Incident Modal */}
      {isCloseModalOpen && selectedIncident && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "1rem" }}>
          <form onSubmit={handleCloseSubmit} style={{ background: "#fff", borderRadius: "8px", maxWidth: "500px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, fontSize: "1.1rem", color: "#16a34a" }}>مختومه‌سازی نهایی پرونده حادثه #{selectedIncident.id}</h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.25rem 0 0.75rem" }}>
              نکته: جهت بستن پرونده‌های با شدت متوسط یا بالاتر، ثبت علت ریشه‌ای و تکمیل کلیه اقدامات اصلاحی متناظر الزامی است.
            </p>
            {actionError && <div style={{ padding: "0.5rem", background: "#fee2e2", color: "#b91c1c", marginBottom: "0.75rem", fontSize: "0.85rem" }}>{actionError}</div>}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>توضیحات و خلاصه اختتام پرونده *</label>
              <textarea
                required
                rows={3}
                placeholder="تأییدیه اجرای اقدامات اصلاحی و عدم تکرار رویداد..."
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" onClick={() => setIsCloseModalOpen(false)} style={{ padding: "0.4rem 0.8rem", border: "1px solid #ccc", background: "#f8fafc", borderRadius: "4px" }}>انصراف</button>
              <button type="submit" disabled={actionSubmitting} style={{ padding: "0.4rem 1rem", background: "#16a34a", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold" }}>
                {actionSubmitting ? "در حال بستن…" : "مختومه‌سازی پرونده"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reopen Incident Modal */}
      {isReopenModalOpen && selectedIncident && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "1rem" }}>
          <form onSubmit={handleReopenSubmit} style={{ background: "#fff", borderRadius: "8px", maxWidth: "500px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, fontSize: "1.1rem", color: "#dc2626" }}>بازگشایی مجدد پرونده حادثه #{selectedIncident.id}</h3>
            {actionError && <div style={{ padding: "0.5rem", background: "#fee2e2", color: "#b91c1c", marginBottom: "0.75rem", fontSize: "0.85rem" }}>{actionError}</div>}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>دلیل بازگشایی مجدد پرونده *</label>
              <textarea
                required
                rows={3}
                placeholder="دلیل نیاز به بازنگری یا کشف شواهد جدید..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                style={{ width: "100%", padding: "0.45rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" onClick={() => setIsReopenModalOpen(false)} style={{ padding: "0.4rem 0.8rem", border: "1px solid #ccc", background: "#f8fafc", borderRadius: "4px" }}>انصراف</button>
              <button type="submit" disabled={actionSubmitting} style={{ padding: "0.4rem 1rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px" }}>
                {actionSubmitting ? "در حال ثبت…" : "تأیید بازگشایی"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
