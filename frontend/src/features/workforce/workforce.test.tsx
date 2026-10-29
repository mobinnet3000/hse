import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthContext";
import { jsonResponse, mockApi, riskRoutes } from "../../test/mockApi";
import { WorkforcePage } from "./WorkforcePage";

const stats = {
  employees_total: 2,
  employees_active: 2,
  employees_without_account: 1,
  courses_active: 1,
  sessions_upcoming: 1,
  sessions_completed: 1,
  attendance_passed: 1,
  attendance_failed: 0,
  attendance_absent: 0,
  attendance_pending: 0,
  competency_records_total: 2,
  competency_valid: 1,
  competency_expiring_soon: 1,
  competency_expired: 0,
  competency_suspended: 0,
  competency_revoked: 0,
  competency_due_soon_days: 30,
  ppe_items: 1,
  ppe_items_active: 1,
  ppe_stock_below_minimum: 1,
  ppe_active_assignments: 1,
  ppe_assignments_due_soon: 1,
  ppe_assignments_overdue: 0,
  ppe_replacement_due_soon_days: 30,
  capabilities: {
    can_manage: true,
    can_conduct_training: true,
    can_issue_competency: true,
    can_operate_ppe: true,
  },
};

const employee = {
  id: 1,
  organization: 1,
  organization_name: "سازمان الف",
  workplace: 1,
  workplace_name: "کارگاه الف",
  employee_no: "EMP-100",
  first_name: "علی",
  last_name: "محمدی",
  full_name: "علی محمدی",
  job_title: "جوشکار",
  user: 2,
  user_detail: { id: 2, username: "ali", full_name: "علی محمدی" },
  is_active: true,
  notes: "",
  training_count: 1,
  valid_competency_count: 1,
  expiring_competency_count: 1,
  active_ppe_count: 1,
  can_manage: true,
  can_issue_competency: true,
  can_operate_ppe: true,
  is_synthetic: true,
};

const secondEmployee = {
  ...employee,
  id: 2,
  employee_no: "EMP-200",
  first_name: "مریم",
  last_name: "رضایی",
  full_name: "مریم رضایی",
  job_title: "کارشناس HSE",
  user: null,
  user_detail: null,
  training_count: 0,
  valid_competency_count: 0,
  expiring_competency_count: 0,
  active_ppe_count: 0,
};

const course = {
  id: 1,
  organization: 1,
  code: "TR-001",
  title: "کار گرم و جوشکاری ایمن",
  category: "ایمنی حریق",
  description: "",
  objectives: "",
  duration_minutes: 120,
  delivery_type: "in_person",
  delivery_type_display: "حضوری",
  is_mandatory: true,
  requires_renewal: true,
  validity_months: 24,
  is_active: true,
  session_count: 1,
  trained_employee_count: 1,
  can_manage: true,
  is_synthetic: true,
};

const session = {
  id: 1,
  organization: 1,
  course: 1,
  course_detail: { id: 1, code: "TR-001", title: course.title, duration_minutes: 120 },
  workplace: 1,
  workplace_name: "کارگاه الف",
  instructor_name: "مهندس صادقی",
  scheduled_on: "2026-10-20",
  duration_minutes: 120,
  capacity: 20,
  status: "in_progress",
  status_display: "در حال برگزاری",
  notes: "",
  attendance_count: 1,
  capacity_remaining: 19,
  can_train: true,
  can_manage: true,
  is_synthetic: true,
};

const attendance = {
  id: 1,
  organization: 1,
  session: 1,
  session_detail: { id: 1, course: 1, course_title: course.title, scheduled_on: "2026-10-20", status: "in_progress" },
  employee: 1,
  employee_detail: { id: 1, employee_no: "EMP-100", full_name: "علی محمدی", job_title: "جوشکار" },
  attendance_status: "attended",
  attendance_status_display: "حاضر",
  assessment_result: "passed",
  assessment_result_display: "قبول",
  score: 88,
  completed_on: "2026-10-20",
  notes: "",
  is_passed: true,
  can_edit: true,
  recorded_by_name: "مدیر HSE",
  is_synthetic: true,
};

