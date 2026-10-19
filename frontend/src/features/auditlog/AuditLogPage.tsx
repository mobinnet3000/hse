import { useEffect, useState } from "react";
import {
  fetchAuditEvents,
  fetchOrganizations,
  type AuditEventItem,
  type Organization,
} from "../../services/api";

const ACTION_LABELS: Record<string, string> = {
  "risk.create": "ثبت خطر",
  "risk.update": "ویرایش خطر",
  "risk.assessment": "ثبت ارزیابی ریسک",
  "risk.approve": "تأیید ارزیابی ریسک",
  "inspection.create": "ایجاد بازرسی",
  "inspection.start": "شروع بازرسی",
  "inspection.complete": "تکمیل بازرسی",
  "nonconformity.create": "ثبت عدم‌انطباق",
  "nonconformity.close": "بستن عدم‌انطباق",
  "correctiveaction.create": "ثبت اقدام اصلاحی",
  "correctiveaction.update": "ویرایش اقدام اصلاحی",
  "correctiveaction.verify": "تأیید اثربخشی اقدام",
};

export function AuditLogPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(controller.signal)
      .then((items) => {
        setOrganizations(items);
        if (items.length > 0) {
          setOrganizationId(items[0].id);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (organizationId === null) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchAuditEvents(organizationId, controller.signal)
      .then(setEvents)
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [organizationId]);

  const filtered = events.filter((ev) => {
    if (actionFilter && ev.action !== actionFilter) return false;
    if (entityFilter && ev.entity_type !== entityFilter) return false;
    return true;
  });

  return (
    <div className="audit-log-page stack" dir="rtl">
      <header className="page-header">
        <h2>گزارش حسابرسی رخدادها (Audit Log)</h2>
        <p className="muted">
          مشاهده سوابق تغییرات و عملیات حساس سیستم (ویژه مدیران، مدیران HSE و حسابرسان)
        </p>
      </header>

      <section className="card">
        <div
          className="toolbar-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <div>
            <label htmlFor="audit-org">سازمان</label>
            <select
              id="audit-org"
              value={organizationId ?? ""}
              onChange={(e) => setOrganizationId(Number(e.target.value))}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-action">نوع عملیات</label>
            <select
              id="audit-action"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">همه عملیات</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} ({k})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-entity">نوع موجودیت</label>
            <select
              id="audit-entity"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              <option value="">همه موجودیت‌ها</option>
              <option value="risk">خطر / ریسک</option>
              <option value="inspection">بازرسی</option>
              <option value="nonconformity">عدم‌انطباق</option>
              <option value="correctiveaction">اقدام اصلاحی</option>
            </select>
          </div>
        </div>
      </section>

      {loading && <p className="muted">در حال بارگذاری گزارش حسابرسی…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <p className="muted">رخدادی برای نمایش یافت نشد.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <section className="card" style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ccc", textAlign: "right" }}>
                <th style={{ padding: "0.5rem" }}>شناسه</th>
                <th style={{ padding: "0.5rem" }}>زمان</th>
                <th style={{ padding: "0.5rem" }}>کاربر (عامل)</th>
                <th style={{ padding: "0.5rem" }}>عملیات</th>
                <th style={{ padding: "0.5rem" }}>موجودیت</th>
                <th style={{ padding: "0.5rem" }}>شناسه موجودیت</th>
                <th style={{ padding: "0.5rem" }}>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => (
                <tr key={ev.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem" }}>{ev.id}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                    {ev.created_at ? ev.created_at.replace("T", " ").substring(0, 16) : ""}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {ev.actor_username || "سیستم"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <span className="badge">
                      {ACTION_LABELS[ev.action] ?? ev.action}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{ev.entity_type}</td>
                  <td style={{ padding: "0.5rem" }}>{ev.entity_id ?? "—"}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                    {ev.details && Object.keys(ev.details).length > 0
                      ? JSON.stringify(ev.details)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
