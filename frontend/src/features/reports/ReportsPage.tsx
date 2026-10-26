import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchOrganizations,
  fetchWorkplaces,
  getReportExportUrl,
  type Organization,
  type Workplace,
} from "../../services/api";

type ReportDefinition = {
  id: string;
  name: string;
  description: string;
  statusOptions: Array<{ value: string; label: string }>;
};

const REPORTS: ReportDefinition[] = [
  {
    id: "inspections",
    name: "گزارش بازرسی‌ها",
    description: "فهرست کامل بازرسی‌ها به همراه وضعیت، زمان‌بندی و تاریخ تکمیل",
    statusOptions: [
      { value: "draft", label: "پیش‌نویس" },
      { value: "in_progress", label: "در حال اجرا" },
      { value: "completed", label: "انجام‌یافته" },
      { value: "cancelled", label: "لغوشده" },
    ],

  },
  {
    id: "risks",
    name: "گزارش ارزیابی ریسک",
    description: "فهرست خطرات و ارزیابی‌های ثبت‌شده به همراه شدت، احتمال و طبقه ریسک",
    statusOptions: [
      { value: "draft", label: "پیش‌نویس" },
      { value: "approved", label: "تأییدشده" },
      { value: "rejected", label: "ردشده" },
    ],
  },
  {
    id: "non-conformities",
    name: "گزارش عدم‌انطباق‌ها",
    description: "فهرست عدم‌انطباق‌ها به تفکیک کارگاه، شدت و وضعیت رسیدگی",
    statusOptions: [
      { value: "open", label: "باز" },
      { value: "in_progress", label: "در حال پیگیری" },
      { value: "ready_for_review", label: "آماده بررسی" },
      { value: "closed", label: "بسته‌شده" },
    ],
  },
  {
    id: "assets",
    name: "گزارش تجهیزات و کالیبراسیون",
    description: "کد و وضعیت تجهیزات، وضعیت و سررسید کالیبراسیون، موعد نگهداری و دستورکارهای باز",
    statusOptions: [
      { value: "ready", label: "آماده به کار" },
      { value: "under_maintenance", label: "در حال سرویس/تعمیر" },
      { value: "out_of_service", label: "خارج از سرویس" },
      { value: "retired", label: "بازنشسته" },
    ],
  },
  {
    id: "training",
    name: "گزارش آموزش کارکنان",
    description: "ثبت‌نام، حضور، قبولی/مردودی، امتیاز و تاریخ تکمیل دوره‌های آموزشی",
    statusOptions: [
      { value: "registered", label: "ثبت‌نام‌شده" },
      { value: "attended", label: "حاضر" },
      { value: "absent", label: "غایب" },
      { value: "cancelled", label: "لغوشده" },
    ],
  },
  {
    id: "competencies",
    name: "گزارش صلاحیت‌ها",
    description: "صلاحیت معتبر، نزدیک انقضا، منقضی، تعلیق‌شده یا لغوشده به همراه گواهی و دوره منبع",
    statusOptions: [
      { value: "active", label: "فعال" },
      { value: "suspended", label: "تعلیق‌شده" },
      { value: "revoked", label: "لغوشده" },
    ],
  },
  {
    id: "ppe",
    name: "گزارش تجهیزات حفاظت فردی",
    description: "تحویل، برگشت، تعویض و وضعیت تعویض PPE به تفکیک کارمند و سریال",
    statusOptions: [
      { value: "active", label: "در استفاده" },
      { value: "returned", label: "برگشت‌داده‌شده" },
      { value: "replaced", label: "تعویض‌شده" },
      { value: "disposed", label: "خارج از سرویس" },
    ],
  },
  {
    id: "corrective-actions",
    name: "گزارش اقدامات اصلاحی (CAPA)",
    description: "اقدامات اصلاحی تعریف‌شده، مسئول اجرا، مهلت و نتیجه اثربخشی",
    statusOptions: [
      { value: "open", label: "باز" },
      { value: "in_progress", label: "در حال انجام" },
      { value: "pending_verification", label: "در انتظار تأیید" },
      { value: "completed", label: "انجام‌یافته" },
    ],
  },
  {
    id: "permits",
    name: "گزارش پروانه‌های کار (PTW)",
    description: "مجوزهای کار گرم، ارتفاع، فضای بسته، حفاری و وضعیت صلاحیت تیم کاری",
    statusOptions: [
      { value: "requested", label: "درخواست‌شده" },
      { value: "approved", label: "تأییدشده" },
      { value: "active", label: "فعال و در حال اجرا" },
      { value: "suspended", label: "معلق‌شده" },
      { value: "completed", label: "اتمام کار عملیاتی" },
      { value: "closed", label: "مختومه‌شده" },
      { value: "cancelled", label: "لغوشده" },
    ],
  },
  {
    id: "incidents",
    name: "گزارش حوادث و شبه‌حوادث",
    description: "سوابق حوادث، شبه‌حوادث، اعمال ناایمن، تحلیل ریشه‌ای و تلفات روز کاری",
    statusOptions: [
      { value: "reported", label: "گزارش‌شده" },
      { value: "under_review", label: "در حال بررسی اولیه" },
      { value: "under_investigation", label: "در حال تحلیل ریشه‌ای" },
      { value: "action_required", label: "نیازمند اقدام اصلاحی" },
      { value: "closed", label: "مختومه‌شده" },
    ],
  },
];

