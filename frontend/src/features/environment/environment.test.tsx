import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";
import { EnvironmentPage } from "./EnvironmentPage";
import { environmentRoutes, mockApi } from "../../test/mockApi";

describe("EnvironmentPage (Phase 14)", () => {
  beforeEach(() => {
    mockApi(environmentRoutes());
  });

  it("renders page header and environmental KPI summary cards", async () => {
    render(<EnvironmentPage />);

    expect(await screen.findByText(/مدیریت محیط زیست و بهداشت حرفه‌ای/i)).toBeInTheDocument();
    expect(screen.getByText(/جنبه‌های زیست‌محیطی/i)).toBeInTheDocument();
    expect(screen.getByText(/پسماندهای ویژه و انبارش/i)).toBeInTheDocument();
    expect(screen.getByText(/تخطی از حدود پساب\/دودکش/i)).toBeInTheDocument();
    expect(screen.getByText(/مخاطرات بهداشت حرفه‌ای/i)).toBeInTheDocument();
  });

  it("renders emissions table and displays exceedance badge", async () => {
    render(<EnvironmentPage />);

    expect(await screen.findByText("حوضچه خروجی تصفیه‌خانه")).toBeInTheDocument();
    expect(screen.getByText("165.5 mg/L")).toBeInTheDocument();
    expect(screen.getByText(/🚨 تخطی از حد مجاز/i)).toBeInTheDocument();
    expect(screen.getByText(/عدم انطباق #101/i)).toBeInTheDocument();
  });

  it("switches to occupational hygiene tab and shows risk assessment results", async () => {
    const user = userEvent.setup();
    render(<EnvironmentPage />);

    const hygieneTab = await screen.findByRole("button", { name: /بهداشت حرفه‌ای و مواجهه شغلی/i });
    await user.click(hygieneTab);

    expect(await screen.findByText("ایستگاه اپراتوری نورد")).toBeInTheDocument();
    expect(screen.getByText("91.5 dBA")).toBeInTheDocument();
    expect(screen.getByText(/⚠️ غیرمجاز و بحرانی/i)).toBeInTheDocument();
    expect(screen.getByText(/استفاده اجباری از ایرماف ۳۰ دسی‌بل/i)).toBeInTheDocument();
  });

  it("switches to waste register tab and shows hazardous waste records", async () => {
    const user = userEvent.setup();
    render(<EnvironmentPage />);

    const wasteTab = await screen.findByRole("button", { name: /مدیریت و مانیفست پسماند/i });
    await user.click(wasteTab);

    expect(await screen.findByText("روغن سوخته هیدرولیک")).toBeInTheDocument();
    expect(screen.getByText("پسماند خطرناک و ویژه")).toBeInTheDocument();
    expect(screen.getByText("450 لیتر")).toBeInTheDocument();
    expect(screen.getByText("انبارش موقت در سایت")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تغییر وضعیت/i })).toBeInTheDocument();
  });

  it("switches to aspects and thresholds tab and displays ISO 14001 aspects and thresholds", async () => {
    const user = userEvent.setup();
    render(<EnvironmentPage />);

    const aspectsTab = await screen.findByRole("button", { name: /جنبه‌های بارز ISO 14001/i });
    await user.click(aspectsTab);

    expect(await screen.findByText("ذوب در کوره قوس")).toBeInTheDocument();
    expect(screen.getByText("انتشار غبار و CO")).toBeInTheDocument();
    expect(screen.getByText(/🚨 جنبه بارز/i)).toBeInTheDocument();
    expect(screen.getByText("حداکثر مجاز COD پساب")).toBeInTheDocument();
  });
});
