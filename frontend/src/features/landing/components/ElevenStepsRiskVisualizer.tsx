import React, { useState } from "react";
import { PaperBadge, PaperButton, PaperCard } from "../../../core/design-system/UIPrimitives";
import type { CompleteRiskRegisterRecord } from "../../../core/contracts/riskRegister11Steps";

// نمونه صنعتی جامع ثبت‌شده در رجیستر پتروشیمی پارس
const SAMPLE_PETRO_REGISTER: CompleteRiskRegisterRecord = {
  id: "RR-PETRO-2026-001",
  step1Context: {
    companyName: "شرکت صنایع پتروشیمی پارس جنوبی",
    department: "بهره‌برداری و تعمیرات اساسی (Overhaul)",
    projectName: "اورهال جامع سالانه فاز ۴ و ۵",
    siteLocation: "منطقه ویژه اقتصادی انرژی پارس - عسلویه",
    area: "واحد تفکیک و تثبیت میعانات گازی (Unit 102)",
    projectPhase: "عملیات اجرایی اورهال",
    operationType: "تعمیرات متوقف (Shutdown Maintenance)",
    client: "شرکت ملی گاز ایران",
    contractor: "مهندسی و توسعه سازه‌های صنعتی دماوند",
  },
  step2Activity: {
    activity: "تخلیه کاتالیست و بازرسی داخلی برج تفکیک C-102",
    activityDescription: "ورود به فضای بسته برج تفکیک جهت بازرسی ضخامت‌سنجی بدنه و تعویض تری‌های آسیب‌دیده",
    task: "ورود به فضای بسته (Confined Space Entry) و شستشوی شیمیایی",
    jobSteps: [
      "جداسازی، ایزولاسیون مکانیکی (بلندینگ) و قطع الکتریکی (LOTO)",
      "تخلیه، شستشو با بخار و تهویه مکانیکی با بلوئر اجکتور",
      "آزمون گازسنجی مداوم اکسیژن، LEL و H2S",
      "اخذ مجوز ورود به فضای بسته (Permit to Work - CSE)",
      "ورود تیم تخصصی با تجهیزات حفاظت تنفسی و طناب نجات",
    ],
    workMethod: "رویه اجرایی شماره SOP-PR-102-CS و الزامات دستورالعمل ایمنی فضای بسته",
    equipment: ["دتکتور گاز ۴ کاناله پرتابل", "فن دمنده ضدجرقه (Ex Air Mover)", "سه‌پایه و وینچ نجات با هارنس تمام‌بدن"],
    materials: ["حلال شیمیایی اسیدی شستشو", "گاز نیتروژن N2 برای پرج اولیه"],
    numberOfPersonnel: 4,
    competency: "گواهی‌نامه کار در فضای بسته سطح ۳، تاییدیه بازرسی فنی، آموزش کمک‌های اولیه",
    durationFrequency: "۲ شیفت کاری ۸ ساعته - سالانه یک‌بار در دوره تعمیرات اساسی",
    simops: "عملیات داربست‌بندی مجاور در فلنچ فوقانی برج C-102 (هم‌زمان)",
    operatingConditions: "دمای محیط ۴۱ درجه سانتی‌گراد، رطوبت نسبی ۷۵٪، فضای کاملاً محبوس",
  },
  step3Hazard: {
    domain: "safety",
    domainDisplay: "ایمنی فرآیند و فضای بسته",
    category: "گازهای سمی و خفه‌کننده در فضای محبوس",
    hazardDescription: "حضور گاز سولفید هیدروژن (H2S) باقی‌مانده در پکینگ‌ها و افت غلظت اکسیژن کمتر از ۱۹.۵٪",
    examples: ["گاز H2S حبس‌شده در رسوبات قیری", "اتمسفر ناکافی ناشی از پرج نیتروژن بدون تهویه کافی"],
  },
  step4Scenario: {
    scenarioTitle: "نشت H2S از رسوبات تحتانی و خفگی نفرات حاضر در فضای بسته برج C-102",
    undesiredEvent: "افزایش ناگهانی غلظت H2S فراتر از 50 ppm و بیهوشی اپراتورها",
    initiatingEvent: "تخلیه مکانیکی رسوبات ته‌نشین‌شده با ضربه و آزاد شدن پاکت گاز محبوس",
    directCauses: [
      "عدم هم‌زدن آرام یا عدم خنثی‌سازی شیمیایی رسوبات قبل از ورود",
      "از کار افتادن موقت دمنده تهویه مکانیکی ناشی از نوسان برق ژنراتور کارگاه",
    ],
    rootCauses: [
      "نقص در دستورالعمل ارزیابی ریسک مواد ته‌نشین در برج‌های تفکیک قدیمی",
      "عدم پایش مستمر آنلاین در عمق پکینگ‌ها و اتکا صرف به تست گاز دهانه منهول",
    ],
    escalationFactors: [
      "شرایط سخت خروج از منهول با قطر کوچک (24 اینچ)",
      "تأخیر تیم نجات مستقر در خارج منهول در راه‌اندازی سه‌پایه نجات",
    ],
    eventSequence: [
      "برخورد ابزار تمیزکاری به توده لجن پکینگ",
      "انتشار آنی گاز H2S با غلظت بیش از 100 ppm",
      "آلارم دتکتور فردی و فلج عصب بویایی",
      "سقوط اپراتور اول بر روی تری شماره ۱۲",
    ],
    scenarioConditions: "دمای داخل برج بالاتر از محیط، تهویه طبیعی ناممکن به علت تک‌منهول باز بودن بخش میانی",
    exposurePathway: "استنشاق مستقیم از طریق مجاری تنفسی در فضای بدون گردش آزاد هوا",
    conceptualDistinction: {
      hazard: "حضور گاز سولفید هیدروژن (H2S) محبوس در برج (منبع خطر)",
      event: "آزادسازی آنی گاز سمی در فضای بسته (رویداد ناخواسته)",
      scenario: "آزادسازی گاز هنگام کاتالیست‌زدایی، افت هوشیاری اپراتور و ناتوانی در خروج (سناریوی ریسک)",
      consequence: "آسیب تنفسی شدید یا فوت بر اثر مسمومیت حاد و خفگی (پیامد)",
    },
  },
  step5Consequences: {
    human: {
      code: "H",
      label: "انسانی",
      description: "مسمومیت شدید تنفسی، احتمال فوت اپراتور یا ازکارافتادگی دائم (شدت ۵)",
    },
    asset: {
      code: "A",
      label: "دارایی و تجهیزات",
      description: "آسیب تجهیزاتی اندک به دلیل عدم انفجار، صرفاً خسارت ابزارهای داخل برج (شدت ۱)",
    },
    environment: {
      code: "E",
      label: "محیط زیست",
      description: "نشت محدود کمتر از ۱۰ کیلوگرم در محیط محصور پالایشگاه با جذب اتمسفری سریع (شدت ۲)",
    },
    reputation: {
      code: "R",
      label: "اعتبار و روابط عمومی",
      description: "پوشش خبری رسانه‌ای در صورت فوت، بازرسی وزارت کار و افت اعتبار برند سازمان (شدت ۴)",
    },
    operationalContinuity: {
      code: "O",
      label: "تداوم عملیات و توقف تولید",
      description: "توقف فرآیند اورهال به مدت ۵ روز، تأخیر در استارت‌آپ پالایشگاه به ارزش ۳۰۰ هزار دلار بدون آسیب به سازه اصلی",
      isIndependentDimension: true,
    },
  },
  step6Controls: [
    {
      controlDescription: "جداسازی فیزیکی با نصب صفحات مسدودکننده (Positive Spading & Blind Flange)",
      controlType: "پیشگیرانه فیزیکی",
      hierarchyOfControl: "engineering",
      hierarchyDisplay: "کنترل مهندسی",
      controlOwner: "سرپرست نوبت‌کاری واحد فرآیند",
      inspectionFrequency: "قبل از صدور مجوز ورود",
      implementationStatus: "implemented",
      isEffective: true,
      effectivenessEvidence: "چک‌لیست امضاشده توسط بازرس فنی و تگ‌گذاری LOTO زرد",
    },
    {
      controlDescription: "تهویه مکانیکی ممتد با بلوئر ضدجرقه مجهز به منبع تغذیه برق اضطراری مستقل (UPS)",
      controlType: "پیشگیرانه مهندسی",
      hierarchyOfControl: "engineering",
      hierarchyDisplay: "کنترل مهندسی",
      controlOwner: "تکنسین تأسیسات ایمنی",
      inspectionFrequency: "مستمر در طول شیفت",
      implementationStatus: "implemented",
      isEffective: true,
      effectivenessEvidence: "ثبت دبی هوادهی 2500 CFM در لاگ‌بوک نظارت ایمنی",
    },
    {
      controlDescription: "مجوز رسمی کار در فضای بسته (PTW-CSE) و نظارت یک‌به‌یک مراقب منهول (Standby Man)",
      controlType: "کنترل مدیریتی و اجرایی",
      hierarchyOfControl: "administrative",
      hierarchyDisplay: "کنترل مدیریتی",
      controlOwner: "افسر ایمنی پروژه",
      inspectionFrequency: "هر ۴ ساعت یک‌بار",
      implementationStatus: "implemented",
      isEffective: true,
      effectivenessEvidence: "فرم ثبت حضور و غیاب ورود/خروج منهول با شماره ثبت روزانه",
    },
    {
      controlDescription: "استفاده از ماسک تنفسی هوارسان فشار مثبت (Airline Mask) به همراه کپسول فرار ۱۰ دقیقه‌ای",
      controlType: "تجهیزات حفاظت فردی",
      hierarchyOfControl: "ppe",
      hierarchyDisplay: "تجهیزات حفاظت فردی (PPE)",
      controlOwner: "نفرات اجرایی داخل برج",
      inspectionFrequency: "بررسی قبل از هر نوبت ورود",
      implementationStatus: "implemented",
      isEffective: true,
      effectivenessEvidence: "تست فیت‌پاس کالیبراسیون ماسک و فشارسنجی کپسول‌های اکسیژن ۳۰۰ بار",
    },
  ],
  step7InitialRisk: {
    scores: {
      H: { dimension: "human", dimensionLabel: "انسانی", likelihood: 4, severity: 5, rpn: 20, level: "critical" },
      A: { dimension: "asset", dimensionLabel: "دارایی", likelihood: 2, severity: 2, rpn: 4, level: "low" },
      E: { dimension: "environment", dimensionLabel: "محیط زیست", likelihood: 3, severity: 2, rpn: 6, level: "medium" },
      R: { dimension: "reputation", dimensionLabel: "اعتبار", likelihood: 4, severity: 4, rpn: 16, level: "high" },
    },
    overallInitialRpn: 20,
    overallInitialLevel: "critical",
  },
  step8CurrentRisk: {
    scores: {
      H: { dimension: "human", dimensionLabel: "انسانی", likelihood: 2, severity: 5, rpn: 10, level: "medium" },
      A: { dimension: "asset", dimensionLabel: "دارایی", likelihood: 1, severity: 2, rpn: 2, level: "low" },
      E: { dimension: "environment", dimensionLabel: "محیط زیست", likelihood: 1, severity: 2, rpn: 2, level: "low" },
      R: { dimension: "reputation", dimensionLabel: "اعتبار", likelihood: 2, severity: 3, rpn: 6, level: "medium" },
    },
    overallCurrentRpn: 10,
    overallCurrentLevel: "medium",
    effectNotes: "کنترل‌های مهندسی (بلندینگ و بلوئر دائم) احتمال وقوع L را از ۴ به ۲ کاهش داده‌اند، اما در صورت رخداد، پتانسیل پیامد جانی S همچنان بالا (۵) است.",
  },
  step9Treatment: [
    {
      actionDescription: "تجهیز برج به سنسور بی‌سیم تله‌متری آنلاین H2S متصل به نمایشگر اتاق کنترل و آژیر محلی منهول",
      actionType: "preventive",
      hierarchyLevel: "engineering",
      priority: "high",
      actionOwner: "رئیس ابزار دقیق و تله‌متری",
      dueDate: "۱۴۰۵/۰۲/۱۵",
      actionStatus: "completed",
      completionEvidence: "نصب و کالیبراسیون سنسور GasClip MDI با دیتالاگر بی‌سیم",
      verificationResult: "راستی‌آزمایی در شبیه‌سازی آلارم با گاز تست آزمایشی موفق",
    },
    {
      actionDescription: "مانور نجات اضطراری از فضای بسته قبل از آغاز فاز برشکاری و بازآموزی تیم امداد نجات پالایشگاه",
      actionType: "mitigative",
      hierarchyLevel: "administrative",
      priority: "high",
      actionOwner: "فرمانده آتش‌نشانی و امداد نجات",
      dueDate: "۱۴۰۵/۰۲/۱۸",
      actionStatus: "verified",
      completionEvidence: "گزارش مصور مانور و ثبت زمان تخلیه مصدوم فرضی در ۴ دقیقه و ۳۰ ثانیه",
      verificationResult: "تایید صلاحیت تیم امداد توسط مدیر HSE مجتمع",
    },
  ],
  step10ResidualTarget: {
    residualScores: {
      H: { dimension: "human", dimensionLabel: "انسانی", likelihood: 1, severity: 4, rpn: 4, level: "low" },
      A: { dimension: "asset", dimensionLabel: "دارایی", likelihood: 1, severity: 1, rpn: 1, level: "low" },
      E: { dimension: "environment", dimensionLabel: "محیط زیست", likelihood: 1, severity: 1, rpn: 1, level: "low" },
      R: { dimension: "reputation", dimensionLabel: "اعتبار", likelihood: 1, severity: 2, rpn: 2, level: "low" },
    },
    overallResidualRpn: 4,
    overallResidualLevel: "low",
    isWithinAlarp: true,
  },
  step11Governance: {
    riskAcceptanceStatus: "acceptable",
    acceptanceAuthority: "کمیته عالی ایمنی فرآیند و مدیر ارشد مجتمع پارس جنوبی",
    approvalDate: "۱۴۰۵/۰۲/۲۰",
    revisionNumber: 2,
    auditTrailCode: "AUD-RR-2026-9941-VERIFIED",
    nextScheduledReviewDate: "۱۴۰۶/۰۲/۲۰ (پیش از آغاز اورهال دوره بعد)",
  },
};

