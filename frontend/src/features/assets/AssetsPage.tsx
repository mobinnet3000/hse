import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import {
  ApiRequestError,
  cancelMaintenanceWorkOrder,
  changeEquipmentStatus,
  completeMaintenanceWorkOrder,
  createCalibration,
  createEquipment,
  createMaintenancePlan,
  createMaintenanceWorkOrder,
  fetchCalibrations,
  fetchEquipment,
  fetchEquipmentDetail,
  fetchEquipmentStats,
  fetchHazards,
  fetchMaintenancePlans,
  fetchMaintenanceWorkOrders,
  fetchMemberships,
  fetchOrganizations,
  fetchPermits,
  fetchWorkplaces,
  startMaintenanceWorkOrder,
  updateEquipment,
  updateMaintenancePlan,
  type CalibrationRecord,
  type EquipmentDetail,
  type EquipmentListItem,
  type EquipmentStats,
  type EquipmentStatus,
  type Hazard,
  type MaintenancePlan,
  type MaintenanceWorkOrder,
  type Membership,
  type Organization,
  type PermitListItem,
  type Workplace,
} from "../../services/api";

function errorMessage(error: unknown) {
  return error instanceof ApiRequestError ? error.message : "خطای نامشخص رخ داد.";
}

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function pickPayload(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== "" && value !== undefined),
  );
}

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  ready: "آماده به کار",
  under_maintenance: "در حال سرویس/تعمیر",
  out_of_service: "خارج از سرویس",
  retired: "بازنشسته",
};

const STATUS_COLORS: Record<string, string> = {
  ready: "#1e7d45",
  under_maintenance: "#9a6700",
  out_of_service: "#b42318",
  retired: "#59636e",
  valid: "#1e7d45",
  due_soon: "#9a6700",
  expired: "#b42318",
  failed: "#b42318",
  missing: "#b42318",
  not_required: "#59636e",
};

const CATEGORY_LABELS: Record<string, string> = {
  fire_extinguisher: "خاموش‌کننده حریق",
  ppe: "تجهیزات حفاظت فردی قابل ردیابی",
  gas_detection: "تجهیزات گازسنجی",
  electrical: "تجهیزات برقی",
  rescue: "امداد و نجات",
  lifting: "تجهیزات بالابر و بارگیری",
  other: "سایر تجهیزات",
};

type Tab = "equipment" | "plans" | "workorders" | "calibrations";

const emptyEquipmentForm = {
  code: "",
  name: "",
  category: "other",
  category_detail: "",
  workplace: "",
  status: "ready",
  manufacturer: "",
  model_number: "",
  serial_number: "",
  purchase_date: "",
  installation_date: "",
  description: "",
  specifications: "",
  calibration_required: false,
  related_hazards: [] as number[],
  related_permits: [] as number[],
};

const emptyPlanForm = {
  equipment: "",
  title: "",
  interval_days: "90",
  start_date: todayIso(),
  responsible: "",
  instructions: "",
  is_active: true,
};

const emptyOrderForm = {
  equipment: "",
  plan: "",
  title: "",
  work_type: "preventive",
  assigned_to: "",
  scheduled_date: todayIso(),
  description: "",
};

const emptyCalibrationForm = {
  equipment: "",
  performed_on: todayIso(),
  next_due_on: "",
  provider: "",
  certificate_number: "",
  result: "passed",
  notes: "",
  document_reference: "",
};

