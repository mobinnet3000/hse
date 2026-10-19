import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../app/App";
import {
  jsonResponse,
  mockApi,
  riskRoutes,
  testUser,
  unauthenticated,
} from "../../test/mockApi";

const hazard = {
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
  status: "draft",
  status_display: "پیش‌نویس",
};

describe("Authentication flow", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows login form when no session exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(unauthenticated());

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "ورود به HSE Guard" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("نام کاربری")).toBeInTheDocument();
  });

  it("logs in and shows the dashboard", async () => {
    let loggedIn = false;
    mockApi(
      riskRoutes({
        "/auth/me/": () => (loggedIn ? jsonResponse(testUser) : unauthenticated()),
        "/auth/login/": () => {
          loggedIn = true;
          return jsonResponse(testUser);
        },
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "ورود به HSE Guard" });
    await user.type(screen.getByLabelText("نام کاربری"), "ali");
    await user.type(screen.getByLabelText("رمز عبور"), "secret");
    await user.click(screen.getByRole("button", { name: "ورود" }));

    expect(
      await screen.findByRole("heading", {
        name: "سامانه مدیریت ایمنی، بهداشت و محیط زیست",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("علی")).toBeInTheDocument();
  });

  it("shows server error message on failed login", async () => {
    mockApi(
      riskRoutes({
        "/auth/me/": unauthenticated,
        "/auth/login/": () =>
          jsonResponse(
            {
              error: {
                code: "invalid_credentials",
                message: "نام کاربری یا رمز عبور نادرست است.",
              },
            },
            400,
          ),
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "ورود به HSE Guard" });
    await user.type(screen.getByLabelText("نام کاربری"), "ali");
    await user.type(screen.getByLabelText("رمز عبور"), "bad");
    await user.click(screen.getByRole("button", { name: "ورود" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "نام کاربری یا رمز عبور نادرست است.",
    );
  });

  it("returns to login when session expires on a protected request", async () => {
    mockApi(
      riskRoutes({
        "/organizations/": () => unauthenticated(),
      }),
    );

    render(<App />);

    await screen.findByRole("heading", {
      name: "سامانه مدیریت ایمنی، بهداشت و محیط زیست",
    });

    expect(
      await screen.findByRole("heading", { name: "ورود به HSE Guard" }),
    ).toBeInTheDocument();
  });

  it("logs out and returns to the login form", async () => {
    let loggedIn = true;
    mockApi(
      riskRoutes({
        "/auth/me/": () => (loggedIn ? jsonResponse(testUser) : unauthenticated()),
        "/auth/logout/": () => {
          loggedIn = false;
          return new Response(null, { status: 204 });
        },
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", {
      name: "سامانه مدیریت ایمنی، بهداشت و محیط زیست",
    });
    await user.click(screen.getByRole("button", { name: "خروج" }));

    expect(
      await screen.findByRole("heading", { name: "ورود به HSE Guard" }),
    ).toBeInTheDocument();
  });
});

describe("Hazard form", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a hazard and reloads the list", async () => {
    let hazards = [hazard];
    mockApi(
      riskRoutes({
        "/risks/": (init) => {
          if (init?.method === "POST") {
            const created = { ...hazard, id: 2, title: "خطر جدید" };
            hazards = [...hazards, created];
            return jsonResponse(created, 201);
          }
          return jsonResponse(hazards);
        },
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText("سقوط از ارتفاع");
    await user.type(screen.getByLabelText("عنوان"), "خطر جدید");
    await user.click(screen.getByRole("button", { name: "ثبت خطر" }));

    expect((await screen.findAllByText("خطر جدید")).length).toBeGreaterThan(0);
  });

  it("shows validation error from the API", async () => {
    mockApi(
      riskRoutes({
        "/risks/": (init) => {
          if (init?.method === "POST") {
            return jsonResponse(
              {
                error: {
                  code: "invalid",
                  message: "اطلاعات ارسال‌شده معتبر نیست.",
                  details: { workplace: ["محل کار باید متعلق به همان سازمان باشد."] },
                },
              },
              400,
            );
          }
          return jsonResponse([hazard]);
        },
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText("سقوط از ارتفاع");
    await user.type(screen.getByLabelText("عنوان"), "خطر نامعتبر");
    await user.click(screen.getByRole("button", { name: "ثبت خطر" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "اطلاعات ارسال‌شده معتبر نیست.",
    );
  });

  it("edits an existing hazard", async () => {
    let hazards = [hazard];
    mockApi(
      riskRoutes({
        "/risks/": (init) => {
          if (init?.method === "POST") return jsonResponse(hazard, 201);
          return jsonResponse(hazards);
        },
        "/risks/1/": (init) => {
          if (init?.method === "PATCH") {
            const updated = { ...hazard, title: "عنوان ویرایش‌شده" };
            hazards = [updated];
            return jsonResponse(updated);
          }
          return jsonResponse(hazard);
        },
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText("سقوط از ارتفاع");
    await user.click(screen.getByRole("button", { name: "ویرایش" }));
    const titleInput = screen.getByLabelText("عنوان");
    await user.clear(titleInput);
    await user.type(titleInput, "عنوان ویرایش‌شده");
    await user.click(screen.getByRole("button", { name: "ذخیره تغییرات" }));

    expect((await screen.findAllByText("عنوان ویرایش‌شده")).length).toBeGreaterThan(0);
  });
});