const STEP_DEFINITIONS = [
  { step: 1, title: "محدوده و اطلاعات سازمانی", subtitle: "Assessment Context", icon: "🏢" },
  { step: 2, title: "شناسایی فعالیت و وظایف", subtitle: "Activity & Task Identification", icon: "📋" },
  { step: 3, title: "شناسایی منابع خطر", subtitle: "Hazard Identification", icon: "⚠️" },
  { step: 4, title: "تدوین سناریوی ریسک", subtitle: "Risk Scenario Identification", icon: "🔍" },
  { step: 5, title: "تحلیل پیامدها (HAER)", subtitle: "Consequence Identification", icon: "💥" },
  { step: 6, title: "شناسایی کنترل‌های موجود", subtitle: "Existing Controls & Hierarchy", icon: "🛡️" },
  { step: 7, title: "ارزیابی ریسک اولیه", subtitle: "Initial Risk (Uncontrolled)", icon: "🔴" },
  { step: 8, title: "ارزیابی ریسک جاری", subtitle: "Current Risk (Controlled)", icon: "🟡" },
  { step: 9, title: "اقدامات تکمیلی (CAPA)", subtitle: "Risk Treatment Actions", icon: "⚙️" },
  { step: 10, title: "ارزیابی ریسک باقیمانده و ALARP", subtitle: "Residual Risk & ALARP Target", icon: "🟢" },
  { step: 11, title: "حاکمیت، تایید و ردپا", subtitle: "Approval & Audit Trail", icon: "📜" },
];

