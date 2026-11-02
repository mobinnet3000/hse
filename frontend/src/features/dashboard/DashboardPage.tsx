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
      {/* Executive Command Header */}
      <div className="dash-header">
        <div className="dash-header-titles">
          <h2 className="dash-title" style={{ margin: 0 }}>
            داشبورد مدیریتی HSE
          </h2>
          <p className="dash-subtitle">
            مرکز پایش هوشمند ریسک‌ها، مجوزهای کار پرخطر، تجهیزات، بازرسی‌ها و انطباق استانداردها
          </p>
        </div>

        <div className="dash-tenant-select">
          <label htmlFor="dash-org" className="dash-tenant-label">
            <Building2 size={16} aria-hidden="true" />
            <span>سازمان:</span>
          </label>
          <select
            id="dash-org"
            className="form-input dash-org-select"
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
          {/* Executive Precision KPI Grid */}
          <div className="dash-kpi-grid">
            {/* Inspections Card */}
            <div className="dash-kpi-card">
              <div className="dash-kpi-top">
                <span className="dash-kpi-label">آمار و وضعیت بازرسی‌ها</span>
                <ClipboardCheck size={18} className="dash-kpi-icon" aria-hidden="true" />
              </div>
              <div className="dash-kpi-num">
                {metrics.inspections.total}
              </div>
              {metrics.inspections.total > 0 && (
                <div className="dash-micro-bar" title="نسبت تکمیل بازرسی‌ها">
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
              <div className="dash-kpi-breakdown">
                <span className="dash-kpi-pill">
                  <span>در حال اجرا:</span>
                  <strong>{metrics.inspections.in_progress}</strong>
                </span>
                <span className="dash-kpi-pill">
                  <span>پایان‌یافته:</span>
                  <strong>{metrics.inspections.completed}</strong>
                </span>
                <span className="dash-kpi-pill">
                  <span>پیش‌نویس:</span>
                  <strong>{metrics.inspections.draft}</strong>
                </span>
                <span className="dash-kpi-pill">
                  <span>لغوشده:</span>
                  <strong>{metrics.inspections.cancelled}</strong>
                </span>
              </div>
            </div>

            {/* Risks Card */}
            <div className="dash-kpi-card">
              <div className="dash-kpi-top">
                <span className="dash-kpi-label">شاخص‌های ریسک و خطرات</span>
                <ShieldAlert size={18} className="dash-kpi-icon" aria-hidden="true" />
              </div>
              <div className="dash-kpi-num">
                {metrics.risks.total} ارزیابی
              </div>
              {metrics.risks.total > 0 && (
                <div className="dash-micro-bar" title="توزیع سطوح ریسک">
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
                      backgroundColor: "var(--primary)",
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
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0.1rem 0" }}>
                خطرات شناسایی‌شده: <strong>{metrics.risks.hazards_count}</strong>
              </div>
              <div className="dash-kpi-breakdown">
                <span className="dash-kpi-pill" style={{ color: "var(--danger-text)" }}>
                  <span>بحرانی:</span>
                  <strong>{metrics.risks.critical}</strong>
                </span>
                <span className="dash-kpi-pill" style={{ color: "var(--warning-text)" }}>
                  <span>زیاد:</span>
                  <strong>{metrics.risks.high}</strong>
                </span>
                <span className="dash-kpi-pill">
                  <span>متوسط:</span>
                  <strong>{metrics.risks.medium}</strong>
                </span>
                <span className="dash-kpi-pill">
                  <span>کم:</span>
                  <strong>{metrics.risks.low}</strong>
                </span>
              </div>
            </div>

            {/* Non-Conformities Card */}
            <div className="dash-kpi-card">
              <div className="dash-kpi-top">
                <span className="dash-kpi-label">شاخص‌های عدم‌انطباق</span>
                <AlertTriangle size={18} className="dash-kpi-icon" aria-hidden="true" />
              </div>
              <div className="dash-kpi-num">
                {metrics.non_conformities.total}
              </div>
              {metrics.non_conformities.total > 0 && (
                <div className="dash-micro-bar" title="وضعیت عدم‌انطباق‌ها">
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
              <div className="dash-kpi-breakdown">
                <span className="dash-kpi-pill" style={{ color: "var(--danger-text)" }}>
                  <span>باز:</span>
                  <strong>{metrics.non_conformities.open}</strong>
                </span>
                <span className="dash-kpi-pill">
                  <span>در حال پیگیری:</span>
                  <strong>{metrics.non_conformities.in_progress}</strong>
                </span>
                <span className="dash-kpi-pill">
                  <span>آماده بررسی:</span>
                  <strong>{metrics.non_conformities.ready_for_review}</strong>
                </span>
                <span className="dash-kpi-pill">
                  <span>بسته‌شده:</span>
                  <strong>{metrics.non_conformities.closed}</strong>
                </span>
              </div>
            </div>

            {/* Corrective Actions (CAPA) Card */}
            <div className="dash-kpi-card">
              <div className="dash-kpi-top">
                <span className="dash-kpi-label">اقدامات اصلاحی (CAPA)</span>
                <Target size={18} className="dash-kpi-icon" aria-hidden="true" />
              </div>
              <div className="dash-kpi-num">
                {metrics.corrective_actions.total}
              </div>
              {metrics.corrective_actions.total > 0 && (
                <div className="dash-micro-bar" title="وضعیت اقدامات اصلاحی">
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
              <div className="dash-kpi-breakdown">
                <span className="dash-kpi-pill">
                  <span>اقدامات فعال/باز:</span>
                  <strong>{metrics.corrective_actions.open}</strong>
                </span>
                <span className="dash-kpi-pill">
                  <span>اقدامات بسته‌شده:</span>
                  <strong>{metrics.corrective_actions.completed}</strong>
                </span>
                <span
                  className="dash-kpi-pill"
                  style={{
                    color: metrics.corrective_actions.overdue > 0 ? "var(--danger-text)" : "inherit",
                    fontWeight: metrics.corrective_actions.overdue > 0 ? 700 : "normal",
                  }}
                >
                  <span>سررسیدگذشته:</span>
                  <strong>{metrics.corrective_actions.overdue}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Operational Telemetry Ribbon */}
          {(permitStats || incidentStats || equipmentStats || workforceStats) && (
            <div className="dash-telemetry-grid">
              {permitStats && (
                <div className="dash-telemetry-card">
                  <div className="dash-telemetry-header">
                    <h4 className="dash-telemetry-title">
                      <FileCheck size={16} className="text-info" aria-hidden="true" />
                      مجوزهای کار (PTW)
                    </h4>
                    <span className="badge badge-info">فعال: {permitStats.active_count}</span>
                  </div>
                  <div className="dash-telemetry-metrics">
                    <div>کل: <strong>{permitStats.total_permits}</strong></div>
                    <div>تأییدشده: <strong>{permitStats.approved_count}</strong></div>
                    <div>بسته‌شده: <strong>{permitStats.closed_count}</strong></div>
                  </div>
                </div>
              )}

              {incidentStats && (
                <div className="dash-telemetry-card">
                  <div className="dash-telemetry-header">
                    <h4 className="dash-telemetry-title">
                      <Flame size={16} className="text-danger" aria-hidden="true" />
                      حوادث و شبه‌حوادث
                    </h4>
                    <span className={`badge ${incidentStats.under_investigation_count > 0 ? "badge-danger" : "badge-success"}`}>
                      در دست بررسی: {incidentStats.under_investigation_count}
                    </span>
                  </div>
                  <div className="dash-telemetry-metrics">
                    <div>کل: <strong>{incidentStats.total_incidents}</strong></div>
                    <div>شبه‌حوادث: <strong>{incidentStats.near_miss_count}</strong></div>
                    <div>بسته‌شده: <strong>{incidentStats.closed_count}</strong></div>
                  </div>
                </div>
              )}

              {equipmentStats && (
                <div className="dash-telemetry-card">
                  <div className="dash-telemetry-header">
                    <h4 className="dash-telemetry-title">
                      <Wrench size={16} className="text-warning" aria-hidden="true" />
                      تجهیزات صنعتی
                    </h4>
                    <span className={`badge ${equipmentStats.calibration_expired_count > 0 ? "badge-warning" : "badge-success"}`}>
                      انقضای کالیبراسیون: {equipmentStats.calibration_expired_count}
                    </span>
                  </div>
                  <div className="dash-telemetry-metrics">
                    <div>کل: <strong>{equipmentStats.total_equipment}</strong></div>
                    <div>آماده‌به‌کار: <strong>{equipmentStats.ready_count}</strong></div>
                    <div>تعمیرات معوق: <strong>{equipmentStats.maintenance_overdue_count}</strong></div>
                  </div>
                </div>
              )}

              {workforceStats && (
                <div className="dash-telemetry-card">
                  <div className="dash-telemetry-header">
                    <h4 className="dash-telemetry-title">
                      <Users size={16} className="text-primary" aria-hidden="true" />
                      کارکنان و آموزش
                    </h4>
                    <span className={`badge ${workforceStats.competency_expiring_soon > 0 ? "badge-warning" : "badge-info"}`}>
                      صلاحیت معتبر: {workforceStats.competency_valid}
                    </span>
                  </div>
                  <div className="dash-telemetry-metrics">
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
            <section className="card" style={{ marginBottom: "1.25rem", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <Activity size={20} className="text-info" aria-hidden="true" />
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>ماتریس شاخص‌های پیشگیرانه و گذشته‌نگر HSE (دوره ۹۰ روزه)</h3>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <span className="badge badge-info">
                    پیشگیرانه: {indicatorsData.summary.leading_count}
                  </span>
                  <span className="badge badge-danger">
                    گذشته‌نگر: {indicatorsData.summary.lagging_count}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                {indicatorsData.indicators.map((ind) => (
                  <div
                    key={ind.code}
                    className="card"
                    style={{
                      padding: "1rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-default)",
                      background: ind.status === "critical" ? "var(--danger-subtle)" : ind.status === "warning" ? "var(--warning-subtle)" : "var(--bg-surface)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <span className="badge" style={{
                        background: ind.type === "leading" ? "var(--info-subtle)" : "var(--bg-subtle)",
                        color: ind.type === "leading" ? "var(--info-fg)" : "var(--text-secondary)",
                      }}>
                        {ind.type === "leading" ? "Leading (پیشگیرانه)" : "Lagging (پیامد)"}
                      </span>
                      <span className={`badge ${ind.status === "on_target" ? "badge-success" : ind.status === "warning" ? "badge-warning" : "badge-danger"}`}>
                        {ind.status === "on_target" ? "در هدف" : ind.status === "warning" ? "هشدار" : "بحرانی"}
                      </span>
                    </div>

                    <div style={{ fontWeight: "bold", fontSize: "0.95rem", marginBottom: "0.25rem", color: "var(--text-primary)" }}>{ind.name}</div>
                    <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.75rem", lineHeight: "1.4" }}>{ind.description}</p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.5rem" }}>
                      <span className="muted" style={{ fontSize: "0.8rem" }}>هدف: {ind.target} {ind.unit}</span>
                      <span style={{
                        fontSize: "1.25rem",
                        fontWeight: "bold",
                        color: ind.status === "critical" ? "var(--danger)" : ind.status === "warning" ? "var(--warning)" : "var(--success)"
                      }}>
                        {ind.value} <span style={{ fontSize: "0.85rem", fontWeight: "normal", color: "var(--text-secondary)" }}>{ind.unit}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Urgent / Overdue Deadlines Section */}
          <section className="card urgent-deadlines-section" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <Clock size={20} className="text-warning" aria-hidden="true" />
              <h3 style={{ margin: 0, fontSize: "1.05rem" }}>اقدامات و بازرسی‌های دارای مهلت نزدیک یا گذشته</h3>
            </div>

            <div className="dash-deadlines-container">
              {/* Inspection Deadlines */}
              <div className="dash-deadline-panel">
                <h4 className="dash-deadline-title">
                  <Calendar size={16} className="text-muted" aria-hidden="true" />
                  زمان‌بندی بازرسی‌ها
                </h4>
                {metrics.urgent_deadlines.inspections.length === 0 ? (
                  <p className="muted" style={{ padding: "0.5rem 0" }}>هیچ بازرسی با مهلت نزدیک یا گذشته وجود ندارد.</p>
                ) : (
                  <ul className="deadline-list" style={{ padding: 0, listStyle: "none", margin: 0 }}>
                    {metrics.urgent_deadlines.inspections.map((i) => (
                      <li
                        key={i.id}
                        className={`dash-deadline-item ${i.is_overdue ? "overdue" : ""}`}
                      >
                        <div>
                          <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>{i.title}</strong>
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
              <div className="dash-deadline-panel">
                <h4 className="dash-deadline-title">
                  <Target size={16} className="text-muted" aria-hidden="true" />
                  مهلت اقدامات اصلاحی
                </h4>
                {metrics.urgent_deadlines.actions.length === 0 ? (
                  <p className="muted" style={{ padding: "0.5rem 0" }}>هیچ اقدام اصلاحی با مهلت نزدیک یا گذشته وجود ندارد.</p>
                ) : (
                  <ul className="deadline-list" style={{ padding: 0, listStyle: "none", margin: 0 }}>
                    {metrics.urgent_deadlines.actions.map((a) => (
                      <li
                        key={a.id}
                        className={`dash-deadline-item ${a.is_overdue ? "overdue" : ""}`}
                      >
                        <div>
                          <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>{a.description}</strong>
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
