import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { MocPage } from "./MocPage";
import { jsonResponse, mockApi } from "../../test/mockApi";

const mockChangeRequest = {
  id: 1,
  organization: 1,
  workplace: 1,
  moc_number: "MOC-2026-0001",
  title: "تعویض پمپ اسید سولفوریک",
  change_type: "process",
  change_type_display: "فرایندی",
  category: "permanent",
  category_display: "دائمی",
  status: "submitted",
  status_display: "در انتظار ارزیابی ریسک",
  reason_for_change: "خوردگی شدید و نشتی مکرر پمپ فعلی",
  description: "نصب پمپ سانتریفیوژ مقاوم به اسید با سیل مکانیکی دوبل",
  requested_by: 1,
  requested_by_name: "مهندس فرآیند",
  related_equipment: 10,
  related_equipment_name: "پمپ P-101",
  related_risk_register: null,
  risk_assessment_required: true,
  risk_assessed: false,
  risk_approved: false,
  document_revision_required: true,
  training_required: false,
  traceability_chain_id: "TRC-MOC-2026-0001",
  created_at: "2026-11-23T10:00:00Z",
  updated_at: "2026-11-23T10:00:00Z",
};

describe("MocPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      mockApi({
        "/organizations/": () =>
          jsonResponse([{ id: 1, name: "پتروشیمی پارس", code: "pars-petro" }]),
        "/workplaces/": () =>
          jsonResponse([{ id: 1, name: "واحد آروماتیک", organization: 1 }]),
        "/risks/registers/": () => jsonResponse([]),
        "/moc/": () => jsonResponse([mockChangeRequest]),
        "/moc/1/": () => jsonResponse(mockChangeRequest),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders page header and stats correctly", async () => {
    render(<MocPage />);

    expect(
      await screen.findByText("مدیریت یکپارچه تغییرات (Management of Change - MOC)")
    ).toBeInTheDocument();

    expect(screen.getByText("ثبت درخواست تغییر جدید (MOC)")).toBeInTheDocument();
    expect(screen.getByText("کل تغییرات ثبت‌شده")).toBeInTheDocument();
    expect(screen.getAllByText("در انتظار ارزیابی ریسک").length).toBeGreaterThan(0);
  });

  it("displays the change request list and status badge", async () => {
    render(<MocPage />);

    await waitFor(() => {
      expect(screen.getByText("MOC-2026-0001")).toBeInTheDocument();
      expect(screen.getByText("تعویض پمپ اسید سولفوریک")).toBeInTheDocument();
    });
  });
});
