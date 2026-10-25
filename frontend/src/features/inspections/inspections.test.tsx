import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InspectionsPage } from "./InspectionsPage";
import {
  jsonResponse,
  mockApi,
  riskRoutes,
} from "../../test/mockApi";

const checklist = {
  id: 1,
  organization: 1,
  title: "چک‌لیست ایمنی",
  description: "",
  is_active: true,
  items: [
    {
      id: 10,
      checklist: 1,
      order: 1,
      text: "آیا نرده موجود است؟",
      is_required: true,
    },
  ],
};

const inspection = {
  id: 1,
  organization: 1,
  workplace: null,
  checklist: 1,
  checklist_title: "چک‌لیست ایمنی",
  title: "بازرسی اول",
  inspector: 1,
  scheduled_at: null,
  performed_at: null,
  completed_at: null,
  status: "in_progress",
  status_display: "در حال اجرا",
  notes: "",
  total_responses: 1,
  answered_responses: 0,
  responses: [
    {
      id: 100,
      inspection: 1,
      item: 10,
      item_text: "آیا نرده موجود است؟",
      is_required: true,
      order: 1,
      result: "",
      result_display: "بدون پاسخ",
      notes: "",
    },
  ],
};

describe("Inspections and Checklists Flow", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a checklist and adds an item", async () => {
    let checklists = [checklist];
    mockApi(
      riskRoutes({
        "/checklists/": (init) => {
          if (init?.method === "POST") {
            const created = {
              id: 2,
              organization: 1,
              title: "قالب جدید",
              description: "",
              is_active: true,
              items: [],
            };
            checklists = [...checklists, created];
            return jsonResponse(created, 201);
          }
          return jsonResponse(checklists);
        },
      }),
    );

    const user = userEvent.setup();
    render(<InspectionsPage />);

    await user.click(await screen.findByRole("button", { name: "قالب‌ها" }, { timeout: 5000 }));
    expect(
      await screen.findByRole("heading", { name: "قالب‌های چک‌لیست" }, { timeout: 5000 })
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("عنوان قالب"), "قالب جدید");
    await user.click(screen.getByRole("button", { name: "ثبت قالب" }));

    expect(await screen.findByText("قالب جدید")).toBeInTheDocument();
  });

  it("executes an inspection and completes it", async () => {
    let currentInspection = { ...inspection };
    mockApi(
      riskRoutes({
        "/checklists/": () => jsonResponse([checklist]),
        "/inspections/": () => jsonResponse([currentInspection]),
        "/inspections/1/": () => jsonResponse(currentInspection),
        "/inspections/responses/100/": (init) => {
          const body = JSON.parse(String(init?.body));
          currentInspection = {
            ...currentInspection,
            answered_responses: 1,
            responses: [
              {
                ...currentInspection.responses![0],
                result: body.result,
                notes: body.notes ?? "",
              },
            ],
          };
          return jsonResponse(currentInspection.responses![0]);
        },
        "/inspections/1/complete/": () => {
          currentInspection = {
            ...currentInspection,
            status: "completed",
            status_display: "تکمیل‌شده",
          };
          return jsonResponse(currentInspection);
        },
      }),
    );

    const user = userEvent.setup();
    render(<InspectionsPage />);

    const tabBtn = await screen.findByRole("button", { name: "بازرسی‌ها" });
    await user.click(tabBtn);
    expect(await screen.findByRole("heading", { name: "بازرسی‌ها" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "اجرا/مشاهده" }));
    const heading = await screen.findByRole("heading", { name: "اجرای بازرسی: بازرسی اول" });
    const section = heading.closest("section")!;
    const { within } = await import("@testing-library/react");
    const resultSelect = within(section).getByRole("combobox");
    await user.selectOptions(resultSelect, "conform");
    await user.click(screen.getByRole("button", { name: "ذخیره پاسخ‌ها" }));
    await user.click(screen.getByRole("button", { name: "تکمیل بازرسی" }));

    expect(await screen.findByText("وضعیت: تکمیل‌شده")).toBeInTheDocument();
  });

  it("creates non-conformity from response and verifies corrective action", async () => {
    let ncList: any[] = [];
    let actionList: any[] = [];

    mockApi(
      riskRoutes({
        "/checklists/": () => jsonResponse([checklist]),
        "/inspections/": () => jsonResponse([inspection]),
        "/inspections/1/": () =>
          jsonResponse({
            ...inspection,
            responses: [
              {
                ...inspection.responses![0],
                result: "nonconform",
                notes: "نرده مفقود است",
              },
            ],
          }),
        "/non-conformities/": (init) => {
          if (init?.method === "POST") {
            const created = {
              id: 10,
              organization: 1,
              workplace: null,
              inspection: 1,
              description: "نرده مفقود است",
              severity: "high",
              severity_display: "زیاد",
              source: "inspection",
              source_display: "بازرسی",
              responsible: null,
              status: "open",
              status_display: "باز",
              evidence_text: "",
              corrective_action_count: 0,
            };
            ncList = [created];
            return jsonResponse(created, 201);
          }
          return jsonResponse(ncList);
        },
        "/corrective-actions/": (init) => {
          if (init?.method === "POST") {
            const created = {
              id: 20,
              organization: 1,
              non_conformity: 10,
              description: "نصب نرده",
              responsible: null,
              due_date: null,
              status: "pending_verification",
              status_display: "در انتظار تأیید",
              result_text: "انجام شد",
              effectiveness_verified: false,
            };
            actionList = [created];
            return jsonResponse(created, 201);
          }
          return jsonResponse(actionList);
        },
        "/corrective-actions/20/verify/": () => {
          actionList[0] = {
            ...actionList[0],
            status: "completed",
            status_display: "تکمیل‌شده",
            effectiveness_verified: true,
          };
          return jsonResponse(actionList[0]);
        },
      }),
    );

    const user = userEvent.setup();
    render(<InspectionsPage />);

    const tabBtn = await screen.findByRole("button", { name: "بازرسی‌ها" });
    await user.click(tabBtn);
    await user.click(await screen.findByRole("button", { name: "اجرا/مشاهده" }));

    await user.click(screen.getByRole("button", { name: "ثبت عدم‌انطباق" }));
    expect(await screen.findByRole("heading", { name: "عدم‌انطباق‌ها" })).toBeInTheDocument();
    expect(screen.getByText("نرده مفقود است")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "اقدامات" }));
    await user.selectOptions(screen.getByLabelText("عدم‌انطباق"), "10");
    await user.type(screen.getByLabelText("شرح اقدام"), "نصب نرده");
    await user.click(screen.getByRole("button", { name: "ثبت اقدام" }));

    expect(await screen.findByText("نصب نرده")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "مدیریت" }));
    await user.click(screen.getByRole("button", { name: "تأیید اثربخشی" }));

    expect(await screen.findByText("تکمیل‌شده")).toBeInTheDocument();
  });
});
