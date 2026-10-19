import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentsPage } from "./IncidentsPage";
import { AuthProvider } from "../auth/AuthContext";
import { jsonResponse, mockApi, riskRoutes } from "../../test/mockApi";
import type { IncidentDetail, IncidentListItem, IncidentSummaryStats } from "../../services/api";

const mockStats: IncidentSummaryStats = {
  total_incidents: 4,
  near_miss_count: 1,
  under_investigation_count: 2,
  closed_count: 1,
  total_lost_time_days: 4,
  by_type: { incident: 2, near_miss: 1, unsafe_act: 1 },
  by_severity: { minor: 2, moderate: 1, major: 1 },
  by_status: { reported: 1, under_investigation: 1, action_required: 1, closed: 1 },
};

const mockIncidents: IncidentListItem[] = [
  {
    id: 101,
    organization: 1,
    organization_name: "سازمان الف",
    workplace: 1,
    workplace_name: "کارگاه ریخته‌گری",
    title: "پاشش سرباره مذاب در مجاورت پاتیل شماره ۲",
    incident_type: "incident",
    incident_type_display: "حادثه",
    severity: "major",
    severity_display: "عمده",
    status: "action_required",
    status_display: "نیازمند اقدام اصلاحی",
    occurred_at: "2026-10-18T14:30:00Z",
    reported_by: 2,
    reported_by_name: "علی محمدی",
    assigned_investigator: 3,
    assigned_investigator_name: "رضا حسینی",
    injury_count: 1,
    lost_time_days: 4,
    capa_count: 1,
    is_synthetic: true,
    created_at: "2026-10-18T15:00:00Z",
  },
  {
    id: 102,
    organization: 1,
    organization_name: "سازمان الف",
    workplace: 1,
    workplace_name: "واحد الفین",
    title: "سقوط آچار سنگین از داربست واحد مخازن کروی",
    incident_type: "near_miss",
    incident_type_display: "شبه‌حادثه (Near-Miss)",
    severity: "moderate",
    severity_display: "متوسط",
    status: "under_investigation",
    status_display: "در حال ریشه‌یابی",
    occurred_at: "2026-10-19T09:15:00Z",
    reported_by: 2,
    reported_by_name: "علی محمدی",
    assigned_investigator: null,
    assigned_investigator_name: null,
    injury_count: 0,
    lost_time_days: 0,
    capa_count: 0,
    is_synthetic: false,
    created_at: "2026-10-19T09:30:00Z",
  },
];

const mockIncidentDetail: IncidentDetail = {
  ...mockIncidents[0],
  location_details: "ایستگاه شماره ۲ کوره قوس الکتریکی",
  description: "حین تخلیه پاتیل به دلیل رطوبت نامتعارف سرباره، پاشش شدید رخ داد.",
  immediate_actions_taken: "قطع عملیات و اطفای شعله کابل‌های مجاور.",
  environmental_impact: "",
  property_damage_cost: 25000000,
  root_cause: "ورود بار خیس و رطوبت‌دار به درون کوره به دلیل عدم پوشش بارانداز آهن‌قراضه.",
  contributing_factors: "نبود رطوبت‌سنج در خط شارژ مواد اولیه.",
  investigation_completed_at: "2026-10-19T10:00:00Z",
  review_notes: "تأیید بررسی اولیه",
  closure_notes: "",
  reopen_reason: "",
  related_hazard: 1,
  related_hazard_title: "پاشش ذرات و سرباره مذاب فولاد",
  related_corrective_actions: [
    {
      id: 501,
      organization: 1,
      non_conformity: 1,
      description: "نصب سقف پوششی بارانداز آهن‌قراضه",
      responsible: 2,
      due_date: "2026-11-01",
      status: "in_progress",
      status_display: "در حال انجام",
      result_text: "",
      effectiveness_verified: false,
    },
  ],
  attachments: [
    {
      id: 1,
      incident: 101,
      title: "تصویر کابل‌های آسیب‌دیده",
      attachment_type: "photo",
      file_url: "https://example.com/photo.jpg",
      description: "خسارت پاشش مذاب",
      uploaded_by: 2,
      uploaded_by_name: "علی محمدی",
      uploaded_at: "2026-10-18T16:00:00Z",
    },
  ],
  can_review: true,
  can_investigate: true,
  can_close: true,
  updated_at: "2026-10-19T10:00:00Z",
  closed_at: null,
};

