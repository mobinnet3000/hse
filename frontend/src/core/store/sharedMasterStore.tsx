import React, { createContext, useContext, useState, type ReactNode } from "react";
import type {
  MasterCompany,
  MasterProject,
  MasterSiteLocation,
  MasterOperationalArea,
  MasterContractor,
  MasterPersonnel,
  MasterEquipment,
  MasterChemicalMaterial,
  TraceabilityChainData,
  TraceabilityStep,
} from "../contracts/sharedData.types";

interface SharedMasterState {
  companies: MasterCompany[];
  projects: MasterProject[];
  sites: MasterSiteLocation[];
  areas: MasterOperationalArea[];
  contractors: MasterContractor[];
  personnel: MasterPersonnel[];
  equipment: MasterEquipment[];
  chemicals: MasterChemicalMaterial[];
  traceChains: TraceabilityChainData[];

  // Helper selectors and mutators
  getProjectById: (id: string) => MasterProject | undefined;
  getContractorById: (id: string) => MasterContractor | undefined;
  getEquipmentById: (id: string) => MasterEquipment | undefined;
  addTraceNode: (trackingCode: string, step: TraceabilityStep) => void;
  createTraceChain: (originModule: string, objectId: string, title: string) => TraceabilityChainData;
}

const defaultCompanies: MasterCompany[] = [
  { id: "comp-1", name: "شرکت ملی صنایع پتروشیمی ایران", code: "NPC", industry: "نفت و گاز و پتروشیمی" },
  { id: "comp-2", name: "شرکت توسعه انرژی و معادن خاورمیانه", code: "MEMCO", industry: "صنایع معدنی و فلزی" },
];

const defaultProjects: MasterProject[] = [
  {
    id: "proj-101",
    companyId: "comp-1",
    name: "احداث واحد الفین و هیدروکراکر فاز ۱۴",
    code: "PRJ-OLF-14",
    phase: "construction",
    phaseDisplay: "فاز ساخت و نصب تجهیزات",
    clientName: "شرکت نفت و گاز پارس",
    startDate: "2024-03-21",
  },
  {
    id: "proj-102",
    companyId: "comp-2",
    name: "عملیات استخراج و خردایش معدن سنگ‌آهن چادرملو",
    code: "PRJ-MINE-02",
    phase: "operation",
    phaseDisplay: "بهره‌برداری و استخراج پیوسته",
    clientName: "سازمان توسعه و نوسازی معادن (ایمیدرو)",
    startDate: "2023-09-01",
  },
];

const defaultContractors: MasterContractor[] = [
  {
    id: "cont-1",
    companyName: "شرکت مهندسی و ساختمان کیسون",
    nationalId: "10100889210",
    contractNumber: "CNT-2025-88",
    hseGrade: "A",
    status: "active",
    representativeName: "مهندس علیرضا رضایی",
    representativePhone: "۰۹۱۲۳۴۵۶۷۸۹",
  },
  {
    id: "cont-2",
    companyName: "صنایع فولاد و نصب مکانیکی پتروسازان",
    nationalId: "10200774321",
    contractNumber: "CNT-2024-12",
    hseGrade: "B",
    status: "active",
    representativeName: "مهندس جواد مرادی",
    representativePhone: "۰۹۱۷۱۱۱۲۲۳۳",
  },
];

const defaultEquipment: MasterEquipment[] = [
  {
    id: "eq-1",
    assetTag: "CRN-LIEB-250",
    name: "جرثقیل کارگاهی ۲۵۰ تن تادانو",
    category: "lifting",
    safetyCritical: true,
    certificateExpiryDate: "2027-02-15",
    healthStatus: "operational",
  },
  {
    id: "eq-2",
    assetTag: "CMP-ATLAS-75",
    name: "کمپرسور فشار قوی هوای ابزاردقیق",
    category: "machinery",
    safetyCritical: true,
    certificateExpiryDate: "2026-11-30",
    healthStatus: "operational",
  },
];

const defaultSites: MasterSiteLocation[] = [
  { id: "site-1", projectId: "proj-101", name: "سایت خشکی عسلویه - ناحیه پتروپارس", code: "ST-ASAL" },
  { id: "site-2", projectId: "proj-102", name: "پله‌های معدن روباز پیت جنوبی", code: "ST-MINE-S" },
];

const defaultAreas: MasterOperationalArea[] = [
  { id: "area-1", siteLocationId: "site-1", name: "پایپرک و منیفولد اصلی انتقال میعانات", code: "AR-PIPE-01", hazardLevel: "critical" },
  { id: "area-2", siteLocationId: "site-1", name: "مخازن تحت فشار ذخیره الفین TK-402", code: "AR-TK-402", hazardLevel: "critical" },
];

const defaultPersonnel: MasterPersonnel[] = [
  {
    id: "per-1",
    nationalCode: "0012345678",
    fullName: "محمد کاظمی",
    roleTitle: "سرپرست پروانه کار (PTW Issuer)",
    departmentId: "dep-hse",
    competencyCertificates: ["گواهی بین‌المللی NEBOSH IGC", "ممیزی داخلی ISO 45001"],
    authorizedOperations: ["صدور پروانه کار گرم", "ورود به فضای بسته", "باربرداری سنگین"],
  },
  {
    id: "per-2",
    nationalCode: "0098765432",
    fullName: "حسین ابراهیمی",
    roleTitle: "تکنسین ایمنی و گازسنجی (Gas Tester)",
    departmentId: "dep-hse",
    competencyCertificates: ["گواهینامه کار با دتکتورهای Multi-gas", "امداد و نجات در فضای بسته"],
    authorizedOperations: ["گازسنجی فضاهای محبوس", "دیدبان ایمنی Hole Watcher"],
  },
];