export function AssetsPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [permits, setPermits] = useState<PermitListItem[]>([]);
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [stats, setStats] = useState<EquipmentStats | null>(null);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([]);
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([]);
  const [detail, setDetail] = useState<EquipmentDetail | null>(null);
  const [tab, setTab] = useState<Tab>("equipment");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "",
    calibration_status: "",
    due: "",
  });
  const [equipmentForm, setEquipmentForm] = useState({ ...emptyEquipmentForm });
  const [editingEquipmentId, setEditingEquipmentId] = useState<number | null>(null);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [statusForm, setStatusForm] = useState<{ status: EquipmentStatus; reason: string }>({
    status: "ready",
    reason: "",
  });

  const [planForm, setPlanForm] = useState({ ...emptyPlanForm });
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [orderForm, setOrderForm] = useState({ ...emptyOrderForm });
  const [calibrationForm, setCalibrationForm] = useState({ ...emptyCalibrationForm });
  const [completeOrderId, setCompleteOrderId] = useState<number | null>(null);
  const [completeForm, setCompleteForm] = useState({
    completed_date: todayIso(),
    findings: "",
    result: "",
  });
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const myRole = memberships.find((item) => item.user === user?.id)?.role;
  const isPlatformAdmin = user?.global_role === "platform_admin";
  const canManage = Boolean(
    isPlatformAdmin || (myRole && ["org_admin", "hse_manager"].includes(myRole)),
  );
  const canConduct = Boolean(
    isPlatformAdmin ||
      (myRole &&
        ["org_admin", "hse_manager", "hse_inspector", "workshop_supervisor"].includes(myRole)),
  );
  const canCalibrate = Boolean(
    isPlatformAdmin ||
      (myRole && ["org_admin", "hse_manager", "hse_inspector"].includes(myRole)),
  );

  const equipmentOptions = useMemo(
    () => equipment.map((item) => ({ value: String(item.id), label: `${item.code} — ${item.name}` })),
    [equipment],
  );
  const planOptions = useMemo(
    () =>
      plans
        .filter((plan) => String(plan.equipment) === orderForm.equipment)
        .map((plan) => ({ value: String(plan.id), label: plan.title })),
    [plans, orderForm.equipment],
  );

  async function loadEquipment(orgId: number) {
    const params: Record<string, string | number | undefined> = {
      organization: orgId,
      search: filters.search,
      category: filters.category,
      status: filters.status,
      calibration_status: filters.calibration_status,
      due: filters.due,
    };
    const [equipmentItems, statsData] = await Promise.all([
      fetchEquipment(params),
      fetchEquipmentStats(params),
    ]);
    setEquipment(equipmentItems);
    setStats(statsData);
  }

  async function loadSupporting(orgId: number) {
    const [planItems, orderItems, calibrationItems, hazardItems, permitItems, membershipItems] =
      await Promise.all([
        fetchMaintenancePlans({ organization: orgId }),
        fetchMaintenanceWorkOrders({ organization: orgId }),
        fetchCalibrations({ organization: orgId }),
        fetchHazards(orgId),
        fetchPermits({ organization: orgId }),
        fetchMemberships(orgId),
      ]);
    setPlans(planItems);
    setWorkOrders(orderItems);
    setCalibrations(calibrationItems);
    setHazards(hazardItems);
    setPermits(permitItems);
    setMemberships(membershipItems);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(controller.signal)
      .then((items) => {
        setOrganizations(items);
        if (items.length > 0) setOrganizationId(items[0].id);
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (organizationId === null) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    Promise.all([loadEquipment(organizationId), loadSupporting(organizationId)])
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    if (organizationId === null) return;
    fetchWorkplaces(organizationId)
      .then(setWorkplaces)
      .catch(() => setWorkplaces([]));
  }, [organizationId]);

  async function refreshAll() {
    if (organizationId === null) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadEquipment(organizationId), loadSupporting(organizationId)]);
      if (detail) {
        setDetail(await fetchEquipmentDetail(detail.id));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: number) {
    setFormError(null);
    try {
      const item = await fetchEquipmentDetail(id);
      setDetail(item);
      setStatusForm({ status: item.status, reason: "" });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function beginCreateEquipment() {
    setEditingEquipmentId(null);
    setEquipmentForm({ ...emptyEquipmentForm });
    setShowEquipmentForm(true);
    setFormError(null);
  }

  async function beginEditEquipment(item: EquipmentListItem) {
    setFormError(null);
    try {
      const full = await fetchEquipmentDetail(item.id);
      setEditingEquipmentId(full.id);
      setEquipmentForm({
        code: full.code,
        name: full.name,
        category: full.category,
        category_detail: full.category_detail,
        workplace: full.workplace ? String(full.workplace) : "",
        status: full.status,
        manufacturer: full.manufacturer,
        model_number: full.model_number,
        serial_number: full.serial_number,
        purchase_date: full.purchase_date ?? "",
        installation_date: full.installation_date ?? "",
        description: full.description,
        specifications: full.specifications,
        calibration_required: full.calibration_required,
        related_hazards: full.related_hazards.map((hazard) => hazard.id),
        related_permits: full.related_permits.map((permit) => permit.id),
      });
      setShowEquipmentForm(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitEquipment(event: FormEvent) {
    event.preventDefault();
    if (organizationId === null) return;
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const base = pickPayload({
        workplace: equipmentForm.workplace ? Number(equipmentForm.workplace) : null,
        name: equipmentForm.name,
        category: equipmentForm.category,
        category_detail: equipmentForm.category_detail,
        manufacturer: equipmentForm.manufacturer,
        model_number: equipmentForm.model_number,
        serial_number: equipmentForm.serial_number,
        purchase_date: equipmentForm.purchase_date,
        installation_date: equipmentForm.installation_date,
        description: equipmentForm.description,
        specifications: equipmentForm.specifications,
        calibration_required: equipmentForm.calibration_required,
        related_hazards: equipmentForm.related_hazards,
        related_permits: equipmentForm.related_permits,
      });
      if (editingEquipmentId === null) {
        await createEquipment({
          ...base,
          organization: organizationId,
          code: equipmentForm.code,
          status: equipmentForm.status,
        });
        setNotice("تجهیز با موفقیت ثبت شد.");
      } else {
        await updateEquipment(editingEquipmentId, base);
        setNotice("تغییرات تجهیز ذخیره شد.");
      }
      setShowEquipmentForm(false);
      setEditingEquipmentId(null);
      setEquipmentForm({ ...emptyEquipmentForm });
      await refreshAll();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitStatus(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const updated = await changeEquipmentStatus(detail.id, statusForm);
      setDetail(updated);
      setNotice("وضعیت تجهیز به‌روزرسانی شد.");
      await refreshAll();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitPlan(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const payload = {
        ...pickPayload({
          equipment: planForm.equipment ? Number(planForm.equipment) : undefined,
          title: planForm.title,
          interval_days: Number(planForm.interval_days),
          start_date: planForm.start_date,
          responsible: planForm.responsible ? Number(planForm.responsible) : null,
          instructions: planForm.instructions,
          is_active: planForm.is_active,
        }),
      };
      if (editingPlanId === null) {
        await createMaintenancePlan(payload);
        setNotice("برنامه نگهداری ثبت شد.");
      } else {
        await updateMaintenancePlan(editingPlanId, payload);
        setNotice("برنامه نگهداری به‌روزرسانی شد.");
      }
      setPlanForm({ ...emptyPlanForm });
      setEditingPlanId(null);
      await refreshAll();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await createMaintenanceWorkOrder({
        equipment: Number(orderForm.equipment),
        plan: orderForm.plan ? Number(orderForm.plan) : null,
        title: orderForm.title || undefined,
        work_type: orderForm.work_type || undefined,
        assigned_to: orderForm.assigned_to ? Number(orderForm.assigned_to) : null,
        scheduled_date: orderForm.scheduled_date,
        description: orderForm.description,
      });
      setNotice("دستورکار نگهداری ثبت شد.");
      setOrderForm({ ...emptyOrderForm });
      await refreshAll();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function startOrder(id: number) {
    setSaving(true);
    setFormError(null);
    try {
      await startMaintenanceWorkOrder(id);
      setNotice("دستورکار شروع شد و تجهیز در حال سرویس قرار گرفت.");
      await refreshAll();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitCompleteOrder(event: FormEvent) {
    event.preventDefault();
    if (completeOrderId === null) return;
    setSaving(true);
    setFormError(null);
    try {
      await completeMaintenanceWorkOrder(completeOrderId, {
        ...pickPayload({
          completed_date: completeForm.completed_date,
          findings: completeForm.findings,
          result: completeForm.result,
        }),
      } as { result: string; findings?: string; completed_date?: string });
      setNotice("نتیجه سرویس ثبت و موعد بعدی برنامه به‌روزرسانی شد.");
      setCompleteOrderId(null);
      setCompleteForm({ completed_date: todayIso(), findings: "", result: "" });
      await refreshAll();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitCancelOrder(event: FormEvent) {
    event.preventDefault();
    if (cancelOrderId === null) return;
    setSaving(true);
    setFormError(null);
    try {
      await cancelMaintenanceWorkOrder(cancelOrderId, cancelReason);
      setNotice("دستورکار لغو شد.");
      setCancelOrderId(null);
      setCancelReason("");
      await refreshAll();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitCalibration(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await createCalibration({
        equipment: Number(calibrationForm.equipment),
        performed_on: calibrationForm.performed_on,
        next_due_on: calibrationForm.next_due_on,
        provider: calibrationForm.provider,
        certificate_number: calibrationForm.certificate_number,
        result: calibrationForm.result,
        notes: calibrationForm.notes,
        document_reference: calibrationForm.document_reference,
      });
      setNotice(
        calibrationForm.result === "failed"
          ? "کالیبراسیون ناموفق ثبت شد و تجهیز خارج از سرویس قرار گرفت."
          : "کالیبراسیون ثبت شد.",
      );
      setCalibrationForm({ ...emptyCalibrationForm });
      if (detail) setDetail(await fetchEquipmentDetail(detail.id));
      await refreshAll();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function statusColor(status: string) {
    return STATUS_COLORS[status] ?? "#59636e";
  }

  function startEditPlan(plan: MaintenancePlan) {
    setEditingPlanId(plan.id);
    setPlanForm({
      equipment: String(plan.equipment),
      title: plan.title,
      interval_days: String(plan.interval_days),
      start_date: plan.start_date,
      responsible: plan.responsible ? String(plan.responsible) : "",
      instructions: plan.instructions,
      is_active: plan.is_active,
    });
    setTab("plans");
  }

  function beginPlanFor(equipmentId: number) {
    setEditingPlanId(null);
    setPlanForm({ ...emptyPlanForm, equipment: String(equipmentId) });
    setTab("plans");
  }

  function beginOrderFor(equipmentId: number) {
    setOrderForm({ ...emptyOrderForm, equipment: String(equipmentId) });
    setTab("workorders");
  }

  function beginCalibrationFor(equipmentId: number) {
    setCalibrationForm({ ...emptyCalibrationForm, equipment: String(equipmentId) });
    setTab("calibrations");
  }

  return (
    <div className="stack" dir="rtl">
      <header className="page-header">
        <h2>تجهیزات، نگهداری پیشگیرانه و کالیبراسیون</h2>
        <p className="muted">
          ثبت دارایی‌های HSE، برنامه سرویس، دستورکارها و اعتبار کالیبراسیون در یک چرخه قابل ردیابی.
        </p>
      </header>

      <section className="card" style={{ maxWidth: "none" }}>
        <div className="toolbar">
          <label htmlFor="asset-org"><strong>سازمان:</strong></label>
          <select
            id="asset-org"
            value={organizationId ?? ""}
            onChange={(event) => setOrganizationId(Number(event.target.value))}
            disabled={organizations.length === 0}
          >
            {organizations.length === 0 && <option value="">سازمانی یافت نشد</option>}
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name} ({organization.code})
              </option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={() => void refreshAll()} disabled={loading}>
            به‌روزرسانی
          </button>
          {canManage && (
            <button type="button" onClick={beginCreateEquipment}>
              ثبت تجهیز جدید
            </button>
          )}
        </div>
      </section>

      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {formError && <div className="alert alert-error" role="alert">{formError}</div>}
      {loading && <p className="muted">در حال بارگذاری تجهیزات و سوابق…</p>}

      {stats && (
        <div
          className="metrics-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <div className="card" style={{ maxWidth: "none" }}>
            <h3>کل تجهیزات</h3>
            <p style={{ fontSize: "1.6rem", fontWeight: "bold", margin: 0 }}>{stats.total_equipment}</p>
          </div>
          <div className="card" style={{ maxWidth: "none" }}>
            <h3>آماده به کار</h3>
            <p style={{ fontSize: "1.6rem", fontWeight: "bold", margin: 0, color: "#1e7d45" }}>
              {stats.ready_count}
            </p>
          </div>
          <div className="card" style={{ maxWidth: "none" }}>
            <h3>خارج از سرویس</h3>
            <p style={{ fontSize: "1.6rem", fontWeight: "bold", margin: 0, color: "#b42318" }}>
              {stats.out_of_service_count}
            </p>
          </div>
          <div className="card" style={{ maxWidth: "none" }}>
            <h3>سرویس عقب‌افتاده</h3>
            <p style={{ fontSize: "1.6rem", fontWeight: "bold", margin: 0, color: "#b42318" }}>
              {stats.maintenance_overdue_count}
            </p>
          </div>
          <div className="card" style={{ maxWidth: "none" }}>
            <h3>کالیبراسیون نزدیک سررسید</h3>
            <p style={{ fontSize: "1.6rem", fontWeight: "bold", margin: 0, color: "#9a6700" }}>
              {stats.calibration_due_soon_count}
            </p>
          </div>
          <div className="card" style={{ maxWidth: "none" }}>
            <h3>کالیبراسیون منقضی/ناموفق</h3>
            <p style={{ fontSize: "1.6rem", fontWeight: "bold", margin: 0, color: "#b42318" }}>
              {stats.calibration_expired_count + stats.calibration_failed_count}
            </p>
          </div>
        </div>
      )}

      <nav className="toolbar" aria-label="بخش‌های تجهیزات">
        {([
          ["equipment", "تجهیزات"],
          ["plans", "برنامه‌های نگهداری"],
          ["workorders", "دستورکارها"],
          ["calibrations", "کالیبراسیون"],
        ] as Array<[Tab, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? "" : "secondary"}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {showEquipmentForm && (
        <section className="card" style={{ maxWidth: "none" }}>
          <h3>{editingEquipmentId === null ? "ثبت تجهیز جدید" : "ویرایش تجهیز"}</h3>
          <form className="stack" onSubmit={submitEquipment}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
              <div className="stack">
                <label htmlFor="eq-code">کد تجهیز *</label>
                <input
                  id="eq-code"
                  required
                  value={equipmentForm.code}
                  disabled={editingEquipmentId !== null}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, code: event.target.value })}
                />
              </div>
              <div className="stack">
                <label htmlFor="eq-name">نام تجهیز *</label>
                <input
                  id="eq-name"
                  required
                  value={equipmentForm.name}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, name: event.target.value })}
                />
              </div>
              <div className="stack">
                <label htmlFor="eq-category">دسته‌بندی</label>
                <select
                  id="eq-category"
                  value={equipmentForm.category}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, category: event.target.value })}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="stack">
                <label htmlFor="eq-workplace">محل استقرار</label>
                <select
                  id="eq-workplace"
                  value={equipmentForm.workplace}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, workplace: event.target.value })}
                >
                  <option value="">بدون محل مشخص</option>
                  {workplaces.map((workplace) => (
                    <option key={workplace.id} value={workplace.id}>{workplace.name}</option>
                  ))}
                </select>
              </div>
              {editingEquipmentId === null && (
                <div className="stack">
                  <label htmlFor="eq-status">وضعیت اولیه</label>
                  <select
                    id="eq-status"
                    value={equipmentForm.status}
                    onChange={(event) => setEquipmentForm({ ...equipmentForm, status: event.target.value })}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="stack">
                <label htmlFor="eq-manufacturer">سازنده</label>
                <input
                  id="eq-manufacturer"
                  value={equipmentForm.manufacturer}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, manufacturer: event.target.value })}
                />
              </div>
              <div className="stack">
                <label htmlFor="eq-model">مدل</label>
                <input
                  id="eq-model"
                  value={equipmentForm.model_number}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, model_number: event.target.value })}
                />
              </div>
              <div className="stack">
                <label htmlFor="eq-serial">شماره سریال</label>
                <input
                  id="eq-serial"
                  value={equipmentForm.serial_number}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, serial_number: event.target.value })}
                />
              </div>
              <div className="stack">
                <label htmlFor="eq-purchase">تاریخ خرید</label>
                <input
                  id="eq-purchase"
                  type="date"
                  value={equipmentForm.purchase_date}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, purchase_date: event.target.value })}
                />
              </div>
              <div className="stack">
                <label htmlFor="eq-install">تاریخ نصب</label>
                <input
                  id="eq-install"
                  type="date"
                  value={equipmentForm.installation_date}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, installation_date: event.target.value })}
                />
              </div>
              <div className="stack">
                <label htmlFor="eq-category-detail">توضیح دسته «سایر»</label>
                <input
                  id="eq-category-detail"
                  value={equipmentForm.category_detail}
                  onChange={(event) => setEquipmentForm({ ...equipmentForm, category_detail: event.target.value })}
                />
              </div>
            </div>

            <div className="stack">
              <label htmlFor="eq-description">توضیحات</label>
              <textarea
                id="eq-description"
                value={equipmentForm.description}
                onChange={(event) => setEquipmentForm({ ...equipmentForm, description: event.target.value })}
              />
            </div>
            <div className="stack">
              <label htmlFor="eq-specs">مشخصات فنی</label>
              <textarea
                id="eq-specs"
                value={equipmentForm.specifications}
                onChange={(event) => setEquipmentForm({ ...equipmentForm, specifications: event.target.value })}
              />
            </div>
            <label>
              <input
                type="checkbox"
                checked={equipmentForm.calibration_required}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setEquipmentForm({
                    ...equipmentForm,
                    calibration_required: checked,
                    status:
                      checked && editingEquipmentId === null && equipmentForm.status === "ready"
                        ? "out_of_service"
                        : equipmentForm.status,
                  });
                }}
              />{" "}
              این تجهیز نیازمند کالیبراسیون دوره‌ای است
            </label>
            {equipmentForm.calibration_required && editingEquipmentId === null && (
              <p className="muted">
                تجهیز نیازمند کالیبراسیون، تا ثبت اولین کالیبراسیون معتبر «خارج از سرویس» می‌ماند.
              </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
              <div className="stack">
                <label htmlFor="eq-hazards">مخاطرات مرتبط (چندانتخابی)</label>
                <select
                  id="eq-hazards"
                  multiple
                  value={equipmentForm.related_hazards.map(String)}
                  onChange={(event) =>
                    setEquipmentForm({
                      ...equipmentForm,
                      related_hazards: Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                    })
                  }
                >
                  {hazards.map((hazard) => (
                    <option key={hazard.id} value={hazard.id}>{hazard.title}</option>
                  ))}
                </select>
              </div>
              <div className="stack">
                <label htmlFor="eq-permits">مجوزهای کار مرتبط (چندانتخابی)</label>
                <select
                  id="eq-permits"
                  multiple
                  value={equipmentForm.related_permits.map(String)}
                  onChange={(event) =>
                    setEquipmentForm({
                      ...equipmentForm,
                      related_permits: Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                    })
                  }
                >
                  {permits.map((permit) => (
                    <option key={permit.id} value={permit.id}>{permit.reference_code} — {permit.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره تجهیز"}</button>
              <button type="button" className="secondary" onClick={() => setShowEquipmentForm(false)}>
                انصراف
              </button>
            </div>
          </form>
        </section>
      )}

      {tab === "equipment" && (
        <>
          <section className="card" style={{ maxWidth: "none" }}>
            <h3>جست‌وجو و فیلتر</h3>
            <form
              className="toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                if (organizationId !== null) void loadEquipment(organizationId);
              }}
            >
              <input
                aria-label="جست‌وجوی تجهیز"
                placeholder="کد، نام، سریال، سازنده…"
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              />
              <select
                aria-label="دسته‌بندی"
                value={filters.category}
                onChange={(event) => setFilters({ ...filters, category: event.target.value })}
              >
                <option value="">همه دسته‌ها</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                aria-label="وضعیت تجهیز"
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
              >
                <option value="">همه وضعیت‌ها</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                aria-label="وضعیت کالیبراسیون"
                value={filters.calibration_status}
                onChange={(event) => setFilters({ ...filters, calibration_status: event.target.value })}
              >
                <option value="">همه وضعیت‌های کالیبراسیون</option>
                <option value="not_required">لازم نیست</option>
                <option value="missing">ثبت‌نشده</option>
                <option value="valid">معتبر</option>
                <option value="due_soon">نزدیک سررسید</option>
                <option value="expired">منقضی</option>
                <option value="failed">ناموفق</option>
              </select>
              <select
                aria-label="سررسید"
                value={filters.due}
                onChange={(event) => setFilters({ ...filters, due: event.target.value })}
              >
                <option value="">همه سررسیدها</option>
                <option value="maintenance_overdue">نگهداری عقب‌افتاده</option>
                <option value="maintenance_due_soon">نگهداری نزدیک سررسید</option>
                <option value="calibration_expired">کالیبراسیون منقضی</option>
                <option value="calibration_due_soon">کالیبراسیون نزدیک سررسید</option>
              </select>
              <button type="submit">اعمال فیلتر</button>
            </form>
          </section>

          <section className="card" style={{ maxWidth: "none" }}>
            <h3>فهرست تجهیزات</h3>
            {!loading && equipment.length === 0 && (
              <p className="muted">تجهیزی با این فیلترها یافت نشد. ابتدا یک تجهیز ثبت کنید یا فیلترها را تغییر دهید.</p>
            )}
            {equipment.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>کد</th>
                      <th>نام</th>
                      <th>دسته</th>
                      <th>محل</th>
                      <th>وضعیت</th>
                      <th>کالیبراسیون</th>
                      <th>نتیجه سرویس باز</th>
                      <th>اقدام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((item) => (
                      <tr key={item.id}>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td>{item.category_display}</td>
                        <td>{item.workplace_name ?? "—"}</td>
                        <td>
                          <span style={{ color: statusColor(item.status), fontWeight: 600 }}>
                            {item.status_display}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: statusColor(item.calibration_status) }}>
                            {item.calibration_status_display}
                          </span>
                          {item.calibration_due_on && (
                            <div className="muted" style={{ fontSize: "0.8rem" }}>سررسید: {item.calibration_due_on}</div>
                          )}
                        </td>
                        <td>{item.open_work_orders_count}</td>
                        <td>
                          <button type="button" onClick={() => void openDetail(item.id)}>جزئیات</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {detail && tab === "equipment" && (
        <section className="card" style={{ maxWidth: "none" }}>
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>{detail.code} — {detail.name}</h3>
            {canManage && (
              <button type="button" className="secondary" onClick={() => void beginEditEquipment(detail)}>
                ویرایش تجهیز
              </button>
            )}
          </div>
          <p className="muted">
            {detail.category_display} • {detail.workplace_name ?? "بدون محل"} • {" "}
            <span style={{ color: statusColor(detail.status), fontWeight: 600 }}>{detail.status_display}</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
            <div>
              <h4>شناسنامه</h4>
              <p>سازنده: {detail.manufacturer || "—"}</p>
              <p>مدل: {detail.model_number || "—"}</p>
              <p>سریال: {detail.serial_number || "—"}</p>
              <p>تاریخ خرید: {detail.purchase_date || "—"}</p>
              <p>تاریخ نصب: {detail.installation_date || "—"}</p>
              <p>کالیبراسیون: <span style={{ color: statusColor(detail.calibration_status) }}>{detail.calibration_status_display}</span></p>
              {detail.calibration_due_on && <p>سررسید کالیبراسیون: {detail.calibration_due_on}</p>}
            </div>
            <div>
              <h4>اقدام‌های مجاز</h4>
              <div className="toolbar">
                {canManage && (
                  <form className="stack" onSubmit={submitStatus} style={{ flex: 1 }}>
                    <label htmlFor="status-select">تغییر وضعیت کنترل‌شده</label>
                    <select
                      id="status-select"
                      value={statusForm.status}
                      onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value as EquipmentStatus })}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <input
                      aria-label="علت تغییر وضعیت"
                      placeholder="علت تغییر وضعیت (اختیاری)"
                      value={statusForm.reason}
                      onChange={(event) => setStatusForm({ ...statusForm, reason: event.target.value })}
                    />
                    <button type="submit" disabled={saving}>اعمال وضعیت</button>
                  </form>
                )}
                <div className="stack">
                  {canManage && (
                    <button type="button" onClick={() => beginPlanFor(detail.id)}>برنامه نگهداری جدید</button>
                  )}
                  {canConduct && (
                    <button type="button" onClick={() => beginOrderFor(detail.id)}>ثبت دستورکار</button>
                  )}
                  {canCalibrate && (
                    <button type="button" onClick={() => beginCalibrationFor(detail.id)}>ثبت کالیبراسیون</button>
                  )}
                </div>
              </div>
              {detail.status !== "ready" && detail.calibration_required && !detail.is_calibration_valid && (
                <p className="alert alert-error" style={{ marginTop: "0.75rem" }}>
                  تا زمان ثبت کالیبراسیون معتبر، این تجهیز قابل اعلام به‌عنوان آماده‌به‌کار نیست.
                </p>
              )}
            </div>
          </div>

          <h4>مخاطرات و مجوزهای مرتبط</h4>
          <p>
            مخاطرات:{" "}
            {detail.related_hazards.length
              ? detail.related_hazards.map((hazard) => hazard.title).join("، ")
              : "—"}
          </p>
          <p>
            مجوزهای کار:{" "}
            {detail.related_permits.length
              ? detail.related_permits.map((permit) => `${permit.reference_code} (${permit.status_display})`).join("، ")
              : "—"}
          </p>

          <h4>سوابق یکپارچه HSE</h4>
          <p>حوادث مرتبط: {detail.related_incidents.length}</p>
          <p>بازرسی‌های مرتبط: {detail.related_inspections.length}</p>
          <p>عدم‌انطباق‌ها: {detail.related_nonconformities.length}</p>
          <p>اقدامات اصلاحی (از مسیر عدم‌انطباق): {detail.related_corrective_actions.length}</p>

          <h4>برنامه‌های نگهداری</h4>
          {detail.maintenance_plans.length === 0 && <p className="muted">برنامه‌ای ثبت نشده است.</p>}
          <ul>
            {detail.maintenance_plans.map((plan) => (
              <li key={plan.id}>
                {plan.title} — هر {plan.interval_days} روز — موعد بعدی {plan.next_due_date}
                {plan.is_overdue ? " (عقب‌افتاده)" : plan.is_due_soon ? " (نزدیک سررسید)" : ""}
              </li>
            ))}
          </ul>

          <h4>دستورکارهای نگهداری</h4>
          {detail.work_orders.length === 0 && <p className="muted">دستورکاری ثبت نشده است.</p>}
          <ul>
            {detail.work_orders.map((order) => (
              <li key={order.id}>
                {order.title} — {order.status_display} — برنامه‌ریزی: {order.scheduled_date}
                {order.completed_date ? ` — انجام: ${order.completed_date}` : ""}
              </li>
            ))}
          </ul>

          <h4>تاریخچه کالیبراسیون</h4>
          {detail.calibrations.length === 0 && <p className="muted">کالیبراسیونی ثبت نشده است.</p>}
          {detail.calibrations.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>تاریخ انجام</th>
                    <th>سررسید</th>
                    <th>نتیجه</th>
                    <th>ارائه‌دهنده</th>
                    <th>گواهی</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.calibrations.map((record) => (
                    <tr key={record.id}>
                      <td>{record.performed_on}</td>
                      <td>{record.next_due_on}</td>
                      <td style={{ color: record.result === "failed" ? "#b42318" : "#1e7d45" }}>{record.result_display}</td>
                      <td>{record.provider}</td>
                      <td>{record.certificate_number || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "plans" && (
        <>
          <section className="card" style={{ maxWidth: "none" }}>
            <h3>{editingPlanId === null ? "تعریف برنامه نگهداری" : "ویرایش برنامه نگهداری"}</h3>
            {!canManage && <p className="muted">فقط مدیر سازمان یا مدیر HSE می‌تواند برنامه بسازد.</p>}
            {canManage && (
              <form className="stack" onSubmit={submitPlan}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  <div className="stack">
                    <label htmlFor="plan-equipment">تجهیز *</label>
                    <select
                      id="plan-equipment"
                      required
                      value={planForm.equipment}
                      disabled={editingPlanId !== null}
                      onChange={(event) => setPlanForm({ ...planForm, equipment: event.target.value })}
                    >
                      <option value="">انتخاب تجهیز</option>
                      {equipmentOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="stack">
                    <label htmlFor="plan-title">عنوان *</label>
                    <input
                      id="plan-title"
                      required
                      value={planForm.title}
                      onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })}
                    />
                  </div>
                  <div className="stack">
                    <label htmlFor="plan-interval">تناوب (روز) *</label>
                    <input
                      id="plan-interval"
                      type="number"
                      min={1}
                      max={3650}
                      required
                      value={planForm.interval_days}
                      onChange={(event) => setPlanForm({ ...planForm, interval_days: event.target.value })}
                    />
                  </div>
                  <div className="stack">
                    <label htmlFor="plan-start">تاریخ شروع/اولین موعد *</label>
                    <input
                      id="plan-start"
                      type="date"
                      required
                      value={planForm.start_date}
                      onChange={(event) => setPlanForm({ ...planForm, start_date: event.target.value })}
                    />
                  </div>
                  <div className="stack">
                    <label htmlFor="plan-responsible">مسئول</label>
                    <select
                      id="plan-responsible"
                      value={planForm.responsible}
                      onChange={(event) => setPlanForm({ ...planForm, responsible: event.target.value })}
                    >
                      <option value="">بدون مسئول</option>
                      {memberships.map((membership) => (
                        <option key={membership.id} value={membership.user}>
                          {membership.full_name || membership.username}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="stack">
                  <label htmlFor="plan-instructions">دستورالعمل</label>
                  <textarea
                    id="plan-instructions"
                    value={planForm.instructions}
                    onChange={(event) => setPlanForm({ ...planForm, instructions: event.target.value })}
                  />
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={planForm.is_active}
                    onChange={(event) => setPlanForm({ ...planForm, is_active: event.target.checked })}
                  />{" "}
                  برنامه فعال است
                </label>
                <div className="form-actions">
                  <button type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره برنامه"}</button>
                  {editingPlanId !== null && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setEditingPlanId(null);
                        setPlanForm({ ...emptyPlanForm });
                      }}
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>

          <section className="card" style={{ maxWidth: "none" }}>
            <h3>برنامه‌های نگهداری</h3>
            {plans.length === 0 && <p className="muted">برنامه‌ای ثبت نشده است.</p>}
            {plans.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>تجهیز</th>
                      <th>عنوان</th>
                      <th>تناوب</th>
                      <th>موعد بعدی</th>
                      <th>وضعیت</th>
                      <th>مسئول</th>
                      <th>اقدام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id}>
                        <td>{plan.equipment_code} — {plan.equipment_name}</td>
                        <td>{plan.title}</td>
                        <td>{plan.interval_days} روز</td>
                        <td>{plan.next_due_date}</td>
                        <td style={{ color: plan.is_overdue ? "#b42318" : plan.is_due_soon ? "#9a6700" : "inherit" }}>
                          {plan.is_overdue ? "عقب‌افتاده" : plan.is_due_soon ? "نزدیک سررسید" : plan.is_active ? "فعال" : "غیرفعال"}
                        </td>
                        <td>{plan.responsible_name ?? "—"}</td>
                        <td>
                          {canManage && (
                            <button type="button" onClick={() => startEditPlan(plan)}>ویرایش</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === "workorders" && (
        <>
          <section className="card" style={{ maxWidth: "none" }}>
            <h3>ثبت دستورکار نگهداری/تعمیر</h3>
            {!canConduct && <p className="muted">فقط نقش‌های عملیاتی مجاز می‌توانند دستورکار ثبت کنند.</p>}
            {canConduct && (
              <form className="stack" onSubmit={submitOrder}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  <div className="stack">
                    <label htmlFor="order-equipment">تجهیز *</label>
                    <select
                      id="order-equipment"
                      required
                      value={orderForm.equipment}
                      onChange={(event) => setOrderForm({ ...orderForm, equipment: event.target.value, plan: "" })}
                    >
                      <option value="">انتخاب تجهیز</option>
                      {equipmentOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="stack">
                    <label htmlFor="order-plan">برنامه نگهداری (اختیاری)</label>
                    <select
                      id="order-plan"
                      value={orderForm.plan}
                      onChange={(event) => {
                        const plan = plans.find((item) => String(item.id) === event.target.value);
                        setOrderForm({
                          ...orderForm,
                          plan: event.target.value,
                          title: plan?.title ?? orderForm.title,
                          work_type: plan ? "preventive" : orderForm.work_type,
                        });
                      }}
                    >
                      <option value="">دستورکار مستقل</option>
                      {planOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="stack">
                    <label htmlFor="order-title">عنوان *</label>
                    <input
                      id="order-title"
                      required
                      value={orderForm.title}
                      onChange={(event) => setOrderForm({ ...orderForm, title: event.target.value })}
                    />
                  </div>
                  <div className="stack">
                    <label htmlFor="order-type">نوع کار</label>
                    <select
                      id="order-type"
                      value={orderForm.work_type}
                      onChange={(event) => setOrderForm({ ...orderForm, work_type: event.target.value })}
                    >
                      <option value="preventive">نگهداری پیشگیرانه</option>
                      <option value="corrective">تعمیر اصلاحی</option>
                    </select>
                  </div>
                  <div className="stack">
                    <label htmlFor="order-assigned">مسئول انجام</label>
                    <select
                      id="order-assigned"
                      value={orderForm.assigned_to}
                      onChange={(event) => setOrderForm({ ...orderForm, assigned_to: event.target.value })}
                    >
                      <option value="">بدون مسئول</option>
                      {memberships.map((membership) => (
                        <option key={membership.id} value={membership.user}>
                          {membership.full_name || membership.username}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="stack">
                    <label htmlFor="order-date">تاریخ برنامه‌ریزی *</label>
                    <input
                      id="order-date"
                      type="date"
                      required
                      value={orderForm.scheduled_date}
                      onChange={(event) => setOrderForm({ ...orderForm, scheduled_date: event.target.value })}
                    />
                  </div>
                </div>
                <div className="stack">
                  <label htmlFor="order-description">شرح کار</label>
                  <textarea
                    id="order-description"
                    value={orderForm.description}
                    onChange={(event) => setOrderForm({ ...orderForm, description: event.target.value })}
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : "ثبت دستورکار"}</button>
                </div>
              </form>
            )}
          </section>

          <section className="card" style={{ maxWidth: "none" }}>
            <h3>دستورکارها</h3>
            {workOrders.length === 0 && <p className="muted">دستورکاری ثبت نشده است.</p>}
            {workOrders.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>تجهیز</th>
                      <th>عنوان</th>
                      <th>نوع</th>
                      <th>وضعیت</th>
                      <th>برنامه‌ریزی</th>
                      <th>انجام</th>
                      <th>مسئول</th>
                      <th>اقدام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.equipment_code}</td>
                        <td>{order.title}</td>
                        <td>{order.work_type_display}</td>
                        <td>{order.status_display}</td>
                        <td>{order.scheduled_date}</td>
                        <td>{order.completed_date ?? "—"}</td>
                        <td>{order.assigned_to_name ?? "—"}</td>
                        <td>
                          <div className="toolbar">
                            {order.can_start && (
                              <button type="button" onClick={() => void startOrder(order.id)} disabled={saving}>شروع</button>
                            )}
                            {order.can_complete && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompleteOrderId(order.id);
                                  setCompleteForm({ completed_date: todayIso(), findings: "", result: "" });
                                }}
                              >
                                ثبت نتیجه
                              </button>
                            )}
                            {order.can_cancel && (
                              <button type="button" className="secondary" onClick={() => setCancelOrderId(order.id)}>
                                لغو
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {completeOrderId !== null && (
            <section className="card" style={{ maxWidth: "none" }}>
              <h3>ثبت نتیجه سرویس</h3>
              <form className="stack" onSubmit={submitCompleteOrder}>
                <label htmlFor="complete-date">تاریخ انجام *</label>
                <input
                  id="complete-date"
                  type="date"
                  required
                  value={completeForm.completed_date}
                  onChange={(event) => setCompleteForm({ ...completeForm, completed_date: event.target.value })}
                />
                <label htmlFor="complete-findings">یافته‌ها</label>
                <textarea
                  id="complete-findings"
                  value={completeForm.findings}
                  onChange={(event) => setCompleteForm({ ...completeForm, findings: event.target.value })}
                />
                <label htmlFor="complete-result">نتیجه سرویس *</label>
                <textarea
                  id="complete-result"
                  required
                  value={completeForm.result}
                  onChange={(event) => setCompleteForm({ ...completeForm, result: event.target.value })}
                />
                <div className="form-actions">
                  <button type="submit" disabled={saving}>ثبت نتیجه</button>
                  <button type="button" className="secondary" onClick={() => setCompleteOrderId(null)}>انصراف</button>
                </div>
              </form>
            </section>
          )}

          {cancelOrderId !== null && (
            <section className="card" style={{ maxWidth: "none" }}>
              <h3>لغو دستورکار</h3>
              <form className="stack" onSubmit={submitCancelOrder}>
                <label htmlFor="cancel-reason">علت لغو *</label>
                <textarea
                  id="cancel-reason"
                  required
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
                <div className="form-actions">
                  <button type="submit" disabled={saving}>ثبت لغو</button>
                  <button type="button" className="secondary" onClick={() => setCancelOrderId(null)}>انصراف</button>
                </div>
              </form>
            </section>
          )}
        </>
      )}

      {tab === "calibrations" && (
        <>
          <section className="card" style={{ maxWidth: "none" }}>
            <h3>ثبت کالیبراسیون</h3>
            {!canCalibrate && <p className="muted">فقط مدیر HSE، مدیر سازمان یا بازرس HSE مجاز به ثبت کالیبراسیون است.</p>}
            {canCalibrate && (
              <form className="stack" onSubmit={submitCalibration}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  <div className="stack">
                    <label htmlFor="cal-equipment">تجهیز *</label>
                    <select
                      id="cal-equipment"
                      required
                      value={calibrationForm.equipment}
                      onChange={(event) => setCalibrationForm({ ...calibrationForm, equipment: event.target.value })}
                    >
                      <option value="">انتخاب تجهیز</option>
                      {equipmentOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="stack">
                    <label htmlFor="cal-performed">تاریخ انجام *</label>
                    <input
                      id="cal-performed"
                      type="date"
                      required
                      value={calibrationForm.performed_on}
                      onChange={(event) => setCalibrationForm({ ...calibrationForm, performed_on: event.target.value })}
                    />
                  </div>
                  <div className="stack">
                    <label htmlFor="cal-due">سررسید بعدی *</label>
                    <input
                      id="cal-due"
                      type="date"
                      required
                      value={calibrationForm.next_due_on}
                      onChange={(event) => setCalibrationForm({ ...calibrationForm, next_due_on: event.target.value })}
                    />
                  </div>
                  <div className="stack">
                    <label htmlFor="cal-provider">ارائه‌دهنده/مرجع *</label>
                    <input
                      id="cal-provider"
                      required
                      value={calibrationForm.provider}
                      onChange={(event) => setCalibrationForm({ ...calibrationForm, provider: event.target.value })}
                    />
                  </div>
                  <div className="stack">
                    <label htmlFor="cal-certificate">شماره گواهی</label>
                    <input
                      id="cal-certificate"
                      value={calibrationForm.certificate_number}
                      onChange={(event) => setCalibrationForm({ ...calibrationForm, certificate_number: event.target.value })}
                    />
                  </div>
                  <div className="stack">
                    <label htmlFor="cal-result">نتیجه *</label>
                    <select
                      id="cal-result"
                      value={calibrationForm.result}
                      onChange={(event) => setCalibrationForm({ ...calibrationForm, result: event.target.value })}
                    >
                      <option value="passed">قبول</option>
                      <option value="failed">ناموفق</option>
                    </select>
                  </div>
                  <div className="stack">
                    <label htmlFor="cal-reference">ارجاع مدرک</label>
                    <input
                      id="cal-reference"
                      value={calibrationForm.document_reference}
                      onChange={(event) => setCalibrationForm({ ...calibrationForm, document_reference: event.target.value })}
                    />
                  </div>
                </div>
                <div className="stack">
                  <label htmlFor="cal-notes">یادداشت</label>
                  <textarea
                    id="cal-notes"
                    value={calibrationForm.notes}
                    onChange={(event) => setCalibrationForm({ ...calibrationForm, notes: event.target.value })}
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : "ثبت کالیبراسیون"}</button>
                </div>
              </form>
            )}
          </section>

          <section className="card" style={{ maxWidth: "none" }}>
            <h3>تاریخچه کالیبراسیون</h3>
            {calibrations.length === 0 && <p className="muted">کالیبراسیونی ثبت نشده است.</p>}
            {calibrations.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>تجهیز</th>
                      <th>تاریخ انجام</th>
                      <th>سررسید</th>
                      <th>نتیجه</th>
                      <th>ارائه‌دهنده</th>
                      <th>گواهی</th>
                      <th>ثبت‌کننده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calibrations.map((record) => (
                      <tr key={record.id}>
                        <td>{record.equipment_code} — {record.equipment_name}</td>
                        <td>{record.performed_on}</td>
                        <td>{record.next_due_on}</td>
                        <td style={{ color: record.result === "failed" ? "#b42318" : "#1e7d45" }}>{record.result_display}</td>
                        <td>{record.provider}</td>
                        <td>{record.certificate_number || "—"}</td>
                        <td>{record.performed_by_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
