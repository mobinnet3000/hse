import { useEffect, useState } from "react";
import {
  approveLiftingPlan,
  createLiftingPlan,
  fetchCraneSpecifications,
  fetchLiftingPlans,
  fetchLiftingSimulationData,
  fetchLiftingSummary,
  rejectLiftingPlan,
  submitLiftingPlan,
  type CraneSpecification,
  type LiftingPlan,
  type LiftingSimulationData,
} from "../../services/api";
import { Anchor, Plus, Play } from "lucide-react";

export function LiftingPlansPage() {
  const [plans, setPlans] = useState<LiftingPlan[]>([]);
  const [cranes, setCranes] = useState<CraneSpecification[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState<LiftingPlan | null>(null);
  const [simData, setSimData] = useState<LiftingSimulationData | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [actionReason, setActionReason] = useState("");

  // Create Form
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<"routine" | "critical" | "tandem" | "heavy">("critical");
  const [formLoadWeight, setFormLoadWeight] = useState<number>(12000);
  const [formBoomLen, setFormBoomLen] = useState<number>(32);
  const [formRadius, setFormRadius] = useState<number>(14);
  const [formCraneId, setFormCraneId] = useState<number | "">("");
  const [formLegs, setFormLegs] = useState<number>(2);
  const [formAngle, setFormAngle] = useState<number>(60);
  const [formOperator, setFormOperator] = useState("علی نصیری");
  const [formRigger, setFormRigger] = useState("حسین اکبری");
  const [formAllowablePress, setFormAllowablePress] = useState<number>(250);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchLiftingPlans(statusFilter !== "all" ? { status: statusFilter } : {}),
      fetchCraneSpecifications(),
      fetchLiftingSummary(),
    ])
      .then(([planList, craneList, sum]) => {
        setPlans(planList);
        setCranes(craneList);
        setSummary(sum);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "خطا در بارگذاری برنامه‌های باربرداری");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createLiftingPlan({
        organization: 1,
        title: formTitle,
        category: formCategory,
        load_weight_kg: formLoadWeight,
        boom_length_m: formBoomLen,
        lift_radius_m: formRadius,
        crane: formCraneId || null,
        num_sling_legs: formLegs,
        sling_angle_to_horizontal_deg: formAngle,
        operator_name: formOperator,
        rigger_name: formRigger,
        allowable_ground_pressure_kpa: formAllowablePress,
        planned_date: new Date().toISOString().split("T")[0],
      });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ثبت طرح باربرداری");
    }
  };

  const handleOpenSim = async (plan: LiftingPlan) => {
    setSelectedPlan(plan);
    try {
      const data = await fetchLiftingSimulationData(plan.id);
      setSimData(data);
      setShowSimModal(true);
    } catch (err: any) {
      setError(err.message || "خطا در دریافت مختصات شبیه‌سازی");
    }
  };

  const handleSubmit = async (id: number) => {
    try {
      await submitLiftingPlan(id);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ارسال طرح");
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveLiftingPlan(id, "تایید فنی پس از بررسی بار و فشار جک‌ها");
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در تایید طرح");
    }
  };

  const handleReject = async (id: number) => {
    if (!actionReason) {
      alert("ذکر دلیل رد الزامی است.");
      return;
    }
    try {
      await rejectLiftingPlan(id, actionReason);
      setActionReason("");
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در رد طرح");
    }
  };

  return (
    <div className="card" dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Anchor size={28} color="#2563eb" />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>طرح‌های باربرداری و شبیه‌سازی جرثقیل (Lifting Plans)</h2>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
              مدیریت محاسبات باربرداری بحرانی، تایید صلاحیت ریگینگ، بار مجاز جک‌ها و شبیه‌سازی هندسی
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Plus size={18} /> تدوین طرح باربرداری جدید
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>کل طرح‌های باربرداری</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#1e293b" }}>{summary.total}</div>
          </div>
          <div style={{ padding: "1rem", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #86efac" }}>
            <span style={{ fontSize: "0.85rem", color: "#166534" }}>طرح‌های تاییدشده (Approved)</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#16a34a" }}>{summary.approved}</div>
          </div>
          <div style={{ padding: "1rem", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
            <span style={{ fontSize: "0.85rem", color: "#1e40af" }}>در حال بررسی مهندسی</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2563eb" }}>{summary.under_review}</div>
          </div>
          <div style={{ padding: "1rem", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
            <span style={{ fontSize: "0.85rem", color: "#991b1b" }}>عملیات بحرانی (Critical Lift)</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#dc2626" }}>{summary.critical}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center" }}>
        <label style={{ fontSize: "0.9rem", color: "#475569" }}>فیلتر وضعیت:</label>
        <select className="form-input" style={{ width: "200px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">همه وضعیت‌ها</option>
          <option value="draft">پیش‌نویس (Draft)</option>
          <option value="submitted">ارائه‌شده (Submitted)</option>
          <option value="under_review">تحت بررسی (Under Review)</option>
          <option value="approved">تاییدشده (Approved)</option>
          <option value="rejected">رد شده (Rejected)</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>در حال بارگذاری طرح‌های باربرداری...</div>
      ) : plans.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>هیچ طرح باربرداری ثبت نشده است.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                <th style={{ padding: "0.75rem" }}>شماره طرح</th>
                <th style={{ padding: "0.75rem" }}>عنوان عملیات</th>
                <th style={{ padding: "0.75rem" }}>دسته‌بندی</th>
                <th style={{ padding: "0.75rem" }}>وزن کل (kg)</th>
                <th style={{ padding: "0.75rem" }}>درصد باربری جرثقیل</th>
                <th style={{ padding: "0.75rem" }}>فشار جک‌ها (kPa)</th>
                <th style={{ padding: "0.75rem" }}>وضعیت</th>
                <th style={{ padding: "0.75rem" }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{p.plan_number}</td>
                  <td style={{ padding: "0.75rem" }}>{p.title}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: "12px",
                      fontSize: "0.8rem",
                      background: p.category === "critical" ? "#fee2e2" : "#e0f2fe",
                      color: p.category === "critical" ? "#b91c1c" : "#0369a1",
                    }}>
                      {p.category_display || p.category}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    {p.total_gross_weight_kg != null
                      ? p.total_gross_weight_kg.toLocaleString()
                      : p.load_weight_kg != null
                      ? p.load_weight_kg.toLocaleString()
                      : "—"}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{ fontWeight: "bold", color: (p.crane_utilization_pct || 0) > 85 ? "#dc2626" : "#16a34a" }}>
                      %{p.crane_utilization_pct || 0}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{ color: (p.ground_bearing_pressure_kpa || 0) > (p.allowable_ground_pressure_kpa || 0) ? "#dc2626" : "#1e293b" }}>
                      {p.ground_bearing_pressure_kpa || "—"} / {p.allowable_ground_pressure_kpa || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      background: p.status === "approved" ? "#dcfce7" : p.status === "rejected" ? "#fee2e2" : "#fef3c7",
                      color: p.status === "approved" ? "#166534" : p.status === "rejected" ? "#991b1b" : "#92400e",
                    }}>
                      {p.status_display || p.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button className="btn btn-secondary" style={{ padding: "0.3rem 0.6rem" }} onClick={() => handleOpenSim(p)} title="مشاهده شبیه‌سازی">
                        <Play size={14} /> شبیه‌سازی
                      </button>
                      {p.status === "draft" && (
                        <button className="btn btn-primary" style={{ padding: "0.3rem 0.6rem" }} onClick={() => handleSubmit(p.id)}>
                          ارسال
                        </button>
                      )}
                      {(p.status === "submitted" || p.status === "under_review") && (
                        <>
                          <button className="btn btn-primary" style={{ padding: "0.3rem 0.6rem", background: "#16a34a" }} onClick={() => handleApprove(p.id)}>
                            تایید
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "0.3rem 0.6rem", color: "#dc2626" }}
                            onClick={() => {
                              const r = prompt("دلیل رد طرح را وارد کنید:");
                              if (r) {
                                setActionReason(r);
                                handleReject(p.id);
                              }
                            }}
                          >
                            رد
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Lifting Plan */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "650px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 1rem" }}>تدوین طرح مهندسی باربرداری (Lifting Plan)</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">عنوان عملیات باربرداری</label>
                <input type="text" className="form-input" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">دسته‌بندی بالابری</label>
                  <select className="form-input" value={formCategory} onChange={(e: any) => setFormCategory(e.target.value)}>
                    <option value="routine">عادی (Routine)</option>
                    <option value="critical">بحرانی (Critical)</option>
                    <option value="tandem">باربرداری همزمان / دو جرثقیل (Tandem)</option>
                    <option value="heavy">سنگین و فوق سنگین (Heavy Lift)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">انتخاب جرثقیل</label>
                  <select className="form-input" value={formCraneId} onChange={(e) => setFormCraneId(Number(e.target.value) || "")}>
                    <option value="">(انتخاب از ناوگان)</option>
                    {cranes.map((c) => (
                      <option key={c.id} value={c.id}>{c.crane_code} - {c.model_name} ({c.max_capacity_ton} Ton)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">وزن خالص بار (kg)</label>
                  <input type="number" className="form-input" value={formLoadWeight} onChange={(e) => setFormLoadWeight(parseFloat(e.target.value) || 0)} required />
                </div>
                <div>
                  <label className="form-label">طول بوم (متر)</label>
                  <input type="number" className="form-input" value={formBoomLen} onChange={(e) => setFormBoomLen(parseFloat(e.target.value) || 0)} required />
                </div>
                <div>
                  <label className="form-label">شعاع کاری باربرداری (متر)</label>
                  <input type="number" className="form-input" value={formRadius} onChange={(e) => setFormRadius(parseFloat(e.target.value) || 0)} required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">تعداد ساق‌های اسلینگ (Sling Legs)</label>
                  <select className="form-input" value={formLegs} onChange={(e) => setFormLegs(parseInt(e.target.value))}>
                    <option value={1}>۱ ساق</option>
                    <option value={2}>۲ ساق</option>
                    <option value={4}>۴ ساق</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">زاویه اسلینگ با افق (درجه)</label>
                  <input type="number" className="form-input" value={formAngle} onChange={(e) => setFormAngle(parseFloat(e.target.value) || 0)} required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">اپراتور جرثقیل</label>
                  <input type="text" className="form-input" value={formOperator} onChange={(e) => setFormOperator(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">ریگر مسئول (Rigger)</label>
                  <input type="text" className="form-input" value={formRigger} onChange={(e) => setFormRigger(e.target.value)} required />
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-label">حداکثر مقاومت مجاز زمین (kPa - Ground Bearing Capacity)</label>
                <input type="number" className="form-input" value={formAllowablePress} onChange={(e) => setFormAllowablePress(parseFloat(e.target.value) || 0)} required />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary">ثبت طرح باربرداری</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Visual 2D Simulation Canvas */}
      {showSimModal && selectedPlan && simData && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "800px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>شبیه‌سازی و تحلیل هندسی باربرداری: {selectedPlan.plan_number}</h3>
              <button className="btn btn-secondary" onClick={() => setShowSimModal(false)}>بستن</button>
            </div>

            {/* 2D Canvas SVG Representation */}
            <div style={{ background: "#0f172a", borderRadius: "8px", padding: "1.5rem", textAlign: "center", marginBottom: "1.5rem" }}>
              <svg width="100%" height="280" viewBox="0 0 600 280" style={{ background: "#0f172a" }}>
                {/* Ground */}
                <line x1="20" y1="240" x2="580" y2="240" stroke="#475569" strokeWidth="4" />
                <text x="30" y="260" fill="#94a3b8" fontSize="12">سطح زمین (Ground Level)</text>

                {/* Outriggers */}
                <rect x="150" y="235" width="40" height="10" fill="#fbbf24" />
                <rect x="250" y="235" width="40" height="10" fill="#fbbf24" />

                {/* Crane Body Base */}
                <rect x="170" y="200" width="100" height="35" rx="4" fill="#3b82f6" />
                <text x="185" y="222" fill="#ffffff" fontSize="11" fontWeight="bold">جرثقیل کارگاهی</text>

                {/* Boom */}
                <line
                  x1={simData.coordinates.crane_base.x}
                  y1={simData.coordinates.crane_base.y}
                  x2={simData.coordinates.boom_tip.x}
                  y2={simData.coordinates.boom_tip.y}
                  stroke="#ef4444"
                  strokeWidth="8"
                  strokeLinecap="round"
                />

                {/* Hook Line */}
                <line
                  x1={simData.coordinates.boom_tip.x}
                  y1={simData.coordinates.boom_tip.y}
                  x2={simData.coordinates.hook_position.x}
                  y2={simData.coordinates.hook_position.y}
                  stroke="#e2e8f0"
                  strokeWidth="2"
                  strokeDasharray="4"
                />

                {/* Hook & Load */}
                <circle cx={simData.coordinates.hook_position.x} cy={simData.coordinates.hook_position.y} r="6" fill="#f59e0b" />
                <rect
                  x={simData.coordinates.load_center.x - 30}
                  y={simData.coordinates.load_center.y - 15}
                  width="60"
                  height="30"
                  rx="4"
                  fill="#10b981"
                />
                <text
                  x={simData.coordinates.load_center.x - 22}
                  y={simData.coordinates.load_center.y + 4}
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {selectedPlan.load_weight_kg} kg
                </text>
              </svg>
            </div>

            {/* Simulation Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "6px" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>زاویه شیب بوم (Boom Angle)</span>
                <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>{simData.boom_angle_deg}°</div>
              </div>
              <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "6px" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>درصد ظرفیت جرثقیل</span>
                <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: simData.crane_utilization_pct > 85 ? "#dc2626" : "#16a34a" }}>
                  %{simData.crane_utilization_pct}
                </div>
              </div>
              <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "6px" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>فشار روی پد جک‌ها</span>
                <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: simData.ground_pressure_safe ? "#16a34a" : "#dc2626" }}>
                  {simData.ground_bearing_pressure_kpa} kPa
                </div>
              </div>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: "6px", background: simData.ground_pressure_safe ? "#dcfce7" : "#fee2e2" }}>
              <strong>تحلیل نهایی مهندسی ایمنی:</strong> {simData.ground_pressure_safe ? "کلیه ضرایب ایمنی پایداری، زاویه و بار مجاز زمین رعایت شده است." : "هشدار: فشار پایه جک از مقاومت مجاز زمین بیشتر است! نیاز به استفاده از پدهای چوبی/فولادی بزرگتر."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
