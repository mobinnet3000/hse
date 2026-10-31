import { ShieldAlert, Sparkles, ArrowLeft, RotateCw, CheckCircle, Building2, ShieldCheck, ChevronRight } from "lucide-react";
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
  fetchAIAssessments,
  fetchAIAssessment,
  createAIAssessment,
  analyzeAIAssessment,
  updateAIChecklistDraft,
  validateAIChecklistDraft,
  approveAIAssessment,
  generateRealChecklist,
  fetchAIServiceStatus,
  fetchAIStatistics,
  deleteAIAssessment,
  ApiRequestError,
  type AiChecklistSuggestion,
  type AiHierarchyControls,
  type AiStatus,
  type AiWorkplaceAnalysis,
  type Organization,
  type Workplace,
  type AIAssessmentListItem,
  type AIAssessmentDetail,
  type AIAssessmentWorkplaceData,
  type AIChecklistDraft,
  type AIServiceStatus,
  type AIAssessmentStatistics,
} from "../../services/api";

import { AIAssessmentDashboard } from "./components/AIAssessmentDashboard";
import { AssessmentWizard } from "./components/AssessmentWizard";
import { AssessmentResultsView } from "./components/AssessmentResultsView";
import { ChecklistDraftEditor } from "./components/ChecklistDraftEditor";
import { AssessmentApprovalModal } from "./components/AssessmentApprovalModal";
import { AIAnalysisProgress } from "./components/AIAnalysisProgress";

function errorMessage(error: unknown) {
  return error instanceof ApiRequestError ? error.message : "خطای نامشخص در ارتباط با سرور";
}

interface AiAssistantPageProps {
  defaultTab?: "assessments" | "workplace" | "checklist" | "hierarchy";
  mode?: "all" | "assistant" | "legacy";
}

