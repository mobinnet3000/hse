import { useEffect, useState } from "react";
import {
  createEnvironmentalAspect,
  createEnvironmentalThreshold,
  createOccupationalHygiene,
  createWasteRecord,
  createWastewaterEmission,
  fetchEnvironmentalAspects,
  fetchEnvironmentalSummary,
  fetchEnvironmentalThresholds,
  fetchOccupationalHygienes,
  fetchWasteRecords,
  fetchWastewaterEmissions,
  fetchWorkplaces,
  updateWasteStatus,
  type EnvironmentalAspect,
  type EnvironmentalSummary,
  type EnvironmentalThreshold,
  type OccupationalHygieneRecord,
  type WasteRecord,
  type WastewaterEmissionRecord,
  type Workplace,
} from "../../services/api";

type TabType = "emissions" | "hygiene" | "waste" | "aspects_thresholds";

export function EnvironmentPage() {
  const [activeTab, setActiveTab] = useState<TabType>("emissions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<EnvironmentalSummary | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [emissions, setEmissions] = useState<WastewaterEmissionRecord[]>([]);
  const [hygienes, setHygienes] = useState<OccupationalHygieneRecord[]>([]);
  const [wastes, setWastes] = useState<WasteRecord[]>([]);
  const [aspects, setAspects] = useState<EnvironmentalAspect[]>([]);
  const [thresholds, setThresholds] = useState<EnvironmentalThreshold[]>([]);

  // Modals
  const [showEmissionModal, setShowEmissionModal] = useState(false);
  const [showHygieneModal, setShowHygieneModal] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showWasteStatusModal, setShowWasteStatusModal] = useState<WasteRecord | null>(null);
  const [showAspectModal, setShowAspectModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);

  // Form states
  const [emissionForm, setEmissionForm] = useState({
    workplace: "",
    sampling_point: "",
    category: "wastewater",
    sample_date: new Date().toISOString().slice(0, 10),
    parameter: "COD",
    measured_value: "",
    unit: "mg/L",
    laboratory_name: "",
    test_report_number: "",
    notes: "",
  });

  const [hygieneForm, setHygieneForm] = useState({
    workplace: "",
    category: "noise",
    location_details: "",
    survey_date: new Date().toISOString().slice(0, 10),
    surveyor_name: "",
    measured_value: "",
    unit: "dBA",
    control_recommendation: "",
  });

  const [wasteForm, setWasteForm] = useState({
    workplace: "",
    waste_name: "",
    waste_type: "hazardous",
    quantity: "",
    unit: "kg",
    storage_location: "",
    generation_date: new Date().toISOString().slice(0, 10),
  });

  const [wasteStatusForm, setWasteStatusForm] = useState({
    status: "transferred",
    consignment_number: "",
    disposal_facility: "",
    disposal_method: "",
  });

  const [aspectForm, setAspectForm] = useState({
    workplace: "",
    activity_or_process: "",
    aspect: "",
    impact: "",
    condition: "normal",
    severity_score: "3",
    probability_score: "3",
    control_measures: "",
  });

  const [thresholdForm, setThresholdForm] = useState({
    name: "",
    category: "wastewater",
    parameter: "COD",
    limit_type: "max_limit",
    limit_value: "",
    min_value: "",
    unit: "mg/L",
    standard_reference: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, wpRes, emRes, hyRes, waRes, asRes, thRes] = await Promise.all([
        fetchEnvironmentalSummary(),
        fetchWorkplaces(),
        fetchWastewaterEmissions(),
        fetchOccupationalHygienes(),
        fetchWasteRecords(),
        fetchEnvironmentalAspects(),
        fetchEnvironmentalThresholds(),
      ]);
      setSummary(sumRes);
      setWorkplaces(wpRes);
      setEmissions(emRes);
      setHygienes(hyRes);
      setWastes(waRes);
      setAspects(asRes);
      setThresholds(thRes);
    } catch (err: any) {
      setError(err?.message || "خطا در دریافت اطلاعات محیط زیست و بهداشت حرفه‌ای");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers
  const handleCreateEmission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWastewaterEmission({
        workplace: Number(emissionForm.workplace),
        sampling_point: emissionForm.sampling_point,
        category: emissionForm.category,
        sample_date: emissionForm.sample_date,
        parameter: emissionForm.parameter,
        measured_value: Number(emissionForm.measured_value),
        unit: emissionForm.unit,
        laboratory_name: emissionForm.laboratory_name,
        test_report_number: emissionForm.test_report_number,
        notes: emissionForm.notes,
      });
      setShowEmissionModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || "خطا در ثبت نمونه پساب/آلاینده");
    }
  };

  const handleCreateHygiene = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createOccupationalHygiene({
        workplace: Number(hygieneForm.workplace),
        category: hygieneForm.category,
        location_details: hygieneForm.location_details,
        survey_date: hygieneForm.survey_date,
        surveyor_name: hygieneForm.surveyor_name,
        measured_value: Number(hygieneForm.measured_value),
        unit: hygieneForm.unit,
        control_recommendation: hygieneForm.control_recommendation,
      });
      setShowHygieneModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || "خطا در ثبت سنجش بهداشت حرفه‌ای");
    }
  };

  const handleCreateWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWasteRecord({
        workplace: Number(wasteForm.workplace),
        waste_name: wasteForm.waste_name,
        waste_type: wasteForm.waste_type,
        quantity: Number(wasteForm.quantity),
        unit: wasteForm.unit,
        storage_location: wasteForm.storage_location,
        generation_date: wasteForm.generation_date,
        status: "stored",
      });
      setShowWasteModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || "خطا در ثبت ضایعات/پسماند");
    }
  };

  const handleUpdateWasteStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showWasteStatusModal) return;
    try {
      await updateWasteStatus(showWasteStatusModal.id, {
        status: wasteStatusForm.status,
        consignment_number: wasteStatusForm.consignment_number,
        disposal_facility: wasteStatusForm.disposal_facility,
        disposal_method: wasteStatusForm.disposal_method,
      });
      setShowWasteStatusModal(null);
      loadData();
    } catch (err: any) {
      alert(err?.message || "خطا در به‌روزرسانی وضعیت پسماند");
    }
  };

  const handleCreateAspect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEnvironmentalAspect({
        workplace: Number(aspectForm.workplace),
        activity_or_process: aspectForm.activity_or_process,
        aspect: aspectForm.aspect,
        impact: aspectForm.impact,
        condition: aspectForm.condition,
        severity_score: Number(aspectForm.severity_score),
        probability_score: Number(aspectForm.probability_score),
        control_measures: aspectForm.control_measures,
      });
      setShowAspectModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || "خطا در ایجاد جنبه زیست‌محیطی");
    }
  };

  const handleCreateThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEnvironmentalThreshold({
        name: thresholdForm.name,
        category: thresholdForm.category,
        parameter: thresholdForm.parameter,
        limit_type: thresholdForm.limit_type,
        limit_value: Number(thresholdForm.limit_value),
        min_value: thresholdForm.min_value ? Number(thresholdForm.min_value) : null,
        unit: thresholdForm.unit,
        standard_reference: thresholdForm.standard_reference,
      });
      setShowThresholdModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || "خطا در تعریف استاندارد حد مجاز");
    }
  };

  return (
    <div className="environment-page" dir="rtl" style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
            🌱 مدیریت محیط زیست و بهداشت حرفه‌ای (ISO 14001 & Occupational Hygiene)
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", marginTop: "0.3rem" }}>
            سامانه پایش پساب، گازهای خروجی، عوامل زیان‌آور فیزیکی/شیمیایی، ردیابی پسماندهای ویژه و جنبه‌های بارز.
          </p>
        </div>
        <button
          className="button button-secondary"
          onClick={loadData}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          🔄 به‌روزرسانی
        </button>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: "8px", marginBottom: "1.5rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1rem", borderRight: "4px solid #10b981" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>جنبه‌های زیست‌محیطی</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: "0.4rem" }}>
              {summary.aspects_significant} <span style={{ fontSize: "0.9rem", fontWeight: 400 }}>بارز / {summary.aspects_total} کل</span>
            </div>
          </div>
          <div className="card" style={{ padding: "1rem", borderRight: "4px solid #f59e0b" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>پسماندهای ویژه و انبارش</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: "0.4rem" }}>
              {summary.hazardous_waste_kg.toLocaleString()} <span style={{ fontSize: "0.9rem", fontWeight: 400 }}>کیلوگرم ویژه</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{summary.active_stored_waste_count} محموله در سایت</div>
          </div>
          <div className="card" style={{ padding: "1rem", borderRight: "4px solid #ef4444" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>تخطی از حدود پساب/دودکش</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: "0.4rem", color: summary.emission_exceedances_count > 0 ? "#ef4444" : "var(--color-text)" }}>
              {summary.emission_exceedances_count} <span style={{ fontSize: "0.9rem", fontWeight: 400 }}>تخطی ثبت‌شده</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>از {summary.emission_records_count} نمونه آزمایشگاهی</div>
          </div>
          <div className="card" style={{ padding: "1rem", borderRight: "4px solid #8b5cf6" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>مخاطرات بهداشت حرفه‌ای (TLV)</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: "0.4rem", color: summary.hygiene_exceedances_count > 0 ? "#8b5cf6" : "var(--color-text)" }}>
              {summary.hygiene_exceedances_count} <span style={{ fontSize: "0.9rem", fontWeight: 400 }}>ایستگاه بحرانی</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>از {summary.hygiene_surveys_count} ایستگاه سنجش‌شده</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", marginBottom: "1.5rem", gap: "0.5rem" }}>
        <button
          className={`tab-item ${activeTab === "emissions" ? "active" : ""}`}
          onClick={() => setActiveTab("emissions")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "emissions" ? "3px solid #10b981" : "3px solid transparent",
            fontWeight: activeTab === "emissions" ? 700 : 500,
            color: activeTab === "emissions" ? "#10b981" : "var(--color-text-muted)",
            cursor: "pointer",
          }}
        >
          🔬 پایش پساب و خروجی‌ها (Emissions)
        </button>
        <button
          className={`tab-item ${activeTab === "hygiene" ? "active" : ""}`}
          onClick={() => setActiveTab("hygiene")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "hygiene" ? "3px solid #8b5cf6" : "3px solid transparent",
            fontWeight: activeTab === "hygiene" ? 700 : 500,
            color: activeTab === "hygiene" ? "#8b5cf6" : "var(--color-text-muted)",
            cursor: "pointer",
          }}
        >
          🎧 بهداشت حرفه‌ای و مواجهه شغلی (Hygiene)
        </button>
        <button
          className={`tab-item ${activeTab === "waste" ? "active" : ""}`}
          onClick={() => setActiveTab("waste")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "waste" ? "3px solid #f59e0b" : "3px solid transparent",
            fontWeight: activeTab === "waste" ? 700 : 500,
            color: activeTab === "waste" ? "#f59e0b" : "var(--color-text-muted)",
            cursor: "pointer",
          }}
        >
          📦 مدیریت و مانیفست پسماند (Waste Register)
        </button>
        <button
          className={`tab-item ${activeTab === "aspects_thresholds" ? "active" : ""}`}
          onClick={() => setActiveTab("aspects_thresholds")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "aspects_thresholds" ? "3px solid #3b82f6" : "3px solid transparent",
            fontWeight: activeTab === "aspects_thresholds" ? 700 : 500,
            color: activeTab === "aspects_thresholds" ? "#3b82f6" : "var(--color-text-muted)",
            cursor: "pointer",
          }}
        >
          📑 جنبه‌های بارز ISO 14001 و حدود آستانه
        </button>
      </div>

      {/* TAB 1: EMISSIONS */}
      {activeTab === "emissions" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>سوابق آزمون و نمونه‌برداری پساب صنعتی و گازهای خروجی</h3>
            <button className="button button-primary" onClick={() => setShowEmissionModal(true)}>
              ➕ ثبت نتیجه آزمایش جدید
            </button>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-secondary)" }}>
                  <th style={{ padding: "0.75rem" }}>نقطه نمونه‌برداری</th>
                  <th style={{ padding: "0.75rem" }}>دسته‌بندی</th>
                  <th style={{ padding: "0.75rem" }}>تاریخ نمونه</th>
                  <th style={{ padding: "0.75rem" }}>پارامتر</th>
                  <th style={{ padding: "0.75rem" }}>مقدار اندازه‌گیری</th>
                  <th style={{ padding: "0.75rem" }}>حد استاندارد</th>
                  <th style={{ padding: "0.75rem" }}>وضعیت تطابق</th>
                  <th style={{ padding: "0.75rem" }}>آزمایشگاه و شماره گزارش</th>
                  <th style={{ padding: "0.75rem" }}>عدم انطباق (CAPA)</th>
                </tr>
              </thead>
              <tbody>
                {emissions.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                      هیچ نمونه آزمایشگاهی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  emissions.map((em) => (
                    <tr key={em.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "0.75rem", fontWeight: 600 }}>{em.sampling_point}</td>
                      <td style={{ padding: "0.75rem" }}>{em.category_display}</td>
                      <td style={{ padding: "0.75rem" }}>{em.sample_date}</td>
                      <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>{em.parameter}</td>
                      <td style={{ padding: "0.75rem", fontWeight: 700 }}>
                        {em.measured_value} {em.unit}
                      </td>
                      <td style={{ padding: "0.75rem", color: "var(--color-text-muted)" }}>
                        {em.standard_limit !== null ? `${em.standard_limit} ${em.unit}` : "-"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {em.is_exceedance ? (
                          <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", backgroundColor: "#fee2e2", color: "#dc2626", fontWeight: 700 }}>
                            🚨 تخطی از حد مجاز
                          </span>
                        ) : (
                          <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", backgroundColor: "#dcfce7", color: "#16a34a", fontWeight: 600 }}>
                            ✓ مجاز و استاندارد
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {em.laboratory_name || "-"} {em.test_report_number && `(${em.test_report_number})`}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {em.non_conformity ? (
                          <span style={{ color: "#dc2626", fontSize: "0.85rem" }}>
                            عدم انطباق #{em.non_conformity}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)" }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: HYGIENE */}
      {activeTab === "hygiene" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>ارزیابی عوامل زیان‌آور محیط کار و حدود مواجهه شغلی (OEL/TLV)</h3>
            <button className="button button-primary" onClick={() => setShowHygieneModal(true)}>
              ➕ ثبت ارزیابی بهداشت حرفه‌ای
            </button>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-secondary)" }}>
                  <th style={{ padding: "0.75rem" }}>ایستگاه کاری / محل استقرار</th>
                  <th style={{ padding: "0.75rem" }}>عامل زیان‌آور</th>
                  <th style={{ padding: "0.75rem" }}>تاریخ سنجش</th>
                  <th style={{ padding: "0.75rem" }}>مقدار سنجش‌شده</th>
                  <th style={{ padding: "0.75rem" }}>حد آستانه (TLV)</th>
                  <th style={{ padding: "0.75rem" }}>نتیجه ارزیابی ریسک</th>
                  <th style={{ padding: "0.75rem" }}>توصیه کنترلی کارشناس</th>
                  <th style={{ padding: "0.75rem" }}>کارشناس ارزیاب</th>
                </tr>
              </thead>
              <tbody>
                {hygienes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                      هیچ سابقه سنجش بهداشت حرفه‌ای ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  hygienes.map((hy) => (
                    <tr key={hy.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "0.75rem", fontWeight: 600 }}>{hy.location_details}</td>
                      <td style={{ padding: "0.75rem" }}>{hy.category_display}</td>
                      <td style={{ padding: "0.75rem" }}>{hy.survey_date}</td>
                      <td style={{ padding: "0.75rem", fontWeight: 700 }}>
                        {hy.measured_value} {hy.unit}
                      </td>
                      <td style={{ padding: "0.75rem", color: "var(--color-text-muted)" }}>
                        {hy.standard_limit !== null ? `${hy.standard_limit} ${hy.unit}` : "-"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {hy.assessment_result === "unacceptable" && (
                          <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", backgroundColor: "#fee2e2", color: "#dc2626", fontWeight: 700 }}>
                            ⚠️ غیرمجاز و بحرانی
                          </span>
                        )}
                        {hy.assessment_result === "warning" && (
                          <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", backgroundColor: "#fef3c7", color: "#b45309", fontWeight: 600 }}>
                            ⚡ آستانه هشدار
                          </span>
                        )}
                        {hy.assessment_result === "acceptable" && (
                          <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", backgroundColor: "#dcfce7", color: "#16a34a", fontWeight: 600 }}>
                            ✓ ایمن و مجاز
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem", maxWidth: "250px" }}>
                        {hy.control_recommendation || "-"}
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem" }}>{hy.surveyor_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: WASTE */}
      {activeTab === "waste" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>دفترچه ثبت و مانیفست حمل و امحاء پسماندهای صنعتی</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <a
                href="/api/v1/environment/waste/export-csv/"
                download
                className="button button-secondary"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
              >
                📥 خروجی CSV مانیفست
              </a>
              <button className="button button-primary" onClick={() => setShowWasteModal(true)}>
                ➕ ثبت ضایعات/پسماند جدید
              </button>
            </div>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-secondary)" }}>
                  <th style={{ padding: "0.75rem" }}>نام پسماند</th>
                  <th style={{ padding: "0.75rem" }}>نوع پسماند</th>
                  <th style={{ padding: "0.75rem" }}>مقدار</th>
                  <th style={{ padding: "0.75rem" }}>محل انبارش</th>
                  <th style={{ padding: "0.75rem" }}>تاریخ تولید</th>
                  <th style={{ padding: "0.75rem" }}>وضعیت چرخه</th>
                  <th style={{ padding: "0.75rem" }}>بارنامه / مانیفست</th>
                  <th style={{ padding: "0.75rem" }}>مرکز و روش دفع</th>
                  <th style={{ padding: "0.75rem" }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {wastes.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                      هیچ پسماندی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  wastes.map((w) => (
                    <tr key={w.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "0.75rem", fontWeight: 600 }}>{w.waste_name}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <span
                          style={{
                            padding: "0.2rem 0.4rem",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            backgroundColor:
                              w.waste_type === "hazardous"
                                ? "#fee2e2"
                                : w.waste_type === "recyclable"
                                ? "#dbeafe"
                                : "#f3f4f6",
                            color:
                              w.waste_type === "hazardous"
                                ? "#b91c1c"
                                : w.waste_type === "recyclable"
                                ? "#1e40af"
                                : "#374151",
                          }}
                        >
                          {w.waste_type_display}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", fontWeight: 700 }}>
                        {w.quantity} {w.unit_display}
                      </td>
                      <td style={{ padding: "0.75rem" }}>{w.storage_location}</td>
                      <td style={{ padding: "0.75rem" }}>{w.generation_date}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <span
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            backgroundColor:
                              w.status === "stored"
                                ? "#fef3c7"
                                : w.status === "transferred"
                                ? "#e0e7ff"
                                : "#dcfce7",
                            color:
                              w.status === "stored"
                                ? "#92400e"
                                : w.status === "transferred"
                                ? "#3730a3"
                                : "#166534",
                          }}
                        >
                          {w.status_display}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>
                        {w.consignment_number || "-"}
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem" }}>
                        {w.disposal_facility ? `${w.disposal_facility} (${w.disposal_method || ""})` : "-"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {w.status !== "disposed" && (
                          <button
                            className="button button-secondary"
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                            onClick={() => {
                              setShowWasteStatusModal(w);
                              setWasteStatusForm({
                                status: w.status === "stored" ? "transferred" : "disposed",
                                consignment_number: w.consignment_number || "",
                                disposal_facility: w.disposal_facility || "",
                                disposal_method: w.disposal_method || "",
                              });
                            }}
                          >
                            تغییر وضعیت
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ASPECTS & THRESHOLDS */}
      {activeTab === "aspects_thresholds" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
          {/* Sub-section A: Aspects */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>شناسایی جنبه‌ها و پیامدهای زیست‌محیطی (ISO 14001 Aspect/Impact)</h3>
              <button className="button button-primary" onClick={() => setShowAspectModal(true)}>
                ➕ تعریف جنبه جدید
              </button>
            </div>
            <div className="card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-secondary)" }}>
                    <th style={{ padding: "0.75rem" }}>فرآیند / فعالیت</th>
                    <th style={{ padding: "0.75rem" }}>جنبه زیست‌محیطی</th>
                    <th style={{ padding: "0.75rem" }}>پیامد زیست‌محیطی</th>
                    <th style={{ padding: "0.75rem" }}>شرایط عملیاتی</th>
                    <th style={{ padding: "0.75rem" }}>شدت × احتمال</th>
                    <th style={{ padding: "0.75rem" }}>نمره بارزی</th>
                    <th style={{ padding: "0.75rem" }}>وضعیت بارز بودن</th>
                    <th style={{ padding: "0.75rem" }}>تمهیدات کنترلی</th>
                  </tr>
                </thead>
                <tbody>
                  {aspects.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                        هیچ جنبه زیست‌محیطی تعریف نشده است.
                      </td>
                    </tr>
                  ) : (
                    aspects.map((asp) => (
                      <tr key={asp.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "0.75rem", fontWeight: 600 }}>{asp.activity_or_process}</td>
                        <td style={{ padding: "0.75rem" }}>{asp.aspect}</td>
                        <td style={{ padding: "0.75rem" }}>{asp.impact}</td>
                        <td style={{ padding: "0.75rem" }}>{asp.condition_display}</td>
                        <td style={{ padding: "0.75rem", textAlign: "center" }}>
                          {asp.severity_score} × {asp.probability_score}
                        </td>
                        <td style={{ padding: "0.75rem", fontWeight: 700, textAlign: "center" }}>
                          {asp.significance_score}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          {asp.is_significant ? (
                            <span style={{ padding: "0.2rem 0.5rem", borderRadius: "4px", backgroundColor: "#fee2e2", color: "#b91c1c", fontWeight: 700 }}>
                              🚨 جنبه بارز
                            </span>
                          ) : (
                            <span style={{ padding: "0.2rem 0.5rem", borderRadius: "4px", backgroundColor: "#f3f4f6", color: "#6b7280" }}>
                              غیربارز
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.85rem" }}>{asp.control_measures || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-section B: Thresholds */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>استانداردها و حدود آستانه قانونی (Configurable Thresholds)</h3>
              <button className="button button-primary" onClick={() => setShowThresholdModal(true)}>
                ➕ تعریف حد آستانه استاندارد
              </button>
            </div>
            <div className="card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-secondary)" }}>
                    <th style={{ padding: "0.75rem" }}>عنوان استاندارد</th>
                    <th style={{ padding: "0.75rem" }}>دسته‌بندی</th>
                    <th style={{ padding: "0.75rem" }}>پارامتر</th>
                    <th style={{ padding: "0.75rem" }}>نوع حد</th>
                    <th style={{ padding: "0.75rem" }}>مقدار مجاز</th>
                    <th style={{ padding: "0.75rem" }}>واحد</th>
                    <th style={{ padding: "0.75rem" }}>مرجع قانونی</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                        هیچ حد استانداردی تعریف نشده است.
                      </td>
                    </tr>
                  ) : (
                    thresholds.map((th) => (
                      <tr key={th.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "0.75rem", fontWeight: 600 }}>{th.name}</td>
                        <td style={{ padding: "0.75rem" }}>{th.category_display}</td>
                        <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>{th.parameter}</td>
                        <td style={{ padding: "0.75rem" }}>{th.limit_type_display}</td>
                        <td style={{ padding: "0.75rem", fontWeight: 700 }}>
                          {th.limit_type === "range" ? `${th.min_value} تا ${th.limit_value}` : th.limit_value}
                        </td>
                        <td style={{ padding: "0.75rem" }}>{th.unit}</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                          {th.standard_reference}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EMISSION SAMPLE */}
      {showEmissionModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "550px", maxWidth: "90vw", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>ثبت نتیجه آزمایشگاهی پساب / آلاینده</h3>
            <form onSubmit={handleCreateEmission}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">کارگاه</label>
                <select
                  className="form-select"
                  required
                  value={emissionForm.workplace}
                  onChange={(e) => setEmissionForm({ ...emissionForm, workplace: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="">انتخاب کارگاه...</option>
                  {workplaces.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">نقطه نمونه‌برداری</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={emissionForm.sampling_point}
                  onChange={(e) => setEmissionForm({ ...emissionForm, sampling_point: e.target.value })}
                  placeholder="مثال: حوضچه خروجی تصفیه‌خانه، دودکش کوره ذوب"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">دسته‌بندی</label>
                  <select
                    className="form-select"
                    value={emissionForm.category}
                    onChange={(e) => setEmissionForm({ ...emissionForm, category: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="wastewater">پساب صنعتی</option>
                    <option value="stack_emission">آلاینده خروجی دودکش</option>
                    <option value="ambient_air">هوای پاک پیرامونی</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">پارامتر</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={emissionForm.parameter}
                    onChange={(e) => setEmissionForm({ ...emissionForm, parameter: e.target.value })}
                    placeholder="COD, BOD, TSS, pH, SO2"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">مقدار اندازه‌گیری‌شده</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    required
                    value={emissionForm.measured_value}
                    onChange={(e) => setEmissionForm({ ...emissionForm, measured_value: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">واحد اندازه‌گیری</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={emissionForm.unit}
                    onChange={(e) => setEmissionForm({ ...emissionForm, unit: e.target.value })}
                    placeholder="mg/L, ppm, mg/Nm3"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">نام آزمایشگاه معتمد</label>
                  <input
                    type="text"
                    className="form-input"
                    value={emissionForm.laboratory_name}
                    onChange={(e) => setEmissionForm({ ...emissionForm, laboratory_name: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">شماره گزارش آزمایشگاه</label>
                  <input
                    type="text"
                    className="form-input"
                    value={emissionForm.test_report_number}
                    onChange={(e) => setEmissionForm({ ...emissionForm, test_report_number: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="button button-secondary" onClick={() => setShowEmissionModal(false)}>
                  انصراف
                </button>
                <button type="submit" className="button button-primary">
                  ثبت نمونه و ارزیابی استاندارد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: HYGIENE SURVEY */}
      {showHygieneModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "550px", maxWidth: "90vw", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>ثبت ارزیابی بهداشت حرفه‌ای و مواجهه شغلی</h3>
            <form onSubmit={handleCreateHygiene}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">کارگاه</label>
                <select
                  className="form-select"
                  required
                  value={hygieneForm.workplace}
                  onChange={(e) => setHygieneForm({ ...hygieneForm, workplace: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="">انتخاب کارگاه...</option>
                  {workplaces.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">عامل زیان‌آور</label>
                  <select
                    className="form-select"
                    value={hygieneForm.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      let defaultUnit = "dBA";
                      if (cat === "heat_stress") defaultUnit = "°C WBGT";
                      if (cat === "lighting") defaultUnit = "Lux";
                      if (cat === "dust_particulate") defaultUnit = "mg/m3";
                      if (cat === "chemical_vapor") defaultUnit = "ppm";
                      setHygieneForm({ ...hygieneForm, category: cat, unit: defaultUnit });
                    }}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="noise">صدا و ارتعاش</option>
                    <option value="heat_stress">استرس حرارتی (WBGT)</option>
                    <option value="lighting">شدت روشنایی (Lux)</option>
                    <option value="dust_particulate">گرد و غبار قابل استنشاق</option>
                    <option value="chemical_vapor">گازها و بخارات شیمیایی</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ایستگاه کاری / موقعیت اپراتور</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={hygieneForm.location_details}
                    onChange={(e) => setHygieneForm({ ...hygieneForm, location_details: e.target.value })}
                    placeholder="مثال: کابین کنترل نورد، محوطه بویلر"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">مقدار سنجش‌شده</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    required
                    value={hygieneForm.measured_value}
                    onChange={(e) => setHygieneForm({ ...hygieneForm, measured_value: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">واحد سنجش</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={hygieneForm.unit}
                    onChange={(e) => setHygieneForm({ ...hygieneForm, unit: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">نام کارشناس یا مشاور ارزیاب</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={hygieneForm.surveyor_name}
                  onChange={(e) => setHygieneForm({ ...hygieneForm, surveyor_name: e.target.value })}
                  placeholder="نام کارشناس بهداشت حرفه‌ای"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">توصیه و تمهیدات کنترلی</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={hygieneForm.control_recommendation}
                  onChange={(e) => setHygieneForm({ ...hygieneForm, control_recommendation: e.target.value })}
                  placeholder="مثال: استفاده از ایرماف ۳۰ دسی‌بل، بهبود هود مکنده موضعی..."
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="button button-secondary" onClick={() => setShowHygieneModal(false)}>
                  انصراف
                </button>
                <button type="submit" className="button button-primary">
                  ثبت و ارزیابی مواجهه شغلی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NEW WASTE */}
      {showWasteModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "500px", maxWidth: "90vw", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>ثبت پسماند / ضایعات صنعتی</h3>
            <form onSubmit={handleCreateWaste}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">کارگاه تولیدکننده</label>
                <select
                  className="form-select"
                  required
                  value={wasteForm.workplace}
                  onChange={(e) => setWasteForm({ ...wasteForm, workplace: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="">انتخاب کارگاه...</option>
                  {workplaces.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">نام پسماند یا ضایعات</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={wasteForm.waste_name}
                  onChange={(e) => setWasteForm({ ...wasteForm, waste_name: e.target.value })}
                  placeholder="مثال: روغن سوخته هیدرولیک، سرباره، لجن صنعتی"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">نوع پسماند</label>
                  <select
                    className="form-select"
                    value={wasteForm.waste_type}
                    onChange={(e) => setWasteForm({ ...wasteForm, waste_type: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="hazardous">پسماند ویژه و خطرناک</option>
                    <option value="non_hazardous">پسماند عادی / غیرخطرناک</option>
                    <option value="recyclable">پسماند قابل بازیافت</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">محل دپو / انبارش موقت</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={wasteForm.storage_location}
                    onChange={(e) => setWasteForm({ ...wasteForm, storage_location: e.target.value })}
                    placeholder="سایت انبارش موقت شماره ۲"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">مقدار</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    required
                    value={wasteForm.quantity}
                    onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">واحد</label>
                  <select
                    className="form-select"
                    value={wasteForm.unit}
                    onChange={(e) => setWasteForm({ ...wasteForm, unit: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="kg">کیلوگرم</option>
                    <option value="ton">تن</option>
                    <option value="liter">لیتر</option>
                    <option value="drum">بشکه</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="button button-secondary" onClick={() => setShowWasteModal(false)}>
                  انصراف
                </button>
                <button type="submit" className="button button-primary">
                  ثبت پسماند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: UPDATE WASTE STATUS */}
      {showWasteStatusModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "500px", maxWidth: "90vw", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>
              تغییر وضعیت پسماند: {showWasteStatusModal.waste_name}
            </h3>
            <form onSubmit={handleUpdateWasteStatus}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">وضعیت جدید</label>
                <select
                  className="form-select"
                  value={wasteStatusForm.status}
                  onChange={(e) => setWasteStatusForm({ ...wasteStatusForm, status: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="transferred">بارگیری و حمل (مانیفست)</option>
                  <option value="disposed">امحاء و تحویل نهایی</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">شماره بارنامه یا مانیفست حمل</label>
                <input
                  type="text"
                  className="form-input"
                  required={wasteStatusForm.status === "transferred"}
                  value={wasteStatusForm.consignment_number}
                  onChange={(e) => setWasteStatusForm({ ...wasteStatusForm, consignment_number: e.target.value })}
                  placeholder="شماره مانیفست حمل پسماند"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              {wasteStatusForm.status === "disposed" && (
                <>
                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label className="form-label">مرکز مجاز امحاء یا بازیافت</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={wasteStatusForm.disposal_facility}
                      onChange={(e) => setWasteStatusForm({ ...wasteStatusForm, disposal_facility: e.target.value })}
                      placeholder="مرکز بازیافت یا لندفیل مجاز"
                      style={{ width: "100%", padding: "0.5rem" }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label className="form-label">روش امحاء</label>
                    <input
                      type="text"
                      className="form-input"
                      value={wasteStatusForm.disposal_method}
                      onChange={(e) => setWasteStatusForm({ ...wasteStatusForm, disposal_method: e.target.value })}
                      placeholder="زباله‌سوز، بازیافت روغن، دفن مهندسی..."
                      style={{ width: "100%", padding: "0.5rem" }}
                    />
                  </div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="button button-secondary" onClick={() => setShowWasteStatusModal(null)}>
                  انصراف
                </button>
                <button type="submit" className="button button-primary">
                  تایید و به‌روزرسانی وضعیت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: NEW ASPECT */}
      {showAspectModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "550px", maxWidth: "90vw", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>تعریف جنبه و پیامد زیست‌محیطی (ISO 14001)</h3>
            <form onSubmit={handleCreateAspect}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">کارگاه</label>
                <select
                  className="form-select"
                  required
                  value={aspectForm.workplace}
                  onChange={(e) => setAspectForm({ ...aspectForm, workplace: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="">انتخاب کارگاه...</option>
                  {workplaces.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">فرآیند یا فعالیت</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={aspectForm.activity_or_process}
                  onChange={(e) => setAspectForm({ ...aspectForm, activity_or_process: e.target.value })}
                  placeholder="مثال: ذوب در کوره قوس الکتریکی، تعویض روغن هیدرولیک"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">جنبه زیست‌محیطی</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={aspectForm.aspect}
                    onChange={(e) => setAspectForm({ ...aspectForm, aspect: e.target.value })}
                    placeholder="انتشار ذرات غبار و گاز CO"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">پیامد زیست‌محیطی</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={aspectForm.impact}
                    onChange={(e) => setAspectForm({ ...aspectForm, impact: e.target.value })}
                    placeholder="آلودگی هوا و آسیب ریوی"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">شرایط</label>
                  <select
                    className="form-select"
                    value={aspectForm.condition}
                    onChange={(e) => setAspectForm({ ...aspectForm, condition: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="normal">عادی</option>
                    <option value="abnormal">غیرعادی</option>
                    <option value="emergency">اضطراری</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">شدت (۱-۵)</label>
                  <select
                    className="form-select"
                    value={aspectForm.severity_score}
                    onChange={(e) => setAspectForm({ ...aspectForm, severity_score: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="1">۱ - خیلی کم</option>
                    <option value="2">۲ - کم</option>
                    <option value="3">۳ - متوسط</option>
                    <option value="4">۴ - زیاد</option>
                    <option value="5">۵ - بحرانی</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">احتمال (۱-۵)</label>
                  <select
                    className="form-select"
                    value={aspectForm.probability_score}
                    onChange={(e) => setAspectForm({ ...aspectForm, probability_score: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="1">۱ - نادر</option>
                    <option value="2">۲ - کم</option>
                    <option value="3">۳ - محتمل</option>
                    <option value="4">۴ - مکرر</option>
                    <option value="5">۵ - مداوم</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">اقدامات و تمهیدات کنترلی</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={aspectForm.control_measures}
                  onChange={(e) => setAspectForm({ ...aspectForm, control_measures: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="button button-secondary" onClick={() => setShowAspectModal(false)}>
                  انصراف
                </button>
                <button type="submit" className="button button-primary">
                  ثبت جنبه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: NEW THRESHOLD */}
      {showThresholdModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "500px", maxWidth: "90vw", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>تعریف حد آستانه استاندارد قانونی</h3>
            <form onSubmit={handleCreateThreshold}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">عنوان استاندارد</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={thresholdForm.name}
                  onChange={(e) => setThresholdForm({ ...thresholdForm, name: e.target.value })}
                  placeholder="مثال: حد مجاز COD پساب خروجی"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">دسته‌بندی</label>
                  <select
                    className="form-select"
                    value={thresholdForm.category}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, category: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="wastewater">پساب صنعتی</option>
                    <option value="stack_emission">انتشار دودکش</option>
                    <option value="noise">صدا</option>
                    <option value="heat_stress">استرس حرارتی</option>
                    <option value="dust">گرد و غبار</option>
                    <option value="toxic_gas">گازهای سمی</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">شناسه پارامتر</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={thresholdForm.parameter}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, parameter: e.target.value })}
                    placeholder="COD, NOISE_DBA, WBGT"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">نوع حد</label>
                  <select
                    className="form-select"
                    value={thresholdForm.limit_type}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, limit_type: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="max_limit">حداکثر مجاز (Upper)</option>
                    <option value="min_limit">حداقل مجاز (Lower)</option>
                    <option value="range">بازه‌ای (Range)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">مقدار سقف مجاز</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    required
                    value={thresholdForm.limit_value}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, limit_value: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              {thresholdForm.limit_type === "range" && (
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">حداقل مجاز دامنه</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    required
                    value={thresholdForm.min_value}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, min_value: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">واحد اندازه‌گیری</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={thresholdForm.unit}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, unit: e.target.value })}
                    placeholder="mg/L, dBA, Lux"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">مرجع استاندارد قانونی</label>
                  <input
                    type="text"
                    className="form-input"
                    value={thresholdForm.standard_reference}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, standard_reference: e.target.value })}
                    placeholder="استاندارد سازمان حفاظت محیط زیست"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="button button-secondary" onClick={() => setShowThresholdModal(false)}>
                  انصراف
                </button>
                <button type="submit" className="button button-primary">
                  ثبت حد آستانه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