describe("IncidentsPage", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders incident dashboard KPIs and incident list cards", async () => {
    mockApi(
      riskRoutes({
        "/incidents/summary-stats/": () => jsonResponse(mockStats),
        "/incidents/": () => jsonResponse(mockIncidents),
      })
    );

    render(
      <AuthProvider>
        <IncidentsPage />
      </AuthProvider>
    );

    // Title & KPI Cards
    expect(await screen.findByRole("heading", { name: "مدیریت حوادث، شبه‌حوادث و شرایط ناایمن" })).toBeInTheDocument();
    expect(await screen.findByText("کل حوادث و رویدادها")).toBeInTheDocument();
    expect(await screen.findByText("شبه‌حوادث (Near-Miss)")).toBeInTheDocument();
    expect(await screen.findByText("روزهای کاری از دست رفته (LTI)")).toBeInTheDocument();

    // Incident list items
    expect(await screen.findByText("پاشش سرباره مذاب در مجاورت پاتیل شماره ۲")).toBeInTheDocument();
    expect(await screen.findByText("سقوط آچار سنگین از داربست واحد مخازن کروی")).toBeInTheDocument();
    expect(await screen.findByText("داده آزمایشی")).toBeInTheDocument();
  });

  it("opens reporting modal and successfully reports a new incident", async () => {
    let postBody: any = null;
    mockApi(
      riskRoutes({
        "/incidents/summary-stats/": () => jsonResponse(mockStats),
        "/incidents/": (init) => {
          if (init?.method === "POST") {
            postBody = JSON.parse(String(init.body));
            return jsonResponse({ id: 103, ...postBody, status: "reported", is_synthetic: false }, 201);
          }
          return jsonResponse(mockIncidents);
        },
      })
    );

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <IncidentsPage />
      </AuthProvider>
    );

    const reportButton = await screen.findByRole("button", { name: "+ ثبت حادثه یا شبه‌حادثه جدید" });
    await user.click(reportButton);

    expect(await screen.findByRole("heading", { name: "ثبت رویداد، حادثه یا شبه‌حادثه جدید" })).toBeInTheDocument();

    const titleInput = screen.getByLabelText("عنوان رویداد *");
    const descInput = screen.getByLabelText("شرح حادثه / رویداد *");

    await user.type(titleInput, "برخورد لیفتراک با حفاظ انبار");
    await user.type(descInput, "حین جابجایی بار پالت به دلیل دید ناکافی راننده برخورد رخ داد.");

    const submitBtn = screen.getByRole("button", { name: "ثبت گزارش رویداد" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(postBody).not.toBeNull();
      expect(postBody.title).toBe("برخورد لیفتراک با حفاظ انبار");
      expect(postBody.incident_type).toBe("incident");
    });
  });

  it("opens incident details and renders 5-Why root cause and linked CAPA", async () => {
    mockApi(
      riskRoutes({
        "/incidents/summary-stats/": () => jsonResponse(mockStats),
        "/incidents/": () => jsonResponse(mockIncidents),
        "/incidents/101/": () => jsonResponse(mockIncidentDetail),
      })
    );

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <IncidentsPage />
      </AuthProvider>
    );

    const detailButtons = await screen.findAllByRole("button", { name: "مشاهده و مدیریت پرونده" });
    await user.click(detailButtons[0]);

    // Detail modal content
    expect(await screen.findByRole("heading", { name: /پرونده حادثه #101/ })).toBeInTheDocument();
    expect(await screen.findByText("نتایج ریشه‌یابی و تحلیل علل وقوع (RCA)")).toBeInTheDocument();
    expect(await screen.findByText(/ورود بار خیس و رطوبت‌دار به درون کوره/)).toBeInTheDocument();
    expect(await screen.findByText(/نصب سقف پوششی بارانداز آهن‌قراضه/)).toBeInTheDocument();
    expect(await screen.findByText(/تصویر کابل‌های آسیب‌دیده/)).toBeInTheDocument();

    // Close button in modal
    expect(screen.getByRole("button", { name: "مختومه‌سازی پرونده" })).toBeInTheDocument();
  });
});
