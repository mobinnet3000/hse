import { useEffect, useMemo, useState } from "react";

import {
  ApiRequestError,
  createCompetency,
  createCourse,
  createEmployee,
  createPermitRequirement,
  createPPEAssignment,
  createPPEItem,
  createPPEStock,
  createTrainingAttendance,
  createTrainingSession,
  deletePermitRequirement,
  disposePPEAssignment,
  fetchCompetencies,
  fetchCourses,
  fetchEmployeeCompetencies,
  fetchEmployeeCompetencyHistory,
  fetchEmployeePPEHistory,
  fetchEmployees,
  fetchEmployeeTrainingHistory,
  fetchOrganizations,
  fetchPermitRequirements,
  fetchPPEAssignments,
  fetchPPEItems,
  fetchPPEStock,
  fetchTrainingAttendances,
  fetchTrainingSessions,
  fetchWorkforceStats,
  fetchWorkplaces,
  issueEmployeeCompetency,
  replacePPEAssignment,
  returnPPEAssignment,
  updateCompetency,
  updateCourse,
  updateEmployee,
  updateEmployeeCompetencyStatus,
  updatePPEItem,
  updatePPEStock,
  updateTrainingSession,
  type Competency,
  type Employee,
  type EmployeeCompetency,
  type Organization,
  type PermitType,
  type PermitTypeCompetencyRequirement,
  type PPEAssignment,
  type PPEItem,
  type PPEStock,
  type TrainingAttendance,
  type TrainingCourse,
  type TrainingSession,
  type WorkforceStats,
  type Workplace,
} from "../../services/api";

type WorkforceTab = "overview" | "employees" | "training" | "competencies" | "ppe";

type ModalKind =
  | "employee"
  | "course"
  | "session"
  | "attendance"
  | "competency"
  | "issue-competency"
  | "requirement"
  | "ppe-item"
  | "ppe-stock"
  | "ppe-issue"
  | "ppe-return"
  | "ppe-replace"
  | "ppe-dispose"
  | "history"
  | null;

const TABS: Array<{ id: WorkforceTab; label: string }> = [
  { id: "overview", label: "داشبورد" },
  { id: "employees", label: "کارکنان" },
  { id: "training", label: "آموزش" },
  { id: "competencies", label: "صلاحیت" },
  { id: "ppe", label: "تجهیزات حفاظت فردی" },
];

const PERMIT_TYPES: Array<{ value: PermitType; label: string }> = [
  { value: "hot_work", label: "کار گرم" },
  { value: "confined_space", label: "فضای بسته" },
  { value: "work_at_height", label: "کار در ارتفاع" },
  { value: "electrical_isolation", label: "ایزولاسیون برقی و انرژی (LOTO)" },
  { value: "excavation", label: "حفاری و گودبرداری" },
  { value: "general_high_risk", label: "سایر کارهای پرخطر" },
];

const COMPETENCY_FILTERS = [
  { value: "all", label: "همه" },
  { value: "valid", label: "معتبر" },
  { value: "expiring_soon", label: "نزدیک انقضا" },
  { value: "expired", label: "منقضی" },
  { value: "suspended", label: "تعلیق" },
  { value: "revoked", label: "لغو" },
];

const ASSIGNMENT_STATUSES = [
  { value: "all", label: "همه" },
  { value: "in_use", label: "در استفاده" },
  { value: "due_soon", label: "نزدیک تعویض" },
  { value: "overdue", label: "معوق" },
  { value: "returned", label: "برگشتی" },
  { value: "replaced", label: "تعویض‌شده" },
  { value: "disposed", label: "امحاشده" },
];

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatApiError(error: unknown) {
  if (error instanceof ApiRequestError) {
    const details = error.details;
    if (details && typeof details === "object" && !Array.isArray(details)) {
      const parts: string[] = [];
      for (const [field, value] of Object.entries(details)) {
        if (Array.isArray(value)) {
          parts.push(`${field}: ${value.join("، ")}`);
        } else if (typeof value === "string") {
          parts.push(`${field}: ${value}`);
        }
      }
      if (parts.length > 0) return `${error.message} (${parts.join(" | ")})`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "خطای نامشخص رخ داد.";
}

function statusBadge(status?: string) {
  switch (status) {
    case "valid":
    case "completed":
    case "in_use":
    case "active":
    case "passed":
    case "attended":
      return "badge-success";
    case "expiring_soon":
    case "due_soon":
    case "in_progress":
    case "pending":
    case "registered":
      return "badge-warning";
    case "expired":
    case "overdue":
    case "suspended":
    case "revoked":
    case "failed":
    case "absent":
    case "cancelled":
    case "disposed":
      return "badge-danger";
    default:
      return "badge-info";
  }
}

function expiryText(record: EmployeeCompetency) {
  if (record.days_until_expiry === null || record.days_until_expiry === undefined) {
    return "بدون تاریخ انقضا";
  }
  if (record.days_until_expiry < 0) {
    return `${Math.abs(record.days_until_expiry)} روز گذشته`;
  }
  return `${record.days_until_expiry} روز مانده`;
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: "1rem" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ background: "white", borderRadius: "10px", width: wide ? "min(900px, 96vw)" : "min(580px, 96vw)", maxHeight: "92vh", overflowY: "auto", padding: "1.25rem" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
          <button type="button" className="button button-outline button-sm" onClick={onClose} aria-label="بستن">
            بستن
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: "block", marginBottom: "0.75rem" }}>
      <span style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600, fontSize: "0.85rem" }}>{label}</span>
      {children}
      {hint && <span className="muted" style={{ display: "block", fontSize: "0.75rem", marginTop: "0.2rem" }}>{hint}</span>}
    </label>
  );
}

function EmptyRow({ colSpan, text = "داده‌ای ثبت نشده است." }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: "center", padding: "1.25rem", color: "#64748b" }}>
        {text}
      </td>
    </tr>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="alert alert-danger" role="alert" style={{ whiteSpace: "pre-wrap", marginBottom: "0.75rem" }}>
      {message}
    </div>
  );
}