const competency = {
  id: 1,
  organization: 1,
  code: "CMP-HOT",
  name: "صلاحیت کار گرم",
  description: "",
  allowed_activities: "جوشکاری و برشکاری کنترل‌شده",
  is_mandatory: true,
  validity_months: 24,
  accepted_courses: [1],
  accepted_courses_detail: [{ id: 1, code: "TR-001", title: course.title }],
  is_active: true,
  valid_record_count: 1,
  expired_record_count: 0,
  can_manage: true,
  is_synthetic: true,
};

const employeeCompetency = {
  id: 1,
  organization: 1,
  employee: 1,
  employee_detail: { id: 1, employee_no: "EMP-100", full_name: "علی محمدی", job_title: "جوشکار" },
  competency: 1,
  competency_detail: { id: 1, code: "CMP-HOT", name: "صلاحیت کار گرم", validity_months: 24 },
  achieved_on: "2025-01-01",
  expires_on: "2026-11-15",
  source_course: 1,
  source_course_title: course.title,
  source_session: 1,
  source_session_label: "کار گرم و جوشکاری ایمن — ۲۰۲۶/۱۰/۲۰",
  certificate_number: "CERT-HOT-1",
  status: "active",
  effective_status: "expiring_soon",
  effective_status_display: "نزدیک انقضا",
  days_until_expiry: 20,
  is_valid: true,
  notes: "",
  can_issue: true,
  recorded_by_name: "مدیر HSE",
  is_synthetic: true,
};

const requirement = {
  id: 1,
  organization: 1,
  permit_type: "hot_work",
  permit_type_display: "کار گرم",
  competency: 1,
  competency_detail: { id: 1, code: "CMP-HOT", name: "صلاحیت کار گرم" },
  notes: "پیش از صدور مجوز بررسی شود.",
  can_manage: true,
  is_synthetic: true,
};

const ppeItem = {
  id: 1,
  organization: 1,
  code: "PPE-HARNESS",
  name: "هارنس ایمنی",
  category: "حفاظت سقوط",
  description: "",
  usage_requirements: "",
  sizes: "M, L",
  replacement_interval_days: 365,
  inspection_required: true,
  is_durable: true,
  tracks_serial: true,
  is_active: true,
  stock_total: 8,
  active_assignment_count: 1,
  can_manage: true,
  is_synthetic: true,
};

const ppeStock = {
  id: 1,
  organization: 1,
  item: 1,
  item_detail: { id: 1, code: "PPE-HARNESS", name: "هارنس ایمنی", category: "حفاظت سقوط", tracks_serial: true },
  workplace: 1,
  workplace_name: "کارگاه الف",
  location_name: "انبار مرکزی",
  quantity_on_hand: 2,
  quantity_minimum: 3,
  is_below_minimum: true,
  is_active: true,
  can_manage: true,
  is_synthetic: true,
};

const ppeAssignment = {
  id: 1,
  organization: 1,
  employee: 1,
  employee_detail: { id: 1, employee_no: "EMP-100", full_name: "علی محمدی", job_title: "جوشکار" },
  item: 1,
  item_detail: { id: 1, code: "PPE-HARNESS", name: "هارنس ایمنی", category: "حفاظت سقوط", tracks_serial: true },
  item_code: "PPE-HARNESS",
  item_name: "هارنس ایمنی",
  item_category: "حفاظت سقوط",
  stock: 1,
  stock_detail: {
    id: 1, item: 1, item_code: "PPE-HARNESS", item_name: "هارنس ایمنی", workplace: 1,
    workplace_name: "کارگاه الف", location_name: "انبار مرکزی", quantity_on_hand: 2, quantity_minimum: 3, is_active: true,
  },
  stock_location: "انبار مرکزی",
  quantity: 1,
  serial_number: "HARNESS-001",
  issued_on: "2026-01-01",
  condition_on_issue: "سالم",
  replacement_due_on: "2026-11-10",
  returned_on: null,
  return_condition: "",
  status: "active",
  status_display: "در استفاده",
  usage_status: "due_soon",
  usage_status_display: "نزدیک تعویض",
  is_overdue: false,
  is_due_soon: true,
  notes: "",
  can_return: true,
  can_replace: true,
  can_dispose: true,
  events: [
    {
      id: 1,
      event_type: "issued",
      event_type_display: "تحویل",
      occurred_on: "2026-01-01",
      event_date: "2026-01-01",
      quantity: 1,
      condition: "سالم",
      notes: "",
      actor_name: "سرپرست کارگاه",
    },
  ],
  is_synthetic: true,
};

