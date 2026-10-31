import React, { useState } from "react";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Building2,
  Shield,
  Flame,
  Wrench,
  FileText,
  Check,
  Zap,
} from "lucide-react";
import type { AIAssessmentWorkplaceData, Workplace } from "../../../services/api";

interface AssessmentWizardProps {
  workplaces: Workplace[];
  selectedWorkplaceId: number | null;
  onSelectWorkplace: (id: number) => void;
  onSubmit: (title: string, data: AIAssessmentWorkplaceData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export const SAMPLE_WORKSHOP_SCENARIO: { title: string; data: AIAssessmentWorkplaceData } = {
  title: "ارزیابی جامع ایمنی و بهداشت کارگاه سازه‌های فولادی سنگین",
  data: {
    general_info: {
      workplace_name: "کارگاه مرکزی ساخت و مونتاژ سازه‌های سنگین فلزی",
      industry_type: "صنایع فلزی و اسکلت فلزی صنعتی",
      workshop_type: "کارگاه برش‌کاری، جوشکاری، ماشین‌کاری و رنگ‌آمیزی",
      shift_count: 2,
      worker_count: 45,
      special_groups: ["کارگران پیمانکار جوشکاری", "اپراتورهای جرثقیل"],
      contractor_present: true,
      contractor_count: 8,
    },
    physical_environment: {
      area_sqm: 2500,
      ceiling_height_meters: 9,
      ventilation_type: "تهویه طبیعی ترکیبی با هودهای موضعی مکنده بالای ایستگاه‌های جوش",
      lighting_condition: "۳۵۰ لوکس (ترکیب نورگیرهای سقفی و پرژکتورهای ال‌ای‌دی صنعتی)",
      noise_level: "۸۸ الی ۹۴ دسی‌بل در ساعات پیک برش و سنگ‌زنی",
      temperature_condition: "دمای محیطی ۱۸ تا ۲۶ درجه سلسیوس با سیستم گرمایش تابشی",
      humidity_condition: "رطوبت نسبی ۳۵ تا ۴۵ درصد",
      housekeeping_status: "متوسط - نیاز به پاک‌سازی مستمر براده‌های آهن و ضایعات ورق",
    },
    activities_and_processes: {
      primary_processes: [
        "برش حرارتی ورق‌ها با دستگاه پلاسما و هواگاز (اکسی‌استیلن)",
        "شکل‌دهی و خم‌کاری ورق‌ها با پرس هیدرولیک ۲۰۰ تن",
        "جوشکاری سازه‌ای به روش‌های MIG/MAG و SMAW",
        "سنگ‌زنی، پلیسه‌گیری و ساب‌زدن درزهای جوش",
        "رنگ‌آمیزی صنعتی قطعات با رنگ اپوکسی دو جزئی و پلی‌یورتان",
        "جابجایی و باربرداری قطعات سنگین با جرثقیل سقفی دو پل ۱۰ تن",
      ],
      hazardous_operations: [
        "کار گرم و جوشکاری در مجاورت مواد قابل اشتعال",
        "کار در ارتفاع بالای ۲ متر حین مونتاژ سازه‌های بلند",
        "عملیات سنگین باربرداری و جابجایی قطعات تناژ بالا",
        "رنگ‌آمیزی پاششی صنعتی و متصاعد شدن بخارات حلال‌های آلی (تینر)",
      ],
      material_handling: [
        "جرثقیل سقفی ۱۰ تن مجهز به ریموت بی‌سیم",
        "لیفتراک دیزلی ۳ تن جهت حمل پالت‌ها در محوطه",
        "چرخ‌دستی‌های کارگاهی مخصوص حمل سیلندرهای گاز تحت فشار",
      ],
    },
    machinery_and_equipment: [
      {
        name: "پرس هیدرولیک ۲۰۰ تن دروازه‌ای",
        type: "پرس شکل‌دهی فلزات",
        guarding_status: "دارای پرده نوری حفاظتی در بخش ورودی اما نیازمند تست دوره‌ای کالیبراسیون",
        maintenance_status: "سرویس ماهانه طبق شناسنامه PM انجام شده است",
        safety_devices: ["کلید اضطراری Emergency Stop", "پرده نوری اپتوالکترونیک", "فرمان دو دستی"],
      },
      {
        name: "جرثقیل سقفی دو پل ۱۰ تن",
        type: "تجهیزات لیفتینگ کارگاهی",
        guarding_status: "حفاظ گیربکس و درام نصب است، شیطانک قلاب نیازمند بازرسی روزانه",
        maintenance_status: "دارای گواهی بازرسی فنی و تست بار معتبر ۶ ماهه",
        safety_devices: ["میکروسوئیچ حد کورس قلاب و پل", "بوق هشدار حرکت", "سیستم لودسل قطع‌کن اضافه بار"],
      },
      {
        name: "دستگاه‌های سنگ‌فرز بزرگ دستی (۲۳۰ میلی‌متر)",
        type: "ابزار برقی دوار دستی",
        guarding_status: "حفاظ فلزی نیم‌دایره نصب است ولی برخی اپراتورها حفاظ را کج می‌کنند",
        maintenance_status: "تست سلامت کابل و دوشاخه هفتگی",
        safety_devices: ["قفل کلید ایمن", "دسته کمکی ضد ارتعاش"],
      },
      {
        name: "دستگاه‌های جوشکاری اینورتر ۵۰۰ آمپر",
        type: "تجهیزات برق و جوشکاری",
        guarding_status: "بدنه ارت شده، انبرهای جوش عایق کامل",
        maintenance_status: "مطلوب و بدون نشتی بدنه",
        safety_devices: ["مدار محافظ ولتاژ VRD", "ترموستات قطع اضافه بار حرارتی"],
      },
    ],
    materials_and_chemicals: [
      {
        name: "سیلندرهای گاز استیلن و اکسیژن صنعتی",
        classification: "گازهای تحت فشار و شدیداً قابل اشتعال و اکسیدکننده",
        storage_method: "در استند مهار زنجیری عمودی با فاصله ایمن ۶ متری",
        msds_available: true,
        approximate_volume: "۱۰ کپسول اکسیژن، ۶ کپسول استیلن",
      },
      {
        name: "رنگ اپوکسی زینک‌ریچ و تینر صنعتی فرار",
        classification: "مایع قابل اشتعال کلاس IB و محرک سیستم تنفسی",
        storage_method: "در قفسه فلزی دارای حوضچه مهار نشتی (Bund) در انبار مواد شیمیایی",
        msds_available: true,
        approximate_volume: "۲۰۰ لیتر رنگ، ۶۰ لیتر تینر",
      },
      {
        name: "سیم جوش و پودر جوشکاری زیرپودری",
        classification: "مواد مصرفی جوشکاری با غبارات اکسید فلزی",
        storage_method: "در کوره و گرمکن مخصوص جلوگیری از جذب رطوبت",
        msds_available: true,
        approximate_volume: "۵۰۰ کیلوگرم",
      },
    ],
    existing_controls: {
      engineering_controls: [
        "هودهای مکنده بازویی متحرک در ۶ ایستگاه جوشکاری",
        "توری‌های محافظ ضد پرتاب براده و جرقه‌های سنگ‌زنی",
        "دیواره‌های جداکننده برزنتی نسوز پیرامون میزهای برش",
      ],
      administrative_controls: [
        "دستورالعمل صدور پروانه کار گرم (Hot Work Permit) قبل از برش و جوش",
        "آموزش بدو استخدام ایمنی و بازآموزی کار در ارتفاع",
        "برنامه چرخش شغلی اپراتورهای پرس و سنگ‌زنی جهت کاهش مواجهه با ارتعاش و صدا",
      ],
      ppe_provided: [
        "کلاه ایمنی مقاوم در برابر ضربه",
        "عینک ایمنی ضد تراشه سنگ‌زنی و شیلد صورت",
        "ماسک جوشکاری اتوماتیک لنز تاریک‌شونده",
        "کفش پنجه فولادی عایق برق و ضد ضربه",
        "گوشی ایرماف و ایرپلاگ اسفنجی",
        "ماسک‌های تنفسی نیم‌صورت فیلتردار کربن اکتیو مخصوص بخارات رنگ",
      ],
      permits_required: ["پروانه کار گرم", "پروانه کار در ارتفاع", "مجوز جابجایی ترافیکی قطعات ترافیکی"],
    },
    historical_incidents: [
      {
        date_or_period: "۳ ماه گذشته",
        incident_type: "حادثه چشمی ناشی از پلیسه سنگ‌زنی",
        description: "ورود براده میکرونی داغ به چشم اپراتور حین استفاده از عینک نامناسب (بدون لبه)",
        severity: "متوسط (نیاز به تخلیه جسم خارجی در کلینیک چشم)",
      },
      {
        date_or_period: "۶ ماه گذشته",
        incident_type: "شبه‌حادثه سقوط ورق در باربرداری",
        description: "پاره شدن تسمه حمل نامناسب حین جابجایی ورق ۳ تنی با جرثقیل بدون آسیب جانی",
        severity: "بالا (پتانسیل مرگبار)",
      },
    ],
    emergency_readiness: {
      fire_extinguishers_available: true,
      eyewash_available: true,
      first_aid_kit_available: true,
      emergency_exits_marked: true,
      evacuation_plan_exists: true,
      trained_first_aiders: 4,
    },
    regulatory_context: {
      applicable_standards: [
        "آیین‌نامه حفاظت و بهداشت کار در کارگاه‌ها (وزارت تعاون، کار و رفاه اجتماعی)",
        "آیین‌نامه ایمنی کار با پرس‌ها و ماشین‌آلات صنعتی فلزکاری",
        "آیین‌نامه ایمنی جوشکاری و برش‌کاری حرارتی ایران",
        "استاندارد OSHA 29 CFR 1910.212 (Machine Guarding)",
        "استاندارد ISO 45001:2018 بند ۶-۱-۲ شناسایی خطرات",
      ],
      internal_policies: [
        "خط‌مشی منع اکید کار بدون تجهیزات فردی",
        "دستورالعمل جامع سرویس و نگهداری پیشگیرانه PM ماشین‌آلات",
      ],
      special_permits: ["پروانه تأسیس و بهره‌برداری وزارت صمت", "تأییدیه آتش‌نشانی"],
    },
  },
};

export const AssessmentWizard: React.FC<AssessmentWizardProps> = ({
  workplaces,
  selectedWorkplaceId,
  onSelectWorkplace,
  onSubmit,
  onCancel,
  loading,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [title, setTitle] = useState<string>("ارزیابی جامع ایمنی و بهداشت کارگاه");

  // Step 1: General Info
  const [workplaceName, setWorkplaceName] = useState<string>("");
  const [industryType, setIndustryType] = useState<string>("صنایع فلزی و ساختمانی");
  const [workshopType, setWorkshopType] = useState<string>("کارگاه مونتاژ و ماشین‌کاری");
  const [shiftCount, setShiftCount] = useState<number>(1);
  const [workerCount, setWorkerCount] = useState<number>(20);
  const [contractorPresent, setContractorPresent] = useState<boolean>(false);
  const [contractorCount, setContractorCount] = useState<number>(0);
  const [specialGroupsStr, setSpecialGroupsStr] = useState<string>("جوشکاران، اپراتورهای لیفتراک");

  // Step 2: Physical Environment
  const [areaSqm, setAreaSqm] = useState<number>(1200);
  const [ceilingHeight, setCeilingHeight] = useState<number>(7);
  const [ventilation, setVentilation] = useState<string>("ترکیب تهویه طبیعی و هواکش‌های صنعتی دیواری");
  const [lighting, setLighting] = useState<string>("۳۰۰ لوکس کافی با لامپ‌های فلورسنت و ال‌ای‌دی");
  const [noiseLevel, setNoiseLevel] = useState<string>("۸۵ دسی‌بل در زمان فعالیت ماشین‌آلات");
  const [temperature, setTemperature] = useState<string>("دمای آسایش ۲۱ تا ۲۴ درجه");
  const [humidity, setHumidity] = useState<string>("۴۰ درصد");
  const [housekeeping, setHousekeeping] = useState<string>("متوسط - مسیرهای تردد علامت‌گذاری شده است");

  // Step 3: Activities & Processes
  const [processesStr, setProcessesStr] = useState<string>(
    "برش ورق‌های فولادی، جوشکاری برق و CO2، سنگ‌زنی قطعات، جابجایی بار با جرثقیل"
  );
  const [hazardousOpsStr, setHazardousOpsStr] = useState<string>(
    "کار گرم، کار در ارتفاع، جابجایی بارهای سنگین، استفاده از ابزار برقی پرتابل"
  );
  const [handlingStr, setHandlingStr] = useState<string>("جرثقیل سقفی، لیفتراک دیزلی، جک‌پالت دستی");

  // Step 4: Machinery & Equipment
  const [machinery, setMachinery] = useState<
    Array<{ name: string; type: string; guarding_status: string; maintenance_status: string; safety_devices: string[] }>
  >([
    {
      name: "پرس هیدرولیک",
      type: "فرم‌دهی ورق",
      guarding_status: "دارای حفاظ میکروسوئیچی",
      maintenance_status: "سرویس دوره‌ای ماهانه",
      safety_devices: ["قطع‌کن اضطراری", "فرمان دو دستی"],
    },
  ]);

  // Step 5: Materials & Chemicals
  const [materials, setMaterials] = useState<
    Array<{ name: string; classification: string; storage_method: string; msds_available: boolean; approximate_volume: string }>
  >([
    {
      name: "کپسول گاز استیلن و اکسیژن",
      classification: "گازهای تحت فشار قابل اشتعال",
      storage_method: "در قفسه زنجیردار عمودی با فاصله مجاز",
      msds_available: true,
      approximate_volume: "۸ کپسول",
    },
  ]);

  // Step 6: Existing Controls
  const [engControlsStr, setEngControlsStr] = useState<string>(
    "هودهای موضعی مکنده بر روی میز جوشکاری، حفاظ‌های مشبک تسمه‌فلکه"
  );
  const [admControlsStr, setAdmControlsStr] = useState<string>(
    "دستورالعمل صدور پروانه کار گرم، معاینات دوره‌ای طب کار سالانه"
  );
  const [ppeStr, setPpeStr] = useState<string>("کلاه ایمنی، عینک ایمنی، کفش پنجه فولادی، دستکش ضد برش، ماسک فیلتردار");
  const [permitsStr, setPermitsStr] = useState<string>("پروانه کار گرم، پروانه کار در ارتفاع");

  // Step 7: Incidents History
  const [incidents, setIncidents] = useState<
    Array<{ date_or_period: string; incident_type: string; description: string; severity: string }>
  >([
    {
      date_or_period: "۴ ماه گذشته",
      incident_type: "برش انگشت با براده آهن",
      description: "برش سطحی دست اپراتور در حین جابجایی ورق بدون دستکش مناسب",
      severity: "جزئی",
    },
  ]);

  // Step 8: Emergency Readiness
  const [fireExtinguishers, setFireExtinguishers] = useState<boolean>(true);
  const [eyewash, setEyewash] = useState<boolean>(true);
  const [firstAid, setFirstAid] = useState<boolean>(true);
  const [emergencyExits, setEmergencyExits] = useState<boolean>(true);
  const [evacuationPlan, setEvacuationPlan] = useState<boolean>(true);
  const [firstAiders, setFirstAiders] = useState<number>(3);

  // Step 9: Regulatory Context
  const [standardsStr, setStandardsStr] = useState<string>(
    "آیین‌نامه حفاظت فنی وزارت کار، استاندارد ISO 45001، دستورالعمل‌های ایمنی ماشین‌آلات"
  );
  const [policiesStr, setPoliciesStr] = useState<string>("الزام توقف کار ناایمن (Stop Work Authority)، خط‌مشی صفر حادثه");

  const [scenarioLoaded, setScenarioLoaded] = useState<boolean>(false);

  const loadScenario = () => {
    const s = SAMPLE_WORKSHOP_SCENARIO;
    setTitle(s.title);

    // Step 1
    setWorkplaceName(s.data.general_info.workplace_name);
    setIndustryType(s.data.general_info.industry_type);
    setWorkshopType(s.data.general_info.workshop_type);
    setShiftCount(s.data.general_info.shift_count);
    setWorkerCount(s.data.general_info.worker_count);
    setContractorPresent(s.data.general_info.contractor_present || false);
    setContractorCount(s.data.general_info.contractor_count || 0);
    setSpecialGroupsStr((s.data.general_info.special_groups || []).join("، "));

    // Step 2
    if (s.data.physical_environment) {
      setAreaSqm(s.data.physical_environment.area_sqm || 2500);
      setCeilingHeight(s.data.physical_environment.ceiling_height_meters || 9);
      setVentilation(s.data.physical_environment.ventilation_type || "");
      setLighting(s.data.physical_environment.lighting_condition || "");
      setNoiseLevel(s.data.physical_environment.noise_level || "");
      setTemperature(s.data.physical_environment.temperature_condition || "");
      setHumidity(s.data.physical_environment.humidity_condition || "");
      setHousekeeping(s.data.physical_environment.housekeeping_status || "");
    }

    // Step 3
    if (s.data.activities_and_processes) {
      setProcessesStr((s.data.activities_and_processes.primary_processes || []).join("\n"));
      setHazardousOpsStr((s.data.activities_and_processes.hazardous_operations || []).join("\n"));
      setHandlingStr((s.data.activities_and_processes.material_handling || []).join("\n"));
    }

    // Step 4
    if (s.data.machinery_and_equipment) {
      setMachinery(
        s.data.machinery_and_equipment.map((m) => ({
          name: m.name,
          type: m.type || "",
          guarding_status: m.guarding_status || "",
          maintenance_status: m.maintenance_status || "",
          safety_devices: m.safety_devices || [],
        }))
      );
    }

    // Step 5
    if (s.data.materials_and_chemicals) {
      setMaterials(
        s.data.materials_and_chemicals.map((c) => ({
          name: c.name,
          classification: c.classification || "",
          storage_method: c.storage_method || "",
          msds_available: c.msds_available ?? true,
          approximate_volume: c.approximate_volume || "",
        }))
      );
    }

    // Step 6
    if (s.data.existing_controls) {
      setEngControlsStr((s.data.existing_controls.engineering_controls || []).join("\n"));
      setAdmControlsStr((s.data.existing_controls.administrative_controls || []).join("\n"));
      setPpeStr((s.data.existing_controls.ppe_provided || []).join("، "));
      setPermitsStr((s.data.existing_controls.permits_required || []).join("، "));
    }

    // Step 7
    if (s.data.historical_incidents) {
      setIncidents(
        s.data.historical_incidents.map((i) => ({
          date_or_period: i.date_or_period || "",
          incident_type: i.incident_type || "",
          description: i.description || "",
          severity: i.severity || "",
        }))
      );
    }

    // Step 8
    if (s.data.emergency_readiness) {
      setFireExtinguishers(s.data.emergency_readiness.fire_extinguishers_available ?? true);
      setEyewash(s.data.emergency_readiness.eyewash_available ?? true);
      setFirstAid(s.data.emergency_readiness.first_aid_kit_available ?? true);
      setEmergencyExits(s.data.emergency_readiness.emergency_exits_marked ?? true);
      setEvacuationPlan(s.data.emergency_readiness.evacuation_plan_exists ?? true);
      setFirstAiders(s.data.emergency_readiness.trained_first_aiders ?? 4);
    }

    // Step 9
    if (s.data.regulatory_context) {
      setStandardsStr((s.data.regulatory_context.applicable_standards || []).join("\n"));
      setPoliciesStr((s.data.regulatory_context.internal_policies || []).join("\n"));
    }

    setScenarioLoaded(true);
  };

  const handleAddMachine = () => {
    setMachinery([
      ...machinery,
      {
        name: "",
        type: "",
        guarding_status: "",
        maintenance_status: "",
        safety_devices: [],
      },
    ]);
  };

  const handleRemoveMachine = (idx: number) => {
    setMachinery(machinery.filter((_, i) => i !== idx));
  };

  const handleAddMaterial = () => {
    setMaterials([
      ...materials,
      {
        name: "",
        classification: "",
        storage_method: "",
        msds_available: true,
        approximate_volume: "",
      },
    ]);
  };

  const handleRemoveMaterial = (idx: number) => {
    setMaterials(materials.filter((_, i) => i !== idx));
  };

  const handleAddIncident = () => {
    setIncidents([
      ...incidents,
      {
        date_or_period: "",
        incident_type: "",
        description: "",
        severity: "",
      },
    ]);
  };

  const handleRemoveIncident = (idx: number) => {
    setIncidents(incidents.filter((_, i) => i !== idx));
  };

  const buildPayload = (): AIAssessmentWorkplaceData => {
    const parseList = (str: string) =>
      str
        .split(/[\n،,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    return {
      general_info: {
        workplace_name: workplaceName || (workplaces.find((w) => w.id === selectedWorkplaceId)?.name ?? "کارگاه اصلی"),
        industry_type: industryType,
        workshop_type: workshopType,
        shift_count: Number(shiftCount) || 1,
        worker_count: Number(workerCount) || 1,
        special_groups: parseList(specialGroupsStr),
        contractor_present: contractorPresent,
        contractor_count: Number(contractorCount) || 0,
      },
      physical_environment: {
        area_sqm: Number(areaSqm) || 0,
        ceiling_height_meters: Number(ceilingHeight) || 0,
        ventilation_type: ventilation,
        lighting_condition: lighting,
        noise_level: noiseLevel,
        temperature_condition: temperature,
        humidity_condition: humidity,
        housekeeping_status: housekeeping,
      },
      activities_and_processes: {
        primary_processes: parseList(processesStr),
        hazardous_operations: parseList(hazardousOpsStr),
        material_handling: parseList(handlingStr),
      },
      machinery_and_equipment: machinery.filter((m) => m.name.trim()),
      materials_and_chemicals: materials.filter((m) => m.name.trim()),
      existing_controls: {
        engineering_controls: parseList(engControlsStr),
        administrative_controls: parseList(admControlsStr),
        ppe_provided: parseList(ppeStr),
        permits_required: parseList(permitsStr),
      },
      historical_incidents: incidents.filter((i) => i.incident_type.trim() || i.description.trim()),
      emergency_readiness: {
        fire_extinguishers_available: fireExtinguishers,
        eyewash_available: eyewash,
        first_aid_kit_available: firstAid,
        emergency_exits_marked: emergencyExits,
        evacuation_plan_exists: evacuationPlan,
        trained_first_aiders: Number(firstAiders) || 0,
      },
      regulatory_context: {
        applicable_standards: parseList(standardsStr),
        internal_policies: parseList(policiesStr),
        special_permits: [],
      },
    };
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    await onSubmit(title, payload);
  };

  const steps = [
    { num: 1, title: "مشخصات عمومی", icon: <Building2 className="w-4 h-4" /> },
    { num: 2, title: "محیط فیزیکی", icon: <Shield className="w-4 h-4" /> },
    { num: 3, title: "فرآیندها و وظایف", icon: <Wrench className="w-4 h-4" /> },
    { num: 4, title: "تجهیزات و ماشین‌آلات", icon: <Wrench className="w-4 h-4" /> },
    { num: 5, title: "مواد و شیمیایی", icon: <Flame className="w-4 h-4" /> },
    { num: 6, title: "کنترل‌های موجود", icon: <CheckCircle className="w-4 h-4" /> },
    { num: 7, title: "سوابق حوادث", icon: <AlertTriangle className="w-4 h-4" /> },
    { num: 8, title: "آمادگی اضطراری", icon: <Shield className="w-4 h-4" /> },
    { num: 9, title: "مقررات و ارسال", icon: <FileText className="w-4 h-4" /> },
  ];

  const progressPercentage = Math.round((currentStep / 9) * 100);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200/90 overflow-hidden" dir="rtl">
      {/* Top Header & Scenario Banner */}
      <div className="p-6 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900">
                ارزیابی جامع محیط کار جهت تولید هوشمند چک‌لیست بازرسی
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ورود اطلاعات ساختاریافته ۹ مرحله‌ای کارگاه جهت تحلیل پیشرفته با موتور هوش مصنوعی AvalAI
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadScenario}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] ${
              scenarioLoaded
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200"
                : "bg-gradient-to-r from-amber-50 to-amber-100/70 text-amber-900 border-amber-300 hover:bg-amber-100"
            }`}
          >
            {scenarioLoaded ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Zap className="w-4 h-4 text-amber-600" />
            )}
            <span>{scenarioLoaded ? "سناریوی بخش ۱۵ بارگذاری شد" : "بارگذاری سناریوی نمونه (کارگاه اسکلت فلزی)"}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
          <span>گام {currentStep.toLocaleString("fa-IR")} از ۹: {steps[currentStep - 1].title}</span>
          <span className="font-mono text-indigo-600">{progressPercentage.toLocaleString("fa-IR")}٪ تکمیل شده</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Horizontal Step Tabs */}
      <div className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-2.5 overflow-x-auto">
        <div className="flex items-center min-w-max gap-1.5">
          {steps.map((s) => {
            const isActive = currentStep === s.num;
            const isCompleted = currentStep > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setCurrentStep(s.num)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-300"
                    : isCompleted
                    ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                    : "text-slate-500 hover:bg-slate-200/60"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                    isActive
                      ? "bg-white text-indigo-600"
                      : isCompleted
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {isCompleted ? "✓" : s.num}
                </span>
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Form Body */}
      <form onSubmit={handleFinalSubmit} className="p-6 md:p-8">
        {/* Step 1 */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                گام ۱: مشخصات عمومی و ساختاری کارگاه
              </h3>
              <p className="text-xs text-slate-500 mt-1">اطلاعات هویتی، ظرفیت شغلی و گروه‌های ویژه کارگاه را مشخص نمایید.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">واحد کارگاهی ثبت‌شده در سامانه *</label>
                <select
                  value={selectedWorkplaceId ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    onSelectWorkplace(id);
                    const wp = workplaces.find((w) => w.id === id);
                    if (wp && !workplaceName) setWorkplaceName(wp.name);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- انتخاب واحد کارگاهی --</option>
                  {workplaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان ارزیابی *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: ارزیابی ایمنی کارگاه ساخت و جوشکاری"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام دقیق محل یا سالن کارگاه *</label>
                <input
                  type="text"
                  value={workplaceName}
                  onChange={(e) => setWorkplaceName(e.target.value)}
                  placeholder="مثال: کارگاه ساخت و سازه‌های فلزی سالن ۳"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع صنعت و حوزه تخصصی</label>
                <input
                  type="text"
                  value={industryType}
                  onChange={(e) => setIndustryType(e.target.value)}
                  placeholder="مثال: صنایع فلزی، نفت و گاز، داروسازی..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع کارگاه و ماهیت فضا</label>
                <input
                  type="text"
                  value={workshopType}
                  onChange={(e) => setWorkshopType(e.target.value)}
                  placeholder="مثال: کارگاه برش، جوشکاری، ماشین‌کاری و رنگ‌آمیزی"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تعداد شیفت کاری</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={shiftCount}
                    onChange={(e) => setShiftCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تعداد کل کارگران شاغل</label>
                  <input
                    type="number"
                    min={1}
                    value={workerCount}
                    onChange={(e) => setWorkerCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حضور پیمانکاران در محل؟</label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      checked={contractorPresent}
                      onChange={() => setContractorPresent(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    بله
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      checked={!contractorPresent}
                      onChange={() => {
                        setContractorPresent(false);
                        setContractorCount(0);
                      }}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    خیر
                  </label>
                  {contractorPresent && (
                    <div className="flex items-center gap-1 mr-4">
                      <span className="text-xs text-slate-500">تعداد نفرات:</span>
                      <input
                        type="number"
                        min={1}
                        value={contractorCount}
                        onChange={(e) => setContractorCount(Number(e.target.value))}
                        className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">گروه‌های ویژه یا حساس شغلی</label>
                <input
                  type="text"
                  value={specialGroupsStr}
                  onChange={(e) => setSpecialGroupsStr(e.target.value)}
                  placeholder="مثال: جوشکاران، کارگران روزمزد، اپراتورهای لیفتراک"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                گام ۲: مشخصات محیط فیزیکی و فاکتورهای محیطی
              </h3>
              <p className="text-xs text-slate-500 mt-1">ابعاد سالن، وضعیت تهویه، روشنایی، تراز صدا و نظم کارگاهی.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مساحت تقریبی کارگاه (مترمربع)</label>
                <input
                  type="number"
                  value={areaSqm}
                  onChange={(e) => setAreaSqm(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ارتفاع سقف سالن (متر)</label>
                <input
                  type="number"
                  step="0.5"
                  value={ceilingHeight}
                  onChange={(e) => setCeilingHeight(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وضعیت تهویه هوا (طبیعی / موضعی)</label>
                <input
                  type="text"
                  value={ventilation}
                  onChange={(e) => setVentilation(e.target.value)}
                  placeholder="مثال: هودهای مکنده بازویی موضعی، فن‌های دمنده دیواری"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">میزان و وضعیت روشنایی</label>
                <input
                  type="text"
                  value={lighting}
                  onChange={(e) => setLighting(e.target.value)}
                  placeholder="مثال: ۳۵۰ لوکس با لامپ‌های صنعتی و نورگیر سقفی"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تراز صدا و منابع ارتعاش</label>
                <input
                  type="text"
                  value={noiseLevel}
                  onChange={(e) => setNoiseLevel(e.target.value)}
                  placeholder="مثال: ۸۸ الی ۹۴ دسی‌بل در ساعات پیک برش و سنگ‌زنی"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شرایط دما و حرارت محیطی</label>
                <input
                  type="text"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="مثال: دمای آسایش با سیستم گرمایش تابشی"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">نظم، انضباط و خانه‌داری صنعتی (۵S / Housekeeping)</label>
                <textarea
                  rows={2}
                  value={housekeeping}
                  onChange={(e) => setHousekeeping(e.target.value)}
                  placeholder="وضعیت خط‌کشی مسیرهای تردد، جمع‌آوری ضایعات، چیدمان مواد و تمیزی کف سالن"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                گام ۳: فرآیندها، فعالیت‌های شغلی و حمل و نقل بار
              </h3>
              <p className="text-xs text-slate-500 mt-1">فرآیندهای تولید، عملیات‌های پرخطر و ادوات جابجایی مواد را ثبت فرمایید.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                فرآیندهای اصلی تولید و عملیات (هر مورد در یک سطر) *
              </label>
              <textarea
                rows={3}
                value={processesStr}
                onChange={(e) => setProcessesStr(e.target.value)}
                placeholder="برش پلاسما، جوشکاری MIG/MAG، سنگ‌زنی، مونتاژ، رنگ‌آمیزی..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عملیات‌های پرخطر شاخص (کار گرم، ارتفاع، فضای بسته، ولتاژ بالا...)
              </label>
              <textarea
                rows={3}
                value={hazardousOpsStr}
                onChange={(e) => setHazardousOpsStr(e.target.value)}
                placeholder="کار گرم در مجاورت مواد قابل اشتعال، کار در ارتفاع بالای ۲ متر، جابجایی بارهای سنگین..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">روش‌ها و تجهیزات حمل و جابجایی بار (Material Handling)</label>
              <input
                type="text"
                value={handlingStr}
                onChange={(e) => setHandlingStr(e.target.value)}
                placeholder="جرثقیل سقفی ۱۰ تن، لیفتراک دیزلی، جک‌پالت دستی، گاری‌های چرخ‌دار"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>
        )}

        {/* Step 4 */}
        {currentStep === 4 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-indigo-600" />
                  گام ۴: ماشین‌آلات، تجهیزات، ابزارها و تأسیسات
                </h3>
                <p className="text-xs text-slate-500 mt-1">تجهیزات صنعتی، وضعیت حفاظ‌ها و میکروسوئیچ‌ها را ثبت نمایید.</p>
              </div>
              <button
                type="button"
                onClick={handleAddMachine}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> افزودن دستگاه
              </button>
            </div>
            <div className="space-y-3">
              {machinery.map((item, idx) => (
                <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50/60 space-y-3 relative hover:border-indigo-300 transition-colors">
                  <button
                    type="button"
                    onClick={() => handleRemoveMachine(idx)}
                    className="absolute top-3 left-3 text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                    title="حذف این ردیف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">نام دستگاه / تجهیز *</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...machinery];
                          updated[idx].name = e.target.value;
                          setMachinery(updated);
                        }}
                        placeholder="مثال: پرس هیدرولیک ۲۰۰ تن"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع کاربرد یا رده دستگاه</label>
                      <input
                        type="text"
                        value={item.type}
                        onChange={(e) => {
                          const updated = [...machinery];
                          updated[idx].type = e.target.value;
                          setMachinery(updated);
                        }}
                        placeholder="مثال: شکل‌دهی فلزات / لیفتینگ"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">وضعیت حفاظ‌ها و سیستم‌های ایمنی</label>
                      <input
                        type="text"
                        value={item.guarding_status}
                        onChange={(e) => {
                          const updated = [...machinery];
                          updated[idx].guarding_status = e.target.value;
                          setMachinery(updated);
                        }}
                        placeholder="مثال: پرده نوری، فرمان دو دستی، میکروسوئیچ حد"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">وضعیت نگهداری و تعمیرات (PM)</label>
                      <input
                        type="text"
                        value={item.maintenance_status}
                        onChange={(e) => {
                          const updated = [...machinery];
                          updated[idx].maintenance_status = e.target.value;
                          setMachinery(updated);
                        }}
                        placeholder="مثال: سرویس ماهانه انجام شده / تست دوره‌ای معتبر"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5 */}
        {currentStep === 5 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-indigo-600" />
                  گام ۵: مواد شیمیایی، گازهای تحت فشار و عوامل زیان‌آور
                </h3>
                <p className="text-xs text-slate-500 mt-1">کپسول‌های گاز، تینرها، رنگ‌ها و مواد مصرفی کارگاه را ثبت فرمایید.</p>
              </div>
              <button
                type="button"
                onClick={handleAddMaterial}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> افزودن ماده / گاز
              </button>
            </div>
            <div className="space-y-3">
              {materials.map((mat, idx) => (
                <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50/60 space-y-3 relative hover:border-indigo-300 transition-colors">
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterial(idx)}
                    className="absolute top-3 left-3 text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                    title="حذف این ردیف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">نام ماده یا گاز *</label>
                      <input
                        type="text"
                        value={mat.name}
                        onChange={(e) => {
                          const updated = [...materials];
                          updated[idx].name = e.target.value;
                          setMaterials(updated);
                        }}
                        placeholder="مثال: کپسول استیلن و اکسیژن"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">طبقه‌بندی خطر</label>
                      <input
                        type="text"
                        value={mat.classification}
                        onChange={(e) => {
                          const updated = [...materials];
                          updated[idx].classification = e.target.value;
                          setMaterials(updated);
                        }}
                        placeholder="قابل اشتعال، اکسیدکننده، خورنده..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">حجم تقریبی یا تعداد</label>
                      <input
                        type="text"
                        value={mat.approximate_volume}
                        onChange={(e) => {
                          const updated = [...materials];
                          updated[idx].approximate_volume = e.target.value;
                          setMaterials(updated);
                        }}
                        placeholder="مثال: ۱۰ کپسول، ۵۰ لیتر"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">روش انبارش و مهار</label>
                      <input
                        type="text"
                        value={mat.storage_method}
                        onChange={(e) => {
                          const updated = [...materials];
                          updated[idx].storage_method = e.target.value;
                          setMaterials(updated);
                        }}
                        placeholder="در استند مهار زنجیری با فاصله ایمن ۶ متری"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                    <div className="pt-4">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mat.msds_available}
                          onChange={(e) => {
                            const updated = [...materials];
                            updated[idx].msds_available = e.target.checked;
                            setMaterials(updated);
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        برگه اطلاعات ایمنی (MSDS) در دسترس است
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 6 */}
        {currentStep === 6 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-indigo-600" />
                گام ۶: سلسله‌مراتب کنترل‌های موجود در کارگاه
              </h3>
              <p className="text-xs text-slate-500 mt-1">کنترل‌های مهندسی، اداری، PPE و سیستم پروانه‌های کار (PTW).</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">کنترل‌های مهندسی موجود</label>
                <textarea
                  rows={3}
                  value={engControlsStr}
                  onChange={(e) => setEngControlsStr(e.target.value)}
                  placeholder="هودهای مکنده موضعی، توری‌های محافظ، عایق صوتی، پرده نوری..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">کنترل‌های مدیریتی و اجرایی</label>
                <textarea
                  rows={3}
                  value={admControlsStr}
                  onChange={(e) => setAdmControlsStr(e.target.value)}
                  placeholder="آموزش‌های بدو استخدام، دستورالعمل‌های کاری، تابلوهای ایمنی، چرخش شغلی..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تجهیزات حفاظت فردی (PPE) تهیه‌شده</label>
                <textarea
                  rows={2}
                  value={ppeStr}
                  onChange={(e) => setPpeStr(e.target.value)}
                  placeholder="کلاه ایمنی، کفش پنجه فولادی، عینک ضد تراشه، شیلد جوشکاری، گوشی..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سیستم پروانه‌های انجام کار (PTW)</label>
                <textarea
                  rows={2}
                  value={permitsStr}
                  onChange={(e) => setPermitsStr(e.target.value)}
                  placeholder="پروانه کار گرم، پروانه ورود به فضای بسته، پروانه کار در ارتفاع..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 7 */}
        {currentStep === 7 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-indigo-600" />
                  گام ۷: سوابق حوادث، شبه‌حوادث و بازرسی‌های قبلی
                </h3>
                <p className="text-xs text-slate-500 mt-1">حوادث و رویدادهای پیشین کارگاه جهت کالیبراسیون تحلیل ریسک هوش مصنوعی.</p>
              </div>
              <button
                type="button"
                onClick={handleAddIncident}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> افزودن رویداد
              </button>
            </div>
            <div className="space-y-3">
              {incidents.map((inc, idx) => (
                <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50/60 space-y-3 relative hover:border-indigo-300 transition-colors">
                  <button
                    type="button"
                    onClick={() => handleRemoveIncident(idx)}
                    className="absolute top-3 left-3 text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                    title="حذف این ردیف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">زمان / دوره رویداد</label>
                      <input
                        type="text"
                        value={inc.date_or_period}
                        onChange={(e) => {
                          const updated = [...incidents];
                          updated[idx].date_or_period = e.target.value;
                          setIncidents(updated);
                        }}
                        placeholder="مثال: ۳ ماه گذشته / زمستان ۱۴۰۲"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع رویداد یا آسیب</label>
                      <input
                        type="text"
                        value={inc.incident_type}
                        onChange={(e) => {
                          const updated = [...incidents];
                          updated[idx].incident_type = e.target.value;
                          setIncidents(updated);
                        }}
                        placeholder="آسیب چشمی، سقوط قطعه، سوختگی..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">شدت پیامد</label>
                      <input
                        type="text"
                        value={inc.severity}
                        onChange={(e) => {
                          const updated = [...incidents];
                          updated[idx].severity = e.target.value;
                          setIncidents(updated);
                        }}
                        placeholder="جزئی، متوسط، شدید..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">شرح علت و چگونگی رویداد</label>
                    <input
                      type="text"
                      value={inc.description}
                      onChange={(e) => {
                        const updated = [...incidents];
                        updated[idx].description = e.target.value;
                        setIncidents(updated);
                      }}
                      placeholder="علت نقص حفاظتی یا خطای انسانی را توضیح دهید..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 8 */}
        {currentStep === 8 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                گام ۸: وضعیت آمادگی و واکنش در شرایط اضطراری (ERP)
              </h3>
              <p className="text-xs text-slate-500 mt-1">اطفاء حریق، امداد و نجات، ایستگاه‌های شستشو و سناریوهای تخلیه.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fireExtinguishers}
                    onChange={(e) => setFireExtinguishers(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  کپسول‌ها و تجهیزات اطفاء حریق متناسب با کلاس حریق مهیاست
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eyewash}
                    onChange={(e) => setEyewash(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  دوش و چشم‌شوی ایمنی فعال و متصل به آب شرب در دسترس است
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={firstAid}
                    onChange={(e) => setFirstAid(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  جعبه کمک‌های اولیه با اقلام تاریخ‌دار و استاندارد مهیاست
                </label>
              </div>
              <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emergencyExits}
                    onChange={(e) => setEmergencyExits(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  مسیرها و درب‌های خروج اضطراری باز، بدون مانع و دارای تابلوی شب‌نما هستند
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evacuationPlan}
                    onChange={(e) => setEvacuationPlan(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  نقشه و سناریوی تخلیه اضطراری نصب و مانور سالانه اجرا شده است
                </label>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-slate-700">تعداد امدادگران آموزش‌دیده:</span>
                  <input
                    type="number"
                    min={0}
                    value={firstAiders}
                    onChange={(e) => setFirstAiders(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white text-center font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 9 */}
        {currentStep === 9 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                گام ۹: الزامات قانونی، استانداردهای مرجع و پیش‌نمایش نهایی
              </h3>
              <p className="text-xs text-slate-500 mt-1">استانداردهای ملاک عمل و خط‌مشی‌های سازمانی قبل از ارسال به AvalAI.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  استانداردها و آیین‌نامه‌های مرجع (هر مورد در یک سطر)
                </label>
                <textarea
                  rows={4}
                  value={standardsStr}
                  onChange={(e) => setStandardsStr(e.target.value)}
                  placeholder="آیین‌نامه حفاظت فنی وزارت کار، استاندارد OSHA 1910، استاندارد ISO 45001..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  خط‌مشی‌ها و تعهدات داخلی سازمان
                </label>
                <textarea
                  rows={4}
                  value={policiesStr}
                  onChange={(e) => setPoliciesStr(e.target.value)}
                  placeholder="خط‌مشی توقف کار ناایمن (Stop-Work)، ممنوعیت کار بدون PPE..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Summary Preview Box */}
            <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border border-indigo-200 rounded-xl p-5 mt-4 shadow-sm">
              <h4 className="text-xs font-black text-indigo-950 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                پیش‌نمایش داده‌های ارسالی به موتور هوش مصنوعی AvalAI
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">واحد کارگاه</span>
                  <strong className="text-slate-800 font-bold">{workplaceName || "کارگاه اصلی"}</strong>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">شاغلین</span>
                  <strong className="text-slate-800 font-bold">{workerCount.toLocaleString("fa-IR")} نفر ({shiftCount.toLocaleString("fa-IR")} شیفت)</strong>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">دستگاه‌های ثبت‌شده</span>
                  <strong className="text-slate-800 font-bold">{machinery.filter((m) => m.name.trim()).length.toLocaleString("fa-IR")} دستگاه</strong>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">مواد شیمیایی</span>
                  <strong className="text-slate-800 font-bold">{materials.filter((m) => m.name.trim()).length.toLocaleString("fa-IR")} قلم</strong>
                </div>
              </div>
              <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">
                پس از زدن دکمه زیر، اطلاعات به‌صورت امن ارسال شده و تحلیل جامع ریسک‌ها، محاسبه ماتریس ۵×۵ و پیش‌نویس چک‌لیست بازرسی تولید خواهد شد.
              </p>
            </div>
          </div>
        )}

        {/* Footer Navigation Bar */}
        <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              انصراف و بازگشت
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                گام قبلی
              </button>
            )}
            {currentStep < 9 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/25 cursor-pointer"
              >
                گام بعدی
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs md:text-sm font-black transition-all shadow-xl shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {loading ? "در حال ارسال و تحلیل توسط هوش مصنوعی..." : "ثبت و تحلیل هوشمند مخاطرات (AvalAI)"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
