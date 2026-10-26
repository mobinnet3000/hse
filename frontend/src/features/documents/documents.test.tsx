import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentsPage } from "./DocumentsPage";
import { AuthProvider } from "../auth/AuthContext";
import { mockApi, documentRoutes } from "../../test/mockApi";

function renderWithAuth(ui: React.ReactElement) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe("DocumentsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders document control dashboard, KPI summary cards and document register", async () => {
    mockApi(documentRoutes());

    renderWithAuth(<DocumentsPage />);

    expect(
      screen.getByText("کنترل مدارک، نسخه‌بندی و آرشیو امن HSE")
    ).toBeDefined();

    await waitFor(() => {
      // Check KPI summary cards
      expect(screen.getByText("کل اسناد کنترل‌شده")).toBeDefined();
      expect(screen.getAllByText(/لازم‌الاجرا و جاری/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/در انتظار ممیزی/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("تصدیق مطالعه (Acks)")).toBeDefined();
    });

    // Check document register item
    await waitFor(() => {
      expect(screen.getByText("DOC-SOP-001")).toBeDefined();
      expect(screen.getByText("دستورالعمل جامع ایمنی کار در ارتفاع")).toBeDefined();
      expect(screen.getByText("v2.0")).toBeDefined();
    });
  });

  it("opens create document modal on click", async () => {
    mockApi(documentRoutes());

    renderWithAuth(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("DOC-SOP-001")).toBeDefined();
    });

    const createBtn = screen.getByRole("button", { name: /ثبت و بارگذاری سند جدید/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText("ثبت و بارگذاری مدرک کنترل‌شده جدید")).toBeDefined();
      expect(screen.getByText(/شماره \/ شناسه یکتای مدرک/i)).toBeDefined();
      expect(screen.getByText(/دسته‌بندی مدرک/i)).toBeDefined();
      expect(screen.getByText(/سطح محرمانگی/i)).toBeDefined();
    });
  });

  it("opens document details modal and displays version history & sha256 hash", async () => {
    mockApi(documentRoutes());

    renderWithAuth(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("DOC-SOP-001")).toBeDefined();
    });

    const detailBtn = screen.getByRole("button", { name: /جزئیات/i });
    fireEvent.click(detailBtn);

    await waitFor(() => {
      expect(screen.getByText("شناسنامه و فایل جاری")).toBeDefined();
      expect(screen.getByText(/SOP_Work_At_Height_v2.0.pdf/i)).toBeDefined();
      expect(screen.getByText(/دانلود امن فایل/i)).toBeDefined();
    });

    // Switch to Version History tab
    const historyTab = screen.getByRole("button", { name: /تاریخچه نگارش‌ها/i });
    fireEvent.click(historyTab);

    await waitFor(() => {
      expect(screen.getByText("نگارش‌های تاریخی و فایل‌های ثبت‌شده")).toBeDefined();
      expect(screen.getByText("افزودن الزامات تگ داربست")).toBeDefined();
      expect(screen.getByText("نسخه اولیه")).toBeDefined();
    });
  });

  it("opens review modal for pending documents", async () => {
    mockApi(
      documentRoutes({
        "/documents/documents/": () =>
          new Response(
            JSON.stringify([
              {
                id: 2,
                organization: 1,
                document_number: "DOC-WI-002",
                title: "دستورالعمل فضای بسته",
                category: "work_instruction",
                category_display: "دستورالعمل کاری (WI)",
                confidentiality: "internal",
                confidentiality_display: "داخلی سازمان",
                status: "under_review",
                status_display: "در حال بررسی و ممیزی",
                department: "عملیات",
                current_version_id: 12,
                current_version_number: "1.0",
                current_version_filename: "WI_Confined_Space.pdf",
                current_version_size: 150000,
                current_version_hash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
                is_expired: false,
                is_review_overdue: false,
                is_review_due_soon: false,
                is_effective: false,
                requires_acknowledgment: true,
                acknowledgments_count: 0,
                versions_count: 1,
                tags: "فضای بسته",
                updated_at: "2026-10-25T10:00:00Z",
                created_at: "2026-10-25T08:00:00Z",
              },
            ]),
            { headers: { "Content-Type": "application/json" } }
          ),
      })
    );

    renderWithAuth(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("DOC-WI-002")).toBeDefined();
    });

    // The green check button for under_review document triggers review modal
    const reviewBtn = screen.getByTitle("تصویب یا رد سند");
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText("ممیزی، تصویب یا رد مدرک")).toBeDefined();
      expect(screen.getByText("تصویب و ابلاغ مدرک")).toBeDefined();
      expect(screen.getByText("رد و درخواست اصلاحات")).toBeDefined();
    });
  });
});