function OverviewCard({ label, value, hint, danger = false }: { label: string; value: number | string; hint?: string; danger?: boolean }) {
  return (
    <div className="card" style={{ padding: "0.9rem" }}>
      <div className="muted" style={{ fontSize: "0.8rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: danger ? "#b91c1c" : "#0f172a" }}>{value}</div>
      {hint && <div className="muted" style={{ fontSize: "0.75rem" }}>{hint}</div>}
    </div>
  );
}

export function WorkforcePage() {
  const [tab, setTab] = useState<WorkforceTab>("overview");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [stats, setStats] = useState<WorkforceStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [attendances, setAttendances] = useState<TrainingAttendance[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [employeeCompetencies, setEmployeeCompetencies] = useState<EmployeeCompetency[]>([]);
  const [requirements, setRequirements] = useState<PermitTypeCompetencyRequirement[]>([]);
  const [ppeItems, setPpeItems] = useState<PPEItem[]>([]);
  const [ppeStocks, setPpeStocks] = useState<PPEStock[]>([]);
  const [ppeAssignments, setPpeAssignments] = useState<PPEAssignment[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);

  const [modal, setModal] = useState<ModalKind>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<PPEAssignment | null>(null);
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyTraining, setHistoryTraining] = useState<TrainingAttendance[]>([]);
  const [historyCompetencies, setHistoryCompetencies] = useState<EmployeeCompetency[]>([]);
  const [historyPpe, setHistoryPpe] = useState<PPEAssignment[]>([]);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeWorkplace, setEmployeeWorkplace] = useState("");
  const [employeeActive, setEmployeeActive] = useState("all");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [competencySearch, setCompetencySearch] = useState("");
  const [competencyFilter, setCompetencyFilter] = useState("all");
  const [ppeSearch, setPpeSearch] = useState("");
  const [ppeStatusFilter, setPpeStatusFilter] = useState("all");

  const [employeeForm, setEmployeeForm] = useState({
    employee_no: "", first_name: "", last_name: "", job_title: "", workplace: "", is_active: true,
  });
  const [courseForm, setCourseForm] = useState({
    code: "", title: "", category: "", description: "", objectives: "", duration_minutes: "90",
    delivery_type: "in_person", is_mandatory: false, requires_renewal: true, validity_months: "24", is_active: true,
  });
  const [sessionForm, setSessionForm] = useState({
    course: "", workplace: "", instructor_name: "", scheduled_on: todayIso(), duration_minutes: "",
    capacity: "", status: "scheduled", notes: "",
  });
  const [attendanceForm, setAttendanceForm] = useState({
    session: "", employee: "", attendance_status: "attended", assessment_result: "passed",
    score: "", completed_on: todayIso(), notes: "",
  });
  const [competencyForm, setCompetencyForm] = useState({
    code: "", name: "", description: "", allowed_activities: "", is_mandatory: false,
    validity_months: "24", accepted_courses: [] as string[], is_active: true,
  });
  const [issueForm, setIssueForm] = useState({
    employee: "", competency: "", achieved_on: todayIso(), expires_on: "",
    source_course: "", source_session: "", certificate_number: "", notes: "",
  });
  const [requirementForm, setRequirementForm] = useState({ permit_type: "hot_work", competency: "", notes: "" });
  const [ppeItemForm, setPpeItemForm] = useState({
    code: "", name: "", category: "", description: "", usage_requirements: "", sizes: "",
    replacement_interval_days: "", inspection_required: false, is_durable: true, tracks_serial: false, is_active: true,
  });
  const [stockForm, setStockForm] = useState({
    item: "", workplace: "", location_name: "", quantity_on_hand: "0", quantity_minimum: "0", is_active: true,
  });
  const [ppeIssueForm, setPpeIssueForm] = useState({
    employee: "", item: "", stock: "", quantity: "1", serial_number: "", issued_on: todayIso(),
    condition_on_issue: "سالم", replacement_due_on: "", notes: "",
  });
  const [returnForm, setReturnForm] = useState({ condition: "سالم", returned_on: todayIso(), notes: "", restock: true });
  const [replaceForm, setReplaceForm] = useState({
    serial_number: "", issued_on: todayIso(), condition_on_issue: "سالم", replacement_due_on: "",
    return_condition: "فرسوده", restock_old: false, notes: "",
  });
  const [disposeForm, setDisposeForm] = useState({ condition: "غیرقابل استفاده", notes: "" });

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const orgs = await fetchOrganizations();
        if (cancelled) return;
        setOrganizations(orgs);
        setSelectedOrgId(orgs[0]?.id ?? null);
        if (orgs.length === 0) setLoading(false);
      } catch (error) {
        if (!cancelled) {
          setLoadError(formatApiError(error));
          setLoading(false);
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadOrganizationData(orgId: number) {
    setLoading(true);
    setLoadError(null);
    const params = { organization: orgId };
    try {
      const [statsData, employeeData, courseData, sessionData, attendanceData, competencyData, recordData, requirementData, itemData, stockData, assignmentData, workplaceData] =
        await Promise.all([
          fetchWorkforceStats(params),
          fetchEmployees(params),
          fetchCourses(params),
          fetchTrainingSessions(params),
          fetchTrainingAttendances(params),
          fetchCompetencies(params),
          fetchEmployeeCompetencies(params),
          fetchPermitRequirements(params),
          fetchPPEItems(params),
          fetchPPEStock(params),
          fetchPPEAssignments(params),
          fetchWorkplaces(orgId),
        ]);
      setStats(statsData);
      setEmployees(employeeData);
      setCourses(courseData);
      setSessions(sessionData);
      setAttendances(attendanceData);
      setCompetencies(competencyData);
      setEmployeeCompetencies(recordData);
      setRequirements(requirementData);
      setPpeItems(itemData);
      setPpeStocks(stockData);
      setPpeAssignments(assignmentData);
      setWorkplaces(workplaceData);
    } catch (error) {
      setLoadError(formatApiError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedOrgId === null) return;
    void loadOrganizationData(selectedOrgId);
  }, [selectedOrgId]);

  useEffect(() => {
    setSessionId((current) => {
      if (current !== null && sessions.some((item) => item.id === current)) return current;
      return sessions.find((item) => item.status === "completed")?.id ?? sessions[0]?.id ?? null;
    });
  }, [sessions]);

  const canManage = stats?.capabilities?.can_manage ?? false;
  const canTrain = stats?.capabilities?.can_conduct_training ?? false;
  const canIssue = stats?.capabilities?.can_issue_competency ?? false;
  const canOperatePpe = stats?.capabilities?.can_operate_ppe ?? false;
  const currentOrganization = organizations.find((item) => item.id === selectedOrgId);

  const latestCompetencyRecords = useMemo(() => {
    const latest = new Map<string, EmployeeCompetency>();
    for (const record of employeeCompetencies) {
      const key = `${record.employee}-${record.competency}`;
      const existing = latest.get(key);
      if (!existing || record.achieved_on > existing.achieved_on || (record.achieved_on === existing.achieved_on && record.id > existing.id)) {
        latest.set(key, record);
      }
    }
    return Array.from(latest.values());
  }, [employeeCompetencies]);

  const attentionCompetencies = latestCompetencyRecords.filter((record) =>
    ["expiring_soon", "expired", "suspended", "revoked"].includes(record.effective_status),
  );
  const attentionPpe = ppeAssignments.filter((assignment) => ["active", "returned"].includes(assignment.status) && (assignment.is_overdue || assignment.is_due_soon));
  const stocksBelowMinimum = ppeStocks.filter((stock) => stock.is_below_minimum);

  const filteredEmployees = employees.filter((employee) => {
    const haystack = `${employee.full_name} ${employee.employee_no} ${employee.job_title}`.toLowerCase();
    if (employeeSearch && !haystack.includes(employeeSearch.toLowerCase())) return false;
    if (employeeWorkplace && String(employee.workplace ?? "") !== employeeWorkplace) return false;
    if (employeeActive === "active" && !employee.is_active) return false;
    if (employeeActive === "inactive" && employee.is_active) return false;
    return true;
  });

  const filteredCompetencies = latestCompetencyRecords.filter((record) => {
    const haystack = `${record.employee_detail?.full_name ?? ""} ${record.competency_detail?.name ?? ""}`.toLowerCase();
    if (competencySearch && !haystack.includes(competencySearch.toLowerCase())) return false;
    if (competencyFilter !== "all" && record.effective_status !== competencyFilter) return false;
    return true;
  });

  const filteredAssignments = ppeAssignments.filter((assignment) => {
    const haystack = `${assignment.employee_detail?.full_name ?? ""} ${assignment.item_name ?? ""} ${assignment.serial_number}`.toLowerCase();
    if (ppeSearch && !haystack.includes(ppeSearch.toLowerCase())) return false;
    if (ppeStatusFilter !== "all" && assignment.usage_status !== ppeStatusFilter) return false;
    return true;
  });

  const selectedSession = sessions.find((item) => item.id === sessionId) ?? null;
  const selectedSessionAttendances = attendances.filter((item) => item.session === sessionId);

  function closeModal() {
    setModal(null);
    setFormError(null);
    setEditingId(null);
    setSelectedAssignment(null);
    setHistoryEmployee(null);
  }

  async function runModalAction(action: () => Promise<unknown>, successMessage: string) {
    if (selectedOrgId === null) return;
    setSubmitting(true);
    setFormError(null);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
      setModal(null);
      setEditingId(null);
      setSelectedAssignment(null);
      await loadOrganizationData(selectedOrgId);
    } catch (error) {
      setFormError(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function perform(action: () => Promise<unknown>, successMessage: string) {
    if (selectedOrgId === null) return;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
      await loadOrganizationData(selectedOrgId);
    } catch (error) {
      setActionError(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function openEmployee(employee?: Employee) {
    setFormError(null);
    setEditingId(employee?.id ?? null);
    setEmployeeForm({
      employee_no: employee?.employee_no ?? "",
      first_name: employee?.first_name ?? "",
      last_name: employee?.last_name ?? "",
      job_title: employee?.job_title ?? "",
      workplace: employee?.workplace ? String(employee.workplace) : "",
      is_active: employee?.is_active ?? true,
    });
    setModal("employee");
  }

  function openCourse(course?: TrainingCourse) {
    setFormError(null);
    setEditingId(course?.id ?? null);
    setCourseForm({
      code: course?.code ?? "",
      title: course?.title ?? "",
      category: course?.category ?? "",
      description: course?.description ?? "",
      objectives: course?.objectives ?? "",
      duration_minutes: String(course?.duration_minutes ?? 90),
      delivery_type: course?.delivery_type ?? "in_person",
      is_mandatory: course?.is_mandatory ?? false,
      requires_renewal: course?.requires_renewal ?? true,
      validity_months: course?.validity_months ? String(course.validity_months) : "24",
      is_active: course?.is_active ?? true,
    });
    setModal("course");
  }

  function openSession(session?: TrainingSession) {
    setFormError(null);
    setEditingId(session?.id ?? null);
    setSessionForm({
      course: session ? String(session.course) : String(courses.find((item) => item.is_active)?.id ?? ""),
      workplace: session?.workplace ? String(session.workplace) : "",
      instructor_name: session?.instructor_name ?? "",
      scheduled_on: session?.scheduled_on ?? todayIso(),
      duration_minutes: session?.duration_minutes ? String(session.duration_minutes) : "",
      capacity: session?.capacity ? String(session.capacity) : "",
      status: session?.status ?? "scheduled",
      notes: session?.notes ?? "",
    });
    setModal("session");
  }

  function openAttendance(session?: TrainingSession) {
    const target = session ?? sessions.find((item) => item.status === "completed") ?? selectedSession;
    setFormError(null);
    setAttendanceForm({
      session: target ? String(target.id) : "",
      employee: String(employees.find((item) => item.is_active)?.id ?? ""),
      attendance_status: "attended",
      assessment_result: "passed",
      score: "85",
      completed_on: target?.scheduled_on ?? todayIso(),
      notes: "",
    });
    setModal("attendance");
  }

  function openCompetency(competency?: Competency) {
    setFormError(null);
    setEditingId(competency?.id ?? null);
    setCompetencyForm({
      code: competency?.code ?? "",
      name: competency?.name ?? "",
      description: competency?.description ?? "",
      allowed_activities: competency?.allowed_activities ?? "",
      is_mandatory: competency?.is_mandatory ?? false,
      validity_months: competency?.validity_months ? String(competency.validity_months) : "24",
      accepted_courses: (competency?.accepted_courses ?? []).map(String),
      is_active: competency?.is_active ?? true,
    });
    setModal("competency");
  }

  function openIssueCompetency(employee?: Employee, record?: EmployeeCompetency) {
    setFormError(null);
    setEditingId(record?.id ?? null);
    setIssueForm({
      employee: String(employee?.id ?? record?.employee ?? employees.find((item) => item.is_active)?.id ?? ""),
      competency: String(record?.competency ?? competencies.find((item) => item.is_active)?.id ?? ""),
      achieved_on: todayIso(),
      expires_on: "",
      source_course: "",
      source_session: "",
      certificate_number: "",
      notes: "",
    });
    setModal("issue-competency");
  }

  function openRequirement() {
    setFormError(null);
    setEditingId(null);
    setRequirementForm({
      permit_type: "hot_work",
      competency: String(competencies.find((item) => item.is_active)?.id ?? ""),
      notes: "",
    });
    setModal("requirement");
  }

  function openPpeItem(item?: PPEItem) {
    setFormError(null);
    setEditingId(item?.id ?? null);
    setPpeItemForm({
      code: item?.code ?? "",
      name: item?.name ?? "",
      category: item?.category ?? "",
      description: item?.description ?? "",
      usage_requirements: item?.usage_requirements ?? "",
      sizes: item?.sizes ?? "",
      replacement_interval_days: item?.replacement_interval_days ? String(item.replacement_interval_days) : "",
      inspection_required: item?.inspection_required ?? false,
      is_durable: item?.is_durable ?? true,
      tracks_serial: item?.tracks_serial ?? false,
      is_active: item?.is_active ?? true,
    });
    setModal("ppe-item");
  }

  function openStock(stock?: PPEStock, itemId?: number) {
    setFormError(null);
    setEditingId(stock?.id ?? null);
    setStockForm({
      item: String(stock?.item ?? itemId ?? ppeItems.find((item) => item.is_active)?.id ?? ""),
      workplace: stock?.workplace ? String(stock.workplace) : "",
      location_name: stock?.location_name ?? "",
      quantity_on_hand: String(stock?.quantity_on_hand ?? 0),
      quantity_minimum: String(stock?.quantity_minimum ?? 0),
      is_active: stock?.is_active ?? true,
    });
    setModal("ppe-stock");
  }

  function openPpeIssue(employee?: Employee, item?: PPEItem) {
    const selectedItem = item ?? ppeItems.find((candidate) => candidate.is_active) ?? null;
    const stock = ppeStocks.find((candidate) => candidate.item === selectedItem?.id && candidate.is_active) ?? null;
    setFormError(null);
    setEditingId(null);
    setPpeIssueForm({
      employee: String(employee?.id ?? employees.find((candidate) => candidate.is_active)?.id ?? ""),
      item: String(selectedItem?.id ?? ""),
      stock: String(stock?.id ?? ""),
      quantity: "1",
      serial_number: "",
      issued_on: todayIso(),
      condition_on_issue: "سالم",
      replacement_due_on: "",
      notes: "",
    });
    setModal("ppe-issue");
  }

  function openReturn(assignment: PPEAssignment) {
    setFormError(null);
    setSelectedAssignment(assignment);
    setReturnForm({ condition: "سالم", returned_on: todayIso(), notes: "", restock: true });
    setModal("ppe-return");
  }

  function openReplace(assignment: PPEAssignment) {
    setFormError(null);
    setSelectedAssignment(assignment);
    setReplaceForm({
      serial_number: "",
      issued_on: todayIso(),
      condition_on_issue: "سالم",
      replacement_due_on: "",
      return_condition: "فرسوده",
      restock_old: false,
      notes: "",
    });
    setModal("ppe-replace");
  }

  function openDispose(assignment: PPEAssignment) {
    setFormError(null);
    setSelectedAssignment(assignment);
    setDisposeForm({ condition: "غیرقابل استفاده", notes: "" });
    setModal("ppe-dispose");
  }

  async function openHistory(employee: Employee) {
    setHistoryEmployee(employee);
    setModal("history");
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryTraining([]);
    setHistoryCompetencies([]);
    setHistoryPpe([]);
    try {
      const [training, competencyRecords, ppe] = await Promise.all([
        fetchEmployeeTrainingHistory(employee.id),
        fetchEmployeeCompetencyHistory(employee.id),
        fetchEmployeePPEHistory(employee.id),
      ]);
      setHistoryTraining(training);
      setHistoryCompetencies(competencyRecords);
      setHistoryPpe(ppe);
    } catch (error) {
      setHistoryError(formatApiError(error));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submitEmployee() {
    if (selectedOrgId === null) return;
    const payload = {
      organization: selectedOrgId,
      employee_no: employeeForm.employee_no.trim(),
      first_name: employeeForm.first_name.trim(),
      last_name: employeeForm.last_name.trim(),
      job_title: employeeForm.job_title.trim(),
      workplace: employeeForm.workplace ? Number(employeeForm.workplace) : null,
      is_active: employeeForm.is_active,
    };
    await runModalAction(
      () => (editingId ? updateEmployee(editingId, payload) : createEmployee(payload)),
      editingId ? "اطلاعات کارمند ذخیره شد." : "کارمند جدید ثبت شد.",
    );
  }

  async function submitCourse() {
    if (selectedOrgId === null) return;
    const payload = {
      organization: selectedOrgId,
      code: courseForm.code.trim(),
      title: courseForm.title.trim(),
      category: courseForm.category.trim(),
      description: courseForm.description,
      objectives: courseForm.objectives,
      duration_minutes: Number(courseForm.duration_minutes || 0),
      delivery_type: courseForm.delivery_type,
      is_mandatory: courseForm.is_mandatory,
      requires_renewal: courseForm.requires_renewal,
      validity_months: courseForm.requires_renewal ? Number(courseForm.validity_months || 0) || null : null,
      is_active: courseForm.is_active,
    };
    await runModalAction(
      () => (editingId ? updateCourse(editingId, payload) : createCourse(payload)),
      editingId ? "دوره آموزشی ذخیره شد." : "دوره آموزشی ایجاد شد.",
    );
  }

  async function submitSession() {
    if (selectedOrgId === null) return;
    const payload: Record<string, unknown> = {
      instructor_name: sessionForm.instructor_name.trim(),
      scheduled_on: sessionForm.scheduled_on,
      duration_minutes: sessionForm.duration_minutes ? Number(sessionForm.duration_minutes) : null,
      capacity: sessionForm.capacity ? Number(sessionForm.capacity) : null,
      status: sessionForm.status,
      notes: sessionForm.notes,
      workplace: sessionForm.workplace ? Number(sessionForm.workplace) : null,
    };
    if (!editingId) {
      payload.organization = selectedOrgId;
      payload.course = Number(sessionForm.course);
    }
    await runModalAction(
      () => (editingId ? updateTrainingSession(editingId, payload) : createTrainingSession(payload)),
      editingId ? "نوبت آموزشی ذخیره شد." : "نوبت آموزشی ایجاد شد.",
    );
  }

  async function submitAttendance() {
    if (selectedOrgId === null) return;
    const payload = {
      organization: selectedOrgId,
      session: Number(attendanceForm.session),
      employee: Number(attendanceForm.employee),
      attendance_status: attendanceForm.attendance_status,
      assessment_result: attendanceForm.assessment_result,
      score: attendanceForm.score ? Number(attendanceForm.score) : null,
      completed_on: attendanceForm.assessment_result === "pending" ? null : attendanceForm.completed_on,
      notes: attendanceForm.notes,
    };
    await runModalAction(() => createTrainingAttendance(payload), "نتیجه حضور و ارزیابی ثبت شد.");
  }

  async function submitCompetency() {
    if (selectedOrgId === null) return;
    const payload = {
      organization: selectedOrgId,
      code: competencyForm.code.trim(),
      name: competencyForm.name.trim(),
      description: competencyForm.description,
      allowed_activities: competencyForm.allowed_activities,
      is_mandatory: competencyForm.is_mandatory,
      validity_months: Number(competencyForm.validity_months || 0) || null,
      accepted_courses: competencyForm.accepted_courses.map(Number),
      is_active: competencyForm.is_active,
    };
    await runModalAction(
      () => (editingId ? updateCompetency(editingId, payload) : createCompetency(payload)),
      editingId ? "نوع صلاحیت ذخیره شد." : "نوع صلاحیت ایجاد شد.",
    );
  }

  async function submitIssueCompetency() {
    if (selectedOrgId === null) return;
    const payload = {
      organization: selectedOrgId,
      employee: Number(issueForm.employee),
      competency: Number(issueForm.competency),
      achieved_on: issueForm.achieved_on,
      expires_on: issueForm.expires_on || null,
      source_course: issueForm.source_course ? Number(issueForm.source_course) : null,
      source_session: issueForm.source_session ? Number(issueForm.source_session) : null,
      certificate_number: issueForm.certificate_number,
      notes: issueForm.notes,
    };
    await runModalAction(() => issueEmployeeCompetency(payload), "سابقه صلاحیت صادر شد.");
  }

  async function submitRequirement() {
    if (selectedOrgId === null) return;
    await runModalAction(
      () =>
        createPermitRequirement({
          organization: selectedOrgId,
          permit_type: requirementForm.permit_type,
          competency: Number(requirementForm.competency),
          notes: requirementForm.notes,
        }),
      "الزام صلاحیت به نوع مجوز اضافه شد.",
    );
  }

  async function submitPpeItem() {
    if (selectedOrgId === null) return;
    const payload = {
      organization: selectedOrgId,
      code: ppeItemForm.code.trim(),
      name: ppeItemForm.name.trim(),
      category: ppeItemForm.category.trim(),
      description: ppeItemForm.description,
      usage_requirements: ppeItemForm.usage_requirements,
      sizes: ppeItemForm.sizes,
      replacement_interval_days: ppeItemForm.replacement_interval_days ? Number(ppeItemForm.replacement_interval_days) : null,
      inspection_required: ppeItemForm.inspection_required,
      is_durable: ppeItemForm.is_durable,
      tracks_serial: ppeItemForm.tracks_serial,
      is_active: ppeItemForm.is_active,
    };
    await runModalAction(
      () => (editingId ? updatePPEItem(editingId, payload) : createPPEItem(payload)),
      editingId ? "قلم تجهیزات ذخیره شد." : "قلم تجهیزات جدید ثبت شد.",
    );
  }

  async function submitStock() {
    if (selectedOrgId === null) return;
    const payload: Record<string, unknown> = {
      workplace: stockForm.workplace ? Number(stockForm.workplace) : null,
      location_name: stockForm.location_name.trim(),
      quantity_on_hand: Number(stockForm.quantity_on_hand || 0),
      quantity_minimum: Number(stockForm.quantity_minimum || 0),
      is_active: stockForm.is_active,
    };
    if (!editingId) {
      payload.organization = selectedOrgId;
      payload.item = Number(stockForm.item);
    }
    await runModalAction(
      () => (editingId ? updatePPEStock(editingId, payload) : createPPEStock(payload)),
      editingId ? "موجودی انبار ذخیره شد." : "انبار جدید ایجاد شد.",
    );
  }

  async function submitPpeIssue() {
    if (selectedOrgId === null) return;
    const item = ppeItems.find((candidate) => candidate.id === Number(ppeIssueForm.item));
    if (!item) {
      setFormError("ابتدا قلم تجهیزات را انتخاب کنید.");
      return;
    }
    const payload = {
      organization: selectedOrgId,
      employee: Number(ppeIssueForm.employee),
      item: item.id,
      stock: Number(ppeIssueForm.stock),
      quantity: Number(ppeIssueForm.quantity || 0),
      serial_number: ppeIssueForm.serial_number.trim(),
      issued_on: ppeIssueForm.issued_on,
      condition_on_issue: ppeIssueForm.condition_on_issue,
      replacement_due_on: ppeIssueForm.replacement_due_on || null,
      notes: ppeIssueForm.notes,
    };
    await runModalAction(() => createPPEAssignment(payload), "تحویل تجهیزات ثبت شد.");
  }

  async function submitReturn() {
    if (!selectedAssignment) return;
    await runModalAction(
      () =>
        returnPPEAssignment(selectedAssignment.id, {
          condition: returnForm.condition,
          returned_on: returnForm.returned_on,
          notes: returnForm.notes,
          restock: returnForm.restock,
        }),
      "برگشت تجهیزات ثبت شد.",
    );
  }

  async function submitReplace() {
    if (!selectedAssignment) return;
    await runModalAction(
      () =>
        replacePPEAssignment(selectedAssignment.id, {
          serial_number: replaceForm.serial_number.trim(),
          issued_on: replaceForm.issued_on,
          condition_on_issue: replaceForm.condition_on_issue,
          replacement_due_on: replaceForm.replacement_due_on || null,
          return_condition: replaceForm.return_condition,
          restock_old: replaceForm.restock_old,
          notes: replaceForm.notes,
        }),
      "تعویض تجهیزات ثبت شد.",
    );
  }

  async function submitDispose() {
    if (!selectedAssignment) return;
    await runModalAction(
      () =>
        disposePPEAssignment(selectedAssignment.id, {
          condition: disposeForm.condition,
          notes: disposeForm.notes,
        }),
      "امحای تجهیزات ثبت شد.",
    );
  }

  async function toggleEmployee(employee: Employee) {
    await perform(
      () => updateEmployee(employee.id, { is_active: !employee.is_active }),
      employee.is_active ? "کارمند غیرفعال شد." : "کارمند فعال شد.",
    );
  }

  async function toggleCourse(course: TrainingCourse) {
    await perform(
      () => updateCourse(course.id, { is_active: !course.is_active }),
      course.is_active ? "دوره غیرفعال شد." : "دوره فعال شد.",
    );
  }

  async function toggleCompetency(competency: Competency) {
    await perform(
      () => updateCompetency(competency.id, { is_active: !competency.is_active }),
      competency.is_active ? "نوع صلاحیت غیرفعال شد." : "نوع صلاحیت فعال شد.",
    );
  }

  async function togglePpeItem(item: PPEItem) {
    await perform(
      () => updatePPEItem(item.id, { is_active: !item.is_active }),
      item.is_active ? "قلم تجهیزات غیرفعال شد." : "قلم تجهیزات فعال شد.",
    );
  }

  async function toggleStock(stock: PPEStock) {
    await perform(
      () => updatePPEStock(stock.id, { is_active: !stock.is_active }),
      stock.is_active ? "انبار غیرفعال شد." : "انبار فعال شد.",
    );
  }

  async function changeSessionStatus(session: TrainingSession, status: TrainingSession["status"]) {
    await perform(
      () => updateTrainingSession(session.id, { status }),
      "وضعیت نوبت آموزشی تغییر کرد.",
    );
  }

  async function deleteRequirement(requirement: PermitTypeCompetencyRequirement) {
    if (!window.confirm("این الزام صلاحیت حذف شود؟ ارزیابی مجوزهای آینده دیگر آن را بررسی نخواهد کرد.")) return;
    await perform(() => deletePermitRequirement(requirement.id), "الزام صلاحیت حذف شد.");
  }

  async function changeCompetencyStatus(record: EmployeeCompetency, status: "suspended" | "revoked") {
    const reason = window.prompt(
      status === "suspended" ? "دلیل تعلیق صلاحیت را بنویسید:" : "دلیل لغو صلاحیت را بنویسید:",
    );
    if (reason === null) return;
    await perform(
      () => updateEmployeeCompetencyStatus(record.id, { status, reason }),
      status === "suspended" ? "صلاحیت تعلیق شد." : "صلاحیت لغو شد.",
    );
  }

  function handlePpeItemChange(itemId: string) {
    const item = ppeItems.find((candidate) => candidate.id === Number(itemId));
    const stock = ppeStocks.find((candidate) => candidate.item === Number(itemId) && candidate.is_active);
    setPpeIssueForm((current) => ({
      ...current,
      item: itemId,
      stock: String(stock?.id ?? ""),
      serial_number: "",
      replacement_due_on: item?.replacement_interval_days
        ? new Date(Date.now() + item.replacement_interval_days * 86_400_000).toISOString().slice(0, 10)
        : "",
    }));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>آموزش، صلاحیت و تجهیزات حفاظت فردی</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            مدیریت یکپارچه کارکنان، دوره‌ها، صلاحیت‌های شغلی، الزامات مجوز کار و چرخه عمر PPE.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
          {organizations.length > 1 && (
            <label style={{ fontSize: "0.8rem" }}>
              <span style={{ display: "block", marginBottom: "0.2rem" }}>سازمان</span>
              <select
                value={selectedOrgId ?? ""}
                onChange={(event) => setSelectedOrgId(event.target.value ? Number(event.target.value) : null)}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </select>
            </label>
          )}
          {organizations.length === 1 && currentOrganization && (
            <span className="badge badge-info" style={{ padding: "0.45rem 0.75rem" }}>{currentOrganization.name}</span>
          )}
          <button
            type="button"
            className="button button-outline button-sm"
            disabled={loading || selectedOrgId === null}
            onClick={() => { if (selectedOrgId !== null) void loadOrganizationData(selectedOrgId); }}
          >
            به‌روزرسانی
          </button>
        </div>
      </div>

      {notice && <div className="alert alert-success" role="status" style={{ marginBottom: "0.75rem" }}>{notice}</div>}
      {actionError && <ErrorBox message={actionError} />}
      {loadError && <ErrorBox message={loadError} />}
      {!loading && organizations.length === 0 && (
        <div className="card" style={{ padding: "1.25rem" }}>شما به هیچ سازمان فعالی دسترسی ندارید.</div>
      )}

      {selectedOrgId !== null && (
        <>
          <div role="tablist" aria-label="بخش‌های آموزش و صلاحیت" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`button button-sm ${tab === item.id ? "" : "button-outline"}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading && !stats && <div className="card" style={{ padding: "1.5rem" }}>در حال بارگذاری داده‌های آموزش، صلاحیت و PPE…</div>}
          {loading && stats && <div className="muted" style={{ marginBottom: "0.5rem" }}>در حال به‌روزرسانی…</div>}

          {!loading && stats && (
            <>
              {tab === "overview" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                    <OverviewCard label="کارکنان فعال" value={stats.employees_active} hint={`${stats.employees_total} کارمند ثبت‌شده`} />
                    <OverviewCard label="دوره‌های فعال" value={stats.courses_active} hint={`${stats.sessions_upcoming} نوبت پیش‌رو`} />
                    <OverviewCard label="صلاحیت معتبر" value={stats.competency_valid} hint={`${stats.competency_records_total} سابقه`} />
                    <OverviewCard label="نزدیک انقضا" value={stats.competency_expiring_soon} hint={`آستانه ${stats.competency_due_soon_days} روز`} danger={stats.competency_expiring_soon > 0} />
                    <OverviewCard label="صلاحیت منقضی" value={stats.competency_expired} danger={stats.competency_expired > 0} />
                    <OverviewCard label="PPE در استفاده" value={stats.ppe_active_assignments} hint={`${stats.ppe_items_active} قلم فعال`} />
                    <OverviewCard label="تعویض معوق PPE" value={stats.ppe_assignments_overdue} danger={stats.ppe_assignments_overdue > 0} />
                    <OverviewCard label="انبار زیر حداقل" value={stats.ppe_stock_below_minimum} danger={stats.ppe_stock_below_minimum > 0} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
                    <section className="card" style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "0.5rem" }}>
                        <h2 style={{ margin: 0, fontSize: "1rem" }}>صلاحیت‌های نیازمند اقدام</h2>
                        <button type="button" className="button button-outline button-sm" onClick={() => setTab("competencies")}>مشاهده همه</button>
                      </div>
                      {attentionCompetencies.length === 0 ? (
                        <p className="muted" style={{ margin: 0 }}>هیچ صلاحیت منقضی، معلق یا نزدیک انقضا وجود ندارد.</p>
                      ) : (
                        <div style={{ display: "grid", gap: "0.45rem" }}>
                          {attentionCompetencies.slice(0, 8).map((record) => (
                            <div key={record.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                              <span style={{ fontSize: "0.85rem" }}>{record.employee_detail?.full_name} — {record.competency_detail?.name}</span>
                              <span className={`badge ${statusBadge(record.effective_status)}`} style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem" }}>
                                {record.effective_status_display ?? record.effective_status} ({expiryText(record)})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="card" style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "0.5rem" }}>
                        <h2 style={{ margin: 0, fontSize: "1rem" }}>هشدارهای PPE</h2>
                        <button type="button" className="button button-outline button-sm" onClick={() => setTab("ppe")}>مشاهده همه</button>
                      </div>
                      {attentionPpe.length === 0 && stocksBelowMinimum.length === 0 ? (
                        <p className="muted" style={{ margin: 0 }}>هیچ تحویل معوق یا انبار زیر حداقلی وجود ندارد.</p>
                      ) : (
                        <div style={{ display: "grid", gap: "0.45rem" }}>
                          {attentionPpe.slice(0, 5).map((assignment) => (
                            <div key={assignment.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                              <span style={{ fontSize: "0.85rem" }}>{assignment.employee_detail?.full_name} — {assignment.item_name}{assignment.serial_number ? ` (${assignment.serial_number})` : ""}</span>
                              <span className={`badge ${statusBadge(assignment.usage_status)}`} style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem" }}>
                                {assignment.usage_status_display ?? assignment.usage_status}
                              </span>
                            </div>
                          ))}
                          {stocksBelowMinimum.slice(0, 4).map((stock) => (
                            <div key={`stock-${stock.id}`} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", color: "#b91c1c", fontSize: "0.85rem" }}>
                              <span>انبار {stock.item_detail?.name} در {stock.location_name}</span>
                              <span>{stock.quantity_on_hand} از حداقل {stock.quantity_minimum}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <section className="card" style={{ padding: "1rem", marginTop: "1rem" }}>
                    <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>الزامات صلاحیت مجوز کار</h2>
                    <p className="muted" style={{ marginTop: 0, fontSize: "0.8rem" }}>
                      این الزامات در سرور و هنگام تأیید، فعال‌سازی و ازسرگیری مجوز بررسی می‌شوند. نام کارکنان در متن آزاد به‌عنوان مدرک صلاحیت پذیرفته نیست.
                    </p>
                    {requirements.length === 0 ? (
                      <p className="muted" style={{ margin: 0 }}>الزامی تعریف نشده است؛ برای انواع مجوز حساس الزام صلاحیت تعریف کنید.</p>
                    ) : (
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {requirements.map((requirement) => (
                          <span key={requirement.id} className="badge badge-info" style={{ padding: "0.4rem 0.65rem", borderRadius: "4px" }}>
                            {requirement.permit_type_display ?? requirement.permit_type}: {requirement.competency_detail?.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {tab === "employees" && (
                <section>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "end", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end" }}>
                      <label style={{ fontSize: "0.8rem" }}>
                        <span style={{ display: "block" }}>جستجو</span>
                        <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="نام، شماره پرسنلی یا شغل" />
                      </label>
                      <label style={{ fontSize: "0.8rem" }}>
                        <span style={{ display: "block" }}>کارگاه</span>
                        <select value={employeeWorkplace} onChange={(event) => setEmployeeWorkplace(event.target.value)}>
                          <option value="">همه کارگاه‌ها</option>
                          {workplaces.map((workplace) => <option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}
                        </select>
                      </label>
                      <label style={{ fontSize: "0.8rem" }}>
                        <span style={{ display: "block" }}>وضعیت</span>
                        <select value={employeeActive} onChange={(event) => setEmployeeActive(event.target.value)}>
                          <option value="all">همه</option>
                          <option value="active">فعال</option>
                          <option value="inactive">غیرفعال</option>
                        </select>
                      </label>
                    </div>
                    {canManage && <button type="button" className="button button-sm" onClick={() => openEmployee()}>ثبت کارمند</button>}
                  </div>
                  {!canManage && <p className="muted">شما اجازه ایجاد یا ویرایش کارکنان را ندارید؛ مشاهده و تاریخچه در دسترس است.</p>}
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead><tr><th>شماره پرسنلی</th><th>نام</th><th>شغل</th><th>کارگاه</th><th>آموزش</th><th>صلاحیت معتبر</th><th>PPE فعال</th><th>وضعیت</th><th>اقدام‌ها</th></tr></thead>
                      <tbody>
                        {filteredEmployees.length === 0 && <EmptyRow colSpan={9} text="کارمندی با این فیلترها یافت نشد." />}
                        {filteredEmployees.map((employee) => (
                          <tr key={employee.id}>
                            <td>{employee.employee_no}</td>
                            <td>{employee.full_name}</td>
                            <td>{employee.job_title || "—"}</td>
                            <td>{employee.workplace_name || "—"}</td>
                            <td>{employee.training_count ?? 0}</td>
                            <td>{employee.valid_competency_count ?? 0}{(employee.expiring_competency_count ?? 0) > 0 ? ` (${employee.expiring_competency_count} نزدیک انقضا)` : ""}</td>
                            <td>{employee.active_ppe_count ?? 0}</td>
                            <td><span className={`badge ${employee.is_active ? "badge-success" : "badge-danger"}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{employee.is_active ? "فعال" : "غیرفعال"}</span></td>
                            <td>
                              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                <button type="button" className="button button-outline button-sm" onClick={() => void openHistory(employee)}>تاریخچه</button>
                                {canManage && <button type="button" className="button button-outline button-sm" onClick={() => openEmployee(employee)}>ویرایش</button>}
                                {canManage && <button type="button" className={`button button-sm ${employee.is_active ? "button-danger" : "button-outline"}`} onClick={() => void toggleEmployee(employee)}>{employee.is_active ? "غیرفعال" : "فعال"}</button>}
                                {canIssue && <button type="button" className="button button-outline button-sm" onClick={() => openIssueCompetency(employee)}>صلاحیت</button>}
                                {canOperatePpe && <button type="button" className="button button-outline button-sm" onClick={() => openPpeIssue(employee)}>PPE</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {tab === "training" && (
                <div>
                  <section style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>دوره‌های آموزشی</h2>
                      {canManage && <button type="button" className="button button-sm" onClick={() => openCourse()}>دوره جدید</button>}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>کد</th><th>عنوان</th><th>دسته</th><th>مدت</th><th>روش</th><th>تجدید</th><th>اعتبار</th><th>نوبت‌ها</th><th>وضعیت</th><th>اقدام‌ها</th></tr></thead>
                        <tbody>
                          {courses.length === 0 && <EmptyRow colSpan={10} text="دوره آموزشی ثبت نشده است." />}
                          {courses.map((course) => (
                            <tr key={course.id}>
                              <td>{course.code}</td>
                              <td>{course.title}</td>
                              <td>{course.category}</td>
                              <td>{course.duration_minutes} دقیقه</td>
                              <td>{course.delivery_type_display ?? course.delivery_type}</td>
                              <td>{course.requires_renewal ? "دارد" : "ندارد"}</td>
                              <td>{course.validity_months ? `${course.validity_months} ماه` : "—"}</td>
                              <td>{course.session_count ?? 0}</td>
                              <td><span className={`badge ${course.is_active ? "badge-success" : "badge-danger"}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{course.is_active ? "فعال" : "غیرفعال"}</span></td>
                              <td>
                                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                  {canManage && <button type="button" className="button button-outline button-sm" onClick={() => openCourse(course)}>ویرایش</button>}
                                  {canManage && <button type="button" className={`button button-sm ${course.is_active ? "button-danger" : "button-outline"}`} onClick={() => void toggleCourse(course)}>{course.is_active ? "غیرفعال" : "فعال"}</button>}
                                  {canTrain && <button type="button" className="button button-outline button-sm" onClick={() => openSession()}>نوبت جدید</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>نوبت‌های آموزشی</h2>
                      {canTrain && <button type="button" className="button button-sm" onClick={() => openSession()}>ثبت نوبت</button>}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>دوره</th><th>تاریخ</th><th>مدرس</th><th>کارگاه</th><th>ظرفیت</th><th>ثبت‌نام</th><th>وضعیت</th><th>اقدام‌ها</th></tr></thead>
                        <tbody>
                          {sessions.length === 0 && <EmptyRow colSpan={8} text="نوبت آموزشی ثبت نشده است." />}
                          {sessions.map((session) => (
                            <tr key={session.id}>
                              <td>{session.course_detail?.title ?? `دوره ${session.course}`}</td>
                              <td>{formatDate(session.scheduled_on)}</td>
                              <td>{session.instructor_name || "—"}</td>
                              <td>{session.workplace_name || "—"}</td>
                              <td>{session.capacity ?? "—"}</td>
                              <td>{session.attendance_count ?? 0}</td>
                              <td><span className={`badge ${statusBadge(session.status)}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{session.status_display ?? session.status}</span></td>
                              <td>
                                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                  {canTrain && session.status === "scheduled" && <button type="button" className="button button-outline button-sm" onClick={() => void changeSessionStatus(session, "in_progress")}>شروع</button>}
                                  {canTrain && session.status !== "completed" && session.status !== "cancelled" && <button type="button" className="button button-sm" onClick={() => void changeSessionStatus(session, "completed")}>پایان</button>}
                                  {canTrain && session.status !== "cancelled" && session.status !== "completed" && <button type="button" className="button button-danger button-sm" onClick={() => void changeSessionStatus(session, "cancelled")}>لغو</button>}
                                  {canTrain && session.status === "completed" && <button type="button" className="button button-outline button-sm" onClick={() => openAttendance(session)}>ثبت نتیجه</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "end", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>حضور و ارزیابی</h2>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
                        <label style={{ fontSize: "0.8rem" }}>
                          <span style={{ display: "block" }}>نوبت</span>
                          <select value={sessionId ?? ""} onChange={(event) => setSessionId(event.target.value ? Number(event.target.value) : null)}>
                            <option value="">انتخاب نوبت</option>
                            {sessions.map((session) => <option key={session.id} value={session.id}>{session.course_detail?.title} — {formatDate(session.scheduled_on)}</option>)}
                          </select>
                        </label>
                        {canTrain && selectedSession?.status === "completed" && <button type="button" className="button button-sm" onClick={() => openAttendance(selectedSession)}>ثبت حضور</button>}
                      </div>
                    </div>
                    {!canTrain && <p className="muted">ثبت نوبت و نتیجه ارزیابی فقط برای نقش‌های آموزش مجاز است.</p>}
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>کارمند</th><th>حضور</th><th>نتیجه</th><th>نمره</th><th>تاریخ تکمیل</th><th>ثبت‌کننده</th></tr></thead>
                        <tbody>
                          {selectedSessionAttendances.length === 0 && <EmptyRow colSpan={6} text="برای این نوبت حضوری ثبت نشده است." />}
                          {selectedSessionAttendances.map((attendance) => (
                            <tr key={attendance.id}>
                              <td>{attendance.employee_detail?.full_name}</td>
                              <td><span className={`badge ${statusBadge(attendance.attendance_status)}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{attendance.attendance_status_display ?? attendance.attendance_status}</span></td>
                              <td><span className={`badge ${statusBadge(attendance.assessment_result)}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{attendance.assessment_result_display ?? attendance.assessment_result}</span></td>
                              <td>{attendance.score ?? "—"}</td>
                              <td>{formatDate(attendance.completed_on)}</td>
                              <td>{attendance.recorded_by_name || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {tab === "competencies" && (
                <div>
                  <section style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>انواع صلاحیت</h2>
                      {canManage && <button type="button" className="button button-sm" onClick={() => openCompetency()}>نوع صلاحیت جدید</button>}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>کد</th><th>نام</th><th>فعالیت‌های مجاز</th><th>اعتبار</th><th>دوره‌های پذیرفته‌شده</th><th>معتبر</th><th>منقضی</th><th>وضعیت</th><th>اقدام‌ها</th></tr></thead>
                        <tbody>
                          {competencies.length === 0 && <EmptyRow colSpan={9} text="نوع صلاحیتی تعریف نشده است." />}
                          {competencies.map((competency) => (
                            <tr key={competency.id}>
                              <td>{competency.code}</td>
                              <td>{competency.name}</td>
                              <td>{competency.allowed_activities || "—"}</td>
                              <td>{competency.validity_months ? `${competency.validity_months} ماه` : "بدون انقضا"}</td>
                              <td>{competency.accepted_courses_detail?.map((course) => course.title).join("، ") || "همه دوره‌ها"}</td>
                              <td>{competency.valid_record_count ?? 0}</td>
                              <td>{competency.expired_record_count ?? 0}</td>
                              <td><span className={`badge ${competency.is_active ? "badge-success" : "badge-danger"}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{competency.is_active ? "فعال" : "غیرفعال"}</span></td>
                              <td>
                                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                  {canManage && <button type="button" className="button button-outline button-sm" onClick={() => openCompetency(competency)}>ویرایش</button>}
                                  {canManage && <button type="button" className={`button button-sm ${competency.is_active ? "button-danger" : "button-outline"}`} onClick={() => void toggleCompetency(competency)}>{competency.is_active ? "غیرفعال" : "فعال"}</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "end", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>سوابق صلاحیت کارکنان</h2>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
                        <label style={{ fontSize: "0.8rem" }}>
                          <span style={{ display: "block" }}>جستجو</span>
                          <input value={competencySearch} onChange={(event) => setCompetencySearch(event.target.value)} placeholder="نام کارمند یا صلاحیت" />
                        </label>
                        <label style={{ fontSize: "0.8rem" }}>
                          <span style={{ display: "block" }}>وضعیت</span>
                          <select value={competencyFilter} onChange={(event) => setCompetencyFilter(event.target.value)}>
                            {COMPETENCY_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                          </select>
                        </label>
                        {canIssue && <button type="button" className="button button-sm" onClick={() => openIssueCompetency()}>صدور صلاحیت</button>}
                      </div>
                    </div>
                    {!canIssue && <p className="muted">صدور، تعلیق و لغو صلاحیت فقط توسط نقش‌های مجاز انجام می‌شود.</p>}
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>کارمند</th><th>صلاحیت</th><th>تاریخ احراز</th><th>انقضا</th><th>وضعیت مؤثر</th><th>مهلت</th><th>مدرک/منبع</th><th>اقدام‌ها</th></tr></thead>
                        <tbody>
                          {filteredCompetencies.length === 0 && <EmptyRow colSpan={8} text="سابقه صلاحیتی با این فیلترها یافت نشد." />}
                          {filteredCompetencies.map((record) => (
                            <tr key={record.id}>
                              <td>{record.employee_detail?.full_name}<div className="muted" style={{ fontSize: "0.75rem" }}>{record.employee_detail?.employee_no}</div></td>
                              <td>{record.competency_detail?.name}</td>
                              <td>{formatDate(record.achieved_on)}</td>
                              <td>{formatDate(record.expires_on)}</td>
                              <td><span className={`badge ${statusBadge(record.effective_status)}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{record.effective_status_display ?? record.effective_status}</span></td>
                              <td>{expiryText(record)}</td>
                              <td>{record.certificate_number || record.source_course_title || record.source_session_label || "—"}</td>
                              <td>
                                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                  {canIssue && record.status === "active" && <button type="button" className="button button-outline button-sm" onClick={() => void changeCompetencyStatus(record, "suspended")}>تعلیق</button>}
                                  {canIssue && record.status !== "revoked" && <button type="button" className="button button-danger button-sm" onClick={() => void changeCompetencyStatus(record, "revoked")}>لغو</button>}
                                  {canIssue && <button type="button" className="button button-outline button-sm" onClick={() => openIssueCompetency(undefined, record)}>تمدید</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>الزامات صلاحیت برای انواع مجوز</h2>
                      {canManage && <button type="button" className="button button-sm" onClick={() => openRequirement()}>افزودن الزام</button>}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>نوع مجوز</th><th>صلاحیت الزامی</th><th>توضیح</th><th>اقدام</th></tr></thead>
                        <tbody>
                          {requirements.length === 0 && <EmptyRow colSpan={4} text="الزام صلاحیتی تعریف نشده است." />}
                          {requirements.map((requirement) => (
                            <tr key={requirement.id}>
                              <td>{requirement.permit_type_display ?? requirement.permit_type}</td>
                              <td>{requirement.competency_detail?.name}</td>
                              <td>{requirement.notes || "—"}</td>
                              <td>{canManage && <button type="button" className="button button-danger button-sm" onClick={() => void deleteRequirement(requirement)}>حذف الزام</button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {tab === "ppe" && (
                <div>
                  <section style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>کاتالوگ تجهیزات حفاظت فردی</h2>
                      {canManage && <button type="button" className="button button-sm" onClick={() => openPpeItem()}>قلم تجهیزات جدید</button>}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>کد</th><th>نام</th><th>دسته</th><th>سایزها</th><th>بازه تعویض</th><th>سریال‌دار</th><th>بازرسی</th><th>موجودی</th><th>فعال</th><th>وضعیت</th><th>اقدام‌ها</th></tr></thead>
                        <tbody>
                          {ppeItems.length === 0 && <EmptyRow colSpan={11} text="قلم تجهیزاتی ثبت نشده است." />}
                          {ppeItems.map((item) => (
                            <tr key={item.id}>
                              <td>{item.code}</td>
                              <td>{item.name}</td>
                              <td>{item.category}</td>
                              <td>{item.sizes || "—"}</td>
                              <td>{item.replacement_interval_days ? `${item.replacement_interval_days} روز` : "—"}</td>
                              <td>{item.tracks_serial ? "بله" : "خیر"}</td>
                              <td>{item.inspection_required ? "الزامی" : "—"}</td>
                              <td>{item.stock_total ?? 0}</td>
                              <td>{item.active_assignment_count ?? 0}</td>
                              <td><span className={`badge ${item.is_active ? "badge-success" : "badge-danger"}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{item.is_active ? "فعال" : "غیرفعال"}</span></td>
                              <td>
                                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                  {canManage && <button type="button" className="button button-outline button-sm" onClick={() => openPpeItem(item)}>ویرایش</button>}
                                  {canManage && <button type="button" className={`button button-sm ${item.is_active ? "button-danger" : "button-outline"}`} onClick={() => void togglePpeItem(item)}>{item.is_active ? "غیرفعال" : "فعال"}</button>}
                                  {canManage && <button type="button" className="button button-outline button-sm" onClick={() => openStock(undefined, item.id)}>افزودن انبار</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>موجودی انبار</h2>
                      {canManage && <button type="button" className="button button-sm" onClick={() => openStock()}>انبار جدید</button>}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>قلم</th><th>کارگاه</th><th>محل</th><th>موجودی</th><th>حداقل</th><th>وضعیت</th><th>اقدام‌ها</th></tr></thead>
                        <tbody>
                          {ppeStocks.length === 0 && <EmptyRow colSpan={7} text="انباری ثبت نشده است." />}
                          {ppeStocks.map((stock) => (
                            <tr key={stock.id} style={stock.is_below_minimum ? { background: "#fff7ed" } : undefined}>
                              <td>{stock.item_detail?.name ?? `قلم ${stock.item}`}</td>
                              <td>{stock.workplace_name || "—"}</td>
                              <td>{stock.location_name}</td>
                              <td>{stock.quantity_on_hand}</td>
                              <td>{stock.quantity_minimum}</td>
                              <td>{stock.is_below_minimum ? <span className="badge badge-warning" style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>زیر حداقل</span> : <span className="badge badge-success" style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>کافی</span>}</td>
                              <td>
                                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                  {canManage && <button type="button" className="button button-outline button-sm" onClick={() => openStock(stock)}>ویرایش موجودی</button>}
                                  {canManage && <button type="button" className={`button button-sm ${stock.is_active ? "button-danger" : "button-outline"}`} onClick={() => void toggleStock(stock)}>{stock.is_active ? "غیرفعال" : "فعال"}</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "end", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>تحویل، برگشت و تعویض PPE</h2>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
                        <label style={{ fontSize: "0.8rem" }}>
                          <span style={{ display: "block" }}>جستجو</span>
                          <input value={ppeSearch} onChange={(event) => setPpeSearch(event.target.value)} placeholder="کارمند، قلم یا سریال" />
                        </label>
                        <label style={{ fontSize: "0.8rem" }}>
                          <span style={{ display: "block" }}>وضعیت</span>
                          <select value={ppeStatusFilter} onChange={(event) => setPpeStatusFilter(event.target.value)}>
                            {ASSIGNMENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                          </select>
                        </label>
                        {canOperatePpe && <button type="button" className="button button-sm" onClick={() => openPpeIssue()}>تحویل جدید</button>}
                      </div>
                    </div>
                    {!canOperatePpe && <p className="muted">ثبت تحویل، برگشت و تعویض PPE فقط برای نقش‌های عملیاتی مجاز است.</p>}
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead><tr><th>کارمند</th><th>قلم</th><th>سریال</th><th>تعداد</th><th>محل انبار</th><th>تاریخ تحویل</th><th>تعویض تا</th><th>وضعیت</th><th>رویدادها</th><th>اقدام‌ها</th></tr></thead>
                        <tbody>
                          {filteredAssignments.length === 0 && <EmptyRow colSpan={10} text="تحویل PPE با این فیلترها یافت نشد." />}
                          {filteredAssignments.map((assignment) => (
                            <tr key={assignment.id}>
                              <td>{assignment.employee_detail?.full_name}<div className="muted" style={{ fontSize: "0.75rem" }}>{assignment.employee_detail?.employee_no}</div></td>
                              <td>{assignment.item_name ?? assignment.item_detail?.name}</td>
                              <td>{assignment.serial_number || "—"}</td>
                              <td>{assignment.quantity}</td>
                              <td>{assignment.stock_location || assignment.stock_detail?.location_name || "—"}</td>
                              <td>{formatDate(assignment.issued_on)}</td>
                              <td>{formatDate(assignment.replacement_due_on)}</td>
                              <td><span className={`badge ${statusBadge(assignment.usage_status)}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{assignment.usage_status_display ?? assignment.status_display ?? assignment.status}</span></td>
                              <td>
                                <details>
                                  <summary style={{ cursor: "pointer", fontSize: "0.8rem" }}>{assignment.events?.length ?? 0} رویداد</summary>
                                  {assignment.events && assignment.events.length > 0 ? (
                                    <ul style={{ margin: "0.35rem 0 0", paddingRight: "1rem", fontSize: "0.75rem" }}>
                                      {assignment.events.map((event) => (
                                        <li key={event.id}>{event.event_type_display} — {formatDate(event.event_date)} {event.actor_name ? `(${event.actor_name})` : ""}</li>
                                      ))}
                                    </ul>
                                  ) : <div className="muted" style={{ fontSize: "0.75rem" }}>رویدادی ثبت نشده است.</div>}
                                </details>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                  {assignment.can_return && <button type="button" className="button button-outline button-sm" onClick={() => openReturn(assignment)}>برگشت</button>}
                                  {assignment.can_replace && <button type="button" className="button button-outline button-sm" onClick={() => openReplace(assignment)}>تعویض</button>}
                                  {assignment.can_dispose && <button type="button" className="button button-danger button-sm" onClick={() => openDispose(assignment)}>امحا</button>}
                                  {!assignment.can_return && !assignment.can_replace && !assignment.can_dispose && <span className="muted" style={{ fontSize: "0.75rem" }}>بسته</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </>
      )}

      {modal === "employee" && (
        <Modal title={editingId ? "ویرایش کارمند" : "ثبت کارمند"} onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitEmployee(); }}>
            {formError && <ErrorBox message={formError} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="شماره پرسنلی" hint={editingId ? "شماره پرسنلی پس از ثبت قابل تغییر نیست." : undefined}>
                <input required value={employeeForm.employee_no} disabled={Boolean(editingId)} onChange={(event) => setEmployeeForm({ ...employeeForm, employee_no: event.target.value })} />
              </Field>
              <Field label="شغل"><input value={employeeForm.job_title} onChange={(event) => setEmployeeForm({ ...employeeForm, job_title: event.target.value })} /></Field>
              <Field label="نام"><input required value={employeeForm.first_name} onChange={(event) => setEmployeeForm({ ...employeeForm, first_name: event.target.value })} /></Field>
              <Field label="نام خانوادگی"><input required value={employeeForm.last_name} onChange={(event) => setEmployeeForm({ ...employeeForm, last_name: event.target.value })} /></Field>
              <Field label="کارگاه">
                <select value={employeeForm.workplace} onChange={(event) => setEmployeeForm({ ...employeeForm, workplace: event.target.value })}>
                  <option value="">بدون کارگاه</option>
                  {workplaces.map((workplace) => <option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}
                </select>
              </Field>
              <Field label="وضعیت">
                <select value={employeeForm.is_active ? "active" : "inactive"} onChange={(event) => setEmployeeForm({ ...employeeForm, is_active: event.target.value === "active" })}>
                  <option value="active">فعال</option>
                  <option value="inactive">غیرفعال</option>
                </select>
              </Field>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ذخیره…" : "ذخیره"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "course" && (
        <Modal title={editingId ? "ویرایش دوره آموزشی" : "دوره آموزشی جدید"} onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitCourse(); }}>
            {formError && <ErrorBox message={formError} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="کد دوره" hint={editingId ? "کد دوره قابل تغییر نیست." : undefined}>
                <input required value={courseForm.code} disabled={Boolean(editingId)} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} />
              </Field>
              <Field label="عنوان دوره"><input required value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} /></Field>
              <Field label="دسته"><input value={courseForm.category} onChange={(event) => setCourseForm({ ...courseForm, category: event.target.value })} /></Field>
              <Field label="مدت (دقیقه)"><input type="number" min="1" required value={courseForm.duration_minutes} onChange={(event) => setCourseForm({ ...courseForm, duration_minutes: event.target.value })} /></Field>
              <Field label="روش برگزاری">
                <select value={courseForm.delivery_type} onChange={(event) => setCourseForm({ ...courseForm, delivery_type: event.target.value })}>
                  <option value="in_person">حضوری</option>
                  <option value="practical">عملی</option>
                  <option value="online">آنلاین</option>
                  <option value="blended">ترکیبی</option>
                </select>
              </Field>
              <Field label="وضعیت">
                <select value={courseForm.is_active ? "active" : "inactive"} onChange={(event) => setCourseForm({ ...courseForm, is_active: event.target.value === "active" })}>
                  <option value="active">فعال</option>
                  <option value="inactive">غیرفعال</option>
                </select>
              </Field>
            </div>
            <Field label="توضیحات"><textarea rows={2} value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} /></Field>
            <Field label="اهداف"><textarea rows={2} value={courseForm.objectives} onChange={(event) => setCourseForm({ ...courseForm, objectives: event.target.value })} /></Field>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <label><input type="checkbox" checked={courseForm.is_mandatory} onChange={(event) => setCourseForm({ ...courseForm, is_mandatory: event.target.checked })} /> اجباری</label>
              <label><input type="checkbox" checked={courseForm.requires_renewal} onChange={(event) => setCourseForm({ ...courseForm, requires_renewal: event.target.checked })} /> نیازمند تجدید</label>
            </div>
            {courseForm.requires_renewal && (
              <Field label="اعتبار دوره (ماه)"><input type="number" min="1" max="120" value={courseForm.validity_months} onChange={(event) => setCourseForm({ ...courseForm, validity_months: event.target.value })} /></Field>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ذخیره…" : "ذخیره"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "session" && (
        <Modal title={editingId ? "ویرایش نوبت آموزشی" : "نوبت آموزشی جدید"} onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitSession(); }}>
            {formError && <ErrorBox message={formError} />}
            <Field label="دوره">
              <select required value={sessionForm.course} disabled={Boolean(editingId)} onChange={(event) => setSessionForm({ ...sessionForm, course: event.target.value })}>
                <option value="">انتخاب دوره</option>
                {courses.filter((course) => course.is_active || String(course.id) === sessionForm.course).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="تاریخ برگزاری"><input type="date" required value={sessionForm.scheduled_on} onChange={(event) => setSessionForm({ ...sessionForm, scheduled_on: event.target.value })} /></Field>
              <Field label="مدرس"><input required value={sessionForm.instructor_name} onChange={(event) => setSessionForm({ ...sessionForm, instructor_name: event.target.value })} /></Field>
              <Field label="کارگاه">
                <select value={sessionForm.workplace} onChange={(event) => setSessionForm({ ...sessionForm, workplace: event.target.value })}>
                  <option value="">بدون کارگاه</option>
                  {workplaces.map((workplace) => <option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}
                </select>
              </Field>
              <Field label="مدت (دقیقه)"><input type="number" min="1" value={sessionForm.duration_minutes} onChange={(event) => setSessionForm({ ...sessionForm, duration_minutes: event.target.value })} /></Field>
              <Field label="ظرفیت"><input type="number" min="1" value={sessionForm.capacity} onChange={(event) => setSessionForm({ ...sessionForm, capacity: event.target.value })} /></Field>
              <Field label="وضعیت">
                <select value={sessionForm.status} onChange={(event) => setSessionForm({ ...sessionForm, status: event.target.value })}>
                  <option value="scheduled">برنامه‌ریزی‌شده</option>
                  <option value="in_progress">در حال برگزاری</option>
                  <option value="completed">برگزارشده</option>
                  <option value="cancelled">لغوشده</option>
                </select>
              </Field>
            </div>
            <Field label="یادداشت"><textarea rows={2} value={sessionForm.notes} onChange={(event) => setSessionForm({ ...sessionForm, notes: event.target.value })} /></Field>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ذخیره…" : "ذخیره"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "attendance" && (
        <Modal title="ثبت حضور و نتیجه ارزیابی" onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitAttendance(); }}>
            {formError && <ErrorBox message={formError} />}
            <Field label="نوبت آموزشی">
              <select required value={attendanceForm.session} onChange={(event) => {
                const session = sessions.find((item) => item.id === Number(event.target.value));
                setAttendanceForm({ ...attendanceForm, session: event.target.value, completed_on: session?.scheduled_on ?? attendanceForm.completed_on });
              }}>
                <option value="">انتخاب نوبت</option>
                {sessions.map((session) => <option key={session.id} value={session.id}>{session.course_detail?.title} — {formatDate(session.scheduled_on)} ({session.status_display ?? session.status})</option>)}
              </select>
            </Field>
            <Field label="کارمند">
              <select required value={attendanceForm.employee} onChange={(event) => setAttendanceForm({ ...attendanceForm, employee: event.target.value })}>
                <option value="">انتخاب کارمند</option>
                {employees.filter((employee) => employee.is_active).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_no})</option>)}
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="وضعیت حضور">
                <select value={attendanceForm.attendance_status} onChange={(event) => setAttendanceForm({ ...attendanceForm, attendance_status: event.target.value })}>
                  <option value="registered">ثبت‌نام‌شده</option>
                  <option value="attended">حاضر</option>
                  <option value="absent">غایب</option>
                  <option value="cancelled">لغوشده</option>
                </select>
              </Field>
              <Field label="نتیجه ارزیابی">
                <select value={attendanceForm.assessment_result} onChange={(event) => setAttendanceForm({ ...attendanceForm, assessment_result: event.target.value })}>
                  <option value="pending">در انتظار</option>
                  <option value="passed">قبول</option>
                  <option value="failed">رد</option>
                </select>
              </Field>
              <Field label="نمره"><input type="number" min="0" max="100" value={attendanceForm.score} onChange={(event) => setAttendanceForm({ ...attendanceForm, score: event.target.value })} /></Field>
              {attendanceForm.assessment_result !== "pending" && <Field label="تاریخ تکمیل"><input type="date" required value={attendanceForm.completed_on} onChange={(event) => setAttendanceForm({ ...attendanceForm, completed_on: event.target.value })} /></Field>}
            </div>
            <Field label="یادداشت"><textarea rows={2} value={attendanceForm.notes} onChange={(event) => setAttendanceForm({ ...attendanceForm, notes: event.target.value })} /></Field>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ثبت…" : "ثبت نتیجه"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "competency" && (
        <Modal title={editingId ? "ویرایش نوع صلاحیت" : "نوع صلاحیت جدید"} onClose={closeModal} wide>
          <form onSubmit={(event) => { event.preventDefault(); void submitCompetency(); }}>
            {formError && <ErrorBox message={formError} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="کد صلاحیت" hint={editingId ? "کد صلاحیت قابل تغییر نیست." : undefined}>
                <input required value={competencyForm.code} disabled={Boolean(editingId)} onChange={(event) => setCompetencyForm({ ...competencyForm, code: event.target.value })} />
              </Field>
              <Field label="نام صلاحیت"><input required value={competencyForm.name} onChange={(event) => setCompetencyForm({ ...competencyForm, name: event.target.value })} /></Field>
              <Field label="اعتبار (ماه)"><input type="number" min="1" max="120" value={competencyForm.validity_months} onChange={(event) => setCompetencyForm({ ...competencyForm, validity_months: event.target.value })} /></Field>
              <Field label="وضعیت">
                <select value={competencyForm.is_active ? "active" : "inactive"} onChange={(event) => setCompetencyForm({ ...competencyForm, is_active: event.target.value === "active" })}>
                  <option value="active">فعال</option>
                  <option value="inactive">غیرفعال</option>
                </select>
              </Field>
            </div>
            <Field label="فعالیت‌های مجاز"><textarea rows={2} value={competencyForm.allowed_activities} onChange={(event) => setCompetencyForm({ ...competencyForm, allowed_activities: event.target.value })} /></Field>
            <Field label="توضیحات"><textarea rows={2} value={competencyForm.description} onChange={(event) => setCompetencyForm({ ...competencyForm, description: event.target.value })} /></Field>
            <Field label="دوره‌های قابل قبول" hint="با Ctrl چند دوره انتخاب کنید؛ خالی بودن یعنی محدودیتی اعمال نمی‌شود.">
              <select multiple size={5} value={competencyForm.accepted_courses} onChange={(event) => setCompetencyForm({ ...competencyForm, accepted_courses: Array.from(event.target.selectedOptions).map((option) => option.value) })}>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </Field>
            <label style={{ display: "block", marginBottom: "0.75rem" }}><input type="checkbox" checked={competencyForm.is_mandatory} onChange={(event) => setCompetencyForm({ ...competencyForm, is_mandatory: event.target.checked })} /> صلاحیت اجباری</label>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ذخیره…" : "ذخیره"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "issue-competency" && (
        <Modal title="صدور یا تمدید صلاحیت" onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitIssueCompetency(); }}>
            {formError && <ErrorBox message={formError} />}
            <Field label="کارمند">
              <select required value={issueForm.employee} onChange={(event) => setIssueForm({ ...issueForm, employee: event.target.value })}>
                <option value="">انتخاب کارمند فعال</option>
                {employees.filter((employee) => employee.is_active).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_no})</option>)}
              </select>
            </Field>
            <Field label="نوع صلاحیت">
              <select required value={issueForm.competency} onChange={(event) => setIssueForm({ ...issueForm, competency: event.target.value })}>
                <option value="">انتخاب صلاحیت فعال</option>
                {competencies.filter((competency) => competency.is_active).map((competency) => <option key={competency.id} value={competency.id}>{competency.name}</option>)}
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="تاریخ احراز"><input type="date" required value={issueForm.achieved_on} onChange={(event) => setIssueForm({ ...issueForm, achieved_on: event.target.value })} /></Field>
              <Field label="تاریخ انقضا" hint="خالی بماند تا از اعتبار نوع صلاحیت محاسبه شود."><input type="date" value={issueForm.expires_on} onChange={(event) => setIssueForm({ ...issueForm, expires_on: event.target.value })} /></Field>
            </div>
            <Field label="دوره منبع">
              <select value={issueForm.source_course} onChange={(event) => setIssueForm({ ...issueForm, source_course: event.target.value })}>
                <option value="">بدون دوره منبع</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </Field>
            <Field label="نوبت منبع" hint="اتصال به نوبت فقط با حضور و قبولی ثبت‌شده همان کارمند معتبر است.">
              <select value={issueForm.source_session} onChange={(event) => setIssueForm({ ...issueForm, source_session: event.target.value })}>
                <option value="">بدون نوبت منبع</option>
                {sessions.filter((session) => session.status === "completed").map((session) => <option key={session.id} value={session.id}>{session.course_detail?.title} — {formatDate(session.scheduled_on)}</option>)}
              </select>
            </Field>
            <Field label="شماره مدرک"><input value={issueForm.certificate_number} onChange={(event) => setIssueForm({ ...issueForm, certificate_number: event.target.value })} /></Field>
            <Field label="یادداشت"><textarea rows={2} value={issueForm.notes} onChange={(event) => setIssueForm({ ...issueForm, notes: event.target.value })} /></Field>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال صدور…" : "صدور صلاحیت"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "requirement" && (
        <Modal title="افزودن الزام صلاحیت به مجوز" onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitRequirement(); }}>
            {formError && <ErrorBox message={formError} />}
            <Field label="نوع مجوز">
              <select value={requirementForm.permit_type} onChange={(event) => setRequirementForm({ ...requirementForm, permit_type: event.target.value })}>
                {PERMIT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </Field>
            <Field label="صلاحیت الزامی">
              <select required value={requirementForm.competency} onChange={(event) => setRequirementForm({ ...requirementForm, competency: event.target.value })}>
                <option value="">انتخاب صلاحیت</option>
                {competencies.filter((competency) => competency.is_active).map((competency) => <option key={competency.id} value={competency.id}>{competency.name}</option>)}
              </select>
            </Field>
            <Field label="توضیح"><textarea rows={2} value={requirementForm.notes} onChange={(event) => setRequirementForm({ ...requirementForm, notes: event.target.value })} /></Field>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ذخیره…" : "افزودن"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "ppe-item" && (
        <Modal title={editingId ? "ویرایش قلم تجهیزات" : "قلم تجهیزات جدید"} onClose={closeModal} wide>
          <form onSubmit={(event) => { event.preventDefault(); void submitPpeItem(); }}>
            {formError && <ErrorBox message={formError} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="کد تجهیزات" hint={editingId ? "کد تجهیزات قابل تغییر نیست." : undefined}>
                <input required value={ppeItemForm.code} disabled={Boolean(editingId)} onChange={(event) => setPpeItemForm({ ...ppeItemForm, code: event.target.value })} />
              </Field>
              <Field label="نام تجهیزات"><input required value={ppeItemForm.name} onChange={(event) => setPpeItemForm({ ...ppeItemForm, name: event.target.value })} /></Field>
              <Field label="دسته"><input required value={ppeItemForm.category} onChange={(event) => setPpeItemForm({ ...ppeItemForm, category: event.target.value })} /></Field>
              <Field label="سایزها"><input value={ppeItemForm.sizes} onChange={(event) => setPpeItemForm({ ...ppeItemForm, sizes: event.target.value })} /></Field>
              <Field label="بازه تعویض (روز)"><input type="number" min="1" max="3650" value={ppeItemForm.replacement_interval_days} onChange={(event) => setPpeItemForm({ ...ppeItemForm, replacement_interval_days: event.target.value })} /></Field>
              <Field label="وضعیت">
                <select value={ppeItemForm.is_active ? "active" : "inactive"} onChange={(event) => setPpeItemForm({ ...ppeItemForm, is_active: event.target.value === "active" })}>
                  <option value="active">فعال</option>
                  <option value="inactive">غیرفعال</option>
                </select>
              </Field>
            </div>
            <Field label="توضیحات"><textarea rows={2} value={ppeItemForm.description} onChange={(event) => setPpeItemForm({ ...ppeItemForm, description: event.target.value })} /></Field>
            <Field label="الزامات استفاده"><textarea rows={2} value={ppeItemForm.usage_requirements} onChange={(event) => setPpeItemForm({ ...ppeItemForm, usage_requirements: event.target.value })} /></Field>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <label><input type="checkbox" checked={ppeItemForm.tracks_serial} onChange={(event) => setPpeItemForm({ ...ppeItemForm, tracks_serial: event.target.checked })} /> سریال‌دار</label>
              <label><input type="checkbox" checked={ppeItemForm.inspection_required} onChange={(event) => setPpeItemForm({ ...ppeItemForm, inspection_required: event.target.checked })} /> بازرسی الزامی</label>
              <label><input type="checkbox" checked={ppeItemForm.is_durable} onChange={(event) => setPpeItemForm({ ...ppeItemForm, is_durable: event.target.checked })} /> بادوام</label>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ذخیره…" : "ذخیره"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "ppe-stock" && (
        <Modal title={editingId ? "ویرایش موجودی انبار" : "انبار جدید"} onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitStock(); }}>
            {formError && <ErrorBox message={formError} />}
            <Field label="قلم تجهیزات">
              <select required value={stockForm.item} disabled={Boolean(editingId)} onChange={(event) => setStockForm({ ...stockForm, item: event.target.value })}>
                <option value="">انتخاب قلم</option>
                {ppeItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="کارگاه">
              <select value={stockForm.workplace} onChange={(event) => setStockForm({ ...stockForm, workplace: event.target.value })}>
                <option value="">بدون کارگاه</option>
                {workplaces.map((workplace) => <option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}
              </select>
            </Field>
            <Field label="محل انبار"><input required value={stockForm.location_name} onChange={(event) => setStockForm({ ...stockForm, location_name: event.target.value })} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="موجودی فعلی"><input type="number" min="0" required value={stockForm.quantity_on_hand} onChange={(event) => setStockForm({ ...stockForm, quantity_on_hand: event.target.value })} /></Field>
              <Field label="حداقل موجودی"><input type="number" min="0" required value={stockForm.quantity_minimum} onChange={(event) => setStockForm({ ...stockForm, quantity_minimum: event.target.value })} /></Field>
            </div>
            <Field label="وضعیت">
              <select value={stockForm.is_active ? "active" : "inactive"} onChange={(event) => setStockForm({ ...stockForm, is_active: event.target.value === "active" })}>
                <option value="active">فعال</option>
                <option value="inactive">غیرفعال</option>
              </select>
            </Field>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ذخیره…" : "ذخیره"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "ppe-issue" && (
        <Modal title="تحویل تجهیزات حفاظت فردی" onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitPpeIssue(); }}>
            {formError && <ErrorBox message={formError} />}
            <Field label="کارمند">
              <select required value={ppeIssueForm.employee} onChange={(event) => setPpeIssueForm({ ...ppeIssueForm, employee: event.target.value })}>
                <option value="">انتخاب کارمند فعال</option>
                {employees.filter((employee) => employee.is_active).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_no})</option>)}
              </select>
            </Field>
            <Field label="قلم تجهیزات">
              <select required value={ppeIssueForm.item} onChange={(event) => handlePpeItemChange(event.target.value)}>
                <option value="">انتخاب قلم فعال</option>
                {ppeItems.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
              </select>
            </Field>
            <Field label="انبار" hint="فقط انبارهای فعال همان قلم نمایش داده می‌شوند.">
              <select required value={ppeIssueForm.stock} onChange={(event) => setPpeIssueForm({ ...ppeIssueForm, stock: event.target.value })}>
                <option value="">انتخاب انبار</option>
                {ppeStocks.filter((stock) => stock.item === Number(ppeIssueForm.item) && stock.is_active).map((stock) => <option key={stock.id} value={stock.id}>{stock.location_name} — موجودی {stock.quantity_on_hand}</option>)}
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="تعداد"><input type="number" min="1" required value={ppeIssueForm.quantity} onChange={(event) => setPpeIssueForm({ ...ppeIssueForm, quantity: event.target.value })} /></Field>
              <Field label="تاریخ تحویل"><input type="date" required value={ppeIssueForm.issued_on} onChange={(event) => setPpeIssueForm({ ...ppeIssueForm, issued_on: event.target.value })} /></Field>
              <Field label="شماره سریال" hint={ppeItems.find((item) => item.id === Number(ppeIssueForm.item))?.tracks_serial ? "برای اقلام سریال‌دار الزامی است." : undefined}>
                <input value={ppeIssueForm.serial_number} onChange={(event) => setPpeIssueForm({ ...ppeIssueForm, serial_number: event.target.value })} />
              </Field>
              <Field label="وضعیت هنگام تحویل"><input value={ppeIssueForm.condition_on_issue} onChange={(event) => setPpeIssueForm({ ...ppeIssueForm, condition_on_issue: event.target.value })} /></Field>
              <Field label="تعویض تا"><input type="date" value={ppeIssueForm.replacement_due_on} onChange={(event) => setPpeIssueForm({ ...ppeIssueForm, replacement_due_on: event.target.value })} /></Field>
            </div>
            <Field label="یادداشت"><textarea rows={2} value={ppeIssueForm.notes} onChange={(event) => setPpeIssueForm({ ...ppeIssueForm, notes: event.target.value })} /></Field>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ثبت…" : "ثبت تحویل"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "ppe-return" && selectedAssignment && (
        <Modal title="ثبت برگشت تجهیزات" onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitReturn(); }}>
            {formError && <ErrorBox message={formError} />}
            <p className="muted">{selectedAssignment.employee_detail?.full_name} — {selectedAssignment.item_name}{selectedAssignment.serial_number ? ` (${selectedAssignment.serial_number})` : ""}</p>
            <Field label="وضعیت هنگام برگشت"><input required value={returnForm.condition} onChange={(event) => setReturnForm({ ...returnForm, condition: event.target.value })} /></Field>
            <Field label="تاریخ برگشت"><input type="date" required value={returnForm.returned_on} onChange={(event) => setReturnForm({ ...returnForm, returned_on: event.target.value })} /></Field>
            <Field label="یادداشت"><textarea rows={2} value={returnForm.notes} onChange={(event) => setReturnForm({ ...returnForm, notes: event.target.value })} /></Field>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={returnForm.restock} onChange={(event) => setReturnForm({ ...returnForm, restock: event.target.checked })} /> افزودن به موجودی قابل استفاده
              <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>اگر تجهیز آسیب‌دیده یا آلوده است، این گزینه را غیرفعال کنید.</span>
            </label>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ثبت…" : "ثبت برگشت"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "ppe-replace" && selectedAssignment && (
        <Modal title="ثبت تعویض تجهیزات" onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitReplace(); }}>
            {formError && <ErrorBox message={formError} />}
            <p className="muted">{selectedAssignment.employee_detail?.full_name} — {selectedAssignment.item_name}{selectedAssignment.serial_number ? ` (${selectedAssignment.serial_number})` : ""}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem" }}>
              <Field label="سریال جدید"><input value={replaceForm.serial_number} onChange={(event) => setReplaceForm({ ...replaceForm, serial_number: event.target.value })} /></Field>
              <Field label="تاریخ تحویل جدید"><input type="date" required value={replaceForm.issued_on} onChange={(event) => setReplaceForm({ ...replaceForm, issued_on: event.target.value })} /></Field>
              <Field label="وضعیت قلم جدید"><input value={replaceForm.condition_on_issue} onChange={(event) => setReplaceForm({ ...replaceForm, condition_on_issue: event.target.value })} /></Field>
              <Field label="تعویض تا"><input type="date" value={replaceForm.replacement_due_on} onChange={(event) => setReplaceForm({ ...replaceForm, replacement_due_on: event.target.value })} /></Field>
              <Field label="وضعیت قلم قدیمی"><input value={replaceForm.return_condition} onChange={(event) => setReplaceForm({ ...replaceForm, return_condition: event.target.value })} /></Field>
            </div>
            <Field label="یادداشت"><textarea rows={2} value={replaceForm.notes} onChange={(event) => setReplaceForm({ ...replaceForm, notes: event.target.value })} /></Field>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={replaceForm.restock_old} onChange={(event) => setReplaceForm({ ...replaceForm, restock_old: event.target.checked })} /> بازگرداندن قلم قدیمی به موجودی
              <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>پیش‌فرض ایمن: قلم تعویض‌شده قابل استفاده فرض نمی‌شود.</span>
            </label>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button" disabled={submitting}>{submitting ? "در حال ثبت…" : "ثبت تعویض"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "ppe-dispose" && selectedAssignment && (
        <Modal title="امحای تجهیزات" onClose={closeModal}>
          <form onSubmit={(event) => { event.preventDefault(); void submitDispose(); }}>
            {formError && <ErrorBox message={formError} />}
            <p className="muted">{selectedAssignment.employee_detail?.full_name} — {selectedAssignment.item_name}{selectedAssignment.serial_number ? ` (${selectedAssignment.serial_number})` : ""}</p>
            <Field label="وضعیت/دلیل امحا"><input required value={disposeForm.condition} onChange={(event) => setDisposeForm({ ...disposeForm, condition: event.target.value })} /></Field>
            <Field label="یادداشت"><textarea rows={2} value={disposeForm.notes} onChange={(event) => setDisposeForm({ ...disposeForm, notes: event.target.value })} /></Field>
            <p className="muted" style={{ fontSize: "0.8rem" }}>امحا سابقه را حذف نمی‌کند و موجودی قابل استفاده افزایش نمی‌یابد.</p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="button button-outline" onClick={closeModal}>انصراف</button>
              <button type="submit" className="button button-danger" disabled={submitting}>{submitting ? "در حال ثبت…" : "ثبت امحا"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "history" && historyEmployee && (
        <Modal title={`تاریخچه ${historyEmployee.full_name}`} onClose={closeModal} wide>
          {historyError && <ErrorBox message={historyError} />}
          {historyLoading ? (
            <p className="muted">در حال بارگذاری تاریخچه…</p>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              <section>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.35rem" }}>آموزش و ارزیابی</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead><tr><th>دوره</th><th>تاریخ نوبت</th><th>حضور</th><th>نتیجه</th><th>نمره</th></tr></thead>
                    <tbody>
                      {historyTraining.length === 0 && <EmptyRow colSpan={5} text="سابقه آموزشی ثبت نشده است." />}
                      {historyTraining.map((item) => (
                        <tr key={item.id}>
                          <td>{item.session_detail?.course_title}</td>
                          <td>{formatDate(item.session_detail?.scheduled_on)}</td>
                          <td>{item.attendance_status_display ?? item.attendance_status}</td>
                          <td>{item.assessment_result_display ?? item.assessment_result}</td>
                          <td>{item.score ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.35rem" }}>صلاحیت‌ها</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead><tr><th>صلاحیت</th><th>احراز</th><th>انقضا</th><th>وضعیت</th><th>مهلت</th><th>مدرک</th></tr></thead>
                    <tbody>
                      {historyCompetencies.length === 0 && <EmptyRow colSpan={6} text="سابقه صلاحیتی ثبت نشده است." />}
                      {historyCompetencies.map((item) => (
                        <tr key={item.id}>
                          <td>{item.competency_detail?.name}</td>
                          <td>{formatDate(item.achieved_on)}</td>
                          <td>{formatDate(item.expires_on)}</td>
                          <td><span className={`badge ${statusBadge(item.effective_status)}`} style={{ padding: "0.2rem 0.45rem", borderRadius: "4px" }}>{item.effective_status_display ?? item.effective_status}</span></td>
                          <td>{expiryText(item)}</td>
                          <td>{item.certificate_number || item.source_course_title || item.source_session_label || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.35rem" }}>تجهیزات حفاظت فردی</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead><tr><th>قلم</th><th>سریال</th><th>تحویل</th><th>تعویض تا</th><th>وضعیت</th><th>رویدادها</th></tr></thead>
                    <tbody>
                      {historyPpe.length === 0 && <EmptyRow colSpan={6} text="سابقه PPE ثبت نشده است." />}
                      {historyPpe.map((item) => (
                        <tr key={item.id}>
                          <td>{item.item_name ?? item.item_detail?.name}</td>
                          <td>{item.serial_number || "—"}</td>
                          <td>{formatDate(item.issued_on)}</td>
                          <td>{formatDate(item.replacement_due_on)}</td>
                          <td>{item.usage_status_display ?? item.status_display ?? item.status}</td>
                          <td>
                            {item.events && item.events.length > 0 ? (
                              <ul style={{ margin: 0, paddingRight: "1rem", fontSize: "0.75rem" }}>
                                {item.events.map((event) => <li key={event.id}>{event.event_type_display} — {formatDate(event.event_date)}</li>)}
                              </ul>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
