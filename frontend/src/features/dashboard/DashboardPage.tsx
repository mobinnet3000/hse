import { useEffect, useState } from "react";
import {
  fetchDashboardMetrics,
  type DashboardMetrics,
  type Organization,
  fetchOrganizations,
} from "../../services/api";

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
    fetchDashboardMetrics(organizationId, controller.signal)
      .then(setMetrics)
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [organizationId]);

  return (
    <div className="dashboard-page stack" dir="rtl">
      <header className="page-header">
        <h2>داشبورد مدیریتی HSE</h2>
      </header>

      <section className="card">
        <div className="toolbar" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <label htmlFor="dash-org"><strong>سازمان:</strong></label>
          <select
            id="dash-org"
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
      </section>

      {loading && !metrics && <p className="muted">در حال بارگذاری شاخص‌های داشبورد…</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {metrics && (
        <>
          <div
            className="metrics-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Inspections Card */}
            <div className="card">
              <h3>آمار و وضعیت بازرسی‌ها</h3>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.5rem 0" }}>
                {metrics.inspections.total}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <li>در حال اجرا: <strong>{metrics.inspections.in_progress}</strong></li>
                <li>پایان‌یافته: <strong>{metrics.inspections.completed}</strong></li>
                <li>پیش‌نویس: <strong>{metrics.inspections.draft}</strong></li>
                <li>لغوشده: <strong>{metrics.inspections.cancelled}</strong></li>
              </ul>
            </div>

            {/* Risks Card */}
            <div className="card">
              <h3>شاخص‌های ریسک و خطرات</h3>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.5rem 0" }}>
                {metrics.risks.total} ارزیابی
              </p>
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                خطرات شناسایی‌شده: <strong>{metrics.risks.hazards_count}</strong>
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <li style={{ color: "#d9534f" }}>بحرانی: <strong>{metrics.risks.critical}</strong></li>
                <li style={{ color: "#f0ad4e" }}>زیاد: <strong>{metrics.risks.high}</strong></li>
                <li>متوسط: <strong>{metrics.risks.medium}</strong></li>
                <li>کم: <strong>{metrics.risks.low}</strong></li>
              </ul>
            </div>

            {/* Non-Conformities Card */}
            <div className="card">
              <h3>شاخص‌های عدم‌انطباق</h3>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.5rem 0" }}>
                {metrics.non_conformities.total}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <li>باز: <strong>{metrics.non_conformities.open}</strong></li>
                <li>در حال پیگیری: <strong>{metrics.non_conformities.in_progress}</strong></li>
                <li>آماده بررسی: <strong>{metrics.non_conformities.ready_for_review}</strong></li>
                <li>بسته‌شده: <strong>{metrics.non_conformities.closed}</strong></li>
              </ul>
            </div>

            {/* Corrective Actions Card */}
            <div className="card">
              <h3>اقدامات اصلاحی (CAPA)</h3>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.5rem 0" }}>
                {metrics.corrective_actions.total}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <li>اقدامات فعال/باز: <strong>{metrics.corrective_actions.open}</strong></li>
                <li>اقدامات بسته‌شده: <strong>{metrics.corrective_actions.completed}</strong></li>
                <li style={{ color: metrics.corrective_actions.overdue > 0 ? "#d9534f" : "inherit" }}>
                  سررسیدگذشته: <strong>{metrics.corrective_actions.overdue}</strong>
                </li>
              </ul>
            </div>
          </div>

          {/* Urgent / Overdue Deadlines Section */}
          <section className="card">
            <h3>اقدامات و بازرسی‌های دارای مهلت نزدیک یا گذشته</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "1.5rem",
                marginTop: "1rem",
              }}
            >
              <div>
                <h4>زمان‌بندی بازرسی‌ها</h4>
                {metrics.urgent_deadlines.inspections.length === 0 ? (
                  <p className="muted">هیچ بازرسی با مهلت نزدیک یا گذشته وجود ندارد.</p>
                ) : (
                  <ul style={{ paddingRight: "1.2rem" }}>
                    {metrics.urgent_deadlines.inspections.map((i) => (
                      <li key={i.id} style={{ marginBottom: "0.4rem" }}>
                        <strong>{i.title}</strong> — {i.scheduled_at?.split("T")[0] || "بی‌تاریخ"}{" "}
                        <span className="badge">({INSPECTION_STATUS_LABELS[i.status] ?? i.status})</span>
                        {i.is_overdue && (
                          <span style={{ color: "#d9534f", marginRight: "0.5rem", fontWeight: "bold" }}>
                            [سررسید گذشته]
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4>مهلت اقدامات اصلاحی</h4>
                {metrics.urgent_deadlines.actions.length === 0 ? (
                  <p className="muted">هیچ اقدام اصلاحی با مهلت نزدیک یا گذشته وجود ندارد.</p>
                ) : (
                  <ul style={{ paddingRight: "1.2rem" }}>
                    {metrics.urgent_deadlines.actions.map((a) => (
                      <li key={a.id} style={{ marginBottom: "0.4rem" }}>
                        <strong>{a.description}</strong> — {a.due_date || "بی‌تاریخ"}{" "}
                        <span className="badge">({ACTION_STATUS_LABELS[a.status] ?? a.status})</span>
                        {a.is_overdue && (
                          <span style={{ color: "#d9534f", marginRight: "0.5rem", fontWeight: "bold" }}>
                            [سررسید گذشته]
                          </span>
                        )}
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
