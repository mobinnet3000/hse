import { useEffect, useState } from "react";
import {
  closeAnomaly,
  createAnomaly,
  escalateAnomalyToIncident,
  escalateAnomalyToRisk,
  fetchAnomalies,
  fetchRiskRegisters,
  reopenAnomaly,
  type NonConformity,
  type RiskRegisterItem,
} from "../../services/api";
import { useSharedMasterData } from "../../core/store/sharedMasterStore";
import {
  AlertCircle,
  RotateCcw,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  Search,
} from "lucide-react";

export function AnomaliesPage() {
  const { projects, sites, contractors } = useSharedMasterData();
  const currentProject = projects[0];
  const [anomalies, setAnomalies] = useState<NonConformity[]>([]);
  const [riskRegisters, setRiskRegisters] = useState<RiskRegisterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<string>("unsafe_act");
  const [formCategory, setFormCategory] = useState<"safety" | "health" | "environment" | "ppe" | "procedural">("safety");
  const [formSeverity, setFormSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [formPriority, setFormPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [formLikelihood, setFormLikelihood] = useState<number>(2);
  const [formPotentialSeverity, setFormPotentialSeverity] = useState<number>(2);
  const [formReporter, setFormReporter] = useState("");
  const [formSite, setFormSite] = useState("");
  const [formArea, setFormArea] = useState("");
  const [formContractor, setFormContractor] = useState("");
  const [formContainment, setFormContainment] = useState("");
  const [formDeadline, setFormDeadline] = useState(new Date().toISOString().split("T")[0]);

  // Escalate to Incident Modal State
  const [escalateIncidentTarget, setEscalateIncidentTarget] = useState<NonConformity | null>(null);
  const [incTitle, setIncTitle] = useState("");
  const [incSeverity, setIncSeverity] = useState("moderate");
  const [incType, setIncType] = useState("incident");

  // Escalate to Risk Modal State
  const [escalateRiskTarget, setEscalateRiskTarget] = useState<NonConformity | null>(null);
  const [selectedRiskRegisterId, setSelectedRiskRegisterId] = useState("");

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

    // بارگذاری رجیسترهای ریسک برای سناریوی اتصال بین‌ماژولی
    fetchRiskRegisters(1)
      .then((items) => setRiskRegisters(items || []))
      .catch(() => {});
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
        category_flag: formCategory,
        severity: formSeverity,
        priority: formPriority,
        potential_likelihood: formLikelihood,
        potential_severity: formPotentialSeverity,
        reporter_name: formReporter,
        immediate_containment: formContainment,
        target_deadline: formDeadline,
        project_name: currentProject?.name || "پروژه الفین",
        site_location: formSite || (sites[0]?.name ?? "عسلویه"),
        area: formArea || "واحد عملیاتی ۱۰۲",
        contractor_name: formContractor || "",
      });
      setShowCreateModal(false);
      setFormDesc("");
      setSuccessMsg("ناهنجاری با موفقیت ثبت شد و کد ردیابی اختصاص یافت.");
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ثبت ناهنجاری");
    }
  };

  const handleEscalateIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateIncidentTarget) return;
    try {
      await escalateAnomalyToIncident(escalateIncidentTarget.id, {
        title: incTitle || `حادثه ناشی از ${escalateIncidentTarget.reference_number}`,
        severity: incSeverity,
        incident_type: incType,
      });
      setEscalateIncidentTarget(null);
      setSuccessMsg(`ناهنجاری با موفقیت به پرونده حادثه تشدید شد و پیوند در زنجیره ردیابی برقرار گردید.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در تشدید به حادثه");
    }
  };

  const handleEscalateRiskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateRiskTarget) return;
    try {
      await escalateAnomalyToRisk(escalateRiskTarget.id, {
        risk_register_id: selectedRiskRegisterId || undefined,
      });
      setEscalateRiskTarget(null);
      setSuccessMsg(`ناهنجاری با موفقیت به رجیستر ریسک پیوند خورد.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ارجاع به رجیستر ریسک");
    }
  };

  const handleClose = async (id: number) => {
    const notes = prompt("شرح اقدامات اصلاحی انجام‌شده و تاییدیه رفع:");
    if (!notes) return;
    try {
      await closeAnomaly(id, { closure_notes: notes });
      setSuccessMsg("پرونده با موفقیت بسته‌شد.");
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در بستن پرونده");
    }
  };

  const handleReopen = async (id: number) => {
    const reason = prompt("علت بازگشایی مجدد پرونده ناهنجاری:");
    if (!reason) return;
    try {
      await reopenAnomaly(id, { reopened_reason: reason });
      setSuccessMsg("پرونده مجدداً بازگشایی شد.");
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در بازگشایی مجدد");
    }
  };

  const filteredAnomalies = anomalies.filter((a) => {
    if (categoryFilter !== "all" && a.category_flag !== categoryFilter) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (a.reference_number || "").toLowerCase().includes(term) ||
      (a.description || "").toLowerCase().includes(term) ||
      (a.reporter_name || "").toLowerCase().includes(term) ||
      (a.traceability_chain_id || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="card" dir="rtl" style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 44, height: 44, borderRadius: "10px", background: "rgba(59, 130, 246, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
            <AlertCircle size={26} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>مدیریت یکپارچه ناهنجاری‌ها و مشاهدات ناایمن</h2>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
              چرخه ثبت میدانی اعمال و شرایط ناایمن، ارزیابی پتانسیل خطر، و سیم‌کشی مستقیم به مدیریت حوادث و رجیستر ریسک
            </p>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem", fontWeight: 700 }}
        >
          <Plus size={18} /> ثبت مشاهده / ناهنجاری جدید
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(239, 68, 68, 0.1)", borderRight: "4px solid #ef4444", color: "#dc2626", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(16, 185, 129, 0.1)", borderRight: "4px solid #10b981", color: "#059669", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {successMsg}
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center", background: "var(--bg-subtle)", padding: "1rem", borderRadius: "8px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <Search size={16} style={{ position: "absolute", right: 10, top: 11, color: "var(--text-tertiary)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingRight: "2.2rem" }}
            placeholder="جستجو در شرح، کد ردیابی، کد ناهنجاری، گزارش‌دهنده..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginLeft: "0.4rem" }}>نوع واقعه:</label>
          <select className="form-input" style={{ width: "190px", display: "inline-block" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">همه انواع</option>
            <option value="unsafe_act">عمل ناایمن (Unsafe Act)</option>
            <option value="unsafe_condition">شرایط ناایمن (Unsafe Condition)</option>
            <option value="near_miss">شبه‌حادثه (Near Miss)</option>
            <option value="contractor_deviation">انحراف پیمانکار</option>
            <option value="equipment_defect">نقص فنی تجهیز</option>
            <option value="environmental_deviation">انحراف زیست‌محیطی</option>
            <option value="procedural_violation">نقض روش اجرایی</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginLeft: "0.4rem" }}>حوزه خطر:</label>
          <select className="form-input" style={{ width: "160px", display: "inline-block" }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">همه حوزه‌ها</option>
            <option value="safety">ایمنی (Safety)</option>
            <option value="health">بهداشت (Health)</option>
            <option value="environment">محیط‌زیست (Env)</option>
            <option value="ppe">تجهیزات فردی (PPE)</option>
            <option value="procedural">رویه‌ای و فرآیندی</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginLeft: "0.4rem" }}>وضعیت:</label>
          <select className="form-input" style={{ width: "140px", display: "inline-block" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">همه</option>
            <option value="open">باز</option>
            <option value="in_progress">رسیدگی</option>
            <option value="ready_for_review">بررسی نهایی</option>
            <option value="closed">بسته‌شده</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>در حال استعلام ناهنجاری‌ها...</div>
      ) : filteredAnomalies.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>هیچ ناهنجاری با معیارهای فوق ثبت نشده است.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", borderBottom: "2px solid var(--border-strong)", color: "var(--text-secondary)" }}>
                <th style={{ padding: "0.75rem" }}>شناسه و ردیابی</th>
                <th style={{ padding: "0.75rem" }}>حوزه و نوع</th>
                <th style={{ padding: "0.75rem" }}>شرح مشاهده</th>
                <th style={{ padding: "0.75rem" }}>محل و پروژه</th>
                <th style={{ padding: "0.75rem" }}>ریسک بالقوه</th>
                <th style={{ padding: "0.75rem" }}>وضعیت ارجاع ماتریسی</th>
                <th style={{ padding: "0.75rem" }}>وضعیت</th>
                <th style={{ padding: "0.75rem", textAlign: "center" }}>عملیات و تبادل</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnomalies.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{a.reference_number}</div>
                    {a.traceability_chain_id && (
                      <div style={{ fontSize: "0.7rem", color: "#6366f1", fontFamily: "monospace", marginTop: 2 }}>
                        {a.traceability_chain_id}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{
                        padding: "0.15rem 0.5rem",
                        borderRadius: "10px",
                        fontSize: "0.75rem",
                        width: "fit-content",
                        background: a.anomaly_type === "unsafe_act" ? "rgba(239, 68, 68, 0.12)" : "rgba(59, 130, 246, 0.12)",
                        color: a.anomaly_type === "unsafe_act" ? "#dc2626" : "#2563eb",
                        fontWeight: 600,
                      }}>
                        {a.anomaly_type_display || a.anomaly_type}
                      </span>
                      {a.category_flag_display && (
                        <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
                          {a.category_flag_display}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem", maxWidth: "260px" }}>
                    <div style={{ fontWeight: 600 }}>{a.description}</div>
                    {a.immediate_containment && (
                      <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: 3 }}>
                        <span>مهار فوری: </span>
                        <span>{a.immediate_containment}</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <div>{a.site_location || "سایت عمومی"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{a.area || a.location_details || "—"}</div>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      width: "fit-content",
                      fontWeight: 700,
                      background: (a.risk_score || 0) >= 12 ? "rgba(239, 68, 68, 0.15)" : (a.risk_score || 0) >= 6 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                      color: (a.risk_score || 0) >= 12 ? "#dc2626" : (a.risk_score || 0) >= 6 ? "#d97706" : "#059669",
                    }}>
                      RPN: {a.risk_score || 4} ({a.severity})
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {a.escalated_to_incident ? (
                        <span style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                          <ShieldAlert size={13} /> تشدید به حادثه ({a.related_incident_code || "INC"})
                        </span>
                      ) : null}
                      {a.escalated_to_risk ? (
                        <span style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                          <ArrowUpRight size={13} /> اتصال به ریسک ({a.related_risk_register_code || "RR"})
                        </span>
                      ) : null}
                      {!a.escalated_to_incident && !a.escalated_to_risk && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>مستقل / اقدام داخلی</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background: a.status === "closed" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: a.status === "closed" ? "#059669" : "#dc2626",
                    }}>
                      {a.status_display || a.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", flexWrap: "wrap" }}>
                      {!a.escalated_to_incident && a.status !== "closed" && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#dc2626" }}
                          onClick={() => {
                            setEscalateIncidentTarget(a);
                            setIncTitle(`حادثه ناشی از ناهنجاری ${a.reference_number}`);
                          }}
                          title="تشدید خودکار به پرونده حادثه در زنجیره ردیابی"
                        >
                          تشدید به حادثه
                        </button>
                      )}
                      {!a.escalated_to_risk && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#2563eb" }}
                          onClick={() => {
                            setEscalateRiskTarget(a);
                            setSelectedRiskRegisterId(riskRegisters[0]?.id || "");
                          }}
                          title="اتصال تحلیلی به ماژول مدیریت ریسک"
                        >
                          اتصال به ریسک
                        </button>
                      )}
                      {a.status !== "closed" ? (
                        <button
                          className="btn btn-primary"
                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", background: "#059669" }}
                          onClick={() => handleClose(a.id)}
                        >
                          بستن
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                          onClick={() => handleReopen(a.id)}
                          title="بازگشایی مجدد"
                        >
                          <RotateCcw size={12} /> بازگشایی
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
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: "680px", width: "95%", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.2rem", fontWeight: 800 }}>ثبت گزارش مشاهده ناایمن / ناهنجاری میدانی</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">نوع رویداد یا انحراف</label>
                  <select className="form-input" value={formType} onChange={(e) => setFormType(e.target.value)}>
                    <option value="unsafe_act">عمل ناایمن (Unsafe Act) - رفتار پرخطر فردی</option>
                    <option value="unsafe_condition">شرایط ناایمن (Unsafe Condition) - نقص فیزیکی محیط</option>
                    <option value="near_miss">شبه‌حادثه (Near Miss) - رویداد بدون آسیب</option>
                    <option value="contractor_deviation">انحراف ایمنی پیمانکار (Contractor)</option>
                    <option value="equipment_defect">نقص و خرابی تجهیزات (Equipment Defect)</option>
                    <option value="environmental_deviation">انحراف زیست‌محیطی (نشت مواد، پساب)</option>
                    <option value="procedural_violation">انحراف از روش اجرایی مصوب (SOP)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">حوزه خطر (Domain Flag)</label>
                  <select className="form-input" value={formCategory} onChange={(e: any) => setFormCategory(e.target.value)}>
                    <option value="safety">ایمنی عمومی و فنی (Safety)</option>
                    <option value="health">بهداشت و ارگونومی (Health)</option>
                    <option value="environment">محیط‌زیست (Environment)</option>
                    <option value="ppe">تجهیزات حفاظت فردی (PPE)</option>
                    <option value="procedural">فرآیندی و رویه‌ای (Procedural)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">سطح شدت اولیه (Initial Severity)</label>
                  <select className="form-input" value={formSeverity} onChange={(e: any) => setFormSeverity(e.target.value)}>
                    <option value="low">کم (Low)</option>
                    <option value="medium">متوسط (Medium)</option>
                    <option value="high">بالا (High)</option>
                    <option value="critical">بحرانی (Critical)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">اولویت رسیدگی (Priority)</label>
                  <select className="form-input" value={formPriority} onChange={(e: any) => setFormPriority(e.target.value)}>
                    <option value="low">عادی (Low)</option>
                    <option value="medium">متوسط (Medium)</option>
                    <option value="high">بالا (High)</option>
                    <option value="urgent">فوری و اضطراری (Urgent)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">شرح دقیق مشاهده، شواهد و انحراف واقع‌شده</label>
                <textarea className="form-input" rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="شرح کامل رفتار یا شرایط مشاهده‌شده در صحنه عملیات..." required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">محل / سایت (اطلاعات مرجع مشترک)</label>
                  <select className="form-input" value={formSite} onChange={(e) => setFormSite(e.target.value)}>
                    {sites.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">بخش یا ناحیه عملیاتی</label>
                  <input type="text" className="form-input" value={formArea} onChange={(e) => setFormArea(e.target.value)} placeholder="مثال: واحد ۱۰۲، سوله مونتاژ" />
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">اقدام فوری کنترلی در صحنه (Immediate Containment)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formContainment}
                  onChange={(e) => setFormContainment(e.target.value)}
                  placeholder="مثال: توقف بلافاصله فعالیت، نصب نوار زرد خطر، تعویض کابل فرسوده..."
                />
              </div>

              {/* Potential Risk Matrix Sliders */}
              <div style={{ background: "var(--bg-subtle)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>ارزیابی ریسک بالقوه (Potential Risk: {formLikelihood * formPotentialSeverity})</label>
                  <span style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    background: (formLikelihood * formPotentialSeverity) >= 12 ? "#dc2626" : (formLikelihood * formPotentialSeverity) >= 6 ? "#d97706" : "#059669",
                    color: "#fff"
                  }}>
                    {(formLikelihood * formPotentialSeverity) >= 12 ? "ریسک بحرانی" : (formLikelihood * formPotentialSeverity) >= 6 ? "ریسک متوسط" : "ریسک کم"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span>احتمال بالقوه (L):</span>
                      <strong>{formLikelihood} از ۵</strong>
                    </div>
                    <input type="range" min="1" max="5" value={formLikelihood} onChange={(e) => setFormLikelihood(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span>شدت پیامد بالقوه (S):</span>
                      <strong>{formPotentialSeverity} از ۵</strong>
                    </div>
                    <input type="range" min="1" max="5" value={formPotentialSeverity} onChange={(e) => setFormPotentialSeverity(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">گزارش‌دهنده / ناظر</label>
                  <input type="text" className="form-input" value={formReporter} onChange={(e) => setFormReporter(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">پیمانکار مجری (در صورت برون‌سپاری)</label>
                  <select className="form-input" value={formContractor} onChange={(e) => setFormContractor(e.target.value)}>
                    <option value="">امور داخلی / بدون پیمانکار</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.companyName}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-label">مهلت اقدام اصلاحی (Target Deadline)</label>
                <input type="date" className="form-input" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)} required />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>ثبت ناهنجاری و صدور کد ردیابی</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Escalate to Incident */}
      {escalateIncidentTarget && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: "520px", width: "95%", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#dc2626", marginBottom: "1rem" }}>
              <ShieldAlert size={24} />
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>تشدید ناهنجاری به پرونده رسمی حادثه</h3>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              این ناهنجاری ({escalateIncidentTarget.reference_number}) مستقیماً با تبادل خودکار (Automatic) در زنجیره ردیابی به ماژول مدیریت حوادث متصل می‌شود.
            </p>
            <form onSubmit={handleEscalateIncidentSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">عنوان حادثه</label>
                <input type="text" className="form-input" value={incTitle} onChange={(e) => setIncTitle(e.target.value)} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label className="form-label">نوع رویداد</label>
                  <select className="form-input" value={incType} onChange={(e) => setIncType(e.target.value)}>
                    <option value="incident">حادثه ناشی از کار</option>
                    <option value="near_miss">شبه‌حادثه (Near Miss)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">شدت حادثه</label>
                  <select className="form-input" value={incSeverity} onChange={(e) => setIncSeverity(e.target.value)}>
                    <option value="minor">جزئی (سطح ۱)</option>
                    <option value="moderate">متوسط (سطح ۲)</option>
                    <option value="major">شدید (سطح ۳)</option>
                    <option value="critical">بحرانی (سطح ۴)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEscalateIncidentTarget(null)}>انصراف</button>
                <button type="submit" className="btn btn-primary" style={{ background: "#dc2626", fontWeight: 700 }}>ایجاد حادثه و اتصال زنجیره ردیابی</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Escalate to Risk */}
      {escalateRiskTarget && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: "520px", width: "95%", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#2563eb", marginBottom: "1rem" }}>
              <ArrowUpRight size={24} />
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>اتصال تحلیلی ناهنجاری به رجیستر ریسک</h3>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              پیوند این مشاهده ({escalateRiskTarget.reference_number}) با رجیستر ارزیابی ریسک جهت بازنگری سناریوها و اثربخشی موانع کنترلی.
            </p>
            <form onSubmit={handleEscalateRiskSubmit}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-label">انتخاب رجیستر ریسک هدف (Phase 1 Risk Register)</label>
                <select className="form-input" value={selectedRiskRegisterId} onChange={(e) => setSelectedRiskRegisterId(e.target.value)}>
                  {riskRegisters.length === 0 ? (
                    <option value="">رجیستر ثبت‌شده‌ای یافت نشد</option>
                  ) : (
                    riskRegisters.map((rr) => (
                      <option key={rr.id} value={rr.id}>
                        [{rr.register_code}] {rr.title} ({rr.department})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEscalateRiskTarget(null)}>انصراف</button>
                <button type="submit" className="btn btn-primary" style={{ background: "#2563eb", fontWeight: 700 }}>اتصال به رجیستر ریسک</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
