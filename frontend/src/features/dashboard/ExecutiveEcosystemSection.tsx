import { useEffect, useState } from "react";
import {
  fetchExecutiveDashboard,
  fetchKPIEngine,
  fetchStrategicGoals,
  fetchHSEBudget,
  type Executive20ModuleSummary,
  type HSEKPIEngineSummary,
  type HSEStrategicGoal,
  type HSEBudgetProgram,
} from "../../services/api";
import type { NavTab } from "../../layouts/AppLayout";
import {
  HSE_20_MODULES,
  HSE_EXCHANGE_TYPES,
  type HSEModuleDefinition,
} from "../../core/contracts/modulesCatalog";
import {
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Target,
  DollarSign,
  Info,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  Radio,
  FileSpreadsheet,
} from "lucide-react";

interface ExecutiveEcosystemSectionProps {
  organizationId: number | null;
  onNavigate: (tab: NavTab) => void;
}

export function ExecutiveEcosystemSection({
  organizationId,
  onNavigate,
}: ExecutiveEcosystemSectionProps) {
  const [executiveSummary, setExecutiveSummary] = useState<Executive20ModuleSummary | null>(null);
  const [kpiEngine, setKpiEngine] = useState<HSEKPIEngineSummary | null>(null);
  const [goals, setGoals] = useState<HSEStrategicGoal[]>([]);
  const [budgetPrograms, setBudgetPrograms] = useState<HSEBudgetProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "healthy" | "action">("all");
  const [selectedCatalogModule, setSelectedCatalogModule] = useState<HSEModuleDefinition | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    setLoading(true);

    Promise.all([
      fetchExecutiveDashboard(organizationId, controller.signal).catch(() => null),
      fetchKPIEngine(organizationId, controller.signal).catch(() => null),
      fetchStrategicGoals(organizationId, undefined, controller.signal).catch(() => []),
      fetchHSEBudget(organizationId, undefined, controller.signal).catch(() => []),
    ])
      .then(([exec, kpi, gList, bList]) => {
        setExecutiveSummary(exec);
        setKpiEngine(kpi);
        setGoals(gList || []);
        setBudgetPrograms(bList || []);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [organizationId]);

  if (!organizationId) return null;
  if (loading) {
    return (
      <section className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }} dir="rtl">
        <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          در حال استخراج معماری اکوسیستم ۲۰ ماژول و سنکرون‌سازی موتور محاسباتی KPI...
        </div>
      </section>
    );
  }

  const modules = executiveSummary?.modules || [];
  const filteredModules = modules.filter((m) => {
    if (filterStatus === "healthy") return m.status === "normal" || m.status === "operational";
    if (filterStatus === "action") return m.status === "action_required" || m.status === "warning";
    return true;
  });

  const tabMap: Record<string, NavTab> = {
    risk_management: "risks",
    anomaly_reports: "anomalies",
    incidents: "incidents",
    permits: "permits",
    inspections: "inspections",
    equipment: "assets",
    ppe: "workforce",
    training: "workforce",
    moc: "moc",
    contractors: "workforce",
    environment: "environment",
    health: "workforce",
    emergency: "environment",
    chemicals: "environment",
    audit: "audit",
    documents: "documents",
    safety_culture: "surveys",
    capa: "inspections",
    strategic_hse: "dashboard",
    kpi_engine: "dashboard",
  };

  const getCatalogDetails = (_code: string, idx: number): HSEModuleDefinition => {
    // Map code or index to HSE_20_MODULES
    const byId = HSE_20_MODULES.find((m) => m.id === idx + 1);
    if (byId) return byId;
    return HSE_20_MODULES[idx % HSE_20_MODULES.length];
  };

  return (
    <section
      className="card executive-ecosystem-section paper-sheet"
      style={{
        marginBottom: "2rem",
        padding: "1.75rem",
        borderRadius: "16px",
        position: "relative",
        overflow: "hidden",
      }}
      dir="rtl"
    >
      {/* Industrial Process Pipeline Accent Header */}
      <div
        className="process-pipe-h"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "linear-gradient(90deg, #0284c7 0%, #10b981 50%, #f59e0b 100%)",
        }}
      />

      {/* Live Factory Process Telemetry Strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          background: "rgba(15, 23, 42, 0.05)",
          border: "1px dashed rgba(100, 116, 139, 0.25)",
          borderRadius: "8px",
          padding: "0.5rem 1rem",
          marginBottom: "1.25rem",
          fontSize: "0.8rem",
          color: "var(--text-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Radio size={14} color="#10b981" />
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>تلِمِتری زنده تأسیسات:</span>
          <span>فشار شبکه گاز خوراک: <strong>4.8 Bar (نرمال)</strong></span>
        </div>
        <div>
          سولفید هیدروژن (H2S): <strong style={{ color: "#10b981" }}>0.00 PPM (ایمن)</strong>
        </div>
        <div>
          عملیات همزمان فعال (SIMOPS): <strong>2 پرمیت جاری</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>رکورد روزهای بدون حادثه: <strong style={{ color: "var(--primary)" }}>1,420 روز کاری</strong></span>
        </div>
      </div>

      {/* Main Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                padding: "0.6rem",
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.12)",
                color: "var(--primary)",
              }}
            >
              <Layers size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>
                رصدخانه یکپارچه اکوسیستم ۲۰ ماژول HSE & ماتریس ارتباطات داده
              </h3>
              <p
                style={{
                  margin: "0.25rem 0 0 0",
                  color: "var(--text-secondary)",
                  fontSize: "0.875rem",
                }}
              >
                پایش آنلاین وضعیت سلامت تمامی بخش‌ها، محاسبات ریاضی شاخص‌های حوادث (LTIFR/TRIR) و ارکان ۴ گانه ورودی/پردازش/خروجی/مقصد
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary Badges */}
        {executiveSummary && (
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span
              className="badge badge-success"
              style={{ padding: "0.45rem 0.85rem", fontSize: "0.85rem", fontWeight: 700 }}
            >
              <CheckCircle2 size={15} style={{ marginLeft: "0.35rem" }} />
              {executiveSummary.modules_healthy} ماژول سبز و پایدار
            </span>
            {executiveSummary.modules_action_required > 0 && (
              <span
                className="badge badge-warning"
                style={{ padding: "0.45rem 0.85rem", fontSize: "0.85rem", fontWeight: 700 }}
              >
                <AlertTriangle size={15} style={{ marginLeft: "0.35rem" }} />
                {executiveSummary.modules_action_required} ماژول نیازمند اقدام
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mathematical KPI Engine Strip */}
      {kpiEngine && (
        <div
          style={{
            background: "var(--bg-secondary, #f8fafc)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: "12px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <Activity size={18} color="var(--primary)" />
            <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              موتور محاسباتی شاخص‌های کلیدی عملکرد HSE (KPI Intelligence Engine)
            </h4>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                marginRight: "auto",
              }}
            >
              مبنای نفر-ساعت کارکرد مجتمع:{" "}
              <strong>{kpiEngine.man_hours_worked.toLocaleString()} ساعت</strong>
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* LTIFR */}
            <div
              className="card"
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.25rem",
                }}
              >
                ضریب تکرار حوادث ناتوان‌کننده (LTIFR)
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: kpiEngine.ltifr === 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                {kpiEngine.ltifr}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-secondary)",
                  marginTop: "0.25rem",
                }}
              >
                فرمول: (LTI × 1,000,000) / نفر-ساعت
              </div>
            </div>

            {/* TRIR */}
            <div
              className="card"
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.25rem",
                }}
              >
                نرخ کل حوادث قابل ثبت (TRIR)
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: kpiEngine.trir < 1.0 ? "var(--success)" : "var(--warning)",
                }}
              >
                {kpiEngine.trir}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-secondary)",
                  marginTop: "0.25rem",
                }}
              >
                فرمول: (حوادث ثبت‌شده × 1M) / ساعت
              </div>
            </div>

            {/* Severity Rate */}
            <div
              className="card"
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.25rem",
                }}
              >
                ضریب شدت حوادث (Severity Rate)
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: "var(--primary)",
                }}
              >
                {kpiEngine.severity_rate}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-secondary)",
                  marginTop: "0.25rem",
                }}
              >
                فرمول: (روزهای از دست‌رفته × 1M) / ساعت
              </div>
            </div>

            {/* Safe Behavior Ratio (BBS) */}
            <div
              className="card"
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.25rem",
                }}
              >
                نسبت رفتارهای ایمن (BBS Index)
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: "var(--success)",
                }}
              >
                %{kpiEngine.safe_behavior_rate}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-secondary)",
                  marginTop: "0.25rem",
                }}
              >
                شاخص پیشرو رفتاری (Leading)
              </div>
            </div>

            {/* Inspection Compliance */}
            <div
              className="card"
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.25rem",
                }}
              >
                پوشش بازرسی‌های برنامه‌ای
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: "var(--primary)",
                }}
              >
                %{kpiEngine.inspection_compliance_rate}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-secondary)",
                  marginTop: "0.25rem",
                }}
              >
                انطباق با تقویم ممیزی و بازرسی
              </div>
            </div>

            {/* CAPA Closure Rate */}
            <div
              className="card"
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.25rem",
                }}
              >
                اثربخشی بستن اقدامات اصلاحی
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: "var(--success)",
                }}
              >
                %{kpiEngine.capa_closure_rate}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-secondary)",
                  marginTop: "0.25rem",
                }}
              >
                اقدامات تأیید‌شده در زنجیره CAPA
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 20-Module Live Overview Grid */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.85rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
            ماتریس زنده پایش هر ۲۰ ماژول اکوسیستم HSE (کلیک جهت مشاهده ارکان ۴ گانه)
          </h4>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className={`btn btn-sm ${filterStatus === "all" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setFilterStatus("all")}
            >
              همه ۲۰ ماژول ({modules.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterStatus === "healthy" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setFilterStatus("healthy")}
            >
              پایدار ({executiveSummary?.modules_healthy || 0})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterStatus === "action" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setFilterStatus("action")}
            >
              نیازمند اقدام ({executiveSummary?.modules_action_required || 0})
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "0.85rem",
          }}
        >
          {filteredModules.map((mod, idx) => {
            const isWarning = mod.status === "warning" || mod.status === "action_required";
            const catalogDef = getCatalogDetails(mod.code, idx);

            return (
              <div
                key={mod.code || idx}
                className="paper-card"
                style={{
                  border: isWarning ? "1px solid #fca5a5" : "1px solid #e2e8f0",
                  background: isWarning ? "rgba(254, 242, 242, 0.7)" : "#ffffff",
                  borderRadius: "10px",
                  padding: "0.9rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                  position: "relative",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedCatalogModule(catalogDef)}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                      }}
                    >
                      ماژول {idx + 1} • {catalogDef.nameEn}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        fontWeight: 700,
                        background: isWarning ? "#fee2e2" : "#dcfce7",
                        color: isWarning ? "#991b1b" : "#166534",
                      }}
                    >
                      {isWarning ? "اقدام لازم" : "فعال / پایدار"}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      marginBottom: "0.3rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    {mod.name}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {mod.count !== undefined ? `تعداد اقلام ثبت‌شده: ${mod.count}` : "سرویس فعال"}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "0.75rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px dashed #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.2rem",
                    }}
                  >
                    <Info size={12} />
                    <span>جزئیات ارکان</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--primary)",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetTab = tabMap[mod.code] || "dashboard";
                      onNavigate(targetTab);
                    }}
                  >
                    <span>ورود به ماژول</span>
                    <ArrowLeft size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strategic HSE Goals & Budget Progress */}
      {(goals.length > 0 || budgetPrograms.length > 0) && (
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <Target size={18} color="var(--primary)" />
            <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              اهداف کلان راهبردی و بودجه مصوب HSE
            </h4>
          </div>
          {goals.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              {goals.slice(0, 4).map((g) => {
                const pct =
                  g.target_value > 0
                    ? Math.min(100, Math.round((g.current_value / g.target_value) * 100))
                    : 100;
                return (
                  <div
                    key={g.id}
                    className="card"
                    style={{
                      padding: "0.85rem",
                      background: "#fafafa",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.3rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--primary)",
                          fontWeight: 600,
                        }}
                      >
                        محور: {g.pillar_display || g.pillar}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        مهلت: {g.deadline}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        marginBottom: "0.5rem",
                      }}
                    >
                      {g.title}
                    </div>
                    <div
                      style={{
                        background: "#e2e8f0",
                        borderRadius: "4px",
                        height: "7px",
                        overflow: "hidden",
                        marginBottom: "0.3rem",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          background: "var(--primary)",
                          height: "100%",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span>
                        مقدار فعلی: {g.current_value} {g.unit}
                      </span>
                      <span>
                        هدف: {g.target_value} {g.unit} ({pct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {budgetPrograms.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap",
                alignItems: "center",
                background: "#f8fafc",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <DollarSign size={16} color="var(--success)" />
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                پایش تخصیص و جذب بودجه HSE:
              </span>
              {budgetPrograms.slice(0, 3).map((b) => (
                <span
                  key={b.id}
                  className="badge badge-outline"
                  style={{ fontSize: "0.75rem" }}
                >
                  {b.program_name}: {b.spent_amount}/{b.allocated_amount} میلیون ریال (
                  {b.utilization_percentage}%)
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drill-Down Matrix Modal for 4 Core Pillars & Exchange Rules */}
      {selectedCatalogModule && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
          onClick={() => setSelectedCatalogModule(null)}
        >
          <div
            className="card paper-sheet"
            style={{
              maxWidth: "760px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "1.75rem",
              position: "relative",
              boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      background: "rgba(59, 130, 246, 0.12)",
                      color: "var(--primary)",
                      fontWeight: 700,
                      padding: "0.2rem 0.6rem",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                    }}
                  >
                    ماژول {selectedCatalogModule.id} از ۲۰
                  </span>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                      fontFamily: "monospace",
                    }}
                  >
                    {selectedCatalogModule.nameEn}
                  </span>
                </div>
                <h3
                  style={{
                    margin: "0.4rem 0 0 0",
                    fontSize: "1.35rem",
                    fontWeight: 800,
                  }}
                >
                  {selectedCatalogModule.nameFa}
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ borderRadius: "50%", padding: "0.4rem" }}
                onClick={() => setSelectedCatalogModule(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Description */}
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                marginBottom: "1.25rem",
              }}
            >
              {selectedCatalogModule.description}
            </p>

            {/* The 4 Core Pillars Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              {/* Pillar 1: Inputs */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "10px",
                  padding: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    marginBottom: "0.6rem",
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  <FileSpreadsheet size={16} />
                  <span>۱. ورودی‌های داده (Inputs)</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {selectedCatalogModule.inputs.map((inp, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "0.82rem",
                        padding: "0.35rem 0.5rem",
                        background: "#ffffff",
                        borderRadius: "6px",
                        border: "1px solid #eef2f6",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{inp.data}</div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          marginTop: "0.2rem",
                        }}
                      >
                        مبدأ: {inp.sourceModules.join("، ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pillar 2: Processing */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "10px",
                  padding: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    marginBottom: "0.6rem",
                    fontWeight: 700,
                    color: "#059669",
                  }}
                >
                  <Zap size={16} />
                  <span>۲. فرآیند و پردازش (Processing Logic)</span>
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    lineHeight: 1.6,
                    padding: "0.5rem",
                    background: "#ffffff",
                    borderRadius: "6px",
                    border: "1px solid #eef2f6",
                  }}
                >
                  {selectedCatalogModule.processing}
                </div>
              </div>

              {/* Pillar 3: Outputs */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "10px",
                  padding: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    marginBottom: "0.6rem",
                    fontWeight: 700,
                    color: "#d97706",
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>۳. خروجی‌های معتبر (Outputs)</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {selectedCatalogModule.outputs.map((out, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "0.82rem",
                        padding: "0.35rem 0.5rem",
                        background: "#ffffff",
                        borderRadius: "6px",
                        border: "1px solid #eef2f6",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{out.data}</div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          marginTop: "0.2rem",
                        }}
                      >
                        مقاصد: {out.destinationModules.join("، ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pillar 4: Destinations & Traceability */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "10px",
                  padding: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    marginBottom: "0.6rem",
                    fontWeight: 700,
                    color: "#7c3aed",
                  }}
                >
                  <Target size={16} />
                  <span>۴. مقاصد متصل & زنجیره ردیابی</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.3rem",
                    marginBottom: "0.6rem",
                  }}
                >
                  {selectedCatalogModule.destinations.map((dst, i) => (
                    <span
                      key={i}
                      className="badge badge-outline"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                    >
                      {dst}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    borderTop: "1px dashed #e2e8f0",
                    paddingTop: "0.4rem",
                  }}
                >
                  پروتکل ردیابی: <code>TRC-2026-MOD{selectedCatalogModule.id}-XXXX</code>
                </div>
              </div>
            </div>

            {/* Communication Rules Matrix Strip */}
            {selectedCatalogModule.communicationRules.length > 0 && (
              <div
                style={{
                  background: "#f1f5f9",
                  borderRadius: "10px",
                  padding: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                <h5 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700 }}>
                  قوانین تبادل اطلاعات با سایر ماژول‌ها (از میان ۶ نوع تبادل)
                </h5>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {selectedCatalogModule.communicationRules.map((rule, idx) => {
                    const ruleMeta = HSE_EXCHANGE_TYPES[rule.exchangeType];
                    return (
                      <div
                        key={idx}
                        style={{
                          background: "#ffffff",
                          borderRadius: "8px",
                          padding: "0.6rem 0.8rem",
                          border: "1px solid #e2e8f0",
                          fontSize: "0.82rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.3rem",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>
                            مقصد: {rule.targetModuleName}
                          </span>
                          <span
                            className="badge badge-info"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          >
                            نوع تبادل: {rule.exchangeTypeDisplay} (
                            {ruleMeta?.nameFa || rule.exchangeType})
                          </span>
                        </div>
                        <div style={{ color: "var(--text-primary)", marginBottom: "0.2rem" }}>
                          {rule.dataDescription}
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                          محرک رخداد (Trigger): {rule.sampleTrigger}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "1rem",
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedCatalogModule(null)}
              >
                بستن
              </button>

              <button
                type="button"
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                onClick={() => {
                  const targetCodeMap: Record<number, NavTab> = {
                    1: "risks",
                    2: "incidents",
                    3: "permits",
                    4: "inspections",
                    5: "workforce",
                    6: "workforce",
                    7: "environment",
                    8: "workforce",
                    9: "environment",
                    10: "workforce",
                    11: "assets",
                    12: "audit",
                    13: "dashboard",
                    14: "documents",
                    15: "surveys",
                    16: "environment",
                    17: "moc",
                    18: "dashboard",
                    19: "anomalies",
                    20: "dashboard",
                  };
                  const tab = targetCodeMap[selectedCatalogModule.id] || "dashboard";
                  setSelectedCatalogModule(null);
                  onNavigate(tab);
                }}
              >
                <span>ورود مستقیم به بخش {selectedCatalogModule.nameFa}</span>
                <ExternalLink size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
