import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiAssistantPage } from "./AiAssistantPage";
import { AuthProvider } from "../auth/AuthContext";
import { jsonResponse, mockApi, riskRoutes } from "../../test/mockApi";

describe("AiAssistantPage", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders AI engine status and runs workplace hazard analysis", async () => {
    mockApi(
      riskRoutes({
        "/ai/status/": () =>
          jsonResponse({
            provider: "grounded_rule_engine",
            is_live_configured: false,
            active_engine: "grounded_rule_engine",
            engine_label: "موتور تحلیلی پایگاه دانش مقررات و استانداردها",
            verified_regulations_count: 8,
            supported_features: ["تحلیل مخاطرات"],
            disclaimer: "مشورتی است.",
          }),
        "/ai/analyze-workplace/": () =>
          jsonResponse({
            is_ai_generated: true,
            engine: "grounded_rule_engine",
            grounded_sources: [
              {
                id: 1,
                code: "IR-OHS-HEIGHT-89",
                title: "آیین‌نامه ایمنی کار در ارتفاع",
                category: "regulation",
              },
            ],
            disclaimer: "مشورتی است.",
            hazards: [
              {
                title: "سقوط از ارتفاع روی داربست",
                category: "safety",
                suggested_likelihood: 3,
                suggested_severity: 4,
                causes: "عدم استفاده از هارنس ایمنی",
                consequences: "شکستگی شدید اندام",
                existing_controls_hint: "حفاظ جانبی ۹۰ سانتی‌متر",
                regulation_reference: "IR-OHS-HEIGHT-89 ماده ۲",
              },
            ],
          }),
        "/ai/apply-hazard/": () =>
          jsonResponse({
            id: 99,
            title: "سقوط از ارتفاع روی داربست",
            status: "draft",
          }),
      })
    );

    render(
      <AuthProvider>
        <AiAssistantPage />
      </AuthProvider>
    );

    expect(await screen.findByText("دستیار هوشمند و تحلیلی HSE Guard")).toBeInTheDocument();
    expect(await screen.findByText("موتور تحلیلی پایگاه دانش مقررات و استانداردها")).toBeInTheDocument();
    expect(screen.getByText(/الزام نظارت و اعتبارسنجی انسانی/)).toBeInTheDocument();

    const descInput = screen.getByLabelText("شرح فرآیند و شرایط محیطی *");
    await userEvent.type(descInput, "کار روی داربست و سیم‌کشی برق");

    const analyzeBtn = screen.getByRole("button", { name: "⚡ تحلیل و استخراج مخاطرات" });
    await userEvent.click(analyzeBtn);

    expect(await screen.findByText("سقوط از ارتفاع روی داربست")).toBeInTheDocument();
    expect(screen.getByText("IR-OHS-HEIGHT-89 ماده ۲")).toBeInTheDocument();

    // Apply hazard
    const applyBtn = screen.getByRole("button", { name: "+ تأیید و ثبت در بانک مخاطرات" });
    await userEvent.click(applyBtn);

    expect(await screen.findByText("✓ در بانک مخاطرات ذخیره شد")).toBeInTheDocument();
  });

  it("generates inspection checklist and hierarchy of controls", async () => {
    mockApi(
      riskRoutes({
        "/ai/suggest-checklist/": () =>
          jsonResponse({
            is_ai_generated: true,
            engine: "grounded_rule_engine",
            suggested_title: "چک‌لیست داربست‌بندی ایمن",
            suggested_description: "تولیدشده بر پایه آیین‌نامه ارتفاع",
            items: [
              {
                order: 1,
                text: "بررسی تگ سبز داربست",
                is_required: true,
                citation: "IR-OHS-HEIGHT-89 ماده ۳",
              },
            ],
            grounded_sources: [],
            disclaimer: "مشورتی است.",
          }),
        "/ai/suggest-controls/": () =>
          jsonResponse({
            is_ai_generated: true,
            hazard_title: "برق‌گرفتگی در تابلوی توزیع",
            hierarchy: [
              {
                tier: 1,
                level: "elimination",
                label: "۱. حذف خطر (Elimination)",
                priority: "بالاترین اثربخشی",
                recommendation: "قطع کامل جریان برق و دشارژ خازن‌ها",
              },
              {
                tier: 2,
                level: "substitution",
                label: "۲. جایگزینی (Substitution)",
                priority: "اثربخشی بسیار بالا",
                recommendation: "استفاده از ابزارهای پنوماتیک ۲۴ ولت",
              },
              {
                tier: 3,
                level: "engineering_controls",
                label: "۳. کنترل‌های مهندسی (Engineering Controls)",
                priority: "اثربخشی متوسط رو به بالا",
                recommendation: "نصب کلید RCD و اتصال زمین ۲ اهم",
              },
              {
                tier: 4,
                level: "administrative_controls",
                label: "۴. کنترل‌های مدیریتی (Administrative Controls)",
                priority: "اثربخشی متوسط",
                recommendation: "استقرار رویه LOTO",
              },
              {
                tier: 5,
                level: "ppe",
                label: "۵. تجهیزات حفاظت فردی (PPE)",
                priority: "آخرین خط دفاعی",
                recommendation: "دستکش عایق ولتاژ بالا و کفش ضدبرق",
              },
            ],
            grounded_sources: [],
            standard_reference: "ISO 45001:2018 بند ۸.۱.۲",
            disclaimer: "مشورتی است.",
          }),
      })
    );

    render(
      <AuthProvider>
        <AiAssistantPage />
      </AuthProvider>
    );

    // 1. Checklist Tab
    const checklistTabBtn = await screen.findByRole("button", { name: /پیشنهاد چک‌لیست بازرسی/ });
    await userEvent.click(checklistTabBtn);

    const focusInput = screen.getByLabelText("حوزه یا عملیات بازرسی *");
    await userEvent.type(focusInput, "کار در ارتفاع");

    const genChecklistBtn = screen.getByRole("button", { name: "📋 تولید پیش‌نویس چک‌لیست" });
    await userEvent.click(genChecklistBtn);

    expect(await screen.findByText("چک‌لیست داربست‌بندی ایمن")).toBeInTheDocument();
    expect(screen.getByText("بررسی تگ سبز داربست")).toBeInTheDocument();

    // 2. Hierarchy Tab
    const hierarchyTabBtn = screen.getByRole("button", { name: /سلسله‌مراتب کنترل خطر/ });
    await userEvent.click(hierarchyTabBtn);

    const hazardInput = screen.getByLabelText("عنوان مخاطره *");
    await userEvent.type(hazardInput, "برق‌گرفتگی در تابلوی توزیع");

    const genControlsBtn = screen.getByRole("button", { name: "🛡️ استخراج سلسله‌مراتب کنترلی" });
    await userEvent.click(genControlsBtn);

    expect(await screen.findByText("سلسله‌مراتب کنترلی: برق‌گرفتگی در تابلوی توزیع")).toBeInTheDocument();
    expect(screen.getByText("۱. حذف خطر (Elimination)")).toBeInTheDocument();
    expect(screen.getByText("۵. تجهیزات حفاظت فردی (PPE)")).toBeInTheDocument();
  });
});
