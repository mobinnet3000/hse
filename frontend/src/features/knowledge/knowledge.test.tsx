import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KnowledgeBasePage } from "./KnowledgeBasePage";
import { AuthProvider } from "../auth/AuthContext";
import { jsonResponse, mockApi, riskRoutes, testOrganization } from "../../test/mockApi";
import type { KnowledgeSource } from "../../services/api";

const mockSources: KnowledgeSource[] = [
  {
    id: 1,
    organization: null,
    organization_name: null,
    title: "آیین‌نامه ایمنی کار در ارتفاع",
    code: "IR-OHS-HEIGHT-89",
    category: "regulation",
    category_display: "آیین‌نامه و مقررات دولتی",
    issuing_authority: "شورای عالی حفاظت فنی",
    effective_date: "2011-02-14",
    version: "1.0",
    status: "active",
    status_display: "معتبر و لازم‌الاجرا",
    is_verified: true,
    summary: "الزامات فنی سامانه‌های مهار سقوط و داربست",
    content: "ماده ۱: الزام به استفاده از هارنس ایمنی برای ارتفاع بیش از ۲ متر.",
    tags: "ارتفاع, داربست, سقوط",
    created_by: null,
    creator_name: null,
    can_edit: true,
    created_at: "2026-10-19T10:00:00Z",
    updated_at: "2026-10-19T10:00:00Z",
  },
];

describe("KnowledgeBasePage", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders knowledge sources and expands full content", async () => {
    mockApi(
      riskRoutes({
        "/knowledge-base/": () => jsonResponse(mockSources),
      })
    );

    render(
      <AuthProvider>
        <KnowledgeBasePage />
      </AuthProvider>
    );

    expect(await screen.findByRole("heading", { name: "پایگاه دانش و مقررات HSE" })).toBeInTheDocument();
    expect(await screen.findByText("IR-OHS-HEIGHT-89")).toBeInTheDocument();
    expect(await screen.findByText("آیین‌نامه ایمنی کار در ارتفاع")).toBeInTheDocument();
    expect(screen.getByText("✓ معتبر و لازم‌الاجرا")).toBeInTheDocument();

    const expandBtn = screen.getByRole("button", { name: "مشاهده متن کامل" });
    await userEvent.click(expandBtn);

    expect(await screen.findByText("ماده ۱: الزام به استفاده از هارنس ایمنی برای ارتفاع بیش از ۲ متر.")).toBeInTheDocument();
  });

  it("opens create modal and adds new knowledge source", async () => {
    let sourcesList = [...mockSources];

    mockApi(
      riskRoutes({
        "/knowledge-base/": (init) => {
          if (init?.method === "POST") {
            const body = JSON.parse(String(init.body));
            const created: KnowledgeSource = {
              id: 2,
              organization: testOrganization.id,
              organization_name: testOrganization.name,
              title: body.title,
              code: body.code,
              category: body.category,
              category_display: "دستورالعمل درون‌سازمانی",
              issuing_authority: body.issuing_authority,
              effective_date: null,
              version: body.version || "1.0",
              status: "active",
              status_display: "معتبر",
              is_verified: true,
              summary: body.summary,
              content: body.content,
              tags: body.tags,
              created_by: 1,
              creator_name: "علی",
              can_edit: true,
              created_at: "2026-10-19T12:00:00Z",
              updated_at: "2026-10-19T12:00:00Z",
            };
            sourcesList.unshift(created);
            return jsonResponse(created, 201);
          }
          return jsonResponse(sourcesList);
        },
      })
    );

    render(
      <AuthProvider>
        <KnowledgeBasePage />
      </AuthProvider>
    );

    expect(await screen.findByText("IR-OHS-HEIGHT-89")).toBeInTheDocument();

    const addBtn = screen.getByRole("button", { name: "+ ثبت منبع جدید" });
    await userEvent.click(addBtn);

    expect(screen.getByText("ثبت منبع / آیین‌نامه جدید")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("عنوان استاندارد یا دستورالعمل *"), "دستورالعمل جوشکاری برق");
    await userEvent.type(screen.getByLabelText("کد یا شناسه استاندارد *"), "SOP-WELD-01");
    await userEvent.type(screen.getByLabelText("متن کامل مواد و الزامات *"), "استفاده از شیلد محافظ صورت و دستکش جوشکاری الزامی است.");

    const submitBtn = screen.getByRole("button", { name: "ذخیره منبع" });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("SOP-WELD-01")).toBeInTheDocument();
      expect(screen.getByText("دستورالعمل جوشکاری برق")).toBeInTheDocument();
    });
  });
});