const workplace = { id: 1, organization: 1, name: "کارگاه الف", code: "WP-1", is_active: true };

function routes(
  overrides: Record<string, (init?: RequestInit) => Response | Promise<Response>> = {},
) {
  return riskRoutes({
    "/workplaces/": () => jsonResponse([workplace]),
    "/workforce/stats/": () => jsonResponse(stats),
    "/workforce/employees/": () => jsonResponse([employee, secondEmployee]),
    "/workforce/courses/": () => jsonResponse([course]),
    "/workforce/training-sessions/": () => jsonResponse([session]),
    "/workforce/training-attendances/": () => jsonResponse([attendance]),
    "/workforce/competencies/": () => jsonResponse([competency]),
    "/workforce/employee-competencies/": () => jsonResponse([employeeCompetency]),
    "/workforce/permit-requirements/": () => jsonResponse([requirement]),
    "/workforce/ppe-items/": () => jsonResponse([ppeItem]),
    "/workforce/ppe-stock/": () => jsonResponse([ppeStock]),
    "/workforce/ppe-assignments/": () => jsonResponse([ppeAssignment]),
    ...overrides,
  });
}

function renderPage() {
  return render(
    <AuthProvider>
      <WorkforcePage />
    </AuthProvider>,
  );
}

describe("Workforce, training, competency and PPE UI", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dashboard alerts, employees, expiring competencies and PPE history", async () => {
    mockApi(routes());
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "آموزش، صلاحیت و تجهیزات حفاظت فردی" })).toBeInTheDocument();
    expect(await screen.findByText("صلاحیت‌های نیازمند اقدام")).toBeInTheDocument();
    expect(screen.getByText(/علی محمدی — صلاحیت کار گرم/)).toBeInTheDocument();
    expect(screen.getByText(/هارنس ایمنی در انبار مرکزی/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "کارکنان" }));
    expect(await screen.findByText("EMP-100")).toBeInTheDocument();
    expect(screen.getByText("EMP-200")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "صلاحیت" }));
    expect((await screen.findAllByText("نزدیک انقضا")).length).toBeGreaterThan(0);
    expect(screen.getByText("20 روز مانده")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "تجهیزات حفاظت فردی" }));
    expect(await screen.findByText("HARNESS-001")).toBeInTheDocument();
    expect(screen.getByText("1 رویداد")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "برگشت" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تعویض" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "امحا" })).toBeInTheDocument();
  });

  it("shows loading, empty and load-error states from real server responses", async () => {
    let resolveStats: ((response: Response) => void) | undefined;
    const pendingStats = new Promise<Response>((resolve) => {
      resolveStats = resolve;
    });
    mockApi(routes({ "/workforce/stats/": () => pendingStats }));
    const first = renderPage();
    expect(await screen.findByText(/در حال بارگذاری داده‌های آموزش/)).toBeInTheDocument();
    resolveStats?.(jsonResponse(stats));
    expect(await screen.findByText("صلاحیت‌های نیازمند اقدام")).toBeInTheDocument();
    first.unmount();

    mockApi(routes({
      "/workforce/employees/": () => jsonResponse([]),
      "/workforce/courses/": () => jsonResponse([]),
      "/workforce/training-sessions/": () => jsonResponse([]),
      "/workforce/training-attendances/": () => jsonResponse([]),
      "/workforce/competencies/": () => jsonResponse([]),
      "/workforce/employee-competencies/": () => jsonResponse([]),
      "/workforce/permit-requirements/": () => jsonResponse([]),
      "/workforce/ppe-items/": () => jsonResponse([]),
      "/workforce/ppe-stock/": () => jsonResponse([]),
      "/workforce/ppe-assignments/": () => jsonResponse([]),
    }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "آموزش، صلاحیت و تجهیزات حفاظت فردی" });
    await user.click(screen.getByRole("tab", { name: "کارکنان" }));
    expect(await screen.findByText("کارمندی با این فیلترها یافت نشد.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "آموزش" }));
    expect(await screen.findByText("دوره آموزشی ثبت نشده است.")).toBeInTheDocument();
    expect(screen.getByText("نوبت آموزشی ثبت نشده است.")).toBeInTheDocument();

    mockApi(routes({
      "/workforce/stats/": () => jsonResponse({ error: { code: "server_error", message: "خطای سرور آموزش" } }, 500),
    }));
    renderPage();
    expect(await screen.findByText("خطای سرور آموزش")).toBeInTheDocument();
  });

  it("filters employees and competencies in the UI", async () => {
    mockApi(routes());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("صلاحیت‌های نیازمند اقدام");
    await user.click(screen.getByRole("tab", { name: "کارکنان" }));
    await user.type(await screen.findByLabelText("جستجو"), "مریم");
    expect(await screen.findByText("EMP-200")).toBeInTheDocument();
    expect(screen.queryByText("EMP-100")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "صلاحیت" }));
    await user.selectOptions(screen.getByLabelText("وضعیت"), "expired");
    expect(await screen.findByText("سابقه صلاحیتی با این فیلترها یافت نشد.")).toBeInTheDocument();
  });

  it("submits a new employee and renders API field validation errors", async () => {
    const spy = mockApi(routes({
      "/workforce/employees/": (init) => {
        if (init?.method === "POST") {
          return jsonResponse({
            error: {
              code: "invalid",
              message: "اطلاعات کارمند نامعتبر است.",
              details: { employee_no: ["این شماره پرسنلی قبلاً ثبت شده است."] },
            },
          }, 400);
        }
        return jsonResponse([employee, secondEmployee]);
      },
    }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("صلاحیت‌های نیازمند اقدام");
    await user.click(screen.getByRole("tab", { name: "کارکنان" }));
    await user.click(await screen.findByRole("button", { name: "ثبت کارمند" }));
    const dialog = await screen.findByRole("dialog", { name: "ثبت کارمند" });
    await user.type(within(dialog).getByLabelText("شماره پرسنلی"), "EMP-100");
    await user.type(within(dialog).getByLabelText("نام"), "حسن");
    await user.type(within(dialog).getByLabelText("نام خانوادگی"), "کریمی");
    await user.click(within(dialog).getByRole("button", { name: "ذخیره" }));

    expect(await screen.findByText(/اطلاعات کارمند نامعتبر است/)).toBeInTheDocument();
    expect(screen.getByText(/employee_no: این شماره پرسنلی قبلاً ثبت شده است/)).toBeInTheDocument();
    expect(spy.mock.calls.some(([url, init]) => String(url).includes("/workforce/employees/") && init?.method === "POST")).toBe(true);
  });

  it("completes a training session and records attendance", async () => {
    const spy = mockApi(routes({
      "/workforce/training-sessions/1/": (init) => {
        if (init?.method === "PATCH") return jsonResponse({ ...session, status: "completed", status_display: "برگزارشده" });
        return jsonResponse(session);
      },
    }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("صلاحیت‌های نیازمند اقدام");
    await user.click(screen.getByRole("tab", { name: "آموزش" }));
    await user.click(await screen.findByRole("button", { name: "پایان" }));
    await waitFor(() =>
      expect(spy.mock.calls.some(([url, init]) => String(url).includes("/workforce/training-sessions/1/") && init?.method === "PATCH")).toBe(true),
    );
    expect(await screen.findByText("وضعیت نوبت آموزشی تغییر کرد.")).toBeInTheDocument();
  });

  it("records the full PPE return, replace and dispose lifecycle", async () => {
    const spy = mockApi(routes({
      "/workforce/ppe-assignments/1/return/": () => jsonResponse({ ...ppeAssignment, status: "returned", usage_status: "returned" }),
      "/workforce/ppe-assignments/1/replace/": () => jsonResponse({ ...ppeAssignment, serial_number: "HARNESS-002" }),
      "/workforce/ppe-assignments/1/dispose/": () => jsonResponse({ ...ppeAssignment, status: "disposed", usage_status: "disposed" }),
    }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("صلاحیت‌های نیازمند اقدام");
    await user.click(screen.getByRole("tab", { name: "تجهیزات حفاظت فردی" }));
    await screen.findByText("HARNESS-001");

    await user.click(screen.getByRole("button", { name: "برگشت" }));
    let dialog = await screen.findByRole("dialog", { name: "ثبت برگشت تجهیزات" });
    expect(within(dialog).getByRole("checkbox", { name: /افزودن به موجودی قابل استفاده/ })).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "ثبت برگشت" }));
    expect(await screen.findByText("برگشت تجهیزات ثبت شد.")).toBeInTheDocument();
    await waitFor(() =>
      expect(spy.mock.calls.some(([url]) => String(url).includes("/ppe-assignments/1/return/"))).toBe(true),
    );

    await waitFor(() => expect(screen.queryByText("در حال به‌روزرسانی…")).not.toBeInTheDocument());
    await user.click(await screen.findByRole("button", { name: "تعویض" }));
    dialog = await screen.findByRole("dialog", { name: "ثبت تعویض تجهیزات" });
    await user.type(within(dialog).getByLabelText("سریال جدید"), "HARNESS-002");
    await user.click(within(dialog).getByRole("button", { name: "ثبت تعویض" }));
    expect(await screen.findByText("تعویض تجهیزات ثبت شد.")).toBeInTheDocument();
    await waitFor(() =>
      expect(spy.mock.calls.some(([url, init]) => String(url).includes("/ppe-assignments/1/replace/") && String(init?.body).includes('"restock_old":false'))).toBe(true),
    );

    await waitFor(() => expect(screen.queryByText("در حال به‌روزرسانی…")).not.toBeInTheDocument());
    await user.click(await screen.findByRole("button", { name: "امحا" }));
    dialog = await screen.findByRole("dialog", { name: "امحا تجهیزات" });
    await user.click(within(dialog).getByRole("button", { name: "ثبت امحا" }));
    expect(await screen.findByText("امحای تجهیزات ثبت شد.")).toBeInTheDocument();
  });

  it("hides mutations when server capabilities deny access", async () => {
    const deniedEmployee = { ...employee, can_manage: false, can_issue_competency: false, can_operate_ppe: false };
    mockApi(routes({
      "/workforce/stats/": () => jsonResponse({
        ...stats,
        capabilities: {
          can_manage: false,
          can_conduct_training: false,
          can_issue_competency: false,
          can_operate_ppe: false,
        },
      }),
      "/workforce/employees/": () => jsonResponse([deniedEmployee]),
      "/workforce/ppe-assignments/": () => jsonResponse([{
        ...ppeAssignment,
        can_return: false,
        can_replace: false,
        can_dispose: false,
      }]),
    }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("صلاحیت‌های نیازمند اقدام");
    await user.click(screen.getByRole("tab", { name: "کارکنان" }));
    expect(await screen.findByText("EMP-100")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ثبت کارمند" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ویرایش" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "صلاحیت" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PPE" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "صلاحیت" }));
    expect(screen.queryByRole("button", { name: "صدور صلاحیت" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "تجهیزات حفاظت فردی" }));
    expect(screen.queryByRole("button", { name: "تحویل جدید" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "برگشت" })).not.toBeInTheDocument();
  });
});
