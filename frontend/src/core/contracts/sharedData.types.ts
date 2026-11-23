/**
 * Shared Master Data Contracts (Single Source of Truth)
 * تمام ۲۰ ماژول سامانه به این قراردادهای مرجع متصل می‌شوند تا از ایجاد داده‌های تکراری جلوگیری شود.
 */

export interface MasterCompany {
  id: string;
  name: string;
  code: string;
  industry: string;
}

export interface MasterDepartment {
  id: string;
  companyId: string;
  name: string;
  code: string;
  managerName?: string;
}

export interface MasterProject {
  id: string;
  companyId: string;
  name: string;
  code: string;
  phase: "engineering" | "procurement" | "construction" | "commissioning" | "operation" | "decommissioning";
  phaseDisplay: string;
  clientName: string;
  startDate: string;
  targetEndDate?: string;
}

export interface MasterSiteLocation {
  id: string;
  projectId: string;
  name: string;
  code: string;
  coordinates?: { lat: number; lng: number };
}

export interface MasterOperationalArea {
  id: string;
  siteLocationId: string;
  name: string;
  code: string;
  hazardLevel: "low" | "medium" | "high" | "critical";
}

export interface MasterContractor {
  id: string;
  companyName: string;
  nationalId: string;
  contractNumber: string;
  hseGrade: "A" | "B" | "C" | "D";
  status: "active" | "suspended" | "pending_review";
  representativeName: string;
  representativePhone: string;
}

export interface MasterPersonnel {
  id: string;
  nationalCode: string;
  fullName: string;
  roleTitle: string;
  departmentId: string;
  contractorId?: string;
  competencyCertificates: string[];
  authorizedOperations: string[];
}

export interface MasterEquipment {
  id: string;
  assetTag: string;
  name: string;
  category: "lifting" | "machinery" | "vessel" | "electrical" | "scaffold" | "vehicle";
  safetyCritical: boolean;
  certificateExpiryDate?: string;
  healthStatus: "operational" | "maintenance_required" | "decommissioned";
}

export interface MasterChemicalMaterial {
  id: string;
  casNumber?: string;
  commercialName: string;
  chemicalFormula?: string;
  ghsClassifications: string[];
  sdsDocumentCode?: string;
  storageConditions: string;
}

/**
 * زنجیره ردیابی یکپارچه بین‌ماژولی
 * Incident ID -> Risk ID -> CAPA ID -> Verification ID
 */
export interface TraceabilityStep {
  module: "incidents" | "risks" | "ptw" | "inspections" | "capa" | "verification" | "moc" | "findings";
  objectId: string;
  referenceCode: string;
  title: string;
  timestamp: string;
  actorName: string;
  status: string;
}

export interface TraceabilityChainData {
  chainId: string;
  trackingCode: string;
  title: string;
  originModule: string;
  steps: TraceabilityStep[];
}
