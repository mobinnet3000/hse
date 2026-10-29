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
          <CheckSquare size={28} color="#2563eb" />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>بررسی ایمنی قبل از راه‌اندازی (PSSR)</h2>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
              مدیریت بازرسی‌های چندتخصصی مکانیک، برق، ابزاردقیق، فرآیند و HSE قبل از استارت خطوط و تجهیزات
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Plus size={18} /> ثبت پرونده PSSR جدید
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>کل پرونده‌های PSSR</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{summary.total}</div>
          </div>
          <div style={{ padding: "1rem", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #86efac" }}>
            <span style={{ fontSize: "0.85rem", color: "#166534" }}>مجوز راه‌اندازی صادرشده</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#16a34a" }}>{summary.approved}</div>
          </div>
          <div style={{ padding: "1rem", background: "#fef3c7", borderRadius: "8px", border: "1px solid #fde68a" }}>
            <span style={{ fontSize: "0.85rem", color: "#92400e" }}>در حال بازرسی و تکمیل</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#d97706" }}>{summary.in_progress}</div>
          </div>
        </div>
      )}

      {/* Reviews Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>در حال بارگذاری پرونده‌ها...</div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>هیچ پرونده PSSR ثبت نشده است.</div>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
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
                <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0", background: selectedReview?.id === r.id ? "#eff6ff" : "transparent" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{r.pssr_number}</td>
                  <td style={{ padding: "0.75rem" }}>{r.project_or_system_name}</td>
                  <td style={{ padding: "0.75rem" }}>{r.review_type_display || r.review_type}</td>
                  <td style={{ padding: "0.75rem" }}>{r.target_startup_date}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      background: r.status === "approved" ? "#dcfce7" : r.status === "rejected" ? "#fee2e2" : "#fef3c7",
                      color: r.status === "approved" ? "#166534" : r.status === "rejected" ? "#991b1b" : "#92400e",
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
        <div style={{ marginTop: "2rem", borderTop: "2px solid #e2e8f0", paddingTop: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ margin: "0 0 0.25rem" }}>
                چک‌لیست تخصصی راه‌اندازی: {selectedReview.pssr_number} ({selectedReview.project_or_system_name})
              </h3>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
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
                  <button className="btn btn-primary" style={{ background: "#16a34a" }} onClick={() => handleApprove(selectedReview.id)}>
                    تایید نهایی و صدور مجوز راه‌اندازی
                  </button>
                  <button className="btn btn-secondary" style={{ color: "#dc2626" }} onClick={() => handleReject(selectedReview.id)}>
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
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "0.6rem" }}>دیسیپلین</th>
                    <th style={{ padding: "0.6rem" }}>موضوع و بند کنترلی</th>
                    <th style={{ padding: "0.6rem" }}>درجه اهمیت</th>
                    <th style={{ padding: "0.6rem" }}>وضعیت انطباق</th>
                    <th style={{ padding: "0.6rem" }}>اقدام</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReview.checklist_items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "0.6rem", fontWeight: "bold" }}>{item.discipline}</td>
                      <td style={{ padding: "0.6rem" }}>{item.item_text}</td>
                      <td style={{ padding: "0.6rem" }}>
                        {item.is_critical ? (
                          <span style={{ color: "#dc2626", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <AlertOctagon size={14} /> بحرانی (مانع استارت)
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>عادی</span>
                        )}
                      </td>
                      <td style={{ padding: "0.6rem" }}>
                        <span style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          background: item.status === "compliant" ? "#dcfce7" : item.status === "non_compliant" ? "#fee2e2" : "#f1f5f9",
                          color: item.status === "compliant" ? "#166534" : item.status === "non_compliant" ? "#991b1b" : "#475569",
                        }}>
                          {item.status === "compliant" ? "منطبق و ایمن" : item.status === "non_compliant" ? "عدم انطباق" : "در انتظار بررسی"}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem" }}>
                        {selectedReview.status !== "approved" && (
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "0.2rem 0.5rem", color: "#16a34a" }}
                              onClick={() => handleUpdateItem(item.id, "compliant")}
                            >
                              تایید
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "0.2rem 0.5rem", color: "#dc2626" }}
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
            <div style={{ padding: "1.5rem", background: "#f8fafc", borderRadius: "6px", textAlign: "center", color: "#64748b" }}>
              چک‌لیستی برای این پرونده ایجاد نشده است. روی دکمه «تولید چک‌لیست پیش‌فرض چندتخصصی» کلیک کنید.
            </div>
          )}

          {/* Outstanding Actions */}
          {selectedReview.outstanding_actions && selectedReview.outstanding_actions.length > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", color: "#dc2626" }}>اقدامات معوق و نواقص باز قبل از راه‌اندازی (Outstanding Actions)</h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                  <thead>
                    <tr style={{ background: "#fef2f2" }}>
                      <th style={{ padding: "0.5rem" }}>شرح نقص</th>
                      <th style={{ padding: "0.5rem" }}>مسئول رفع</th>
                      <th style={{ padding: "0.5rem" }}>مهلت</th>
                      <th style={{ padding: "0.5rem" }}>وضعیت</th>
                      <th style={{ padding: "0.5rem" }}>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReview.outstanding_actions.map((act) => (
                      <tr key={act.id} style={{ borderBottom: "1px solid #fee2e2" }}>
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
