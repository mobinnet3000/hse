import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ShieldAlert,
  GitBranch,
  Table,
  BarChart3,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  X,
} from "lucide-react";

import {
  ApiRequestError,
  HAZARD_CATEGORIES,
  createAssessment,
  createHazard,
  fetchAssessments,
  fetchHazards,
  fetchOrganizations,
  fetchWorkplaces,
  updateHazard,
  fetchBowTieDiagrams,
  fetchHCMSControls,
  fetchRiskDashboardSummary,
  createBowTieDiagram,
  createBowTieThreat,
  createBowTieConsequence,
  createBarrier,
  assessBarrier,
  createHCMSControl,
  type Hazard,
  type Organization,
  type RiskAssessment,
  type Workplace,
  type BowTieDiagram,
  type HCMSControl,
  type RiskDashboardSummary,
  type Barrier,
} from "../../services/api";

type FormState = {
  id: number | null;
  title: string;
  description: string;
  category: string;
  source: string;
  causes: string;
  consequences: string;
  exposed_persons: string;
  existing_controls: string;
  workplace: string;
  status: string;
};

const emptyHazardForm: FormState = {
  id: null,
  title: "",
  description: "",
  category: "safety",
  source: "",
  causes: "",
  consequences: "",
  exposed_persons: "",
  existing_controls: "",
  workplace: "",
  status: "draft",
};

function errorMessage(error: unknown) {
  return error instanceof ApiRequestError ? error.message : "خطای نامشخص رخ داد.";
}

