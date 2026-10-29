import { useEffect, useState } from "react";
import {
  calculateEnergyFleet,
  calculateExcavation,
  calculateHSERates,
  calculateNoise,
  calculateRigging,
  calculateUnitConvert,
  fetchCalculationRecords,
  type CalculationRecord,
} from "../../services/api";
import { Calculator, Scale, Volume2, ShieldAlert, Zap, Shovel, History } from "lucide-react";

type CalcTab = "unit" | "hse_rates" | "noise" | "rigging" | "energy_fleet" | "excavation" | "history";

export function CalculatorsPage() {
  const [activeTab, setActiveTab] = useState<CalcTab>("unit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unit Converter state
  const [unitCategory, setUnitCategory] = useState("length");
  const [unitVal, setUnitVal] = useState<number>(100);
  const [unitFrom, setUnitFrom] = useState("m");
  const [unitTo, setUnitTo] = useState("ft");
  const [unitResult, setUnitResult] = useState<any>(null);

  // HSE Rates state
  const [expHours, setExpHours] = useState<number>(200000);
  const [ltiCount, setLtiCount] = useState<number>(1);
  const [trirCount, setTrirCount] = useState<number>(3);
  const [lostDays, setLostDays] = useState<number>(14);
  const [hseResult, setHseResult] = useState<any>(null);

  // Noise state
  const [noiseInputs, setNoiseInputs] = useState<string>("85, 88, 91");
  const [noiseDuration, setNoiseDuration] = useState<number>(8);
  const [noiseResult, setNoiseResult] = useState<any>(null);

  // Rigging state
  const [loadWeight, setLoadWeight] = useState<number>(5000);
  const [slingLegs, setSlingLegs] = useState<number>(2);
  const [slingAngle, setSlingAngle] = useState<number>(60);
  const [craneCap, setCraneCap] = useState<number>(10000);
  const [shackleWll, setShackleWll] = useState<number>(4750);
  const [riggingResult, setRiggingResult] = useState<any>(null);

  // Energy & Fleet state
  const [elecKwh, setElecKwh] = useState<number>(12500);
  const [elecTariff, setElecTariff] = useState<number>(4500);
  const [fuelLiters, setFuelLiters] = useState<number>(65);
  const [fuelDist, setFuelDist] = useState<number>(520);
  const [energyResult, setEnergyResult] = useState<any>(null);

  // Excavation state
  const [excDepth, setExcDepth] = useState<number>(2.5);
  const [excLength, setExcLength] = useState<number>(15.0);
  const [soilType, setSoilType] = useState<string>("type_b_silt");
  const [shoringUsed, setShoringUsed] = useState<boolean>(false);
  const [excavationResult, setExcavationResult] = useState<any>(null);

  // History state
  const [records, setRecords] = useState<CalculationRecord[]>([]);

  useEffect(() => {
    if (activeTab === "history") {
      setLoading(true);
      fetchCalculationRecords()
        .then((data) => {
          setRecords(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || "خطا در دریافت تاریخچه محاسبات");
          setLoading(false);
        });
    }
  }, [activeTab]);

  const handleUnitConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await calculateUnitConvert({
        category: unitCategory,
        from_unit: unitFrom,
        to_unit: unitTo,
        value: unitVal,
      });
      setUnitResult(res);
    } catch (err: any) {
      setError(err.message || "خطا در محاسبه تبدیل واحد");
    } finally {
      setLoading(false);
    }
  };

  const handleHseRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await calculateHSERates({
        exposure_hours: expHours,
        lost_time_injuries: ltiCount,
        total_recordable_incidents: trirCount,
        lost_days: lostDays,
      });
      setHseResult(res);
    } catch (err: any) {
      setError(err.message || "خطا در محاسبه شاخص‌های HSE");
    } finally {
      setLoading(false);
    }
  };

  const handleNoise = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const spls = noiseInputs
        .split(",")
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n));
      const res = await calculateNoise({
        spl_values: spls,
        duration_hours: noiseDuration,
      });
      setNoiseResult(res);
    } catch (err: any) {
      setError(err.message || "خطا در محاسبه تراز صدا");
    } finally {
      setLoading(false);
    }
  };

  const handleRigging = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await calculateRigging({
        load_weight_kg: loadWeight,
        num_sling_legs: slingLegs,
        sling_angle_deg: slingAngle,
        crane_rated_capacity_kg: craneCap,
        shackle_rated_wll_kg: shackleWll,
      });
      setRiggingResult(res);
    } catch (err: any) {
      setError(err.message || "خطا در محاسبه ریگینگ");
    } finally {
      setLoading(false);
    }
  };

  const handleEnergyFleet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await calculateEnergyFleet({
        electricity_kwh: elecKwh,
        electricity_tariff: elecTariff,
        fuel_liters: fuelLiters,
        distance_km: fuelDist,
      });
      setEnergyResult(res);
    } catch (err: any) {
      setError(err.message || "خطا در محاسبه انرژی");
    } finally {
      setLoading(false);
    }
  };

  const handleExcavation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await calculateExcavation({
        depth_m: excDepth,
        length_m: excLength,
        soil_type: soilType,
        shoring_used: shoringUsed,
      });
      setExcavationResult(res);
    } catch (err: any) {
      setError(err.message || "خطا در محاسبه گودبرداری");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" dir="rtl">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Calculator size={28} color="#2563eb" />
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem" }}>مرکز محاسبات مهندسی و ابزارهای سریع HSE</h2>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
            محاسبه استاندارد نرخ‌های آماری، تراز صدا، ریگینگ و باربرداری، انرژی، و شیب ایمن گودبرداری
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <button
          className={`btn ${activeTab === "unit" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("unit")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Scale size={16} /> تبدیل واحدها
        </button>
        <button
          className={`btn ${activeTab === "hse_rates" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("hse_rates")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <ShieldAlert size={16} /> نرخ‌های آماری (LTIFR/TRIR)
        </button>
        <button
          className={`btn ${activeTab === "noise" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("noise")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Volume2 size={16} /> تراز و دوز صدا
        </button>
        <button
          className={`btn ${activeTab === "rigging" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("rigging")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Calculator size={16} /> باربرداری و کشش اسلینگ
        </button>
        <button
          className={`btn ${activeTab === "energy_fleet" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("energy_fleet")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Zap size={16} /> انرژی و سوخت ناوگان
        </button>
        <button
          className={`btn ${activeTab === "excavation" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("excavation")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Shovel size={16} /> شیب ایمن گودبرداری
        </button>
        <button
          className={`btn ${activeTab === "history" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("history")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <History size={16} /> سوابق محاسبات
        </button>
      </div>

      {/* 1. Unit Converter */}
      {activeTab === "unit" && (
        <form onSubmit={handleUnitConvert} style={{ maxWidth: "600px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="form-label">دسته‌بندی کمیت</label>
              <select className="form-input" value={unitCategory} onChange={(e) => setUnitCategory(e.target.value)}>
                <option value="length">طول (Length)</option>
                <option value="mass">جرم / وزن (Mass)</option>
                <option value="pressure">فشار (Pressure)</option>
                <option value="force">نیرو (Force)</option>
                <option value="temperature">دما (Temperature)</option>
              </select>
            </div>
            <div>
              <label className="form-label">مقدار عددی</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={unitVal}
                onChange={(e) => setUnitVal(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <label className="form-label">از واحد</label>
              <input
                type="text"
                className="form-input"
                value={unitFrom}
                onChange={(e) => setUnitFrom(e.target.value)}
                placeholder="مثلا m, kg, bar, c"
                required
              />
            </div>
            <div>
              <label className="form-label">به واحد مقصد</label>
              <input
                type="text"
                className="form-input"
                value={unitTo}
                onChange={(e) => setUnitTo(e.target.value)}
                placeholder="مثلا ft, lb, psi, f"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "در حال محاسبه..." : "انجام تبدیل واحد"}
          </button>

          {unitResult && (
            <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 0.5rem", color: "#166534" }}>نتیجه تبدیل واحد</h4>
              <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>
                {unitResult.value} {unitResult.from_unit} = <span style={{ color: "#2563eb" }}>{unitResult.result}</span> {unitResult.to_unit}
              </div>
              <small style={{ color: "#64748b", display: "block", marginTop: "0.5rem" }}>فرمول مرجع: {unitResult.formula}</small>
            </div>
          )}
        </form>
      )}

      {/* 2. HSE Rates */}
      {activeTab === "hse_rates" && (
        <form onSubmit={handleHseRates} style={{ maxWidth: "650px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="form-label">کل ساعات کارکرد نفر-ساعت (Exposure Hours)</label>
              <input
                type="number"
                className="form-input"
                value={expHours}
                onChange={(e) => setExpHours(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label className="form-label">تعداد حوادث ناتوان‌کننده (LTI)</label>
              <input
                type="number"
                className="form-input"
                value={ltiCount}
                onChange={(e) => setLtiCount(parseInt(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <label className="form-label">کل حوادث قابل ثبت (TRIR Cases)</label>
              <input
                type="number"
                className="form-input"
                value={trirCount}
                onChange={(e) => setTrirCount(parseInt(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label className="form-label">مجموع روزهای کار از دست رفته (Lost Days)</label>
              <input
                type="number"
                className="form-input"
                value={lostDays}
                onChange={(e) => setLostDays(parseInt(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "در حال محاسبه..." : "محاسبه شاخص‌های آماری"}
          </button>

          {hseResult && (
            <div style={{ marginTop: "1.5rem", padding: "1.25rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 1rem", color: "#1e293b" }}>نتایج شاخص‌های عملکرد ایمنی (بر مبنای ۱,۰۰۰,۰۰۰ ساعت کارکرد)</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>نرخ تکرار حوادث (LTIFR)</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#dc2626" }}>{hseResult.ltifr}</div>
                </div>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>نرخ کل حوادث (TRIR)</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#d97706" }}>{hseResult.trir}</div>
                </div>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>نرخ شدت حوادث (Severity Rate)</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#4f46e5" }}>{hseResult.severity_rate}</div>
                </div>
              </div>
              <small style={{ color: "#64748b", display: "block", marginTop: "1rem" }}>{hseResult.formula_notes}</small>
            </div>
          )}
        </form>
      )}

      {/* 3. Noise */}
      {activeTab === "noise" && (
        <form onSubmit={handleNoise} style={{ maxWidth: "600px" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label className="form-label">ترازهای صوتی منابع مختلف (dB - جداشده با کاما)</label>
            <input
              type="text"
              className="form-input"
              value={noiseInputs}
              onChange={(e) => setNoiseInputs(e.target.value)}
              placeholder="مثال: 82, 85, 88"
              required
            />
            <small style={{ color: "#64748b" }}>محاسبه بر مبنای جمع لگاریتمی ترازهای فشار صوتی (SPL)</small>
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label className="form-label">مدت زمان مواجهه (ساعت در شیفت)</label>
            <input
              type="number"
              step="0.5"
              className="form-input"
              value={noiseDuration}
              onChange={(e) => setNoiseDuration(parseFloat(e.target.value) || 8)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "در حال محاسبه..." : "محاسبه تراز کل و دوز صدا"}
          </button>

          {noiseResult && (
            <div style={{ marginTop: "1.5rem", padding: "1.25rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 1rem" }}>نتیجه ارزیابی صدا</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>تراز فشار صوتی معادل (SPL)</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2563eb" }}>{noiseResult.total_spl_db} dBA</div>
                </div>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>درصد دوز صوتی شیفت (Noise Dose)</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: noiseResult.noise_dose_percentage > 100 ? "#dc2626" : "#16a34a" }}>
                    {noiseResult.noise_dose_percentage}%
                  </div>
                </div>
              </div>
              <div style={{ padding: "0.5rem", background: noiseResult.tsv_status.includes("مجاز") ? "#dcfce7" : "#fee2e2", borderRadius: "6px", fontWeight: "bold" }}>
                وضعیت حدود تماس شغلی: {noiseResult.tsv_status}
              </div>
            </div>
          )}
        </form>
      )}

      {/* 4. Rigging & Lifting */}
      {activeTab === "rigging" && (
        <form onSubmit={handleRigging} style={{ maxWidth: "650px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="form-label">وزن کل بار (کیلوگرم)</label>
              <input
                type="number"
                className="form-input"
                value={loadWeight}
                onChange={(e) => setLoadWeight(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label className="form-label">تعداد ساق‌های اسلینگ (Sling Legs)</label>
              <select className="form-input" value={slingLegs} onChange={(e) => setSlingLegs(parseInt(e.target.value))}>
                <option value={1}>تک ساق (1 Leg)</option>
                <option value={2}>دو ساق (2 Legs)</option>
                <option value={3}>سه ساق (3 Legs)</option>
                <option value={4}>چهار ساق (4 Legs)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="form-label">زاویه اسلینگ با افق (درجه)</label>
              <input
                type="number"
                className="form-input"
                value={slingAngle}
                onChange={(e) => setSlingAngle(parseFloat(e.target.value) || 0)}
                required
              />
              <small style={{ color: "#dc2626" }}>زاویه کمتر از ۳۰ درجه به شدت خطرناک و غیرمجاز است.</small>
            </div>
            <div>
              <label className="form-label">ظرفیت نامی جرثقیل در شعاع کار (kg)</label>
              <input
                type="number"
                className="form-input"
                value={craneCap}
                onChange={(e) => setCraneCap(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label className="form-label">ظرفیت بار مجاز شگل / اتصالات (WLL به کیلوگرم)</label>
            <input
              type="number"
              className="form-input"
              value={shackleWll}
              onChange={(e) => setShackleWll(parseFloat(e.target.value) || 0)}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "در حال محاسبه..." : "محاسبه کشش و ضرایب ایمنی باربرداری"}
          </button>

          {riggingResult && (
            <div style={{ marginTop: "1.5rem", padding: "1.25rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 1rem" }}>نتایج تحلیل مهندسی ریگینگ</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>کشش در هر ساق اسلینگ</span>
                  <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#2563eb" }}>{riggingResult.tension_per_leg_kg} kg</div>
                </div>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>درصد باربری جرثقیل (Utilization)</span>
                  <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: riggingResult.crane_utilization_pct > 85 ? "#dc2626" : "#16a34a" }}>
                    {riggingResult.crane_utilization_pct}%
                  </div>
                </div>
              </div>
              <div style={{ padding: "0.75rem", background: riggingResult.is_safe ? "#dcfce7" : "#fee2e2", borderRadius: "6px", fontWeight: "bold" }}>
                وضعیت ایمنی محاسباتی: {riggingResult.is_safe ? "مجاز و ایمن" : "اخطار: بار فراتر از حد مجاز است!"}
              </div>
            </div>
          )}
        </form>
      )}

      {/* 5. Energy & Fleet */}
      {activeTab === "energy_fleet" && (
        <form onSubmit={handleEnergyFleet} style={{ maxWidth: "600px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="form-label">مصرف برق دوره (کیلووات ساعت - kWh)</label>
              <input
                type="number"
                className="form-input"
                value={elecKwh}
                onChange={(e) => setElecKwh(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="form-label">تعرفه برق صنعتی (ریال / kWh)</label>
              <input
                type="number"
                className="form-input"
                value={elecTariff}
                onChange={(e) => setElecTariff(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <label className="form-label">سوخت مصرفی خودرو (لیتر)</label>
              <input
                type="number"
                className="form-input"
                value={fuelLiters}
                onChange={(e) => setFuelLiters(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="form-label">مسافت پیموده‌شده (کیلومتر)</label>
              <input
                type="number"
                className="form-input"
                value={fuelDist}
                onChange={(e) => setFuelDist(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "در حال محاسبه..." : "محاسبه شاخص‌های انرژی"}
          </button>

          {energyResult && (
            <div style={{ marginTop: "1.5rem", padding: "1.25rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 1rem" }}>شاخص‌های مصرف انرژی و راندمان سوخت</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>هزینه برآورد برق</span>
                  <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#2563eb" }}>
                    {energyResult.total_electricity_cost_irr.toLocaleString()} ریال
                  </div>
                </div>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>راندمان مصرف سوخت (L/100km)</span>
                  <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#16a34a" }}>
                    {energyResult.fuel_consumption_l_per_100km} لیتر
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      )}

      {/* 6. Excavation */}
      {activeTab === "excavation" && (
        <form onSubmit={handleExcavation} style={{ maxWidth: "600px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="form-label">عمق ترانشه / گود (متر)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={excDepth}
                onChange={(e) => setExcDepth(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label className="form-label">طول گودبرداری (متر)</label>
              <input
                type="number"
                step="0.5"
                className="form-input"
                value={excLength}
                onChange={(e) => setExcLength(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label className="form-label">نوع خاک بر اساس استاندارد OSHA / مبحث ۱۲</label>
            <select className="form-input" value={soilType} onChange={(e) => setSoilType(e.target.value)}>
              <option value="solid_rock">سنگ یکپارچه و سخت (Stable Rock)</option>
              <option value="type_a_clay">خاک تیپ A - رسی بسیار متراکم</option>
              <option value="type_b_silt">خاک تیپ B - لای، ماسه متراکم یا سیلت</option>
              <option value="type_c_sand">خاک تیپ C - شن و ماسه سست یا خاک اشباع</option>
            </select>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={shoringUsed}
                onChange={(e) => setShoringUsed(e.target.checked)}
              />
              سازه نگهبان و شمع‌کوبی (Shoring System) نصب شده است
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "در حال محاسبه..." : "بررسی شیب ایمن و الزامات مهاربندی"}
          </button>

          {excavationResult && (
            <div style={{ marginTop: "1.5rem", padding: "1.25rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 1rem" }}>الزامات هندسی گودبرداری</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>نسبت شیب مجاز ترانشه</span>
                  <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#2563eb" }}>{excavationResult.safe_slope_ratio}</div>
                </div>
                <div style={{ padding: "0.75rem", background: "#ffffff", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>عرض دهانه بالای گود</span>
                  <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#4f46e5" }}>{excavationResult.top_width_m} متر</div>
                </div>
              </div>
              <div style={{ padding: "0.75rem", background: excavationResult.shoring_mandatory ? "#fee2e2" : "#dcfce7", borderRadius: "6px" }}>
                <strong>{excavationResult.shoring_mandatory ? "هشدار مهاربندی:" : "وضعیت شیب:"}</strong> {excavationResult.warning_notes}
              </div>
            </div>
          )}
        </form>
      )}

      {/* 7. History */}
      {activeTab === "history" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>در حال بارگذاری سوابق...</div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>هیچ سابقه محاسباتی ثبت نشده است.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                    <th style={{ padding: "0.75rem" }}>ردیف</th>
                    <th style={{ padding: "0.75rem" }}>نوع محاسبه</th>
                    <th style={{ padding: "0.75rem" }}>ورودی‌ها</th>
                    <th style={{ padding: "0.75rem" }}>خروجی‌ها</th>
                    <th style={{ padding: "0.75rem" }}>تاریخ ثبت</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "0.75rem" }}>{i + 1}</td>
                      <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{r.calculator_type_display || r.calculator_type}</td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#475569" }}>
                        <code>{JSON.stringify(r.inputs)}</code>
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#2563eb" }}>
                        <code>{JSON.stringify(r.outputs)}</code>
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem" }}>{new Date(r.created_at).toLocaleDateString("fa-IR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
