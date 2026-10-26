import { useEffect, useState } from "react";
import {
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
  returnPPEAssignment,
  updateEmployeeCompetencyStatus,
  createAttendanceRecord,
  createContractor,
  createContractorDocument,
  createContractorWorker,
  createEmployeeJobAssignment,
  createJobPosition,
  fetchAttendanceRecords,
  fetchAttendanceRoster,
  fetchContractorDocuments,
  fetchContractors,
  fetchContractorWorkers,
  fetchEmployeeJobAssignments,
  fetchJobPositions,
  verifyContractorDocument,
  type AttendanceRecord,
  type AttendanceRoster,
  type ContractorCompany,
  type ContractorDocument,
  type ContractorWorker,
  type EmployeeJobAssignment,
  type JobPosition,
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

type WorkforceTab =
  | "overview"
  | "employees"
  | "training"
  | "competencies"
  | "ppe"
  | "contractors"
  | "jobs"
  | "attendance";

export function WorkforcePage() {
  const [activeTab, setActiveTab] = useState<WorkforceTab>("overview");
  const [stats, setStats] = useState<WorkforceStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);

  // Domain data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [attendances, setAttendances] = useState<TrainingAttendance[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [empCompetencies, setEmpCompetencies] = useState<EmployeeCompetency[]>([]);
  const [permitRequirements, setPermitRequirements] = useState<PermitTypeCompetencyRequirement[]>([]);
  const [ppeItems, setPpeItems] = useState<PPEItem[]>([]);
  const [ppeStocks, setPpeStocks] = useState<PPEStock[]>([]);
  const [ppeAssignments, setPpeAssignments] = useState<PPEAssignment[]>([]);

  // Phase 12 Domain Data
  const [contractors, setContractors] = useState<ContractorCompany[]>([]);
  const [contractorDocuments, setContractorDocuments] = useState<ContractorDocument[]>([]);
  const [contractorWorkers, setContractorWorkers] = useState<ContractorWorker[]>([]);
  const [selectedContractorId, setSelectedContractorId] = useState<number | null>(null);

  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [jobAssignments, setJobAssignments] = useState<EmployeeJobAssignment[]>([]);

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceRoster, setAttendanceRoster] = useState<AttendanceRoster | null>(null);
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Phase 12 Modals
  const [showContractorModal, setShowContractorModal] = useState<boolean>(false);
  const [showContractorDocModal, setShowContractorDocModal] = useState<boolean>(false);
  const [showContractorWorkerModal, setShowContractorWorkerModal] = useState<boolean>(false);
  const [showJobPositionModal, setShowJobPositionModal] = useState<boolean>(false);
  const [showJobAssignModal, setShowJobAssignModal] = useState<boolean>(false);
  const [showAttendanceModalP12, setShowAttendanceModalP12] = useState<boolean>(false);

  // Phase 12 Forms
  const [contractorName, setContractorName] = useState("");
  const [contractorRegNo, setContractorRegNo] = useState("");
  const [contractorContactPerson, setContractorContactPerson] = useState("");
  const [contractorPhone, setContractorPhone] = useState("");

  const [docType, setDocType] = useState<"hse_plan" | "insurance_policy" | "qualification_cert" | "iso_cert" | "other">("hse_plan");
  const [docTitle, setDocTitle] = useState("");
  const [docValidUntil, setDocValidUntil] = useState("");

  const [workerNatId, setWorkerNatId] = useState("");
  const [workerFirstName, setWorkerFirstName] = useState("");
  const [workerLastName, setWorkerLastName] = useState("");
  const [workerTrade, setWorkerTrade] = useState("");
  const [workerMobile, setWorkerMobile] = useState("");

  const [jobCode, setJobCode] = useState("");
  const [jobTitleInput, setJobTitleInput] = useState("");
  const [jobDept, setJobDept] = useState("");
  const [jobRisk, setJobRisk] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [jobQuals, setJobQuals] = useState("");

  const [assignEmpId, setAssignEmpId] = useState("");
  const [assignJobId, setAssignJobId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split("T")[0]);

  const [attType, setAttType] = useState<"employee" | "contractor_worker">("employee");
  const [attPersonEmpId, setAttPersonEmpId] = useState("");
  const [attPersonWorkerId, setAttPersonWorkerId] = useState("");
  const [attWorkplaceId, setAttWorkplaceId] = useState("");
  const [attStatusP12, setAttStatusP12] = useState<"present" | "late" | "absent" | "early_departure">("present");
  const [attCheckIn, setAttCheckIn] = useState(new Date().toISOString().slice(0, 16));

  // Search and filter states
  const [employeeSearch, setEmployeeSearch] = useState<string>("");
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState<string>("");

  // Modals
  const [showEmployeeModal, setShowEmployeeModal] = useState<boolean>(false);
  const [showCourseModal, setShowCourseModal] = useState<boolean>(false);
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [showCompetencyModal, setShowCompetencyModal] = useState<boolean>(false);
  const [showIssueCompetencyModal, setShowIssueCompetencyModal] = useState<boolean>(false);
  const [showRequirementModal, setShowRequirementModal] = useState<boolean>(false);
  const [showPPEItemModal, setShowPPEItemModal] = useState<boolean>(false);
  const [showPPEStockModal, setShowPPEStockModal] = useState<boolean>(false);
  const [showPPEIssueModal, setShowPPEIssueModal] = useState<boolean>(false);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [selectedAssignment, setSelectedAssignment] = useState<PPEAssignment | null>(null);

  // Employee history modal
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [empHistoryTraining, setEmpHistoryTraining] = useState<TrainingAttendance[]>([]);
  const [empHistoryComp, setEmpHistoryComp] = useState<EmployeeCompetency[]>([]);
  const [empHistoryPPE, setEmpHistoryPPE] = useState<PPEAssignment[]>([]);

  // Form states
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // New Employee form
  const [empNo, setEmpNo] = useState("");
  const [empFirstName, setEmpFirstName] = useState("");
  const [empLastName, setEmpLastName] = useState("");
  const [empJobTitle, setEmpJobTitle] = useState("");
  const [empWorkplace, setEmpWorkplace] = useState("");

  // New Course form
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseCategory, setCourseCategory] = useState("ایمنی عمومی");
  const [courseDuration, setCourseDuration] = useState("480");
  const [courseDelivery, setCourseDelivery] = useState<"in_person" | "practical" | "online" | "blended">("in_person");
  const [courseMandatory, setCourseMandatory] = useState(false);
  const [courseValidity, setCourseValidity] = useState("12");

  // New Session form
  const [sessCourse, setSessCourse] = useState("");
  const [sessWorkplace, setSessWorkplace] = useState("");
  const [sessDate, setSessDate] = useState("");
  const [sessTrainer, setSessTrainer] = useState("");
  const [sessCapacity, setSessCapacity] = useState("20");

  // Attendance form
  const [attEmployee, setAttEmployee] = useState("");
  const [attStatus, setAttStatus] = useState<"registered" | "attended" | "absent" | "cancelled">("attended");
  const [attResult, setAttResult] = useState<"pending" | "passed" | "failed">("passed");
  const [attScore, setAttScore] = useState("85");
  const [attCompletedOn, setAttCompletedOn] = useState("");

  // Competency form
  const [compCode, setCompCode] = useState("");
  const [compName, setCompName] = useState("");
  const [compActivities, setCompActivities] = useState("");
  const [compValidity, setCompValidity] = useState("12");

  // Issue Competency form
  const [issueEmp, setIssueEmp] = useState("");
  const [issueComp, setIssueComp] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [issueExpires, setIssueExpires] = useState("");
  const [issueCertNo, setIssueCertNo] = useState("");

  // Requirement form
  const [reqPermitType, setReqPermitType] = useState<PermitType>("hot_work");
  const [reqCompetency, setReqCompetency] = useState("");

  // PPE Item form
  const [ppeCode, setPpeCode] = useState("");
  const [ppeName, setPpeName] = useState("");
  const [ppeCategory, setPpeCategory] = useState("حفاظت سر");
  const [ppeInterval, setPpeInterval] = useState("365");
  const [ppeSerial, setPpeSerial] = useState(false);

  // PPE Stock form
  const [stockItem, setStockItem] = useState("");
  const [stockWorkplace, setStockWorkplace] = useState("");
  const [stockLocation, setStockLocation] = useState("انبار مرکزی");
  const [stockQuantity, setStockQuantity] = useState("10");
  const [stockMinimum, setStockMinimum] = useState("2");

  // PPE Issue form
  const [issuePPEEmp, setIssuePPEEmp] = useState("");
  const [issuePPEItem, setIssuePPEItem] = useState("");
  const [issuePPEStock, setIssuePPEStock] = useState("");
  const [issuePPEQty, setIssuePPEQty] = useState("1");
  const [issuePPESerial, setIssuePPESerial] = useState("");
  const [issuePPECondition, setIssuePPECondition] = useState("سالم و نو");

  // Return modal form
  const [returnCondition, setReturnCondition] = useState("سالم");
  const [returnNotes, setReturnNotes] = useState("");

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchWorkforceStats().catch(() => null),
      fetchOrganizations().catch(() => []),
      fetchWorkplaces().catch(() => []),
      fetchEmployees().catch(() => []),
      fetchCourses().catch(() => []),
      fetchTrainingSessions().catch(() => []),
      fetchCompetencies().catch(() => []),
      fetchEmployeeCompetencies().catch(() => []),
      fetchPermitRequirements().catch(() => []),
      fetchPPEItems().catch(() => []),
      fetchPPEStock().catch(() => []),
      fetchPPEAssignments().catch(() => []),
      fetchContractors().catch(() => []),
      fetchJobPositions().catch(() => []),
      fetchEmployeeJobAssignments().catch(() => []),
      fetchAttendanceRecords({ date: attendanceDate }).catch(() => []),
      fetchAttendanceRoster(attendanceDate).catch(() => null),
    ])
      .then(
        ([
          st,
          orgs,
          wps,
          emps,
          crs,
          sess,
          comps,
          empComps,
          reqs,
          items,
          stocks,
          assigns,
          cntrs,
          jobs,
          jAssigns,
          attRecs,
          roster,
        ]) => {
          setStats(st);
          setOrganizations(orgs);
          setWorkplaces(wps);
          setEmployees(emps);
          setCourses(crs);
          setSessions(sess);
          setCompetencies(comps);
          setEmpCompetencies(empComps);
          setPermitRequirements(reqs);
          setPpeItems(items);
          setPpeStocks(stocks);
          setPpeAssignments(assigns);
          setContractors(cntrs);
          setJobPositions(jobs);
          setJobAssignments(jAssigns);
          setAttendanceRecords(attRecs);
          setAttendanceRoster(roster);
        },
      )
      .catch((err) => {
        setError(err instanceof Error ? err.message : "خطا در بارگذاری داده‌های نیروی انسانی");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedContractorId) {
      fetchContractorDocuments({ contractor: selectedContractorId })
        .then(setContractorDocuments)
        .catch(() => setContractorDocuments([]));
      fetchContractorWorkers({ contractor: selectedContractorId })
        .then(setContractorWorkers)
        .catch(() => setContractorWorkers([]));
    } else {
      setContractorDocuments([]);
      setContractorWorkers([]);
    }
  }, [selectedContractorId]);

  useEffect(() => {
    fetchAttendanceRecords({ date: attendanceDate })
      .then(setAttendanceRecords)
      .catch(() => setAttendanceRecords([]));
    fetchAttendanceRoster(attendanceDate)
      .then(setAttendanceRoster)
      .catch(() => setAttendanceRoster(null));
  }, [attendanceDate]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchTrainingAttendances({ session: selectedSessionId })
        .then(setAttendances)
        .catch(() => setAttendances([]));
    } else {
      setAttendances([]);
    }
  }, [selectedSessionId]);

  const viewEmployeeHistory = (emp: Employee) => {
    setHistoryEmployee(emp);
    Promise.all([
      fetchEmployeeTrainingHistory(emp.id).catch(() => []),
      fetchEmployeeCompetencyHistory(emp.id).catch(() => []),
      fetchEmployeePPEHistory(emp.id).catch(() => []),
    ]).then(([train, comp, ppe]) => {
      setEmpHistoryTraining(train);
      setEmpHistoryComp(comp);
      setEmpHistoryPPE(ppe);
    });
  };

  // Handlers for creating entities
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createEmployee({
        employee_no: empNo,
        first_name: empFirstName,
        last_name: empLastName,
        job_title: empJobTitle,
        workplace: empWorkplace ? Number(empWorkplace) : null,
      });
      setShowEmployeeModal(false);
      setEmpNo("");
      setEmpFirstName("");
      setEmpLastName("");
      setEmpJobTitle("");
      setEmpWorkplace("");
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ثبت کارمند");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createCourse({
        code: courseCode,
        title: courseTitle,
        category: courseCategory,
        duration_minutes: Number(courseDuration),
        delivery_type: courseDelivery,
        is_mandatory: courseMandatory,
        requires_renewal: Boolean(courseValidity),
        validity_months: courseValidity ? Number(courseValidity) : null,
      });
      setShowCourseModal(false);
      setCourseCode("");
      setCourseTitle("");
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در تعریف دوره آموزشی");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createTrainingSession({
        course: Number(sessCourse),
        workplace: sessWorkplace ? Number(sessWorkplace) : null,
        scheduled_on: sessDate,
        trainer_name: sessTrainer,
        capacity: sessCapacity ? Number(sessCapacity) : null,
        status: "scheduled",
      });
      setShowSessionModal(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در برنامه‌ریزی نوبت دوره");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createTrainingAttendance({
        session: selectedSessionId,
        employee: Number(attEmployee),
        attendance_status: attStatus,
        assessment_result: attResult,
        score: attScore ? Number(attScore) : null,
        completed_on: attCompletedOn || null,
      });
      setShowAttendanceModal(false);
      fetchTrainingAttendances({ session: selectedSessionId }).then(setAttendances);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ثبت حضور و نتیجه آزمون");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCompetency = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createCompetency({
        code: compCode,
        name: compName,
        allowed_activities: compActivities,
        validity_months: compValidity ? Number(compValidity) : null,
      });
      setShowCompetencyModal(false);
      setCompCode("");
      setCompName("");
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در تعریف صلاحیت");
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueCompetency = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await issueEmployeeCompetency({
        employee: Number(issueEmp),
        competency: Number(issueComp),
        achieved_on: issueDate,
        expires_on: issueExpires || null,
        certificate_number: issueCertNo,
      });
      setShowIssueCompetencyModal(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در صدور صلاحیت");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createPermitRequirement({
        permit_type: reqPermitType,
        competency: Number(reqCompetency),
      });
      setShowRequirementModal(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ثبت الزام صلاحیت برای مجوز");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequirement = async (id: number) => {
    if (!window.confirm("آیا از حذف این الزام صلاحیت اطمینان دارید؟")) return;
    try {
      await deletePermitRequirement(id);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "خطا در حذف الزام");
    }
  };

  const handleCreatePPEItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createPPEItem({
        code: ppeCode,
        name: ppeName,
        category: ppeCategory,
        replacement_interval_days: ppeInterval ? Number(ppeInterval) : null,
        tracks_serial: ppeSerial,
        is_durable: true,
      });
      setShowPPEItemModal(false);
      setPpeCode("");
      setPpeName("");
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ایجاد قلم PPE");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePPEStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createPPEStock({
        item: Number(stockItem),
        workplace: stockWorkplace ? Number(stockWorkplace) : null,
        location_name: stockLocation,
        quantity_on_hand: Number(stockQuantity),
        quantity_minimum: Number(stockMinimum),
      });
      setShowPPEStockModal(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ثبت موجودی انبار");
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssuePPE = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createPPEAssignment({
        employee: Number(issuePPEEmp),
        item: Number(issuePPEItem),
        stock: Number(issuePPEStock),
        quantity: Number(issuePPEQty),
        serial_number: issuePPESerial,
        condition_on_issue: issuePPECondition,
        issued_on: new Date().toISOString().slice(0, 10),
      });
      setShowPPEIssueModal(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در تحویل PPE");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnPPE = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await returnPPEAssignment(selectedAssignment.id, {
        condition: returnCondition,
        notes: returnNotes,
      });
      setShowReturnModal(false);
      setSelectedAssignment(null);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ثبت برگشت PPE");
    } finally {
      setSubmitting(false);
    }
  };

  // Phase 12 Handlers
  const handleCreateContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createContractor({
        name: contractorName,
        registration_no: contractorRegNo,
        contact_person: contractorContactPerson,
        contact_phone: contractorPhone,
        status: "approved",
      });
      setShowContractorModal(false);
      setContractorName("");
      setContractorRegNo("");
      setContractorContactPerson("");
      setContractorPhone("");
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ثبت شرکت پیمانکاری");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateContractorDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractorId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createContractorDocument({
        contractor: selectedContractorId,
        document_type: docType,
        title: docTitle,
        valid_until: docValidUntil || null,
        status: "submitted",
      });
      setShowContractorDocModal(false);
      setDocTitle("");
      setDocValidUntil("");
      if (selectedContractorId) {
        const docs = await fetchContractorDocuments({ contractor: selectedContractorId });
        setContractorDocuments(docs);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ثبت مدرک پیمانکار");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyDoc = async (docId: number) => {
    try {
      await verifyContractorDocument(docId, {
        status: "verified",
        verification_notes: "مستندات ایمنی و مدارک تکنسین بررسی و مورد تأیید قرار گرفت.",
      });
      if (selectedContractorId) {
        const docs = await fetchContractorDocuments({ contractor: selectedContractorId });
        setContractorDocuments(docs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در تایید مدرک");
    }
  };

  const handleCreateContractorWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractorId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createContractorWorker({
        contractor: selectedContractorId,
        national_id: workerNatId,
        first_name: workerFirstName,
        last_name: workerLastName,
        trade: workerTrade,
        mobile: workerMobile,
      });
      setShowContractorWorkerModal(false);
      setWorkerNatId("");
      setWorkerFirstName("");
      setWorkerLastName("");
      setWorkerTrade("");
      setWorkerMobile("");
      if (selectedContractorId) {
        const workers = await fetchContractorWorkers({ contractor: selectedContractorId });
        setContractorWorkers(workers);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ثبت کارگر پیمانکار");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateJobPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createJobPosition({
        code: jobCode,
        title: jobTitleInput,
        department: jobDept,
        risk_level: jobRisk,
        required_qualifications: jobQuals,
      });
      setShowJobPositionModal(false);
      setJobCode("");
      setJobTitleInput("");
      setJobDept("");
      setJobQuals("");
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ایجاد شناسنامه شغل");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateJobAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmpId || !assignJobId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createEmployeeJobAssignment({
        employee: Number(assignEmpId),
        job_position: Number(assignJobId),
        start_date: assignStartDate,
        is_primary: true,
      });
      setShowJobAssignModal(false);
      setAssignEmpId("");
      setAssignJobId("");
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در انتصاب کارمند به شغل");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateShiftAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createAttendanceRecord({
        workplace: attWorkplaceId ? Number(attWorkplaceId) : null,
        person_type: attType,
        employee: attType === "employee" ? Number(attPersonEmpId) : null,
        contractor_worker: attType === "contractor_worker" ? Number(attPersonWorkerId) : null,
        date: attendanceDate,
        check_in: attCheckIn,
        status: attStatusP12,
      });
      setShowAttendanceModalP12(false);
      fetchAttendanceRecords({ date: attendanceDate }).then(setAttendanceRecords);
      fetchAttendanceRoster(attendanceDate).then(setAttendanceRoster);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطا در ثبت تردد");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchSearch =
      !employeeSearch ||
      emp.employee_no.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.job_title.toLowerCase().includes(employeeSearch.toLowerCase());
    const matchWorkplace =
      !selectedWorkplaceId || emp.workplace === Number(selectedWorkplaceId);
    return matchSearch && matchWorkplace;
  });

  return (
    <div className="workforce-container" dir="rtl" style={{ padding: "1.5rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", margin: 0 }}>
            مدیریت آموزش، صلاحیت کارکنان و تجهیزات حفاظت فردی (PPE)
          </h1>
          <p style={{ color: "#666", margin: "0.25rem 0 0" }}>
            ساماندهی شایستگی‌های حرفه‌ای، سوابق آموزشی و کنترل ایمنی تجهیزات کارگاه
            {organizations.length > 0 && (
              <span style={{ marginRight: "0.5rem", fontSize: "0.85rem", color: "#0056b3" }}>
                ({organizations.map((o) => o.name).join("، ")})
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="button button-outline" onClick={loadData}>
            بروزرسانی داده‌ها
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {/* KPI Stats Cards */}
      {stats && (
        <div
          className="stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div className="stat-card" style={{ borderRight: "4px solid var(--primary)" }}>
            <span style={{ fontSize: "0.85rem" }} className="muted">کل کارکنان / فعال</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.25rem 0" }}>
              {stats.employees_active} <span style={{ fontSize: "0.9rem" }} className="muted">از {stats.employees_total}</span>
            </div>
            <span style={{ fontSize: "0.75rem" }} className="muted">
              {stats.employees_without_account} کارمند بدون حساب سامانه
            </span>
          </div>

          <div className="stat-card" style={{ borderRight: "4px solid var(--success)" }}>
            <span style={{ fontSize: "0.85rem" }} className="muted">صلاحیت‌های معتبر</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.25rem 0", color: "var(--success)" }}>
              {stats.competency_valid}
            </div>
            <span style={{ fontSize: "0.75rem", color: stats.competency_expiring_soon > 0 ? "var(--warning)" : "inherit" }} className="muted">
              {stats.competency_expiring_soon} مورد در آستانه انقضا (۳۰ روز)
            </span>
          </div>

          <div className="stat-card" style={{ borderRight: "4px solid var(--danger)" }}>
            <span style={{ fontSize: "0.85rem" }} className="muted">صلاحیت‌های غیرمعتبر</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.25rem 0", color: "var(--danger)" }}>
              {stats.competency_expired + stats.competency_suspended + stats.competency_revoked}
            </div>
            <span style={{ fontSize: "0.75rem" }} className="muted">
              {stats.competency_expired} منقضی | {stats.competency_suspended} تعلیق | {stats.competency_revoked} لغو
            </span>
          </div>

          <div className="stat-card" style={{ borderRight: "4px solid var(--warning)" }}>
            <span style={{ fontSize: "0.85rem" }} className="muted">تخصیص‌های فعال PPE</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.25rem 0", color: "var(--warning)" }}>
              {stats.ppe_active_assignments}
            </div>
            <span style={{ fontSize: "0.75rem", color: stats.ppe_assignments_overdue > 0 ? "var(--danger)" : "inherit" }} className="muted">
              {stats.ppe_assignments_overdue} موعد گذشته | {stats.ppe_stock_below_minimum} انبار زیر حداقل
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          نمای کلی
        </button>
        <button
          className={`tab-btn ${activeTab === "employees" ? "active" : ""}`}
          onClick={() => setActiveTab("employees")}
        >
          پرسنل و سوابق ({employees.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "training" ? "active" : ""}`}
          onClick={() => setActiveTab("training")}
          style={{
            padding: "0.6rem 1.2rem",
            border: "none",
            background: "none",
            borderBottom: activeTab === "training" ? "3px solid #0056b3" : "none",
            fontWeight: activeTab === "training" ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          آموزش و نوبت‌ها ({courses.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "competencies" ? "active" : ""}`}
          onClick={() => setActiveTab("competencies")}
        >
          صلاحیت‌ها و مجوز کار ({competencies.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "ppe" ? "active" : ""}`}
          onClick={() => setActiveTab("ppe")}
        >
          تجهیزات حفاظت فردی PPE ({ppeItems.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "contractors" ? "active" : ""}`}
          onClick={() => setActiveTab("contractors")}
        >
          پیمانکاران و مدارک ({contractors.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "jobs" ? "active" : ""}`}
          onClick={() => setActiveTab("jobs")}
        >
          شناسنامه مشاغل و انتصاب ({jobPositions.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "attendance" ? "active" : ""}`}
          onClick={() => setActiveTab("attendance")}
        >
          حضور و غیاب شیفت
        </button>
      </div>

      {loading && <p style={{ textAlign: "center", padding: "2rem" }}>در حال بارگذاری اطلاعات...</p>}

      {/* TAB 1: OVERVIEW */}
      {!loading && activeTab === "overview" && (
        <div className="overview-tab">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div className="card" style={{ padding: "1.25rem", border: "1px solid #dee2e6", borderRadius: "8px" }}>
              <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "0.5rem" }}>
                وضعیت سریع الزامات صلاحیت مجوز کار (PTW)
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                سیستم به‌صورت خودکار هنگام بررسی و فعال‌سازی مجوزهای پرخطر، احراز صلاحیت پرسنل را بررسی می‌کند:
              </p>
              <ul style={{ paddingRight: "1.2rem", lineHeight: "1.8" }}>
                {permitRequirements.map((req) => (
                  <li key={req.id}>
                    <strong>{req.permit_type_display}:</strong> نیازمند «{req.competency_detail?.name}»
                  </li>
                ))}
                {permitRequirements.length === 0 && <li style={{ color: "#888" }}>هیچ الزامی تنظیم نشده است.</li>}
              </ul>
              <button
                className="button button-sm button-primary"
                onClick={() => {
                  setActiveTab("competencies");
                  setShowRequirementModal(true);
                }}
              >
                + افزودن الزامات صلاحیت
              </button>
            </div>

            <div className="card" style={{ padding: "1.25rem", border: "1px solid #dee2e6", borderRadius: "8px" }}>
              <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "0.5rem" }}>
                هشدارهای تجهیزات حفاظت فردی (PPE)
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                اقلام نیازمند توجه فوری بر اساس موعد تعویض و حداقل موجودی:
              </p>
              <ul style={{ paddingRight: "1.2rem", lineHeight: "1.8" }}>
                {ppeStocks
                  .filter((s) => s.is_below_minimum)
                  .map((stock) => (
                    <li key={stock.id} style={{ color: "#d9534f" }}>
                      کسری موجودی: {stock.item_name} در {stock.location_name} (موجودی {stock.quantity_on_hand}، حداقل {stock.quantity_minimum})
                    </li>
                  ))}
                {ppeAssignments
                  .filter((a) => a.is_overdue)
                  .map((assign) => (
                    <li key={assign.id} style={{ color: "#d9534f" }}>
                      موعد تعویض گذشته: {assign.item_name} تحویل به {assign.employee_detail?.full_name}
                    </li>
                  ))}
                {ppeStocks.filter((s) => s.is_below_minimum).length === 0 &&
                  ppeAssignments.filter((a) => a.is_overdue).length === 0 && (
                    <li style={{ color: "#28a745" }}>تمامی اقلام PPE در وضعیت پایدار قرار دارند.</li>
                  )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYEES */}
      {!loading && activeTab === "employees" && (
        <div className="employees-tab">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1rem",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", flex: 1 }}>
              <input
                type="text"
                placeholder="جستجو با شماره پرسنلی، نام یا سمت..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                style={{ padding: "0.5rem", width: "300px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
              <select
                value={selectedWorkplaceId}
                onChange={(e) => setSelectedWorkplaceId(e.target.value)}
                style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value="">همه کارگاه‌ها</option>
                {workplaces.map((wp) => (
                  <option key={wp.id} value={wp.id}>
                    {wp.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="button button-primary" onClick={() => setShowEmployeeModal(true)}>
              + ثبت کارمند جدید
            </button>
          </div>

          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f1f3f5", textAlign: "right" }}>
                <th style={{ padding: "0.75rem" }}>شماره پرسنلی</th>
                <th style={{ padding: "0.75rem" }}>نام و نام خانوادگی</th>
                <th style={{ padding: "0.75rem" }}>سمت شغلی</th>
                <th style={{ padding: "0.75rem" }}>محل کارگاه</th>
                <th style={{ padding: "0.75rem" }}>حساب کاربری</th>
                <th style={{ padding: "0.75rem" }}>وضعیت</th>
                <th style={{ padding: "0.75rem" }}>اقدامات</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: "0.75rem" }}>{emp.employee_no}</td>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{emp.full_name}</td>
                  <td style={{ padding: "0.75rem" }}>{emp.job_title || "—"}</td>
                  <td style={{ padding: "0.75rem" }}>{emp.workplace_name || "—"}</td>
                  <td style={{ padding: "0.75rem" }}>
                    {emp.user_detail ? emp.user_detail.username : <span style={{ color: "#888" }}>بدون ورود</span>}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        backgroundColor: emp.is_active ? "#e8f5e9" : "#ffebee",
                        color: emp.is_active ? "#2e7d32" : "#c62828",
                      }}
                    >
                      {emp.is_active ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <button
                      className="button button-sm button-outline"
                      onClick={() => viewEmployeeHistory(emp)}
                    >
                      مشاهده پرونده کامل
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                    هیچ کارمندی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: TRAINING */}
      {!loading && activeTab === "training" && (
        <div className="training-tab">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            {/* Courses Column */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>کاتالوگ دوره‌های آموزشی</h3>
                <button className="button button-sm button-primary" onClick={() => setShowCourseModal(true)}>
                  + تعریف دوره جدید
                </button>
              </div>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f1f3f5", textAlign: "right" }}>
                    <th style={{ padding: "0.5rem" }}>کد</th>
                    <th style={{ padding: "0.5rem" }}>عنوان دوره</th>
                    <th style={{ padding: "0.5rem" }}>مدت (دقیقه)</th>
                    <th style={{ padding: "0.5rem" }}>اعتبار</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                      <td style={{ padding: "0.5rem" }}>{c.code}</td>
                      <td style={{ padding: "0.5rem", fontWeight: "bold" }}>{c.title}</td>
                      <td style={{ padding: "0.5rem" }}>{c.duration_minutes}</td>
                      <td style={{ padding: "0.5rem" }}>{c.validity_months ? `${c.validity_months} ماه` : "دائمی"}</td>
                    </tr>
                  ))}
                  {courses.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "1rem", color: "#888" }}>
                        دوره‌ای ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Sessions Column */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>نوبت‌های برگزاری دوره</h3>
                <button className="button button-sm button-primary" onClick={() => setShowSessionModal(true)}>
                  + برنامه‌ریزی نوبت
                </button>
              </div>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f1f3f5", textAlign: "right" }}>
                    <th style={{ padding: "0.5rem" }}>دوره</th>
                    <th style={{ padding: "0.5rem" }}>تاریخ</th>
                    <th style={{ padding: "0.5rem" }}>مدرس</th>
                    <th style={{ padding: "0.5rem" }}>وضعیت</th>
                    <th style={{ padding: "0.5rem" }}>حاضرین</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedSessionId(s.id)}
                      style={{
                        borderBottom: "1px solid #dee2e6",
                        cursor: "pointer",
                        background: selectedSessionId === s.id ? "#e8f0fe" : "transparent",
                      }}
                    >
                      <td style={{ padding: "0.5rem", fontWeight: "bold" }}>{s.course_detail?.title}</td>
                      <td style={{ padding: "0.5rem" }}>{s.scheduled_on}</td>
                      <td style={{ padding: "0.5rem" }}>{s.trainer_name}</td>
                      <td style={{ padding: "0.5rem" }}>{s.status_display}</td>
                      <td style={{ padding: "0.5rem" }}>{s.attendance_count} نفر</td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "1rem", color: "#888" }}>
                        نوبتی ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendances for selected session */}
          {selectedSessionId && (
            <div style={{ border: "1px solid #dee2e6", borderRadius: "8px", padding: "1rem", background: "#fafafa" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h4 style={{ margin: 0 }}>شرکت‌کنندگان و نتایج ارزیابی نوبت انتخابی</h4>
                <button className="button button-sm button-primary" onClick={() => setShowAttendanceModal(true)}>
                  + ثبت حضور و ارزیابی جدید
                </button>
              </div>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#eee", textAlign: "right" }}>
                    <th style={{ padding: "0.5rem" }}>کارمند</th>
                    <th style={{ padding: "0.5rem" }}>حضور</th>
                    <th style={{ padding: "0.5rem" }}>نتیجه ارزیابی</th>
                    <th style={{ padding: "0.5rem" }}>نمره</th>
                    <th style={{ padding: "0.5rem" }}>تاریخ تکمیل</th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #ddd" }}>
                      <td style={{ padding: "0.5rem", fontWeight: "bold" }}>{a.employee_detail?.full_name}</td>
                      <td style={{ padding: "0.5rem" }}>{a.attendance_status_display}</td>
                      <td style={{ padding: "0.5rem" }}>
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            backgroundColor:
                              a.assessment_result === "passed"
                                ? "#e8f5e9"
                                : a.assessment_result === "failed"
                                  ? "#ffebee"
                                  : "#fff3cd",
                            color:
                              a.assessment_result === "passed"
                                ? "#2e7d32"
                                : a.assessment_result === "failed"
                                  ? "#c62828"
                                  : "#856404",
                          }}
                        >
                          {a.assessment_result_display}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem" }}>{a.score ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{a.completed_on || "—"}</td>
                    </tr>
                  ))}
                  {attendances.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "1rem", color: "#888" }}>
                        هیچ شرکت‌کننده‌ای برای این نوبت ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMPETENCIES */}
      {!loading && activeTab === "competencies" && (
        <div className="competencies-tab">
          {/* Competency Definitions & Issuance */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>صلاحیت‌های تخصصی و سوابق پرسنل</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="button button-sm button-outline" onClick={() => setShowCompetencyModal(true)}>
                + تعریف صلاحیت جدید
              </button>
              <button className="button button-sm button-primary" onClick={() => setShowIssueCompetencyModal(true)}>
                + صدور صلاحیت برای کارمند
              </button>
            </div>
          </div>

          <table className="table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "2rem" }}>
            <thead>
              <tr style={{ background: "#f1f3f5", textAlign: "right" }}>
                <th style={{ padding: "0.75rem" }}>کارمند</th>
                <th style={{ padding: "0.75rem" }}>عنوان صلاحیت</th>
                <th style={{ padding: "0.75rem" }}>شماره گواهی</th>
                <th style={{ padding: "0.75rem" }}>تاریخ احراز</th>
                <th style={{ padding: "0.75rem" }}>تاریخ انقضا</th>
                <th style={{ padding: "0.75rem" }}>وضعیت مؤثر</th>
                <th style={{ padding: "0.75rem" }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {empCompetencies.map((ec) => (
                <tr key={ec.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{ec.employee_detail?.full_name}</td>
                  <td style={{ padding: "0.75rem" }}>{ec.competency_detail?.name}</td>
                  <td style={{ padding: "0.75rem" }}>{ec.certificate_number || "—"}</td>
                  <td style={{ padding: "0.75rem" }}>{ec.achieved_on}</td>
                  <td style={{ padding: "0.75rem" }}>{ec.expires_on || "نامحدود"}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        backgroundColor:
                          ec.effective_status === "valid"
                            ? "#e8f5e9"
                            : ec.effective_status === "expiring_soon"
                              ? "#fff3cd"
                              : "#ffebee",
                        color:
                          ec.effective_status === "valid"
                            ? "#2e7d32"
                            : ec.effective_status === "expiring_soon"
                              ? "#856404"
                              : "#c62828",
                      }}
                    >
                      {ec.effective_status_display}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    {ec.is_valid && (
                      <button
                        className="button button-sm button-danger"
                        onClick={async () => {
                          const reason = prompt("علت تعلیق یا لغو صلاحیت را وارد کنید:");
                          if (reason) {
                            await updateEmployeeCompetencyStatus(ec.id, {
                              status: "suspended",
                              reason,
                            });
                            loadData();
                          }
                        }}
                      >
                        تعلیق
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {empCompetencies.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                    هیچ سابقه‌ای از صلاحیت کارکنان ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Permit Competency Requirements */}
          <div style={{ borderTop: "2px solid #eee", paddingTop: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>الزامات صلاحیت مجوزهای کار پرخطر (PTW)</h3>
              <button className="button button-sm button-primary" onClick={() => setShowRequirementModal(true)}>
                + افزودن الزام جدید
              </button>
            </div>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f1f3f5", textAlign: "right" }}>
                  <th style={{ padding: "0.75rem" }}>نوع مجوز کار</th>
                  <th style={{ padding: "0.75rem" }}>صلاحیت الزامی</th>
                  <th style={{ padding: "0.75rem" }}>کد صلاحیت</th>
                  <th style={{ padding: "0.75rem" }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {permitRequirements.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                    <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{r.permit_type_display}</td>
                    <td style={{ padding: "0.75rem" }}>{r.competency_detail?.name}</td>
                    <td style={{ padding: "0.75rem" }}>{r.competency_detail?.code}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <button
                        className="button button-sm button-danger"
                        onClick={() => handleDeleteRequirement(r.id)}
                      >
                        حذف الزام
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PPE */}
      {!loading && activeTab === "ppe" && (
        <div className="ppe-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>کاتالوگ تجهیزات، موجودی انبار و تحویل به کارکنان</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="button button-sm button-outline" onClick={() => setShowPPEItemModal(true)}>
                + قلم جدید PPE
              </button>
              <button className="button button-sm button-outline" onClick={() => setShowPPEStockModal(true)}>
                + شارژ انبار
              </button>
              <button className="button button-sm button-primary" onClick={() => setShowPPEIssueModal(true)}>
                + تحویل تجهیز به کارمند
              </button>
            </div>
          </div>

          {/* Assignments Table */}
          <h4 style={{ margin: "1.5rem 0 0.5rem" }}>سوابق تحویل تجهیزات حفاظت فردی</h4>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "2rem" }}>
            <thead>
              <tr style={{ background: "#f1f3f5", textAlign: "right" }}>
                <th style={{ padding: "0.75rem" }}>کارمند</th>
                <th style={{ padding: "0.75rem" }}>تجهیز PPE</th>
                <th style={{ padding: "0.75rem" }}>تعداد</th>
                <th style={{ padding: "0.75rem" }}>شماره سریال</th>
                <th style={{ padding: "0.75rem" }}>تاریخ تحویل</th>
                <th style={{ padding: "0.75rem" }}>موعد تعویض</th>
                <th style={{ padding: "0.75rem" }}>وضعیت</th>
                <th style={{ padding: "0.75rem" }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {ppeAssignments.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{a.employee_detail?.full_name}</td>
                  <td style={{ padding: "0.75rem" }}>{a.item_name}</td>
                  <td style={{ padding: "0.75rem" }}>{a.quantity}</td>
                  <td style={{ padding: "0.75rem" }}>{a.serial_number || "—"}</td>
                  <td style={{ padding: "0.75rem" }}>{a.issued_on}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{ color: a.is_overdue ? "#dc3545" : a.is_due_soon ? "#fd7e14" : "inherit" }}>
                      {a.replacement_due_on || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        backgroundColor: a.status === "active" ? "#e8f5e9" : "#f1f3f5",
                        color: a.status === "active" ? "#2e7d32" : "#495057",
                      }}
                    >
                      {a.status_display}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    {a.status === "active" && (
                      <button
                        className="button button-sm button-outline"
                        onClick={() => {
                          setSelectedAssignment(a);
                          setShowReturnModal(true);
                        }}
                      >
                        ثبت برگشت
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {ppeAssignments.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                    هیچ تخصیصی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* PPE Stock Table */}
          <h4 style={{ margin: "1.5rem 0 0.5rem" }}>موجودی انبارهای کارگاه</h4>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f1f3f5", textAlign: "right" }}>
                <th style={{ padding: "0.5rem" }}>قلم PPE</th>
                <th style={{ padding: "0.5rem" }}>کارگاه / محل انبار</th>
                <th style={{ padding: "0.5rem" }}>موجودی موجود</th>
                <th style={{ padding: "0.5rem" }}>حداقل مجاز</th>
                <th style={{ padding: "0.5rem" }}>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {ppeStocks.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: "0.5rem", fontWeight: "bold" }}>{s.item_name}</td>
                  <td style={{ padding: "0.5rem" }}>{s.location_name} ({s.workplace_name || "مرکزی"})</td>
                  <td style={{ padding: "0.5rem" }}>{s.quantity_on_hand}</td>
                  <td style={{ padding: "0.5rem" }}>{s.quantity_minimum}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {s.is_below_minimum ? (
                      <span style={{ color: "#dc3545", fontWeight: "bold" }}>کسری موجودی</span>
                    ) : (
                      <span style={{ color: "#28a745" }}>کافی</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 6: CONTRACTORS */}
      {!loading && activeTab === "contractors" && (
        <div className="contractors-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>مدیریت شرکت‌های پیمانکاری و صلاحیت ایمنی</h2>
            <button className="button button-primary" onClick={() => setShowContractorModal(true)}>
              ثبت پیمانکار جدید
            </button>
          </div>

          <table className="table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
            <thead>
              <tr style={{ textAlign: "right", borderBottom: "2px solid #dee2e6" }}>
                <th style={{ padding: "0.75rem" }}>نام شرکت پیمانکار</th>
                <th style={{ padding: "0.75rem" }}>شماره ثبت</th>
                <th style={{ padding: "0.75rem" }}>مسئول رابط / تماس</th>
                <th style={{ padding: "0.75rem" }}>مدت قرارداد</th>
                <th style={{ padding: "0.75rem" }}>رتبه ایمنی HSE</th>
                <th style={{ padding: "0.75rem" }}>وضعیت</th>
                <th style={{ padding: "0.75rem" }}>مدارک / نیروها</th>
                <th style={{ padding: "0.75rem" }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {contractors.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{c.name}</td>
                  <td style={{ padding: "0.75rem" }}>{c.registration_no || "—"}</td>
                  <td style={{ padding: "0.75rem" }}>{c.contact_person} {c.contact_phone ? `(${c.contact_phone})` : ""}</td>
                  <td style={{ padding: "0.75rem" }}>{c.contract_start || "—"} تا {c.contract_end || "—"}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                        backgroundColor: Number(c.safety_score) >= 80 ? "#e8f5e9" : "#ffebee",
                        color: Number(c.safety_score) >= 80 ? "#2e7d32" : "#c62828",
                      }}
                    >
                      {c.safety_score} / 100
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        backgroundColor: c.status === "approved" ? "#e8f5e9" : "#fff3e0",
                        color: c.status === "approved" ? "#2e7d32" : "#e65100",
                      }}
                    >
                      {c.status_display}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    {c.documents_count ?? 0} مدرک | {c.workers_count ?? 0} نیرو
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <button
                      className="button button-sm button-outline"
                      onClick={() => setSelectedContractorId(c.id === selectedContractorId ? null : c.id)}
                    >
                      {selectedContractorId === c.id ? "بستن پرونده" : "مشاهده پرونده و مدارک"}
                    </button>
                  </td>
                </tr>
              ))}
              {contractors.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                    هیچ شرکت پیمانکاری ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Selected Contractor Dossier */}
          {selectedContractorId && (
            <div className="card" style={{ padding: "1.25rem", border: "1px solid #dee2e6", borderRadius: "8px", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>
                  پرونده مدارک و پرسنل: {contractors.find((c) => c.id === selectedContractorId)?.name}
                </h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="button button-sm button-primary" onClick={() => setShowContractorDocModal(true)}>
                    ثبت مدرک جدید
                  </button>
                  <button className="button button-sm button-secondary" onClick={() => setShowContractorWorkerModal(true)}>
                    ثبت کارگر جدید
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                {/* Documents Table */}
                <div>
                  <h4 style={{ margin: "0 0 0.5rem" }}>مدارک و مجوزهای ایمنی (HSE Plan، بیمه، استاندارد)</h4>
                  <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "right", borderBottom: "1px solid #dee2e6" }}>
                        <th style={{ padding: "0.5rem" }}>نوع مدرک</th>
                        <th style={{ padding: "0.5rem" }}>عنوان</th>
                        <th style={{ padding: "0.5rem" }}>اعتبار</th>
                        <th style={{ padding: "0.5rem" }}>وضعیت</th>
                        <th style={{ padding: "0.5rem" }}>عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractorDocuments.map((doc) => (
                        <tr key={doc.id} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "0.5rem" }}>{doc.document_type_display}</td>
                          <td style={{ padding: "0.5rem", fontWeight: "bold" }}>{doc.title}</td>
                          <td style={{ padding: "0.5rem" }}>
                            <span style={{ color: doc.is_expired ? "#dc3545" : "inherit" }}>
                              {doc.valid_until || "نامحدود"}
                            </span>
                          </td>
                          <td style={{ padding: "0.5rem" }}>
                            <span
                              style={{
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                backgroundColor: doc.status === "verified" ? "#e8f5e9" : "#fff3e0",
                                color: doc.status === "verified" ? "#2e7d32" : "#e65100",
                              }}
                            >
                              {doc.status_display}
                            </span>
                          </td>
                          <td style={{ padding: "0.5rem" }}>
                            {doc.status !== "verified" && (
                              <button
                                className="button button-sm button-outline"
                                onClick={() => handleVerifyDoc(doc.id)}
                              >
                                تایید مدرک
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {contractorDocuments.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "1rem", color: "#888" }}>
                            مدرکی ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Workers Table */}
                <div>
                  <h4 style={{ margin: "0 0 0.5rem" }}>کارگران و تکنسین‌های تحت پوشش</h4>
                  <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "right", borderBottom: "1px solid #dee2e6" }}>
                        <th style={{ padding: "0.5rem" }}>کد ملی</th>
                        <th style={{ padding: "0.5rem" }}>نام و نام خانوادگی</th>
                        <th style={{ padding: "0.5rem" }}>رسته شغلی</th>
                        <th style={{ padding: "0.5rem" }}>تماس</th>
                        <th style={{ padding: "0.5rem" }}>وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractorWorkers.map((w) => (
                        <tr key={w.id} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "0.5rem" }}>{w.national_id}</td>
                          <td style={{ padding: "0.5rem", fontWeight: "bold" }}>{w.full_name}</td>
                          <td style={{ padding: "0.5rem" }}>{w.trade || "عمومی"}</td>
                          <td style={{ padding: "0.5rem" }}>{w.mobile || "—"}</td>
                          <td style={{ padding: "0.5rem" }}>
                            <span style={{ color: w.is_active ? "#28a745" : "#6c757d" }}>
                              {w.is_active ? "فعال" : "غیرفعال"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {contractorWorkers.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "1rem", color: "#888" }}>
                            کارگری برای این پیمانکار ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: JOBS & ASSIGNMENTS */}
      {!loading && activeTab === "jobs" && (
        <div className="jobs-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>شناسنامه مشاغل سازمانی و ماتریس شایستگی</h2>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="button button-primary" onClick={() => setShowJobPositionModal(true)}>
                تعریف شغل جدید
              </button>
              <button className="button button-secondary" onClick={() => setShowJobAssignModal(true)}>
                انتصاب پرسنل به شغل
              </button>
            </div>
          </div>

          <table className="table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "2rem" }}>
            <thead>
              <tr style={{ textAlign: "right", borderBottom: "2px solid #dee2e6" }}>
                <th style={{ padding: "0.75rem" }}>کد شغل</th>
                <th style={{ padding: "0.75rem" }}>عنوان سمت</th>
                <th style={{ padding: "0.75rem" }}>دپارتمان / واحد</th>
                <th style={{ padding: "0.75rem" }}>سطح ریسک شغلی</th>
                <th style={{ padding: "0.75rem" }}>صلاحیت‌های الزامی</th>
                <th style={{ padding: "0.75rem" }}>شرایط احراز</th>
                <th style={{ padding: "0.75rem" }}>انتصابات فعال</th>
              </tr>
            </thead>
            <tbody>
              {jobPositions.map((jp) => (
                <tr key={jp.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{jp.code}</td>
                  <td style={{ padding: "0.75rem" }}>{jp.title}</td>
                  <td style={{ padding: "0.75rem" }}>{jp.department || "—"}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        backgroundColor:
                          jp.risk_level === "critical"
                            ? "#ffebee"
                            : jp.risk_level === "high"
                            ? "#fff3e0"
                            : jp.risk_level === "medium"
                            ? "#e3f2fd"
                            : "#e8f5e9",
                        color:
                          jp.risk_level === "critical"
                            ? "#c62828"
                            : jp.risk_level === "high"
                            ? "#e65100"
                            : jp.risk_level === "medium"
                            ? "#1565c0"
                            : "#2e7d32",
                      }}
                    >
                      {jp.risk_level_display}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    {jp.required_competency_details && jp.required_competency_details.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {jp.required_competency_details.map((c) => (
                          <span
                            key={c.id}
                            style={{
                              padding: "0.15rem 0.4rem",
                              backgroundColor: "#f1f3f5",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                            }}
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#555" }}>
                    {jp.required_qualifications || "—"}
                  </td>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>
                    {jp.assignments_count ?? 0} نفر
                  </td>
                </tr>
              ))}
              {jobPositions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                    هیچ شناسنامه شغلی تعریف نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h3 style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>ماتریس سوابق انتصاب کارکنان به مشاغل</h3>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "right", borderBottom: "2px solid #dee2e6" }}>
                <th style={{ padding: "0.75rem" }}>نام کارمند</th>
                <th style={{ padding: "0.75rem" }}>عنوان سمت شغلی</th>
                <th style={{ padding: "0.75rem" }}>کد شغل</th>
                <th style={{ padding: "0.75rem" }}>تاریخ شروع</th>
                <th style={{ padding: "0.75rem" }}>تاریخ پایان</th>
                <th style={{ padding: "0.75rem" }}>نوع سمت</th>
              </tr>
            </thead>
            <tbody>
              {jobAssignments.map((ja) => (
                <tr key={ja.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{ja.employee_name}</td>
                  <td style={{ padding: "0.75rem" }}>{ja.job_position_title}</td>
                  <td style={{ padding: "0.75rem" }}>{ja.job_position_code}</td>
                  <td style={{ padding: "0.75rem" }}>{ja.start_date}</td>
                  <td style={{ padding: "0.75rem" }}>
                    {ja.end_date ? (
                      ja.end_date
                    ) : (
                      <span style={{ color: "#28a745", fontWeight: "bold" }}>جاری / فعال</span>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    {ja.is_primary ? "سمت اصلی" : "سمت فرعی/پروژه‌ای"}
                  </td>
                </tr>
              ))}
              {jobAssignments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                    هیچ سابقه‌ای از انتصاب مشاغل ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 8: ATTENDANCE & SHIFT ROSTER */}
      {!loading && activeTab === "attendance" && (
        <div className="attendance-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", margin: 0 }}>پایش بلادرنگ حضور و غیاب و تردد شیفت کاری</h2>
              <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>
                ردیابی حضور کارکنان سازمانی و نیروهای پیمانکاری بر اساس گیت‌های هوشمند و دستگاه‌های بیومتریک
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: "bold" }}>تاریخ شیفت:</label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                style={{ padding: "0.4rem 0.6rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
              <button className="button button-primary" onClick={() => setShowAttendanceModalP12(true)}>
                ثبت ورود / تردد شیفت
              </button>
            </div>
          </div>

          {/* Roster KPI Summary */}
          <div
            className="stats-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div className="stat-card" style={{ borderRight: "4px solid #1976d2", padding: "1rem", background: "#fff", borderRadius: "8px", border: "1px solid #dee2e6" }}>
              <span style={{ fontSize: "0.85rem", color: "#666" }}>کل تردد ثبت‌شده شیفت</span>
              <div style={{ fontSize: "1.75rem", fontWeight: "bold", margin: "0.25rem 0", color: "#1976d2" }}>
                {attendanceRoster?.total_recorded ?? attendanceRecords.length}
              </div>
              <span style={{ fontSize: "0.8rem", color: "#666" }}>
                {attendanceRoster?.employee_count ?? 0} رسمی | {attendanceRoster?.contractor_worker_count ?? 0} پیمانکار
              </span>
            </div>

            <div className="stat-card" style={{ borderRight: "4px solid #2e7d32", padding: "1rem", background: "#fff", borderRadius: "8px", border: "1px solid #dee2e6" }}>
              <span style={{ fontSize: "0.85rem", color: "#666" }}>حاضرین به‌موقع</span>
              <div style={{ fontSize: "1.75rem", fontWeight: "bold", margin: "0.25rem 0", color: "#2e7d32" }}>
                {attendanceRoster?.present_count ?? 0}
              </div>
              <span style={{ fontSize: "0.8rem", color: "#2e7d32" }}>ورود بدون تأخیر</span>
            </div>

            <div className="stat-card" style={{ borderRight: "4px solid #f57c00", padding: "1rem", background: "#fff", borderRadius: "8px", border: "1px solid #dee2e6" }}>
              <span style={{ fontSize: "0.85rem", color: "#666" }}>تأخیر در ورود</span>
              <div style={{ fontSize: "1.75rem", fontWeight: "bold", margin: "0.25rem 0", color: "#f57c00" }}>
                {attendanceRoster?.late_count ?? 0}
              </div>
              <span style={{ fontSize: "0.8rem", color: "#f57c00" }}>نیاز به بررسی سرپرست</span>
            </div>

            <div className="stat-card" style={{ borderRight: "4px solid #c62828", padding: "1rem", background: "#fff", borderRadius: "8px", border: "1px solid #dee2e6" }}>
              <span style={{ fontSize: "0.85rem", color: "#666" }}>غایبین شیفت</span>
              <div style={{ fontSize: "1.75rem", fontWeight: "bold", margin: "0.25rem 0", color: "#c62828" }}>
                {attendanceRoster?.absent_count ?? 0}
              </div>
              <span style={{ fontSize: "0.8rem", color: "#c62828" }}>عدم ثبت تردد</span>
            </div>
          </div>

          {/* Attendance Table */}
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "right", borderBottom: "2px solid #dee2e6" }}>
                <th style={{ padding: "0.75rem" }}>نام و نام خانوادگی</th>
                <th style={{ padding: "0.75rem" }}>نوع نیرو</th>
                <th style={{ padding: "0.75rem" }}>کارگاه / محل استقرار</th>
                <th style={{ padding: "0.75rem" }}>زمان ورود (Check-In)</th>
                <th style={{ padding: "0.75rem" }}>زمان خروج (Check-Out)</th>
                <th style={{ padding: "0.75rem" }}>درگاه ورود</th>
                <th style={{ padding: "0.75rem" }}>وضعیت حضور</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.map((att) => (
                <tr key={att.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{att.person_name}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        backgroundColor: att.person_type === "employee" ? "#e3f2fd" : "#ede7f6",
                        color: att.person_type === "employee" ? "#1565c0" : "#4527a0",
                      }}
                    >
                      {att.person_type_display}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem" }}>{att.workplace_name || "کارگاه اصلی"}</td>
                  <td style={{ padding: "0.75rem" }}>{att.check_in?.replace("T", " ").slice(0, 16)}</td>
                  <td style={{ padding: "0.75rem" }}>{att.check_out ? att.check_out.replace("T", " ").slice(0, 16) : "—"}</td>
                  <td style={{ padding: "0.75rem" }}>{att.entry_source_display}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        backgroundColor:
                          att.status === "present"
                            ? "#e8f5e9"
                            : att.status === "late"
                            ? "#fff3e0"
                            : "#ffebee",
                        color:
                          att.status === "present"
                            ? "#2e7d32"
                            : att.status === "late"
                            ? "#e65100"
                            : "#c62828",
                      }}
                    >
                      {att.status_display}
                    </span>
                  </td>
                </tr>
              ))}
              {attendanceRecords.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                    هیچ ثبتی برای تاریخ {attendanceDate} وجود ندارد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Employee History */}
      {historyEmployee && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "800px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #dee2e6", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>
                پرونده پرسنلی: {historyEmployee.full_name} ({historyEmployee.employee_no})
              </h3>
              <button className="button button-sm button-outline" onClick={() => setHistoryEmployee(null)}>
                بستن
              </button>
            </div>

            <h4>سوابق آموزشی</h4>
            <ul style={{ lineHeight: "1.8", paddingRight: "1.2rem" }}>
              {empHistoryTraining.map((t) => (
                <li key={t.id}>
                  {t.session_detail?.course_title} ({t.completed_on}): <strong>{t.assessment_result_display}</strong> (نمره: {t.score ?? "—"})
                </li>
              ))}
              {empHistoryTraining.length === 0 && <li style={{ color: "#888" }}>هیچ دوره آموزشی ثبت نشده است.</li>}
            </ul>

            <h4>صلاحیت‌های احراز‌شده</h4>
            <ul style={{ lineHeight: "1.8", paddingRight: "1.2rem" }}>
              {empHistoryComp.map((c) => (
                <li key={c.id}>
                  {c.competency_detail?.name} — اعتبار: {c.expires_on || "نامحدود"} (<strong>{c.effective_status_display}</strong>)
                </li>
              ))}
              {empHistoryComp.length === 0 && <li style={{ color: "#888" }}>هیچ صلاحیتی صادر نشده است.</li>}
            </ul>

            <h4>تجهیزات حفاظت فردی PPE</h4>
            <ul style={{ lineHeight: "1.8", paddingRight: "1.2rem" }}>
              {empHistoryPPE.map((p) => (
                <li key={p.id}>
                  {p.item_name} ({p.quantity} عدد) — تحویل {p.issued_on} (<strong>{p.status_display}</strong>)
                </li>
              ))}
              {empHistoryPPE.length === 0 && <li style={{ color: "#888" }}>هیچ تجهیز PPE تخصیص داده نشده است.</li>}
            </ul>
          </div>
        </div>
      )}

      {/* MODAL: Create Employee */}
      {showEmployeeModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>ثبت کارمند جدید</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateEmployee}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>شماره پرسنلی *</label>
                <input required type="text" value={empNo} onChange={(e) => setEmpNo(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>نام *</label>
                  <input required type="text" value={empFirstName} onChange={(e) => setEmpFirstName(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>نام خانوادگی *</label>
                  <input required type="text" value={empLastName} onChange={(e) => setEmpLastName(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>سمت شغلی</label>
                <input type="text" value={empJobTitle} onChange={(e) => setEmpJobTitle(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>کارگاه / واحد</label>
                <select value={empWorkplace} onChange={(e) => setEmpWorkplace(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب کارگاه (اختیاری)</option>
                  {workplaces.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowEmployeeModal(false)}>
                  انصراف
                </button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ذخیره کارمند"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Course */}
      {showCourseModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>تعریف دوره آموزشی جدید</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateCourse}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کد دوره *</label>
                <input required type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>عنوان دوره *</label>
                <input required type="text" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>دسته‌بندی</label>
                <input type="text" value={courseCategory} onChange={(e) => setCourseCategory(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>شیوه برگزاری</label>
                  <select value={courseDelivery} onChange={(e) => setCourseDelivery(e.target.value as "in_person" | "practical" | "online" | "blended")} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                    <option value="in_person">حضوری</option>
                    <option value="practical">عملی / کارگاهی</option>
                    <option value="online">آنلاین</option>
                    <option value="blended">ترکیبی</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
                    <input type="checkbox" checked={courseMandatory} onChange={(e) => setCourseMandatory(e.target.checked)} />
                    دوره الزامی
                  </label>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>مدت دوره (دقیقه)</label>
                  <input type="number" value={courseDuration} onChange={(e) => setCourseDuration(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>مدت اعتبار (ماه)</label>
                  <input type="number" value={courseValidity} onChange={(e) => setCourseValidity(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowCourseModal(false)}>
                  انصراف
                </button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ذخیره دوره"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Return PPE */}
      {showReturnModal && selectedAssignment && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>ثبت برگشت تجهیز PPE به انبار</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleReturnPPE}>
              <p>
                <strong>تجهیز:</strong> {selectedAssignment.item_name} ({selectedAssignment.quantity} عدد)
              </p>
              <p>
                <strong>کارمند:</strong> {selectedAssignment.employee_detail?.full_name}
              </p>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>وضعیت فیزیکی هنگام برگشت *</label>
                <input required type="text" value={returnCondition} onChange={(e) => setReturnCondition(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>توضیحات</label>
                <textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowReturnModal(false)}>
                  انصراف
                </button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "تأیید و برگشت به انبار"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Issue PPE */}
      {showPPEIssueModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>تحویل تجهیز حفاظت فردی به کارمند</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleIssuePPE}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کارمند دریافت‌کننده *</label>
                <select required value={issuePPEEmp} onChange={(e) => setIssuePPEEmp(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب کارمند...</option>
                  {employees.filter((e) => e.is_active).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_no})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>قلم PPE *</label>
                <select required value={issuePPEItem} onChange={(e) => setIssuePPEItem(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب قلم PPE...</option>
                  {ppeItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>انبار مبدأ (کاهش اتمیک موجودی) *</label>
                <select required value={issuePPEStock} onChange={(e) => setIssuePPEStock(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب انبار...</option>
                  {ppeStocks.filter((s) => !issuePPEItem || s.item === Number(issuePPEItem)).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.location_name} (موجودی فعلی: {s.quantity_on_hand})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>تعداد *</label>
                  <input required type="number" min="1" value={issuePPEQty} onChange={(e) => setIssuePPEQty(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>شماره سریال (در صورت وجود)</label>
                  <input type="text" value={issuePPESerial} onChange={(e) => setIssuePPESerial(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>وضعیت فیزیکی هنگام تحویل</label>
                <input type="text" value={issuePPECondition} onChange={(e) => setIssuePPECondition(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowPPEIssueModal(false)}>
                  انصراف
                </button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "تأیید و تحویل"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Issue Competency */}
      {showIssueCompetencyModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>صدور صلاحیت برای کارمند</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleIssueCompetency}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کارمند *</label>
                <select required value={issueEmp} onChange={(e) => setIssueEmp(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب کارمند...</option>
                  {employees.filter((e) => e.is_active).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_no})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>عنوان صلاحیت *</label>
                <select required value={issueComp} onChange={(e) => setIssueComp(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب صلاحیت...</option>
                  {competencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>تاریخ احراز *</label>
                  <input required type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>تاریخ انقضا</label>
                  <input type="date" value={issueExpires} onChange={(e) => setIssueExpires(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>شماره گواهینامه / مدرک</label>
                <input type="text" value={issueCertNo} onChange={(e) => setIssueCertNo(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowIssueCompetencyModal(false)}>
                  انصراف
                </button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "صدور صلاحیت"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Permit Competency Requirement */}
      {showRequirementModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>افزودن الزام صلاحیت به نوع مجوز کار</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateRequirement}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>نوع مجوز کار (PTW) *</label>
                <select required value={reqPermitType} onChange={(e) => setReqPermitType(e.target.value as PermitType)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="hot_work">کار گرم و جوشکاری</option>
                  <option value="confined_space">فضای بسته و مخازن</option>
                  <option value="work_at_height">کار در ارتفاع و داربست‌بندی</option>
                  <option value="electrical_isolation">قطع برق و جداسازی انرژی (LOTO)</option>
                  <option value="excavation">حفاری و گودبرداری</option>
                  <option value="general_high_risk">عملیات عمومی پرخطر</option>
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>صلاحیت الزامی *</label>
                <select required value={reqCompetency} onChange={(e) => setReqCompetency(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب صلاحیت...</option>
                  {competencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowRequirementModal(false)}>
                  انصراف
                </button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ذخیره الزام"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: Create Session */}
      {showSessionModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>برنامه‌ریزی نوبت دوره آموزشی</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateSession}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>دوره آموزشی *</label>
                <select required value={sessCourse} onChange={(e) => setSessCourse(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب دوره...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کارگاه / محل برگزاری</label>
                <select value={sessWorkplace} onChange={(e) => setSessWorkplace(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب محل (اختیاری)...</option>
                  {workplaces.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>تاریخ برگزاری *</label>
                  <input required type="date" value={sessDate} onChange={(e) => setSessDate(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>ظرفیت</label>
                  <input type="number" value={sessCapacity} onChange={(e) => setSessCapacity(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>نام مدرس / مربی</label>
                <input type="text" value={sessTrainer} onChange={(e) => setSessTrainer(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowSessionModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ثبت نوبت"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Attendance */}
      {showAttendanceModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>ثبت حضور و نتیجه شرکت‌کننده</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateAttendance}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کارمند شرکت‌کننده *</label>
                <select required value={attEmployee} onChange={(e) => setAttEmployee(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب کارمند...</option>
                  {employees.filter((e) => e.is_active).map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>وضعیت حضور</label>
                  <select value={attStatus} onChange={(e) => setAttStatus(e.target.value as "registered" | "attended" | "absent" | "cancelled")} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                    <option value="registered">ثبت‌نام شده</option>
                    <option value="attended">حاضر در دوره</option>
                    <option value="absent">غایب</option>
                    <option value="cancelled">انصراف / لغو</option>
                  </select>
                </div>
                <div>
                  <label>نتیجه ارزیابی</label>
                  <select value={attResult} onChange={(e) => setAttResult(e.target.value as "pending" | "passed" | "failed")} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                    <option value="pending">در انتظار آزمون</option>
                    <option value="passed">قبول</option>
                    <option value="failed">مردود</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                <div>
                  <label>نمره آزمون (از ۱۰۰)</label>
                  <input type="number" min="0" max="100" value={attScore} onChange={(e) => setAttScore(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>تاریخ تکمیل / آزمون</label>
                  <input type="date" value={attCompletedOn} onChange={(e) => setAttCompletedOn(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowAttendanceModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ثبت نتیجه"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Competency */}
      {showCompetencyModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>تعریف عنوان صلاحیت جدید</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateCompetency}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کد صلاحیت *</label>
                <input required type="text" value={compCode} onChange={(e) => setCompCode(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>نام صلاحیت *</label>
                <input required type="text" value={compName} onChange={(e) => setCompName(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>فعالیت‌های مجاز</label>
                <textarea value={compActivities} onChange={(e) => setCompActivities(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>مدت اعتبار (ماه)</label>
                <input type="number" value={compValidity} onChange={(e) => setCompValidity(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowCompetencyModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ذخیره صلاحیت"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create PPE Item */}
      {showPPEItemModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>تعریف قلم جدید PPE</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreatePPEItem}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کد قلم *</label>
                <input required type="text" value={ppeCode} onChange={(e) => setPpeCode(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>نام تجهیز *</label>
                <input required type="text" value={ppeName} onChange={(e) => setPpeName(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>دسته‌بندی</label>
                <input type="text" value={ppeCategory} onChange={(e) => setPpeCategory(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                <div>
                  <label>دوره تعویض (روز)</label>
                  <input type="number" value={ppeInterval} onChange={(e) => setPpeInterval(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
                    <input type="checkbox" checked={ppeSerial} onChange={(e) => setPpeSerial(e.target.checked)} />
                    ردیابی با شماره سریال
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowPPEItemModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ذخیره قلم"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create PPE Stock */}
      {showPPEStockModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>ثبت موجودی انبار PPE</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreatePPEStock}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>قلم PPE *</label>
                <select required value={stockItem} onChange={(e) => setStockItem(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب قلم...</option>
                  {ppeItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کارگاه / محل انبار</label>
                <select value={stockWorkplace} onChange={(e) => setStockWorkplace(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب کارگاه (اختیاری)...</option>
                  {workplaces.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>نام انبار / موقعیت فیزیکی *</label>
                <input required type="text" value={stockLocation} onChange={(e) => setStockLocation(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                <div>
                  <label>موجودی فعلی *</label>
                  <input required type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>حداقل آستانه هشدار *</label>
                  <input required type="number" min="0" value={stockMinimum} onChange={(e) => setStockMinimum(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowPPEStockModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ذخیره موجودی"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Contractor */}
      {showContractorModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>ثبت شرکت پیمانکاری جدید</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateContractor}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>نام شرکت پیمانکار *</label>
                <input required type="text" value={contractorName} onChange={(e) => setContractorName(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>شماره ثبت / شناسه ملی</label>
                <input type="text" value={contractorRegNo} onChange={(e) => setContractorRegNo(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                <div>
                  <label>فرد رابط / نماینده</label>
                  <input type="text" value={contractorContactPerson} onChange={(e) => setContractorContactPerson(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>تلفن تماس</label>
                  <input type="text" value={contractorPhone} onChange={(e) => setContractorPhone(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowContractorModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ذخیره پیمانکار"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Contractor Document */}
      {showContractorDocModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>ثبت مدرک / مجوز ایمنی پیمانکار</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateContractorDoc}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>نوع مدرک *</label>
                <select value={docType} onChange={(e: any) => setDocType(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="hse_plan">طرح سلامت و ایمنی (HSE Plan)</option>
                  <option value="insurance_policy">بیمه‌نامه مسئولیت مدنی</option>
                  <option value="qualification_cert">گواهینامه صلاحیت ایمنی پیمانکاری</option>
                  <option value="iso_cert">گواهینامه‌های ایزو/استاندارد</option>
                  <option value="other">سایر مدارک</option>
                </select>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>عنوان مدرک *</label>
                <input required type="text" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>تاریخ انقضا / پایان اعتبار</label>
                <input type="date" value={docValidUntil} onChange={(e) => setDocValidUntil(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowContractorDocModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "بارگذاری مدرک"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Contractor Worker */}
      {showContractorWorkerModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>ثبت مشخصات کارگر پیمانکار</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateContractorWorker}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کد ملی *</label>
                <input required type="text" value={workerNatId} onChange={(e) => setWorkerNatId(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>نام *</label>
                  <input required type="text" value={workerFirstName} onChange={(e) => setWorkerFirstName(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>نام خانوادگی *</label>
                  <input required type="text" value={workerLastName} onChange={(e) => setWorkerLastName(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                <div>
                  <label>رسته شغلی (جوشکار، داربست‌بند، ...)</label>
                  <input type="text" value={workerTrade} onChange={(e) => setWorkerTrade(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>تلفن همراه</label>
                  <input type="text" value={workerMobile} onChange={(e) => setWorkerMobile(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowContractorWorkerModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ذخیره کارگر"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Job Position */}
      {showJobPositionModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>تعریف شناسنامه شغل سازمانی</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateJobPosition}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>کد شغل *</label>
                  <input required type="text" value={jobCode} onChange={(e) => setJobCode(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>عنوان سمت *</label>
                  <input required type="text" value={jobTitleInput} onChange={(e) => setJobTitleInput(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>واحد / دپارتمان</label>
                  <input type="text" value={jobDept} onChange={(e) => setJobDept(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
                </div>
                <div>
                  <label>سطح ریسک شغلی *</label>
                  <select value={jobRisk} onChange={(e: any) => setJobRisk(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                    <option value="low">پایین (Low)</option>
                    <option value="medium">متوسط (Medium)</option>
                    <option value="high">بالا (High)</option>
                    <option value="critical">بحرانی (Critical)</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>شرایط احراز و سوابق مورد نیاز</label>
                <textarea value={jobQuals} onChange={(e) => setJobQuals(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowJobPositionModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ذخیره شغل"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Job Assignment */}
      {showJobAssignModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>انتصاب کارمند به سمت شغلی</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateJobAssign}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>کارمند *</label>
                <select required value={assignEmpId} onChange={(e) => setAssignEmpId(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب کارمند...</option>
                  {employees.filter((e) => e.is_active).map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>شغل سازمانی *</label>
                <select required value={assignJobId} onChange={(e) => setAssignJobId(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="">انتخاب شغل...</option>
                  {jobPositions.filter((j) => j.is_active).map((j) => (
                    <option key={j.id} value={j.id}>{j.title} ({j.code})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>تاریخ انتصاب / شروع *</label>
                <input required type="date" value={assignStartDate} onChange={(e) => setAssignStartDate(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowJobAssignModal(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "تأیید انتصاب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Attendance */}
      {showAttendanceModalP12 && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ marginTop: 0 }}>ثبت تردد و ورود به شیفت کاری</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleCreateShiftAttendance}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label>نوع نیرو *</label>
                <select value={attType} onChange={(e: any) => setAttType(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                  <option value="employee">پرسنل رسمی / سازمانی</option>
                  <option value="contractor_worker">نیروی پیمانکار</option>
                </select>
              </div>

              {attType === "employee" ? (
                <div style={{ marginBottom: "0.75rem" }}>
                  <label>انتخاب کارمند *</label>
                  <select required value={attPersonEmpId} onChange={(e) => setAttPersonEmpId(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                    <option value="">انتخاب کارمند...</option>
                    {employees.filter((e) => e.is_active).map((e) => (
                      <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ marginBottom: "0.75rem" }}>
                  <label>انتخاب کارگر پیمانکار *</label>
                  <select required value={attPersonWorkerId} onChange={(e) => setAttPersonWorkerId(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                    <option value="">انتخاب کارگر...</option>
                    {contractorWorkers.map((w) => (
                      <option key={w.id} value={w.id}>{w.full_name} ({w.national_id})</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <label>کارگاه / واحد</label>
                  <select value={attWorkplaceId} onChange={(e) => setAttWorkplaceId(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                    <option value="">کارگاه اصلی...</option>
                    {workplaces.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>وضعیت حضور *</label>
                  <select value={attStatusP12} onChange={(e: any) => setAttStatusP12(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}>
                    <option value="present">حاضر (به‌موقع)</option>
                    <option value="late">تأخیر در ورود</option>
                    <option value="absent">غایب</option>
                    <option value="early_departure">خروج زودهنگام</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label>زمان ثبت تردد *</label>
                <input required type="datetime-local" value={attCheckIn} onChange={(e) => setAttCheckIn(e.target.value)} style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="button button-outline" onClick={() => setShowAttendanceModalP12(false)}>انصراف</button>
                <button type="submit" disabled={submitting} className="button button-primary">
                  {submitting ? "در حال ثبت..." : "ثبت تردد"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
