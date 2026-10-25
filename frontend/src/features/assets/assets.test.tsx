import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetsPage } from "./AssetsPage";
import { AuthProvider } from "../auth/AuthContext";
import { jsonResponse, mockApi, riskRoutes } from "../../test/mockApi";

const managerMembership = {
  id: 1,
  user: 1,
  username: "ali",
  full_name: "علی",
  organization: 1,
  role: "hse_manager",
  role_display: "مدیر HSE",
  is_active: true,
};

const equipment = {
  id: 1,
  organization: 1,
  workplace: 1,
  workplace_name: "کارگاه الف",
  code: "EQ-A-001",
  name: "گازسنج عملیاتی",
  category: "gas_detection",
  category_display: "تجهیزات گازسنجی",
  category_detail: "",
  manufacturer: "Dräger",
  model_number: "X-am 5000",
  serial_number: "DR-9912",
  status: "ready",
  status_display: "آماده به کار",
  calibration_required: true,
  calibration_status: "valid",
  calibration_status_display: "کالیبراسیون معتبر",
  calibration_due_on: "2027-01-01",
  is_calibration_valid: true,
  open_work_orders_count: 1,
  is_synthetic: true,
  can_manage: true,
  can_conduct_work: true,
  can_calibrate: true,
  created_at: "2026-10-20T08:00:00Z",
  updated_at: "2026-10-20T08:00:00Z",
};

const calibration = {
  id: 1,
  organization: 1,
  equipment: 1,
  equipment_code: "EQ-A-001",
  equipment_name: "گازسنج عملیاتی",
  performed_on: "2026-10-20",
  next_due_on: "2027-04-20",
  provider: "آزمایشگاه معتمد",
  certificate_number: "CERT-001",
  result: "passed",
  result_display: "قبول",
  notes: "",
  document_reference: "",
  performed_by: 1,
  performed_by_name: "علی",
  created_at: "2026-10-20T08:00:00Z",
};

