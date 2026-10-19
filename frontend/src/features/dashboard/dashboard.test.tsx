import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../app/App";
import {
  jsonResponse,
  mockApi,
  riskRoutes,
  testOrganization,
} from "../../test/mockApi";

describe("Phase 5 Dashboard, Reports, Notifications & Audit Log Flow", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dashboard metrics and urgent deadlines", async () => {
    mockApi(
      riskRoutes({
        "/dashboard/metrics/": () =>
          jsonResponse({
            inspections: { draft: 1, in_progress: 2, completed: 5, cancelled: 0, total: 8 },
            risks: { low: 2, medium: 3, high: 1, critical: 2, total: 8, hazards_count: 4 },
            non_conformities: { open: 3, in_progress: 1, ready_for_review: 1, closed: 4, total: 9 },
            corrective_actions: { open: 2, completed: 3, overdue: 1, total: 6 },
            urgent_deadlines: {
              inspections: [
                { id: 1, title: "بازرسی دیگ بخار", scheduled_at: "2026-10-25T10:00:00Z", status: "in_progress", is_overdue: false },
              ],
              actions: [
                { id: 10, description: "تعویض کپسول اطفا", due_date: "2026-10-15", status: "open", is_overdue: true },
              ],
            },
          }),
      }),
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "داشبورد مدیریتی HSE" })).toBeInTheDocument();
    expect(await screen.findByText("بازرسی دیگ بخار")).toBeInTheDocument();
    expect(await screen.findByText("تعویض کپسول اطفا")).toBeInTheDocument();
    expect(screen.getByText("[سررسید گذشته]")).toBeInTheDocument();
  });

  it("renders notifications and marks a notification as read", async () => {
    let notifs = [
      { id: 101, title: "سررسید گذشته", message: "اقدام ۱۰ منقضی شد.", is_read: false, created_at: "2026-10-19T10:00:00Z" },
    ];

    mockApi(
      riskRoutes({
        "/notifications/": () => jsonResponse(notifs),
        "/notifications/101/read/": () => {
          notifs[0] = { ...notifs[0], is_read: true };
          return jsonResponse(notifs[0]);
        },
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    // Click on notifications nav
    const notifNav = await screen.findByRole("link", { name: /اعلان‌ها/ });
    await user.click(notifNav);

    expect(await screen.findByRole("heading", { name: "اعلان‌های سامانه" })).toBeInTheDocument();
    expect(await screen.findByText("اقدام ۱۰ منقضی شد.")).toBeInTheDocument();

    // Mark as read
    const markReadBtn = await screen.findByRole("button", { name: "خوانده شد" });
    await user.click(markReadBtn);

    expect(markReadBtn).not.toBeInTheDocument();
  });

  it("renders audit log events table", async () => {
    mockApi(
      riskRoutes({
        "/audit-logs/": () =>
          jsonResponse([
            {
              id: 50,
              organization: 1,
              organization_name: testOrganization.name,
              actor: 1,
              actor_username: "ali",
              action: "risk.create",
              entity_type: "risk",
              entity_id: 12,
              details: { title: "ریسک برق‌گرفتگی" },
              created_at: "2026-10-19T12:00:00Z",
            },
          ]),
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    const auditNav = await screen.findByRole("link", { name: "حسابرسی" });
    await user.click(auditNav);

    expect(await screen.findByRole("heading", { name: "گزارش حسابرسی رخدادها (Audit Log)" })).toBeInTheDocument();
    expect(await screen.findByText("ثبت خطر (risk.create)")).toBeInTheDocument();
    expect(screen.getByText(/ریسک برق‌گرفتگی/)).toBeInTheDocument();
  });

  it("navigates to reports page and initiates CSV export", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    mockApi(riskRoutes());

    const user = userEvent.setup();
    render(<App />);

    const reportsNav = await screen.findByRole("link", { name: "گزارش‌ها" });
    await user.click(reportsNav);

    expect(await screen.findByRole("heading", { name: "گزارش‌ها و خروجی داده‌ها" })).toBeInTheDocument();

    const downloadBtn = await screen.findByRole("button", { name: /دریافت خروجی گزارش بازرسی‌ها/ });
    await user.click(downloadBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining("/reports/export/inspections/?organization=1"),
      "_blank",
    );
  });
});
