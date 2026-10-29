import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScaffoldsPage } from "./ScaffoldsPage";
import { mockApi, scaffoldRoutes } from "../../test/mockApi";

describe("ScaffoldsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders scaffold KPI cards and tag summary counts", async () => {
    mockApi(scaffoldRoutes());

    render(<ScaffoldsPage />);

    expect(screen.getByText("🏗️ مدیریت برچسب و بازرسی تخصصی داربست‌ها (Scaffold Tag Register)")).toBeDefined();

    await waitFor(() => {
      // Check KPI values from summary
      expect(screen.getByText("تگ سبز (ایمن و فعال)")).toBeDefined();
      expect(screen.getByText("تگ زرد (مشروط و محدود)")).toBeDefined();
      expect(screen.getByText("تگ قرمز (مسدود و خطرناک)")).toBeDefined();
      expect(screen.getByText("بازرسی‌های معوقه ادواری")).toBeDefined();
    });

    // Check list items
    await waitFor(() => {
      expect(screen.getByText("SCF-ROLL-001")).toBeDefined();
      expect(screen.getByText("SCF-CAST-002")).toBeDefined();
      expect(screen.getByText("SCF-TWR-003")).toBeDefined();
    });
  });

  it("filters scaffolds by tag color", async () => {
    mockApi(scaffoldRoutes());

    render(<ScaffoldsPage />);

    await waitFor(() => {
      expect(screen.getByText("SCF-ROLL-001")).toBeDefined();
    });

    // Click on Green tag filter tab: "تگ سبز ایمن (1)"
    const greenFilterTab = screen.getByRole("button", { name: /تگ سبز ایمن/i });
    fireEvent.click(greenFilterTab);

    // Green scaffold should be visible, others filtered out
    expect(screen.getByText("SCF-ROLL-001")).toBeDefined();
    expect(screen.queryByText("SCF-CAST-002")).toBeNull();
    expect(screen.queryByText("SCF-TWR-003")).toBeNull();
  });

  it("opens printable tag card modal", async () => {
    mockApi(scaffoldRoutes());

    render(<ScaffoldsPage />);

    await waitFor(() => {
      expect(screen.getByText("SCF-ROLL-001")).toBeDefined();
    });

    // Click '🖨️ شناسنامه' button
    const tagCardButtons = screen.getAllByRole("button", { name: /شناسنامه/i });
    fireEvent.click(tagCardButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("شناسنامه فیزیکی برچسب داربست")).toBeDefined();
      expect(screen.getByText(/HSE-GUARD:SCAFFOLD:1:SCF-ROLL-001/i)).toBeDefined();
    });
  });

  it("opens 7-point structural inspection modal", async () => {
    mockApi(scaffoldRoutes());

    render(<ScaffoldsPage />);

    await waitFor(() => {
      expect(screen.getByText("SCF-ROLL-001")).toBeDefined();
    });

    // Click '🔍 بازرسی فنی' button
    const inspectButtons = screen.getAllByRole("button", { name: /بازرسی فنی/i });
    fireEvent.click(inspectButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/چک‌لیست بازرسی تخصصی داربست/i)).toBeDefined();
      expect(screen.getByText(/نام کارشناس بازرس داربست/i)).toBeDefined();
      expect(screen.getByText(/برچسب نهایی بر اساس نتایج بازرسی/i)).toBeDefined();
      expect(screen.getByText(/شرح یافته‌ها و توضیحات تکمیلی بازرس/i)).toBeDefined();
    });
  });

  it("opens manual tag change modal", async () => {
    mockApi(scaffoldRoutes());

    render(<ScaffoldsPage />);

    await waitFor(() => {
      expect(screen.getByText("SCF-ROLL-001")).toBeDefined();
    });

    // Click '🏷️ تغییر تگ' button
    const changeTagButtons = screen.getAllByRole("button", { name: /تغییر تگ/i });
    fireEvent.click(changeTagButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/تغییر دستی برچسب داربست/i)).toBeDefined();
      expect(screen.getByText("تگ جدید")).toBeDefined();
      expect(screen.getByText("علت تغییر برچسب")).toBeDefined();
    });
  });
});
