import { useEffect, useState } from "react";
import {
  fetchDashboardMetrics,
  fetchIncidentStats,
  fetchPermitStats,
  fetchEquipmentStats,
  fetchWorkforceStats,
  fetchProactiveIndicators,
  type DashboardMetrics,
  type IncidentSummaryStats,
  type PermitSummaryStats,
  type EquipmentStats,
  type WorkforceStats,
  type Organization,
  type ProactiveIndicatorsResponse,
  fetchOrganizations,
} from "../../services/api";
import {
  ClipboardCheck,
  ShieldAlert,
  AlertTriangle,
  Target,
  Clock,
  FileCheck,
  Flame,
  Wrench,
  Users,
  Building2,
  Calendar,
  AlertCircle,
  Activity,
} from "lucide-react";

const INSPECTION_STATUS_LABELS: Record<string, string> = {
  draft: "پیش‌نویس",
  in_progress: "در حال اجرا",
  completed: "انجام‌یافته",
  cancelled: "لغوشده",
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  open: "باز",
  in_progress: "در حال انجام",
  pending_verification: "در انتظار تأیید",
  completed: "انجام‌یافته",
};

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [incidentStats, setIncidentStats] = useState<IncidentSummaryStats | null>(null);
  const [permitStats, setPermitStats] = useState<PermitSummaryStats | null>(null);
  const [equipmentStats, setEquipmentStats] = useState<EquipmentStats | null>(null);
  const [workforceStats, setWorkforceStats] = useState<WorkforceStats | null>(null);
  const [indicatorsData, setIndicatorsData] = useState<ProactiveIndicatorsResponse | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(controller.signal)
      .then((items) => {
        setOrganizations(items);
        if (items.length > 0) setOrganizationId(items[0].id);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (organizationId === null) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    // Fetch primary metrics (essential)
    fetchDashboardMetrics(organizationId, controller.signal)
      .then(setMetrics)
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));

    // Optional stats: catch errors silently to maintain test backwards-compatibility
    fetchIncidentStats(organizationId, controller.signal)
      .then(setIncidentStats)
      .catch(() => setIncidentStats(null));

    fetchPermitStats(organizationId, controller.signal)
      .then(setPermitStats)
      .catch(() => setPermitStats(null));

    fetchEquipmentStats({ organization: organizationId }, controller.signal)
      .then(setEquipmentStats)
      .catch(() => setEquipmentStats(null));

    fetchWorkforceStats({ organization: organizationId }, controller.signal)
      .then(setWorkforceStats)
      .catch(() => setWorkforceStats(null));

    fetchProactiveIndicators(organizationId, 90, controller.signal)
      .then(setIndicatorsData)
      .catch(() => setIndicatorsData(null));

    return () => controller.abort();
  }, [organizationId]);

  return (
    <div className="dashboard-page stack" dir="rtl">
      {/* Header & Tenant Bar */}
      <div className="card toolbar-card dashboard-hero-card">
        <div className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <header className="page-header" style={{ margin: 0 }}>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              داشبورد مدیریتی HSE
            </h2>
            <p className="muted" style={{ margin: "0.35rem 0 0 0", fontSize: "0.875rem" }}>
              مرکز پایش هوشمند ریسک‌ها، مجوزهای کار پرخطر، تجهیزات، بازرسی‌ها و انطباق استانداردها
            </p>
          </header>

          <div className="tenant-selector-wrap" style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <label htmlFor="dash-org" style={{ fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Building2 size={16} className="text-muted" aria-hidden="true" />
              <strong>سازمان:</strong>
            </label>
            <select
              id="dash-org"
              className="form-input"
              style={{ minWidth: "220px" }}
              value={organizationId ?? ""}
              onChange={(e) => setOrganizationId(Number(e.target.value))}
              disabled={organizations.length === 0}
            >
              {organizations.length === 0 && <option value="">سازمانی یافت نشد</option>}
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && !metrics && (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }} aria-hidden="true" />
          <p className="muted">در حال بارگذاری شاخص‌های داشبورد…</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div><strong>خطا در دریافت داده‌های داشبورد:</strong> {error}</div>
        </div>
      )}

      {metrics && (
        <>
          {/* Executive KPI Grid */}
          <div
            className="metrics-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Inspections Card */}
            <div className="card kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon-wrap kpi-icon-teal">
                  <ClipboardCheck size={20} aria-hidden="true" />
                </div>
                <h3 className="kpi-title">آمار و وضعیت بازرسی‌ها</h3>
              </div>
              <p className="kpi-value">
                {metrics.inspections.total}
              </p>
              {metrics.inspections.total > 0 && (
                <div className="distribution-bar" title="نسبت تکمیل بازرسی‌ها">
                  <div
                    style={{
                      width: `${(metrics.inspections.completed / metrics.inspections.total) * 100}%`,
                      backgroundColor: "var(--success)",
                    }}
                  />
                  <div
                    style={{
                      width: `${(metrics.inspections.in_progress / metrics.inspections.total) * 100}%`,
                      backgroundColor: "var(--info)",
                    }}
                  />
                </div>
              )}
              <ul className="kpi-list">
                <li>
                  <span>در حال اجرا:</span>
                  <strong>{metrics.inspections.in_progress}</strong>
                </li>
                <li>
                  <span>پایان‌یافته:</span>
                  <strong>{metrics.inspections.completed}</strong>
                </li>
                <li>
                  <span>پیش‌نویس:</span>
                  <strong>{metrics.inspections.draft}</strong>
                </li>
                <li>
                  <span>لغوشده:</span>
                  <strong>{metrics.inspections.cancelled}</strong>
                </li>
              </ul>
            </div>

            {/* Risks Card */}
            <div className="card kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon-wrap kpi-icon-orange">
                  <ShieldAlert size={20} aria-hidden="true" />
                </div>
                <h3 className="kpi-title">شاخص‌های ریسک و خطرات</h3>
              </div>
              <p className="kpi-value">
                {metrics.risks.total} ارزیابی
              </p>
              {metrics.risks.total > 0 && (
                <div className="distribution-bar" title="توزیع سطوح ریسک">
                  <div
                    style={{
                      width: `${(metrics.risks.critical / metrics.risks.total) * 100}%`,
                      backgroundColor: "var(--danger)",
                    }}
                  />
                  <div
                    style={{
                      width: `${(metrics.risks.high / metrics.risks.total) * 100}%`,
                      backgroundColor: "var(--warning)",
                    }}
                  />
                  <div
                    style={{
                      width: `${(metrics.risks.medium / metrics.risks.total) * 100}%`,
                      backgroundColor: "#eab308",
                    }}
                  />
                  <div
                    style={{
                      width: `${(metrics.risks.low / metrics.risks.total) * 100}%`,
                      backgroundColor: "var(--success)",
                    }}
                  />
                </div>
              )}
              <p className="muted" style={{ fontSize: "0.85rem", margin: "0.25rem 0 0.5rem 0" }}>
                خطرات شناسایی‌شده: <strong>{metrics.risks.hazards_count}</strong>
              </p>
              <ul className="kpi-list">
                <li style={{ color: "var(--danger-text)" }}>
                  <span>بحرانی:</span>
                  <strong>{metrics.risks.critical}</strong>
                </li>
                <li style={{ color: "var(--warning-text)" }}>
                  <span>زیاد:</span>
                  <strong>{metrics.risks.high}</strong>
                </li>
                <li>
                  <span>متوسط:</span>
                  <strong>{metrics.risks.medium}</strong>
                </li>
                <li>
                  <span>کم:</span>
                  <strong>{metrics.risks.low}</strong>
                </li>
              </ul>
            </div>

            {/* Non-Conformities Card */}
            <div className="card kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon-wrap kpi-icon-amber">
                  <AlertTriangle size={20} aria-hidden="true" />
                </div>
                <h3 className="kpi-title">شاخص‌های عدم‌انطباق</h3>
              </div>
              <p className="kpi-value">
                {metrics.non_conformities.total}
              </p>
              {metrics.non_conformities.total > 0 && (
                <div className="distribution-bar" title="وضعیت عدم‌انطباق‌ها">
                  <div
                    style={{
                      width: `${(metrics.non_conformities.closed / metrics.non_conformities.total) * 100}%`,
                      backgroundColor: "var(--success)",
                    }}
                  />
                  <div
                    style={{
                      width: `${(metrics.non_conformities.ready_for_review / metrics.non_conformities.total) * 100}%`,
                      backgroundColor: "var(--info)",
                    }}
                  />
                  <div
                    style={{
                      width: `${(metrics.non_conformities.in_progress / metrics.non_conformities.total) * 100}%`,
                      backgroundColor: "var(--warning)",
                    }}
                  />
                  <div
                    style={{
                      width: `${(metrics.non_conformities.open / metrics.non_conformities.total) * 100}%`,
                      backgroundColor: "var(--danger)",
                    }}
                  />
                </div>
              )}
              <ul className="kpi-list">
                <li>
                  <span>باز:</span>
                  <strong>{metrics.non_conformities.open}</strong>
                </li>
                <li>
                  <span>در حال پیگیری:</span>
                  <strong>{metrics.non_conformities.in_progress}</strong>
                </li>
                <li>
                  <span>آماده بررسی:</span>
                  <strong>{metrics.non_conformities.ready_for_review}</strong>
                </li>
                <li>
                  <span>بسته‌شده:</span>
                  <strong>{metrics.non_conformities.closed}</strong>
                </li>
              </ul>
            </div>

            {/* Corrective Actions (CAPA) Card */}
            <div className="card kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon-wrap kpi-icon-indigo">
                  <Target size={20} aria-hidden="true" />
                </div>
                <h3 className="kpi-title">اقدامات اصلاحی (CAPA)</h3>
              </div>
              <p className="kpi-value">
                {metrics.corrective_actions.total}
              </p>
              {metrics.corrective_actions.total > 0 && (
                <div className="distribution-bar" title="وضعیت اقدامات اصلاحی">
                  <div
                    style={{
                      width: `${(metrics.corrective_actions.completed / metrics.corrective_actions.total) * 100}%`,
                      backgroundColor: "var(--success)",
                    }}
                  />
                  <div
                    style={{
                      width: `${(metrics.corrective_actions.open / metrics.corrective_actions.total) * 100}%`,
                      backgroundColor: "var(--info)",
                    }}
                  />
                  <div
                    style={{
                      width: `${(metrics.corrective_actions.overdue / metrics.corrective_actions.total) * 100}%`,
                      backgroundColor: "var(--danger)",
                    }}
                  />
                </div>
              )}
              <ul className="kpi-list">
                <li>
                  <span>اقدامات فعال/باز:</span>
                  <strong>{metrics.corrective_actions.open}</strong>
                </li>
                <li>
                  <span>اقدامات بسته‌شده:</span>
                  <strong>{metrics.corrective_actions.completed}</strong>
                </li>
                <li style={{ color: metrics.corrective_actions.overdue > 0 ? "var(--danger-text)" : "inherit" }}>
                  <span>سررسیدگذشته:</span>
                  <strong>{metrics.corrective_actions.overdue}</strong>
                </li>
              </ul>
            </div>
          </div>

          {/* Operational Overview from Phase 7-10 Stats (If Available) */}
          {(permitStats || incidentStats || equipmentStats || workforceStats) && (
            <div
              className="operational-stats-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1.25rem",
              }}
            >
              {permitStats && (
                <div className="card stat-mini-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <FileCheck size={18} className="text-info" />
                      مجوزهای کار (PTW)
                    </h4>
                    <span className="badge badge-info">فعال: {permitStats.active_count}</span>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.85rem" }}>
                    <div>کل: <strong>{permitStats.total_permits}</strong></div>
                    <div>تأییدشده: <strong>{permitStats.approved_count}</strong></div>
                    <div>بسته‌شده: <strong>{permitStats.closed_count}</strong></div>
                  </div>
                </div>
              )}

              {incidentStats && (
                <div className="card stat-mini-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Flame size={18} className="text-danger" />
                      حوادث و شبه‌حوادث
                    </h4>
                    <span className={`badge ${incidentStats.under_investigation_count > 0 ? "badge-danger" : "badge-success"}`}>
                      در دست بررسی: {incidentStats.under_investigation_count}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.85rem" }}>
                    <div>کل: <strong>{incidentStats.total_incidents}</strong></div>
                    <div>شبه‌حوادث: <strong>{incidentStats.near_miss_count}</strong></div>
                    <div>بسته‌شده: <strong>{incidentStats.closed_count}</strong></div>
                  </div>
                </div>
              )}

              {equipmentStats && (
                <div className="card stat-mini-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Wrench size={18} className="text-warning" />
                      تجهیزات صنعتی
                    </h4>
                    <span className={`badge ${equipmentStats.calibration_expired_count > 0 ? "badge-warning" : "badge-success"}`}>
                      انقضای کالیبراسیون: {equipmentStats.calibration_expired_count}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.85rem" }}>
                    <div>کل: <strong>{equipmentStats.total_equipment}</strong></div>
                    <div>آماده‌به‌کار: <strong>{equipmentStats.ready_count}</strong></div>
                    <div>تعمیرات معوق: <strong>{equipmentStats.maintenance_overdue_count}</strong></div>
                  </div>
                </div>
              )}

              {workforceStats && (
                <div className="card stat-mini-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Users size={18} className="text-primary" />
                      کارکنان و آموزش
                    </h4>
                    <span className={`badge ${workforceStats.competency_expiring_soon > 0 ? "badge-warning" : "badge-info"}`}>
                      صلاحیت معتبر: {workforceStats.competency_valid}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.85rem" }}>
                    <div>شاغلین: <strong>{workforceStats.employees_total}</strong></div>
                    <div>انقضا نزدیک: <strong>{workforceStats.competency_expiring_soon}</strong></div>
                    <div>کسری PPE: <strong>{workforceStats.ppe_stock_below_minimum}</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proactive & Leading HSE Indicators Section */}
          {indicatorsData && indicatorsData.indicators && indicatorsData.indicators.length > 0 && (
            <section className="card" style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <Activity size={22} color="#2563eb" aria-hidden="true" />
                  <h3 style={{ margin: 0 }}>ماتریس شاخص‌های پیشگیرانه و گذشته‌نگر HSE (دوره ۹۰ روزه)</h3>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", borderRadius: "12px", background: "#eff6ff", color: "#1d4ed8" }}>
                    پیشگیرانه: {indicatorsData.summary.leading_count}
                  </span>
                  <span style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", borderRadius: "12px", background: "#fef2f2", color: "#b91c1c" }}>
                    گذشته‌نگر: {indicatorsData.summary.lagging_count}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                {indicatorsData.indicators.map((ind) => (
                  <div
                    key={ind.code}
                    style={{
                      padding: "1rem",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      background: ind.status === "critical" ? "#fff5f5" : ind.status === "warning" ? "#fffdf0" : "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem", borderRadius: "4px", background: ind.type === "leading" ? "#e0f2fe" : "#f1f5f9", color: ind.type === "leading" ? "#0369a1" : "#475569", fontWeight: "bold" }}>
                        {ind.type === "leading" ? "Leading (پیشگیرانه)" : "Lagging (پیامد)"}
                      </span>
                      <span style={{
                        fontSize: "0.75rem",
                        padding: "0.15rem 0.4rem",
                        borderRadius: "4px",
                        background: ind.status === "on_target" ? "#dcfce7" : ind.status === "warning" ? "#fef08a" : "#fee2e2",
                        color: ind.status === "on_target" ? "#166534" : ind.status === "warning" ? "#854d0e" : "#991b1b",
                        fontWeight: "bold",
                      }}>
                        {ind.status === "on_target" ? "در هدف" : ind.status === "warning" ? "هشدار" : "بحرانی"}
                      </span>
                    </div>

                    <div style={{ fontWeight: "bold", fontSize: "0.95rem", marginBottom: "0.25rem" }}>{ind.name}</div>
                    <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 0.75rem", lineHeight: "1.3" }}>{ind.description}</p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>هدف: {ind.target} {ind.unit}</span>
                      <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: ind.status === "critical" ? "#dc2626" : ind.status === "warning" ? "#d97706" : "#16a34a" }}>
                        {ind.value} <span style={{ fontSize: "0.85rem", fontWeight: "normal" }}>{ind.unit}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Urgent / Overdue Deadlines Section */}
          <section className="card urgent-deadlines-section">
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <Clock size={20} className="text-warning" aria-hidden="true" />
              <h3 style={{ margin: 0 }}>اقدامات و بازرسی‌های دارای مهلت نزدیک یا گذشته</h3>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {/* Inspection Deadlines */}
              <div className="deadline-group">
                <h4 style={{ fontSize: "1rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Calendar size={16} className="text-muted" aria-hidden="true" />
                  زمان‌بندی بازرسی‌ها
                </h4>
                {metrics.urgent_deadlines.inspections.length === 0 ? (
                  <p className="muted" style={{ padding: "0.5rem 0" }}>هیچ بازرسی با مهلت نزدیک یا گذشته وجود ندارد.</p>
                ) : (
                  <ul className="deadline-list" style={{ padding: 0, listStyle: "none" }}>
                    {metrics.urgent_deadlines.inspections.map((i) => (
                      <li
                        key={i.id}
                        className={`deadline-item ${i.is_overdue ? "overdue" : ""}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.75rem 1rem",
                          borderRadius: "var(--radius-sm)",
                          marginBottom: "0.5rem",
                          backgroundColor: i.is_overdue ? "var(--danger-subtle)" : "var(--bg-subtle)",
                          border: `1px solid ${i.is_overdue ? "var(--danger-border)" : "var(--border-default)"}`,
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "0.95rem" }}>{i.title}</strong>
                          <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                            تاریخ: {i.scheduled_at?.split("T")[0] || "بی‌تاریخ"}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className="badge">
                            ({INSPECTION_STATUS_LABELS[i.status] ?? i.status})
                          </span>
                          {i.is_overdue && (
                            <span style={{ color: "var(--danger-fg)", fontWeight: "bold" }}>
                              [سررسید گذشته]
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* CAPA Deadlines */}
              <div className="deadline-group">
                <h4 style={{ fontSize: "1rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Target size={16} className="text-muted" aria-hidden="true" />
                  مهلت اقدامات اصلاحی
                </h4>
                {metrics.urgent_deadlines.actions.length === 0 ? (
                  <p className="muted" style={{ padding: "0.5rem 0" }}>هیچ اقدام اصلاحی با مهلت نزدیک یا گذشته وجود ندارد.</p>
                ) : (
                  <ul className="deadline-list" style={{ padding: 0, listStyle: "none" }}>
                    {metrics.urgent_deadlines.actions.map((a) => (
                      <li
                        key={a.id}
                        className={`deadline-item ${a.is_overdue ? "overdue" : ""}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.75rem 1rem",
                          borderRadius: "var(--radius-sm)",
                          marginBottom: "0.5rem",
                          backgroundColor: a.is_overdue ? "var(--danger-subtle)" : "var(--bg-subtle)",
                          border: `1px solid ${a.is_overdue ? "var(--danger-border)" : "var(--border-default)"}`,
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "0.95rem" }}>{a.description}</strong>
                          <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                            سررسید: {a.due_date || "بی‌تاریخ"}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className="badge">
                            ({ACTION_STATUS_LABELS[a.status] ?? a.status})
                          </span>
                          {a.is_overdue && (
                            <span style={{ color: "var(--danger-fg)", fontWeight: "bold" }}>
                              [سررسید گذشته]
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