export function AiAssistantPage({
  defaultTab = "workplace",
  mode = "all",
}: AiAssistantPageProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);

  const [activeTab, setActiveTab] = useState<"assessments" | "workplace" | "checklist" | "hierarchy">(
    mode === "assistant" ? "assessments" : defaultTab
  );
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  // ============================================================
  // PHASE 19 STATE: Intelligent Assessments & AvalAI Integration
  // ============================================================
  const [assessments, setAssessments] = useState<AIAssessmentListItem[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [aiServiceStatus, setAiServiceStatus] = useState<AIServiceStatus | null>(null);
  const [aiStatistics, setAiStatistics] = useState<AIAssessmentStatistics | null>(null);

  const [viewMode, setViewMode] = useState<"dashboard" | "wizard" | "detail">("dashboard");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<AIAssessmentDetail | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<"hazards" | "checklist" | "workplace_data">("hazards");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isValidatingDraft, setIsValidatingDraft] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [generatedChecklistNotice, setGeneratedChecklistNotice] = useState<{
    id: number;
    title: string;
    items_count: number;
  } | null>(null);

  // ============================================================
  // LEGACY TABS STATE: Preserved for 100% backward compatibility
  // ============================================================
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

  // Load organizations
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

  // Load workplaces & legacy status
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

  // Load Phase 19 assessments, service status, and statistics
  const reloadAssessments = () => {
    setAssessmentsLoading(true);
    const controller = new AbortController();
    const params = organizationId ? { organization: organizationId } : undefined;
    Promise.allSettled([
      fetchAIAssessments(params, controller.signal).then(setAssessments),
      fetchAIServiceStatus(controller.signal).then(setAiServiceStatus),
      fetchAIStatistics(controller.signal).then(setAiStatistics),
    ]).finally(() => {
      setAssessmentsLoading(false);
    });
  };

  useEffect(() => {
    reloadAssessments();
  }, [organizationId]);

  // Load single assessment detail
  const loadAssessmentDetail = async (id: number) => {
    try {
      const data = await fetchAIAssessment(id);
      setSelectedAssessment(data);
      setSelectedAssessmentId(id);
      setViewMode("detail");
      if (data.generated_checklist) {
        setGeneratedChecklistNotice({
          id: data.generated_checklist,
          title: data.generated_checklist_title || data.title,
          items_count: data.checklist_items_count,
        });
      }
    } catch (err) {
      alert(`خطا در بارگذاری ارزیابی: ${errorMessage(err)}`);
    }
  };

  // Submit wizard (create assessment + run AI analysis)
  const handleWizardSubmit = async (title: string, data: AIAssessmentWorkplaceData) => {
    if (!workplaces.length && !organizationId) {
      alert("سازمان یا واحد کارگاهی یافت نشد.");
      return;
    }
    const targetWpId = data.general_info.workplace_name
      ? workplaces.find((w) => w.name === data.general_info.workplace_name)?.id || workplaces[0]?.id || 1
      : workplaces[0]?.id || 1;

    setWizardSubmitting(true);
    try {
      const created = await createAIAssessment({
        workplace: targetWpId,
        title,
        workplace_data: data,
        organization: organizationId ?? undefined,
      });

      setSelectedAssessment(created);
      setSelectedAssessmentId(created.id);
      setViewMode("detail");
      setDetailSubTab("hazards");

      // Trigger AI Analysis
      setIsAnalyzing(true);
      try {
        const analyzed = await analyzeAIAssessment(created.id);
        setSelectedAssessment(analyzed);
      } catch (analErr) {
        alert(`هشدار در تحلیل هوش مصنوعی: ${errorMessage(analErr)}`);
      } finally {
        setIsAnalyzing(false);
        reloadAssessments();
      }
    } catch (err) {
      alert(`خطا در ایجاد ارزیابی: ${errorMessage(err)}`);
    } finally {
      setWizardSubmitting(false);
    }
  };

  // Re-run AI analysis on existing assessment
  const handleRerunAnalysis = async () => {
    if (!selectedAssessment) return;
    setIsAnalyzing(true);
    try {
      const updated = await analyzeAIAssessment(selectedAssessment.id);
      setSelectedAssessment(updated);
      reloadAssessments();
    } catch (err) {
      alert(`خطا در تحلیل مجدد: ${errorMessage(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save checklist draft
  const handleSaveDraft = async (draft: AIChecklistDraft) => {
    if (!selectedAssessment) return;
    setIsSavingDraft(true);
    try {
      const updatedDraft = await updateAIChecklistDraft(selectedAssessment.id, draft);
      setSelectedAssessment({
        ...selectedAssessment,
        checklist_draft: updatedDraft,
        status: "editing",
        status_display: "در حال ویرایش پیش‌نویس",
      });
      reloadAssessments();
    } catch (err) {
      alert(`خطا در ذخیره پیش‌نویس: ${errorMessage(err)}`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Validate checklist draft
  const handleValidateDraft = async () => {
    if (!selectedAssessment) return { is_valid: false, errors: ["ارزیابی معتبر نیست."] };
    setIsValidatingDraft(true);
    try {
      const res = await validateAIChecklistDraft(selectedAssessment.id);
      if (res.is_valid) {
        setSelectedAssessment({
          ...selectedAssessment,
          status: "validated",
          status_display: "اعتبارسنجی شده",
        });
        reloadAssessments();
      }
      return res;
    } catch (err) {
      return { is_valid: false, errors: [errorMessage(err)] };
    } finally {
      setIsValidatingDraft(false);
    }
  };

  // Approve & Generate real checklist
  const handleConfirmApproval = async (notes: string) => {
    if (!selectedAssessment) return;
    setIsApproving(true);
    try {
      // 1. Approve Gate
      const approved = await approveAIAssessment(selectedAssessment.id, {
        confirmed_reviewed: true,
        approval_notes: notes,
      });

      // 2. Generate Real Checklist
      const genRes = await generateRealChecklist(approved.id);

      setSelectedAssessment({
        ...approved,
        status: "checklist_generated",
        status_display: "چک‌لیست صادر شد",
        generated_checklist: genRes.checklist_id,
        generated_checklist_title: genRes.checklist_title,
      });

      setGeneratedChecklistNotice({
        id: genRes.checklist_id,
        title: genRes.checklist_title,
        items_count: genRes.items_count,
      });

      setIsApprovalModalOpen(false);
      reloadAssessments();
    } catch (err) {
      alert(`خطا در فرآیند تأیید و صدور: ${errorMessage(err)}`);
    } finally {
      setIsApproving(false);
    }
  };

  // Delete assessment
  const handleDeleteAssessment = async (id: number) => {
    if (!window.confirm("آیا از حذف این ارزیابی اطمینان دارید؟")) return;
    try {
      await deleteAIAssessment(id);
      if (selectedAssessmentId === id) {
        setSelectedAssessment(null);
        setSelectedAssessmentId(null);
        setViewMode("dashboard");
      }
      reloadAssessments();
    } catch (err) {
      alert(`خطا در حذف ارزیابی: ${errorMessage(err)}`);
    }
  };

  // ============================================================
  // LEGACY HANDLERS: Preserved for 100% backward compatibility
  // ============================================================
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
        items: checklistResult.items,
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
      {/* Header for Legacy and All modes */}
      {mode !== "assistant" && (
        <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h2>{mode === "legacy" ? "ابزارهای سریع ایمنی و مقررات پایگاه دانش" : "دستیار هوشمند و تحلیلی HSE Guard"}</h2>
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
                {mode === "legacy" ? "مقررات و استانداردهای OHS" : "مبتنی بر AvalAI و شواهد مقرراتی"}
              </span>
            </div>
            <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
              {mode === "legacy"
                ? "استخراج سریع مخاطرات، پیشنهادات چک‌لیست و بررسی سلسله‌مراتب کنترل خطر (ISO 45001)"
                : "ارزیابی جامع محیط کار، استخراج مخاطرات بر پایه AvalAI و تولید مستقیم چک‌لیست بازرسی با نظارت انسانی"}
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
      )}

      {/* Advisory Banner for legacy and all modes */}
      {mode !== "assistant" && (
        <div className="alert alert-warning" style={{ alignItems: "flex-start", gap: "0.75rem", lineHeight: "1.7" }}>
          <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: "0.2rem" }} />
          <div>
            <strong>الزام نظارت و اعتبارسنجی انسانی (Human-in-the-Loop):</strong>
            <p style={{ margin: "0.2rem 0 0" }}>
              کلیه پیشنهادات این سامانه مشورتی بوده و صدور نهایی چک‌لیست بازرسی مستلزم بررسی میدانی و تأیید صریح کارشناس/مدیر HSE است.
            </p>
          </div>
        </div>
      )}

      {/* Organization Selector */}
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

      {/* Tab Navigation Buttons - ONLY when NOT in pure assistant mode */}
      {mode !== "assistant" && (
        <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-1.5 border border-slate-200">
          {mode === "all" && (
            <button
              type="button"
              onClick={() => setActiveTab("assessments")}
              className={`tab-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "assessments"
                  ? "active bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "text-slate-700 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${activeTab === "assessments" ? "text-indigo-200" : "text-indigo-600"}`} />
              <span>ارزیابی جامع و صدور چک‌لیست (AvalAI)</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === "assessments"
                    ? "bg-white/20 text-white"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                اصلی
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("workplace")}
            className={`tab-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "workplace"
                ? "active bg-white text-slate-900 shadow-sm font-bold"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            تحلیل مخاطرات محیط کار
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("checklist")}
            className={`tab-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "checklist"
                ? "active bg-white text-slate-900 shadow-sm font-bold"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            پیشنهاد چک‌لیست بازرسی
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("hierarchy")}
            className={`tab-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "hierarchy"
                ? "active bg-white text-slate-900 shadow-sm font-bold"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            سلسله‌مراتب کنترل خطر (ISO 45001)
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* PRIMARY TAB: PHASE 19 AVALAI ASSISTANT WORKSPACE             */}
      {/* ============================================================ */}
      {activeTab === "assessments" && (
        <div className="space-y-6">
          {/* VIEW 1: DASHBOARD */}
          {viewMode === "dashboard" && (
            <AIAssessmentDashboard
              assessments={assessments}
              stats={aiStatistics}
              serviceStatus={aiServiceStatus}
              onNewAssessment={() => setViewMode("wizard")}
              onSelectAssessment={loadAssessmentDetail}
              onDeleteAssessment={handleDeleteAssessment}
              loading={assessmentsLoading}
            />
          )}

          {/* VIEW 2: 9-STEP WIZARD */}
          {viewMode === "wizard" && (
            <AssessmentWizard
              workplaces={workplaces}
              selectedWorkplaceId={selectedWorkplace ? Number(selectedWorkplace) : (workplaces[0]?.id ?? null)}
              onSelectWorkplace={(id) => setSelectedWorkplace(String(id))}
              onSubmit={handleWizardSubmit}
              onCancel={() => setViewMode("dashboard")}
              loading={wizardSubmitting}
            />
          )}

          {/* VIEW 3: DETAIL WORKSPACE */}
          {viewMode === "detail" && selectedAssessment && (
            <div className="space-y-6">
              {/* Breadcrumb & Top Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setViewMode("dashboard");
                      setSelectedAssessment(null);
                      setSelectedAssessmentId(null);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                    بازگشت به فهرست ارزیابی‌ها
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-400 rotate-180" />
                  <span className="text-xs font-bold text-slate-900">{selectedAssessment.title}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRerunAnalysis}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                    تحلیل مجدد هوش مصنوعی
                  </button>

                  <button
                    onClick={() => setIsApprovalModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    تأیید نهایی و صدور چک‌لیست رسمی
                  </button>
                </div>
              </div>

              {/* Generated Checklist Success Banner */}
              {generatedChecklistNotice && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-emerald-950">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">
                        چک‌لیست رسمی «{generatedChecklistNotice.title}» با شماره #{generatedChecklistNotice.id} صادر شد!
                      </h4>
                      <p className="text-[11px] text-emerald-800">
                        شامل {generatedChecklistNotice.items_count} بند استاندارد است و در حال حاضر در ماژول بازرسی‌های HSE Guard برای بازرسان فعال می‌باشد.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isAnalyzing && <AIAnalysisProgress title={selectedAssessment.title} />}

              {/* Detail Subtabs */}
              {!isAnalyzing && (
                <>
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <button
                      onClick={() => setDetailSubTab("hazards")}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                        detailSubTab === "hazards"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      شناسنامه مخاطرات و ماتریس ریسک ({selectedAssessment.hazards_count || 0})
                    </button>
                    <button
                      onClick={() => setDetailSubTab("checklist")}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                        detailSubTab === "checklist"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      ویرایشگر پیش‌نویس چک‌لیست ({selectedAssessment.checklist_items_count || 0} بند)
                    </button>
                    <button
                      onClick={() => setDetailSubTab("workplace_data")}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                        detailSubTab === "workplace_data"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      اطلاعات ورودی ۹ گانه کارگاه
                    </button>
                  </div>

                  {detailSubTab === "hazards" && (
                    <AssessmentResultsView
                      assessment={selectedAssessment}
                      onGoToChecklistDraft={() => setDetailSubTab("checklist")}
                    />
                  )}

                  {detailSubTab === "checklist" && (
                    <ChecklistDraftEditor
                      initialDraft={selectedAssessment.checklist_draft || { title: selectedAssessment.title, sections: [] }}
                      assessmentId={selectedAssessment.id}
                      onSaveDraft={handleSaveDraft}
                      onValidateDraft={handleValidateDraft}
                      onRequestApproval={() => setIsApprovalModalOpen(true)}
                      canApprove={true}
                      isSaving={isSavingDraft}
                      isValidating={isValidatingDraft}
                    />
                  )}

                  {detailSubTab === "workplace_data" && (
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        مشخصات تفصیلی ثبت‌شده در فرم ارزیابی
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-800 block mb-1">اطلاعات عمومی:</span>
                          <div>کارگاه: {selectedAssessment.workplace_data?.general_info?.workplace_name}</div>
                          <div>صنعت: {selectedAssessment.workplace_data?.general_info?.industry_type}</div>
                          <div>تعداد کارگران: {selectedAssessment.workplace_data?.general_info?.worker_count} نفر ({selectedAssessment.workplace_data?.general_info?.shift_count} شیفت)</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-800 block mb-1">محیط فیزیکی:</span>
                          <div>مساحت: {selectedAssessment.workplace_data?.physical_environment?.area_sqm} مترمربع</div>
                          <div>تهویه: {selectedAssessment.workplace_data?.physical_environment?.ventilation_type}</div>
                          <div>تراز صدا: {selectedAssessment.workplace_data?.physical_environment?.noise_level}</div>
                        </div>
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block text-xs mb-1">تجهیزات و ماشین‌آلات:</span>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {(selectedAssessment.workplace_data?.machinery_and_equipment || []).map((m, idx) => (
                            <span key={idx} className="bg-slate-100 px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                              {m.name} ({m.type || "ماشین"})
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block text-xs mb-1">مواد و مواد شیمیایی:</span>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {(selectedAssessment.workplace_data?.materials_and_chemicals || []).map((c, idx) => (
                            <span key={idx} className="bg-slate-100 px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                              {c.name} ({c.approximate_volume || "-"})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Approval Modal */}
              <AssessmentApprovalModal
                assessment={selectedAssessment}
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                onConfirm={handleConfirmApproval}
                loading={isApproving}
              />
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* LEGACY TAB 1: WORKPLACE                                      */}
      {/* ============================================================ */}
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

      {/* ============================================================ */}
      {/* LEGACY TAB 2: CHECKLIST                                      */}
      {/* ============================================================ */}
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
                {checklistResult.items.map((it: any) => (
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
                        flexShrink: 0,
                        fontWeight: "bold",
                      }}
                    >
                      {it.order}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{it.text || it.question}</div>
                      {it.citation && (
                        <div style={{ fontSize: "0.75rem", color: "var(--primary, #0f6b57)", marginTop: "0.2rem" }}>
                          استناد: {it.citation}
                        </div>
                      )}
                      {it.item_type && (
                        <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                          نوع پاسخ: {it.item_type}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* LEGACY TAB 3: HIERARCHY                                      */}
      {/* ============================================================ */}
      {activeTab === "hierarchy" && (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <form onSubmit={handleSuggestControls} className="card" style={{ padding: "1.5rem", maxWidth: "100%", display: "grid", gap: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>پیشنهاد لایه‌های کنترلی بر پایه ماتریس سلسله‌مراتب ISO 45001</h3>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
              <div>
                <label htmlFor="hazard-title" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>عنوان مخاطره *</label>
                <input
                  id="hazard-title"
                  type="text"
                  required
                  value={hazardTitle}
                  onChange={(e) => setHazardTitle(e.target.value)}
                  placeholder="مثال: احتمال سقوط از داربست ناقص در ارتفاع"
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>دسته‌بندی خطر</label>
                <select
                  value={hazardCategory}
                  onChange={(e) => setHazardCategory(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                >
                  <option value="safety">ایمنی (Safety)</option>
                  <option value="health">بهداشت حرفه‌ای (Health)</option>
                  <option value="environment">محیط زیست (Environment)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>توضیحات تکمیلی موقعیت</label>
              <textarea
                rows={2}
                value={hazardDesc}
                onChange={(e) => setHazardDesc(e.target.value)}
                placeholder="توضیحاتی در مورد شرایط محل، تعداد نفرات یا ماهیت کار..."
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
                {controlsLoading ? "در حال تدوین سطوح کنترلی..." : "🛡️ استخراج سلسله‌مراتب کنترلی"}
              </button>
            </div>
          </form>

          {controlsError && <div className="alert alert-error">{controlsError}</div>}

          {controlsResult && (
            <div className="card" style={{ padding: "1.5rem", maxWidth: "100%", display: "grid", gap: "1rem" }}>
              <h4 style={{ margin: 0, fontSize: "1.1rem" }}>سلسله‌مراتب کنترلی: {controlsResult.hazard_title}</h4>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                {(controlsResult as any).hierarchy ? (
                  (controlsResult as any).hierarchy.map((tier: any) => (
                    <div
                      key={tier.tier}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "6px",
                        border: "1px solid var(--border, #d9e0e7)",
                        backgroundColor: "var(--bg, #f4f6f8)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: "0.9rem" }}>{tier.label}</strong>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted, #5b6b7a)" }}>{tier.priority}</span>
                      </div>
                      <div style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>{tier.recommendation}</div>
                    </div>
                  ))
                ) : (
                  <>
                    {(controlsResult as any).elimination && (
                      <div style={{ border: "1px solid #10b981", borderRadius: "6px", padding: "0.75rem 1rem", backgroundColor: "#f0fdf4" }}>
                        <div style={{ fontWeight: "bold", color: "#166534", fontSize: "0.9rem" }}>۱. حذف خطر (Elimination)</div>
                        <ul style={{ margin: "0.5rem 0 0", paddingRight: "1.5rem", fontSize: "0.85rem" }}>
                          {((controlsResult as any).elimination || []).map((item: any, idx: number) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(controlsResult as any).ppe && (
                      <div style={{ border: "1px solid #ef4444", borderRadius: "6px", padding: "0.75rem 1rem", backgroundColor: "#fef2f2" }}>
                        <div style={{ fontWeight: "bold", color: "#991b1b", fontSize: "0.9rem" }}>۵. تجهیزات حفاظت فردی (PPE)</div>
                        <ul style={{ margin: "0.5rem 0 0", paddingRight: "1.5rem", fontSize: "0.85rem" }}>
                          {((controlsResult as any).ppe || []).map((item: any, idx: number) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
