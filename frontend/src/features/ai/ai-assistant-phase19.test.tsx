import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AIAssessmentDashboard } from "./components/AIAssessmentDashboard";
import { AssessmentWizard } from "./components/AssessmentWizard";
import { AssessmentResultsView } from "./components/AssessmentResultsView";
import { ChecklistDraftEditor } from "./components/ChecklistDraftEditor";
import { AssessmentApprovalModal } from "./components/AssessmentApprovalModal";
import type {
  AIAssessmentListItem,
  AIAssessmentDetail,
  AIServiceStatus,
  AIAssessmentStatistics,
  AIChecklistDraft,
  Workplace,
} from "../../services/api";

const mockServiceStatus: AIServiceStatus = {
  service_status: "ready",
  provider: "avalai",
  base_url: "https://api.avalai.ir/v1",
  model: "gpt-4o-mini",
  api_key_configured: true,
  offline_mode_allowed: true,
  message: "سرویس فعال است.",
};

const mockStats: AIAssessmentStatistics = {
  total_assessments: 3,
  by_status: { approved: 1, analyzed: 2 },
  checklists_generated_count: 1,
};

const mockAssessments: AIAssessmentListItem[] = [
  {
    id: 101,
    organization: 1,
    workplace: 1,
    workplace_name: "کارگاه مرکزی سازه‌های فولادی",
    title: "ارزیابی ایمنی کارگاه برش و جوشکاری",
    status: "checklist_generated",
    status_display: "چک‌لیست صادر شد",
    ai_model: "gpt-4o-mini",
    hazards_count: 5,
    checklist_items_count: 12,
    generated_checklist: 55,
    generated_checklist_title: "چک‌لیست مصوب کارگاه فلزی",
    created_at: "2026-10-31T12:00:00Z",
    updated_at: "2026-10-31T12:05:00Z",
  },
];

const mockWorkplaces: Workplace[] = [
  {
    id: 1,
    organization: 1,
    name: "کارگاه مرکزی سازه‌های فولادی",
    code: "WP-01",
  },
];

const mockDetail: AIAssessmentDetail = {
  ...mockAssessments[0],
  workplace_data: {
    general_info: {
      workplace_name: "کارگاه مرکزی سازه‌های فولادی",
      industry_type: "اسکلت فلزی",
      workshop_type: "جوشکاری و برش",
      shift_count: 2,
      worker_count: 45,
    },
  },
  analysis_result: {
    assessment_summary: {
      overall_risk_rating: "high",
      summary_persian: "ریسک کلی کارگاه بالا به دلیل پرس‌های هیدرولیک و خطرات کار گرم و برش پلاسما ارزیابی می‌گردد.",
      total_hazards_identified: 5,
      critical_hazards_count: 2,
      high_hazards_count: 3,
    },
    data_quality: {
      completeness_score: 95,
      missing_critical_data: [],
      assumptions_made: ["فرض بر سرویس ماهانه ادوات لیفتینگ"],
    },
    hazards: [
      {
        id: "haz-1",
        category: "مکانیکی / پرس",
        hazard_title: "قطع عضو ناشی از عدم کالیبراسیون پرده نوری پرس ۲۰۰ تن",
        hazard_description: "احتمال ورود دست اپراتور به منطقه کور پرس هیدرولیک",
        location_or_source: "ایستگاه پرس دروازه‌ای",
        exposed_groups: ["اپراتور پرس", "کمک‌اپراتور"],
        potential_consequences: ["قطع اندام و لهیدگی دست"],
        initial_probability: 3,
        initial_severity: 5,
        initial_risk_score: 15,
        initial_risk_level: "critical",
        recommended_controls: {
          engineering: ["کالیبراسیون هفتگی پرده نوری", "نصب دکمه توقف اضطراری قارچی"],
          administrative: ["چک‌لیست روزانه تست پرده نوری"],
          ppe: ["دستکش ایمنی مناسب"],
        },
        emergency_actions: ["فشردن فوری کلید E-Stop"],
        regulatory_references: ["آیین‌نامه ایمنی پرس‌های فلزی وزارت کار"],
      },
    ],
    checklist: {
      title: "چک‌لیست نهایی کارگاه سازه‌های فولادی",
      description: "بررسی ادوات برش و پرس",
      sections: [
        {
          id: "sec-1",
          title: "بخش ۱: ایمنی پرس‌ها",
          items: [
            {
              id: "item-1",
              title: "آیا پرده نوری پرس کالیبره و فعال است؟",
              inspection_criterion: "با ورود مانع جک در کمتر از ۰.۱ ثانیه متوقف شود.",
              response_type: "yes_no_na",
              is_critical: true,
              evidence_required: ["مشاهده عینی"],
            },
          ],
        },
      ],
    },
  },
  checklist_draft: {
    title: "چک‌لیست نهایی کارگاه سازه‌های فولادی",
    description: "بررسی ادوات برش و پرس",
    sections: [
      {
        id: "sec-1",
        title: "بخش ۱: ایمنی پرس‌ها",
        items: [
          {
            id: "item-1",
            title: "آیا پرده نوری پرس کالیبره و فعال است؟",
            inspection_criterion: "با ورود مانع جک در کمتر از ۰.۱ ثانیه متوقف شود.",
            response_type: "yes_no_na",
            is_critical: true,
            evidence_required: ["مشاهده عینی"],
          },
        ],
      },
    ],
  },
};

