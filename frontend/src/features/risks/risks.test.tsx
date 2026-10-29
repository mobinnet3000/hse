import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RisksPage } from "./RisksPage";
import { jsonResponse, mockApi } from "../../test/mockApi";

const hazard = {
  id: 1,
  organization: 1,
  workplace: 1,
  title: "سقوط از ارتفاع",
  description: "کار روی داربست",
  category: "safety",
  category_display: "ایمنی",
  source: "داربست",
  causes: "نبود مهاربند",
  consequences: "صدمه جانی",
  exposed_persons: "کارگران",
  existing_controls: "کمربند",
  status: "active",
  status_display: "فعال",
  reassessment_needed: false,
};

const bowtieDiagram = {
  id: 1,
  organization: 1,
  hazard: 1,
  hazard_title: "سقوط از ارتفاع",
  top_event: "سقوط کارگر از ارتفاع بالای ۳ متر",
  description: "تحلیل موانع پیشگیرانه و تخفیفی",
  status: "active",
  status_display: "فعال",
  owner: 1,
  owner_name: "مدیر HSE",
  target_review_date: "2027-01-01",
  threats: [
    { id: 1, diagram: 1, title: "لغزش تخته داربست", category: "mechanical", order: 1 },
  ],
  consequences: [
    { id: 1, diagram: 1, title: "شکستگی و ضربه به سر", severity_level: "high", severity_level_display: "زیاد", order: 1 },
  ],
  barriers: [
    {
      id: 1,
      diagram: 1,
      threat: 1,
      consequence: null,
      barrier_type: "preventive",
      barrier_type_display: "پیشگیرانه",
      nature: "engineering",
      nature_display: "مهندسی",
      name: "نرده و حفاظ استاندارد ۱۱۰ سانتیمتری",
      description: "حفاظت پیرامونی کامل",
      is_critical: true,
      owner: 1,
      owner_name: "مدیر HSE",
      current_effectiveness: "effective",
      current_effectiveness_display: "مؤثر",
      status: "operational",
      status_display: "عملیاتی",
      assessments: [],
      created_at: "2026-10-26T00:00:00Z",
      updated_at: "2026-10-26T00:00:00Z",
    },
  ],
  created_at: "2026-10-26T00:00:00Z",
  updated_at: "2026-10-26T00:00:00Z",
};

const hcmsControl = {
  id: 1,
  organization: 1,
  hazard: 1,
  hazard_title: "سقوط از ارتفاع",
  barrier: 1,
  control_title: "سامانه لایف‌لاین خودکار و متوقف‌کننده سقوط",
  hierarchy_of_control: "engineering",
  hierarchy_display: "کنترل مهندسی",
  implementation_status: "implemented",
  status_display: "پیاده‌سازی‌شده",
  review_frequency_days: 90,
  last_reviewed_at: "2026-10-01",
  next_review_due: "2026-12-30",
  responsible_owner: 1,
  owner_name: "مدیر HSE",
  initial_risk_score: 20,
  residual_likelihood: 2,
  residual_severity: 2,
  residual_score: 4,
  residual_level: "low",
  residual_level_display: "کم",
  reassessment_trigger: "",
  created_at: "2026-10-26T00:00:00Z",
  updated_at: "2026-10-26T00:00:00Z",
};

const riskSummary = {
  total_hazards: 1,
  reassessment_needed_count: 0,
  total_bowties: 1,
  total_barriers: 1,
  critical_barriers: 1,
  failed_critical_barriers: 0,
  total_controls: 1,
  pending_review_controls: 0,
};

describe("RisksPage — Phase 11 BowTie & HCMS", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      mockApi({
        "/organizations/": () => jsonResponse([{ id: 1, name: "فولاد البرز", code: "fa" }]),
        "/workplaces/": () => jsonResponse([{ id: 1, name: "کارگاه نورد", code: "w1" }]),
        "/risks/": () => jsonResponse([hazard]),
        "/risks/assessments/": () => jsonResponse([]),
        "/risks/bowtie/": () => jsonResponse([bowtieDiagram]),
        "/risks/hcms/": () => jsonResponse([hcmsControl]),
        "/risks/dashboard/summary/": () => jsonResponse(riskSummary),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders traditional risk matrix tab and switches to BowTie visualizer", async () => {
    const user = userEvent.setup();
    render(<RisksPage />);

    expect((await screen.findAllByText("سقوط از ارتفاع")).length).toBeGreaterThan(0);

    // Click BowTie tab
    const bowtieTab = screen.getByRole("button", { name: /نمودارهای پاپیونی/i });
    await user.click(bowtieTab);

    // Verify BowTie Top Event rendered
    expect((await screen.findAllByText("سقوط کارگر از ارتفاع بالای ۳ متر")).length).toBeGreaterThan(0);
    expect(screen.getByText(/لغزش تخته داربست/)).toBeInTheDocument();
    expect(screen.getByText(/نرده و حفاظ استاندارد/)).toBeInTheDocument();
    expect(screen.getByText("SCE حیاتی")).toBeInTheDocument();
  });

  it("switches to HCMS Control Matrix and renders hierarchy", async () => {
    const user = userEvent.setup();
    render(<RisksPage />);

    const hcmsTab = await screen.findByRole("button", { name: /ماتریس کنترل خطر/i });
    await user.click(hcmsTab);

    expect(await screen.findByText("سامانه لایف‌لاین خودکار و متوقف‌کننده سقوط")).toBeInTheDocument();
    expect(screen.getByText("کنترل مهندسی")).toBeInTheDocument();
    expect(screen.getByText("پیاده‌سازی‌شده")).toBeInTheDocument();
  });

  it("switches to Process Safety & Barrier Health summary tab", async () => {
    const user = userEvent.setup();
    render(<RisksPage />);

    const summaryTab = await screen.findByRole("button", { name: /داشبورد پایش سلامت موانع/i });
    await user.click(summaryTab);

    expect(await screen.findByText("تعداد نمودارهای پاپیونی")).toBeInTheDocument();
    expect(screen.getByText("موانع ایمنی بحرانی (SCE)")).toBeInTheDocument();
    expect(screen.getByText("توصیه‌های ایمنی فرآیند و تحلیل یکپارچگی موانع")).toBeInTheDocument();
  });
});
