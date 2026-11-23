import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExecutiveEcosystemSection } from "./ExecutiveEcosystemSection";
import * as api from "../../services/api";

describe("ExecutiveEcosystemSection (Phase 6 Ecosystem & KPI Engine)", () => {
  const onNavigateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(api, "fetchExecutiveDashboard").mockResolvedValue({
      modules_total: 20,
      modules_healthy: 18,
      modules_action_required: 2,
      modules: [
        { code: "risk_management", name: "مدیریت ریسک‌های HSE", count: 12, status: "normal", path: "/risks" },
        { code: "anomaly_reports", name: "گزارش ناهنجاری‌ها و موارد ناایمن", count: 5, status: "warning", path: "/anomalies" },
        { code: "incidents", name: "مدیریت حوادث و شبه‌حوادث", count: 2, status: "normal", path: "/incidents" },
        { code: "permits", name: "مجوزهای کار (PTW)", count: 8, status: "normal", path: "/permits" },
        { code: "chemicals", name: "مدیریت مواد شیمیایی (Chemicals)", count: 24, status: "normal", path: "/chemicals" },
        { code: "emergency", name: "مدیریت واکنش در شرایط اضطراری", count: 4, status: "normal", path: "/emergency" },
        { code: "health", name: "بهداشت حرفه‌ای و طب کار", count: 45, status: "normal", path: "/health" },
        { code: "audit", name: "ممیزی، بازرسی و انطباق استاندارد", count: 3, status: "normal", path: "/audit" },
        { code: "safety_culture", name: "فرهنگ ایمنی و مشاهدات رفتاری (BBS)", count: 68, status: "normal", path: "/safety-culture" },
        { code: "strategic_hse", name: "مدیریت راهبردی و بودجه HSE", count: 4, status: "normal", path: "/strategic-hse" },
      ],
    });

    vi.spyOn(api, "fetchKPIEngine").mockResolvedValue({
      man_hours_worked: 250000,
      ltifr: 0.0,
      trir: 0.8,
      severity_rate: 1.5,
      lti_count: 0,
      total_incidents: 2,
      inspection_compliance_rate: 96.5,
      capa_closure_rate: 92.0,
      safe_behavior_rate: 88.5,
      proactive_ratio: 8.9,
      status: "normal",
    });

    vi.spyOn(api, "fetchStrategicGoals").mockResolvedValue([
      {
        id: 1,
        organization: 1,
        fiscal_year: "1403-1404",
        title: "کاهش حوادث فرآیندی به صفر",
        pillar: "zero_harm",
        pillar_display: "صفر حوادث انسانی",
        target_metric: "LTIFR",
        baseline_value: 1.0,
        target_value: 0.0,
        current_value: 0.0,
        unit: "ضریب",
        deadline: "1404-12-29",
        priority: "critical",
        priority_display: "بحرانی",
        status: "on_track",
        status_display: "طبق برنامه",
      },
    ]);

    vi.spyOn(api, "fetchHSEBudget").mockResolvedValue([
      {
        id: 1,
        organization: 1,
        fiscal_year: "1403-1404",
        program_name: "تجهیزات حفاظت فردی PPE",
        category: "ppe_equipment",
        allocated_amount: 5000,
        spent_amount: 3200,
        utilization_percentage: 64.0,
      },
    ]);
  });

  it("renders the 20-module executive monitor and live KPI metrics", async () => {
    render(<ExecutiveEcosystemSection organizationId={1} onNavigate={onNavigateMock} />);

    await waitFor(() => {
      expect(screen.getByText(/رصدخانه یکپارچه اکوسیستم ۲۰ ماژول/)).toBeInTheDocument();
    });

    // Check KPI metrics rendered
    expect(screen.getByText(/ضریب تکرار حوادث ناتوان‌کننده \(LTIFR\)/)).toBeInTheDocument();
    expect(screen.getByText(/نرخ کل حوادث قابل ثبت \(TRIR\)/)).toBeInTheDocument();
    expect(screen.getByText("%88.5")).toBeInTheDocument(); // BBS index

    // Check modules rendered
    expect(screen.getByText("مدیریت ریسک‌های HSE")).toBeInTheDocument();
    expect(screen.getByText("مدیریت مواد شیمیایی (Chemicals)")).toBeInTheDocument();
    expect(screen.getByText("فرهنگ ایمنی و مشاهدات رفتاری (BBS)")).toBeInTheDocument();
  });

  it("filters modules by status and jumps to module tab on button click", async () => {
    render(<ExecutiveEcosystemSection organizationId={1} onNavigate={onNavigateMock} />);

    await waitFor(() => {
      expect(screen.getByText("مدیریت ریسک‌های HSE")).toBeInTheDocument();
    });

    // Click jump button for risk management
    const jumpButtons = screen.getAllByText(/ورود به ماژول/);
    expect(jumpButtons.length).toBeGreaterThan(0);
    fireEvent.click(jumpButtons[0]);

    expect(onNavigateMock).toHaveBeenCalledWith("risks");

    // Click filter button for action required
    const actionFilterBtn = screen.getByRole("button", { name: /نیازمند اقدام/ });
    fireEvent.click(actionFilterBtn);

    expect(screen.getByText("گزارش ناهنجاری‌ها و موارد ناایمن")).toBeInTheDocument();
  });
});
