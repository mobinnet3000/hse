import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalculatorsPage } from "./calculators/CalculatorsPage";
import { LiftingPlansPage } from "./lifting/LiftingPlansPage";
import { PSSRPage } from "./pssr/PSSRPage";
import { SurveysPage } from "./surveys/SurveysPage";
import { ChatPage } from "./chat/ChatPage";
import { FleetEnergyPage } from "./fleet_energy/FleetEnergyPage";
import { AnomaliesPage } from "./anomalies/AnomaliesPage";
import { MyWorkspacePage } from "./workspace/MyWorkspacePage";
import { SubscriptionsPage } from "./subscriptions/SubscriptionsPage";

describe("Phase 17 Features Unit & Integration Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders CalculatorsPage with interactive tabs and unit conversion", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/calculators/history/")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<CalculatorsPage />);

    expect(screen.getByText("مرکز محاسبات مهندسی و ابزارهای سریع HSE")).toBeInTheDocument();
    expect(screen.getByText("تبدیل واحدها")).toBeInTheDocument();
    expect(screen.getByText("نرخ‌های آماری (LTIFR/TRIR)")).toBeInTheDocument();
    expect(screen.getByText("تراز و دوز صدا")).toBeInTheDocument();
    expect(screen.getByText("باربرداری و کشش اسلینگ")).toBeInTheDocument();
  });

  it("renders LiftingPlansPage with 2D simulation and summary metrics", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/lifting/plans/")) {
        return new Response(
          JSON.stringify([
            {
              id: 1,
              plan_number: "LP-2026-001",
              title: "باربرداری تاور تقطیر واحد ۲",
              load_description: "مخزن تحت فشار سنگین",
              load_weight_kg: 45000,
              total_gross_weight_kg: 50000,
              category: "critical",
              category_display: "بحرانی (Critical Lift)",
              status: "submitted",
              status_display: "ارسال‌شده جهت تایید",
              crane_utilization_pct: 78.5,
              ground_bearing_pressure_kpa: 142.0,
              allowable_ground_pressure_kpa: 200.0,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/lifting/cranes/")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/lifting/summary/")) {
        return new Response(
          JSON.stringify({
            total_plans: 12,
            approved_plans: 8,
            critical_plans: 4,
            average_utilization_pct: 68.4,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<LiftingPlansPage />);

    expect(await screen.findByText("طرح‌های باربرداری و شبیه‌سازی جرثقیل (Lifting Plans)")).toBeInTheDocument();
    expect(await screen.findByText("LP-2026-001")).toBeInTheDocument();
    expect(await screen.findByText("باربرداری تاور تقطیر واحد ۲")).toBeInTheDocument();
    expect(await screen.findByText("%78.5")).toBeInTheDocument();
  });

  it("renders PSSRPage with safety gating and pre-startup review checklist", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/pssr/summary/")) {
        return new Response(
          JSON.stringify({
            total_reviews: 6,
            approved_ready: 2,
            in_progress: 3,
            total_outstanding_items: 5,
            critical_blockers: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/pssr/reviews/")) {
        return new Response(
          JSON.stringify([
            {
              id: 10,
              pssr_number: "PSSR-SYS-04",
              project_or_system_name: "کمپرسور گازی C-201",
              facility_workplace_name: "پالایشگاه گاز عسلویه",
              status: "in_progress",
              status_display: "در حال ممیزی میدانی",
              target_startup_date: "2026-11-15",
              items_count: 36,
              completed_items_count: 32,
              has_critical_blockers: true,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<PSSRPage />);

    expect(await screen.findByText("بررسی ایمنی قبل از راه‌اندازی (PSSR)")).toBeInTheDocument();
    expect(await screen.findByText("PSSR-SYS-04")).toBeInTheDocument();
    expect(await screen.findByText("کمپرسور گازی C-201")).toBeInTheDocument();
  });

  it("renders SurveysPage with safety climate assessments and exams", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/surveys/summary/")) {
        return new Response(
          JSON.stringify({
            total_surveys: 5,
            active_surveys: 2,
            total_responses_collected: 87,
            average_exam_score: 84.5,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/surveys/surveys/")) {
        return new Response(
          JSON.stringify([
            {
              id: 20,
              title: "سنجش سالانه جو ایمنی سازمان (Safety Climate)",
              survey_type: "climate_survey",
              survey_type_display: "سنجش جو ایمنی (Safety Climate)",
              is_anonymous: true,
              total_questions: 15,
              total_responses: 42,
              is_published: true,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<SurveysPage />);

    expect(await screen.findByText("پرسشنامه‌ها و آزمون‌های ارزیابی HSE")).toBeInTheDocument();
    expect(await screen.findByText("سنجش سالانه جو ایمنی سازمان (Safety Climate)")).toBeInTheDocument();
    expect(await screen.findByText("ناشناس (حفظ هویت)")).toBeInTheDocument();
  });

  it("renders ChatPage with internal communication channels and messaging", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/messages/")) {
        return new Response(
          JSON.stringify([
            {
              id: 10,
              conversation: 1,
              content: "مانور سناریوی نشت آمونیاک ساعت ۱۴ آغاز می‌شود.",
              sender_name: "مدیر HSE",
              created_at: "2026-10-29T10:15:00Z",
              is_system_message: false,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/chat/conversations/")) {
        return new Response(
          JSON.stringify([
            {
              id: 1,
              title: "کمیته واکنش در شرایط اضطراری",
              conversation_type: "channel",
              is_incident_channel: true,
              unread_count: 2,
              last_message: {
                content: "مانور سناریوی نشت آمونیاک ساعت ۱۴ آغاز می‌شود.",
                sender_name: "مدیر HSE",
                sent_at: "2026-10-29T10:15:00Z",
              },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<ChatPage />);

    expect(await screen.findByText("پیام‌رسان و ارتباطات داخلی HSE")).toBeInTheDocument();
    expect((await screen.findAllByText("کمیته واکنش در شرایط اضطراری")).length).toBeGreaterThan(0);
    expect(await screen.findByText("مانور سناریوی نشت آمونیاک ساعت ۱۴ آغاز می‌شود.")).toBeInTheDocument();
  });

  it("renders FleetEnergyPage with fleet, energy and excavation tabs", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/fleet-energy/vehicles/")) {
        return new Response(
          JSON.stringify([
            {
              id: 1,
              vehicle_code: "VH-401",
              plate_number: "۱۲ الف ۳۴۵ ایران ۶۸",
              model_name: "تویوتا هایلوکس دوکابین",
              vehicle_type_display: "وانت دوکابین / سواری",
              fuel_type_display: "بنزین",
              current_odometer_km: 84500,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/fleet-energy/fuel-logs/")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fleet-energy/energy-logs/")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fleet-energy/excavations/")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fleet-energy/summary/")) {
        return new Response(
          JSON.stringify({
            total_kwh: 1250000,
            total_fuel_liters: 14800,
            active_vehicles: 18,
            active_excavations: 3,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<FleetEnergyPage />);

    expect(await screen.findByText("ناوگان ترابری، مدیریت انرژی و عملیات گودبرداری")).toBeInTheDocument();
    expect(await screen.findByText("VH-401")).toBeInTheDocument();
    expect(await screen.findByText("تویوتا هایلوکس دوکابین")).toBeInTheDocument();
  });

  it("renders AnomaliesPage with unsafe acts and nonconformities", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/non-conformities/")) {
        return new Response(
          JSON.stringify([
            {
              id: 5,
              reference_number: "ANOM-2026-0042",
              anomaly_type: "unsafe_act",
              anomaly_type_display: "عمل ناایمن (Unsafe Act)",
              description: "عدم استفاده از کمربند ایمنی هارنس در ارتفاع ۴ متری داربست",
              severity: "critical",
              priority: "urgent",
              reporter_name: "بازرس ناظر کارگاه",
              status: "open",
              status_display: "باز",
              immediate_containment: "توقف فوری کار و صدور تذکر ایمنی",
              corrective_action_count: 1,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<AnomaliesPage />);

    expect(await screen.findByText("مدیریت یکپارچه ناهنجاری‌ها و مشاهدات ناایمن")).toBeInTheDocument();
    expect(await screen.findByText("ANOM-2026-0042")).toBeInTheDocument();
    expect(await screen.findByText("عدم استفاده از کمربند ایمنی هارنس در ارتفاع ۴ متری داربست")).toBeInTheDocument();
    expect(await screen.findByText("توقف فوری کار و صدور تذکر ایمنی")).toBeInTheDocument();
  });

  it("renders MyWorkspacePage with pending tasks, approvals and overdue CAPA", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/dashboard/workspace/")) {
        return new Response(
          JSON.stringify({
            user: { id: 1, full_name: "مهندس ایمنی ارشد", username: "safety_lead" },
            unread_counts: { notifications: 2, messages: 1 },
            pending_approvals: {
              permits: [{ id: 10, reference_code: "PTW-CW-019", title: "مجوز جوشکاری خط لوله", permit_type: "گرم", status_display: "در انتظار تایید ناظر" }],
              lifting_plans: [{ id: 2, plan_number: "LP-2026-008", title: "جابجایی کمپرسور", category: "سنگین", status_display: "نیازمند امضای فنی" }],
              pssr_reviews: [],
              total: 2,
            },
            my_tasks: {
              actions: [
                { id: 44, description: "نصب گارد محافظ پمپ سانتریفیوژ", due_date: "2026-10-18", status: "open", is_overdue: true },
              ],
              inspections: [],
              total: 1,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<MyWorkspacePage />);

    expect(await screen.findByText("کارتابل شخصی و وظایف من (My Workspace)")).toBeInTheDocument();
    expect(await screen.findByText(/PTW-CW-019/)).toBeInTheDocument();
    expect(await screen.findByText("نصب گارد محافظ پمپ سانتریفیوژ")).toBeInTheDocument();
    expect(await screen.findByText("مهلت منقضی شده!")).toBeInTheDocument();
  });

  it("renders SubscriptionsPage with plans, active subscription and adapters", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/organizations/plans/")) {
        return new Response(
          JSON.stringify([
            {
              id: 1,
              code: "enterprise_full",
              name: "پلن جامع سازمانی (Enterprise)",
              description: "دسترسی نامحدود به تمامی ماژول‌های سامانه IHMS",
              price_monthly_irr: 450000000,
              max_users: 1000,
              max_workplaces: 50,
              included_modules: ["all"],
              is_active: true,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/subscription/")) {
        return new Response(
          JSON.stringify({
            id: 1,
            organization: 1,
            plan_code: "enterprise_full",
            plan_name: "پلن جامع سازمانی (Enterprise)",
            status: "active",
            valid_until: "2027-10-29",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/entitlements/")) {
        return new Response(
          JSON.stringify([
            { id: 1, organization: 1, module_code: "lifting", module_title: "ماژول باربرداری تخصصی", is_enabled: true },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/integrations/status/")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                slug: "sms_kavenegar",
                name: "سامانه پیامک کاوه‌نگار",
                description: "ارسال پیامک‌های اضطراری به سرپرستان کارگاه",
                icon: "message-square",
                status: "healthy",
                is_configured: true,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<SubscriptionsPage />);

    expect(await screen.findByText("مدیریت پلن‌ها، اشتراک و درگاه‌های یکپارچه‌سازی")).toBeInTheDocument();
    expect((await screen.findAllByText(/پلن جامع سازمانی \(Enterprise\)/)).length).toBeGreaterThan(0);
    expect(await screen.findByText("ماژول باربرداری تخصصی")).toBeInTheDocument();
    expect(await screen.findByText("سامانه پیامک کاوه‌نگار")).toBeInTheDocument();
  });
});
