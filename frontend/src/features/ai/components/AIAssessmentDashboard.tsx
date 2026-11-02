import React, { useState } from "react";
import {
  Sparkles,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  ShieldCheck,
  Server,
  Trash2,
  Eye,
  ExternalLink,
  Activity,
  X,
  RefreshCw,
  Building2,
  Calendar,
  AlertOctagon,
} from "lucide-react";
import {
  testAIServiceConnection,
  type AIAssessmentListItem,
  type AIAssessmentStatistics,
  type AIServiceStatus,
} from "../../../services/api";

interface AIAssessmentDashboardProps {
  assessments: AIAssessmentListItem[];
  stats: AIAssessmentStatistics | null;
  serviceStatus: AIServiceStatus | null;
  onNewAssessment: () => void;
  onSelectAssessment: (id: number) => void;
  onDeleteAssessment: (id: number) => void;
  onNavigateToChecklists?: (checklistId: number) => void;
  loading: boolean;
}

export const AIAssessmentDashboard: React.FC<AIAssessmentDashboardProps> = ({
  assessments,
  stats,
  serviceStatus,
  onNewAssessment,
  onSelectAssessment,
  onDeleteAssessment,
  onNavigateToChecklists,
  loading: _loading,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Connection Test Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency_ms: number;
    status: string;
    message: string;
    model?: string;
    base_url?: string;
    reply?: string;
  } | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testAIServiceConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        latency_ms: 0,
        status: "error",
        message: err.message || "خطا در برقراری ارتباط با سرور",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getStatusBadge = (status: string, display: string) => {
    switch (status) {
      case "checklist_generated":
        return {
          className: "badge badge-success",
          icon: <ShieldCheck size={13} />,
          label: display || "چک‌لیست صادر شد",
        };
      case "approved":
        return {
          className: "badge badge-success",
          icon: <CheckCircle size={13} />,
          label: display || "تأیید نهایی شده",
        };
      case "validated":
        return {
          className: "badge badge-info",
          icon: <CheckCircle size={13} />,
          label: display || "اعتبارسنجی شده",
        };
      case "editing":
        return {
          className: "badge badge-warning",
          icon: <Clock size={13} />,
          label: display || "در حال ویرایش پیش‌نویس",
        };
      case "analyzed":
        return {
          className: "badge badge-primary",
          icon: <Sparkles size={13} />,
          label: display || "تحلیل شد",
        };
      case "analyzing":
        return {
          className: "badge badge-info animate-pulse",
          icon: <Clock size={13} />,
          label: display || "در حال پردازش هوش مصنوعی",
        };
      case "analysis_failed":
        return {
          className: "badge badge-danger",
          icon: <AlertTriangle size={13} />,
          label: display || "خطا در تحلیل",
        };
      default:
        return {
          className: "badge badge-neutral",
          icon: <Clock size={13} />,
          label: display || "پیش‌نویس اولیه",
        };
    }
  };

  const filteredAssessments = assessments.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.workplace_name && item.workplace_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} dir="rtl">
      {/* Top AI Workspace Header with Telemetry & Actions */}
      <div className="ai-workspace-header">
        <div className="ai-header-content">
          <div className="ai-header-badges">
            <span className="badge badge-primary">
              <Sparkles size={14} />
              دستیار هوشمند HSE بر پایه شبکه AvalAI
            </span>

            {serviceStatus && (
              <button
                type="button"
                onClick={() => setIsTestModalOpen(true)}
                className={`badge ${serviceStatus.service_status === "ready" ? "badge-success" : "badge-warning"}`}
                style={{ cursor: "pointer" }}
                title="کلیک برای تست و مشاهده وضعیت ارتباط زنده"
              >
                <span className="badge-dot" />
                <Server size={13} />
                {serviceStatus.service_status === "ready"
                  ? `AvalAI متصل (${serviceStatus.model})`
                  : "حالت شبیه‌ساز دانش‌بنیان"}
              </button>
            )}
          </div>

          <h1 className="ai-header-title">
            مدیریت و تحلیل هوشمند ارزیابی‌های محیط کار و صدور خودکار چک‌لیست
          </h1>
          <p className="ai-header-desc">
            ثبت اطلاعات ساختاریافته ۹ مرحله‌ای کارگاه، استخراج ریسک‌های بحرانی و پنهان با موتور هوش مصنوعی و تدوین چک‌لیست بازرسی تخصصی با دروازه نظارت انسانی ISO 45001.
          </p>
        </div>

        <div className="ai-header-actions">
          <button
            type="button"
            onClick={() => setIsTestModalOpen(true)}
            className="btn btn-secondary"
          >
            <Activity size={16} />
            تست سلامت سرویس
          </button>
          <button
            type="button"
            onClick={onNewAssessment}
            className="btn btn-primary"
          >
            <Plus size={16} />
            ارزیابی جدید محیط کار (فرم ۹ مرحله‌ای)
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="ai-kpi-grid">
        {/* Total Assessments */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-header">
            <span className="ai-kpi-label">کل ارزیابی‌های ثبت‌شده</span>
            <Sparkles size={18} style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="ai-kpi-value">
            {(stats?.total_assessments ?? assessments.length).toLocaleString("fa-IR")}
          </div>
          <div className="ai-kpi-meta">
            <span>در سامانه مدیریت چندمستأجره</span>
          </div>
        </div>

        {/* Checklists Generated */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-header">
            <span className="ai-kpi-label">چک‌لیست‌های رسمی صادرشده</span>
            <FileSpreadsheet size={18} style={{ color: "var(--success)" }} />
          </div>
          <div className="ai-kpi-value" style={{ color: "var(--success)" }}>
            {(
              stats?.checklists_generated_count ??
              assessments.filter((a) => a.generated_checklist).length
            ).toLocaleString("fa-IR")}
          </div>
          <div className="ai-kpi-meta" style={{ color: "var(--success)" }}>
            <CheckCircle size={13} />
            <span>متصل به ماژول بازرسی‌های میدانی</span>
          </div>
        </div>

        {/* Pending Review / Editing */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-header">
            <span className="ai-kpi-label">در انتظار ویرایش یا تأیید ناظر</span>
            <Clock size={18} style={{ color: "var(--warning)" }} />
          </div>
          <div className="ai-kpi-value" style={{ color: "var(--warning)" }}>
            {assessments
              .filter((a) => ["analyzed", "editing", "validated"].includes(a.status))
              .length.toLocaleString("fa-IR")}
          </div>
          <div className="ai-kpi-meta" style={{ color: "var(--warning)" }}>
            <span>نیازمند نظارت انسانی (Human Gate)</span>
          </div>
        </div>

        {/* Hazards Identified */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-header">
            <span className="ai-kpi-label">مخاطرات استخراج‌شده</span>
            <AlertTriangle size={18} style={{ color: "var(--danger)" }} />
          </div>
          <div className="ai-kpi-value" style={{ color: "var(--danger)" }}>
            {assessments
              .reduce((acc, a) => acc + (a.hazards_count || 0), 0)
              .toLocaleString("fa-IR")}
          </div>
          <div className="ai-kpi-meta" style={{ color: "var(--danger)" }}>
            <AlertOctagon size={13} />
            <span>تحلیل‌شده بر پایه ماتریس ۵×۵</span>
          </div>
        </div>
      </div>

      {/* Main Assessments Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Table Filters & Search */}
        <div className="ai-toolbar">
          <div className="ai-search-wrap">
            <Search size={16} className="ai-search-icon" />
            <input
              type="text"
              placeholder="جستجو در عنوان ارزیابی، کارگاه یا شماره چک‌لیست..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ai-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="ai-search-clear"
                title="پاک کردن جستجو"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="segmented-controls">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`segmented-btn ${statusFilter === "all" ? "active" : ""}`}
            >
              همه ({assessments.length.toLocaleString("fa-IR")})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("checklist_generated")}
              className={`segmented-btn ${statusFilter === "checklist_generated" ? "active" : ""}`}
            >
              صادرشده ({assessments.filter((a) => a.status === "checklist_generated").length.toLocaleString("fa-IR")})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("approved")}
              className={`segmented-btn ${statusFilter === "approved" ? "active" : ""}`}
            >
              تأییدشده ({assessments.filter((a) => a.status === "approved").length.toLocaleString("fa-IR")})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("analyzed")}
              className={`segmented-btn ${statusFilter === "analyzed" ? "active" : ""}`}
            >
              تحلیل‌شده ({assessments.filter((a) => a.status === "analyzed").length.toLocaleString("fa-IR")})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("draft")}
              className={`segmented-btn ${statusFilter === "draft" ? "active" : ""}`}
            >
              پیش‌نویس ({assessments.filter((a) => a.status === "draft").length.toLocaleString("fa-IR")})
            </button>
          </div>
        </div>

        {/* Table Content */}
        {filteredAssessments.length === 0 ? (
          <div className="empty-state-clean">
            <Sparkles size={36} style={{ color: "var(--text-muted)" }} />
            <h3>هیچ ارزیابی‌ای در این وضعیت یافت نشد</h3>
            <p className="muted">
              برای تحلیل دقیق خطرات محیط کار، دریافت ماتریس ریسک و صدور چک‌لیست اختصاصی، اولین ارزیابی خود را ایجاد نمایید.
            </p>
            <button
              type="button"
              onClick={onNewAssessment}
              className="btn btn-primary btn-sm"
              style={{ marginTop: "1rem" }}
            >
              <Plus size={15} />
              شروع اولین ارزیابی ۹ مرحله‌ای
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>عنوان ارزیابی کارگاه</th>
                  <th>واحد کارگاهی</th>
                  <th>وضعیت فرآیند</th>
                  <th style={{ textAlign: "center" }}>مخاطرات</th>
                  <th style={{ textAlign: "center" }}>بندهای چک‌لیست</th>
                  <th>چک‌لیست صادرشده</th>
                  <th>تاریخ ثبت</th>
                  <th style={{ textAlign: "center" }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssessments.map((item) => {
                  const badge = getStatusBadge(item.status, item.status_display);
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700 }}>
                        <button
                          type="button"
                          onClick={() => onSelectAssessment(item.id)}
                          className="table-link-btn"
                        >
                          {item.title}
                        </button>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <Building2 size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          <span>{item.workplace_name || "کارگاه ثبت‌شده"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={badge.className}>
                          <span className="badge-dot" />
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="tabular-tag">
                          {(item.hazards_count || 0).toLocaleString("fa-IR")}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="tabular-tag tabular-primary">
                          {(item.checklist_items_count || 0).toLocaleString("fa-IR")}
                        </span>
                      </td>
                      <td>
                        {item.generated_checklist ? (
                          <div className="badge badge-success" style={{ gap: "0.5rem" }}>
                            <CheckCircle size={14} />
                            <span>چک‌لیست #{item.generated_checklist}</span>
                            {onNavigateToChecklists && (
                              <button
                                type="button"
                                onClick={() => onNavigateToChecklists(item.generated_checklist!)}
                                style={{ color: "var(--primary)", padding: "0.15rem" }}
                                title="مشاهده در ماژول بازرسی‌ها"
                              >
                                <ExternalLink size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>-</span>
                        )}
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                          <span>{new Date(item.created_at).toLocaleDateString("fa-IR")}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => onSelectAssessment(item.id)}
                            className="icon-action-btn"
                            title="مشاهده، تحلیل و ویرایش چک‌لیست"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteAssessment(item.id)}
                            className="icon-action-btn danger"
                            title="حذف این ارزیابی"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connection Test & Health Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">وضعیت و تست ارتباط با سرور AvalAI</h3>
                  <p className="text-[11px] text-slate-300">
                    ارزیابی آنلاین مدل هوش مصنوعی و کلید سرور
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">ارائه‌دهنده:</span>
                  <strong className="text-slate-800">AvalAI (ایران)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">آدرس پایه API:</span>
                  <code className="text-indigo-700 font-mono text-[11px]">
                    {serviceStatus?.base_url || "https://api.avalai.ir/v1"}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مدل پیکربندی‌شده:</span>
                  <span className="font-bold text-slate-800">
                    {serviceStatus?.model || "gpt-4o-mini"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">وضعیت کلید امنیتی (سرور):</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      serviceStatus?.api_key_configured
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {serviceStatus?.api_key_configured ? "تنظیم شده در سرور" : "کلید تعریف نشده (حالت شبیه‌ساز آفلاین)"}
                  </span>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    testResult.success
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : "bg-amber-50 border-amber-300 text-amber-900"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.latency_ms > 0 && (
                    <div className="text-[11px] font-mono">
                      زمان تاخیر سرور: {testResult.latency_ms} ms
                    </div>
                  )}
                  {testResult.reply && (
                    <div className="mt-1 pt-2 border-t border-emerald-200/60 text-[11px]">
                      <strong>پاسخ مدل:</strong> {testResult.reply}
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                با کلیک روی دکمه زیر، یک درخواست پینگ آزمایشی از سمت سرور Django به سرور AvalAI ارسال می‌شود تا از اتصال ایمن، مدل هوش مصنوعی و زمان پاسخ اطمینان حاصل گردد.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-white cursor-pointer"
              >
                بستن
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? "animate-spin" : ""}`} />
                {testingConnection ? "در حال ارسال درخواست تست..." : "ارسال درخواست تست اتصال"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
