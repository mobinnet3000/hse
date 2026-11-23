import React, { useState } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Flame,
  FileCheck,
  Building2,
  HardHat,
  Sliders,
  Plus,
  Trash2,
  Activity,
  Layers,
  Sparkles,
  GitBranch,
} from "lucide-react";
import { createFullRiskRegister } from "../../../services/api";
import { useSharedMasterData } from "../../../core/store/sharedMasterStore";
import { PaperBadge, PaperButton } from "../../../core/design-system/UIPrimitives";

interface Props {
  organizationId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ControlEntry {
  description: string;
  hierarchy: "elimination" | "substitution" | "engineering" | "administrative" | "ppe";
  control_type: string;
  control_owner: string;
  inspection_frequency: string;
  is_effective: boolean;
  effectiveness_evidence: string;
}

interface TreatmentEntry {
  action_description: string;
  hierarchy: "elimination" | "substitution" | "engineering" | "administrative" | "ppe";
  priority: "urgent" | "high" | "medium" | "low";
  action_owner: string;
  due_date: string;
  status: "pending" | "in_progress" | "completed" | "verified";
  completion_evidence: string;
  verification_result: string;
}

export const RiskWizardModal: React.FC<Props> = ({
  organizationId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { projects, sites, areas, contractors, personnel, equipment, chemicals } = useSharedMasterData();

  // State across all 11 steps
  const [formData, setFormData] = useState({
    // Step 1: Context
    register_code: `RR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    title: "",
    project_name: projects[0]?.name || "پروژه احداث واحد الفین و هیدروکراکر",
    department: "واحد فرآیند و بهره‌برداری",
    site_location: sites[0]?.name || "منطقه ویژه انرژی عسلویه",
    area: areas[0]?.name || "واحد تفکیک و تثبیت میعانات",
    project_phase: "عملیات اجرایی (Execution)",
    operation_type: "تعمیرات اساسی و توقف واحد (Overhaul)",
    client_name: "شرکت ملی صنایع پتروشیمی ایران",
    contractor_name: contractors[0]?.companyName || "شرکت توسعه انرژی و سازه‌های صنعتی",

    // Step 2: Activity & Tasks
    activity_title: "تخلیه کاتالیست و شستشوی برج تقطیر",
    activity_description: "عملیات ورود به فضای بسته جهت کاتالیست‌زدایی و بازرسی متالورژیکی دیواره‌ها",
    task_name: "ورود به فضای بسته (CSE) و تمیزکاری مکانیکی",
    job_steps: [
      "جداسازی مکانیکی و نصب بلایند فلنج (Spading)",
      "شستشو با بخار و تهویه با بلوئر ضدجرقه",
      "گازسنجی مستمر اکسیژن و گازهای سمی H2S",
      "ورود تیم تخصصی با تجهیزات هوارسان",
    ],
    newStepInput: "",
    work_method: "رویه شماره SOP-CSE-04 و استاندارد کار در فضای بسته",
    equipment: equipment[0]?.name || "دتکتور گاز پرتابل ۴ کاناله، فن ضدجرقه",
    materials: chemicals[0]?.commercialName || "نیتروژن صنعتی N2، حلال خنثی‌ساز شیمیایی",
    personnel_count: 4,
    competency: "گواهینامه کار در فضای بسته سطح ۳ و کمک‌های اولیه",
    duration_frequency: "۲ شیفت کاری - سالانه",
    simops: "عملیات داربست‌بندی مجاور روی پایپ‌رک هم‌جوار",
    operating_conditions: "دمای بالای ۳۸ درجه، رطوبت نسبی ۸۰٪، فضای محبوس",

    // Step 3: Hazard Identification
    hazard_domain: "safety" as "safety" | "health" | "environment" | "process",
    hazard_category: "گازهای سمی و خفه‌کننده در فضای محبوس",
    hazard_description: "حضور باقیمانده گاز سولفید هیدروژن (H2S) محبوس در رسوبات برج و کمبود اکسیژن زیر ۱۹.۵٪",

    // Step 4: Scenario Identification & Conceptual Distinction
    scenario_title: "نشت آنی H2S حین کاتالیست‌زدایی و مسمومیت اپراتور داخل برج",
    undesired_event: "افزایش ناگهانی غلظت گاز سمی H2S بیش از ۵۰ پی‌پی‌ام و بیهوشی اپراتورها",
    initiating_event: "ضربه مکانیکی ابزار به رسوبات لجن قیری و آزادسازی پاکت گاز محبوس",
    direct_causes: "عدم تهویه مناسب در عمق پکینگ‌ها و نقص در هم‌زدن آرام مواد ته‌نشین",
    root_causes: "فقدان سنسور تله‌متری آنلاین داخل فضای بسته و اتکا صرف به گازسنجی دهانه",
    escalation_factors: "قطر کم منهول ورودی (۲۴ اینچ) و تاخیر تیم امداد در استقرار سه‌پایه نجات",
    exposure_pathway: "استنشاق مستقیم گاز از طریق مجاری تنفسی در فضای بدون چرخش آزاد هوا",
    event_sequence: [
      "برخورد ابزار به توده رسوب کف برج",
      "انتشار گاز H2S با غلظت بالای ۱۰۰ ppm",
      "آلارم دتکتور و از دست رفتن هوشیاری اپراتور",
    ],

    // Step 5: Consequence Identification (HAER + Operational Continuity)
    consequence_human: "مسمومیت حاد تنفسی، ازکارافتادگی دائم یا احتمال فوت در صورت عدم تخلیه در ۳ دقیقه",
    consequence_asset: "خسارت فیزیکی محدود به ابزارهای دستی داخل برج (عدم انفجار)",
    consequence_env: "انتشار ناچیز کمتر از ۵ کیلوگرم H2S در محوطه با رقیق‌سازی سریع اتمسفری",
    consequence_rep: "پوشش خبری محلی، بازرسی وزارت کار و آسیب به اعتبار برند پتروشیمی",
    consequence_operational: "توقف فرآیند اورهال به مدت ۴ روز و عدم‌النفع تولید به ارزش ۲۵۰ هزار دلار",

    // Step 6: Existing Controls
    controls: [
      {
        description: "جداسازی فیزیکی خطوط با اسپید مثبت و قفل‌گذاری LOTO",
        hierarchy: "engineering" as const,
        control_type: "مهندسی حفاظتی",
        control_owner: "سرپرست شیفت فرآیند",
        inspection_frequency: "پیش از هر ورود",
        is_effective: true,
        effectiveness_evidence: "چک‌لیست امضاشده توسط بازرس فنی و تگ‌های زرد LOTO",
      },
      {
        description: "تهویه ممتد مکانیکی با بلوئر ضدجرقه مجهز به UPS اضطراری",
        hierarchy: "engineering" as const,
        control_type: "مهندسی",
        control_owner: "تکنسین ایمنی",
        inspection_frequency: "پیوسته در طول کار",
        is_effective: true,
        effectiveness_evidence: "ثبت دبی هوادهی در لاگ‌بوک نظارت",
      },
    ] as ControlEntry[],

    // Step 7: Initial Assessment (HAER + Operational)
    initial_human_l: 4,
    initial_human_s: 5,
    initial_asset_l: 2,
    initial_asset_s: 2,
    initial_env_l: 3,
    initial_env_s: 2,
    initial_rep_l: 4,
    initial_rep_s: 4,
    initial_op_l: 4,
    initial_op_s: 4,

    // Step 8: Current Assessment (HAER + Operational)
    current_human_l: 2,
    current_human_s: 5, // کاهش احتمال L به علت کنترل مهندسی، اما شدت S جانی بدون PPE همچنان ۵ است
    current_asset_l: 1,
    current_asset_s: 2,
    current_env_l: 1,
    current_env_s: 2,
    current_rep_l: 2,
    current_rep_s: 3,
    current_op_l: 2,
    current_op_s: 3,

    // Step 9: Treatment Actions (CAPA)
    treatments: [
      {
        action_description: "تجهیز برج به سنسور بی‌سیم تله‌متری آنلاین H2S با آلارم صوتی-نوری محلی منهول",
        hierarchy: "engineering" as const,
        priority: "high" as const,
        action_owner: personnel[0]?.fullName || "مهندس احمدی (رئیس ابزاردقیق)",
        due_date: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
        status: "in_progress" as const,
        completion_evidence: "سفارش خرید سنسور GasClip MDI",
        verification_result: "تست آزمایشی با گاز کالیبراسیون",
      },
      {
        action_description: "اجباری شدن ماسک هوارسان خطی فشار مثبت (Airline) با کپسول فرار ۱۰ دقیقه‌ای",
        hierarchy: "ppe" as const,
        priority: "urgent" as const,
        action_owner: personnel[1]?.fullName || "مهندس رضایی (افسر ایمنی)",
        due_date: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
        status: "completed" as const,
        completion_evidence: "تحویل ۴ ست تنفسی اسکات و برگه تست فیت",
        verification_result: "تایید سلامت سیلندر و تست هوز فشار قوی",
      },
    ] as TreatmentEntry[],

    // Step 10: Residual Assessment & Target
    residual_human_l: 1,
    residual_human_s: 3,
    residual_asset_l: 1,
    residual_asset_s: 1,
    residual_env_l: 1,
    residual_env_s: 1,
    residual_rep_l: 1,
    residual_rep_s: 2,
    residual_op_l: 1,
    residual_op_s: 2,

    // Step 11: Governance & Sign-off
    risk_acceptance_status: "acceptable",
    acceptance_authority: "شورای عالی حفاظت فنی و مدیر ارشد مجتمع",
    approval_notes: "تصویب با شرط حضور دائم مراقب منهول و تست گازسنجی هر ۲ ساعت یک‌بار",
    next_review_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
  });

  if (!isOpen) return null;

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateRpn = (l: number, s: number) => l * s;
  const getRpnLevel = (rpn: number) => {
    if (rpn <= 4) return { label: "کم (Low)", color: "bg-emerald-600 text-white" };
    if (rpn <= 9) return { label: "متوسط (Medium)", color: "bg-yellow-600 text-white" };
    if (rpn <= 15) return { label: "زیاد (High)", color: "bg-amber-600 text-white" };
    return { label: "بحرانی (Critical)", color: "bg-red-600 text-white" };
  };

  const stepsList = [
    { num: 1, title: "بستر سازمانی", icon: Building2 },
    { num: 2, title: "فعالیت و وظایف", icon: HardHat },
    { num: 3, title: "منبع خطر", icon: Flame },
    { num: 4, title: "سناریوی ریسک", icon: AlertTriangle },
    { num: 5, title: "تحلیل پیامدها (HAER)", icon: ShieldAlert },
    { num: 6, title: "کنترل‌های موجود", icon: Sliders },
    { num: 7, title: "ارزیابی اولیه (ذاتی)", icon: Activity },
    { num: 8, title: "ارزیابی جاری (با کنترل)", icon: Layers },
    { num: 9, title: "اقدامات تکمیلی (CAPA)", icon: CheckCircle2 },
    { num: 10, title: "ریسک باقیمانده و ALARP", icon: Sparkles },
    { num: 11, title: "حاکمیت، تایید و ردپا", icon: FileCheck },
  ];

  const handleAddJobStep = () => {
    if (formData.newStepInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        job_steps: [...prev.job_steps, prev.newStepInput.trim()],
        newStepInput: "",
      }));
    }
  };

  const handleRemoveJobStep = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      job_steps: prev.job_steps.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmitAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        context: {
          organization: organizationId,
          register_code: formData.register_code,
          title: formData.title || `ارزیابی ریسک ${formData.activity_title}`,
          project_name: formData.project_name,
          department: formData.department,
          site_location: formData.site_location,
          area: formData.area,
          project_phase: formData.project_phase,
          operation_type: formData.operation_type,
          client_name: formData.client_name,
          contractor_name: formData.contractor_name,
        },
        activity: {
          activity_title: formData.activity_title,
          activity_description: formData.activity_description,
          task_name: formData.task_name,
          job_steps: formData.job_steps,
          work_method: formData.work_method,
          equipment: formData.equipment,
          materials: formData.materials,
          personnel_count: formData.personnel_count,
          competency: formData.competency,
          duration_frequency: formData.duration_frequency,
          simops: formData.simops,
          operating_conditions: formData.operating_conditions,
        },
        hazard: {
          domain: formData.hazard_domain,
          category: formData.hazard_category,
          description: formData.hazard_description,
        },
        scenario: {
          scenario_title: formData.scenario_title,
          undesired_event: formData.undesired_event,
          initiating_event: formData.initiating_event,
          direct_causes: formData.direct_causes,
          root_causes: formData.root_causes,
          escalation_factors: formData.escalation_factors,
          exposure_pathway: formData.exposure_pathway,
          event_sequence: formData.event_sequence,
        },
        controls: formData.controls,
        initial_scores: [
          { dimension: "human", likelihood: formData.initial_human_l, severity: formData.initial_human_s },
          { dimension: "asset", likelihood: formData.initial_asset_l, severity: formData.initial_asset_s },
          { dimension: "environment", likelihood: formData.initial_env_l, severity: formData.initial_env_s },
          { dimension: "reputation", likelihood: formData.initial_rep_l, severity: formData.initial_rep_s },
          { dimension: "operational", likelihood: formData.initial_op_l, severity: formData.initial_op_s },
        ],
        current_scores: [
          { dimension: "human", likelihood: formData.current_human_l, severity: formData.current_human_s },
          { dimension: "asset", likelihood: formData.current_asset_l, severity: formData.current_asset_s },
          { dimension: "environment", likelihood: formData.current_env_l, severity: formData.current_env_s },
          { dimension: "reputation", likelihood: formData.current_rep_l, severity: formData.current_rep_s },
          { dimension: "operational", likelihood: formData.current_op_l, severity: formData.current_op_s },
        ],
        residual_scores: [
          { dimension: "human", likelihood: formData.residual_human_l, severity: formData.residual_human_s, target_rpn: 3 },
          { dimension: "asset", likelihood: formData.residual_asset_l, severity: formData.residual_asset_s, target_rpn: 1 },
          { dimension: "environment", likelihood: formData.residual_env_l, severity: formData.residual_env_s, target_rpn: 1 },
          { dimension: "reputation", likelihood: formData.residual_rep_l, severity: formData.residual_rep_s, target_rpn: 2 },
          { dimension: "operational", likelihood: formData.residual_op_l, severity: formData.residual_op_s, target_rpn: 2 },
        ],
        treatments: formData.treatments,
        governance: {
          risk_acceptance_status: formData.risk_acceptance_status,
          acceptance_authority: formData.acceptance_authority,
          approval_notes: formData.approval_notes,
          next_review_date: formData.next_review_date,
        },
      };

      await createFullRiskRegister(payload);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در ثبت پرونده جامع ۱۱ مرحله‌ای ارزیابی ریسک");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl max-h-[92vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden text-white font-farsi">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-100">
                  استودیوی تدوین رجیستر ریسک (استاندارد ۱۱ مرحله‌ای)
                </h2>
                <PaperBadge variant="amber" size="sm">
                  {formData.register_code}
                </PaperBadge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                فاز ۱: موتور یکپارچه مدیریت ریسک با مدل ابعاد ۴ گانه پیامد (HAER) و اتصال زنجیره ردیابی
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 11 Steps Interactive Nav Bar */}
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-800/80 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max">
            {stepsList.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.num;
              const isPassed = currentStep > step.num;

              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-amber-600 text-white shadow-md font-bold scale-102"
                      : isPassed
                      ? "bg-slate-800/80 text-emerald-300 hover:bg-slate-800"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/20 font-mono">
                    {step.num}
                  </span>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-950/60 border border-red-800 rounded-2xl text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Assessment Context */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۱: اطلاعات سازمانی و محدوده ارزیابی (Assessment Context)</h3>
                <p className="text-xs text-slate-400">اتصال مستقیم به مرجع واحد اطلاعات پایه سازمانی بدون افزونگی داده</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">کد پرونده ارزیابی</label>
                  <input
                    type="text"
                    value={formData.register_code}
                    onChange={(e) => updateField("register_code", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">عنوان ارزیابی ریسک</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="مثال: ارزیابی ریسک کاتالیست‌زدایی برج تقطیر"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">پروژه (منبع داده مشترک)</label>
                  <select
                    value={formData.project_name}
                    onChange={(e) => updateField("project_name", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                    <option value="سایر پروژه‌ها">سایر پروژه‌ها (ورود دستی)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">محل اجرا (سایت)</label>
                  <select
                    value={formData.site_location}
                    onChange={(e) => updateField("site_location", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">بخش / ناحیه عملیاتی</label>
                  <select
                    value={formData.area}
                    onChange={(e) => updateField("area", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">واحد سازمانی متولی</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => updateField("department", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">فاز پروژه</label>
                  <input
                    type="text"
                    value={formData.project_phase}
                    onChange={(e) => updateField("project_phase", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">کارفرمای اصلی</label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => updateField("client_name", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">پیمانکار مجری (مرجع داده)</label>
                  <select
                    value={formData.contractor_name}
                    onChange={(e) => updateField("contractor_name", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  >
                    {contractors.map((c) => (
                      <option key={c.id} value={c.companyName}>
                        {c.companyName} (رتبه HSE: {c.hseGrade})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Activity & Task Identification */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۲: شناسایی فعالیت و وظایف (Activity & Tasks)</h3>
                <p className="text-xs text-slate-400">ثبت شرح فعالیت، گام‌های تفکیکی کار، تجهیزات و صلاحیت‌های لازم</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">عنوان فعالیت اصلی (Activity)</label>
                  <input
                    type="text"
                    value={formData.activity_title}
                    onChange={(e) => updateField("activity_title", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">وظیفه مشخص (Task)</label>
                  <input
                    type="text"
                    value={formData.task_name}
                    onChange={(e) => updateField("task_name", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs mb-1">شرح جامع فعالیت</label>
                <textarea
                  rows={2}
                  value={formData.activity_description}
                  onChange={(e) => updateField("activity_description", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                />
              </div>

              {/* Dynamic Job Steps */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>مراحل انجام کار به تفکیک گام‌ها (Job Steps):</span>
                  <span className="text-[11px] text-slate-400">{formData.job_steps.length} گام ثبت‌شده</span>
                </div>

                <div className="space-y-2">
                  {formData.job_steps.map((step, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-slate-900 rounded-xl text-xs border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 text-[10px] flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span className="text-slate-200">{step}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveJobStep(idx)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={formData.newStepInput}
                    onChange={(e) => updateField("newStepInput", e.target.value)}
                    placeholder="افزودن مرحله جدید..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddJobStep();
                      }
                    }}
                  />
                  <PaperButton variant="secondary" size="sm" onClick={handleAddJobStep}>
                    <Plus className="w-3.5 h-3.5" /> افزودن گام
                  </PaperButton>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">تجهیزات مصرفی</label>
                  <input
                    type="text"
                    value={formData.equipment}
                    onChange={(e) => updateField("equipment", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">مواد مصرفی و شیمیایی</label>
                  <input
                    type="text"
                    value={formData.materials}
                    onChange={(e) => updateField("materials", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">تعداد نفرات درگیر</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.personnel_count}
                    onChange={(e) => updateField("personnel_count", Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">شایستگی و صلاحیت افراد</label>
                  <input
                    type="text"
                    value={formData.competency}
                    onChange={(e) => updateField("competency", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">فعالیت‌های هم‌زمان (SIMOPS)</label>
                  <input
                    type="text"
                    value={formData.simops}
                    onChange={(e) => updateField("simops", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">شرایط محیطی و عملیاتی</label>
                  <input
                    type="text"
                    value={formData.operating_conditions}
                    onChange={(e) => updateField("operating_conditions", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Hazard Identification */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۳: شناسایی منابع خطر (Hazard Identification)</h3>
                <p className="text-xs text-slate-400">تفکیک حوزه‌های ایمنی، بهداشت حرفه‌ای، محیط زیست و ایمنی فرآیند</p>
              </div>

              <div>
                <label className="block text-slate-300 text-xs mb-2">حوزه اصلی خطر (Hazard Domain)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "safety", label: "ایمنی (Safety)", icon: "⚠️" },
                    { id: "health", label: "بهداشت شغلی (Health)", icon: "🩺" },
                    { id: "environment", label: "محیط زیست (Environment)", icon: "🌱" },
                    { id: "process", label: "ایمنی فرآیند (Process)", icon: "⚡" },
                  ].map((dom) => (
                    <button
                      key={dom.id}
                      type="button"
                      onClick={() => updateField("hazard_domain", dom.id)}
                      className={`p-3 rounded-2xl border text-xs text-right transition-all flex flex-col justify-between ${
                        formData.hazard_domain === dom.id
                          ? "bg-amber-600/30 border-amber-500 text-amber-200 font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      <span className="text-xl mb-1">{dom.icon}</span>
                      <span>{dom.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">دسته‌بندی خطر</label>
                  <input
                    type="text"
                    value={formData.hazard_category}
                    onChange={(e) => updateField("hazard_category", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">شرح منبع خطر (Hazard Description)</label>
                  <textarea
                    rows={3}
                    value={formData.hazard_description}
                    onChange={(e) => updateField("hazard_description", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Risk Scenario Identification & Distinction */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۴: تدوین سناریوی ریسک و تفکیک مفهومی</h3>
                <p className="text-xs text-slate-400">تبدیل خطر به سناریوی عینی، علل مستقیم، ریشه‌ای، عوامل تشدید و مسیر مواجهه</p>
              </div>

              {/* 4-way Conceptual Distinction Box */}
              <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-2xl space-y-2">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>الگوی تفکیک مفهومی ۴ مرحله‌ای (طراحی معماری سیستم)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold block mb-1">۱. منبع خطر:</span>
                    <span className="text-slate-300">{formData.hazard_category}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold block mb-1">۲. رویداد ناخواسته:</span>
                    <span className="text-slate-300">{formData.undesired_event || "رخداد حادثه"}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold block mb-1">۳. سناریوی ریسک:</span>
                    <span className="text-slate-300">{formData.scenario_title}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold block mb-1">۴. پیامد نهایی:</span>
                    <span className="text-slate-300">{formData.consequence_human}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">عنوان سناریو (Scenario Title)</label>
                  <input
                    type="text"
                    value={formData.scenario_title}
                    onChange={(e) => updateField("scenario_title", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">رویداد آغازگر (Initiating Event)</label>
                  <input
                    type="text"
                    value={formData.initiating_event}
                    onChange={(e) => updateField("initiating_event", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">شرح رویداد ناخواسته (Undesired Event)</label>
                  <textarea
                    rows={2}
                    value={formData.undesired_event}
                    onChange={(e) => updateField("undesired_event", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">علل مستقیم (Direct Causes)</label>
                  <textarea
                    rows={2}
                    value={formData.direct_causes}
                    onChange={(e) => updateField("direct_causes", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">علل ریشه‌ای یا زمینه‌ای (Root Causes)</label>
                  <input
                    type="text"
                    value={formData.root_causes}
                    onChange={(e) => updateField("root_causes", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">عوامل تشدیدکننده (Escalation Factors)</label>
                  <input
                    type="text"
                    value={formData.escalation_factors}
                    onChange={(e) => updateField("escalation_factors", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Consequence Identification (HAER + Operational) */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۵: شناسایی و تحلیل ابعاد پیامدها (HAER Framework)</h3>
                <p className="text-xs text-slate-400">تفکیک مستقل ابعاد چهارگانه و جداسازی خسارت دارایی از تداوم عملیات (Operational Continuity)</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-950 border border-red-500/40 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-red-400">بُعد انسانی - H (Human)</span>
                    <span className="text-[10px] bg-red-950 text-red-300 px-2 py-0.5 rounded">جراحت، بیماری، فوت</span>
                  </div>
                  <textarea
                    rows={2}
                    value={formData.consequence_human}
                    onChange={(e) => updateField("consequence_human", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                  />
                </div>

                <div className="p-3 bg-slate-950 border border-blue-500/40 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-blue-400">بُعد دارایی فیزیکی - A (Asset)</span>
                    <span className="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded">خسارت به تجهیزات و تأسیسات</span>
                  </div>
                  <textarea
                    rows={2}
                    value={formData.consequence_asset}
                    onChange={(e) => updateField("consequence_asset", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                  />
                </div>

                <div className="p-3 bg-slate-950 border border-emerald-500/40 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-emerald-400">بُعد محیط زیست - E (Environment)</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded">آلودگی آب، خاک، هوا</span>
                  </div>
                  <textarea
                    rows={2}
                    value={formData.consequence_env}
                    onChange={(e) => updateField("consequence_env", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                  />
                </div>

                <div className="p-3 bg-slate-950 border border-purple-500/40 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-purple-400">بُعد اعتبار سازمانی - R (Reputation)</span>
                    <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded">اعتبار، رسانه، مشتریان</span>
                  </div>
                  <textarea
                    rows={2}
                    value={formData.consequence_rep}
                    onChange={(e) => updateField("consequence_rep", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                  />
                </div>
              </div>

              {/* Independent Operational Continuity Dimension */}
              <div className="p-4 bg-slate-950 border border-amber-500/50 rounded-2xl text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-amber-400">⚡ بُعد مستقل تداوم عملیات و توقف تولید (Operational Continuity - O)</span>
                  <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded">بدون خلط بی‌معیار با خسارت دارایی</span>
                </div>
                <textarea
                  rows={2}
                  value={formData.consequence_operational}
                  onChange={(e) => updateField("consequence_operational", e.target.value)}
                  placeholder="مدت توقف خط تولید، عدم‌النفع مالی ناشی از قطعی فرآیند..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                />
              </div>
            </div>
          )}

          {/* STEP 6: Existing Controls */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۶: شناسایی کنترل‌های موجود و سلسله‌مراتب کنترل</h3>
                <p className="text-xs text-slate-400">Hierarchy of Controls, Control Ownership & Evidence</p>
              </div>

              <div className="space-y-3">
                {formData.controls.map((ctrl, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">کنترل شماره {idx + 1}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono text-[11px]">
                        {ctrl.hierarchy.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-slate-100">{ctrl.description}</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                      <div>مسئول کنترل: {ctrl.control_owner}</div>
                      <div>تناوب بازرسی: {ctrl.inspection_frequency}</div>
                      <div className="col-span-2">شواهد اثربخشی: <span className="text-emerald-400">{ctrl.effectiveness_evidence}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: Initial Risk Assessment */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۷: ارزیابی ریسک اولیه - ذاتی (بدون هیچ‌گونه کنترل)</h3>
                <p className="text-xs text-slate-400">محاسبه عدد اولویت ریسک RPN = L × S بر مبنای ماتریس ۵×۵</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { key: "human", label: "انسانی (H)", l: formData.initial_human_l, s: formData.initial_human_s, lKey: "initial_human_l", sKey: "initial_human_s" },
                  { key: "asset", label: "دارایی (A)", l: formData.initial_asset_l, s: formData.initial_asset_s, lKey: "initial_asset_l", sKey: "initial_asset_s" },
                  { key: "env", label: "محیط زیست (E)", l: formData.initial_env_l, s: formData.initial_env_s, lKey: "initial_env_l", sKey: "initial_env_s" },
                  { key: "rep", label: "اعتبار (R)", l: formData.initial_rep_l, s: formData.initial_rep_s, lKey: "initial_rep_l", sKey: "initial_rep_s" },
                  { key: "op", label: "تداوم عملیات (O)", l: formData.initial_op_l, s: formData.initial_op_s, lKey: "initial_op_l", sKey: "initial_op_s" },
                ].map((dim) => {
                  const rpn = calculateRpn(dim.l, dim.s);
                  const lvl = getRpnLevel(rpn);
                  return (
                    <div key={dim.key} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-2">
                      <div className="font-bold text-slate-200">{dim.label}</div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>احتمال (L): {dim.l}</span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={dim.l}
                          onChange={(e) => updateField(dim.lKey, Number(e.target.value))}
                          className="w-16 accent-amber-500"
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>شدت (S): {dim.s}</span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={dim.s}
                          onChange={(e) => updateField(dim.sKey, Number(e.target.value))}
                          className="w-16 accent-amber-500"
                        />
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span className="font-mono text-base font-black text-amber-300">RPN: {rpn}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${lvl.color}`}>
                          {lvl.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 8: Current Risk Assessment */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۸: ارزیابی ریسک جاری (با لحاظ کنترل‌های موجود)</h3>
                <p className="text-xs text-slate-400">
                  تمایز اثر کنترلی: کنترلهای پیشگیرانه احتمال (L) را کاهش می‌دهند و کنترلهای حفاظتی شدت (S) را تعدیل می‌کنند
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { key: "human", label: "انسانی (H)", l: formData.current_human_l, s: formData.current_human_s, lKey: "current_human_l", sKey: "current_human_s", initRpn: calculateRpn(formData.initial_human_l, formData.initial_human_s) },
                  { key: "asset", label: "دارایی (A)", l: formData.current_asset_l, s: formData.current_asset_s, lKey: "current_asset_l", sKey: "current_asset_s", initRpn: calculateRpn(formData.initial_asset_l, formData.initial_asset_s) },
                  { key: "env", label: "محیط زیست (E)", l: formData.current_env_l, s: formData.current_env_s, lKey: "current_env_l", sKey: "current_env_s", initRpn: calculateRpn(formData.initial_env_l, formData.initial_env_s) },
                  { key: "rep", label: "اعتبار (R)", l: formData.current_rep_l, s: formData.current_rep_s, lKey: "current_rep_l", sKey: "current_rep_s", initRpn: calculateRpn(formData.initial_rep_l, formData.initial_rep_s) },
                  { key: "op", label: "تداوم عملیات (O)", l: formData.current_op_l, s: formData.current_op_s, lKey: "current_op_l", sKey: "current_op_s", initRpn: calculateRpn(formData.initial_op_l, formData.initial_op_s) },
                ].map((dim) => {
                  const rpn = calculateRpn(dim.l, dim.s);
                  const lvl = getRpnLevel(rpn);
                  return (
                    <div key={dim.key} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-2">
                      <div className="font-bold text-slate-200">{dim.label}</div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>احتمال (L): {dim.l}</span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={dim.l}
                          onChange={(e) => updateField(dim.lKey, Number(e.target.value))}
                          className="w-16 accent-amber-500"
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>شدت (S): {dim.s}</span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={dim.s}
                          onChange={(e) => updateField(dim.sKey, Number(e.target.value))}
                          className="w-16 accent-amber-500"
                        />
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span className="font-mono text-base font-black text-amber-300">RPN: {rpn}</span>
                        <span className="text-[10px] text-slate-400 font-mono">از {dim.initRpn}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${lvl.color}`}>
                          {lvl.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 9: Risk Treatment Actions (CAPA) */}
          {currentStep === 9 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۹: اقدامات تکمیلی و کاهش ریسک (Treatment Actions - CAPA)</h3>
                <p className="text-xs text-slate-400">پیاده‌سازی اقدامات اصلاحی مبتنی بر سلسله‌مراتب کنترل و اتصال به زنجیره ردیابی</p>
              </div>

              <div className="space-y-3">
                {formData.treatments.map((treat, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">اقدام اصلاحی شماره {idx + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold text-[10px]">
                          اولویت: {treat.priority.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold text-[10px]">
                          وضعیت: {treat.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-slate-100 font-semibold">{treat.action_description}</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                      <div>مسئول اقدام: {treat.action_owner}</div>
                      <div>مهلت انجام: {treat.due_date}</div>
                      <div>مدرک تکمیل: <span className="text-emerald-400">{treat.completion_evidence}</span></div>
                      <div>راستی‌آزمایی: <span className="text-blue-400">{treat.verification_result}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 10: Residual Risk & ALARP Target */}
          {currentStep === 10 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۱۰: ارزیابی ریسک باقیمانده و هدف ALARP</h3>
                <p className="text-xs text-slate-400">Residual Likelihood, Severity, RPN and Target ALARP Verification</p>
              </div>

              <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-300 font-semibold">وضعیت پس از اعمال اقدامات تکمیلی:</div>
                  <div className="text-base font-extrabold text-emerald-200">کاملاً در محدوده قابل قبول (Broadly Acceptable)</div>
                </div>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  هدف ALARP: محقق‌شده
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { key: "human", label: "انسانی (H)", l: formData.residual_human_l, s: formData.residual_human_s, lKey: "residual_human_l", sKey: "residual_human_s" },
                  { key: "asset", label: "دارایی (A)", l: formData.residual_asset_l, s: formData.residual_asset_s, lKey: "residual_asset_l", sKey: "residual_asset_s" },
                  { key: "env", label: "محیط زیست (E)", l: formData.residual_env_l, s: formData.residual_env_s, lKey: "residual_env_l", sKey: "residual_env_s" },
                  { key: "rep", label: "اعتبار (R)", l: formData.residual_rep_l, s: formData.residual_rep_s, lKey: "residual_rep_l", sKey: "residual_rep_s" },
                  { key: "op", label: "تداوم عملیات (O)", l: formData.residual_op_l, s: formData.residual_op_s, lKey: "residual_op_l", sKey: "residual_op_s" },
                ].map((dim) => {
                  const rpn = calculateRpn(dim.l, dim.s);
                  const lvl = getRpnLevel(rpn);
                  return (
                    <div key={dim.key} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-2">
                      <div className="font-bold text-slate-200">{dim.label}</div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>احتمال (L): {dim.l}</span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={dim.l}
                          onChange={(e) => updateField(dim.lKey, Number(e.target.value))}
                          className="w-16 accent-emerald-500"
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>شدت (S): {dim.s}</span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={dim.s}
                          onChange={(e) => updateField(dim.sKey, Number(e.target.value))}
                          className="w-16 accent-emerald-500"
                        />
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span className="font-mono text-base font-black text-emerald-300">RPN: {rpn}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${lvl.color}`}>
                          {lvl.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 11: Approval, Governance & Traceability */}
          {currentStep === 11 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">مرحله ۱۱: حاکمیت، تاییدیه نهایی و ردپای ممیزی یکپارچه</h3>
                <p className="text-xs text-slate-400">Approval, Governance & Audit Trail Chaining</p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300 font-bold">
                  <GitBranch className="w-4 h-4 text-blue-400" />
                  <span>کد شناسه ردپای یکپارچه ردیابی (Traceability Chain):</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl font-mono text-amber-400 text-xs border border-slate-800">
                  TRC-RSK-{formData.register_code.replace("RR-", "")}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">وضعیت پذیرش ریسک</label>
                  <select
                    value={formData.risk_acceptance_status}
                    onChange={(e) => updateField("risk_acceptance_status", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  >
                    <option value="acceptable">قابل قبول (Acceptable)</option>
                    <option value="tolerable_alarp">قابل تحمل در محدوده ALARP (Tolerable)</option>
                    <option value="unacceptable">غیرقابل قبول (Unacceptable)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">مرجع یا شخص تاییدکننده</label>
                  <input
                    type="text"
                    value={formData.acceptance_authority}
                    onChange={(e) => updateField("acceptance_authority", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">موعد بازنگری دوره‌ای بعدی</label>
                  <input
                    type="date"
                    value={formData.next_review_date}
                    onChange={(e) => updateField("next_review_date", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">توضیحات و شروط تصویب</label>
                  <input
                    type="text"
                    value={formData.approval_notes}
                    onChange={(e) => updateField("approval_notes", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/90">
          <PaperButton
            type="button"
            variant="secondary"
            size="sm"
            disabled={currentStep === 1 || loading}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
          >
            <ChevronRight className="w-4 h-4 ml-1" /> گام قبلی
          </PaperButton>

          <span className="text-xs text-slate-400 font-mono">
            گام {currentStep} از ۱۱ ({stepsList[currentStep - 1]?.title})
          </span>

          {currentStep < 11 ? (
            <PaperButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setCurrentStep((prev) => Math.min(11, prev + 1))}
            >
              گام بعدی <ChevronLeft className="w-4 h-4 mr-1" />
            </PaperButton>
          ) : (
            <PaperButton
              type="button"
              variant="primary"
              size="sm"
              disabled={loading}
              onClick={handleSubmitAll}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold"
            >
              {loading ? "در حال ایجاد و صدور..." : "ثبت و صدور نهایی پرونده ۱۱ مرحله‌ای ✓"}
            </PaperButton>
          )}
        </div>
      </div>
    </div>
  );
};