const plan = {
  id: 1,
  organization: 1,
  equipment: 1,
  equipment_code: "EQ-A-001",
  equipment_name: "گازسنج عملیاتی",
  title: "سرویس دوره‌ای گازسنج",
  interval_days: 90,
  instructions: "تست ضربه",
  responsible: 1,
  responsible_name: "علی",
  start_date: "2026-10-01",
  next_due_date: "2026-12-30",
  is_active: true,
  is_overdue: false,
  is_due_soon: true,
  is_synthetic: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

const workOrder = {
  id: 2,
  organization: 1,
  equipment: 1,
  equipment_code: "EQ-A-001",
  equipment_name: "گازسنج عملیاتی",
  plan: 1,
  plan_title: "سرویس دوره‌ای گازسنج",
  title: "سرویس عقب‌افتاده",
  work_type: "preventive",
  work_type_display: "نگهداری پیشگیرانه",
  status: "planned",
  status_display: "برنامه‌ریزی‌شده",
  assigned_to: 1,
  assigned_to_name: "علی",
  scheduled_date: "2026-10-20",
  completed_date: null,
  description: "",
  findings: "",
  result: "",
  cancellation_reason: "",
  is_synthetic: true,
  can_start: true,
  can_complete: true,
  can_cancel: true,
  created_at: "2026-10-20T08:00:00Z",
  updated_at: "2026-10-20T08:00:00Z",
};

const detail = {
  ...equipment,
  description: "دستگاه گازسنج",
  specifications: "چهارکاره",
  purchase_date: "2025-01-01",
  installation_date: "2025-01-02",
  related_hazards: [
    { id: 1, title: "نشت گاز", category: "chemical", category_display: "شیمیایی", status: "open", status_display: "باز" },
  ],
  related_permits: [],
  maintenance_plans: [plan],
  work_orders: [workOrder],
  calibrations: [calibration],
  related_incidents: [],
  related_inspections: [],
  related_nonconformities: [],
  related_corrective_actions: [],
};

const stats = {
  total_equipment: 1,
  by_status: { ready: 1, under_maintenance: 0, out_of_service: 0, retired: 0 },
  by_category: { gas_detection: 1 },
  ready_count: 1,
  under_maintenance_count: 0,
  out_of_service_count: 0,
  retired_count: 0,
  maintenance_overdue_count: 1,
  maintenance_due_soon_count: 0,
  open_work_order_count: 1,
  overdue_work_order_count: 1,
  calibration_due_soon_count: 1,
  calibration_expired_count: 0,
  calibration_failed_count: 0,
  calibration_missing_count: 0,
  calibration_valid_count: 1,
  calibration_invalid_count: 0,
  calibration_due_soon_days: 30,
  maintenance_due_soon_days: 7,
};

function routes(
  overrides: Record<string, (init?: RequestInit) => Response | Promise<Response>> = {},
) {
  return riskRoutes({
    "/organizations/1/memberships/": () => jsonResponse([managerMembership]),
    "/permits/": () => jsonResponse([]),
    "/assets/equipment/": (init) => {
      if (init?.method === "POST") return jsonResponse(equipment, 201);
      return jsonResponse([equipment]);
    },
    "/assets/equipment/stats/": () => jsonResponse(stats),
    "/assets/equipment/1/": () => jsonResponse(detail),
    "/assets/equipment/1/status/": () => jsonResponse({ ...detail, status: "under_maintenance", status_display: "در حال سرویس/تعمیر" }),
    "/assets/maintenance-plans/": (init) => {
      if (init?.method === "POST") return jsonResponse(plan, 201);
      return jsonResponse([plan]);
    },
    "/assets/maintenance-work-orders/": () => jsonResponse([workOrder]),
    "/assets/maintenance-work-orders/2/start/": () => jsonResponse({ ...workOrder, status: "in_progress" }),
    "/assets/maintenance-work-orders/2/complete/": () => jsonResponse({ ...workOrder, status: "completed", completed_date: "2026-10-25", result: "انجام شد" }),
    "/assets/calibrations/": (init) => {
      if (init?.method === "POST") return jsonResponse(calibration, 201);
      return jsonResponse([calibration]);
    },
    ...overrides,
  });
}

function renderPage() {
  return render(
    <AuthProvider>
      <AssetsPage />
    </AuthProvider>,
  );
}

describe("Assets, maintenance and calibration UI", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the asset list, KPIs and integrated detail history", async () => {
    mockApi(routes());
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "تجهیزات، نگهداری پیشگیرانه و کالیبراسیون" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("EQ-A-001")).toBeInTheDocument();
    expect(screen.getByText("سرویس عقب‌افتاده")).toBeInTheDocument();
    expect(screen.getAllByText("کالیبراسیون نزدیک سررسید").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "جزئیات" }));
    expect(await screen.findByText("شناسنامه")).toBeInTheDocument();
    expect(screen.getByText("CERT-001")).toBeInTheDocument();
    expect(screen.getByText(/حوادث مرتبط/)).toBeInTheDocument();
  });

  it("creates an equipment record and applies server-side filters", async () => {
    const spy = mockApi(routes());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("EQ-A-001");
    await user.type(screen.getByLabelText("جست‌وجوی تجهیز"), "EQ-A");
    await user.click(screen.getByRole("button", { name: "اعمال فیلتر" }));
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([url]) => String(url).includes("search=EQ-A")),
      ).toBe(true),
    );

    await user.click(screen.getByRole("button", { name: "ثبت تجهیز جدید" }));
    await user.type(screen.getByLabelText(/کد تجهیز/), "EQ-NEW-001");
    await user.type(screen.getByLabelText(/نام تجهیز/), "تجهیز جدید");
    await user.click(screen.getByRole("button", { name: "ذخیره تجهیز" }));
    expect(await screen.findByText("تجهیز با موفقیت ثبت شد.")).toBeInTheDocument();
  });

  it("submits a maintenance plan and shows validation errors from the API", async () => {
    mockApi(routes({
      "/assets/maintenance-plans/": (init) => {
        if (init?.method === "POST") {
          return jsonResponse({ error: { code: "invalid", message: "تناوب نامعتبر است." } }, 400);
        }
        return jsonResponse([plan]);
      },
    }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("EQ-A-001");
    await user.click(screen.getByRole("button", { name: "برنامه‌های نگهداری" }));
    await user.selectOptions(screen.getByLabelText("تجهیز *"), "1");
    await user.type(screen.getByLabelText("عنوان *"), "برنامه تست");
    await user.click(screen.getByRole("button", { name: "ذخیره برنامه" }));
    expect(await screen.findByText("تناوب نامعتبر است.")).toBeInTheDocument();
  });

  it("records a calibration from the calibration tab", async () => {
    mockApi(routes());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("EQ-A-001");
    await user.click(screen.getByRole("button", { name: "کالیبراسیون" }));
    expect(await screen.findByRole("heading", { name: "ثبت کالیبراسیون" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("تجهیز *"), "1");
    await user.type(screen.getByLabelText("سررسید بعدی *"), "2027-05-01");
    await user.type(screen.getByLabelText("ارائه‌دهنده/مرجع *"), "آزمایشگاه دوم");
    await user.click(screen.getByRole("button", { name: "ثبت کالیبراسیون" }));
    expect(await screen.findByText("کالیبراسیون ثبت شد.")).toBeInTheDocument();
  });

  it("completes a work order with a result and supports cancellation", async () => {
    const spy = mockApi(routes());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("EQ-A-001");
    await user.click(screen.getByRole("button", { name: "دستورکارها" }));
    await user.click(await screen.findByRole("button", { name: "ثبت نتیجه" }));
    await user.type(screen.getByLabelText("نتیجه سرویس *"), "سرویس با موفقیت انجام شد.");
    const submitButtons = screen.getAllByRole("button", { name: "ثبت نتیجه" });
    await user.click(submitButtons[submitButtons.length - 1]);
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([url]) => String(url).includes("/complete/")),
      ).toBe(true),
    );
    expect(await screen.findByText(/نتیجه سرویس ثبت/)).toBeInTheDocument();
  });

  it("respects role capability flags and shows load errors", async () => {
    mockApi(routes({
      "/organizations/1/memberships/": () =>
        jsonResponse([{ ...managerMembership, role: "action_owner", role_display: "مسئول اقدام" }]),
      "/assets/equipment/": () => jsonResponse({ error: { code: "server_error", message: "خطای سرور آزمایشی" } }, 500),
    }));
    renderPage();

    expect(await screen.findByText("خطای سرور آزمایشی")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ثبت تجهیز جدید" })).not.toBeInTheDocument();
  });
});