export function ReportsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [workplaceId, setWorkplaceId] = useState<string>("");
  const [selectedReport, setSelectedReport] = useState<string>("inspections");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(controller.signal)
      .then((items) => {
        setOrganizations(items);
        if (items.length > 0) {
          setOrganizationId(items[0].id);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setWorkplaces([]);
      setWorkplaceId("");
      return;
    }
    const controller = new AbortController();
    fetchWorkplaces(organizationId, controller.signal)
      .then((items) => {
        setWorkplaces(items);
        setWorkplaceId("");
      })
      .catch(() => {});
    return () => controller.abort();
  }, [organizationId]);

  const activeDef = REPORTS.find((r) => r.id === selectedReport) ?? REPORTS[0];

  function handleDownload(reportId: string) {
    if (!organizationId) return;
    const params: Record<string, string> = {};
    if (workplaceId) params.workplace = workplaceId;
    if (statusFilter) params.status = statusFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    const url = getReportExportUrl(reportId, organizationId, params);
    window.open(url, "_blank");
  }

  return (
    <div className="reports-page stack" dir="rtl">
      <header className="page-header">
        <h2>گزارش‌ها و خروجی داده‌ها</h2>
        <p className="muted">دریافت خروجی سازگار با اکسل (CSV) با فیلترهای تفکیک‌شده و محدود به سازمان مجاز</p>
      </header>

      <section className="card">
        <h3>فیلترهای گزارش</h3>
        <div
          className="toolbar-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          <div>
            <label htmlFor="rep-org">سازمان</label>
            <select
              id="rep-org"
              value={organizationId ?? ""}
              onChange={(e) => setOrganizationId(Number(e.target.value))}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rep-type">نوع گزارش</label>
            <select
              id="rep-type"
              value={selectedReport}
              onChange={(e) => {
                setSelectedReport(e.target.value);
                setStatusFilter("");
              }}
            >
              {REPORTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rep-wp">محل کار / کارگاه</label>
            <select
              id="rep-wp"
              value={workplaceId}
              onChange={(e) => setWorkplaceId(e.target.value)}
            >
              <option value="">همه کارگاه‌ها</option>
              {workplaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rep-status">وضعیت</label>
            <select
              id="rep-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">همه وضعیت‌ها</option>
              {activeDef.statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rep-from">از تاریخ</label>
            <input
              id="rep-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="rep-to">تا تاریخ</label>
            <input
              id="rep-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleDownload(selectedReport)}
            disabled={!organizationId}
          >
            <Download size={16} />
            دریافت خروجی {activeDef.name} (CSV / Excel)
          </button>
        </div>
      </section>

      <section className="card">
        <h3>انواع گزارش‌های قابل دریافت</h3>
        <div className="reports-list stack" style={{ marginTop: "1rem", gap: "0.8rem" }}>
          {REPORTS.map((r) => (
            <div
              key={r.id}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: selectedReport === r.id ? "var(--primary-subtle)" : "var(--bg-surface)",
                borderColor: selectedReport === r.id ? "var(--primary)" : "var(--border-default)",
                margin: 0,
                padding: "1.25rem",
              }}
            >
              <div>
                <strong>{r.name}</strong>
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
                  {r.description}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleDownload(r.id)}
                disabled={!organizationId}
              >
                <Download size={14} />
                دانلود CSV
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
