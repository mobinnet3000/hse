import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PermitsPage } from "./PermitsPage";
import { AuthProvider } from "../auth/AuthContext";
import { jsonResponse, mockApi, riskRoutes } from "../../test/mockApi";
import type {
  PermitDetail,
  PermitListItem,
  PermitSummaryStats,
  ShiftHandoverItem,
  ShiftSafetySummary,
} from "../../services/api";

const mockStats: PermitSummaryStats = {
  total_permits: 3,
  active_count: 1,
  suspended_count: 1,
  requested_count: 1,
  approved_count: 0,
  closed_count: 0,
  expired_count: 0,
  by_type: { hot_work: 2, work_at_height: 1 },
  by_status: { active: 1, requested: 1, suspended: 1 },
};

const mockPermits: PermitListItem[] = [
  {
    id: 1,
    organization: 1,
    organization_name: "سازمان الف",
    workplace: 1,
    workplace_name: "سوله نورد",
    reference_code: "PTW-202610-0001",
    permit_type: "hot_work",
    permit_type_display: "کار گرم و شعله",
    title: "جوشکاری تقویتی شاسی نقاله",
    status: "active",
    status_display: "فعال و در حال اجرا",
    valid_from: "2026-10-19T08:00:00Z",
    valid_until: "2026-10-19T16:00:00Z",
    requester: 1,
    requester_name: "علی محمدی",
    approver: 2,
    approver_name: "رضا حسینی",
    gas_testing_required: false,
    isolation_loto_required: true,
    controls_verified: true,
    is_synthetic: true,
    created_at: "2026-10-19T07:30:00Z",
  },
  {
    id: 2,
    organization: 1,
    organization_name: "سازمان الف",
    workplace: 1,
    workplace_name: "سوله ریخته‌گری",
    reference_code: "PTW-202610-0002",
    permit_type: "work_at_height",
    permit_type_display: "کار در ارتفاع",
    title: "تعمیر ریل جرثقیل در ارتفاع ۱۵ متری",
    status: "requested",
    status_display: "درخواست‌شده",
    valid_from: "2026-10-20T08:00:00Z",
    valid_until: "2026-10-20T16:00:00Z",
    requester: 1,
    requester_name: "علی محمدی",
    gas_testing_required: false,
    isolation_loto_required: true,
    controls_verified: false,
    is_synthetic: true,
    created_at: "2026-10-19T08:00:00Z",
  },
];

const mockDetail: PermitDetail = {
  ...mockPermits[0],
  description: "جوشکاری تیر حمال و تعویض یاتاقان",
  work_area: "لاین میانی نقاله کوره",
  equipment_involved: "موتور گیربکس ۳۵ کیلووات",
  assigned_workers: "احمد سهرابی، مرتضی باقری",
  responsible_supervisor: 1,
  responsible_supervisor_name: "علی محمدی",
  precautions_taken: "عایق‌کاری با چادر نسوز",
  required_ppe: "شیلد جوشکاری، دستکش چرمی ساق‌بلند",
  gas_testing_results: "",
  isolation_loto_details: "سوئیچ اصلی تابلوی MCC قطع و قفل شد",
  controls_verified_by: 2,
  controls_verified_by_name: "رضا حسینی",
  controls_verified_at: "2026-10-19T07:55:00Z",
  review_notes: "تایید شرایط ایمنی",
  rejection_reason: "",
  suspension_reason: "",
  closure_summary: "",
  related_hazards: [],
  attachments: [],
  can_approve: true,
  can_control: true,
  can_cancel: true,
  updated_at: "2026-10-19T08:00:00Z",
};

const mockHandovers: ShiftHandoverItem[] = [
  {
    id: 1,
    organization: 1,
    organization_name: "سازمان الف",
    workplace: 1,
    workplace_name: "سوله نورد",
    shift_date: "2026-10-19",
    shift_type: "morning",
    shift_type_display: "شیفت صبح",
    status: "submitted",
    status_display: "در انتظار تحویل و تأیید",
    outgoing_supervisor: 1,
    outgoing_supervisor_name: "علی رستمی",
    incoming_supervisor: 2,
    incoming_supervisor_name: "محمد کاظمی",
    handover_notes: "شیفت صبح بدون حادثه با ۱ مورد کار گرم سپری شد.",
    safety_concerns: "محوطه کار گرم نقاله نیاز به دیده‌بانی حریق دارد.",
    equipment_status: "خط ۱ و ۲ نورد فعال است.",
    outstanding_actions_summary: "پیگیری تعویض بلبرینگ",
    unresolved_hazards_summary: "",
    active_permits: [{ id: 1, reference_code: "PTW-202610-0001", title: "جوشکاری تقویتی شاسی نقاله", status: "active" }],
    acknowledgement_notes: "",
    can_acknowledge: true,
    is_synthetic: true,
    created_at: "2026-10-19T14:45:00Z",
    updated_at: "2026-10-19T14:45:00Z",
  },
];

