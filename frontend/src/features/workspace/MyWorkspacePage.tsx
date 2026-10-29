import { useEffect, useState } from "react";
import {
  fetchPersonalWorkspace,
  type PersonalWorkspaceResponse,
} from "../../services/api";
import { UserCheck, CheckCircle2, AlertTriangle, Bell, Clock } from "lucide-react";

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
    <div className="card" dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <UserCheck size={28} color="#2563eb" />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>کارتابل شخصی و وظایف من (My Workspace)</h2>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
              وظایف اختصاص‌یافته، تاییدهای در انتظار امضا، اقدامات اصلاحی معوق و پیام‌های جدید
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>در حال بارگذاری کارتابل...</div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>اطلاعاتی یافت نشد.</div>
      ) : (
        <div>
          {/* Top KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ padding: "1rem", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#1e40af" }}>مجوزها و طرح‌های در انتظار تایید</span>
                <Clock size={20} color="#2563eb" />
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#1d4ed8", marginTop: "0.25rem" }}>
                {data.pending_approvals?.total ?? 0}
              </div>
            </div>

            <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#475569" }}>اقدامات اصلاحی محوله به من</span>
                <CheckCircle2 size={20} color="#16a34a" />
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#0f172a", marginTop: "0.25rem" }}>
                {data.my_tasks?.actions?.length ?? 0}
              </div>
            </div>

            <div style={{ padding: "1rem", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#991b1b" }}>اقدامات دارای تأخیر (Overdue)</span>
                <AlertTriangle size={20} color="#dc2626" />
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#dc2626", marginTop: "0.25rem" }}>
                {data.my_tasks?.actions?.filter((a) => a.is_overdue).length ?? 0}
              </div>
            </div>

            <div style={{ padding: "1rem", background: "#fdf4ff", borderRadius: "8px", border: "1px solid #f0abfc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#86198f" }}>اعلان‌ها و پیام‌های خوانده‌نشده</span>
                <Bell size={20} color="#c026d3" />
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#a21caf", marginTop: "0.25rem" }}>
                {(data.unread_counts?.notifications || 0) + (data.unread_counts?.messages || 0)}
              </div>
            </div>
          </div>

          {/* Pending Approvals Section */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={20} color="#ea580c" />
              پرونده‌های منتظر تایید و امضای شما
            </h3>
            {(data.pending_approvals?.total ?? 0) === 0 ? (
              <div style={{ padding: "1.5rem", background: "#f8fafc", borderRadius: "6px", textAlign: "center", color: "#64748b" }}>
                هیچ مجوزی در انتظار تایید شما نیست.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {(data.pending_approvals?.permits || []).map((p) => (
                  <div key={p.id} style={{ padding: "0.75rem 1rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>مجوز کار ({p.permit_type}): {p.reference_code}</strong> - {p.title}
                    </div>
                    <span style={{ fontSize: "0.85rem", color: "#92400e" }}>ارائه‌شده جهت بررسی</span>
                  </div>
                ))}
                {(data.pending_approvals?.lifting_plans || []).map((l) => (
                  <div key={l.id} style={{ padding: "0.75rem 1rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>طرح باربرداری ({l.category}): {l.plan_number}</strong> - {l.title}
                    </div>
                    <span style={{ fontSize: "0.85rem", color: "#1e40af" }}>در انتظار تایید سرپرست باربرداری</span>
                  </div>
                ))}
                {(data.pending_approvals?.pssr_reviews || []).map((ps) => (
                  <div key={ps.id} style={{ padding: "0.75rem 1rem", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>پرونده راه‌اندازی (PSSR): {ps.pssr_number}</strong> - {ps.project_or_system_name}
                    </div>
                    <span style={{ fontSize: "0.85rem", color: "#6b21a8" }}>موعد استارت: {ps.target_startup_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Tasks & Actions Section */}
          <div>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle2 size={20} color="#16a34a" />
              اقدامات اصلاحی و بازرسی‌های محوله
            </h3>
            {(data.my_tasks?.actions || []).length === 0 ? (
              <div style={{ padding: "1.5rem", background: "#f8fafc", borderRadius: "6px", textAlign: "center", color: "#64748b" }}>
                هیچ اقدام باز یا معوقی به شما ارجاع داده نشده است.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "0.6rem" }}>شرح اقدام اصلاحی</th>
                      <th style={{ padding: "0.6rem" }}>مهلت انجام</th>
                      <th style={{ padding: "0.6rem" }}>وضعیت</th>
                      <th style={{ padding: "0.6rem" }}>هشدار سررسید</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.my_tasks?.actions || []).map((act) => (
                      <tr key={act.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "0.6rem" }}>{act.description}</td>
                        <td style={{ padding: "0.6rem" }}>{act.due_date || "نامشخص"}</td>
                        <td style={{ padding: "0.6rem" }}>{act.status}</td>
                        <td style={{ padding: "0.6rem" }}>
                          {act.is_overdue ? (
                            <span style={{ color: "#dc2626", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <AlertTriangle size={14} /> مهلت منقضی شده!
                            </span>
                          ) : (
                            <span style={{ color: "#16a34a" }}>در مهلت مجاز</span>
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
