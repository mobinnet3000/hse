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
                background: selectedReport === r.id ? "#f9f9fc" : "transparent",
                border: selectedReport === r.id ? "1px solid #0056b3" : "1px solid #e0e0e0",
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
                className="btn btn-secondary"
                onClick={() => handleDownload(r.id)}
                disabled={!organizationId}
              >
                دانلود CSV
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
