import { useEffect, useState } from "react";
import {
  createEnergyConsumptionLog,
  createExcavationOperation,
  createFleetFuelLog,
  createFleetVehicle,
  fetchEnergyConsumptionLogs,
  fetchExcavationOperations,
  fetchFleetEnergySummary,
  fetchFleetFuelLogs,
  fetchFleetVehicles,
  type EnergyConsumptionLogItem,
  type ExcavationOperationItem,
  type FleetFuelLogItem,
  type FleetVehicleItem,
} from "../../services/api";
import { Zap, Truck, Shovel, Plus, Fuel } from "lucide-react";

type Tab = "fleet" | "energy" | "excavation";

export function FleetEnergyPage() {
  const [activeTab, setActiveTab] = useState<Tab>("fleet");
  const [vehicles, setVehicles] = useState<FleetVehicleItem[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FleetFuelLogItem[]>([]);
  const [energyLogs, setEnergyLogs] = useState<EnergyConsumptionLogItem[]>([]);
  const [excavations, setExcavations] = useState<ExcavationOperationItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [showExcModal, setShowExcModal] = useState(false);

  // Forms
  const [vehCode, setVehCode] = useState("");
  const [vehPlate, setVehPlate] = useState("");
  const [vehModel, setVehModel] = useState("");
  const [vehType, setVehType] = useState<"passenger" | "pickup" | "heavy_truck" | "bus" | "forklift">("pickup");
  const [vehFuelType, setVehFuelType] = useState<"gasoline" | "diesel" | "cng" | "electric">("gasoline");
  const [vehOdometer, setVehOdometer] = useState<number>(0);

  const [fuelVehId, setFuelVehId] = useState<number | "">("");
  const [fuelLiters, setFuelLiters] = useState<number>(50);
  const [fuelOdo, setFuelOdo] = useState<number>(1000);
  const [fuelCost, setFuelCost] = useState<number>(1500000);

  const [meterCode, setMeterCode] = useState("");
  const [meterType, setMeterType] = useState<"electricity" | "natural_gas" | "water">("electricity");
  const [meterVal, setMeterVal] = useState<number>(5000);
  const [meterCost, setMeterCost] = useState<number>(25000000);
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().split("T")[0]);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0]);

  const [excCode, setExcCode] = useState("");
  const [excLoc, setExcLoc] = useState("");
  const [excDepth, setExcDepth] = useState<number>(2.0);
  const [excLen, setExcLen] = useState<number>(10.0);
  const [excSoil, setExcSoil] = useState<"type_a_clay" | "type_b_silt" | "type_c_sand" | "solid_rock">("type_b_silt");
  const [excShoring, setExcShoring] = useState<boolean>(true);
  const [excGasOk, setExcGasOk] = useState<boolean>(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchFleetVehicles(),
      fetchFleetFuelLogs(),
      fetchEnergyConsumptionLogs(),
      fetchExcavationOperations(),
      fetchFleetEnergySummary(),
    ])
      .then(([vehs, fuels, energys, excs, sum]) => {
        setVehicles(vehs);
        setFuelLogs(fuels);
        setEnergyLogs(energys);
        setExcavations(excs);
        setSummary(sum);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "خطا در دریافت اطلاعات ناوگان و انرژی");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFleetVehicle({
        organization: 1,
        vehicle_code: vehCode,
        plate_number: vehPlate,
        model_name: vehModel,
        vehicle_type: vehType,
        fuel_type: vehFuelType,
        current_odometer_km: vehOdometer,
      });
      setShowVehicleModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ثبت خودرو");
    }
  };

  const handleCreateFuelLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFleetFuelLog({
        vehicle: fuelVehId,
        fuel_amount_liters: fuelLiters,
        odometer_at_fueling_km: fuelOdo,
        cost_irr: fuelCost,
        fueling_date: new Date().toISOString().split("T")[0],
      });
      setShowFuelModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ثبت سوخت‌گیری");
    }
  };

  const handleCreateEnergyLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEnergyConsumptionLog({
        organization: 1,
        meter_code: meterCode,
        utility_type: meterType,
        consumption_value: meterVal,
        cost_irr: meterCost,
        period_start: periodStart,
        period_end: periodEnd,
      });
      setShowEnergyModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ثبت مصرف انرژی");
    }
  };

  const handleCreateExcavation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createExcavationOperation({
        organization: 1,
        excavation_code: excCode,
        location_description: excLoc,
        depth_m: excDepth,
        length_m: excLen,
        soil_type: excSoil,
        shoring_system_installed: excShoring,
        gas_testing_passed: excGasOk,
        status: "in_progress",
      });
      setShowExcModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ثبت عملیات ترانشه/گودبرداری");
    }
  };

  return (
    <div className="card" dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Zap size={28} color="#2563eb" />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>ناوگان ترابری، مدیریت انرژی و عملیات گودبرداری</h2>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
              رهگیری سوخت ماشین‌آلات، قبوض مصرف برق و گاز صنعتی، و ایمنی فنی ترانشه‌ها و سازه‌های نگهبان
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>
          در حال بارگذاری اطلاعات ناوگان و مصارف انرژی...
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ padding: "1rem", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
            <span style={{ fontSize: "0.85rem", color: "#1e40af" }}>مصرف کل برق (kWh)</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2563eb" }}>{summary.total_kwh ? summary.total_kwh.toLocaleString() : "۰"}</div>
          </div>
          <div style={{ padding: "1rem", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #86efac" }}>
            <span style={{ fontSize: "0.85rem", color: "#166534" }}>ناوگان و ماشین‌آلات فعال</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#16a34a" }}>{summary.active_vehicles || 0} دستگاه</div>
          </div>
          <div style={{ padding: "1rem", background: "#fef3c7", borderRadius: "8px", border: "1px solid #fde68a" }}>
            <span style={{ fontSize: "0.85rem", color: "#92400e" }}>ترانشه‌ها و گودهای فعال</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#d97706" }}>{summary.active_excavations || 0} پروژه</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
        <button
          className={`btn ${activeTab === "fleet" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("fleet")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Truck size={16} /> ناوگان خودرویی و سوخت
        </button>
        <button
          className={`btn ${activeTab === "energy" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("energy")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Zap size={16} /> قبوض و مصارف انرژی
        </button>
        <button
          className={`btn ${activeTab === "excavation" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("excavation")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Shovel size={16} /> عملیات گودبرداری و ترانشه
        </button>
      </div>

      {/* 1. Fleet Tab */}
      {activeTab === "fleet" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>فهرست وسایل نقلیه و ماشین‌آلات صنعتی</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowFuelModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Fuel size={16} /> ثبت سوخت‌گیری
              </button>
              <button className="btn btn-primary" onClick={() => setShowVehicleModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Plus size={16} /> ثبت خودرو جدید
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "0.6rem" }}>کد شناسایی</th>
                  <th style={{ padding: "0.6rem" }}>مدل خودرو</th>
                  <th style={{ padding: "0.6rem" }}>پلاک</th>
                  <th style={{ padding: "0.6rem" }}>نوع سوخت</th>
                  <th style={{ padding: "0.6rem" }}>کارکرد فعلی (کیلومتر)</th>
                  <th style={{ padding: "0.6rem" }}>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.6rem", fontWeight: "bold" }}>{v.vehicle_code}</td>
                    <td style={{ padding: "0.6rem" }}>{v.model_name}</td>
                    <td style={{ padding: "0.6rem" }}>{v.plate_number}</td>
                    <td style={{ padding: "0.6rem" }}>{v.fuel_type}</td>
                    <td style={{ padding: "0.6rem" }}>{v.current_odometer_km.toLocaleString()} km</td>
                    <td style={{ padding: "0.6rem" }}>
                      <span style={{ padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", background: v.is_active ? "#dcfce7" : "#fee2e2", color: v.is_active ? "#166534" : "#991b1b" }}>
                        {v.is_active ? "فعال در سایت" : "متوقف / تعمیرات"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{ margin: "0 0 0.5rem" }}>آخرین سوابق سوخت‌گیری ثبت‌شده</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "0.5rem" }}>خودرو</th>
                  <th style={{ padding: "0.5rem" }}>مقدار سوخت (لیتر)</th>
                  <th style={{ padding: "0.5rem" }}>کیلومتر ثبت‌شده</th>
                  <th style={{ padding: "0.5rem" }}>هزینه (ریال)</th>
                  <th style={{ padding: "0.5rem" }}>تاریخ سوخت‌گیری</th>
                </tr>
              </thead>
              <tbody>
                {fuelLogs.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.5rem", fontWeight: "bold" }}>{f.vehicle_code || f.vehicle}</td>
                    <td style={{ padding: "0.5rem" }}>{f.fuel_amount_liters} L</td>
                    <td style={{ padding: "0.5rem" }}>{f.odometer_at_fueling_km.toLocaleString()} km</td>
                    <td style={{ padding: "0.5rem" }}>{f.cost_irr.toLocaleString()} ریال</td>
                    <td style={{ padding: "0.5rem" }}>{f.fueling_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Energy Tab */}
      {activeTab === "energy" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>قبوض و سوابق مصارف انرژی تاسیسات</h3>
            <button className="btn btn-primary" onClick={() => setShowEnergyModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Plus size={16} /> ثبت مصرف دوره جدید
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "0.6rem" }}>کد کنتور / منبع</th>
                  <th style={{ padding: "0.6rem" }}>نوع حامل انرژی</th>
                  <th style={{ padding: "0.6rem" }}>میزان مصرف</th>
                  <th style={{ padding: "0.6rem" }}>مبلغ قبض (ریال)</th>
                  <th style={{ padding: "0.6rem" }}>بازه دوره مصرف</th>
                </tr>
              </thead>
              <tbody>
                {energyLogs.map((e) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.6rem", fontWeight: "bold" }}>{e.meter_code}</td>
                    <td style={{ padding: "0.6rem" }}>{e.utility_type_display || e.utility_type}</td>
                    <td style={{ padding: "0.6rem", fontWeight: "bold", color: "#2563eb" }}>
                      {e.consumption_value.toLocaleString()} {e.unit}
                    </td>
                    <td style={{ padding: "0.6rem" }}>{e.cost_irr.toLocaleString()} ریال</td>
                    <td style={{ padding: "0.6rem" }}>{e.period_start} الی {e.period_end}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Excavation Tab */}
      {activeTab === "excavation" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>پروژه‌های گودبرداری و ترانشه‌های باز سایت</h3>
            <button className="btn btn-primary" onClick={() => setShowExcModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Plus size={16} /> ثبت ترانشه / گودبرداری جدید
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "0.6rem" }}>کد گود</th>
                  <th style={{ padding: "0.6rem" }}>محل گودبرداری</th>
                  <th style={{ padding: "0.6rem" }}>ابعاد (عمق × طول)</th>
                  <th style={{ padding: "0.6rem" }}>نوع خاک</th>
                  <th style={{ padding: "0.6rem" }}>سازه نگهبان (Shoring)</th>
                  <th style={{ padding: "0.6rem" }}>گازسنجی اولیه</th>
                  <th style={{ padding: "0.6rem" }}>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {excavations.map((x) => (
                  <tr key={x.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.6rem", fontWeight: "bold" }}>{x.excavation_code}</td>
                    <td style={{ padding: "0.6rem" }}>{x.location_description}</td>
                    <td style={{ padding: "0.6rem" }}>{x.depth_m}m عمق × {x.length_m}m طول</td>
                    <td style={{ padding: "0.6rem" }}>{x.soil_type}</td>
                    <td style={{ padding: "0.6rem" }}>
                      <span style={{ color: x.shoring_system_installed ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>
                        {x.shoring_system_installed ? "نصب و تاییدشده" : "فاقد سازه نگهبان"}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      <span style={{ color: x.gas_testing_passed ? "#16a34a" : "#dc2626" }}>
                        {x.gas_testing_passed ? "انجام و ایمن" : "نیازمند گازسنجی"}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      <span style={{ padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", background: "#fef3c7", color: "#92400e" }}>
                        {x.status_display || x.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Vehicle */}
      {showVehicleModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "500px", width: "90%" }}>
            <h3 style={{ margin: "0 0 1rem" }}>ثبت خودرو یا ماشین‌آلات در ناوگان</h3>
            <form onSubmit={handleCreateVehicle}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">کد شناسایی خودرو</label>
                  <input type="text" className="form-input" value={vehCode} onChange={(e) => setVehCode(e.target.value)} placeholder="مثال: V-105" required />
                </div>
                <div>
                  <label className="form-label">شماره پلاک</label>
                  <input type="text" className="form-input" value={vehPlate} onChange={(e) => setVehPlate(e.target.value)} required />
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">مدل و سازنده</label>
                <input type="text" className="form-input" value={vehModel} onChange={(e) => setVehModel(e.target.value)} required />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">کیلومتر کارکرد فعلی (km)</label>
                <input type="number" className="form-input" value={vehOdometer} onChange={(e) => setVehOdometer(Number(e.target.value))} min={0} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label className="form-label">نوع کاربری</label>
                  <select className="form-input" value={vehType} onChange={(e: any) => setVehType(e.target.value)}>
                    <option value="pickup">وانت دوکابین / سواری</option>
                    <option value="heavy_truck">کامیون / کشنده سنگین</option>
                    <option value="forklift">لیفتراک / ماشین صنعتی</option>
                    <option value="bus">مینی‌بوس پرسنلی</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">نوع سوخت</label>
                  <select className="form-input" value={vehFuelType} onChange={(e: any) => setVehFuelType(e.target.value)}>
                    <option value="gasoline">بنزین</option>
                    <option value="diesel">گازوئیل</option>
                    <option value="cng">گاز طبیعی (CNG)</option>
                    <option value="electric">برقی</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVehicleModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary">ثبت خودرو</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Fuel */}
      {showFuelModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "450px", width: "90%" }}>
            <h3 style={{ margin: "0 0 1rem" }}>ثبت سوخت‌گیری خودرو</h3>
            <form onSubmit={handleCreateFuelLog}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">انتخاب خودرو</label>
                <select className="form-input" value={fuelVehId} onChange={(e) => setFuelVehId(Number(e.target.value))} required>
                  <option value="">(انتخاب خودرو)</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.vehicle_code} - {v.model_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">مقدار سوخت (لیتر)</label>
                  <input type="number" className="form-input" value={fuelLiters} onChange={(e) => setFuelLiters(parseFloat(e.target.value) || 0)} required />
                </div>
                <div>
                  <label className="form-label">کیلومتر فعلی</label>
                  <input type="number" className="form-input" value={fuelOdo} onChange={(e) => setFuelOdo(parseFloat(e.target.value) || 0)} required />
                </div>
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-label">هزینه کل (ریال)</label>
                <input type="number" className="form-input" value={fuelCost} onChange={(e) => setFuelCost(parseFloat(e.target.value) || 0)} required />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFuelModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary">ثبت سوخت‌گیری</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Energy */}
      {showEnergyModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "500px", width: "90%" }}>
            <h3 style={{ margin: "0 0 1rem" }}>ثبت قبض و مصرف انرژی دوره</h3>
            <form onSubmit={handleCreateEnergyLog}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">کد یا شماره کنتور</label>
                  <input type="text" className="form-input" value={meterCode} onChange={(e) => setMeterCode(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">نوع حامل</label>
                  <select className="form-input" value={meterType} onChange={(e: any) => setMeterType(e.target.value)}>
                    <option value="electricity">برق صنعتی (kWh)</option>
                    <option value="natural_gas">گاز طبیعی (m³)</option>
                    <option value="water">آب صنعتی (m³)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">مقدار مصرف عددی</label>
                  <input type="number" className="form-input" value={meterVal} onChange={(e) => setMeterVal(parseFloat(e.target.value) || 0)} required />
                </div>
                <div>
                  <label className="form-label">مبلغ صورت‌حساب (ریال)</label>
                  <input type="number" className="form-input" value={meterCost} onChange={(e) => setMeterCost(parseFloat(e.target.value) || 0)} required />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label className="form-label">ابتدای دوره</label>
                  <input type="date" className="form-input" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">انتهای دوره</label>
                  <input type="date" className="form-input" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEnergyModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary">ثبت مصرف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excavation */}
      {showExcModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "500px", width: "90%" }}>
            <h3 style={{ margin: "0 0 1rem" }}>ثبت عملیات ترانشه / گودبرداری</h3>
            <form onSubmit={handleCreateExcavation}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">کد ترانشه</label>
                  <input type="text" className="form-input" value={excCode} onChange={(e) => setExcCode(e.target.value)} placeholder="EXC-01" required />
                </div>
                <div>
                  <label className="form-label">محل دقیق در سایت</label>
                  <input type="text" className="form-input" value={excLoc} onChange={(e) => setExcLoc(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">عمق گود (متر)</label>
                  <input type="number" step="0.1" className="form-input" value={excDepth} onChange={(e) => setExcDepth(parseFloat(e.target.value) || 0)} required />
                </div>
                <div>
                  <label className="form-label">طول ترانشه (متر)</label>
                  <input type="number" step="0.5" className="form-input" value={excLen} onChange={(e) => setExcLen(parseFloat(e.target.value) || 0)} required />
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">نوع خاک</label>
                <select className="form-input" value={excSoil} onChange={(e: any) => setExcSoil(e.target.value)}>
                  <option value="solid_rock">سنگ یکپارچه و سخت</option>
                  <option value="type_a_clay">خاک تیپ A - رسی بسیار متراکم</option>
                  <option value="type_b_silt">خاک تیپ B - لای، ماسه متراکم</option>
                  <option value="type_c_sand">خاک تیپ C - شن و ماسه سست</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={excShoring} onChange={(e) => setExcShoring(e.target.checked)} />
                  سازه نگهبان و مهاربندی نصب شده است
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={excGasOk} onChange={(e) => setExcGasOk(e.target.checked)} />
                  گازسنجی اولیه انجام و ایمن تایید گردید
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowExcModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary">ثبت ترانشه</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
