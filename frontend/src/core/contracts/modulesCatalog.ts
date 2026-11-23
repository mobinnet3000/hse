/**
 * 20 HSE Modules Catalog & Full Communication Matrix
 * تدوین کامل فهرست ۲۰ ماژول اصلی به همراه ماتریس ارتباطات و انواع ۶ گانه تبادل اطلاعات
 */

export type ExchangeType =
  | "direct"
  | "automatic"
  | "approval_based"
  | "bidirectional"
  | "analytical"
  | "event_based";

export interface ModuleCommunicationRule {
  targetModuleId: number;
  targetModuleName: string;
  exchangeType: ExchangeType;
  exchangeTypeDisplay: string;
  dataDescription: string;
  sampleTrigger: string;
}

export interface HSEModuleDefinition {
  id: number;
  nameFa: string;
  nameEn: string;
  category: "core_risk" | "operations" | "compliance" | "workforce" | "strategic";
  description: string;
  iconName: string;
  
  // ۴ رکن اصلی ماتریس ارتباطات
  inputs: {
    data: string;
    sourceModules: string[];
  }[];
  processing: string;
  outputs: {
    data: string;
    destinationModules: string[];
  }[];
  destinations: string[];

  // قوانین دقیق تبادل با سایر ماژول‌ها
  communicationRules: ModuleCommunicationRule[];
}

export const HSE_EXCHANGE_TYPES: Record<ExchangeType, { nameFa: string; concept: string; example: string }> = {
  direct: {
    nameFa: "مستقیم (Direct)",
    concept: "انتقال اطلاعات از یک ماژول به ماژول دیگر به صورت همگام در یک جریان کاری",
    example: "Risk Management -> PTW (ارسال شروط کنترلی به پروانه کار)",
  },
  automatic: {
    nameFa: "خودکار (Automatic)",
    concept: "انتقال بدون دخالت کاربر بلافاصله پس از ثبت رخداد در دیتابیس",
    example: "Incident -> HSE KPI (محاسبه مجدد ضریب تکرار و شدت حوادث AFR/ASR)",
  },
  approval_based: {
    nameFa: "تأییدمحور (Approval-Based)",
    concept: "انتقال اثرات فقط پس از تأیید و امضای الکترونیک مسئول مجاز",
    example: "MOC -> Risk Management (ایجاد ارزیابی ریسک پس از تصویب تغییر)",
  },
  bidirectional: {
    nameFa: "دوسویه (Bidirectional)",
    concept: "تبادل اطلاعات و وضعیت به صورت متقابل در هر دو جهت",
    example: "Equipment <-> Inspection (ثبت سوابق بازرسی تجهیز و اعلام هشدار نقص فنی)",
  },
  analytical: {
    nameFa: "تحلیلی (Analytical)",
    concept: "ارسال داده‌های تجمعی برای مدل‌سازی، موتور محاسباتی یا هوش مصنوعی و دریافت بینش",
    example: "تمام ماژول‌ها <-> AI & Risk Engine (ارزیابی سناریو و تحلیل روند)",
  },
  event_based: {
    nameFa: "اعلان‌محور (Event-Based)",
    concept: "انتقال در اثر وقوع یا جهش یک رویداد بحرانی یا آستانه خطر",
    example: "Incident (سطح ۴) -> Emergency Management (فعال‌سازی آنی طرح واکنش اضطراری ERP)",
  },
};

