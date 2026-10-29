import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkforcePage } from "./WorkforcePage";
import { AuthProvider } from "../auth/AuthContext";
import { jsonResponse, mockApi, riskRoutes, testOrganization } from "../../test/mockApi";

const mockEmployee = {
  id: 1,
  organization: 1,
  organization_name: "سازمان الف",
  employee_no: "EMP-001",
  first_name: "امیر",
  last_name: "شریفی",
  full_name: "امیر شریفی",
  national_id: "1234567890",
  job_title: "جوشکار صنعتی",
  workplace: 1,
  workplace_name: "کارگاه الف",
  is_active: true,
  is_contractor: false,
  active_competency_count: 2,
  active_ppe_count: 3,
  created_at: "2026-10-20T08:00:00Z",
};

const mockCourse = {
  id: 1,
  organization: 1,
  code: "TRN-HOT-01",
  title: "اصول ایمنی کار گرم و جوشکاری",
  category: "ایمنی فرآیند",
  duration_minutes: 480,
  delivery_type: "practical",
  delivery_type_display: "عملی / کارگاهی",
  is_mandatory: true,
  requires_renewal: true,
  validity_months: 12,
  is_active: true,
  session_count: 2,
  created_at: "2026-10-20T08:00:00Z",
};

const mockSession = {
  id: 1,
  organization: 1,
  course: 1,
  course_code: "TRN-HOT-01",
  course_title: "اصول ایمنی کار گرم و جوشکاری",
  workplace: 1,
  workplace_name: "کارگاه الف",
  scheduled_on: "2026-10-25",
  trainer_name: "مهندس علوی",
  capacity: 20,
  status: "completed",
  status_display: "برگزار شده",
  attendee_count: 15,
  passed_count: 14,
  created_at: "2026-10-20T08:00:00Z",
};

const mockAttendance = {
  id: 1,
  organization: 1,
  session: 1,
  session_detail: {
    id: 1,
    course_title: "اصول ایمنی کار گرم و جوشکاری",
    scheduled_on: "2026-10-25",
    trainer_name: "مهندس علوی",
  },
  employee: 1,
  employee_detail: {
    id: 1,
    employee_no: "EMP-001",
    full_name: "امیر شریفی",
    job_title: "جوشکار صنعتی",
  },
  attendance_status: "attended",
  attendance_status_display: "حاضر",
  assessment_result: "passed",
  assessment_result_display: "قبول",
  score: 95,
  completed_on: "2026-10-25",
  is_passed: true,
  created_at: "2026-10-20T08:00:00Z",
};

const mockCompetency = {
  id: 1,
  organization: 1,
  code: "CMP-HOT-01",
  name: "صلاحیت کار گرم و برشکاری",
  description: "مجوز اجرای عملیات جوشکاری و برشکاری در محیط‌های پرخطر",
  allowed_activities: "جوشکاری، برشکاری حرارتی، سنگ‌زنی لوله",
  validity_months: 12,
  is_active: true,
  accepted_courses: [1],
  active_holder_count: 5,
  created_at: "2026-10-20T08:00:00Z",
};

const mockEmployeeCompetency = {
  id: 1,
  organization: 1,
  employee: 1,
  employee_detail: {
    id: 1,
    employee_no: "EMP-001",
    full_name: "امیر شریفی",
  },
  competency: 1,
  competency_detail: {
    id: 1,
    code: "CMP-HOT-01",
    name: "صلاحیت کار گرم و برشکاری",
    validity_months: 12,
  },
  achieved_on: "2026-10-20",
  expires_on: "2027-10-20",
  certificate_number: "CERT-2026-001",
  status: "active",
  status_display: "فعال",
  effective_status: "valid",
  effective_status_display: "معتبر",
  is_effective: true,
  days_to_expiry: 359,
  created_at: "2026-10-20T08:00:00Z",
};

