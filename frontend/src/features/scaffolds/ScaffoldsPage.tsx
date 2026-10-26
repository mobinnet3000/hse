import { useEffect, useState } from "react";
import {
  changeScaffoldTag,
  createScaffold,
  fetchContractors,
  fetchScaffolds,
  fetchScaffoldSummary,
  fetchScaffoldTagCard,
  fetchWorkplaces,
  inspectScaffold,
  type ContractorCompany,
  type Scaffold,
  type ScaffoldSummary,
  type ScaffoldTagCard,
  type Workplace,
} from "../../services/api";

type FilterTag = "all" | "green_safe" | "yellow_restricted" | "red_unsafe" | "dismantled";

export function ScaffoldsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<ScaffoldSummary | null>(null);
  const [scaffolds, setScaffolds] = useState<Scaffold[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [contractors, setContractors] = useState<ContractorCompany[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTag>("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inspectingScaffold, setInspectingScaffold] = useState<Scaffold | null>(null);
  const [tagChangingScaffold, setTagChangingScaffold] = useState<Scaffold | null>(null);
  const [tagCardData, setTagCardData] = useState<ScaffoldTagCard | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    workplace: "",
    tag_number: "",
    scaffold_type: "modular_system",
    load_duty: "medium_duty",
    location_details: "",
    height_meters: "3.50",
    length_meters: "4.00",
    width_meters: "1.50",
    contractor: "",
    erected_by: "",
    erection_date: new Date().toISOString().slice(0, 10),
    intended_use: "",
  });

  const [inspectionForm, setInspectionForm] = useState({
    inspector_name: "",
    result_tag: "green_safe",
    validity_days: "7",
    base_plates_ok: true,
    bracing_ok: true,
    guardrails_ok: true,
    toeboards_ok: true,
    planks_decking_ok: true,
    ties_anchors_ok: true,
    ladder_access_ok: true,
    findings: "",
    restrictions_notes: "",
  });

  const [tagChangeForm, setTagChangeForm] = useState({
    new_tag: "yellow_restricted",
    reason: "",
    yellow_restrictions: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, scfRes, wpRes, contRes] = await Promise.all([
        fetchScaffoldSummary(),
        fetchScaffolds(),
        fetchWorkplaces(),
        fetchContractors(),
      ]);
      setSummary(sumRes);
      setScaffolds(scfRes);
      setWorkplaces(wpRes);
      setContractors(contRes);
    } catch (err: any) {
      setError(err?.message || "خطا در دریافت اطلاعات داربست‌ها");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateScaffold = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createScaffold({
        workplace: Number(createForm.workplace),
        tag_number: createForm.tag_number,
        scaffold_type: createForm.scaffold_type,
        load_duty: createForm.load_duty,
        location_details: createForm.location_details,
        height_meters: Number(createForm.height_meters),
        length_meters: Number(createForm.length_meters),
        width_meters: Number(createForm.width_meters),
        contractor: createForm.contractor ? Number(createForm.contractor) : null,
        erected_by: createForm.erected_by,
        erection_date: createForm.erection_date,
        intended_use: createForm.intended_use,
        tag_status: "red_unsafe",
      });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || "خطا در ثبت داربست جدید");
    }
  };

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingScaffold) return;
    try {
      await inspectScaffold(inspectingScaffold.id, {
        inspector_name: inspectionForm.inspector_name,
        result_tag: inspectionForm.result_tag,
        validity_days: Number(inspectionForm.validity_days),
        base_plates_ok: inspectionForm.base_plates_ok,
        bracing_ok: inspectionForm.bracing_ok,
        guardrails_ok: inspectionForm.guardrails_ok,
        toeboards_ok: inspectionForm.toeboards_ok,
        planks_decking_ok: inspectionForm.planks_decking_ok,
        ties_anchors_ok: inspectionForm.ties_anchors_ok,
        ladder_access_ok: inspectionForm.ladder_access_ok,
        findings: inspectionForm.findings,
        restrictions_notes: inspectionForm.restrictions_notes,
      });
      setInspectingScaffold(null);
      loadData();
    } catch (err: any) {
      alert(err?.message || "خطا در ثبت نتیجه بازرسی فنی");
    }
  };

  const handleTagChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagChangingScaffold) return;
    try {
      await changeScaffoldTag(tagChangingScaffold.id, {
        new_tag: tagChangeForm.new_tag,
        reason: tagChangeForm.reason,
        yellow_restrictions: tagChangeForm.yellow_restrictions,
      });
      setTagChangingScaffold(null);
      loadData();
    } catch (err: any) {
      alert(err?.message || "خطا در تغییر تگ داربست");
    }
  };

  const handleShowTagCard = async (scaffold: Scaffold) => {
    try {
      const card = await fetchScaffoldTagCard(scaffold.id);
      setTagCardData(card);
    } catch (err: any) {
      alert(err?.message || "خطا در دریافت شناسنامه برچسب");
    }
  };

  const filteredScaffolds = scaffolds.filter((s) => {
    if (activeFilter === "all") return true;
    return s.tag_status === activeFilter;
  });

  return (
    <div className="scaffolds-page" dir="rtl" style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
            🏗️ مدیریت برچسب و بازرسی تخصصی داربست‌ها (Scaffold Tag Register)
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", marginTop: "0.3rem" }}>
            چرخه حیات سه‌برچسبی (سبز ایمن، زرد مشروط، قرمز ممنوع)، بازرسی‌های ادواری ۷ روزه و یکپارچگی با مجوزهای کار در ارتفاع.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="button button-secondary" onClick={loadData} disabled={loading}>
            🔄 به‌روزرسانی
          </button>
          <button className="button button-primary" onClick={() => setShowCreateModal(true)}>
            ➕ برپایی و ثبت داربست جدید
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: "8px", marginBottom: "1.5rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1rem", borderRight: "4px solid #16a34a" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>تگ سبز (ایمن و فعال)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#16a34a", marginTop: "0.4rem" }}>
              {summary.green_count} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--color-text-muted)" }}>داربست تاییدشده</span>
            </div>
          </div>
          <div className="card" style={{ padding: "1rem", borderRight: "4px solid #ca8a04" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>تگ زرد (مشروط و محدود)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ca8a04", marginTop: "0.4rem" }}>
              {summary.yellow_count} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--color-text-muted)" }}>دسترسی محدود</span>
            </div>
          </div>
          <div className="card" style={{ padding: "1rem", borderRight: "4px solid #dc2626" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>تگ قرمز (مسدود و خطرناک)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#dc2626", marginTop: "0.4rem" }}>
              {summary.red_count} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--color-text-muted)" }}>اکیداً ممنوع</span>
            </div>
          </div>
          <div className="card" style={{ padding: "1rem", borderRight: "4px solid #8b5cf6" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>بازرسی‌های معوقه ادواری</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: summary.overdue_inspections_count > 0 ? "#dc2626" : "var(--color-text)", marginTop: "0.4rem" }}>
              {summary.overdue_inspections_count} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--color-text-muted)" }}>نیازمند بازرسی فوری</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.5rem" }}>
        {[
          { id: "all", label: `همه داربست‌ها (${scaffolds.length})` },
          { id: "green_safe", label: `تگ سبز ایمن (${scaffolds.filter((s) => s.tag_status === "green_safe").length})` },
          { id: "yellow_restricted", label: `تگ زرد مشروط (${scaffolds.filter((s) => s.tag_status === "yellow_restricted").length})` },
          { id: "red_unsafe", label: `تگ قرمز ممنوع (${scaffolds.filter((s) => s.tag_status === "red_unsafe").length})` },
          { id: "dismantled", label: `برچیده‌شده (${scaffolds.filter((s) => s.tag_status === "dismantled").length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as FilterTag)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: activeFilter === tab.id ? 700 : 500,
              backgroundColor: activeFilter === tab.id ? "var(--color-primary)" : "var(--color-bg-secondary)",
              color: activeFilter === tab.id ? "#fff" : "var(--color-text)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scaffolds Card Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
        {filteredScaffolds.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem", color: "var(--color-text-muted)" }}>
            هیچ داربستی در این دسته یافت نشد.
          </div>
        ) : (
          filteredScaffolds.map((scf) => {
            let tagBadgeBg = "#dc2626";
            let tagBadgeText = "⛔ تگ قرمز - خطرناک و ممنوع";
            if (scf.tag_status === "green_safe") {
              tagBadgeBg = "#16a34a";
              tagBadgeText = "✅ تگ سبز - ایمن و تاییدشده";
            } else if (scf.tag_status === "yellow_restricted") {
              tagBadgeBg = "#ca8a04";
              tagBadgeText = "⚠️ تگ زرد - دسترسی مشروط";
            } else if (scf.tag_status === "dismantled") {
              tagBadgeBg = "#6b7280";
              tagBadgeText = "✖ برچیده‌شده";
            }

            return (
              <div
                key={scf.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "1.2rem",
                  border: scf.is_inspection_overdue ? "2px solid #ef4444" : "1px solid var(--color-border)",
                  position: "relative",
                }}
              >
                <div>
                  {/* Physical Tag Simulation Header */}
                  <div
                    style={{
                      backgroundColor: tagBadgeBg,
                      color: "#fff",
                      padding: "0.4rem 0.8rem",
                      borderRadius: "6px",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      textAlign: "center",
                      marginBottom: "1rem",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    {tagBadgeText}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "monospace" }}>
                      {scf.tag_number}
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                      {scf.workplace_name}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.9rem", color: "var(--color-text)", fontWeight: 600, marginBottom: "0.5rem" }}>
                    📍 {scf.location_details}
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.8rem" }}>
                    نوع: {scf.scaffold_type_display} | ظرفیت: {scf.load_duty_display}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.8rem", backgroundColor: "var(--color-bg-secondary)", padding: "0.6rem", borderRadius: "6px", marginBottom: "0.8rem" }}>
                    <div>ارتفاع: <strong>{scf.height_meters} م</strong></div>
                    <div>ابعاد: <strong>{scf.length_meters}×{scf.width_meters} م</strong></div>
                    <div>برپایی: <strong>{scf.erection_date}</strong></div>
                    <div>پیمانکار: <strong>{scf.contractor_name || scf.erected_by || "-"}</strong></div>
                  </div>

                  {scf.tag_status === "yellow_restricted" && scf.yellow_restrictions && (
                    <div style={{ padding: "0.5rem", backgroundColor: "#fef3c7", color: "#92400e", borderRadius: "4px", fontSize: "0.78rem", marginBottom: "0.8rem" }}>
                      <strong>محدودیت دسترسی:</strong> {scf.yellow_restrictions}
                    </div>
                  )}

                  <div style={{ fontSize: "0.8rem", marginBottom: "0.8rem" }}>
                    {scf.is_inspection_overdue ? (
                      <span style={{ color: "#dc2626", fontWeight: 700 }}>
                        🚨 موعد بازرسی منقضی شده ({scf.next_inspection_due || "نامشخص"})
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        موعد بازرسی بعدی: <strong>{scf.next_inspection_due || "-"}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.4rem", borderTop: "1px solid var(--color-border)", paddingTop: "0.8rem", marginTop: "0.5rem" }}>
                  <button
                    className="button button-primary"
                    style={{ flex: 1, padding: "0.4rem 0.6rem", fontSize: "0.8rem" }}
                    onClick={() => {
                      setInspectingScaffold(scf);
                      setInspectionForm({
                        inspector_name: "",
                        result_tag: "green_safe",
                        validity_days: "7",
                        base_plates_ok: true,
                        bracing_ok: true,
                        guardrails_ok: true,
                        toeboards_ok: true,
                        planks_decking_ok: true,
                        ties_anchors_ok: true,
                        ladder_access_ok: true,
                        findings: "",
                        restrictions_notes: "",
                      });
                    }}
                  >
                    🔍 بازرسی فنی
                  </button>
                  <button
                    className="button button-secondary"
                    style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem" }}
                    onClick={() => {
                      setTagChangingScaffold(scf);
                      setTagChangeForm({
                        new_tag: scf.tag_status === "green_safe" ? "yellow_restricted" : "green_safe",
                        reason: "",
                        yellow_restrictions: scf.yellow_restrictions || "",
                      });
                    }}
                  >
                    🏷️ تغییر تگ
                  </button>
                  <button
                    className="button button-secondary"
                    style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem" }}
                    onClick={() => handleShowTagCard(scf)}
                  >
                    🖨️ شناسنامه
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: INSPECTION CHECKLIST (7-POINT) */}
      {inspectingScaffold && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "600px", maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
              🔍 چک‌لیست بازرسی تخصصی داربست ({inspectingScaffold.tag_number})
            </h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
              موقعیت: {inspectingScaffold.location_details} | استانداردهای هفت‌گانه ایمنی داربست‌بندی
            </p>

            <form onSubmit={handleInspectionSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">نام کارشناس بازرس داربست</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={inspectionForm.inspector_name}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, inspector_name: e.target.value })}
                    placeholder="مثال: مهندس مهران کاظمی"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">مدت اعتبار بازرسی (روز)</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    className="form-input"
                    required
                    value={inspectionForm.validity_days}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, validity_days: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>

              {/* 7 Structural Checkpoints */}
              <div style={{ backgroundColor: "var(--color-bg-secondary)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.6rem", fontSize: "0.9rem" }}>
                  📋 چک‌پوینت‌های اجباری ساختاری:
                </div>

                <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.85rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.base_plates_ok}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, base_plates_ok: e.target.checked })}
                    />
                    ۱. پایه‌ها و کفی‌های جک فلزی و تخته زیرپایی (Base & Sole Plates)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.bracing_ok}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, bracing_ok: e.target.checked })}
                    />
                    ۲. مهاربندهای ضربدری، بادبندهای طولی و عرضی (Bracing)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.guardrails_ok}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, guardrails_ok: e.target.checked })}
                    />
                    ۳. حفاظ‌های میانی و فوقانی استاندارد با ارتفاع ۱۱۰ سانتی‌متر (Guardrails)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.toeboards_ok}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, toeboards_ok: e.target.checked })}
                    />
                    ۴. قرنیزهای محافظ پا با ارتفاع حداقل ۱۵ سانتی‌متر (Toeboards)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.planks_decking_ok}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, planks_decking_ok: e.target.checked })}
                    />
                    ۵. تخته‌بندی کامل عرشه سکو بدون درز، شکستگی یا لغزش (Decking)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.ties_anchors_ok}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, ties_anchors_ok: e.target.checked })}
                    />
                    ۶. مهاربندی و انکر صلب به اسکلت اصلی سازه (Ties & Anchors)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.ladder_access_ok}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, ladder_access_ok: e.target.checked })}
                    />
                    ۷. نردبان و مسیر دسترسی ایمن با شیب مجاز و مهار فوقانی (Ladder Access)
                  </label>
                </div>
              </div>

              {/* Tag Result Selection */}
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">برچسب نهایی بر اساس نتایج بازرسی</label>
                <select
                  className="form-select"
                  value={inspectionForm.result_tag}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, result_tag: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="green_safe">✅ تگ سبز (ایمن و مجاز جهت استفاده عمومی)</option>
                  <option value="yellow_restricted">⚠️ تگ زرد (مشروط و دارای محدودیت دسترسی)</option>
                  <option value="red_unsafe">⛔ تگ قرمز (غیرایمن - مسدودسازی و صدور CAPA)</option>
                </select>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                  * توجه: در صورت تیک نخوردن هر یک از چک‌پوینت‌های هفت‌گانه، سامانه به طور خودکار تگ قرمز صادر خواهد کرد.
                </div>
              </div>

              {inspectionForm.result_tag === "yellow_restricted" && (
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">تمهیدات و شروط مجاز تگ زرد</label>
                  <input
                    type="text"
                    className="form-input"
                    value={inspectionForm.restrictions_notes}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, restrictions_notes: e.target.value })}
                    placeholder="مثال: استفاده صرفاً با هارنس متصل به لایف‌لاین مستقل مجاز است"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">شرح یافته‌ها و توضیحات تکمیلی بازرس</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={inspectionForm.findings}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, findings: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="button button-secondary" onClick={() => setInspectingScaffold(null)}>
                  انصراف
                </button>
                <button type="submit" className="button button-primary">
                  ثبت بازرسی و الصاق تگ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL TAG CHANGE */}
      {tagChangingScaffold && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "500px", maxWidth: "90vw", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
              🏷️ تغییر دستی برچسب داربست ({tagChangingScaffold.tag_number})
            </h3>
            <form onSubmit={handleTagChangeSubmit}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">تگ جدید</label>
                <select
                  className="form-select"
                  value={tagChangeForm.new_tag}
                  onChange={(e) => setTagChangeForm({ ...tagChangeForm, new_tag: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="green_safe">تگ سبز (ایمن و تاییدشده)</option>
                  <option value="yellow_restricted">تگ زرد (مشروط و محدود)</option>
                  <option value="red_unsafe">تگ قرمز (خطرناک و اکیداً ممنوع)</option>
                  <option value="dismantled">برچیده‌شده (Dismantled)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">علت تغییر برچسب</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={tagChangeForm.reason}
                  onChange={(e) => setTagChangeForm({ ...tagChangeForm, reason: e.target.value })}
                  placeholder="مثال: وزش باد شدید، پایان عملیات و برچیدن، آسیب فیزیکی پایه..."
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
              {tagChangeForm.new_tag === "yellow_restricted" && (
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">محدودیت‌های دسترسی تگ زرد</label>
                  <input
                    type="text"
                    className="form-input"
                    value={tagChangeForm.yellow_restrictions}
                    onChange={(e) => setTagChangeForm({ ...tagChangeForm, yellow_restrictions: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="button button-secondary" onClick={() => setTagChangingScaffold(null)}>
                  انصراف
                </button>
                <button type="submit" className="button button-primary">
                  ثبت تغییر تگ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PRINTABLE TAG CARD (WITH QR) */}
      {tagCardData && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "450px", maxWidth: "90vw", padding: "1.5rem" }}>
            <div style={{ textAlign: "center", borderBottom: "2px dashed var(--color-border)", paddingBottom: "1rem", marginBottom: "1rem" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>شناسنامه فیزیکی برچسب داربست</div>
              <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{tagCardData.organization_name}</div>
            </div>

            <div style={{ display: "grid", gap: "0.6rem", fontSize: "0.9rem", marginBottom: "1rem" }}>
              <div>شماره برچسب: <strong style={{ fontFamily: "monospace" }}>{tagCardData.tag_number}</strong></div>
              <div>کارگاه: <strong>{tagCardData.workplace_name}</strong></div>
              <div>موقعیت: <strong>{tagCardData.location_details}</strong></div>
              <div>نوع و ظرفیت: <strong>{tagCardData.scaffold_type_display} ({tagCardData.load_duty_display})</strong></div>
              <div>وضعیت برچسب: <strong>{tagCardData.tag_status_display}</strong></div>
              <div>اعتبار تا: <strong>{tagCardData.valid_until ? new Date(tagCardData.valid_until).toLocaleDateString("fa-IR") : "-"}</strong></div>
              <div>موعد بازرسی بعدی: <strong>{tagCardData.next_inspection_due || "-"}</strong></div>
              <div>برپاکننده: <strong>{tagCardData.erected_by}</strong></div>
              {tagCardData.restrictions && (
                <div style={{ color: "#ca8a04" }}>شروط تگ زرد: <strong>{tagCardData.restrictions}</strong></div>
              )}
            </div>

            <div style={{ textAlign: "center", backgroundColor: "var(--color-bg-secondary)", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.85rem", wordBreak: "break-all" }}>
                [QR PAYLOAD]: {tagCardData.qr_payload}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.3rem" }}>
                قابل اسکن با اپلیکیشن بازرسان میدانی HSE
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="button button-primary" onClick={() => setTagCardData(null)}>
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: NEW SCAFFOLD */}
      {showCreateModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card modal-content" style={{ width: "550px", maxWidth: "90vw", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>برپایی و ثبت داربست جدید</h3>
            <form onSubmit={handleCreateScaffold}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">کارگاه</label>
                  <select
                    className="form-select"
                    required
                    value={createForm.workplace}
                    onChange={(e) => setCreateForm({ ...createForm, workplace: e.target.value })}
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
                <div className="form-group">
                  <label className="form-label">شماره تگ یکتا</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={createForm.tag_number}
                    onChange={(e) => setCreateForm({ ...createForm, tag_number: e.target.value })}
                    placeholder="SCF-FA-002"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">نوع داربست</label>
                  <select
                    className="form-select"
                    value={createForm.scaffold_type}
                    onChange={(e) => setCreateForm({ ...createForm, scaffold_type: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="modular_system">سیستم مدولار (کاپلاک / رینگی)</option>
                    <option value="tube_coupler">لوله‌ای و بستی سنتی</option>
                    <option value="mobile_tower">برجک متحرک چرخ‌دار</option>
                    <option value="suspended">معلق / کلایمر</option>
                    <option value="cantilever">طره‌ای و کنسولی</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">رده بارگذاری</label>
                  <select
                    className="form-select"
                    value={createForm.load_duty}
                    onChange={(e) => setCreateForm({ ...createForm, load_duty: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="light_duty">سبک کار (75 kg/m²)</option>
                    <option value="medium_duty">متوسط کار (150 kg/m²)</option>
                    <option value="heavy_duty">سنگین کار (225 kg/m²)</option>
                    <option value="special_duty">بارگذاری خاص (Special)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">موقعیت دقیق استقرار</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={createForm.location_details}
                  onChange={(e) => setCreateForm({ ...createForm, location_details: e.target.value })}
                  placeholder="مثال: دیواره جنوبی کوره احیاء شماره ۲"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">ارتفاع (متر)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    required
                    value={createForm.height_meters}
                    onChange={(e) => setCreateForm({ ...createForm, height_meters: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">طول (متر)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    required
                    value={createForm.length_meters}
                    onChange={(e) => setCreateForm({ ...createForm, length_meters: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">عرض (متر)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    required
                    value={createForm.width_meters}
                    onChange={(e) => setCreateForm({ ...createForm, width_meters: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">شرکت پیمانکار برپاکننده</label>
                  <select
                    className="form-select"
                    value={createForm.contractor}
                    onChange={(e) => setCreateForm({ ...createForm, contractor: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="">انتخاب پیمانکار...</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">تاریخ برپایی و تحویل</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={createForm.erection_date}
                    onChange={(e) => setCreateForm({ ...createForm, erection_date: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">کاربری مورد نظر</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={createForm.intended_use}
                  onChange={(e) => setCreateForm({ ...createForm, intended_use: e.target.value })}
                  placeholder="تعمیرات لوله‌های بخار، رنگ‌آمیزی ستون‌ها"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="button button-secondary" onClick={() => setShowCreateModal(false)}>
                  انصراف
                </button>
                <button type="submit" className="button button-primary">
                  ثبت داربست (تگ اولیه قرمز)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