const mockSafetySummary: ShiftSafetySummary = {
  active_permits_count: 1,
  active_permits: [{ id: 1, code: "PTW-202610-0001", title: "جوشکاری تقویتی شاسی نقاله", type: "hot_work", status: "active" }],
  unresolved_hazards_count: 2,
  unresolved_hazards: [{ id: 1, title: "پاشش ذرات مذاب", category: "safety" }],
  open_capas_count: 1,
  open_capas: [{ id: 1, desc: "اصلاح سیم ارت", due_date: "2026-10-25", status: "open" }],
  recent_incidents_count: 1,
  recent_incidents: [{ id: 1, title: "لغزش روی روغن", severity: "minor", type: "near_miss" }],
};

describe("PermitsPage", () => {
  beforeEach(() => {
    mockApi(
      riskRoutes({
        "/permits/": () => jsonResponse(mockPermits),
        "/permits/stats/": () => jsonResponse(mockStats),
        "/permits/1/": () => jsonResponse(mockDetail),
        "/permits/handovers/": () => jsonResponse(mockHandovers),
        "/permits/handovers/safety-summary/": () => jsonResponse(mockSafetySummary),
        "/workplaces/": () => jsonResponse([{ id: 1, name: "سوله نورد", code: "fa-roll", organization: 1 }]),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders permits list and KPI stats", async () => {
    render(
      <AuthProvider>
        <PermitsPage />
      </AuthProvider>
    );

    expect(await screen.findByText("مدیریت پروانه‌های کار (PTW) و تحویل شیفت")).toBeInTheDocument();
    expect(await screen.findByText("PTW-202610-0001")).toBeInTheDocument();
    expect(screen.getByText("جوشکاری تقویتی شاسی نقاله")).toBeInTheDocument();
    expect(screen.getByText("PTW-202610-0002")).toBeInTheDocument();
    expect(screen.getByText("تعمیر ریل جرثقیل در ارتفاع ۱۵ متری")).toBeInTheDocument();

    // Check KPI counts
    expect(screen.getByText("کل مجوزها")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("opens create permit modal and submits new request", async () => {
    const user = userEvent.setup();
    let createCalled = false;

    mockApi(
      riskRoutes({
        "/permits/": (init) => {
          if (init?.method === "POST") {
            createCalled = true;
            return jsonResponse({
              ...mockPermits[0],
              id: 99,
              reference_code: "PTW-202610-0099",
              title: "برشکاری لوله گاز",
            });
          }
          return jsonResponse(mockPermits);
        },
        "/permits/stats/": () => jsonResponse(mockStats),
        "/permits/99/": () =>
          jsonResponse({
            ...mockDetail,
            id: 99,
            reference_code: "PTW-202610-0099",
            title: "برشکاری لوله گاز",
          }),
        "/workplaces/": () => jsonResponse([{ id: 1, name: "سوله نورد", code: "fa-roll", organization: 1 }]),
      })
    );

    render(
      <AuthProvider>
        <PermitsPage />
      </AuthProvider>
    );

    const newBtn = await screen.findByRole("button", { name: /\+ درخواست مجوز جدید/i });
    await user.click(newBtn);

    expect(await screen.findByText("درخواست صدور مجوز کار جدید (PTW)")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /محل کار \/ کارگاه:/i }), "1");
    await user.type(screen.getByPlaceholderText(/جوشکاری خط لوله هیدرولیک/i), "برشکاری لوله گاز");
    await user.type(screen.getByRole("textbox", { name: /شرح دقیق دامنه و عملیات کار:/i }), "برش لوله جهت جایگزینی گیج فشار");

    const submitBtn = screen.getByRole("button", { name: /ثبت و ارسال درخواست/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(createCalled).toBe(true);
    });
  });

  it("opens permit detail modal and displays control requirements", async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <PermitsPage />
      </AuthProvider>
    );

    const actionButtons = await screen.findAllByRole("button", { name: /مشاهده و اقدامات/i });
    await user.click(actionButtons[0]);

    expect(await screen.findByText(/\[PTW-202610-0001\] جوشکاری تقویتی شاسی نقاله/i)).toBeInTheDocument();
    expect(screen.getByText("اعتبارسنجی کنترل‌های میدانی (پیش از فعال‌سازی):")).toBeInTheDocument();
    expect(screen.getByText(/سوئیچ اصلی تابلوی MCC قطع و قفل شد/i)).toBeInTheDocument();
    expect(screen.getByText("تمهیدات ایمنی الزامی:")).toBeInTheDocument();
    expect(screen.getByText("عایق‌کاری با چادر نسوز")).toBeInTheDocument();
  });

  it("respects server action capabilities and exposes expired permits read-only", async () => {
    const user = userEvent.setup();

    mockApi(
      riskRoutes({
        "/permits/": () => jsonResponse(mockPermits),
        "/permits/stats/": () => jsonResponse(mockStats),
        "/permits/1/": () =>
          jsonResponse({
            ...mockDetail,
            status: "expired",
            status_display: "منقضی‌شده",
            is_expired: true,
            can_approve: false,
            can_control: false,
            can_cancel: true,
          }),
        "/workplaces/": () => jsonResponse([{ id: 1, name: "سوله نورد", code: "fa-roll", organization: 1 }]),
      })
    );

    render(
      <AuthProvider>
        <PermitsPage />
      </AuthProvider>
    );

    const actionButtons = await screen.findAllByRole("button", { name: /مشاهده و اقدامات/i });
    await user.click(actionButtons[0]);

    expect(await screen.findByText(/اعتبار زمانی این مجوز پایان یافته است/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /تأیید مجوز/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /فعال‌سازی و تأیید کنترل‌های میدانی/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /مختومه‌سازی نهایی/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^لغو مجوز$/i })).toBeInTheDocument();
  });

  it("shows acknowledgement only when the server marks the handover acknowledgeable", async () => {
    const user = userEvent.setup();

    mockApi(
      riskRoutes({
        "/permits/": () => jsonResponse(mockPermits),
        "/permits/stats/": () => jsonResponse(mockStats),
        "/permits/handovers/": () =>
          jsonResponse([
            {
              ...mockHandovers[0],
              can_acknowledge: false,
            },
          ]),
        "/permits/handovers/safety-summary/": () => jsonResponse(mockSafetySummary),
        "/workplaces/": () => jsonResponse([{ id: 1, name: "سوله نورد", code: "fa-roll", organization: 1 }]),
      })
    );

    render(
      <AuthProvider>
        <PermitsPage />
      </AuthProvider>
    );

    const handoverTabBtn = await screen.findByRole("button", { name: /تحویل و تحول شیفت/i });
    await user.click(handoverTabBtn);

    expect(await screen.findByText(/در انتظار تأیید محمد کاظمی/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /تأیید و تحویل‌گیری این شیفت/i })
    ).not.toBeInTheDocument();
  });

  it("lets the outgoing supervisor designate an incoming supervisor", async () => {
    const user = userEvent.setup();

    mockApi(
      riskRoutes({
        "/permits/": () => jsonResponse(mockPermits),
        "/permits/stats/": () => jsonResponse(mockStats),
        "/permits/handovers/": () => jsonResponse(mockHandovers),
        "/permits/handovers/safety-summary/": () => jsonResponse(mockSafetySummary),
        "/organizations/1/memberships/": () =>
          jsonResponse([
            {
              id: 1,
              user: 1,
              username: "ali",
              full_name: "علی",
              organization: 1,
              role: "workshop_supervisor",
              role_display: "سرپرست کارگاه",
              is_active: true,
            },
            {
              id: 2,
              user: 2,
              username: "mohammad",
              full_name: "محمد کاظمی",
              organization: 1,
              role: "hse_manager",
              role_display: "مدیر HSE",
              is_active: true,
            },
          ]),
        "/workplaces/": () => jsonResponse([{ id: 1, name: "سوله نورد", code: "fa-roll", organization: 1 }]),
      })
    );

    render(
      <AuthProvider>
        <PermitsPage />
      </AuthProvider>
    );

    await user.click(await screen.findByRole("button", { name: /تحویل و تحول شیفت/i }));
    await user.click(await screen.findByRole("button", { name: /ثبت تحویل شیفت جدید/i }));

    const incomingSelect = await screen.findByLabelText(/سرپرست تحویل‌گیرنده/i);
    expect(incomingSelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /محمد کاظمی/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^علی —/ })).not.toBeInTheDocument();
  });

  it("switches to shift handover tab and acknowledges a submitted shift", async () => {
    const user = userEvent.setup();
    let ackCalled = false;

    mockApi(
      riskRoutes({
        "/permits/": () => jsonResponse(mockPermits),
        "/permits/stats/": () => jsonResponse(mockStats),
        "/permits/handovers/": () => jsonResponse(mockHandovers),
        "/permits/handovers/safety-summary/": () => jsonResponse(mockSafetySummary),
        "/permits/handovers/1/acknowledge/": () => {
          ackCalled = true;
          return jsonResponse({
            ...mockHandovers[0],
            status: "acknowledged",
            acknowledged_by_name: "محمد کاظمی",
            acknowledged_at: "2026-10-19T15:00:00Z",
          });
        },
        "/workplaces/": () => jsonResponse([{ id: 1, name: "سوله نورد", code: "fa-roll", organization: 1 }]),
      })
    );

    render(
      <AuthProvider>
        <PermitsPage />
      </AuthProvider>
    );

    const handoverTabBtn = await screen.findByRole("button", { name: /تحویل و تحول شیفت/i });
    await user.click(handoverTabBtn);

    expect(await screen.findByText(/خلاصه وضعیت ایمنی شیفت در کارگاه جاری/i)).toBeInTheDocument();
    expect(screen.getByText("شیفت صبح بدون حادثه با ۱ مورد کار گرم سپری شد.")).toBeInTheDocument();

    const ackBtn = await screen.findByRole("button", { name: /تأیید و تحویل‌گیری این شیفت/i });
    await user.click(ackBtn);

    expect(await screen.findByText("تأیید و پذیرش تحویل شیفت")).toBeInTheDocument();

    const confirmAckBtn = screen.getByRole("button", { name: /تأیید قطعی تحویل شیفت/i });
    await user.click(confirmAckBtn);

    await waitFor(() => {
      expect(ackCalled).toBe(true);
    });
  });
});