const mockPermitRequirement = {
  id: 1,
  organization: 1,
  permit_type: "hot_work",
  permit_type_display: "کار گرم و جوشکاری",
  competency: 1,
  competency_detail: {
    id: 1,
    code: "CMP-HOT-01",
    name: "صلاحیت کار گرم و برشکاری",
  },
  created_at: "2026-10-20T08:00:00Z",
};

const mockPPEItem = {
  id: 1,
  organization: 1,
  code: "PPE-HLM-01",
  name: "کلاه ایمنی استاندارد با بند چانه",
  category: "حفاظت سر",
  standard_reference: "EN 397",
  replacement_interval_days: 730,
  tracks_serial: true,
  is_durable: true,
  is_active: true,
  stock_total: 25,
  active_assignment_count: 10,
  created_at: "2026-10-20T08:00:00Z",
};

const mockPPEStock = {
  id: 1,
  organization: 1,
  item: 1,
  item_code: "PPE-HLM-01",
  item_name: "کلاه ایمنی استاندارد با بند چانه",
  workplace: 1,
  workplace_name: "کارگاه الف",
  location_name: "انبار مرکزی تجهیزات",
  quantity_on_hand: 15,
  quantity_minimum: 5,
  is_below_minimum: false,
  created_at: "2026-10-20T08:00:00Z",
};

const mockPPEAssignment = {
  id: 1,
  organization: 1,
  employee: 1,
  employee_detail: {
    id: 1,
    employee_no: "EMP-001",
    full_name: "امیر شریفی",
  },
  item: 1,
  item_code: "PPE-HLM-01",
  item_name: "کلاه ایمنی استاندارد با بند چانه",
  stock: 1,
  quantity: 1,
  serial_number: "HLM-2026-0042",
  status: "issued",
  status_display: "تحویل‌شده به کارمند",
  issued_on: "2026-10-20",
  replacement_due_on: "2028-10-19",
  is_replacement_due: false,
  days_to_replacement: 729,
  condition_on_issue: "سالم و نو",
  created_at: "2026-10-20T08:00:00Z",
};

const mockContractor = {
  id: 1,
  organization: 1,
  name: "شرکت مهندسی پایدار سازه",
  registration_no: "REG-99120",
  economic_code: "10103456789",
  contact_person: "مهندس احمدی",
  contact_phone: "02188990011",
  contact_email: "info@paydarsazeh.ir",
  status: "approved",
  status_display: "تایید شده",
  contract_start: "2026-01-01",
  contract_end: "2026-12-31",
  safety_score: 92.5,
  is_active: true,
  document_count: 2,
  worker_count: 5,
  evaluation_count: 1,
  created_at: "2026-10-20T08:00:00Z",
};

const mockJobPosition = {
  id: 1,
  organization: 1,
  code: "JOB-ELEC-01",
  title: "تکنسین برق صنعتی",
  department: "تعمیرات و نگهداری",
  description: "نگهداری تابلوهای فشار قوی",
  risk_level: "high",
  risk_level_display: "خطر بالا",
  requires_medical_check: true,
  medical_interval_months: 12,
  is_active: true,
  active_assignments_count: 1,
  created_at: "2026-10-20T08:00:00Z",
};

const mockAttendanceRecord = {
  id: 1,
  organization: 1,
  workplace: 1,
  workplace_name: "کارگاه الف",
  person_type: "employee",
  person_type_display: "پرسنل رسمی",
  person_name: "امیر شریفی (EMP-001)",
  employee: 1,
  contractor_worker: null,
  date: "2026-10-26",
  check_in: "2026-10-26T07:45:00Z",
  check_out: null,
  status: "present",
  status_display: "حاضر",
  remarks: "ورود سر شیفت",
  created_at: "2026-10-26T07:45:00Z",
};

const mockAttendanceRoster = {
  date: "2026-10-26",
  total_recorded: 1,
  present_count: 1,
  late_count: 0,
  absent_count: 0,
  early_departure_count: 0,
  employee_count: 1,
  contractor_worker_count: 0,
  attendance_records: [mockAttendanceRecord],
};

