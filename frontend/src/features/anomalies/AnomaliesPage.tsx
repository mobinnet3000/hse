import { useEffect, useState } from "react";
import {
  closeAnomaly,
  createAnomaly,
  fetchAnomalies,
  reopenAnomaly,
  type NonConformity,
} from "../../services/api";
import { AlertCircle, RotateCcw, Plus } from "lucide-react";

export function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<NonConformity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<any>("unsafe_act");
  const [formSeverity, setFormSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [formPriority, setFormPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [formReporter, setFormReporter] = useState("");
  const [formContainment, setFormContainment] = useState("");
  const [formDeadline, setFormDeadline] = useState(new Date().toISOString().split("T")[0]);

  const loadData = () => {
    setLoading(true);
    const params: Record<string, any> = {};
    if (typeFilter !== "all") params.anomaly_type = typeFilter;
    if (statusFilter !== "all") params.status = statusFilter;

    fetchAnomalies(params)
      .then((data) => {
        setAnomalies(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "خطا در دریافت گزارش‌های ناهنجاری و عدم‌انطباق");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [typeFilter, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAnomaly({
        organization: 1,
        description: formDesc,
        anomaly_type: formType,
        severity: formSeverity,
        priority: formPriority,
        reporter_name: formReporter,
        immediate_containment: formContainment,
        target_deadline: formDeadline,
      });
      setShowCreateModal(false);
      setFormDesc("");
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ثبت ناهنجاری");
    }
  };

  const handleClose = async (id: number) => {
    const notes = prompt("شرح اقدامات انجام‌شده و تاییدیه رفع:");
    if (!notes) return;
    try {
      await closeAnomaly(id, { closure_notes: notes });
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در بستن پرونده (مطمئن شوید اقدامات اصلاحی مربوطه تکمیل شده‌اند)");
    }
  };

  const handleReopen = async (id: number) => {
    const reason = prompt("علت بازگشایی مجدد پرونده ناهنجاری:");
    if (!reason) return;
    try {
      await reopenAnomaly(id, { reopened_reason: reason });
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در بازگشایی مجدد");
    }
  };

  return (
    <div className="card" dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <AlertCircle size={28} color="var(--info)" />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>مدیریت یکپارچه ناهنجاری‌ها و مشاهدات ناایمن</h2>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
              ثبت و پیگیری اعمال ناایمن، شرایط ناایمن، شبه‌حوادث، انحرافات پیمانکار و نقایص تجهیزاتی
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Plus size={18} /> ثبت مشاهده / ناهنجاری جدید
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "var(--danger-subtle)", color: "var(--danger-fg)", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginLeft: "0.5rem" }}>نوع ناهنجاری:</label>
          <select className="form-input" style={{ width: "220px", display: "inline-block" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">همه انواع</option>
            <option value="unsafe_act">عمل ناایمن (Unsafe Act)</option>
            <option value="unsafe_condition">شرایط ناایمن (Unsafe Condition)</option>
            <option value="near_miss">شبه‌حادثه (Near Miss)</option>
            <option value="contractor_deviation">انحراف پیمانکار (Contractor)</option>
            <option value="equipment_defect">نقص فنی تجهیز (Equipment Defect)</option>
            <option value="environmental_deviation">انحراف زیست‌محیطی</option>
            <option value="procedural_violation">نقض رویه و دستورالعمل</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginLeft: "0.5rem" }}>وضعیت:</label>
          <select className="form-input" style={{ width: "160px", display: "inline-block" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">همه وضعیت‌ها</option>
            <option value="open">باز (Open)</option>
            <option value="in_progress">در حال رسیدگی</option>
            <option value="ready_for_review">آماده بررسی و بستن</option>
            <option value="closed">بسته‌شده (Closed)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>در حال بارگذاری مشاهدات...</div>
      ) : anomalies.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>هیچ موردی با فیلترهای انتخابی یافت نشد.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", borderBottom: "2px solid var(--border-strong)" }}>
                <th style={{ padding: "0.75rem" }}>کد پیگیری</th>
                <th style={{ padding: "0.75rem" }}>نوع ناهنجاری</th>
                <th style={{ padding: "0.75rem" }}>شرح مشاهده</th>
                <th style={{ padding: "0.75rem" }}>مهار فوری صحنه</th>
                <th style={{ padding: "0.75rem" }}>شدت / اولویت</th>
                <th style={{ padding: "0.75rem" }}>گزارش‌دهنده</th>
                <th style={{ padding: "0.75rem" }}>وضعیت</th>
                <th style={{ padding: "0.75rem" }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{a.reference_number}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: "12px",
                      fontSize: "0.8rem",
                      background: a.anomaly_type === "unsafe_act" ? "var(--danger-subtle)" : "var(--info-subtle)",
                      color: a.anomaly_type === "unsafe_act" ? "var(--danger-fg)" : "var(--info-fg)",
                    }}>
                      {a.anomaly_type_display || a.anomaly_type}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem", maxWidth: "250px" }}>{a.description}</td>
                  <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "var(--success-fg)" }}>
                    {a.immediate_containment || "—"}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      background: a.severity === "critical" ? "var(--danger)" : a.severity === "high" ? "var(--warning)" : "var(--warning-subtle)",
                      color: a.severity === "critical" || a.severity === "high" ? "var(--text-inverse)" : "var(--warning-fg)",
                      fontWeight: "bold",
                    }}>
                      {a.severity} / {a.priority}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>{a.reporter_name || "نامشخص"}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      background: a.status === "closed" ? "var(--success-subtle)" : "var(--danger-subtle)",
                      color: a.status === "closed" ? "var(--success-fg)" : "var(--danger-fg)",
                    }}>
                      {a.status_display || a.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      {a.status !== "closed" ? (
                        <button className="btn btn-primary" style={{ padding: "0.3rem 0.6rem", background: "var(--success)" }} onClick={() => handleClose(a.id)}>
                          بستن
                        </button>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: "0.3rem 0.6rem" }} onClick={() => handleReopen(a.id)} title="بازگشایی مجدد">
                          <RotateCcw size={14} /> بازگشایی
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

      {/* Modal: Create Anomaly */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "600px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 1rem" }}>ثبت گزارش مشاهده ناایمن / ناهنجاری</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">نوع رویداد یا مشاهده</label>
                <select className="form-input" value={formType} onChange={(e: any) => setFormType(e.target.value)}>
                  <option value="unsafe_act">عمل ناایمن (Unsafe Act) - رفتار خطرناک فردی</option>
                  <option value="unsafe_condition">شرایط ناایمن (Unsafe Condition) - نقص در محیط فیزیکی</option>
                  <option value="near_miss">شبه‌حادثه (Near Miss) - رویداد بدون آسیب</option>
                  <option value="contractor_deviation">انحراف ایمنی پیمانکار (Contractor Deviation)</option>
                  <option value="equipment_defect">نقص و خرابی تجهیز (Equipment Defect)</option>
                  <option value="environmental_deviation">انحراف زیست‌محیطی (نشتی، پساب، آلودگی)</option>
                  <option value="procedural_violation">نقض دستورالعمل و روش اجرایی مصوب</option>
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">شرح دقیق واقعه و محل مشاهده</label>
                <textarea className="form-input" rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} required />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">اقدام فوری کنترلی در صحنه (Immediate Containment)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formContainment}
                  onChange={(e) => setFormContainment(e.target.value)}
                  placeholder="مثال: توقف کار، محصور کردن منطقه با نوار خطر"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">شدت پیامد احتمالی</label>
                  <select className="form-input" value={formSeverity} onChange={(e: any) => setFormSeverity(e.target.value)}>
                    <option value="low">کم (Low)</option>
                    <option value="medium">متوسط (Medium)</option>
                    <option value="high">زیاد (High)</option>
                    <option value="critical">بحرانی (Critical)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">اولویت رسیدگی</label>
                  <select className="form-input" value={formPriority} onChange={(e: any) => setFormPriority(e.target.value)}>
                    <option value="low">عادی / کم</option>
                    <option value="medium">متوسط</option>
                    <option value="high">بالا / فوری</option>
                    <option value="urgent">اضطراری و بحرانی</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label className="form-label">نام گزارش‌دهنده</label>
                  <input type="text" className="form-input" value={formReporter} onChange={(e) => setFormReporter(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">مهلت رفع و اقدام اصلاحی</label>
                  <input type="date" className="form-input" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary">ثبت ناهنجاری</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