export const ElevenStepsRiskVisualizer: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(4); // پیش‌فرض روی مرحله ۴ (سناریو و تفکیک مفهومی)
  const data = SAMPLE_PETRO_REGISTER;

  return (
    <div className="eleven-steps-container w-full max-w-7xl mx-auto py-8">
      {/* Header section */}
      <div className="mb-8 text-center md:text-right">
        <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start mb-2">
          <PaperBadge variant="danger" size="md">
            استاندارد مرجع ۱۱ مرحله‌ای
          </PaperBadge>
          <PaperBadge variant="neutral" size="md">
            شناسه ثبت: {data.id}
          </PaperBadge>
          <PaperBadge variant="success" size="md">
            سطح ALARP: قابل قبول
          </PaperBadge>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-900 font-farsi tracking-tight">
          گردش کار جامع تدوین و کنترل رجیستر ریسک (۱۱ مرحله استاندارد)
        </h2>
        <p className="text-neutral-600 mt-2 max-w-4xl text-sm md:text-base leading-relaxed">
          فرآیند ارزیابی ریسک در HSE Guard بر مبنای تفکیک دقیق منابع خطر، رویدادها، سناریوها و ابعاد چهارگانه پیامد (HAER)
          به همراه محاسبه خودکار ALARP و اتصال زنجیره ردیابی طراحی شده است.
        </p>
      </div>

      {/* 11 Steps Horizontal Bar / Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2 mb-6">
        {STEP_DEFINITIONS.map((s) => {
          const isActive = activeStep === s.step;
          return (
            <button
              key={s.step}
              onClick={() => setActiveStep(s.step)}
              className={`p-3 rounded-lg text-right transition-all flex flex-col justify-between border ${
                isActive
                  ? "bg-amber-500 text-white border-amber-600 shadow-md font-bold scale-102"
                  : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs px-1.5 py-0.5 rounded bg-black/10 font-mono">
                  {s.step}
                </span>
                <span className="text-base">{s.icon}</span>
              </div>
              <div className="text-xs leading-snug line-clamp-2">{s.title}</div>
            </button>
          );
        })}
      </div>

      {/* Active Step Detailed Content Card */}
      <PaperCard className="p-6 md:p-8 bg-white border-neutral-300 relative overflow-hidden shadow-lg">
        {/* Step 1: Assessment Context */}
        {activeStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">🏢</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">مرحله ۱: اطلاعات سازمانی و محدوده ارزیابی</h3>
                <p className="text-xs text-neutral-500">Assessment Context & Master Metadata</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-neutral-50 rounded border">
                <div className="text-xs text-neutral-500 mb-1">شرکت اصلی / کارفرما:</div>
                <div className="font-bold text-neutral-800">{data.step1Context.companyName}</div>
                <div className="text-xs text-neutral-500 mt-2">کارفرما بالادستی: {data.step1Context.client}</div>
              </div>
              <div className="p-3 bg-neutral-50 rounded border">
                <div className="text-xs text-neutral-500 mb-1">واحد سازمانی و پروژه:</div>
                <div className="font-bold text-neutral-800">{data.step1Context.department}</div>
                <div className="text-xs text-neutral-600 mt-1">{data.step1Context.projectName}</div>
              </div>
              <div className="p-3 bg-neutral-50 rounded border">
                <div className="text-xs text-neutral-500 mb-1">محل اجرا و بخش عملیاتی:</div>
                <div className="font-bold text-neutral-800">{data.step1Context.siteLocation}</div>
                <div className="text-xs text-amber-700 mt-1 font-semibold">{data.step1Context.area}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs bg-neutral-200 text-neutral-800 px-2 py-1 rounded">
                فاز: {data.step1Context.projectPhase}
              </span>
              <span className="text-xs bg-neutral-200 text-neutral-800 px-2 py-1 rounded">
                نوع عملیات: {data.step1Context.operationType}
              </span>
              <span className="text-xs bg-neutral-200 text-neutral-800 px-2 py-1 rounded">
                پیمانکار مجری: {data.step1Context.contractor}
              </span>
            </div>
          </div>
        )}

        {/* Step 2: Activity & Task Identification */}
        {activeStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">📋</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">مرحله ۲: شناسایی فعالیت و وظایف عملیاتی</h3>
                <p className="text-xs text-neutral-500">Activity, Task & Work Steps Identification</p>
              </div>
            </div>
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-md">
              <div className="text-xs font-semibold text-amber-900 mb-1">فعالیت اصلی (Activity):</div>
              <div className="text-base font-bold text-neutral-900">{data.step2Activity.activity}</div>
              <p className="text-sm text-neutral-700 mt-1">{data.step2Activity.activityDescription}</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-800 mb-2">مراحل تفکیکی انجام کار (Job Steps):</h4>
              <div className="space-y-2">
                {data.step2Activity.jobSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-neutral-50 rounded border text-sm">
                    <span className="w-6 h-6 rounded-full bg-neutral-800 text-white text-xs flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-neutral-800">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-neutral-50 p-4 rounded border">
              <div>
                <span className="font-semibold text-neutral-700">تجهیزات: </span>
                {data.step2Activity.equipment.join("، ")}
              </div>
              <div>
                <span className="font-semibold text-neutral-700">نفرات و صلاحیت: </span>
                {data.step2Activity.numberOfPersonnel} نفر ({data.step2Activity.competency})
              </div>
              <div>
                <span className="font-semibold text-neutral-700">عملیات هم‌زمان (SIMOPS): </span>
                <span className="text-red-700 font-semibold">{data.step2Activity.simops}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Hazard Identification */}
        {activeStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">مرحله ۳: شناسایی منابع خطر (Hazard Identification)</h3>
                <p className="text-xs text-neutral-500">تفکیک حوزه‌های ایمنی، بهداشت شغلی، محیط زیست و ایمنی فرآیند</p>
              </div>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-1 bg-red-600 text-white rounded">
                  حوزه: {data.step3Hazard.domainDisplay}
                </span>
                <span className="text-xs text-neutral-600">دسته‌بندی: {data.step3Hazard.category}</span>
              </div>
              <h4 className="text-base font-bold text-neutral-900 mb-1">{data.step3Hazard.hazardDescription}</h4>
              <div className="text-xs text-neutral-600 mt-3">نمونه‌های مصداقی منبع خطر در سایت:</div>
              <ul className="list-disc list-inside text-sm text-neutral-800 mt-1 space-y-1">
                {data.step3Hazard.examples.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Step 4: Risk Scenario Identification (Crucial Distinction) */}
        {activeStep === 4 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">🔍</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">مرحله ۴: تدوین سناریوی ریسک و تفکیک مفهومی</h3>
                <p className="text-xs text-neutral-500">
                  Risk Scenario, Initiating Event, Causes, Escalation Factors & Conceptual Distinction
                </p>
              </div>
            </div>

            {/* تفکیک مفهومی ۴ مرحله‌ای */}
            <div className="p-4 bg-neutral-900 text-white rounded-lg shadow-inner">
              <div className="text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">
                الگوی تفکیک مفهومی ۴ گانه (طراحی معماری سیستم):
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-neutral-800 rounded border border-neutral-700">
                  <div className="text-amber-400 font-bold mb-1">۱. منبع خطر (Hazard):</div>
                  <div className="text-neutral-300">{data.step4Scenario.conceptualDistinction.hazard}</div>
                </div>
                <div className="p-3 bg-neutral-800 rounded border border-neutral-700">
                  <div className="text-amber-400 font-bold mb-1">۲. رویداد ناخواسته (Event):</div>
                  <div className="text-neutral-300">{data.step4Scenario.conceptualDistinction.event}</div>
                </div>
                <div className="p-3 bg-neutral-800 rounded border border-neutral-700">
                  <div className="text-amber-400 font-bold mb-1">۳. سناریوی ریسک (Scenario):</div>
                  <div className="text-neutral-300">{data.step4Scenario.conceptualDistinction.scenario}</div>
                </div>
                <div className="p-3 bg-neutral-800 rounded border border-neutral-700">
                  <div className="text-amber-400 font-bold mb-1">۴. پیامد نهایی (Consequence):</div>
                  <div className="text-neutral-300">{data.step4Scenario.conceptualDistinction.consequence}</div>
                </div>
              </div>
            </div>

            {/* علل و عوامل تشدید */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-neutral-50 rounded border">
                <h5 className="font-bold text-neutral-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span> علل مستقیم و ریشه‌ای:
                </h5>
                <ul className="space-y-1 text-xs text-neutral-700 list-disc list-inside">
                  {data.step4Scenario.directCauses.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                  {data.step4Scenario.rootCauses.map((c, i) => (
                    <li key={`r-${i}`} className="text-neutral-600 italic">
                      ریشه‌ای: {c}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-neutral-50 rounded border">
                <h5 className="font-bold text-neutral-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span> عوامل تشدیدکننده (Escalation):
                </h5>
                <ul className="space-y-1 text-xs text-neutral-700 list-disc list-inside">
                  {data.step4Scenario.escalationFactors.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
                <div className="mt-3 text-xs bg-neutral-100 p-2 rounded">
                  <span className="font-semibold">مسیر مواجهه: </span>
                  {data.step4Scenario.exposurePathway}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Consequence Identification (HAER + Operational) */}
        {activeStep === 5 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">💥</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">مرحله ۵: شناسایی ابعاد پیامدها (HAER Framework)</h3>
                <p className="text-xs text-neutral-500">
                  تفکیک مستقل ابعاد چهارگانه و جداسازی خسارت دارایی از تداوم عملیات (Operational Continuity)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border-2 border-red-300 bg-red-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-red-700">H (Human)</span>
                  <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded font-mono">انسانی</span>
                </div>
                <p className="text-xs text-neutral-700">{data.step5Consequences.human.description}</p>
              </div>

              <div className="p-4 rounded-lg border-2 border-blue-300 bg-blue-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-blue-700">A (Asset)</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded font-mono">دارایی فیزیکی</span>
                </div>
                <p className="text-xs text-neutral-700">{data.step5Consequences.asset.description}</p>
              </div>

              <div className="p-4 rounded-lg border-2 border-emerald-300 bg-emerald-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-emerald-700">E (Environment)</span>
                  <span className="text-xs px-2 py-0.5 bg-emerald-600 text-white rounded font-mono">محیط زیست</span>
                </div>
                <p className="text-xs text-neutral-700">{data.step5Consequences.environment.description}</p>
              </div>

              <div className="p-4 rounded-lg border-2 border-purple-300 bg-purple-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-purple-700">R (Reputation)</span>
                  <span className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded font-mono">اعتبار سازمانی</span>
                </div>
                <p className="text-xs text-neutral-700">{data.step5Consequences.reputation.description}</p>
              </div>
            </div>

            {/* بعد مستقل تداوم عملیات */}
            <div className="p-4 rounded-lg border-2 border-amber-300 bg-amber-50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-800 font-bold text-sm">
                  ⚡ بُعد مستقل تداوم عملیات و توقف تولید (Operational Continuity):
                </span>
                <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono">کد: O</span>
              </div>
              <p className="text-xs text-neutral-700">{data.step5Consequences.operationalContinuity.description}</p>
            </div>
          </div>
        )}

        {/* Step 6: Existing Controls */}
        {activeStep === 6 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">🛡️</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">مرحله ۶: کنترل‌های موجود و سلسله‌مراتب کنترلی</h3>
                <p className="text-xs text-neutral-500">
                  Hierarchy of Controls, Control Ownership & Effectiveness Evidence
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {data.step6Controls.map((ctrl, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-neutral-50 flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-neutral-800 text-white">
                        {ctrl.hierarchyDisplay}
                      </span>
                      <span className="text-xs font-semibold text-neutral-500">نوع: {ctrl.controlType}</span>
                    </div>
                    <div className="text-sm font-bold text-neutral-900 pt-1">{ctrl.controlDescription}</div>
                    <div className="text-xs text-neutral-600">
                      شواهد اثربخشی: <span className="text-emerald-700 font-medium">{ctrl.effectivenessEvidence}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start md:items-end justify-center text-xs text-neutral-500 border-t md:border-t-0 md:border-r pr-0 md:pr-4 pt-2 md:pt-0">
                    <div>مالک: <span className="font-semibold text-neutral-800">{ctrl.controlOwner}</span></div>
                    <div>تناوب بازرسی: {ctrl.inspectionFrequency}</div>
                    <div className="mt-1">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        پیاده‌سازی‌شده و اثربخش
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 7 & 8: Initial vs Current Risk */}
        {(activeStep === 7 || activeStep === 8) && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">{activeStep === 7 ? "🔴" : "🟡"}</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">
                  {activeStep === 7 ? "مرحله ۷: ارزیابی ریسک اولیه (بدون کنترل)" : "مرحله ۸: ارزیابی ریسک جاری (با کنترل‌های موجود)"}
                </h3>
                <p className="text-xs text-neutral-500">
                  {activeStep === 7
                    ? "ارزیابی شدت و احتمال ذاتی خطر قبل از اعمال هرگونه اقدام حفاظتی"
                    : "محاسبه اثر کنترلهای پیشگیرانه (کاهش L) و کنترلهای کاهنده پیامد (کاهش S)"}
                </p>
              </div>
            </div>

            {/* Score Cards for H, A, E, R */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(
                activeStep === 7 ? data.step7InitialRisk.scores : data.step8CurrentRisk.scores
              ).map(([key, score]) => (
                <div
                  key={key}
                  className={`p-4 rounded-lg border-2 ${
                    score.level === "critical"
                      ? "border-red-500 bg-red-50"
                      : score.level === "high"
                      ? "border-amber-500 bg-amber-50"
                      : score.level === "medium"
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-emerald-500 bg-emerald-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base text-neutral-900">{score.dimensionLabel} ({key})</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold ${
                        score.level === "critical"
                          ? "bg-red-600 text-white"
                          : score.level === "high"
                          ? "bg-amber-600 text-white"
                          : score.level === "medium"
                          ? "bg-yellow-600 text-white"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {score.level.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600 flex justify-between mb-1">
                    <span>احتمال (L): {score.likelihood} از ۵</span>
                    <span>شدت (S): {score.severity} از ۵</span>
                  </div>
                  <div className="text-xl font-black text-neutral-900 mt-2 font-mono">
                    RPN: {score.rpn} <span className="text-xs font-normal text-neutral-500">(از ۲۵)</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Overall RPN Summary */}
            <div className="p-4 bg-neutral-100 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-neutral-800">
                  {activeStep === 7 ? "امتیاز ریسک ذاتی کل:" : "امتیاز ریسک جاری کل:"}
                </span>
                <span className="mr-2 text-xl font-extrabold text-neutral-900 font-mono">
                  {activeStep === 7 ? data.step7InitialRisk.overallInitialRpn : data.step8CurrentRisk.overallCurrentRpn}
                </span>
              </div>
              <div>
                <PaperBadge
                  variant={activeStep === 7 ? "danger" : "warning"}
                  size="md"
                >
                  {activeStep === 7 ? "بحرانی (Critical) - نیازمند مداخله فوری" : "متوسط (Medium) - نیازمند پایش"}
                </PaperBadge>
              </div>
            </div>

            {activeStep === 8 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 leading-relaxed">
                💡 <span className="font-bold">تحلیل اثر کنترلی: </span> {data.step8CurrentRisk.effectNotes}
              </div>
            )}
          </div>
        )}

        {/* Step 9: Risk Treatment Actions (CAPA) */}
        {activeStep === 9 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">⚙️</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">مرحله ۹: اقدامات تکمیلی و کاهش ریسک (CAPA)</h3>
                <p className="text-xs text-neutral-500">
                  Risk Treatment Actions, Corrective/Preventive Actions & Verification
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {data.step9Treatment.map((action, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-neutral-50 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-600 text-white">
                        {action.priority === "high" ? "اولویت بالا" : "اولویت فوری"}
                      </span>
                      <span className="text-xs text-neutral-500">نوع: {action.actionType === "preventive" ? "پیشگیرانه" : "کاهنده پیامد"}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                      وضعیت: {action.actionStatus === "completed" ? "تکمیل شده" : "راستی‌آزمایی شده"}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-neutral-900">{action.actionDescription}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-2 border-t text-neutral-600">
                    <div>مسئول پیگیری: <span className="font-semibold text-neutral-800">{action.actionOwner}</span> (مهلت: {action.dueDate})</div>
                    <div>نتیجه راستی‌آزمایی: <span className="text-emerald-700 font-medium">{action.verificationResult}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 10: Residual Risk & ALARP */}
        {activeStep === 10 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">🟢</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">مرحله ۱۰: ارزیابی ریسک باقیمانده و هدف ALARP</h3>
                <p className="text-xs text-neutral-500">
                  Residual Risk Assessment, As Low As Reasonably Practicable (ALARP) Target
                </p>
              </div>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-800 font-semibold">وضعیت در ماتریس ALARP:</div>
                <div className="text-lg font-extrabold text-emerald-900">کاملاً در محدوده قابل قبول (Broadly Acceptable)</div>
              </div>
              <div className="text-2xl font-black text-emerald-700 font-mono">
                RPN باقیمانده: {data.step10ResidualTarget.overallResidualRpn}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-center">
              {Object.entries(data.step10ResidualTarget.residualScores).map(([dim, score]) => (
                <div key={dim} className="p-3 rounded bg-neutral-50 border text-xs">
                  <div className="font-bold text-neutral-800">{score.dimensionLabel} ({dim})</div>
                  <div className="text-neutral-500 my-1">احتمال {score.likelihood} × شدت {score.severity}</div>
                  <div className="text-sm font-black text-emerald-600 font-mono">RPN = {score.rpn}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 11: Approval & Governance */}
        {activeStep === 11 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span className="text-3xl">📜</span>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">مرحله ۱۱: حاکمیت، تاییدیه نهایی و ردپای بازرسی</h3>
                <p className="text-xs text-neutral-500">
                  Approval, Governance, Sign-off & Audit Trail Code
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-neutral-50 rounded border space-y-2">
                <div className="text-xs text-neutral-500">مرجع تایید صلاحیت:</div>
                <div className="font-bold text-neutral-800">{data.step11Governance.acceptanceAuthority}</div>
                <div className="text-xs text-neutral-500 pt-2">تاریخ تصویب نهایی:</div>
                <div className="font-semibold text-neutral-800">{data.step11Governance.approvalDate}</div>
              </div>

              <div className="p-4 bg-neutral-50 rounded border space-y-2">
                <div className="text-xs text-neutral-500">کد ردپای ممیزی یکپارچه (Traceability Audit Trail):</div>
                <div className="font-mono text-xs font-bold text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  {data.step11Governance.auditTrailCode}
                </div>
                <div className="text-xs text-neutral-500 pt-2">موعد بازنگری دوره‌ای بعدی:</div>
                <div className="font-semibold text-neutral-800">{data.step11Governance.nextScheduledReviewDate}</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="mt-8 pt-4 border-t flex items-center justify-between">
          <PaperButton
            variant="secondary"
            size="sm"
            disabled={activeStep <= 1}
            onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
          >
            ← مرحله قبلی ({activeStep > 1 ? STEP_DEFINITIONS[activeStep - 2].title : ""})
          </PaperButton>

          <span className="text-xs text-neutral-500 font-mono">
            گام {activeStep} از ۱۱
          </span>

          <PaperButton
            variant="primary"
            size="sm"
            disabled={activeStep >= 11}
            onClick={() => setActiveStep((prev) => Math.min(11, prev + 1))}
          >
            مرحله بعدی ({activeStep < 11 ? STEP_DEFINITIONS[activeStep].title : ""}) →
          </PaperButton>
        </div>
      </PaperCard>
    </div>
  );
};
