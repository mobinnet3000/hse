/**
 * Occupational Health Medical Confidentiality & Role-Based Guard
 * 
 * اصل معماری: اطلاعات پزشکی و پرونده‌های بیماری کارکنان هرگز نباید بدون کنترل دسترسی
 * در اختیار سایر ماژول‌ها یا پرسنل غیرپزشکی قرار گیرند.
 * سایر بخش‌ها (نظیر Risk, PTW, Training, HR) فقط مجاز به دریافت داده‌های عملیاتی
 * مانند وضعیت تناسب شغلی (Fit-for-Work) و محدودیت‌های کاری هستند.
 */

export interface MedicalRecordRaw {
  employeeId: string;
  fullName: string;
  medicalRecordNumber: string;
  clinicalDiagnosis: string;       // محرمانه
  laboratoryResults: string[];     // محرمانه
  audiometryDecibels: number;      // محرمانه
  spirometryLungVolume: number;    // محرمانه
  underlyingIllness: string[];     // محرمانه
  doctorNotes: string;             // محرمانه
  
  // اطلاعات عملیاتی مجاز برای انتشار بین‌ماژولی:
  fitnessStatus: "fit" | "fit_with_restriction" | "temporarily_unfit" | "permanently_unfit";
  workRestrictions: string[];      // مثلا: عدم کار در ارتفاع، عدم مواجهه با صدای بالای ۸۵ دسی‌بل
  nextCheckupDate: string;
  authorizedShiftDurationHours: number;
}

export interface SanitizedOperationalHealthInfo {
  employeeId: string;
  fullName: string;
  fitnessStatus: "fit" | "fit_with_restriction" | "temporarily_unfit" | "permanently_unfit";
  fitnessStatusDisplay: string;
  workRestrictions: string[];
  nextCheckupDate: string;
  authorizedShiftDurationHours: number;
  confidentialDataProtected: true;
}

export class HealthDataGuard {
  /**
   * بررسی اینکه آیا کاربر جاری دارای نقش مجاز طب کار (پزشک معتمد یا بازرس سلامت حرفه‌ای) است
   */
  static isAuthorizedMedicalPersonnel(userRoles: string[]): boolean {
    const authorizedRoles = ["occupational_physician", "health_inspector", "chief_medical_officer"];
    return userRoles.some((r) => authorizedRoles.includes(r));
  }

  /**
   * پالایش و ماسک کردن داده‌های پزشکی قبل از ارسال به ماژول‌های دیگر (PTW, Risk, Operations)
   */
  static sanitizeForOperationalUse(raw: MedicalRecordRaw, userRoles: string[] = []): SanitizedOperationalHealthInfo | MedicalRecordRaw {
    if (this.isAuthorizedMedicalPersonnel(userRoles)) {
      // پرسنل پزشک مجاز به دیدن پرونده کامل هستند
      return raw;
    }

    const fitnessLabels = {
      fit: "سالم و متناسب با شغل (Fit)",
      fit_with_restriction: "متناسب با اعمال محدودیت کاری (Restricted)",
      temporarily_unfit: "نامتناسب موقت (Under Treatment)",
      permanently_unfit: "نامتناسب دائم برای این رده شغلی (Unfit)",
    };

    // ماسک کردن کامل فیلدهای تشخیصی و بالینی:
    return {
      employeeId: raw.employeeId,
      fullName: raw.fullName,
      fitnessStatus: raw.fitnessStatus,
      fitnessStatusDisplay: fitnessLabels[raw.fitnessStatus] || "نامشخص",
      workRestrictions: raw.workRestrictions,
      nextCheckupDate: raw.nextCheckupDate,
      authorizedShiftDurationHours: raw.authorizedShiftDurationHours,
      confidentialDataProtected: true,
    };
  }
}
