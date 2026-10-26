import { ShieldAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  analyzeWorkplaceWithAi,
  applyAiChecklist,
  applyAiHazard,
  fetchAiStatus,
  fetchOrganizations,
  fetchWorkplaces,
  suggestChecklistWithAi,
  suggestControlsWithAi,
  ApiRequestError,
  type AiChecklistSuggestion,
  type AiHierarchyControls,
  type AiStatus,
  type AiWorkplaceAnalysis,
  type Organization,
  type Workplace,
} from "../../services/api";

function errorMessage(error: unknown) {
  return error instanceof ApiRequestError ? error.message : "خطای نامشخص در ارتباط با سرور";
}

export function AiAssistantPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);

  const [activeTab, setActiveTab] = useState<"workplace" | "checklist" | "hierarchy">("workplace");
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  // TAB 1: Workplace
  const [selectedWorkplace, setSelectedWorkplace] = useState<string>("");
  const [activityDesc, setActivityDesc] = useState("");
  const [equipment, setEquipment] = useState("");
  const [materials, setMaterials] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AiWorkplaceAnalysis | null>(null);
  const [appliedHazards, setAppliedHazards] = useState<Record<number, boolean>>({});

  // TAB 2: Checklist
  const [focusArea, setFocusArea] = useState("");
  const [checklistTitleHint, setChecklistTitleHint] = useState("");
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [checklistResult, setChecklistResult] = useState<AiChecklistSuggestion | null>(null);
  const [appliedChecklist, setAppliedChecklist] = useState(false);

  // TAB 3: Hierarchy
  const [hazardTitle, setHazardTitle] = useState("");
  const [hazardCategory, setHazardCategory] = useState("safety");
  const [hazardDesc, setHazardDesc] = useState("");
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlsError, setControlsError] = useState<string | null>(null);
  const [controlsResult, setControlsResult] = useState<AiHierarchyControls | null>(null);

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
    const controller = new AbortController();
    fetchAiStatus(organizationId ?? undefined, controller.signal)
      .then(setAiStatus)
      .catch(() => {});

    if (organizationId) {
      fetchWorkplaces(organizationId, controller.signal)
        .then(setWorkplaces)
        .catch(() => {});
    } else {
      setWorkplaces([]);
    }

    return () => controller.abort();
  }, [organizationId]);

  const handleAnalyzeWorkplace = async (e: FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAppliedHazards({});

    try {
      const res = await analyzeWorkplaceWithAi({
        organization_id: organizationId,
        workplace_id: selectedWorkplace ? Number(selectedWorkplace) : null,
        activity_description: activityDesc,
        equipment,
        materials,
      });
      setAnalysisResult(res);
    } catch (err) {
      setAnalysisError(errorMessage(err));
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleApplyHazard = async (index: number) => {
    if (!organizationId || !analysisResult) return;
    const item = analysisResult.hazards[index];
    try {
      await applyAiHazard({
        organization_id: organizationId,
        workplace_id: selectedWorkplace ? Number(selectedWorkplace) : null,
        title: item.title,
        category: item.category,
        causes: item.causes,
        consequences: item.consequences,
        existing_controls: item.existing_controls_hint,
      });
      setAppliedHazards((prev) => ({ ...prev, [index]: true }));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleSuggestChecklist = async (e: FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    setChecklistLoading(true);
    setChecklistError(null);
    setAppliedChecklist(false);

    try {
      const res = await suggestChecklistWithAi({
        organization_id: organizationId,
        focus_area: focusArea,
        title_hint: checklistTitleHint,
      });
      setChecklistResult(res);
    } catch (err) {
      setChecklistError(errorMessage(err));
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleApplyChecklist = async () => {
    if (!organizationId || !checklistResult) return;
    try {
      await applyAiChecklist({
        organization_id: organizationId,
        title: checklistResult.suggested_title,
        description: checklistResult.suggested_description,
        items: checklistResult.items.map((it) => ({
          order: it.order,
          text: it.citation ? `${it.text} (استناد: ${it.citation})` : it.text,
          is_required: it.is_required,
        })),
      });
      setAppliedChecklist(true);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleSuggestControls = async (e: FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    setControlsLoading(true);
    setControlsError(null);

    try {
      const res = await suggestControlsWithAi({
        organization_id: organizationId,
        hazard_title: hazardTitle,
        category: hazardCategory,
        description: hazardDesc,
      });
      setControlsResult(res);
    } catch (err) {
      setControlsError(errorMessage(err));
    } finally {
      setControlsLoading(false);
    }
  };

  return (
    <div className="ai-assistant-page stack" dir="rtl" style={{ display: "grid", gap: "1.5rem" }}>
      {/* Header */}
      <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h2>دستیار هوشمند و تحلیلی HSE Guard</h2>
            <span
              style={{
                backgroundColor: "var(--primary-soft, #e3f2ee)",
                color: "var(--primary, #0f6b57)",
                padding: "0.15rem 0.5rem",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: "bold",
              }}
            >
              مبتنی بر شواهد مقرراتی
            </span>
          </div>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            شناسایی هوشمند مخاطرات، تدوین چک‌لیست بازرسی و پیشنهاد لایه‌های کنترلی با استناد مستقیم به پایگاه دانش
          </p>
        </div>

        {aiStatus && (
          <div
            className="card"
            style={{
              padding: "0.5rem 0.85rem",
              fontSize: "0.75rem",
              display: "grid",
              gap: "0.2rem",
              backgroundColor: "var(--surface, #fff)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981" }} />
              <strong>{aiStatus.engine_label}</strong>
            </div>
            <span className="muted">{aiStatus.verified_regulations_count} منبع و آیین‌نامه فعال در حافظه تحلیلی</span>
          </div>
        )}
      </header>

      {/* Advisory Banner */}
      <div className="alert alert-warning" style={{ alignItems: "flex-start", gap: "0.75rem", lineHeight: "1.7" }}>
        <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: "0.2rem" }} />
        <div>
          <strong>الزام نظارت و اعتبارسنجی انسانی (Human-in-the-Loop):</strong>
          <p style={{ margin: "0.2rem 0 0" }}>
            کلیه پیشنهادات این سامانه مشورتی بوده و تصمیم‌گیری نهایی مستلزم بررسی میدانی و تأیید کارشناس HSE است.
          </p>
        </div>
      </div>

      {/* Organization selector if multiple */}
      {organizations.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--muted, #5b6b7a)" }}>سازمان انتخابی:</label>
          <select
            value={organizationId ?? ""}
            onChange={(e) => setOrganizationId(Number(e.target.value))}
            style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tab Buttons */}
      <div className="tabs-nav">
        <button
          type="button"
          onClick={() => setActiveTab("workplace")}
          className={`tab-btn ${activeTab === "workplace" ? "active" : ""}`}
        >
          تحلیل مخاطرات محیط کار
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("checklist")}
          className={`tab-btn ${activeTab === "checklist" ? "active" : ""}`}
        >
          پیشنهاد چک‌لیست بازرسی
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("hierarchy")}
          className={`tab-btn ${activeTab === "hierarchy" ? "active" : ""}`}
        >
          سلسله‌مراتب کنترل خطر (ISO 45001)
        </button>
      </div>

      {/* TAB 1: WORKPLACE */}
      {activeTab === "workplace" && (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <form onSubmit={handleAnalyzeWorkplace} className="card" style={{ padding: "1.5rem", maxWidth: "100%", display: "grid", gap: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>مشخصات عملیات و محیط کار مورد بررسی</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>محل کار</label>
                <select
                  value={selectedWorkplace}
                  onChange={(e) => setSelectedWorkplace(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                >
                  <option value="">انتخاب محل کار (اختیاری)</option>
                  {workplaces.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>تجهیزات و ماشین‌آلات</label>
                <input
                  type="text"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="مثال: داربست فلزی، فرز..."
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>مواد یا مواد شیمیایی</label>
                <input
                  type="text"
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="مثال: رنگ، تینر، الکترود..."
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="activity-desc" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>شرح فرآیند و شرایط محیطی *</label>
              <textarea
                id="activity-desc"
                rows={3}
                required
                value={activityDesc}
                onChange={(e) => setActivityDesc(e.target.value)}
                placeholder="مثال: کار روی داربست فلزی در ارتفاع ۸ متری و سیم‌کشی تأسیسات برق..."
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted, #5b6b7a)", display: "flex", gap: "0.5rem" }}>
                <span>نمونه آماده:</span>
                <button
                  type="button"
                  onClick={() => {
                    setActivityDesc("کار روی داربست فلزی در ارتفاع ۸ متری و کابل‌کشی تأسیسات برق");
                    setEquipment("داربست، کابل برق، فرز");
                  }}
                  style={{ background: "none", border: "none", color: "var(--primary, #0f6b57)", cursor: "pointer", textDecoration: "underline" }}
                >
                  داربست و برق
                </button>
              </div>

              <button
                type="submit"
                disabled={analysisLoading}
                style={{
                  backgroundColor: "var(--primary, #0f6b57)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "0.6rem 1.25rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {analysisLoading ? "در حال تحلیل و استخراج مقررات..." : "⚡ تحلیل و استخراج مخاطرات"}
              </button>
            </div>
          </form>

          {analysisError && <div className="alert alert-error">{analysisError}</div>}

          {analysisResult && (
            <div style={{ display: "grid", gap: "1rem" }}>
              {/* Grounded sources reference banner */}
              <div className="card" style={{ padding: "1rem", maxWidth: "100%" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: "bold", display: "block", marginBottom: "0.5rem" }}>
                  مواد قانونی و استانداردهای حقوقی ملاک عمل:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {analysisResult.grounded_sources.map((src) => (
                    <span
                      key={src.id}
                      style={{
                        backgroundColor: "var(--bg, #f4f6f8)",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        border: "1px solid var(--border, #d9e0e7)",
                      }}
                    >
                      <strong>{src.code}</strong> — {src.title}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hazards list */}
              {analysisResult.hazards.map((item, idx) => {
                const isApplied = appliedHazards[idx];
                return (
                  <div key={idx} className="card" style={{ padding: "1.25rem", maxWidth: "100%", display: "grid", gap: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                          <span
                            style={{
                              backgroundColor: "#fee2e2",
                              color: "#991b1b",
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: "bold",
                            }}
                          >
                            مخاطره #{idx + 1}
                          </span>
                          <span className="muted" style={{ fontSize: "0.8rem" }}>دسته‌بندی: {item.category}</span>
                          <span style={{ backgroundColor: "#fef3c7", color: "#92400e", padding: "0.15rem 0.45rem", borderRadius: "4px", fontSize: "0.75rem" }}>
                            احتمال: {item.suggested_likelihood} | شدت: {item.suggested_severity}
                          </span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: "1.05rem" }}>{item.title}</h4>
                      </div>

                      <div>
                        {isApplied ? (
                          <span style={{ color: "#166534", fontWeight: "bold", fontSize: "0.85rem" }}>
                            ✓ در بانک مخاطرات ذخیره شد
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyHazard(idx)}
                            style={{
                              padding: "0.35rem 0.75rem",
                              borderRadius: "6px",
                              border: "1px solid var(--primary, #0f6b57)",
                              backgroundColor: "var(--primary-soft, #e3f2ee)",
                              color: "var(--primary, #0f6b57)",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: "bold",
                            }}
                          >
                            + تأیید و ثبت در بانک مخاطرات
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.85rem" }}>
                      <div>
                        <strong>علل ریشه‌ای: </strong>
                        <span className="muted">{item.causes}</span>
                      </div>
                      <div>
                        <strong>پیامدهای بالقوه: </strong>
                        <span className="muted">{item.consequences}</span>
                      </div>
                    </div>

                    <div style={{ backgroundColor: "var(--bg, #f4f6f8)", padding: "0.75rem", borderRadius: "6px", fontSize: "0.85rem" }}>
                      <div>
                        <strong>پیشنهاد کنترل‌های اولیه: </strong>
                        <span>{item.existing_controls_hint}</span>
                      </div>
                      <div style={{ marginTop: "0.35rem" }}>
                        <strong>استناد قانونی: </strong>
                        <span style={{ color: "var(--primary, #0f6b57)", fontWeight: "bold" }}>{item.regulation_reference}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CHECKLIST */}
      {activeTab === "checklist" && (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <form onSubmit={handleSuggestChecklist} className="card" style={{ padding: "1.5rem", maxWidth: "100%", display: "grid", gap: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>تدوین چک‌لیست بازرسی مبتنی بر استانداردها</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label htmlFor="focus-area" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>حوزه یا عملیات بازرسی *</label>
                <input
                  id="focus-area"
                  type="text"
                  required
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  placeholder="مثال: کار در ارتفاع، برق، ماشین‌آلات..."
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>عنوان پیشنهادی</label>
                <input
                  type="text"
                  value={checklistTitleHint}
                  onChange={(e) => setChecklistTitleHint(e.target.value)}
                  placeholder="مثال: چک‌لیست بازرسی روزانه داربست"
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={checklistLoading}
                style={{
                  backgroundColor: "var(--primary, #0f6b57)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "0.6rem 1.25rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {checklistLoading ? "در حال تدوین چک‌لیست..." : "📋 تولید پیش‌نویس چک‌لیست"}
              </button>
            </div>
          </form>

          {checklistError && <div className="alert alert-error">{checklistError}</div>}

          {checklistResult && (
            <div className="card" style={{ padding: "1.5rem", maxWidth: "100%", display: "grid", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.1rem" }}>{checklistResult.suggested_title}</h4>
                  <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>{checklistResult.suggested_description}</p>
                </div>
                <div>
                  {appliedChecklist ? (
                    <span style={{ color: "#166534", fontWeight: "bold", fontSize: "0.85rem" }}>
                      ✓ چک‌لیست در سامانه ثبت شد
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyChecklist}
                      style={{
                        backgroundColor: "var(--primary, #0f6b57)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "0.5rem 1rem",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "0.85rem",
                      }}
                    >
                      ایجاد رسمی چک‌لیست در سامانه
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                {checklistResult.items.map((it) => (
                  <div
                    key={it.order}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border, #d9e0e7)",
                      backgroundColor: "var(--bg, #f4f6f8)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: "var(--primary-soft, #e3f2ee)",
                        color: "var(--primary, #0f6b57)",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        flexShrink: 0,
                      }}
                    >
                      {it.order}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "0.9rem" }}>{it.text}</p>
                      {it.citation && (
                        <span style={{ fontSize: "0.75rem", color: "var(--primary, #0f6b57)", fontWeight: "bold" }}>
                          استناد: {it.citation}
                        </span>
                      )}
                    </div>
                    {it.is_required && (
                      <span style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>
                        الزامی
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HIERARCHY */}
      {activeTab === "hierarchy" && (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <form onSubmit={handleSuggestControls} className="card" style={{ padding: "1.5rem", maxWidth: "100%", display: "grid", gap: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>تدوین ۵ لایه کنترل خطر (ISO 45001 بند ۸.۱.۲)</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label htmlFor="hazard-title" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>عنوان مخاطره *</label>
                <input
                  id="hazard-title"
                  type="text"
                  required
                  value={hazardTitle}
                  onChange={(e) => setHazardTitle(e.target.value)}
                  placeholder="مثال: سقوط از ارتفاع روی داربست، شوک الکتریکی..."
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>دسته‌بندی</label>
                <select
                  value={hazardCategory}
                  onChange={(e) => setHazardCategory(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                >
                  <option value="safety">ایمنی (سقوط، ضربه، گیرافتادگی)</option>
                  <option value="physical">فیزیکی (برق، صدا، ارتعاش)</option>
                  <option value="chemical">شیمیایی (گازها، بخارات، حلال‌ها)</option>
                  <option value="ergonomic">ارگونومیک (حمل بار، وضعیت بدنی)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>شرح وضعیت خطر (اختیاری)</label>
              <textarea
                rows={2}
                value={hazardDesc}
                onChange={(e) => setHazardDesc(e.target.value)}
                placeholder="توضیحاتی در مورد شرایط وقوع خطر..."
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={controlsLoading}
                style={{
                  backgroundColor: "var(--primary, #0f6b57)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "0.6rem 1.25rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {controlsLoading ? "در حال تدوین سلسله‌مراتب..." : "🛡️ استخراج سلسله‌مراتب کنترلی"}
              </button>
            </div>
          </form>

          {controlsError && <div className="alert alert-error">{controlsError}</div>}

          {controlsResult && (
            <div className="card" style={{ padding: "1.5rem", maxWidth: "100%", display: "grid", gap: "1rem" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "1.1rem" }}>سلسله‌مراتب کنترلی: {controlsResult.hazard_title}</h4>
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                  بر مبنای استاندارد {controlsResult.standard_reference}
                </p>
              </div>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                {controlsResult.hierarchy.map((tier) => {
                  const borderColors = ["#16a34a", "#0d9488", "#0284c7", "#d97706", "#dc2626"];
                  const bgColors = ["#f0fdf4", "#f0fdfa", "#f0f9ff", "#fffbeb", "#fef2f2"];
                  const badgeColors = ["#166534", "#115e59", "#075985", "#92400e", "#991b1b"];

                  return (
                    <div
                      key={tier.tier}
                      style={{
                        padding: "1rem",
                        borderRadius: "8px",
                        borderRight: `5px solid ${borderColors[tier.tier - 1]}`,
                        borderTop: "1px solid var(--border, #d9e0e7)",
                        borderBottom: "1px solid var(--border, #d9e0e7)",
                        borderLeft: "1px solid var(--border, #d9e0e7)",
                        backgroundColor: bgColors[tier.tier - 1],
                        display: "grid",
                        gap: "0.35rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span
                          style={{
                            backgroundColor: badgeColors[tier.tier - 1],
                            color: "#fff",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            fontWeight: "bold",
                          }}
                        >
                          {tier.label}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted, #5b6b7a)" }}>
                          سطح اثربخشی: {tier.priority}
                        </span>
                      </div>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem", lineHeight: "1.7" }}>
                        {tier.recommendation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default AiAssistantPage;
