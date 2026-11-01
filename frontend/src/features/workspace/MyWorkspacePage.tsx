import { useEffect, useState } from "react";
import {
  fetchPersonalWorkspace,
  type PersonalWorkspaceResponse,
} from "../../services/api";
import { UserCheck, CheckCircle2, AlertTriangle, Bell, Clock, FileCheck } from "lucide-react";

export function MyWorkspacePage() {
  const [data, setData] = useState<PersonalWorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    fetchPersonalWorkspace()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "خطا در دریافت اطلاعات کارتابل شخصی");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="workspace-page stack" dir="rtl">
      {/* Header Card */}
      <div className="card toolbar-card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--info-subtle)",
              color: "var(--info)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <UserCheck size={26} aria-hidden="true" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>کارتابل شخصی و وظایف من (My Workspace)</h2>
              <p className="muted" style={{ margin: "0.3rem 0 0", fontSize: "0.875rem" }}>
                وظایف اختصاص‌یافته، تاییدیه‌های در انتظار امضا، اقدامات اصلاحی و اعلان‌های سیستمی
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1.5rem" }}>
          <AlertTriangle size={18} aria-hidden="true" />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }} aria-hidden="true" />
          <p className="muted">در حال بارگذاری اطلاعات کارتابل شخصی…</p>
        </div>
      ) : !data ? (
        <div className="card empty-state">
          <p className="empty-state-title">اطلاعاتی یافت نشد</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Top KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
            {/* Pending Approvals */}
            <div className="card stat-mini-card" style={{
              borderLeft: "4px solid var(--info)",
              padding: "1.25rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>مجوزها و طرح‌های منتظر تایید</span>
                <Clock size={20} className="text-info" />
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 900, color: "var(--info)", marginTop: "0.4rem" }}>
                {data.pending_approvals?.total ?? 0}
              </div>
            </div>

            {/* Assigned Actions */}
            <div className="card stat-mini-card" style={{
              borderLeft: "4px solid var(--primary)",
              padding: "1.25rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>اقدامات اصلاحی محوله</span>
                <CheckCircle2 size={20} className="text-primary" />
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 900, color: "var(--text-primary)", marginTop: "0.4rem" }}>
                {data.my_tasks?.actions?.length ?? 0}
              </div>
            </div>

            {/* Overdue Actions */}
            <div className="card stat-mini-card" style={{
              borderLeft: "4px solid var(--danger)",
              padding: "1.25rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>اقدامات دارای تأخیر (Overdue)</span>
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 900, color: "var(--danger)", marginTop: "0.4rem" }}>
                {data.my_tasks?.actions?.filter((a) => a.is_overdue).length ?? 0}
              </div>
            </div>

            {/* Unread Counts */}
            <div className="card stat-mini-card" style={{
              borderLeft: "4px solid var(--warning)",
              padding: "1.25rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>اعلان‌ها و پیام‌های جدید</span>
                <Bell size={20} className="text-warning" />
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 900, color: "var(--warning)", marginTop: "0.4rem" }}>
                {(data.unread_counts?.notifications || 0) + (data.unread_counts?.messages || 0)}
              </div>
            </div>
          </div>

          {/* Pending Approvals Section */}
          <div className="card">
            <h3 style={{ margin: "0 0 1.25rem", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={20} className="text-warning" />
              پرونده‌های منتظر تایید و امضای شما
            </h3>
            {(data.pending_approvals?.total ?? 0) === 0 ? (
              <div className="empty-state" style={{ padding: "2rem" }}>
                <FileCheck size={36} className="empty-state-icon" style={{ opacity: 0.5 }} />
                <p className="empty-state-title" style={{ fontSize: "1rem" }}>هیچ مجوزی در انتظار تایید شما نیست</p>
                <p className="empty-state-desc" style={{ marginBottom: 0 }}>کلیه بررسی‌های ارجاعی در وضعیت به‌روز هستند.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {(data.pending_approvals?.permits || []).map((p) => (
                  <div key={p.id} style={{
                    padding: "0.85rem 1.25rem",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem"
                  }}>
                    <div>
                      <strong style={{ color: "var(--text-primary)" }}>مجوز کار ({p.permit_type}): {p.reference_code}</strong>
                      <span className="muted" style={{ marginRight: "0.5rem" }}>— {p.title}</span>
                    </div>
                    <span className="badge badge-warning">ارائه‌شده جهت بررسی</span>
                  </div>
                ))}
                {(data.pending_approvals?.lifting_plans || []).map((l) => (
                  <div key={l.id} style={{
                    padding: "0.85rem 1.25rem",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem"
                  }}>
                    <div>
                      <strong style={{ color: "var(--text-primary)" }}>طرح باربرداری ({l.category}): {l.plan_number}</strong>
                      <span className="muted" style={{ marginRight: "0.5rem" }}>— {l.title}</span>
                    </div>
                    <span className="badge badge-info">در انتظار تایید سرپرست باربرداری</span>
                  </div>
                ))}
                {(data.pending_approvals?.pssr_reviews || []).map((ps) => (
                  <div key={ps.id} style={{
                    padding: "0.85rem 1.25rem",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem"
                  }}>
                    <div>
                      <strong style={{ color: "var(--text-primary)" }}>پرونده راه‌اندازی (PSSR): {ps.pssr_number}</strong>
                      <span className="muted" style={{ marginRight: "0.5rem" }}>— {ps.project_or_system_name}</span>
                    </div>
                    <span className="badge badge-primary">موعد استارت: {ps.target_startup_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Tasks & Actions Section */}
          <div className="card">
            <h3 style={{ margin: "0 0 1.25rem", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle2 size={20} className="text-primary" />
              اقدامات اصلاحی و بازرسی‌های محوله
            </h3>
            {(data.my_tasks?.actions || []).length === 0 ? (
              <div className="empty-state" style={{ padding: "2rem" }}>
                <CheckCircle2 size={36} className="empty-state-icon" style={{ opacity: 0.5 }} />
                <p className="empty-state-title" style={{ fontSize: "1rem" }}>هیچ اقدام باز یا معوقی وجود ندارد</p>
                <p className="empty-state-desc" style={{ marginBottom: 0 }}>تمامی اقدامات محوله با موفقیت انجام یا بسته شده‌اند.</p>
              </div>
            ) : (
              <div className="table-container" style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "0.75rem 1rem" }}>شرح اقدام اصلاحی</th>
                      <th style={{ padding: "0.75rem 1rem" }}>مهلت انجام</th>
                      <th style={{ padding: "0.75rem 1rem" }}>وضعیت</th>
                      <th style={{ padding: "0.75rem 1rem" }}>هشدار سررسید</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.my_tasks?.actions || []).map((act) => (
                      <tr key={act.id}>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{act.description}</td>
                        <td style={{ padding: "0.75rem 1rem" }} className="muted">{act.due_date || "نامشخص"}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span className="badge">{act.status}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          {act.is_overdue ? (
                            <span style={{ color: "var(--danger)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <AlertTriangle size={15} /> مهلت منقضی شده!
                            </span>
                          ) : (
                            <span style={{ color: "var(--success)", fontWeight: 600 }}>در مهلت مجاز</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