describe("Phase 19: Intelligent AI HSE Assistant Components", () => {
  it("renders AIAssessmentDashboard with stats, status, and assessment list", () => {
    const onNew = vi.fn();
    const onSelect = vi.fn();
    const onDelete = vi.fn();

    render(
      <AIAssessmentDashboard
        assessments={mockAssessments}
        stats={mockStats}
        serviceStatus={mockServiceStatus}
        onNewAssessment={onNew}
        onSelectAssessment={onSelect}
        onDeleteAssessment={onDelete}
        loading={false}
      />
    );

    expect(screen.getByText(/مدیریت و تحلیل هوشمند ارزیابی‌های محیط کار/)).toBeInTheDocument();
    expect(screen.getByText(/AvalAI متصل \(gpt-4o-mini\)/)).toBeInTheDocument();
    expect(screen.getByText("ارزیابی ایمنی کارگاه برش و جوشکاری")).toBeInTheDocument();
    expect(screen.getByText("چک‌لیست #55")).toBeInTheDocument();
  });

  it("loads Section 15 industrial scenario in AssessmentWizard", async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <AssessmentWizard
        workplaces={mockWorkplaces}
        selectedWorkplaceId={1}
        onSelectWorkplace={vi.fn()}
        onSubmit={onSubmit}
        onCancel={onCancel}
        loading={false}
      />
    );

    expect(screen.getByText("ارزیابی جامع محیط کار جهت تولید هوشمند چک‌لیست بازرسی")).toBeInTheDocument();

    const scenarioBtn = screen.getByRole("button", {
      name: /بارگذاری سناریوی نمونه \(کارگاه اسکلت فلزی\)/,
    });
    await userEvent.click(scenarioBtn);

    // Verify title and general info populated
    const titleInput = screen.getByDisplayValue("ارزیابی جامع ایمنی و بهداشت کارگاه سازه‌های فولادی سنگین");
    expect(titleInput).toBeInTheDocument();

    const workerInput = screen.getByDisplayValue("45");
    expect(workerInput).toBeInTheDocument();
  });

  it("renders hazard cards and hierarchy of controls in AssessmentResultsView", async () => {
    const onGoToChecklist = vi.fn();

    render(
      <AssessmentResultsView
        assessment={mockDetail}
        onGoToChecklistDraft={onGoToChecklist}
      />
    );

    expect(screen.getByText(/رتبه کلی ریسک: بالا \(High\)/)).toBeInTheDocument();
    expect(screen.getByText("قطع عضو ناشی از عدم کالیبراسیون پرده نوری پرس ۲۰۰ تن")).toBeInTheDocument();

    // Expand hazard card
    const hazardCard = screen.getByText("قطع عضو ناشی از عدم کالیبراسیون پرده نوری پرس ۲۰۰ تن");
    await userEvent.click(hazardCard);

    expect(screen.getByText(/سلسله‌مراتب تدابیر کنترلی پیشنهادی/)).toBeInTheDocument();
    expect(screen.getByText("کالیبراسیون هفتگی پرده نوری")).toBeInTheDocument();
  });

  it("edits and validates draft in ChecklistDraftEditor", async () => {
    const onSave = vi.fn();
    const onValidate = vi.fn().mockResolvedValue({ is_valid: true, message: "پیش‌نویس معتبر است." });
    const onRequestApproval = vi.fn();

    render(
      <ChecklistDraftEditor
        initialDraft={mockDetail.checklist_draft as AIChecklistDraft}
        assessmentId={101}
        onSaveDraft={onSave}
        onValidateDraft={onValidate}
        onRequestApproval={onRequestApproval}
        canApprove={true}
        isSaving={false}
        isValidating={false}
      />
    );

    expect(screen.getByDisplayValue("چک‌لیست نهایی کارگاه سازه‌های فولادی")).toBeInTheDocument();
    expect(screen.getByDisplayValue("بخش ۱: ایمنی پرس‌ها")).toBeInTheDocument();
    expect(screen.getByDisplayValue("آیا پرده نوری پرس کالیبره و فعال است؟")).toBeInTheDocument();

    // Click validate
    const validateBtn = screen.getByRole("button", { name: /اعتبارسنجی ساختار/ });
    await userEvent.click(validateBtn);

    expect(await screen.findByText("پیش‌نویس معتبر است.")).toBeInTheDocument();
  });

  it("enforces confirmation checkbox before approval in AssessmentApprovalModal", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <AssessmentApprovalModal
        assessment={mockDetail}
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        loading={false}
      />
    );

    expect(screen.getByText("دروازه نظارت و تأیید انسانی (Human Approval Gate)")).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: "تأیید نهایی و صدور چک‌لیست" });
    expect(approveBtn).toBeDisabled();

    // Check confirmation
    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);
    expect(approveBtn).not.toBeDisabled();

    await userEvent.click(approveBtn);
    expect(onConfirm).toHaveBeenCalled();
  });
});
