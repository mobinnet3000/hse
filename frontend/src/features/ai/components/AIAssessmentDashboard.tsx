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
          bg: "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200",
          dot: "bg-emerald-500",
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
          label: display || "چک‌لیست صادر شد",
        };
      case "approved":
        return {
          bg: "bg-teal-50 text-teal-800 border-teal-300 ring-1 ring-teal-200",
          dot: "bg-teal-500",
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: display || "تأیید نهایی شده",
        };
      case "validated":
        return {
          bg: "bg-indigo-50 text-indigo-800 border-indigo-300 ring-1 ring-indigo-200",
          dot: "bg-indigo-500",
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: display || "اعتبارسنجی شده",
        };
      case "editing":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200",
          dot: "bg-amber-500",
          icon: <Clock className="w-3.5 h-3.5" />,
          label: display || "در حال ویرایش پیش‌نویس",
        };
      case "analyzed":
        return {
          bg: "bg-sky-50 text-sky-800 border-sky-300 ring-1 ring-sky-200",
          dot: "bg-sky-500",
          icon: <Sparkles className="w-3.5 h-3.5" />,
          label: display || "تحلیل شد",
        };
      case "analyzing":
        return {
          bg: "bg-indigo-50 text-indigo-800 border-indigo-300 ring-1 ring-indigo-200 animate-pulse",
          dot: "bg-indigo-500 animate-ping",
          icon: <Clock className="w-3.5 h-3.5" />,
          label: display || "در حال پردازش هوش مصنوعی",
        };
      case "analysis_failed":
        return {
          bg: "bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-200",
          dot: "bg-rose-500",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          label: display || "خطا در تحلیل",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-800 border-slate-300",
          dot: "bg-slate-400",
          icon: <Clock className="w-3.5 h-3.5" />,
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
    <div className="space-y-6" dir="rtl">
      {/* Top Hero Banner with AvalAI Status & CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                دستیار هوشمند HSE بر پایه شبکه AvalAI
              </span>

              {serviceStatus && (
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer hover:scale-105 ${
                    serviceStatus.service_status === "ready"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-amber-500/30"
                  }`}
                  title="کلیک برای تست و مشاهده وضعیت ارتباط زنده"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      serviceStatus.service_status === "ready"
                        ? "bg-emerald-400 animate-ping"
                        : "bg-amber-400"
                    }`}
                  />
                  <Server className="w-3.5 h-3.5" />
                  {serviceStatus.service_status === "ready"
                    ? `AvalAI متصل (${serviceStatus.model})`
                    : "حالت شبیه‌ساز دانش‌بنیان"}
                </button>
              )}
            </div>

            <h1 className="text-xl md:text-2xl font-black tracking-tight leading-snug">
              مدیریت و تحلیل هوشمند ارزیابی‌های محیط کار و صدور خودکار چک‌لیست
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-xl">
              ثبت اطلاعات ساختاریافته ۹ مرحله‌ای کارگاه، استخراج ریسک‌های بحرانی و پنهان با موتور هوش مصنوعی و تدوین چک‌لیست بازرسی تخصصی با دروازه نظارت انسانی ISO 45001.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => setIsTestModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-semibold text-xs shadow-md transition-all cursor-pointer"
            >
              <Activity className="w-4 h-4 text-indigo-400" />
              تست سلامت سرویس
            </button>
            <button
              onClick={onNewAssessment}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-xs md:text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              ارزیابی جدید محیط کار (فرم ۹ مرحله‌ای)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assessments */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">کل ارزیابی‌های ثبت‌شده</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {(stats?.total_assessments ?? assessments.length).toLocaleString("fa-IR")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>در سامانه مدیریت چندمستأجره</span>
          </div>
        </div>

        {/* Checklists Generated */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">چک‌لیست‌های رسمی صادرشده</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {(
              stats?.checklists_generated_count ??
              assessments.filter((a) => a.generated_checklist).length
            ).toLocaleString("fa-IR")}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>متصل به ماژول بازرسی‌های میدانی</span>
          </div>
        </div>

        {/* Pending Review / Editing */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">در انتظار ویرایش یا تأیید ناظر</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">
            {assessments
              .filter((a) => ["analyzed", "editing", "validated"].includes(a.status))
              .length.toLocaleString("fa-IR")}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
            <span>نیازمند نظارت انسانی (Human Gate)</span>
          </div>
        </div>

        {/* Hazards Identified */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">مخاطرات استخراج‌شده</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">
            {assessments
              .reduce((acc, a) => acc + (a.hazards_count || 0), 0)
              .toLocaleString("fa-IR")}
          </div>
          <div className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>تحلیل‌شده بر پایه ماتریس ۵×۵</span>
          </div>
        </div>
      </div>

      {/* Main Assessments Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
        {/* Table Filters & Search */}
        <div className="p-5 border-b border-slate-200/90 bg-slate-50/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="جستجو در عنوان ارزیابی، کارگاه یا شماره چک‌لیست..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              همه ({assessments.length.toLocaleString("fa-IR")})
            </button>
            <button
              onClick={() => setStatusFilter("checklist_generated")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === "checklist_generated"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200"
              }`}
            >
              صادرشده ({assessments.filter((a) => a.status === "checklist_generated").length.toLocaleString("fa-IR")})
            </button>
            <button
              onClick={() => setStatusFilter("approved")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === "approved"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white text-teal-800 hover:bg-teal-50 border border-teal-200"
              }`}
            >
              تأییدشده ({assessments.filter((a) => a.status === "approved").length.toLocaleString("fa-IR")})
            </button>
            <button
              onClick={() => setStatusFilter("analyzed")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === "analyzed"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-white text-sky-800 hover:bg-sky-50 border border-sky-200"
              }`}
            >
              تحلیل‌شده ({assessments.filter((a) => a.status === "analyzed").length.toLocaleString("fa-IR")})
            </button>
            <button
              onClick={() => setStatusFilter("draft")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === "draft"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              پیش‌نویس ({assessments.filter((a) => a.status === "draft").length.toLocaleString("fa-IR")})
            </button>
          </div>
        </div>

        {/* Table Content */}
        {filteredAssessments.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 mx-auto flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">هیچ ارزیابی‌ای در این وضعیت یافت نشد</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              برای تحلیل دقیق خطرات محیط کار، دریافت ماتریس ریسک و صدور چک‌لیست اختصاصی، اولین ارزیابی خود را ایجاد نمایید.
            </p>
            <button
              onClick={onNewAssessment}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 mt-5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              شروع اولین ارزیابی ۹ مرحله‌ای
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3.5 px-4">عنوان ارزیابی کارگاه</th>
                  <th className="py-3.5 px-4">واحد کارگاهی</th>
                  <th className="py-3.5 px-4">وضعیت فرآیند</th>
                  <th className="py-3.5 px-4 text-center">مخاطرات</th>
                  <th className="py-3.5 px-4 text-center">بندهای چک‌لیست</th>
                  <th className="py-3.5 px-4">چک‌لیست صادرشده</th>
                  <th className="py-3.5 px-4">تاریخ ثبت</th>
                  <th className="py-3.5 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssessments.map((item) => {
                  const badge = getStatusBadge(item.status, item.status_display);
                  return (
                    <tr key={item.id} className="hover:bg-indigo-50/40 transition-colors group">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <button
                          onClick={() => onSelectAssessment(item.id)}
                          className="hover:text-indigo-600 text-right transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span>{item.title}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.workplace_name || "کارگاه ثبت‌شده"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          {(item.hazards_count || 0).toLocaleString("fa-IR")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-extrabold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {(item.checklist_items_count || 0).toLocaleString("fa-IR")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.generated_checklist ? (
                          <div className="inline-flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>چک‌لیست #{item.generated_checklist}</span>
                            {onNavigateToChecklists && (
                              <button
                                onClick={() => onNavigateToChecklists(item.generated_checklist!)}
                                className="text-indigo-600 hover:text-indigo-800 p-0.5 cursor-pointer"
                                title="مشاهده در ماژول بازرسی‌ها"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(item.created_at).toLocaleDateString("fa-IR")}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => onSelectAssessment(item.id)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-100/70 rounded-lg transition-colors cursor-pointer"
                            title="مشاهده، تحلیل و ویرایش چک‌لیست"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteAssessment(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف این ارزیابی"
                          >
                            <Trash2 className="w-4 h-4" />
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
