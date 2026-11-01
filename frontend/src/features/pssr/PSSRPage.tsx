import { useEffect, useState } from "react";
import {
  approvePSSRReview,
  createPSSRReview,
  fetchPSSRReviewDetail,
  fetchPSSRReviews,
  fetchPSSRSummary,
  initializePSSRChecklist,
  rejectPSSRReview,
  resolvePSSROutstandingAction,
  updatePSSRChecklistItem,
  type PSSRReview,
} from "../../services/api";
import { CheckSquare, AlertOctagon, Plus } from "lucide-react";

export function PSSRPage() {
  const [reviews, setReviews] = useState<PSSRReview[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [selectedReview, setSelectedReview] = useState<PSSRReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formProject, setFormProject] = useState("");
  const [formType, setFormType] = useState<"new_facility" | "moc" | "major_overhaul" | "restart">("moc");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);

  const loadData = () => {
    setLoading(true);
    Promise.all([fetchPSSRReviews(), fetchPSSRSummary()])
      .then(([revs, sum]) => {
        setReviews(revs);
        setSummary(sum);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "خطا در بارگذاری بررسی‌های ایمنی قبل از راه‌اندازی");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectReview = async (id: number) => {
    try {
      const detail = await fetchPSSRReviewDetail(id);
      setSelectedReview(detail);
    } catch (err: any) {
      setError(err.message || "خطا در دریافت جزئیات PSSR");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPSSRReview({
        organization: 1,
        project_or_system_name: formProject,
        review_type: formType,
        target_startup_date: formDate,
      });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ثبت PSSR");
    }
  };

  const handleInitialize = async (id: number) => {
    try {
      const updated = await initializePSSRChecklist(id);
      setSelectedReview(updated);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ساخت چک‌لیست پیش‌فرض");
    }
  };

  const handleUpdateItem = async (itemId: number, newStatus: string) => {
    if (!selectedReview) return;
    try {
      await updatePSSRChecklistItem(itemId, { status: newStatus });
      handleSelectReview(selectedReview.id);
    } catch (err: any) {
      setError(err.message || "خطا در به‌روزرسانی آیتم چک‌لیست");
    }
  };

  const handleResolveAction = async (actionId: number) => {
    if (!selectedReview) return;
    const notes = prompt("شرح اقدام انجام‌شده و مستندات تاییدیه:");
    if (!notes) return;
    try {
      await resolvePSSROutstandingAction(actionId, { resolution_notes: notes });
      handleSelectReview(selectedReview.id);
    } catch (err: any) {
      setError(err.message || "خطا در بستن اقدام اصلاحی");
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approvePSSRReview(id, "تایید نهایی راه‌اندازی ایمن توسط تیم ممیزی");
      handleSelectReview(id);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در تایید راه‌اندازی");
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("علت عدم تایید و رد درخواست راه‌اندازی:");
    if (!reason) return;
    try {
      await rejectPSSRReview(id, reason);
      handleSelectReview(id);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در رد راه‌اندازی");
    }
  };

  return (
    <div className="card" dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <CheckSquare size={28} color="var(--info)" />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>بررسی ایمنی قبل از راه‌اندازی (PSSR)</h2>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
              مدیریت بازرسی‌های چندتخصصی مکانیک، برق، ابزاردقیق، فرآیند و HSE قبل از استارت خطوط و تجهیزات
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Plus size={18} /> ثبت پرونده PSSR جدید
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "var(--danger-subtle)", color: "var(--danger-fg)", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ padding: "1rem", background: "var(--bg-subtle)", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-tertiary)" }}>کل پرونده‌های PSSR</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{summary.total}</div>
          </div>
          <div style={{ padding: "1rem", background: "var(--success-subtle)", borderRadius: "8px", border: "1px solid var(--success-border)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--success-fg)" }}>مجوز راه‌اندازی صادرشده</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--success)" }}>{summary.approved}</div>
          </div>
          <div style={{ padding: "1rem", background: "var(--warning-subtle)", borderRadius: "8px", border: "1px solid var(--warning-border)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--warning-fg)" }}>در حال بازرسی و تکمیل</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--warning)" }}>{summary.in_progress}</div>
          </div>
        </div>
      )}

      {/* Reviews Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>در حال بارگذاری پرونده‌ها...</div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>هیچ پرونده PSSR ثبت نشده است.</div>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", borderBottom: "2px solid var(--border-strong)" }}>
                <th style={{ padding: "0.75rem" }}>شماره پرونده</th>
                <th style={{ padding: "0.75rem" }}>پروژه / سیستم</th>
                <th style={{ padding: "0.75rem" }}>نوع بازنگری</th>
                <th style={{ padding: "0.75rem" }}>تاریخ هدف راه‌اندازی</th>
                <th style={{ padding: "0.75rem" }}>وضعیت</th>
                <th style={{ padding: "0.75rem" }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border-default)", background: selectedReview?.id === r.id ? "var(--info-subtle)" : "transparent" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{r.pssr_number}</td>
                  <td style={{ padding: "0.75rem" }}>{r.project_or_system_name}</td>
                  <td style={{ padding: "0.75rem" }}>{r.review_type_display || r.review_type}</td>
                  <td style={{ padding: "0.75rem" }}>{r.target_startup_date}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      background: r.status === "approved" ? "var(--success-subtle)" : r.status === "rejected" ? "var(--danger-subtle)" : "var(--warning-subtle)",
                      color: r.status === "approved" ? "var(--success-fg)" : r.status === "rejected" ? "var(--danger-fg)" : "var(--warning-fg)",
                    }}>
                      {r.status_display || r.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <button className="btn btn-primary" style={{ padding: "0.3rem 0.6rem" }} onClick={() => handleSelectReview(r.id)}>
                      بررسی چک‌لیست
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected PSSR Detail & Checklist Review */}
      {selectedReview && (
        <div style={{ marginTop: "2rem", borderTop: "2px solid var(--border-default)", paddingTop: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ margin: "0 0 0.25rem" }}>
                چک‌لیست تخصصی راه‌اندازی: {selectedReview.pssr_number} ({selectedReview.project_or_system_name})
              </h3>
              <span style={{ fontSize: "0.85rem", color: "var(--text-tertiary)" }}>
                وضعیت: <strong>{selectedReview.status_display || selectedReview.status}</strong>
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(!selectedReview.checklist_items || selectedReview.checklist_items.length === 0) && (
                <button className="btn btn-secondary" onClick={() => handleInitialize(selectedReview.id)}>
                  تولید چک‌لیست پیش‌فرض چندتخصصی
                </button>
              )}
              {selectedReview.status !== "approved" && (
                <>
                  <button className="btn btn-primary" style={{ background: "var(--success)" }} onClick={() => handleApprove(selectedReview.id)}>
                    تایید نهایی و صدور مجوز راه‌اندازی
                  </button>
                  <button className="btn btn-secondary" style={{ color: "var(--danger)" }} onClick={() => handleReject(selectedReview.id)}>
                    رد درخواست راه‌اندازی
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Checklist Items */}
          {selectedReview.checklist_items && selectedReview.checklist_items.length > 0 ? (
            <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-strong)" }}>
                    <th style={{ padding: "0.6rem" }}>دیسیپلین</th>
                    <th style={{ padding: "0.6rem" }}>موضوع و بند کنترلی</th>
                    <th style={{ padding: "0.6rem" }}>درجه اهمیت</th>
                    <th style={{ padding: "0.6rem" }}>وضعیت انطباق</th>
                    <th style={{ padding: "0.6rem" }}>اقدام</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReview.checklist_items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "0.6rem", fontWeight: "bold" }}>{item.discipline}</td>
                      <td style={{ padding: "0.6rem" }}>{item.item_text}</td>
                      <td style={{ padding: "0.6rem" }}>
                        {item.is_critical ? (
                          <span style={{ color: "var(--danger)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <AlertOctagon size={14} /> بحرانی (مانع استارت)
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)" }}>عادی</span>
                        )}
                      </td>
                      <td style={{ padding: "0.6rem" }}>
                        <span style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          background: item.status === "compliant" ? "var(--success-subtle)" : item.status === "non_compliant" ? "var(--danger-subtle)" : "var(--bg-subtle)",
                          color: item.status === "compliant" ? "var(--success-fg)" : item.status === "non_compliant" ? "var(--danger-fg)" : "var(--text-secondary)",
                        }}>
                          {item.status === "compliant" ? "منطبق و ایمن" : item.status === "non_compliant" ? "عدم انطباق" : "در انتظار بررسی"}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem" }}>
                        {selectedReview.status !== "approved" && (
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "0.2rem 0.5rem", color: "var(--success)" }}
                              onClick={() => handleUpdateItem(item.id, "compliant")}
                            >
                              تایید
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "0.2rem 0.5rem", color: "var(--danger)" }}
                              onClick={() => handleUpdateItem(item.id, "non_compliant")}
                            >
                              نقص
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "1.5rem", background: "var(--bg-subtle)", borderRadius: "6px", textAlign: "center", color: "var(--text-tertiary)" }}>
              چک‌لیستی برای این پرونده ایجاد نشده است. روی دکمه «تولید چک‌لیست پیش‌فرض چندتخصصی» کلیک کنید.
            </div>
          )}

          {/* Outstanding Actions */}
          {selectedReview.outstanding_actions && selectedReview.outstanding_actions.length > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", color: "var(--danger)" }}>اقدامات معوق و نواقص باز قبل از راه‌اندازی (Outstanding Actions)</h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                  <thead>
                    <tr style={{ background: "var(--danger-subtle)" }}>
                      <th style={{ padding: "0.5rem" }}>شرح نقص</th>
                      <th style={{ padding: "0.5rem" }}>مسئول رفع</th>
                      <th style={{ padding: "0.5rem" }}>مهلت</th>
                      <th style={{ padding: "0.5rem" }}>وضعیت</th>
                      <th style={{ padding: "0.5rem" }}>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReview.outstanding_actions.map((act) => (
                      <tr key={act.id} style={{ borderBottom: "1px solid var(--danger-subtle)" }}>
                        <td style={{ padding: "0.5rem" }}>{act.description}</td>
                        <td style={{ padding: "0.5rem" }}>{act.responsible_party}</td>
                        <td style={{ padding: "0.5rem" }}>{act.target_date}</td>
                        <td style={{ padding: "0.5rem" }}>{act.status}</td>
                        <td style={{ padding: "0.5rem" }}>
                          {act.status !== "resolved" && (
                            <button className="btn btn-primary" style={{ padding: "0.2rem 0.5rem" }} onClick={() => handleResolveAction(act.id)}>
                              ثبت رفع نقص
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create PSSR */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "500px", width: "90%" }}>
            <h3 style={{ margin: "0 0 1rem" }}>تشکیل پرونده PSSR جدید</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">نام پروژه / سیستم / خط تولید</label>
                <input type="text" className="form-input" value={formProject} onChange={(e) => setFormProject(e.target.value)} required />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">نوع بازنگری (Review Type)</label>
                <select className="form-input" value={formType} onChange={(e: any) => setFormType(e.target.value)}>
                  <option value="new_facility">تاسیسات و خطوط جدید (New Facility)</option>
                  <option value="moc">مدیریت تغییرات فرآیندی / مهندسی (MOC)</option>
                  <option value="major_overhaul">اورهال اساسی و تعمیرات اساسی (Overhaul)</option>
                  <option value="restart">راه‌اندازی مجدد پس از توقف اضطراری (Restart)</option>
                </select>
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-label">تاریخ هدف استارت و راه‌اندازی</label>
                <input type="date" className="form-input" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary">ثبت پرونده</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
