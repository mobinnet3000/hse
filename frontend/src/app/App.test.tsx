import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../app/App";
import { jsonResponse, mockApi, riskRoutes, testUser } from "../test/mockApi";

describe("App layout and health status", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Persian RTL layout and sidebar for authenticated users", async () => {
    mockApi(riskRoutes());

    const { container } = render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "سامانه مدیریت ایمنی، بهداشت و محیط زیست",
      }),
    ).toBeInTheDocument();
    expect(container.querySelector(".app-shell")).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("navigation", { name: "منوی اصلی" })).toBeInTheDocument();
  });

  it("shows healthy status after API responds", async () => {
    mockApi(riskRoutes());

    render(<App />);

    expect(await screen.findByText(/سرویس فعال است/)).toBeInTheDocument();
  });

  it("shows error state when health API fails", async () => {
    mockApi(
      riskRoutes({
        "/health/": () => {
          throw new Error("network down");
        },
      }),
    );

    render(<App />);

    expect(await screen.findByText(/اتصال به سرور برقرار نشد/)).toBeInTheDocument();
  });

  it("shows the signed-in user name", async () => {
    mockApi(riskRoutes());

    render(<App />);

    expect(await screen.findByText(testUser.first_name)).toBeInTheDocument();
  });
});

describe("Risks page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders hazards list from the API", async () => {
    mockApi(
      riskRoutes({
        "/risks/": () =>
          jsonResponse([
            {
              id: 1,
              organization: 1,
              workplace: null,
              title: "سقوط از ارتفاع",
              description: "",
              category: "safety",
              category_display: "ایمنی",
              source: "",
              causes: "",
              consequences: "",
              exposed_persons: "",
              existing_controls: "",
              status: "active",
              status_display: "فعال",
            },
          ]),
      }),
    );

    render(<App />);

    expect((await screen.findAllByText("سقوط از ارتفاع")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "خطرها" })).toBeInTheDocument();
  });

  it("shows empty state when there are no hazards", async () => {
    mockApi(riskRoutes());

    render(<App />);

    expect(await screen.findByText("خطری ثبت نشده است.")).toBeInTheDocument();
  });

  it(
    "shows the server-computed score after submitting an assessment",
    async () => {
    mockApi(
      riskRoutes({
        "/risks/assessments/": (init) => {
          if (init?.method === "POST") {
            return jsonResponse(
              {
                id: 5,
                hazard: 1,
                organization: 1,
                likelihood: 4,
                severity: 5,
                score: 20,
                level: "critical",
                level_display: "بحرانی",
                proposed_controls: "",
                implemented_controls: "",
                status: "draft",
                status_display: "پیش‌نویس",
                assessed_at: "2026-01-01T00:00:00Z",
              },
              201,
            );
          }
          return jsonResponse([]);
        },
        "/risks/": () =>
          jsonResponse([
            {
              id: 1,
              organization: 1,
              workplace: null,
              title: "سقوط از ارتفاع",
              description: "",
              category: "safety",
              category_display: "ایمنی",
              source: "",
              causes: "",
              consequences: "",
              exposed_persons: "",
              existing_controls: "",
              status: "active",
              status_display: "فعال",
            },
          ]),
      }),
    );

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText("سقوط از ارتفاع");
    await user.selectOptions(screen.getByLabelText("خطر"), "1");
    await user.selectOptions(screen.getByLabelText("احتمال (۱ تا ۵)"), "4");
    await user.selectOptions(screen.getByLabelText("شدت (۱ تا ۵)"), "5");
    await user.click(screen.getByRole("button", { name: "ثبت ارزیابی" }));

    expect(await screen.findByRole("status")).toHaveTextContent("امتیاز ریسک: 20");
    expect(screen.getByRole("status")).toHaveTextContent("بحرانی");
  }, 60000);
});