const defaultChemicals: MasterChemicalMaterial[] = [
  {
    id: "chem-1",
    commercialName: "سولفید هیدروژن (H2S)",
    casNumber: "7783-06-4",
    chemicalFormula: "H2S",
    ghsClassifications: ["سمی شدید تنفسی (GHS06)", "گاز شدیداً قابل اشتعال (GHS02)"],
    sdsDocumentCode: "SDS-H2S-REV4",
    storageConditions: "سیستم بسته با مانیتورینگ مستمر خط و فن ضدجرقه",
  },
];

const SharedMasterContext = createContext<SharedMasterState | null>(null);

export const SharedMasterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [companies] = useState<MasterCompany[]>(defaultCompanies);
  const [projects] = useState<MasterProject[]>(defaultProjects);
  const [contractors] = useState<MasterContractor[]>(defaultContractors);
  const [equipment] = useState<MasterEquipment[]>(defaultEquipment);
  const [sites] = useState<MasterSiteLocation[]>(defaultSites);
  const [areas] = useState<MasterOperationalArea[]>(defaultAreas);
  const [personnel] = useState<MasterPersonnel[]>(defaultPersonnel);
  const [chemicals] = useState<MasterChemicalMaterial[]>(defaultChemicals);

  const [traceChains, setTraceChains] = useState<TraceabilityChainData[]>([
    {
      chainId: "chain-1",
      trackingCode: "TRC-2026-INC-102",
      title: "زنجیره ردیابی حادثه افت فشار خط لوله تا ارزیابی ریسک و راستی‌آزمایی CAPA",
      originModule: "incidents",
      steps: [
        {
          module: "incidents",
          objectId: "INC-102",
          referenceCode: "INC-102",
          title: "گزارش نشت بخارات الفین در فلنج شیر ورودی",
          timestamp: "2026-11-20 09:15",
          actorName: "مهندس احمدی (سرپرست شیفت)",
          status: "تحلیل ریشه‌ای انجام شد",
        },
        {
          module: "risks",
          objectId: "RSK-205",
          referenceCode: "RR-PETRO-2026-001",
          title: "بازنگری فوری در سناریوی نشت و تجدید امتیاز RPN",
          timestamp: "2026-11-20 14:30",
          actorName: "دکتر حسینی (مدیر ارشد HSE)",
          status: "ارزیابی تصویب شد",
        },
        {
          module: "capa",
          objectId: "CAPA-401",
          referenceCode: "CAPA-401",
          title: "تعویض پکینگ و نصب دتکتور بی‌سیم آکوستیک",
          timestamp: "2026-11-22 11:00",
          actorName: "مهندسی تعمیرات و بازرسی فنی",
          status: "اقدام تکمیل گردید",
        },
        {
          module: "verification",
          objectId: "VER-09",
          referenceCode: "VER-09",
          title: "راستی‌آزمایی اثربخشی بدون نشتی در فشار تست ۱۲ بار",
          timestamp: "2026-11-23 08:00",
          actorName: "واحد ممیزی و تضمین کیفیت",
          status: "تأیید نهایی و بایگانی",
        },
      ],
    },
  ]);

  const getProjectById = (id: string) => projects.find((p) => p.id === id);
  const getContractorById = (id: string) => contractors.find((c) => c.id === id);
  const getEquipmentById = (id: string) => equipment.find((e) => e.id === id);

  const addTraceNode = (trackingCode: string, step: TraceabilityStep) => {
    setTraceChains((prev) =>
      prev.map((c) => (c.trackingCode === trackingCode ? { ...c, steps: [...c.steps, step] } : c))
    );
  };

  const createTraceChain = (originModule: string, objectId: string, title: string): TraceabilityChainData => {
    const trackingCode = `TRC-${new Date().getFullYear()}-${originModule.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const newChain: TraceabilityChainData = {
      chainId: `chain-${Date.now()}`,
      trackingCode,
      title,
      originModule,
      steps: [
        {
          module: originModule as any,
          objectId,
          referenceCode: objectId,
          title: `آغاز رویداد در ماژول ${originModule}`,
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
          actorName: "کاربر سامانه",
          status: "ثبت اولیه",
        },
      ],
    };
    setTraceChains((prev) => [newChain, ...prev]);
    return newChain;
  };

  return (
    <SharedMasterContext.Provider
      value={{
        companies,
        projects,
        sites,
        areas,
        contractors,
        personnel,
        equipment,
        chemicals,
        traceChains,
        getProjectById,
        getContractorById,
        getEquipmentById,
        addTraceNode,
        createTraceChain,
      }}
    >
      {children}
    </SharedMasterContext.Provider>
  );
};

export const useSharedMasterData = () => {
  const ctx = useContext(SharedMasterContext);
  if (!ctx) {
    return {
      companies: defaultCompanies,
      projects: defaultProjects,
      sites: defaultSites,
      areas: defaultAreas,
      contractors: defaultContractors,
      personnel: defaultPersonnel,
      equipment: defaultEquipment,
      chemicals: defaultChemicals,
      traceChains: [],
      getProjectById: (id: string) => defaultProjects.find((p) => p.id === id),
      getContractorById: (id: string) => defaultContractors.find((c) => c.id === id),
      getEquipmentById: (id: string) => defaultEquipment.find((e) => e.id === id),
      addTraceNode: () => {},
      createTraceChain: (originModule: string, objectId: string, title: string) => ({
        id: "chain-fallback",
        trackingCode: `TRC-FLB-${Date.now()}`,
        title,
        originModule,
        originObjectId: objectId,
        createdAt: new Date().toISOString(),
        steps: [],
      }),
    };
  }
  return ctx;
};