export const HSE_20_MODULES: HSEModuleDefinition[] = [
  {
    id: 1,
    nameFa: "مدیریت ریسک",
    nameEn: "Risk Management",
    category: "core_risk",
    description: "شناسایی خطرات، تدوین سناریوها و ارزیابی ریسک بر اساس ابعاد ۴ گانه HAER و اصل ALARP",
    iconName: "ShieldAlert",
    inputs: [
      { data: "فعالیت‌ها، تجهیزات، مواد شیمیایی", sourceModules: ["Shared Master Data", "Equipment", "Chemical"] },
      { data: "حوادث و شبه‌حوادث", sourceModules: ["Incident Management"] },
      { data: "عدم‌انطباق‌ها و یافته‌های بازرسی", sourceModules: ["Inspection Management"] },
      { data: "درخواست‌های تغییرات فرآیندی/فنی", sourceModules: ["Management of Change (MOC)"] },
      { data: "ناهنجاری‌ها و رفتارهای ناایمن", sourceModules: ["Anomaly Report"] },
      { data: "الزامات قانونی و استانداردها", sourceModules: ["Audit & Compliance"] },
    ],
    processing: "ارزیابی ریسک اولیه، فعلی و باقیمانده برای ابعاد HAER، تحلیل پاپیونی (BowTie)، رتبه‌بندی خطرات بر اساس ALARP",
    outputs: [
      { data: "Risk Register مصوب، امتیازات RPN، شروط و موانع کنترلی، اقدامات اصلاحی", destinationModules: ["PTW", "Incident", "Inspection", "Training", "PPE", "Equipment", "Occupational Health", "Environmental", "Chemical", "Emergency", "KPI", "Strategic", "Dashboard"] }
    ],
    destinations: ["PTW", "Incident", "Inspection", "Training", "PPE", "Equipment", "Occupational Health", "Environmental", "Chemical", "Emergency", "KPI", "Strategic", "Dashboard"],
    communicationRules: [
      { targetModuleId: 3, targetModuleName: "PTW", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "الزامات کنترلی و حدود مجاز کار در پروانه", sampleTrigger: "درخواست صدور پروانه کار گرم/فضای بسته" },
      { targetModuleId: 13, targetModuleName: "HSE KPI", exchangeType: "automatic", exchangeTypeDisplay: "خودکار", dataDescription: "آمار تعداد ریسک‌های بحرانی و پوشش موانع", sampleTrigger: "تصویب یا بازنگری در Risk Register" },
    ]
  },
  {
    id: 2,
    nameFa: "مدیریت حوادث",
    nameEn: "Incident Management",
    category: "operations",
    description: "ثبت، طبقه‌بندی، تحلیل علل ریشه‌ای (RCA)، درس‌آموخته‌ها و اقدامات اصلاحی حوادث و شبه‌حوادث",
    iconName: "AlertOctagon",
    inputs: [
      { data: "گزارش حادثه، شبه‌حادثه، آسیب جانی، خسارت مالی، نشت محیطی، شواهد بررسی", sourceModules: ["کاربران", "Anomaly Report", "Operations"] }
    ],
    processing: "طبقه‌بندی شدت حادثه (سطوح ۱ تا ۴)، تحلیل ۵Why، نمودار استخوان ماهی، ماتریس علل ریشه‌ای",
    outputs: [
      { data: "Incident Register، علل ریشه‌ای، درس‌آموخته‌ها، آمار حوادث", destinationModules: ["Risk Management", "Emergency", "Training", "Safety Culture", "KPI", "Audit", "Environmental", "Dashboard"] }
    ],
    destinations: ["Risk Management", "Emergency", "Training", "Safety Culture", "KPI", "Audit", "Environmental", "Dashboard"],
    communicationRules: [
      { targetModuleId: 1, targetModuleName: "Risk Management", exchangeType: "event_based", exchangeTypeDisplay: "اعلان‌محور", dataDescription: "الزام به بازنگری فوری ریسک متناظر با حادثه", sampleTrigger: "ثبت حادثه بحرانی" },
      { targetModuleId: 13, targetModuleName: "HSE KPI", exchangeType: "automatic", exchangeTypeDisplay: "خودکار", dataDescription: "به‌روزرسانی خودکار شاخص‌های LTIFR, AFR, ASR", sampleTrigger: "تأیید گزارش نهایی حادثه" },
    ]
  },
  {
    id: 3,
    nameFa: "مدیریت مجوز کار (PTW)",
    nameEn: "Permit to Work (PTW)",
    category: "operations",
    description: "صدور، نظارت، بررسی تداخلات (SIMOPS)، ایزولاسیون LOTO و تعلیق و ابطال پروانه‌های کار پرخطر",
    iconName: "FileCheck",
    inputs: [
      { data: "درخواست کار، ارزیابی ریسک (JSA/Risk Register)، صلاحیت افراد، وضعیت سلامت تجهیزات و مواد", sourceModules: ["Risk Management", "Training", "Equipment", "Chemical"] }
    ],
    processing: "بررسی شرایط ایمن قبل از اجرا، شروط گازسنجی، کنترل تداخل فعالیت‌های همزمان (SIMOPS)، ثبت امضای الکترونیک صادرکننده و متقاضی",
    outputs: [
      { data: "مجوز کار معتبر، شرایط ایمن، محدودیت‌های زمانی، وضعیت تعلیق و ابطال", destinationModules: ["Risk Management", "Inspection", "Incident", "Equipment", "Chemical", "KPI", "Dashboard"] }
    ],
    destinations: ["Risk Management", "Inspection", "Incident", "Equipment", "Chemical", "KPI", "Dashboard"],
    communicationRules: [
      { targetModuleId: 4, targetModuleName: "Inspection Management", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "ارجاع به بازرسی انطباق حین اجرای پروانه کار", sampleTrigger: "شروع عملیات اجرایی مجوز" }
    ]
  },
  {
    id: 4,
    nameFa: "مدیریت بازرسی",
    nameEn: "Inspection Management",
    category: "compliance",
    description: "برنامه‌ریزی و اجرای بازرسی‌های ادواری ایمنی، بهداشت، ماشین‌آلات و صدور عدم‌انطباق‌ها",
    iconName: "ClipboardCheck",
    inputs: [
      { data: "برنامه بازرسی، چک‌لیست‌ها، الزامات قانونی، ریسک‌ها، وضعیت تجهیزات، Anomaly", sourceModules: ["Audit & Compliance", "Risk Management", "Equipment", "Anomaly"] }
    ],
    processing: "انطباق وضعیت با چک‌لیست، امتیازدهی، تشخیص انحراف و تعیین ریشه نقص",
    outputs: [
      { data: "گزارش بازرسی، یافته‌ها، نقص‌ها، عدم‌انطباق‌ها و اقدامات اصلاحی", destinationModules: ["Risk Management", "Contractor HSE", "Incident", "Equipment", "Audit", "KPI", "Anomaly", "Dashboard"] }
    ],
    destinations: ["Risk Management", "Contractor HSE", "Incident", "Equipment", "Audit", "KPI", "Anomaly", "Dashboard"],
    communicationRules: [
      { targetModuleId: 11, targetModuleName: "Equipment & Machinery", exchangeType: "bidirectional", exchangeTypeDisplay: "دوسویه", dataDescription: "ثبت وضعیت سلامت تجهیز و توقف بهره‌برداری در صورت نقص بحرانی", sampleTrigger: "یافتن عیب در بازرسی ادواری" }
    ]
  },
  {
    id: 5,
    nameFa: "آموزش و شایستگی",
    nameEn: "Training & Competency",
    category: "workforce",
    description: "ماتریس شایستگی، نیازسنجی آموزشی، آزمون‌ها، گواهینامه‌های دوره‌ای و صلاحیت عملیاتی پرسنل",
    iconName: "GraduationCap",
    inputs: [
      { data: "الزامات شغلی، ماتریس شایستگی، ریسک‌های شناسایی‌شده، حوادث، الزامات PTW", sourceModules: ["Shared Master Data", "Risk Management", "Incident", "PTW"] }
    ],
    processing: "تحلیل شکاف مهارتی (Gap Analysis)، برگزاری آزمون، مدیریت تاریخ انقضای گواهینامه",
    outputs: [
      { data: "سوابق آموزش، ارزیابی شایستگی، کارنامه قبولی، صلاحیت احراز پست", destinationModules: ["Risk Management", "PTW", "Contractor HSE", "Incident", "Emergency", "KPI", "Safety Culture", "Strategic", "Dashboard"] }
    ],
    destinations: ["Risk Management", "PTW", "Contractor HSE", "Incident", "Emergency", "KPI", "Safety Culture", "Strategic", "Dashboard"],
    communicationRules: [
      { targetModuleId: 3, targetModuleName: "PTW", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "تأیید صلاحیت فرد متقاضی یا دارنده پروانه", sampleTrigger: "انتخاب فرد در صدور پروانه کار" }
    ]
  },
  {
    id: 6,
    nameFa: "مدیریت HSE پیمانکاران",
    nameEn: "Contractor HSE",
    category: "workforce",
    description: "پیش‌ارزیابی، احراز صلاحیت HSE، رتبه‌بندی عملکردی، ممیزی و نظارت بر پیمانکاران دست‌اول و دوم",
    iconName: "Users2",
    inputs: [
      { data: "اطلاعات پیمانکار، قرارداد، سوابق حوادث، آموزش‌ها، ریسک فعالیت‌ها، نتایج بازرسی", sourceModules: ["Shared Master Data", "Incident", "Training", "Inspection", "Audit"] }
    ],
    processing: "امتیازدهی ماتریس ارزیابی پیمانکار، پایش عدم‌انطباق‌ها، رتبه‌بندی A/B/C/D",
    outputs: [
      { data: "ارزیابی و رتبه‌بندی پیمانکار، تأیید صلاحیت، هشدار جریمه یا تعلیق قرارداد", destinationModules: ["PTW", "Risk Management", "Inspection", "Training", "Audit", "KPI", "Strategic", "Anomaly", "Dashboard"] }
    ],
    destinations: ["PTW", "Risk Management", "Inspection", "Training", "Audit", "KPI", "Strategic", "Anomaly", "Dashboard"],
    communicationRules: [
      { targetModuleId: 3, targetModuleName: "PTW", exchangeType: "approval_based", exchangeTypeDisplay: "تأییدمحور", dataDescription: "مجوز فعالیت پیمانکار صرفاً در صورت دارا بودن گرید معتبر HSE", sampleTrigger: "درخواست کار توسط پیمانکار" }
    ]
  },
  {
    id: 7,
    nameFa: "مدیریت محیط زیست",
    nameEn: "Environmental Management",
    category: "compliance",
    description: "جنبه‌ها و پیامدهای زیست‌محیطی، مدیریت پسماند، مصرف انرژی/آب، پایش آلاینده‌ها و شاخص‌های کربن",
    iconName: "Leaf",
    inputs: [
      { data: "فهرست فعالیت‌ها، پسماند، مصرف آب و انرژی، داده‌های انتشار دود و پساب، Anomaly زیست‌محیطی", sourceModules: ["Shared Master Data", "Anomaly Report", "Operations"] }
    ],
    processing: "سنجش با حدود مجاز استاندارد ملی و بین‌المللی، ارزیابی ردپای کربن، طبقه‌بندی پسماندهای صنعتی",
    outputs: [
      { data: "جنبه‌ها و پیامدهای زیست‌محیطی، وضعیت انطباق با استاندارد، گزارش عدم‌انطباق زیست‌محیطی", destinationModules: ["Risk Management", "Incident", "Emergency", "Audit", "KPI", "Strategic", "Anomaly", "Dashboard"] }
    ],
    destinations: ["Risk Management", "Incident", "Emergency", "Audit", "KPI", "Strategic", "Anomaly", "Dashboard"],
    communicationRules: [
      { targetModuleId: 1, targetModuleName: "Risk Management", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "ثبت بعد محیط زیست (E) در ارزیابی ریسک HAER", sampleTrigger: "تعریف جنبه زیست‌محیطی جدید" }
    ]
  },
  {
    id: 8,
    nameFa: "بهداشت حرفه‌ای",
    nameEn: "Occupational Health",
    category: "workforce",
    description: "پایش عوامل زیان‌آور (صدا، ارگونومی، غبار، سموم)، معاینات دوره‌ای طب کار، تعیین تناسب شغلی",
    iconName: "Activity",
    inputs: [
      { data: "عوامل زیان‌آور محیط کار، اطلاعات مشاغل، سوابق پایش مواجهه، داده‌های پرونده سلامت", sourceModules: ["Risk Management", "Chemical", "Operations"] }
    ],
    processing: "پایش دوز مواجهه با حد آستانه مجاز (TLV/OEL)، ارزیابی ارگونومی RULA/REBA، تعیین گواهی Fit-for-work",
    outputs: [
      { data: "ارزیابی مواجهه شغلی، گواهی تناسب شغلی، محدودیت‌های کاری، کنترل‌های بهداشتی", destinationModules: ["Risk Management", "Training", "PPE", "Contractor HSE", "Strategic", "KPI", "Anomaly", "Dashboard"] }
    ],
    destinations: ["Risk Management", "Training", "PPE", "Contractor HSE", "Strategic", "KPI", "Anomaly", "Dashboard"],
    communicationRules: [
      { targetModuleId: 10, targetModuleName: "PPE Management", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "تعیین نوع گوشی صداگیر، ماسک تنفسی یا فیلتر متناسب با عامل زیان‌آور", sampleTrigger: "شناسایی مواجهه بالاتر از حد مجاز" }
    ]
  },
  {
    id: 9,
    nameFa: "مدیریت شرایط اضطراری",
    nameEn: "Emergency Management",
    category: "operations",
    description: "طرح‌های واکنش در شرایط اضطراری (ERP)، تجهیزات امداد و نجات، سناریوهای بحران، مانورها و ارزیابی آمادگی",
    iconName: "Siren",
    inputs: [
      { data: "سناریوهای حاد، خطرات با پیامد فاجعه‌بار، اطلاعات مواد خطرناک، حوادث، موجودی تجهیزات نجات", sourceModules: ["Risk Management", "Chemical", "Incident", "Equipment"] }
    ],
    processing: "برنامه‌ریزی مانور، شبیه‌سازی زمان واکنش (Response Time)، ارزیابی کمبود منابع و نقاط ضعف تیم امداد",
    outputs: [
      { data: "طرح واکنش اضطراری (ERP)، نتایج مانورها، سطح آمادگی، دستور تخلیه، نیازهای لجستیکی", destinationModules: ["Risk Management", "Incident", "Training", "Equipment", "Environmental", "Chemical", "KPI", "Dashboard", "Anomaly"] }
    ],
    destinations: ["Risk Management", "Incident", "Training", "Equipment", "Environmental", "Chemical", "KPI", "Dashboard", "Anomaly"],
    communicationRules: [
      { targetModuleId: 5, targetModuleName: "Training & Competency", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "برگزاری دوره‌های بازآموزی اطفای حریق و کمک‌های اولیه پس از مانور", sampleTrigger: "شناسایی نقطه ضعف در مانور" }
    ]
  },
  {
    id: 10,
    nameFa: "مدیریت تجهیزات حفاظت فردی",
    nameEn: "PPE Management",
    category: "operations",
    description: "ماتریس نیازمندی PPE مشاغل، صدور، ردیابی موجودی، تاریخ انقضا و اثربخشی تجهیزات حفاظت فردی",
    iconName: "HardHat",
    inputs: [
      { data: "الزامات کنترل ریسک در سطح PPE، مواجهه شغلی، مشاغل، پرونده طب کار، گزارش نقص تجهیز", sourceModules: ["Risk Management", "Occupational Health", "Training", "Anomaly"] }
    ],
    processing: "انطباق استاندارد EN/ANSI با خطرات، پیش‌بینی مصرف و هشدار زمان تعویض و انقضا",
    outputs: [
      { data: "ماتریس توزیع PPE، سوابق تحویل فردی، گزارش موجودی انبار، هشدار تعویض دوره عمر", destinationModules: ["Risk Management", "Occupational Health", "Training", "Contractor HSE", "Inspection", "KPI", "Anomaly", "Dashboard"] }
    ],
    destinations: ["Risk Management", "Occupational Health", "Training", "Contractor HSE", "Inspection", "KPI", "Anomaly", "Dashboard"],
    communicationRules: [
      { targetModuleId: 4, targetModuleName: "Inspection Management", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "کنترل میدانی استفاده صحیح کارکنان از PPE تحویل‌شده", sampleTrigger: "بازرسی ایمنی روزانه کارگاه" }
    ]
  },
  {
    id: 11,
    nameFa: "مدیریت تجهیزات و ماشین‌آلات",
    nameEn: "Equipment & Machinery Management",
    category: "operations",
    description: "شناسنامه فنی، سلامت فنی ماشین‌آلات، سرتیفیکیت بازرسی، نگهداری پیشگیرانه و برچسب ایمنی (Safety Tag)",
    iconName: "Wrench",
    inputs: [
      { data: "فهرست تجهیزات، مشخصات فنی، سوابق بازرسی و تعمیرات، گواهینامه‌های فنی، گزارش نقص", sourceModules: ["Shared Master Data", "Inspection", "Incident", "Anomaly"] }
    ],
    processing: "پایش دوره اعتبار گواهینامه بازرسی فنی، محاسبه شاخص MTBF و صدور هشدارهای از رده خارج شدن",
    outputs: [
      { data: "وضعیت سلامت تجهیز، تأییدیه فنی، مجوز بهره‌برداری، برچسب نقص و توقف کار", destinationModules: ["Risk Management", "PTW", "Inspection", "Incident", "Emergency", "MOC", "KPI", "Anomaly", "Dashboard"] }
    ],
    destinations: ["Risk Management", "PTW", "Inspection", "Incident", "Emergency", "MOC", "KPI", "Anomaly", "Dashboard"],
    communicationRules: [
      { targetModuleId: 3, targetModuleName: "PTW", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "ممنوعیت تخصیص تجهیز دارای سرتیفیکیت منقضی به پروانه کار", sampleTrigger: "انتخاب تجهیز در صدور مجوز" }
    ]
  },
  {
    id: 12,
    nameFa: "ممیزی و انطباق",
    nameEn: "Audit & Compliance",
    category: "compliance",
    description: "ممیزی انطباق با قوانین ملی کار، وزارت صمت، استانداردهای ISO 45001/14001 و پیگیری انطباق حقوقی",
    iconName: "Scale",
    inputs: [
      { data: "استانداردها، قوانین جاری، قراردادها، گزارش‌های ممیزی قبلی، سوابق حوادث و بازرسی‌ها", sourceModules: ["Document Control", "Inspection", "Incident", "Anomaly"] }
    ],
    processing: "تحلیل شکاف قانونی (Legal Gap Analysis)، تطبیق شواهد ممیزی، ردیابی اقدامات اصلاحی سیستمی",
    outputs: [
      { data: "گزارش ممیزی، عدم‌انطباق‌های ماژور/مینور، فرصت‌های بهبود، ردیابی تا بسته‌شدن نهایی", destinationModules: ["Risk Management", "Document Control", "Contractor HSE", "Inspection", "Strategic", "KPI", "Anomaly", "Dashboard"] }
    ],
    destinations: ["Risk Management", "Document Control", "Contractor HSE", "Inspection", "Strategic", "KPI", "Anomaly", "Dashboard"],
    communicationRules: [
      { targetModuleId: 14, targetModuleName: "Document Control", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "الزام به اصلاح یا تدوین روش اجرایی (SOP) جدید", sampleTrigger: "عدم‌انطباق ممیزی سیستمی" }
    ]
  },
  {
    id: 13,
    nameFa: "شاخص‌های عملکرد HSE",
    nameEn: "HSE KPI",
    category: "strategic",
    description: "محاسبه خودکار شاخص‌های پیشرو (Leading) و پسرو (Lagging)، نرخ حوادث AFR, ASR, LTIFR و انحراف از تارگت",
    iconName: "BarChart3",
    inputs: [
      { data: "داده‌های حوادث، ساعت کارکرد نفرات، امتیازات ریسک، بازرسی‌ها، ممیزی، آموزش، پسماند", sourceModules: ["Incident", "Workforce", "Risk Management", "Inspection", "Training", "Environmental"] }
    ],
    processing: "فرمول‌های استاندارد بین‌المللی OSHA و نفت، تحلیل رگرسیون، تشخیص روندهای صعودی حوادث",
    outputs: [
      { data: "شاخص‌های پیشرو و پسرو، نمودارهای مقایسه‌ای روندها، هشدارهای انحراف از اهداف", destinationModules: ["Risk Management", "Strategic HSE", "Contractor HSE", "Management Dashboard"] }
    ],
    destinations: ["Risk Management", "Strategic HSE", "Contractor HSE", "Management Dashboard"],
    communicationRules: [
      { targetModuleId: 20, targetModuleName: "Management Dashboard", exchangeType: "automatic", exchangeTypeDisplay: "خودکار", dataDescription: "نمایش ویجت‌های لایو شاخص‌ها در داشبورد مدیران", sampleTrigger: "محاسبه دوره‌ای هفتگی و ماهانه" }
    ]
  },
  {
    id: 14,
    nameFa: "کنترل مستندات",
    nameEn: "Document Control",
    category: "compliance",
    description: "سیاست‌ها، روش‌های اجرایی (SOP)، دستورالعمل‌های کاری، فرم‌ها، گردش کار تأیید و کنترل نسخ",
    iconName: "FileText",
    inputs: [
      { data: "پیش‌نویس خط‌مشی‌ها، SOPها، شیوه‌نامه‌ها، فرم‌ها، درخواست‌های بازنگری سند", sourceModules: ["تمام ماژول‌ها"] }
    ],
    processing: "کنترل نسخه‌ها (Revisions)، بررسی چرخه تاییدات چندمرحله‌ای، امضای دیجیتال، بایگانی ایمن",
    outputs: [
      { data: "نسخه معتبر و جاری اسناد، هشدار انقضای بازنگری، ماتریس توزیع مستندات", destinationModules: ["تمام ماژول‌ها و نمایش در Dashboard"] }
    ],
    destinations: ["تمام ماژول‌ها و نمایش در Dashboard"],
    communicationRules: [
      { targetModuleId: 1, targetModuleName: "Risk Management", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "ارجاع سناریوی ریسک به روش اجرایی متناظر کنترل خطر", sampleTrigger: "تعریف کنترل مدیریتی" }
    ]
  },
  {
    id: 15,
    nameFa: "فرهنگ ایمنی",
    nameEn: "Safety Culture",
    category: "strategic",
    description: "سیستم رفتارهای ایمن/ناایمن (BBS)، مشاهدات، سیستم تشویق، نظرسنجی بلوغ ایمنی و مشارکت کارکنان",
    iconName: "HeartPulse",
    inputs: [
      { data: "کارت‌های مشاهده رفتار (BBS)، گزارش رفتارهای مثبت، مشارکت در کمیته‌های حفاظت، بازخوردها", sourceModules: ["کاربران", "Training", "Anomaly Report"] }
    ],
    processing: "سنجش شاخص رفتار ایمن، ارزیابی سطح بلوغ فرهنگ ایمنی بر مدل Hearts & Minds",
    outputs: [
      { data: "شاخص فرهنگ ایمنی، تحلیل الگوهای رفتاری خطرناک، برنامه‌های انگیزشی و تشویقی", destinationModules: ["Risk Management", "Incident", "Training", "Strategic HSE", "KPI", "Anomaly", "Dashboard"] }
    ],
    destinations: ["Risk Management", "Incident", "Training", "Strategic HSE", "KPI", "Anomaly", "Dashboard"],
    communicationRules: [
      { targetModuleId: 5, targetModuleName: "Training & Competency", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "طراحی دوره‌های تغییر رفتار بر اساس رفتارهای پرخطر مشاهده‌شده", sampleTrigger: "کاهش شاخص رفتار ایمن در یک واحد" }
    ]
  },
  {
    id: 16,
    nameFa: "مدیریت مواد شیمیایی",
    nameEn: "Chemical Management",
    category: "operations",
    description: "فهرست مواد، برگه اطلاعات ایمنی (SDS)، سازگاری شیمیایی، لوزی خطر NFPA، کنترل نشت و دپوی ایمن",
    iconName: "FlaskConical",
    inputs: [
      { data: "فهرست مواد مصرفی، برگه‌های SDS، مقادیر دپو در انبار، محل نگهداری، روش حمل", sourceModules: ["Shared Master Data", "Operations"] }
    ],
    processing: "ماتریس سازگاری شیمیایی، کنترل حدود انفجار LEL/UEL، تحلیل اثرات متقابل مواد ناسازگار",
    outputs: [
      { data: "طبقه‌بندی خطر GHS، الزامات انبارش و جداسازی، هشدارهای نشت و دستورالعمل خنثی‌سازی", destinationModules: ["Risk Management", "Occupational Health", "PPE", "Emergency", "PTW", "Environmental", "MOC", "Anomaly", "Dashboard"] }
    ],
    destinations: ["Risk Management", "Occupational Health", "PPE", "Emergency", "PTW", "Environmental", "MOC", "Anomaly", "Dashboard"],
    communicationRules: [
      { targetModuleId: 1, targetModuleName: "Risk Management", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "الحاق مشخصات خطر شیمیایی به سناریوی ارزیابی ریسک", sampleTrigger: "ورود ماده شیمیایی جدید به کارگاه" }
    ]
  },
  {
    id: 17,
    nameFa: "مدیریت تغییرات (MOC)",
    nameEn: "Management of Change (MOC)",
    category: "strategic",
    description: "مدیریت تغییرات فنی، فرآیندی، سازمانی و تجهیزاتی به همراه ارزیابی ریسک پیش از راه‌اندازی (PSSR)",
    iconName: "GitMerge",
    inputs: [
      { data: "درخواست تغییر در فرآیند، تجهیز، نیروی انسانی، دستورالعمل یا نرم‌افزار", sourceModules: ["تمام ماژول‌ها"] }
    ],
    processing: "ارزیابی چندرشته‌ای اثرات تغییر، چک‌لیست قبل از اجرا، کنترل مجوزهای راه‌اندازی موقت/دائم",
    outputs: [
      { data: "ارزیابی ریسک تغییر، تأییدیه‌های اجرایی، الزامات به‌روزرسانی اسناد و آموزش پرسنل", destinationModules: ["Risk Management", "PTW", "Equipment", "Document Control", "Training", "Emergency", "Chemical", "Dashboard"] }
    ],
    destinations: ["Risk Management", "PTW", "Equipment", "Document Control", "Training", "Emergency", "Chemical", "Dashboard"],
    communicationRules: [
      { targetModuleId: 1, targetModuleName: "Risk Management", exchangeType: "approval_based", exchangeTypeDisplay: "تأییدمحور", dataDescription: "تشکیل خودکار پرونده ارزیابی ریسک برای تغییر تأییدشده", sampleTrigger: "تصویب مرحله فنی درخواست تغییر" }
    ]
  },
  {
    id: 18,
    nameFa: "مدیریت راهبردی HSE",
    nameEn: "Strategic HSE Management",
    category: "strategic",
    description: "خط‌مشی کلان سازمان، هدف‌گذاری سالانه، تحلیل SWOT، تخصیص بودجه و بازنگری مدیریت",
    iconName: "Compass",
    inputs: [
      { data: "شاخص‌های KPI، ریسک‌های کلان سازمانی، گزارش‌های ممیزی، بودجه‌های مصرفی، تکالیف هیئت‌مدیره", sourceModules: ["HSE KPI", "Risk Management", "Audit", "Management Dashboard"] }
    ],
    processing: "تحلیل همبستگی داده‌های کلان، ارزیابی اثربخشی استراتژی‌ها، تدوین اهداف SMART سالانه",
    outputs: [
      { data: "اهداف کلان سالانه، برنامه‌های عملیاتی مصوب، تخصیص بودجه HSE، اولویت‌های استراتژیک", destinationModules: ["تمام ماژول‌ها به‌ویژه KPI و Dashboard"] }
    ],
    destinations: ["تمام ماژول‌ها به‌ویژه KPI و Dashboard"],
    communicationRules: [
      { targetModuleId: 20, targetModuleName: "Management Dashboard", exchangeType: "direct", exchangeTypeDisplay: "مستقیم", dataDescription: "نمایش درصد تحقق اهداف استراتژیک", sampleTrigger: "ارزیابی دوره‌ای ۳ ماهه" }
    ]
  },
  {
    id: 19,
    nameFa: "مدیریت گزارش ناهنجاری‌ها و موارد ناایمن",
    nameEn: "Anomaly Report Management",
    category: "operations",
    description: "ثبت سریع شرایط ناایمن، اعمال ناایمن، شبه‌حوادث، نقص تجهیزات توسط کلیه پرسنل در محل",
    iconName: "AlertTriangle",
    inputs: [
      { data: "عکس، صوت، شرایط ناایمن، رفتار ناایمن، نقص تجهیزات، نشت مواد، خطای روش کار", sourceModules: ["کاربران", "کارکنان میدانی", "Inspection"] }
    ],
    processing: "تریاژ سریع خطر، ارزیابی اولیه پتانسیل تبدیل به حادثه، ارجاع خودکار به اقدام اصلاحی فوری",
    outputs: [
      { data: "Anomaly Register، طبقه‌بندی علل، ارزیابی ریسک بالقوه، درخواست اقدام اصلاحی فوری", destinationModules: ["Risk Management", "Incident", "Inspection", "Training", "Contractor HSE", "Occupational Health", "PPE", "Emergency", "Environmental"] }
    ],
    destinations: ["Risk Management", "Incident", "Inspection", "Training", "Contractor HSE", "Occupational Health", "PPE", "Emergency", "Environmental"],
    communicationRules: [
      { targetModuleId: 2, targetModuleName: "Incident Management", exchangeType: "event_based", exchangeTypeDisplay: "اعلان‌محور", dataDescription: "تبدیل خودکار به شبه‌حادثه یا حادثه در صورت وجود آسیب بالقوه بالا", sampleTrigger: "ثبت ناهنجاری با پتانسیل حادثه ماژور" }
    ]
  },
  {
    id: 20,
    nameFa: "داشبورد مدیریتی",
    nameEn: "Management Dashboard",
    category: "strategic",
    description: "تجمیع آنلاین و هوشمند کلیه داده‌های ۱۹ ماژول دیگر، نمودارهای مقایسه‌ای و پایش لحظه‌ای کارگاه‌ها",
    iconName: "LayoutDashboard",
    inputs: [
      { data: "خروجی‌های تجمیعی کلیه ۱۹ ماژول (ریسک، حادثه، پروانه کار، بازرسی، آموزش، پسماند، بودجه و ...)", sourceModules: ["تمام ماژول‌های ۱ تا ۱۹"] }
    ],
    processing: "یکپارچه‌سازی بلادرنگ داده‌ها، فیلترهای چندبعدی پروژه‌ها، هشدار خطرات قریب‌الوقوع، هوش تجاری",
    outputs: [
      { data: "داشبوردهای بصری، گزارش‌های مدیریتی مقایسه‌ای، وضعیت پروژه‌ها، نقشه‌های حرارتی ریسک", destinationModules: ["مدیران ارشد", "مدیران پروژه", "مدیران HSE"] }
    ],
    destinations: ["مدیران ارشد", "مدیران پروژه", "مدیران HSE"],
    communicationRules: [
      { targetModuleId: 1, targetModuleName: "Risk Management", exchangeType: "bidirectional", exchangeTypeDisplay: "دوسویه", dataDescription: "قابلیت Drill-down از هیت‌مپ کلی به تک‌تک سناریوهای Risk Register", sampleTrigger: "کلیک مدیر روی خانه قرمز رنگ ماتریس" }
    ]
  },
];
