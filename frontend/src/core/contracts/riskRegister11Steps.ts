/**
 * Canonical 11-Step Risk Register Schema (HAER Architecture)
 * ساختار استاندارد ۱۱ مرحله‌ای تدوین و گردش کار ارزیابی و مدیریت ریسک
 */

export interface Step1AssessmentContext {
  companyName: string;
  department: string;
  projectName: string;
  siteLocation: string;
  area: string;
  projectPhase: string;
  operationType: string;
  client: string;
  contractor: string;
}

export interface Step2ActivityTaskIdentification {
  activity: string;                     // عنوان فعالیت اصلی
  activityDescription: string;          // شرح فعالیت
  task: string;                         // وظیفه یا کار اجرایی
  jobSteps: string[];                   // مراحل انجام کار (گام‌ها)
  workMethod: string;                   // روش اجرای کار / رویه
  equipment: string[];                  // تجهیزات مورد استفاده
  materials: string[];                  // مواد مصرفی و شیمیایی
  numberOfPersonnel: number;            // تعداد افراد درگیر
  competency: string;                   // تخصص و صلاحیت افراد
  durationFrequency: string;            // مدت و تناوب انجام کار
  simops: string;                       // فعالیت‌های هم‌زمان (SIMOPS)
  operatingConditions: string;          // شرایط محیطی و عملیاتی
}

export type HazardDomainType = "safety" | "occupational_health" | "environment" | "process_safety";

export interface Step3HazardIdentification {
  domain: HazardDomainType;
  domainDisplay: string;
  category: string;
  hazardDescription: string;
  examples: string[];
}

export interface Step4RiskScenarioIdentification {
  scenarioTitle: string;                // عنوان سناریو
  undesiredEvent: string;               // شرح رویداد ناخواسته
  initiatingEvent: string;              // رویداد آغازگر
  directCauses: string[];               // علل مستقیم
  rootCauses: string[];                 // علل ریشه‌ای یا زمینه‌ای
  escalationFactors: string[];          // عوامل تشدیدکننده
  eventSequence: string[];              // توالی وقوع رویداد
  scenarioConditions: string;           // شرایط وقوع
  exposurePathway: string;              // مسیر مواجهه

  // تفکیک مفهومی با مثال عینی:
  // Hazard: بار معلق
  // Event: سقوط یا جابه‌جایی ناخواسته بار
  // Scenario: سقوط بار معلق و برخورد آن با کارگر مستقر در محدوده عملیات
  // Consequence: آسیب شدید یا فوت کارگر
  conceptualDistinction: {
    hazard: string;
    event: string;
    scenario: string;
    consequence: string;
  };
}

export type ConsequenceDimensionKey = "human" | "asset" | "environment" | "reputation" | "operational_continuity";

export interface Step5ConsequenceIdentification {
  human: { code: "H"; label: "انسانی"; description: string };
  asset: { code: "A"; label: "دارایی و تجهیزات"; description: string };
  environment: { code: "E"; label: "محیط زیست"; description: string };
  reputation: { code: "R"; label: "اعتبار و روابط عمومی"; description: string };
  operationalContinuity: {
    code: "O";
    label: "تداوم عملیات و توقف تولید";
    description: string;
    isIndependentDimension: boolean;
  };
}

export type HierarchyOfControlLevel =
  | "elimination"
  | "substitution"
  | "engineering"
  | "administrative"
  | "ppe";

export interface ExistingControlItem {
  controlDescription: string;
  controlType: string;
  hierarchyOfControl: HierarchyOfControlLevel;
  hierarchyDisplay: string;
  controlOwner: string;
  inspectionFrequency: string;
  
  // شواهد اثربخشی و عملکرد
  implementationStatus: "implemented" | "partial" | "planned" | "defective";
  isEffective: boolean;
  effectivenessEvidence: string;
}

export interface DimensionScoreItem {
  dimension: ConsequenceDimensionKey;
  dimensionLabel: string;
  likelihood: number; // 1 to 5
  severity: number;   // 1 to 5
  rpn: number;        // L * S (1 to 25)
  level: "low" | "medium" | "high" | "critical";
  targetRpn?: number;
}

export interface Step7InitialRiskAssessment {
  scores: Record<"H" | "A" | "E" | "R", DimensionScoreItem>;
  overallInitialRpn: number;
  overallInitialLevel: "low" | "medium" | "high" | "critical";
}

export interface Step8CurrentRiskAssessment {
  scores: Record<"H" | "A" | "E" | "R", DimensionScoreItem>;
  overallCurrentRpn: number;
  overallCurrentLevel: "low" | "medium" | "high" | "critical";
  effectNotes: string; // تمایز اثر کنترلهای پیشگیرانه (کاهش L) و کنترلهای کاهنده پیامد (کاهش S)
}

export interface Step9RiskTreatmentAction {
  actionDescription: string;
  actionType: "preventive" | "mitigative" | "recovery";
  hierarchyLevel: HierarchyOfControlLevel;
  priority: "urgent" | "high" | "medium" | "low";
  actionOwner: string;
  dueDate: string;
  actionStatus: "pending" | "in_progress" | "completed" | "verified";
  completionEvidence: string;
  verificationResult: string;
}

export interface Step10ResidualAndTargetRisk {
  residualScores: Record<"H" | "A" | "E" | "R", DimensionScoreItem>;
  overallResidualRpn: number;
  overallResidualLevel: "low" | "medium" | "high" | "critical";
  isWithinAlarp: boolean;
}

export interface Step11ApprovalAndGovernance {
  riskAcceptanceStatus: "acceptable" | "tolerable_alarp" | "unacceptable";
  acceptanceAuthority: string;
  approvalDate: string;
  revisionNumber: number;
  auditTrailCode: string;
  nextScheduledReviewDate: string;
}

export interface CompleteRiskRegisterRecord {
  id: string;
  step1Context: Step1AssessmentContext;
  step2Activity: Step2ActivityTaskIdentification;
  step3Hazard: Step3HazardIdentification;
  step4Scenario: Step4RiskScenarioIdentification;
  step5Consequences: Step5ConsequenceIdentification;
  step6Controls: ExistingControlItem[];
  step7InitialRisk: Step7InitialRiskAssessment;
  step8CurrentRisk: Step8CurrentRiskAssessment;
  step9Treatment: Step9RiskTreatmentAction[];
  step10ResidualTarget: Step10ResidualAndTargetRisk;
  step11Governance: Step11ApprovalAndGovernance;
}