function renderWorkforce() {
  return render(
    <AuthProvider>
      <WorkforcePage />
    </AuthProvider>
  );
}

describe("WorkforcePage Integration Tests", () => {
  beforeEach(() => {
    mockApi(
      riskRoutes({
        "/organizations/": () => jsonResponse([testOrganization]),
        "/workplaces/": () => jsonResponse([{ id: 1, name: "کارگاه الف", organization: 1 }]),
        "/workforce/employees/": () => jsonResponse([mockEmployee]),
        "/workforce/courses/": () => jsonResponse([mockCourse]),
        "/workforce/training-sessions/": () => jsonResponse([mockSession]),
        "/workforce/training-attendances/": () => jsonResponse([mockAttendance]),
        "/workforce/competencies/": () => jsonResponse([mockCompetency]),
        "/workforce/employee-competencies/": () => jsonResponse([mockEmployeeCompetency]),
        "/workforce/permit-requirements/": () => jsonResponse([mockPermitRequirement]),
        "/workforce/ppe-items/": () => jsonResponse([mockPPEItem]),
        "/workforce/ppe-stock/": () => jsonResponse([mockPPEStock]),
        "/workforce/ppe-assignments/": () => jsonResponse([mockPPEAssignment]),
        "/workforce/contractors/": () => jsonResponse([mockContractor]),
        "/workforce/contractor-documents/": () => jsonResponse([]),
        "/workforce/contractor-workers/": () => jsonResponse([]),
        "/workforce/contractor-evaluations/": () => jsonResponse([]),
        "/workforce/jobs/": () => jsonResponse([mockJobPosition]),
        "/workforce/job-assignments/": () => jsonResponse([]),
        "/workforce/attendance/": () => jsonResponse([mockAttendanceRecord]),
        "/workforce/attendance/roster/": () => jsonResponse(mockAttendanceRoster),
        "/workforce/employees/1/training/": () => jsonResponse([mockAttendance]),
        "/workforce/employees/1/competencies/": () => jsonResponse([mockEmployeeCompetency]),
        "/workforce/employees/1/ppe/": () => jsonResponse([mockPPEAssignment]),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders page header and KPI metrics overview correctly", async () => {
    renderWorkforce();

    await waitFor(() => {
      expect(
        screen.getByText("مدیریت آموزش، صلاحیت کارکنان و تجهیزات حفاظت فردی (PPE)")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("کل کارکنان / فعال")).toBeInTheDocument();
    expect(screen.getByText("صلاحیت‌های معتبر")).toBeInTheDocument();
    expect(screen.getByText("صلاحیت‌های غیرمعتبر")).toBeInTheDocument();
    expect(screen.getByText("تخصیص‌های فعال PPE")).toBeInTheDocument();
    expect(
      screen.getByText("وضعیت سریع الزامات صلاحیت مجوز کار (PTW)")
    ).toBeInTheDocument();
  });

  it("displays employee list in employees tab", async () => {
    const user = userEvent.setup();
    renderWorkforce();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /پرسنل و سوابق/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /پرسنل و سوابق/ }));

    await waitFor(() => {
      expect(screen.getByText("امیر شریفی")).toBeInTheDocument();
    });

    expect(screen.getByText("EMP-001")).toBeInTheDocument();
    expect(screen.getByText("جوشکار صنعتی")).toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByPlaceholderText("جستجو با شماره پرسنلی، نام یا سمت...");
    await user.type(searchInput, "ناشناس");
    expect(screen.queryByText("EMP-001")).not.toBeInTheDocument();

    await user.clear(searchInput);
    expect(screen.getByText("EMP-001")).toBeInTheDocument();
  });

  it("displays training courses and sessions in training tab", async () => {
    const user = userEvent.setup();
    renderWorkforce();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /آموزش و نوبت‌ها/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /آموزش و نوبت‌ها/ }));

    await waitFor(() => {
      expect(screen.getByText("اصول ایمنی کار گرم و جوشکاری")).toBeInTheDocument();
    });

    expect(screen.getByText("TRN-HOT-01")).toBeInTheDocument();
    expect(screen.getByText("مهندس علوی")).toBeInTheDocument();
  });

  it("displays competencies and PTW requirements in competencies tab", async () => {
    const user = userEvent.setup();
    renderWorkforce();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /صلاحیت‌ها و مجوز کار/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /صلاحیت‌ها و مجوز کار/ }));

    await waitFor(() => {
      expect(screen.getAllByText("صلاحیت کار گرم و برشکاری").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("CMP-HOT-01").length).toBeGreaterThan(0);
    expect(screen.getByText("الزامات صلاحیت مجوزهای کار پرخطر (PTW)")).toBeInTheDocument();
  });

  it("displays PPE catalog, stock inventory, and active assignments in ppe tab", async () => {
    const user = userEvent.setup();
    renderWorkforce();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /تجهیزات حفاظت فردی PPE/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /تجهیزات حفاظت فردی PPE/ }));

    await waitFor(() => {
      expect(screen.getAllByText("کلاه ایمنی استاندارد با بند چانه").length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/انبار مرکزی تجهیزات/)).toBeInTheDocument();
    expect(screen.getByText("HLM-2026-0042")).toBeInTheDocument();
    expect(screen.getByText("تحویل‌شده به کارمند")).toBeInTheDocument();
  });

  it("opens employee dossier modal with comprehensive history", async () => {
    const user = userEvent.setup();
    renderWorkforce();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /پرسنل و سوابق/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /پرسنل و سوابق/ }));

    await waitFor(() => {
      expect(screen.getByText("امیر شریفی")).toBeInTheDocument();
    });

    const historyBtn = screen.getByText("مشاهده پرونده کامل");
    await user.click(historyBtn);

    await waitFor(() => {
      expect(screen.getByText("پرونده پرسنلی: امیر شریفی (EMP-001)")).toBeInTheDocument();
    });

    expect(screen.getByText("سوابق آموزشی")).toBeInTheDocument();
    expect(screen.getByText("صلاحیت‌های احراز‌شده")).toBeInTheDocument();
    expect(screen.getByText("تجهیزات حفاظت فردی PPE")).toBeInTheDocument();
  });

  it("displays contractors tab with company dossier and safety score", async () => {
    const user = userEvent.setup();
    renderWorkforce();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /پیمانکاران و مدارک/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /پیمانکاران و مدارک/ }));

    await waitFor(() => {
      expect(screen.getByText("شرکت مهندسی پایدار سازه")).toBeInTheDocument();
    });

    expect(screen.getByText(/REG-99120/)).toBeInTheDocument();
    expect(screen.getByText(/92.5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ثبت پیمانکار جدید/ })).toBeInTheDocument();
  });

  it("displays jobs and positions tab", async () => {
    const user = userEvent.setup();
    renderWorkforce();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /شناسنامه مشاغل و انتصاب/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /شناسنامه مشاغل و انتصاب/ }));

    await waitFor(() => {
      expect(screen.getByText("تکنسین برق صنعتی")).toBeInTheDocument();
    });

    expect(screen.getByText("JOB-ELEC-01")).toBeInTheDocument();
    expect(screen.getByText("تعمیرات و نگهداری")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تعریف شغل جدید/ })).toBeInTheDocument();
  });

  it("displays attendance and shift roster tab with real-time statistics", async () => {
    const user = userEvent.setup();
    renderWorkforce();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /حضور و غیاب شیفت/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /حضور و غیاب شیفت/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ثبت ورود \/ تردد شیفت/ })).toBeInTheDocument();
    });

    expect(screen.getByText("کل تردد ثبت‌شده شیفت")).toBeInTheDocument();
    expect(screen.getByText("امیر شریفی (EMP-001)")).toBeInTheDocument();
  });
});