export function RisksPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [bowties, setBowties] = useState<BowTieDiagram[]>([]);
  const [selectedBowTie, setSelectedBowTie] = useState<BowTieDiagram | null>(null);
  const [hcmsControls, setHcmsControls] = useState<HCMSControl[]>([]);
  const [riskSummary, setRiskSummary] = useState<RiskDashboardSummary | null>(null);

  const [activeTab, setActiveTab] = useState<"matrix" | "bowtie" | "hcms" | "summary">("matrix");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ category: "", level: "" });
  const [hazardForm, setHazardForm] = useState<FormState>(emptyHazardForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [assessmentForm, setAssessmentForm] = useState({
    hazard: "",
    likelihood: "3",
    severity: "3",
    proposed_controls: "",
    implemented_controls: "",
  });
  const [assessmentResult, setAssessmentResult] = useState<RiskAssessment | null>(null);

  // Modal states for BowTie and Barrier
  const [showBowTieModal, setShowBowTieModal] = useState(false);
  const [newBowTie, setNewBowTie] = useState({ hazard: "", top_event: "", description: "" });

  const [showBarrierAssessModal, setShowBarrierAssessModal] = useState(false);
  const [selectedBarrierForAssess, setSelectedBarrierForAssess] = useState<Barrier | null>(null);
  const [barrierAssessForm, setBarrierAssessForm] = useState({
    effectiveness: "effective" as "effective" | "partially_effective" | "ineffective" | "not_tested",
    assessment_date: new Date().toISOString().split("T")[0],
    evidence_reference: "",
    notes: "",
  });

  const [showNewThreatModal, setShowNewThreatModal] = useState(false);
  const [newThreatTitle, setNewThreatTitle] = useState("");
  const [showNewConsequenceModal, setShowNewConsequenceModal] = useState(false);
  const [newConsequenceTitle, setNewConsequenceTitle] = useState("");
  const [showNewBarrierModal, setShowNewBarrierModal] = useState(false);
  const [newBarrierForm, setNewBarrierForm] = useState({
    barrier_type: "preventive" as "preventive" | "mitigative",
    threat_id: "",
    consequence_id: "",
    nature: "engineering" as "engineering" | "administrative" | "human_action" | "physical",
    name: "",
    description: "",
    is_critical: true,
  });

  const [showHcmsModal, setShowHcmsModal] = useState(false);
  const [newHcmsForm, setNewHcmsForm] = useState({
    hazard: "",
    control_title: "",
    hierarchy_of_control: "engineering" as "elimination" | "substitution" | "engineering" | "administrative" | "ppe",
    residual_likelihood: 2,
    residual_severity: 2,
    review_frequency_days: 90,
  });

  const reloadData = (orgId: number, signal?: AbortSignal) => {
    setLoading(true);
    Promise.all([
      fetchHazards(orgId, {}, signal),
      fetchAssessments(orgId, {}, signal),
      fetchWorkplaces(orgId, signal),
    ])
      .then(([hazardItems, assessmentItems, workplaceItems]) => {
        setHazards(hazardItems);
        setAssessments(assessmentItems);
        setWorkplaces(workplaceItems);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!signal?.aborted) setError(errorMessage(err));
      })
      .finally(() => setLoading(false));

    // Phase 11 extensions fetched independently so mock environments remain resilient
    fetchBowTieDiagrams(orgId, {}, signal)
      .then((items) => {
        setBowties(items || []);
        if (items && items.length > 0) {
          setSelectedBowTie((prev) => prev ? (items.find(b => b.id === prev.id) || items[0]) : items[0]);
        }
      })
      .catch(() => {});

    fetchHCMSControls(orgId, {}, signal)
      .then((items) => setHcmsControls(items || []))
      .catch(() => {});

    fetchRiskDashboardSummary(orgId, signal)
      .then((data) => setRiskSummary(data || null))
      .catch(() => {});
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(controller.signal)
      .then((items) => {
        setOrganizations(items);
        if (items[0]) {
          setOrganizationId(items[0].id);
        }
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (organizationId === null) return;
    const controller = new AbortController();
    reloadData(organizationId, controller.signal);
    return () => controller.abort();
  }, [organizationId]);

  const visibleHazards = useMemo(() => {
    return hazards.filter((hazard) => {
      if (filters.category && hazard.category !== filters.category) return false;
      return true;
    });
  }, [hazards, filters.category]);

  const visibleAssessments = useMemo(() => {
    return assessments.filter((assessment) => {
      if (filters.level && assessment.level !== filters.level) return false;
      return true;
    });
  }, [assessments, filters.level]);

  const submitHazard = async (event: FormEvent) => {
    event.preventDefault();
    if (organizationId === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: hazardForm.title,
        description: hazardForm.description,
        category: hazardForm.category,
        source: hazardForm.source,
        causes: hazardForm.causes,
        consequences: hazardForm.consequences,
        exposed_persons: hazardForm.exposed_persons,
        existing_controls: hazardForm.existing_controls,
        workplace: hazardForm.workplace ? Number(hazardForm.workplace) : null,
        status: hazardForm.status,
      };

      if (hazardForm.id === null) {
        const created = await createHazard(organizationId, payload);
        setHazards([created, ...hazards]);
      } else {
        const updated = await updateHazard(hazardForm.id, payload);
        setHazards(hazards.map((item) => (item.id === updated.id ? updated : item)));
      }
      setHazardForm(emptyHazardForm);
    } catch (err: unknown) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitAssessment = async (event: FormEvent) => {
    event.preventDefault();
    if (organizationId === null) return;
    setSaving(true);
    try {
      const assessment = await createAssessment(organizationId, {
        hazard: Number(assessmentForm.hazard),
        likelihood: Number(assessmentForm.likelihood),
        severity: Number(assessmentForm.severity),
        proposed_controls: assessmentForm.proposed_controls,
        implemented_controls: assessmentForm.implemented_controls,
      });
      setAssessments([assessment, ...assessments]);
      setAssessmentResult(assessment);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBowTie = async (e: FormEvent) => {
    e.preventDefault();
    if (!organizationId || !newBowTie.hazard || !newBowTie.top_event) return;
    setSaving(true);
    try {
      await createBowTieDiagram(organizationId, {
        hazard: Number(newBowTie.hazard),
        top_event: newBowTie.top_event,
        description: newBowTie.description,
        status: "active",
      });
      setShowBowTieModal(false);
      setNewBowTie({ hazard: "", top_event: "", description: "" });
      reloadData(organizationId);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAssessBarrierSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBarrierForAssess || !organizationId) return;
    setSaving(true);
    try {
      await assessBarrier(selectedBarrierForAssess.id, {
        effectiveness: barrierAssessForm.effectiveness,
        assessment_date: barrierAssessForm.assessment_date,
        evidence_reference: barrierAssessForm.evidence_reference,
        notes: barrierAssessForm.notes,
      });
      setShowBarrierAssessModal(false);
      reloadData(organizationId);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddThreat = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBowTie || !newThreatTitle || !organizationId) return;
    setSaving(true);
    try {
      await createBowTieThreat(selectedBowTie.id, { title: newThreatTitle, order: (selectedBowTie.threats?.length || 0) + 1 });
      setShowNewThreatModal(false);
      setNewThreatTitle("");
      reloadData(organizationId);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddConsequence = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBowTie || !newConsequenceTitle || !organizationId) return;
    setSaving(true);
    try {
      await createBowTieConsequence(selectedBowTie.id, {
        title: newConsequenceTitle,
        severity_level: "high",
        order: (selectedBowTie.consequences?.length || 0) + 1,
      });
      setShowNewConsequenceModal(false);
      setNewConsequenceTitle("");
      reloadData(organizationId);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddBarrier = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBowTie || !organizationId || !newBarrierForm.name) return;
    setSaving(true);
    try {
      await createBarrier({
        diagram: selectedBowTie.id,
        barrier_type: newBarrierForm.barrier_type,
        threat: newBarrierForm.barrier_type === "preventive" ? Number(newBarrierForm.threat_id) : null,
        consequence: newBarrierForm.barrier_type === "mitigative" ? Number(newBarrierForm.consequence_id) : null,
        nature: newBarrierForm.nature,
        name: newBarrierForm.name,
        description: newBarrierForm.description,
        is_critical: newBarrierForm.is_critical,
      });
      setShowNewBarrierModal(false);
      setNewBarrierForm({
        barrier_type: "preventive",
        threat_id: "",
        consequence_id: "",
        nature: "engineering",
        name: "",
        description: "",
        is_critical: true,
      });
      reloadData(organizationId);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateHcmsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organizationId || !newHcmsForm.hazard || !newHcmsForm.control_title) return;
    setSaving(true);
    try {
      await createHCMSControl(organizationId, {
        hazard: Number(newHcmsForm.hazard),
        control_title: newHcmsForm.control_title,
        hierarchy_of_control: newHcmsForm.hierarchy_of_control,
        residual_likelihood: Number(newHcmsForm.residual_likelihood),
        residual_severity: Number(newHcmsForm.residual_severity),
        review_frequency_days: Number(newHcmsForm.review_frequency_days),
      });
      setShowHcmsModal(false);
      setNewHcmsForm({
        hazard: "",
        control_title: "",
        hierarchy_of_control: "engineering",
        residual_likelihood: 2,
        residual_severity: 2,
        review_frequency_days: 90,
      });
      reloadData(organizationId);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const getEffectivenessBadge = (eff: string) => {
    switch (eff) {
      case "effective":
        return <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={12} /> مؤثر</span>;
      case "partially_effective":
        return <span className="badge badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> نسبتاً مؤثر</span>;
      case "ineffective":
        return <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><XCircle size={12} /> نامؤثر / معیوب</span>;
      default:
        return <span className="badge badge-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> آزمایش‌نشده</span>;
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h2>مدیریت ریسک، خطرات و ایمنی فرآیند</h2>
          <p className="subtitle">
            ارزیابی ریسک، ماتریس ۵×۵، مدل‌سازی موانع در نمودار پاپیونی (BowTie) و ماتریس کنترل HCMS
          </p>
        </div>
        <div className="header-actions">
          {organizations.length > 1 && (
            <select
              aria-label="انتخاب سازمان"
              value={organizationId ?? ""}
              onChange={(e) => setOrganizationId(Number(e.target.value))}
              className="select-input"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs-nav" style={{ marginBottom: "1.5rem" }}>
        <button
          className={`tab-btn ${activeTab === "matrix" ? "active" : ""}`}
          onClick={() => setActiveTab("matrix")}
        >
          <Table size={16} /> شناسایی خطر و ارزیابی ریسک
        </button>
        <button
          className={`tab-btn ${activeTab === "bowtie" ? "active" : ""}`}
          onClick={() => setActiveTab("bowtie")}
        >
          <GitBranch size={16} /> نمودارهای پاپیونی (BowTie)
        </button>
        <button
          className={`tab-btn ${activeTab === "hcms" ? "active" : ""}`}
          onClick={() => setActiveTab("hcms")}
        >
          <Layers size={16} /> ماتریس کنترل خطر (HCMS)
        </button>
        <button
          className={`tab-btn ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          <BarChart3 size={16} /> داشبورد پایش سلامت موانع
        </button>
      </div>

      {loading && <p className="loading">در حال بارگذاری…</p>}
      {error && <p className="alert alert-error">{error}</p>}

      {/* TAB 1: Traditional Hazard Registry & Risk Matrix */}
      {activeTab === "matrix" && (
        <div className="stack">
          {/* Reassessment Alert if any hazards require reassessment */}
          {hazards.some((h) => (h as any).reassessment_needed) && (
            <div className="alert alert-warning" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <ShieldAlert size={28} className="text-warning" />
              <div>
                <strong>هشدار بازنگری الزامی ریسک:</strong>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>
                  برخی خطرات به دلیل گزارش خرابی موانع کنترلی بحرانی یا وقوع حادثه نیازمند ارزیابی مجدد هستند.
                </p>
              </div>
            </div>
          )}

          <section className="card">
            <h2>خطرها</h2>
            <div className="filters-card" style={{ marginBottom: "1rem" }}>
              <div className="filter-grid">
                <label htmlFor="filter-category">دسته‌بندی</label>
                <select
                  id="filter-category"
                  value={filters.category}
                  onChange={(event) => setFilters({ ...filters, category: event.target.value })}
                >
                  <option value="">همه</option>
                  {HAZARD_CATEGORIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <label htmlFor="filter-level">سطح ریسک</label>
                <select
                  id="filter-level"
                  value={filters.level}
                  onChange={(event) => setFilters({ ...filters, level: event.target.value })}
                >
                  <option value="">همه</option>
                  <option value="low">کم</option>
                  <option value="medium">متوسط</option>
                  <option value="high">زیاد</option>
                  <option value="critical">بحرانی</option>
                </select>
              </div>
            </div>

            {visibleHazards.length === 0 ? (
              <p className="muted">خطری ثبت نشده است.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>عنوان</th>
                    <th>دسته‌بندی</th>
                    <th>محل کار</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHazards.map((hazard) => (
                    <tr key={hazard.id}>
                      <td>{hazard.title}</td>
                      <td>{hazard.category_display}</td>
                      <td>
                        {workplaces.find((wp) => wp.id === hazard.workplace)?.name ?? "—"}
                      </td>
                      <td>{hazard.status_display}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            setHazardForm({
                              id: hazard.id,
                              title: hazard.title,
                              description: hazard.description,
                              category: hazard.category,
                              source: hazard.source,
                              causes: hazard.causes,
                              consequences: hazard.consequences,
                              exposed_persons: hazard.exposed_persons,
                              existing_controls: hazard.existing_controls,
                              workplace: hazard.workplace ? String(hazard.workplace) : "",
                              status: hazard.status,
                            })
                          }
                        >
                          ویرایش
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>{hazardForm.id === null ? "ثبت خطر جدید" : "ویرایش خطر"}</h2>
            <form className="stack" onSubmit={submitHazard}>
              <label htmlFor="title">عنوان</label>
              <input
                id="title"
                required
                value={hazardForm.title}
                onChange={(event) => setHazardForm({ ...hazardForm, title: event.target.value })}
              />

              <label htmlFor="description">شرح</label>
              <textarea
                id="description"
                value={hazardForm.description}
                onChange={(event) => setHazardForm({ ...hazardForm, description: event.target.value })}
              />

              <label htmlFor="category">دسته‌بندی</label>
              <select
                id="category"
                value={hazardForm.category}
                onChange={(event) => setHazardForm({ ...hazardForm, category: event.target.value })}
              >
                {HAZARD_CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label htmlFor="workplace">محل کار</label>
              <select
                id="workplace"
                value={hazardForm.workplace}
                onChange={(event) => setHazardForm({ ...hazardForm, workplace: event.target.value })}
              >
                <option value="">—</option>
                {workplaces.map((workplace) => (
                  <option key={workplace.id} value={workplace.id}>
                    {workplace.name}
                  </option>
                ))}
              </select>

              <label htmlFor="source">منبع خطر</label>
              <input
                id="source"
                value={hazardForm.source}
                onChange={(event) => setHazardForm({ ...hazardForm, source: event.target.value })}
              />

              <label htmlFor="causes">علل</label>
              <textarea
                id="causes"
                value={hazardForm.causes}
                onChange={(event) => setHazardForm({ ...hazardForm, causes: event.target.value })}
              />

              <label htmlFor="consequences">پیامدها</label>
              <textarea
                id="consequences"
                value={hazardForm.consequences}
                onChange={(event) => setHazardForm({ ...hazardForm, consequences: event.target.value })}
              />

              <label htmlFor="exposed">افراد در معرض</label>
              <textarea
                id="exposed"
                value={hazardForm.exposed_persons}
                onChange={(event) =>
                  setHazardForm({ ...hazardForm, exposed_persons: event.target.value })
                }
              />

              <label htmlFor="existing-controls">کنترل‌های موجود</label>
              <textarea
                id="existing-controls"
                value={hazardForm.existing_controls}
                onChange={(event) =>
                  setHazardForm({ ...hazardForm, existing_controls: event.target.value })
                }
              />

              <label htmlFor="hazard-status">وضعیت</label>
              <select
                id="hazard-status"
                value={hazardForm.status}
                onChange={(event) => setHazardForm({ ...hazardForm, status: event.target.value })}
              >
                <option value="draft">پیش‌نویس</option>
                <option value="active">فعال</option>
                <option value="closed">بسته‌شده</option>
              </select>

              {formError && (
                <p className="alert alert-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? "در حال ذخیره…" : hazardForm.id === null ? "ثبت خطر" : "ذخیره تغییرات"}
                </button>
                {hazardForm.id !== null && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setHazardForm(emptyHazardForm)}
                  >
                    انصراف
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="card">
            <h2>ارزیابی ریسک</h2>
            <form className="stack" onSubmit={submitAssessment}>
              <label htmlFor="assessment-hazard">خطر</label>
              <select
                id="assessment-hazard"
                required
                value={assessmentForm.hazard}
                onChange={(event) =>
                  setAssessmentForm({ ...assessmentForm, hazard: event.target.value })
                }
              >
                <option value="">انتخاب کنید</option>
                {hazards.map((hazard) => (
                  <option key={hazard.id} value={hazard.id}>
                    {hazard.title}
                  </option>
                ))}
              </select>

              <label htmlFor="likelihood">احتمال (۱ تا ۵)</label>
              <select
                id="likelihood"
                value={assessmentForm.likelihood}
                onChange={(event) =>
                  setAssessmentForm({ ...assessmentForm, likelihood: event.target.value })
                }
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <label htmlFor="severity">شدت (۱ تا ۵)</label>
              <select
                id="severity"
                value={assessmentForm.severity}
                onChange={(event) =>
                  setAssessmentForm({ ...assessmentForm, severity: event.target.value })
                }
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <label htmlFor="proposed-controls">کنترل‌های پیشنهادی</label>
              <textarea
                id="proposed-controls"
                value={assessmentForm.proposed_controls}
                onChange={(event) =>
                  setAssessmentForm({ ...assessmentForm, proposed_controls: event.target.value })
                }
              />

              <label htmlFor="implemented-controls">کنترل‌های اجراشده</label>
              <textarea
                id="implemented-controls"
                value={assessmentForm.implemented_controls}
                onChange={(event) =>
                  setAssessmentForm({ ...assessmentForm, implemented_controls: event.target.value })
                }
              />

              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? "در حال محاسبه…" : "ثبت ارزیابی"}
                </button>
              </div>
            </form>

            {assessmentResult && (
              <p className="alert alert-success" role="status">
                امتیاز ریسک: {assessmentResult.score} — سطح: {assessmentResult.level_display}
              </p>
            )}

            {visibleAssessments.length === 0 ? (
              <p className="muted">ارزیابی‌ای ثبت نشده است.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>خطر</th>
                    <th>احتمال</th>
                    <th>شدت</th>
                    <th>امتیاز</th>
                    <th>سطح</th>
                    <th>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAssessments.map((assessment) => (
                    <tr key={assessment.id}>
                      <td>{hazards.find((hazard) => hazard.id === assessment.hazard)?.title ?? "—"}</td>
                      <td>{assessment.likelihood}</td>
                      <td>{assessment.severity}</td>
                      <td>{assessment.score}</td>
                      <td>{assessment.level_display}</td>
                      <td>{assessment.status_display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: BowTie Visualizer */}
      {activeTab === "bowtie" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label>نمودار پاپیونی فعال:</label>
              <select
                className="select-input"
                value={selectedBowTie?.id ?? ""}
                onChange={(e) => {
                  const b = bowties.find((item) => item.id === Number(e.target.value));
                  if (b) setSelectedBowTie(b);
                }}
              >
                {bowties.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.top_event} ({b.hazard_title})
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={() => setShowBowTieModal(true)}>
              <Plus size={16} /> ایجاد نمودار پاپیونی جدید
            </button>
          </div>

          {selectedBowTie ? (
            <div className="card" style={{ padding: "1.5rem", background: "var(--bg-surface)" }}>
              <div style={{ textAlign: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
                <span className="badge badge-info" style={{ marginBottom: "0.5rem" }}>
                  خطر مبنا: {selectedBowTie.hazard_title}
                </span>
                <h3 style={{ margin: "0.25rem 0", color: "var(--text-primary)" }}>{selectedBowTie.top_event}</h3>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{selectedBowTie.description}</p>
              </div>

              {/* BowTie 3-Column Diagram */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 1fr", gap: "1.5rem", alignItems: "start" }}>
                {/* LEFT COLUMN: Threats & Preventive Barriers */}
                <div style={{ background: "rgba(59, 130, 246, 0.05)", padding: "1rem", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h4 style={{ margin: 0, color: "var(--primary)" }}>تهدیدها و موانع پیشگیرانه</h4>
                    <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => setShowNewThreatModal(true)}>
                      <Plus size={12} /> افزودن تهدید
                    </button>
                  </div>

                  {selectedBowTie.threats?.map((threat) => {
                    const prevBarriers = selectedBowTie.barriers?.filter((b) => b.threat === threat.id) || [];
                    return (
                      <div key={threat.id} style={{ marginBottom: "1.25rem", padding: "0.75rem", background: "var(--bg-surface)", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between" }}>
                          <span>⚡ {threat.title}</span>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                            onClick={() => {
                              setNewBarrierForm({ ...newBarrierForm, barrier_type: "preventive", threat_id: String(threat.id) });
                              setShowNewBarrierModal(true);
                            }}
                          >
                            + مانع
                          </button>
                        </div>
                        {prevBarriers.map((bar) => (
                          <div
                            key={bar.id}
                            style={{
                              margin: "6px 0",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              background: bar.current_effectiveness === "ineffective" ? "rgba(239, 68, 68, 0.15)" : "var(--bg-card)",
                              border: bar.is_critical ? "1px solid var(--danger)" : "1px solid var(--border-color)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>🛡️ {bar.name}</span>
                              {bar.is_critical && <span className="badge badge-danger" style={{ marginRight: 6, fontSize: "0.65rem" }}>SCE حیاتی</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {getEffectivenessBadge(bar.current_effectiveness)}
                              <button
                                className="btn btn-secondary"
                                style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                                onClick={() => {
                                  setSelectedBarrierForAssess(bar);
                                  setShowBarrierAssessModal(true);
                                }}
                              >
                                ارزیابی
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* CENTER COLUMN: Top Event Knot */}
                <div style={{ textAlign: "center", padding: "1.5rem 1rem", background: "rgba(239, 68, 68, 0.08)", borderRadius: "12px", border: "2px solid var(--danger)", boxShadow: "0 0 15px rgba(239, 68, 68, 0.15)" }}>
                  <ShieldAlert size={40} className="text-danger" style={{ margin: "0 auto 0.5rem" }} />
                  <div style={{ fontSize: "0.8rem", color: "var(--danger)", fontWeight: 700, textTransform: "uppercase" }}>
                    رویداد کانونی (Top Event)
                  </div>
                  <h4 style={{ margin: "0.5rem 0", fontSize: "1rem" }}>{selectedBowTie.top_event}</h4>
                  <div className="badge badge-secondary" style={{ marginTop: "0.5rem" }}>
                    وضعیت: {selectedBowTie.status_display}
                  </div>
                </div>

                {/* RIGHT COLUMN: Consequences & Mitigative Barriers */}
                <div style={{ background: "rgba(245, 158, 11, 0.05)", padding: "1rem", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h4 style={{ margin: 0, color: "var(--warning)" }}>پیامدها و موانع کاهنده</h4>
                    <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => setShowNewConsequenceModal(true)}>
                      <Plus size={12} /> افزودن پیامد
                    </button>
                  </div>

                  {selectedBowTie.consequences?.map((csq) => {
                    const mitBarriers = selectedBowTie.barriers?.filter((b) => b.consequence === csq.id) || [];
                    return (
                      <div key={csq.id} style={{ marginBottom: "1.25rem", padding: "0.75rem", background: "var(--bg-surface)", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between" }}>
                          <span>💥 {csq.title}</span>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                            onClick={() => {
                              setNewBarrierForm({ ...newBarrierForm, barrier_type: "mitigative", consequence_id: String(csq.id) });
                              setShowNewBarrierModal(true);
                            }}
                          >
                            + مانع
                          </button>
                        </div>
                        {mitBarriers.map((bar) => (
                          <div
                            key={bar.id}
                            style={{
                              margin: "6px 0",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              background: bar.current_effectiveness === "ineffective" ? "rgba(239, 68, 68, 0.15)" : "var(--bg-card)",
                              border: bar.is_critical ? "1px solid var(--danger)" : "1px solid var(--border-color)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>🧯 {bar.name}</span>
                              {bar.is_critical && <span className="badge badge-danger" style={{ marginRight: 6, fontSize: "0.65rem" }}>SCE حیاتی</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {getEffectivenessBadge(bar.current_effectiveness)}
                              <button
                                className="btn btn-secondary"
                                style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                                onClick={() => {
                                  setSelectedBarrierForAssess(bar);
                                  setShowBarrierAssessModal(true);
                                }}
                              >
                                ارزیابی
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">هیچ نمودار پاپیونی ثبت نشده است. با دکمه بالا اولین نمودار را ایجاد کنید.</p>
          )}
        </div>
      )}

      {/* TAB 3: HCMS Control Matrix */}
      {activeTab === "hcms" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>ماتریس سلسله‌مراتب کنترل خطر (Hazard Control Management)</h3>
            <button className="btn btn-primary" onClick={() => setShowHcmsModal(true)}>
              <Plus size={16} /> ثبت کنترل جدید در HCMS
            </button>
          </div>

          <div className="card">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>عنوان اقدام کنترلی</th>
                    <th>خطر مرتبط</th>
                    <th>سلسله‌مراتب کنترل</th>
                    <th>وضعیت پیاده‌سازی</th>
                    <th>ریسک اولیه</th>
                    <th>احتمال باقیمانده</th>
                    <th>شدت باقیمانده</th>
                    <th>ریسک باقیمانده (Residual)</th>
                    <th>دوره بازنگری (روز)</th>
                  </tr>
                </thead>
                <tbody>
                  {hcmsControls.map((ctrl) => (
                    <tr key={ctrl.id}>
                      <td><strong>{ctrl.control_title}</strong></td>
                      <td>{ctrl.hazard_title}</td>
                      <td>
                        <span className="badge badge-info">{ctrl.hierarchy_display}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${ctrl.implementation_status === "implemented" ? "success" : ctrl.implementation_status === "failed" ? "danger" : "warning"}`}>
                          {ctrl.status_display}
                        </span>
                      </td>
                      <td>{ctrl.initial_risk_score}</td>
                      <td>{ctrl.residual_likelihood}</td>
                      <td>{ctrl.residual_severity}</td>
                      <td>
                        <span className={`badge badge-${ctrl.residual_level === "critical" ? "danger" : ctrl.residual_level === "high" ? "warning" : ctrl.residual_level === "medium" ? "info" : "success"}`}>
                          {ctrl.residual_score} ({ctrl.residual_level_display})
                        </span>
                      </td>
                      <td>{ctrl.review_frequency_days} روز</td>
                    </tr>
                  ))}
                  {hcmsControls.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        هنوز موردی در ماتریس کنترل ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Barrier Health Dashboard */}
      {activeTab === "summary" && riskSummary && (
        <div>
          <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
            <div className="stat-card">
              <div className="stat-value">{riskSummary.total_bowties}</div>
              <div className="stat-label">تعداد نمودارهای پاپیونی</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{riskSummary.total_barriers}</div>
              <div className="stat-label">کل موانع کنترلی تعریف‌شده</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "var(--danger)" }}>{riskSummary.critical_barriers}</div>
              <div className="stat-label">موانع ایمنی بحرانی (SCE)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: riskSummary.failed_critical_barriers > 0 ? "var(--danger)" : "var(--success)" }}>
                {riskSummary.failed_critical_barriers}
              </div>
              <div className="stat-label">موانع بحرانی معیوب (هشدار فوری)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{riskSummary.total_controls}</div>
              <div className="stat-label">کل اقدامات کنترلی HCMS</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{riskSummary.reassessment_needed_count}</div>
              <div className="stat-label">خطرات نیازمند بازنگری</div>
            </div>
          </div>

          <div className="card" style={{ padding: "1.5rem" }}>
            <h3>توصیه‌های ایمنی فرآیند و تحلیل یکپارچگی موانع</h3>
            <ul style={{ lineHeight: 1.8, paddingRight: "1.25rem", margin: 0 }}>
              <li>
                <strong>قانون بازنگری خودکار:</strong> هرگاه یک مانع کنترلی ایمنی بحرانی (SCE) در آزمون دوره‌ای معیوب یا نامؤثر ارزیابی شود، بلافاصله خطر والد پرچم‌گذاری شده و در فرم ارزیابی ریسک نیازمند بازنگری فوری اعلام می‌گردد.
              </li>
              <li>
                <strong>کاهش ریسک با موانع مهندسی:</strong> موانع کنترلی از نوع مهندسی و سخت‌افزاری بر اساس استاندارد بیش از ۷۰٪ ریسک باقیمانده را نسبت به کنترل‌های اداری کاهش می‌دهند.
              </li>
              <li>
                <strong>پایش تجهیزات وابسته:</strong> وضعیت کالیبراسیون و دستورکارهای تعمیراتی تجهیزات متصل به موانع کنترلی به صورت آنی در پنل نگهداری رصد می‌شوند.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* MODAL 1: Create BowTie */}
      {showBowTieModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>ایجاد نمودار پاپیونی جدید</h3>
              <button className="btn btn-ghost" onClick={() => setShowBowTieModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateBowTie}>
              <label>انتخاب خطر متناظر:</label>
              <select
                required
                value={newBowTie.hazard}
                onChange={(e) => setNewBowTie({ ...newBowTie, hazard: e.target.value })}
              >
                <option value="">انتخاب خطر</option>
                {hazards.map((h) => (
                  <option key={h.id} value={h.id}>{h.title}</option>
                ))}
              </select>
              <label style={{ marginTop: "0.5rem" }}>رویداد کانونی (Top Event):</label>
              <input
                type="text"
                required
                placeholder="مثال: نشت گاز متان از شیر فشارشکن"
                value={newBowTie.top_event}
                onChange={(e) => setNewBowTie({ ...newBowTie, top_event: e.target.value })}
              />
              <label style={{ marginTop: "0.5rem" }}>توضیحات تکمیلی:</label>
              <textarea
                rows={2}
                value={newBowTie.description}
                onChange={(e) => setNewBowTie({ ...newBowTie, description: e.target.value })}
              />
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBowTieModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>ایجاد نمودار</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Assess Barrier */}
      {showBarrierAssessModal && selectedBarrierForAssess && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>ارزیابی اثربخشی مانع کنترلی</h3>
              <button className="btn btn-ghost" onClick={() => setShowBarrierAssessModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAssessBarrierSubmit}>
              <p>مانع: <strong>{selectedBarrierForAssess.name}</strong></p>
              {selectedBarrierForAssess.is_critical && (
                <div className="alert alert-warning" style={{ fontSize: "0.85rem", margin: "0.5rem 0" }}>
                  توجه: این مانع یک عنصر ایمنی بحرانی (SCE) است. ارزیابی نامؤثر، منجر به اعلام هشدار بازنگری در خطر خواهد شد.
                </div>
              )}
              <label>نتیجه ارزیابی اثربخشی:</label>
              <select
                value={barrierAssessForm.effectiveness}
                onChange={(e) => setBarrierAssessForm({ ...barrierAssessForm, effectiveness: e.target.value as any })}
              >
                <option value="effective">مؤثر (Effective)</option>
                <option value="partially_effective">تا حدودی مؤثر (Partially Effective)</option>
                <option value="ineffective">نامؤثر / معیوب (Ineffective)</option>
                <option value="not_tested">آزمایش‌نشده</option>
              </select>
              <label style={{ marginTop: "0.5rem" }}>تاریخ ارزیابی:</label>
              <input
                type="date"
                required
                value={barrierAssessForm.assessment_date}
                onChange={(e) => setBarrierAssessForm({ ...barrierAssessForm, assessment_date: e.target.value })}
              />
              <label style={{ marginTop: "0.5rem" }}>مستند یا شماره آزمون مرجع:</label>
              <input
                type="text"
                placeholder="مثال: گزارش تست دوره‌ای PM-881"
                value={barrierAssessForm.evidence_reference}
                onChange={(e) => setBarrierAssessForm({ ...barrierAssessForm, evidence_reference: e.target.value })}
              />
              <label style={{ marginTop: "0.5rem" }}>یادداشت‌های ارزیاب:</label>
              <textarea
                rows={2}
                value={barrierAssessForm.notes}
                onChange={(e) => setBarrierAssessForm({ ...barrierAssessForm, notes: e.target.value })}
              />
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBarrierAssessModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>ثبت ارزیابی</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Threat */}
      {showNewThreatModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>افزودن تهدید جدید</h3>
              <button className="btn btn-ghost" onClick={() => setShowNewThreatModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddThreat}>
              <label>عنوان تهدید:</label>
              <input
                type="text"
                required
                placeholder="مثال: خوردگی شدید خط لوله انتقال گاز"
                value={newThreatTitle}
                onChange={(e) => setNewThreatTitle(e.target.value)}
              />
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewThreatModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>ثبت تهدید</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Consequence */}
      {showNewConsequenceModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>افزودن پیامد جدید</h3>
              <button className="btn btn-ghost" onClick={() => setShowNewConsequenceModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddConsequence}>
              <label>عنوان پیامد رویداد کانونی:</label>
              <input
                type="text"
                required
                placeholder="مثال: حریق گسترده کارگاه و توقف تولید"
                value={newConsequenceTitle}
                onChange={(e) => setNewConsequenceTitle(e.target.value)}
              />
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewConsequenceModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>ثبت پیامد</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Add Barrier */}
      {showNewBarrierModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>افزودن مانع کنترلی ({newBarrierForm.barrier_type === "preventive" ? "پیشگیرانه" : "کاهنده"})</h3>
              <button className="btn btn-ghost" onClick={() => setShowNewBarrierModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddBarrier}>
              <label>نام مانع:</label>
              <input
                type="text"
                required
                placeholder="مثال: شیر قطع اضطراری ESD"
                value={newBarrierForm.name}
                onChange={(e) => setNewBarrierForm({ ...newBarrierForm, name: e.target.value })}
              />
              <label style={{ marginTop: "0.5rem" }}>ماهیت مانع:</label>
              <select
                value={newBarrierForm.nature}
                onChange={(e) => setNewBarrierForm({ ...newBarrierForm, nature: e.target.value as any })}
              >
                <option value="engineering">مهندسی</option>
                <option value="administrative">مدیریتی / رویه‌ای</option>
                <option value="physical">فیزیکی / ساختمانی</option>
                <option value="human_action">اقدام اپراتوری انسانی</option>
              </select>
              <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="crit_barrier"
                  checked={newBarrierForm.is_critical}
                  onChange={(e) => setNewBarrierForm({ ...newBarrierForm, is_critical: e.target.checked })}
                />
                <label htmlFor="crit_barrier" style={{ margin: 0, fontWeight: 600 }}>
                  عنصر ایمنی بحرانی (Safety Critical Element)
                </label>
              </div>
              <label style={{ marginTop: "0.5rem" }}>توضیحات عملکرد:</label>
              <textarea
                rows={2}
                value={newBarrierForm.description}
                onChange={(e) => setNewBarrierForm({ ...newBarrierForm, description: e.target.value })}
              />
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewBarrierModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>ثبت مانع</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Add HCMS Control */}
      {showHcmsModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>ثبت کنترل جدید در ماتریس HCMS</h3>
              <button className="btn btn-ghost" onClick={() => setShowHcmsModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateHcmsSubmit}>
              <label>انتخاب خطر:</label>
              <select
                required
                value={newHcmsForm.hazard}
                onChange={(e) => setNewHcmsForm({ ...newHcmsForm, hazard: e.target.value })}
              >
                <option value="">انتخاب خطر</option>
                {hazards.map((h) => (
                  <option key={h.id} value={h.id}>{h.title}</option>
                ))}
              </select>
              <label style={{ marginTop: "0.5rem" }}>عنوان اقدام کنترلی:</label>
              <input
                type="text"
                required
                placeholder="مثال: نصب سامانه تشخیص گاز مادون قرمز"
                value={newHcmsForm.control_title}
                onChange={(e) => setNewHcmsForm({ ...newHcmsForm, control_title: e.target.value })}
              />
              <label style={{ marginTop: "0.5rem" }}>سلسله‌مراتب کنترل:</label>
              <select
                value={newHcmsForm.hierarchy_of_control}
                onChange={(e) => setNewHcmsForm({ ...newHcmsForm, hierarchy_of_control: e.target.value as any })}
              >
                <option value="elimination">حذف کامل خطر</option>
                <option value="substitution">جایگزینی با فرآیند کم‌خطر</option>
                <option value="engineering">کنترل مهندسی و ایزولاسیون</option>
                <option value="administrative">کنترل اداری و دستورالعمل</option>
                <option value="ppe">تجهیزات حفاظت فردی (PPE)</option>
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.5rem" }}>
                <label>
                  احتمال باقیمانده (۱-۵):
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={newHcmsForm.residual_likelihood}
                    onChange={(e) => setNewHcmsForm({ ...newHcmsForm, residual_likelihood: Number(e.target.value) })}
                  />
                </label>
                <label>
                  شدت باقیمانده (۱-۵):
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={newHcmsForm.residual_severity}
                    onChange={(e) => setNewHcmsForm({ ...newHcmsForm, residual_severity: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label style={{ marginTop: "0.5rem" }}>دوره بازنگری دوره‌ای (روز):</label>
              <input
                type="number"
                min={30}
                max={365}
                value={newHcmsForm.review_frequency_days}
                onChange={(e) => setNewHcmsForm({ ...newHcmsForm, review_frequency_days: Number(e.target.value) })}
              />
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowHcmsModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>ثبت در ماتریس</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
