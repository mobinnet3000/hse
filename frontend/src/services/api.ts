const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  global_role: "platform_admin" | "standard";
};

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie("csrftoken");
  if (existing) return existing;
  const response = await fetch(`${API_BASE_URL}/auth/csrf/`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return readCookie("csrftoken");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    const token = await ensureCsrfToken();
    if (token) headers.set("X-CSRFToken", token);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload?.error ?? {
      code: "request_failed",
      message: `خطای سرور (${response.status})`,
    }) as ApiError;
    if (response.status === 403 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    throw new ApiRequestError(response.status, error);
  }

  return payload as T;
}

export type HealthResponse = { status: string; database: string };

export function fetchHealth(signal?: AbortSignal) {
  return request<HealthResponse>("/health/", { signal });
}

export function login(username: string, password: string) {
  return request<User>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return request<void>("/auth/logout/", { method: "POST" });
}

export function fetchCurrentUser(signal?: AbortSignal) {
  return request<User>("/auth/me/", { signal });
}

export type Organization = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
};

export type Workplace = {
  id: number;
  organization: number;
  name: string;
  code: string;
};

export type MembershipRole =
  | "org_admin"
  | "hse_manager"
  | "hse_inspector"
  | "workshop_supervisor"
  | "action_owner"
  | "executive_viewer"
  | "read_only_auditor";

export type Membership = {
  id: number;
  user: number;
  username: string;
  full_name?: string;
  organization: number;
  role: MembershipRole;
  role_display: string;
  is_active: boolean;
};

export type Hazard = {
  id: number;
  organization: number;
  workplace: number | null;
  title: string;
  description: string;
  category: string;
  category_display: string;
  source: string;
  causes: string;
  consequences: string;
  exposed_persons: string;
  existing_controls: string;
  status: string;
  status_display: string;
};

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskAssessment = {
  id: number;
  hazard: number;
  organization: number;
  likelihood: number;
  severity: number;
  score: number;
  level: RiskLevel;
  level_display: string;
  proposed_controls: string;
  implemented_controls: string;
  status: string;
  status_display: string;
  assessed_at: string | null;
};

export const HAZARD_CATEGORIES = [
  ["physical", "فیزیکی"],
  ["chemical", "شیمیایی"],
  ["biological", "زیستی"],
  ["ergonomic", "ارگونومیک"],
  ["psychosocial", "روانی-اجتماعی"],
  ["safety", "ایمنی"],
  ["environmental", "محیطی"],
  ["other", "سایر"],
] as const;

function query(params: Record<string, string | number>) {
  return new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();
}

export function fetchOrganizations(signal?: AbortSignal) {
  return request<Organization[]>("/organizations/", { signal });
}

export function fetchWorkplaces(organizationId?: number, signal?: AbortSignal) {
  const queryStr = organizationId ? `?${query({ organization: organizationId })}` : "";
  return request<Workplace[]>(`/workplaces/${queryStr}`, {
    signal,
  });
}

export function fetchMemberships(organizationId: number, signal?: AbortSignal) {
  return request<Membership[]>(`/organizations/${organizationId}/memberships/`, { signal });
}

export function fetchHazards(
  organizationId: number,
  filters: Record<string, string> = {},
  signal?: AbortSignal,
) {
  return request<Hazard[]>(`/risks/?${query({ organization: organizationId, ...filters })}`, {
    signal,
  });
}

export function createHazard(organizationId: number, data: Record<string, unknown>) {
  return request<Hazard>("/risks/", {
    method: "POST",
    body: JSON.stringify({ ...data, organization: organizationId }),
  });
}

export function updateHazard(id: number, data: Record<string, unknown>) {
  return request<Hazard>(`/risks/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchAssessments(
  organizationId: number,
  filters: Record<string, string> = {},
  signal?: AbortSignal,
) {
  return request<RiskAssessment[]>(
    `/risks/assessments/?${query({ organization: organizationId, ...filters })}`,
    { signal },
  );
}

export function createAssessment(organizationId: number, data: Record<string, unknown>) {
  return request<RiskAssessment>("/risks/assessments/", {
    method: "POST",
    body: JSON.stringify({ ...data, organization: organizationId }),
  });
}

export function updateAssessment(id: number, data: Record<string, unknown>) {
  return request<RiskAssessment>(`/risks/assessments/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// -----------------------------------------
// Phase 11: BowTie, Barriers & HCMS
// -----------------------------------------

export type BowTieThreat = {
  id: number;
  diagram: number;
  title: string;
  category: string;
  order: number;
};

export type BowTieConsequence = {
  id: number;
  diagram: number;
  title: string;
  severity_level: "low" | "medium" | "high" | "critical";
  severity_level_display: string;
  order: number;
};

export type BarrierAssessment = {
  id: number;
  barrier: number;
  effectiveness: "effective" | "partially_effective" | "ineffective" | "not_tested";
  effectiveness_display: string;
  assessed_by: number | null;
  assessed_by_name?: string;
  assessment_date: string;
  evidence_reference: string;
  notes: string;
  created_at: string;
};

export type Barrier = {
  id: number;
  diagram: number;
  threat: number | null;
  consequence: number | null;
  barrier_type: "preventive" | "mitigative";
  barrier_type_display: string;
  nature: "engineering" | "administrative" | "human_action" | "physical";
  nature_display: string;
  name: string;
  description: string;
  is_critical: boolean;
  owner: number | null;
  owner_name?: string;
  current_effectiveness: "effective" | "partially_effective" | "ineffective" | "not_tested";
  current_effectiveness_display: string;
  status: "operational" | "impaired" | "decommissioned";
  status_display: string;
  assessments: BarrierAssessment[];
  created_at: string;
  updated_at: string;
};

export type BowTieDiagram = {
  id: number;
  organization: number;
  hazard: number;
  hazard_title: string;
  top_event: string;
  description: string;
  status: "draft" | "active" | "under_review" | "archived";
  status_display: string;
  owner: number | null;
  owner_name?: string;
  target_review_date: string | null;
  threats: BowTieThreat[];
  consequences: BowTieConsequence[];
  barriers: Barrier[];
  created_at: string;
  updated_at: string;
};

export type HCMSControl = {
  id: number;
  organization: number;
  hazard: number;
  hazard_title: string;
  barrier: number | null;
  control_title: string;
  hierarchy_of_control: "elimination" | "substitution" | "engineering" | "administrative" | "ppe";
  hierarchy_display: string;
  implementation_status: "implemented" | "in_progress" | "planned" | "failed";
  status_display: string;
  review_frequency_days: number;
  last_reviewed_at: string | null;
  next_review_due: string | null;
  responsible_owner: number | null;
  owner_name?: string;
  initial_risk_score: number;
  residual_likelihood: number;
  residual_severity: number;
  residual_score: number;
  residual_level: "low" | "medium" | "high" | "critical";
  residual_level_display: string;
  reassessment_trigger: string;
  created_at: string;
  updated_at: string;
};

export type RiskTemplate = {
  id: number;
  organization: number | null;
  title: string;
  industry: string;
  category: string;
  category_display: string;
  standard_code: string;
  version: string;
  typical_threats: string;
  typical_consequences: string;
  recommended_barriers: string;
};

export type RiskDashboardSummary = {
  total_hazards: number;
  reassessment_needed_count: number;
  total_bowties: number;
  total_barriers: number;
  critical_barriers: number;
  failed_critical_barriers: number;
  total_controls: number;
  pending_review_controls: number;
};

export function fetchBowTieDiagrams(
  organizationId: number,
  filters: Record<string, string> = {},
  signal?: AbortSignal,
) {
  return request<BowTieDiagram[]>(
    `/risks/bowtie/?${query({ organization: organizationId, ...filters })}`,
    { signal },
  );
}

export function fetchBowTieDiagram(id: number, signal?: AbortSignal) {
  return request<BowTieDiagram>(`/risks/bowtie/${id}/`, { signal });
}

export function createBowTieDiagram(organizationId: number, data: Record<string, unknown>) {
  return request<BowTieDiagram>("/risks/bowtie/", {
    method: "POST",
    body: JSON.stringify({ ...data, organization: organizationId }),
  });
}

export function createBowTieThreat(diagramId: number, data: Record<string, unknown>) {
  return request<BowTieThreat>(`/risks/bowtie/${diagramId}/threats/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createBowTieConsequence(diagramId: number, data: Record<string, unknown>) {
  return request<BowTieConsequence>(`/risks/bowtie/${diagramId}/consequences/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createBarrier(data: Record<string, unknown>) {
  return request<Barrier>("/risks/barriers/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function assessBarrier(barrierId: number, data: Record<string, unknown>) {
  return request<BarrierAssessment>(`/risks/barriers/${barrierId}/assess/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchHCMSControls(
  organizationId: number,
  filters: Record<string, string> = {},
  signal?: AbortSignal,
) {
  return request<HCMSControl[]>(
    `/risks/hcms/?${query({ organization: organizationId, ...filters })}`,
    { signal },
  );
}

export function createHCMSControl(organizationId: number, data: Record<string, unknown>) {
  return request<HCMSControl>("/risks/hcms/", {
    method: "POST",
    body: JSON.stringify({ ...data, organization: organizationId }),
  });
}

export function updateHCMSControl(id: number, data: Record<string, unknown>) {
  return request<HCMSControl>(`/risks/hcms/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchRiskTemplates(category?: string, signal?: AbortSignal) {
  return request<RiskTemplate[]>(
    `/risks/templates/${category ? `?category=${category}` : ""}`,
    { signal },
  );
}

export function fetchRiskDashboardSummary(organizationId: number, signal?: AbortSignal) {
  return request<RiskDashboardSummary>(
    `/risks/dashboard/summary/?organization=${organizationId}`,
    { signal },
  );
}

export type ChecklistItem = {
  id: number;
  checklist: number;
  order: number;
  text: string;
  is_required: boolean;
};
export type Checklist = {
  id: number;
  organization: number;
  title: string;
  description: string;
  is_active: boolean;
  items: ChecklistItem[];
};
export type InspectionResult = '' | 'conform' | 'nonconform' | 'not_applicable';
export type InspectionResponse = {
  id: number;
  inspection: number;
  item: number | null;
  item_text: string;
  is_required: boolean;
  order: number;
  result: InspectionResult;
  result_display: string;
  notes: string;
};
export type Inspection = {
  id: number;
  organization: number;
  workplace: number | null;
  checklist: number;
  checklist_title: string;
  title: string;
  inspector: number | null;
  scheduled_at: string | null;
  performed_at: string | null;
  completed_at: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  status_display: string;
  notes: string;
  total_responses: number;
  answered_responses: number;
  responses?: InspectionResponse[];
};
export type NonConformity = {
  id: number;
  organization: number;
  workplace: number | null;
  inspection: number | null;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  severity_display: string;
  source: string;
  source_display: string;
  responsible: number | null;
  status: 'open' | 'in_progress' | 'ready_for_review' | 'closed';
  status_display: string;
  evidence_text: string;
  corrective_action_count: number;
};
export type CorrectiveAction = {
  id: number;
  organization: number;
  non_conformity: number;
  description: string;
  responsible: number | null;
  due_date: string | null;
  status: 'open' | 'in_progress' | 'pending_verification' | 'completed';
  status_display: string;
  result_text: string;
  effectiveness_verified: boolean;
};

export function fetchChecklists(organizationId: number, signal?: AbortSignal) {
  return request<Checklist[]>(`/checklists/?${query({ organization: organizationId })}`, { signal });
}
export function createChecklist(organizationId: number, data: Record<string, unknown>) {
  return request<Checklist>('/checklists/', {
    method: 'POST',
    body: JSON.stringify({ ...data, organization: organizationId }),
  });
}
export function addChecklistItem(checklistId: number, data: Record<string, unknown>) {
  return request<ChecklistItem>(`/checklists/${checklistId}/items/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
export function fetchInspections(organizationId: number, signal?: AbortSignal) {
  return request<Inspection[]>(`/inspections/?${query({ organization: organizationId })}`, { signal });
}
export function fetchInspection(id: number, signal?: AbortSignal) {
  return request<Inspection>(`/inspections/${id}/`, { signal });
}
export function createInspection(organizationId: number, data: Record<string, unknown>) {
  return request<Inspection>('/inspections/', {
    method: 'POST',
    body: JSON.stringify({ ...data, organization: organizationId }),
  });
}
export function updateInspection(id: number, data: Record<string, unknown>) {
  return request<Inspection>(`/inspections/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
export function completeInspection(id: number) {
  return request<Inspection>(`/inspections/${id}/complete/`, { method: 'POST' });
}
export function updateInspectionResponse(id: number, data: Record<string, unknown>) {
  return request<InspectionResponse>(`/inspections/responses/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
export function fetchNonConformities(organizationId: number, signal?: AbortSignal) {
  return request<NonConformity[]>(`/non-conformities/?${query({ organization: organizationId })}`, { signal });
}
export function createNonConformity(organizationId: number, data: Record<string, unknown>) {
  return request<NonConformity>('/non-conformities/', {
    method: 'POST',
    body: JSON.stringify({ ...data, organization: organizationId }),
  });
}
export function updateNonConformity(id: number, data: Record<string, unknown>) {
  return request<NonConformity>(`/non-conformities/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
export function closeNonConformity(id: number) {
  return request<NonConformity>(`/non-conformities/${id}/close/`, { method: 'POST' });
}
export function fetchCorrectiveActions(organizationId: number, signal?: AbortSignal) {
  return request<CorrectiveAction[]>(`/corrective-actions/?${query({ organization: organizationId })}`, { signal });
}
export function createCorrectiveAction(organizationId: number, data: Record<string, unknown>) {
  return request<CorrectiveAction>('/corrective-actions/', {
    method: 'POST',
    body: JSON.stringify({ ...data, organization: organizationId }),
  });
}
export function updateCorrectiveAction(id: number, data: Record<string, unknown>) {
  return request<CorrectiveAction>(`/corrective-actions/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
export function verifyCorrectiveAction(id: number) {
  return request<CorrectiveAction>(`/corrective-actions/${id}/verify/`, { method: 'POST' });
}

export type DashboardMetrics = {
  inspections: { draft: number; in_progress: number; completed: number; cancelled: number; total: number };
  risks: { low: number; medium: number; high: number; critical: number; total: number; hazards_count: number };
  non_conformities: { open: number; in_progress: number; ready_for_review: number; closed: number; total: number };
  corrective_actions: { open: number; completed: number; overdue: number; total: number };
  urgent_deadlines: {
    inspections: Array<{ id: number; title: string; scheduled_at: string | null; status: string; is_overdue?: boolean }>;
    actions: Array<{ id: number; description: string; due_date: string | null; status: string; is_overdue?: boolean }>;
  };

};

export type NotificationItem = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type AuditEventItem = {
  id: number;
  organization: number | null;
  organization_name: string | null;
  actor: number | null;
  actor_username: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
};

export function fetchDashboardMetrics(organizationId?: number, signal?: AbortSignal) {
  const url = organizationId ? `/dashboard/metrics/?organization=${organizationId}` : "/dashboard/metrics/";
  return request<DashboardMetrics>(url, { signal });
}

export function fetchNotifications(signal?: AbortSignal) {
  return request<NotificationItem[]>("/notifications/", { signal });
}

export function markNotificationRead(id: number) {
  return request<NotificationItem>(`/notifications/${id}/read/`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return request<{ status: string }>("/notifications/read-all/", { method: "POST" });
}

export function fetchAuditEvents(organizationId?: number, signal?: AbortSignal) {
  const url = organizationId ? `/audit-logs/?organization=${organizationId}` : "/audit-logs/";
  return request<AuditEventItem[]>(url, { signal });
}

export function getReportExportUrl(reportType: string, organizationId?: number, extraParams: Record<string, string> = {}) {
  const params = new URLSearchParams(extraParams);
  if (organizationId) params.set("organization", String(organizationId));
  const queryStr = params.toString();
  return `${import.meta.env.VITE_API_BASE_URL ?? "/api/v1"}/reports/export/${reportType}/${queryStr ? `?${queryStr}` : ""}`;
}

// -----------------------------------------
// Phase 6: Knowledge Base & AI Assistant
// -----------------------------------------

export type KnowledgeSource = {
  id: number;
  organization: number | null;
  organization_name: string | null;
  title: string;
  code: string;
  category: "regulation" | "standard" | "law" | "internal_procedure" | "guideline";
  category_display: string;
  issuing_authority: string;
  effective_date: string | null;
  version: string;
  status: "active" | "under_revision" | "superseded";
  status_display: string;
  is_verified: boolean;
  summary: string;
  content: string;
  tags: string;
  created_by: number | null;
  creator_name: string | null;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
};

export type KnowledgeMeta = {
  categories: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
};

export type AiStatus = {
  provider: string;
  is_live_configured: boolean;
  active_engine: string;
  engine_label: string;
  verified_regulations_count: number;
  supported_features: string[];
  disclaimer: string;
};

export type GroundedSourceRef = {
  id: number;
  code: string;
  title: string;
  category: string;
  issuing_authority?: string;
  summary?: string;
};

export type AiSuggestedHazard = {
  title: string;
  category: string;
  suggested_likelihood: number;
  suggested_severity: number;
  causes: string;
  consequences: string;
  existing_controls_hint: string;
  regulation_reference: string;
};

export type AiWorkplaceAnalysis = {
  is_ai_generated: boolean;
  engine: string;
  grounded_sources: GroundedSourceRef[];
  disclaimer: string;
  hazards: AiSuggestedHazard[];
};

export type AiChecklistItem = {
  order: number;
  text: string;
  is_required: boolean;
  citation?: string;
};

export type AiChecklistSuggestion = {
  is_ai_generated: boolean;
  engine: string;
  suggested_title: string;
  suggested_description: string;
  items: AiChecklistItem[];
  grounded_sources: GroundedSourceRef[];
  disclaimer: string;
};

export type HierarchyControlTier = {
  tier: number;
  level: "elimination" | "substitution" | "engineering_controls" | "administrative_controls" | "ppe";
  label: string;
  priority: string;
  recommendation: string;
};

export type AiHierarchyControls = {
  is_ai_generated: boolean;
  hazard_title: string;
  hierarchy: HierarchyControlTier[];
  grounded_sources: GroundedSourceRef[];
  standard_reference: string;
  disclaimer: string;
};

export function fetchKnowledgeSources(
  params?: { category?: string; status?: string; organization?: string; search?: string },
  signal?: AbortSignal
) {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.status) q.set("status", params.status);
  if (params?.organization) q.set("organization", params.organization);
  if (params?.search) q.set("search", params.search);
  const qs = q.toString();
  return request<KnowledgeSource[]>(`/knowledge-base/${qs ? `?${qs}` : ""}`, { signal });
}

export function fetchKnowledgeMeta(signal?: AbortSignal) {
  return request<KnowledgeMeta>("/knowledge-base/meta/", { signal });
}

export function createKnowledgeSource(data: Partial<KnowledgeSource>) {
  return request<KnowledgeSource>("/knowledge-base/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateKnowledgeSource(id: number, data: Partial<KnowledgeSource>) {
  return request<KnowledgeSource>(`/knowledge-base/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteKnowledgeSource(id: number) {
  return request<void>(`/knowledge-base/${id}/`, {
    method: "DELETE",
  });
}

export function fetchAiStatus(organizationId?: number, signal?: AbortSignal) {
  const url = organizationId ? `/ai/status/?organization_id=${organizationId}` : "/ai/status/";
  return request<AiStatus>(url, { signal });
}

export function analyzeWorkplaceWithAi(data: {
  organization_id: number;
  workplace_id?: number | null;
  activity_description: string;
  equipment?: string;
  materials?: string;
}) {
  return request<AiWorkplaceAnalysis>("/ai/analyze-workplace/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function suggestChecklistWithAi(data: {
  organization_id: number;
  focus_area: string;
  title_hint?: string;
}) {
  return request<AiChecklistSuggestion>("/ai/suggest-checklist/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function suggestControlsWithAi(data: {
  organization_id: number;
  hazard_title: string;
  category?: string;
  description?: string;
}) {
  return request<AiHierarchyControls>("/ai/suggest-controls/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function applyAiHazard(data: {
  organization_id: number;
  workplace_id?: number | null;
  title: string;
  category: string;
  causes?: string;
  consequences?: string;
  existing_controls?: string;
}) {
  return request<Hazard>("/ai/apply-hazard/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function applyAiChecklist(data: {
  organization_id: number;
  title: string;
  description?: string;
  items: { order: number; text: string; is_required: boolean }[];
}) {
  return request<Checklist>("/ai/apply-checklist/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ==========================================
// Incidents & Near-Misses (Phase 07)
// ==========================================

export type IncidentType = "incident" | "near_miss" | "unsafe_act" | "unsafe_condition";
export type IncidentSeverity = "minor" | "moderate" | "major" | "critical";
export type IncidentStatus =
  | "reported"
  | "under_review"
  | "under_investigation"
  | "action_required"
  | "awaiting_verification"
  | "closed"
  | "reopened";

export type IncidentAttachment = {
  id: number;
  incident: number;
  title: string;
  attachment_type: string;
  file_url: string;
  description: string;
  uploaded_by?: number | null;
  uploaded_by_name?: string | null;
  uploaded_at: string;
};

export type IncidentListItem = {
  id: number;
  organization: number;
  organization_name: string;
  workplace?: number | null;
  workplace_name?: string | null;
  title: string;
  incident_type: IncidentType;
  incident_type_display: string;
  severity: IncidentSeverity;
  severity_display: string;
  status: IncidentStatus;
  status_display: string;
  occurred_at: string;
  reported_by?: number | null;
  reported_by_name?: string | null;
  assigned_investigator?: number | null;
  assigned_investigator_name?: string | null;
  injury_count: number;
  lost_time_days: number;
  capa_count: number;
  is_synthetic: boolean;
  created_at: string;
};

export type IncidentDetail = IncidentListItem & {
  location_details: string;
  description: string;
  immediate_actions_taken: string;
  environmental_impact: string;
  property_damage_cost: string | number | null;
  root_cause: string;
  contributing_factors: string;
  investigation_completed_at?: string | null;
  review_notes: string;
  closure_notes: string;
  reopen_reason: string;
  related_hazard?: number | null;
  related_hazard_title?: string | null;
  related_corrective_actions: CorrectiveAction[];
  attachments: IncidentAttachment[];
  can_review: boolean;
  can_investigate: boolean;
  can_close: boolean;
  updated_at: string;
  closed_at?: string | null;
};

export type IncidentSummaryStats = {
  total_incidents: number;
  near_miss_count: number;
  under_investigation_count: number;
  closed_count: number;
  total_lost_time_days: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
};

export type CreateIncidentPayload = {
  organization: number;
  workplace?: number | null;
  title: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  occurred_at: string;
  location_details?: string;
  description: string;
  immediate_actions_taken?: string;
  injury_count?: number;
  lost_time_days?: number;
  environmental_impact?: string;
  property_damage_cost?: number | null;
  related_hazard?: number | null;
  is_synthetic?: boolean;
};

export function fetchIncidents(
  params?: {
    organization?: string | number;
    workplace?: string | number;
    status?: string;
    severity?: string;
    incident_type?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
  },
  signal?: AbortSignal
) {
  const q = new URLSearchParams();
  if (params?.organization) q.set("organization", String(params.organization));
  if (params?.workplace) q.set("workplace", String(params.workplace));
  if (params?.status) q.set("status", params.status);
  if (params?.severity) q.set("severity", params.severity);
  if (params?.incident_type) q.set("incident_type", params.incident_type);
  if (params?.search) q.set("search", params.search);
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  const qs = q.toString();
  return request<IncidentListItem[]>(`/incidents/${qs ? `?${qs}` : ""}`, { signal });
}

export function fetchIncidentDetail(id: number, signal?: AbortSignal) {
  return request<IncidentDetail>(`/incidents/${id}/`, { signal });
}

export function createIncident(data: CreateIncidentPayload) {
  return request<IncidentDetail>("/incidents/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function reviewIncident(
  id: number,
  data: {
    status: "under_review" | "under_investigation" | "closed";
    assigned_investigator_id?: number | null;
    review_notes?: string;
  }
) {
  return request<IncidentDetail>(`/incidents/${id}/review/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function investigateIncident(
  id: number,
  data: {
    root_cause: string;
    contributing_factors?: string;
    immediate_actions_taken?: string;
  }
) {
  return request<IncidentDetail>(`/incidents/${id}/investigate/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function linkIncidentCapa(id: number, correctiveActionId: number) {
  return request<IncidentDetail>(`/incidents/${id}/link-capa/`, {
    method: "POST",
    body: JSON.stringify({ corrective_action_id: correctiveActionId }),
  });
}

export function closeIncident(id: number, data: { closure_notes: string }) {
  return request<IncidentDetail>(`/incidents/${id}/close/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function reopenIncident(id: number, data: { reopen_reason: string }) {
  return request<IncidentDetail>(`/incidents/${id}/reopen/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchIncidentStats(organizationId?: number, signal?: AbortSignal) {
  const url = organizationId ? `/incidents/summary-stats/?organization=${organizationId}` : "/incidents/summary-stats/";
  return request<IncidentSummaryStats>(url, { signal });
}

// =========================================================
// Permit to Work (PTW) & Shift Handover APIs
// =========================================================

export type PermitType =
  | "hot_work"
  | "work_at_height"
  | "confined_space"
  | "electrical_isolation"
  | "excavation"
  | "general_high_risk";

export type PermitStatus =
  | "requested"
  | "under_review"
  | "approved"
  | "active"
  | "suspended"
  | "completed"
  | "closed"
  | "rejected"
  | "cancelled"
  | "expired";

export interface PermitListItem {
  id: number;
  organization: number;
  organization_name?: string;
  workplace?: number | null;
  workplace_name?: string | null;
  reference_code: string;
  permit_type: PermitType;
  permit_type_display: string;
  title: string;
  status: PermitStatus;
  status_display: string;
  is_expired?: boolean;
  valid_from: string;
  valid_until: string;
  actual_start?: string | null;
  actual_completion?: string | null;
  requester: number;
  requester_name: string;
  approver?: number | null;
  approver_name?: string | null;
  gas_testing_required: boolean;
  isolation_loto_required: boolean;
  controls_verified: boolean;
  is_synthetic: boolean;
  created_at: string;
}

export interface PermitDetail extends PermitListItem {
  description: string;
  work_area: string;
  equipment_involved: string;
  assigned_workers: string;
  responsible_supervisor?: number | null;
  responsible_supervisor_name?: string | null;
  precautions_taken: string;
  required_ppe: string;
  gas_testing_results: string;
  isolation_loto_details: string;
  controls_verified_by?: number | null;
  controls_verified_by_name?: string | null;
  controls_verified_at?: string | null;
  review_notes: string;
  rejection_reason: string;
  suspension_reason: string;
  closure_summary: string;
  closed_by?: number | null;
  closed_by_name?: string | null;
  closed_at?: string | null;
  related_hazards: Hazard[];
  assigned_employees?: number[];
  assigned_employee_details?: Array<{
    id: number;
    employee_no: string;
    full_name: string;
    job_title: string;
    is_active: boolean;
  }>;
  competency_validation?: PermitCompetencyValidation;
  attachments: Array<{
    id: number;
    title: string;
    attachment_type: string;
    file_url: string;
    description: string;
    uploaded_at: string;
  }>;
  can_approve: boolean;
  can_control: boolean;
  can_cancel: boolean;
  updated_at: string;
}

export interface PermitSummaryStats {
  total_permits: number;
  active_count: number;
  suspended_count: number;
  requested_count: number;
  approved_count: number;
  closed_count: number;
  expired_count: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
}

export type ShiftType = "morning" | "evening" | "night";
export type ShiftHandoverStatus = "submitted" | "acknowledged";

export interface ShiftHandoverItem {
  id: number;
  organization: number;
  organization_name?: string;
  workplace: number;
  workplace_name?: string;
  shift_date: string;
  shift_type: ShiftType;
  shift_type_display: string;
  status: ShiftHandoverStatus;
  status_display: string;
  outgoing_supervisor: number;
  outgoing_supervisor_name?: string;
  incoming_supervisor?: number | null;
  incoming_supervisor_name?: string | null;
  handover_notes: string;
  safety_concerns: string;
  equipment_status: string;
  outstanding_actions_summary: string;
  unresolved_hazards_summary: string;
  active_permits: Array<{
    id: number;
    reference_code: string;
    title: string;
    status: string;
  }>;
  acknowledged_by?: number | null;
  acknowledged_by_name?: string | null;
  acknowledged_at?: string | null;
  acknowledgement_notes: string;
  can_acknowledge: boolean;
  is_synthetic: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftSafetySummary {
  active_permits_count: number;
  active_permits: Array<{ id: number; code: string; title: string; type: string; status: string }>;
  unresolved_hazards_count: number;
  unresolved_hazards: Array<{ id: number; title: string; category: string }>;
  open_capas_count: number;
  open_capas: Array<{ id: number; desc: string; due_date: string | null; status: string }>;
  recent_incidents_count: number;
  recent_incidents: Array<{ id: number; title: string; severity: string; type: string }>;
}

export function fetchPermits(params?: Record<string, string | number>, signal?: AbortSignal) {
  const query = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  return request<PermitListItem[]>(`/permits/${query}`, { signal });
}

export function fetchPermitDetail(id: number, signal?: AbortSignal) {
  return request<PermitDetail>(`/permits/${id}/`, { signal });
}

export function createPermit(data: Record<string, any>) {
  return request<PermitDetail>("/permits/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function reviewPermit(
  id: number,
  data: { status: "under_review" | "approved" | "rejected"; review_notes?: string }
) {
  return request<PermitDetail>(`/permits/${id}/review/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function approvePermit(id: number, data?: { notes?: string }) {
  return request<PermitDetail>(`/permits/${id}/approve/`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
}

export function activatePermit(
  id: number,
  data: { gas_testing_results?: string; isolation_loto_details?: string }
) {
  return request<PermitDetail>(`/permits/${id}/activate/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function suspendPermit(id: number, data: { reason: string }) {
  return request<PermitDetail>(`/permits/${id}/suspend/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function resumePermit(id: number) {
  return request<PermitDetail>(`/permits/${id}/resume/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function completePermit(id: number) {
  return request<PermitDetail>(`/permits/${id}/complete/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function closePermit(id: number, data: { closure_summary: string }) {
  return request<PermitDetail>(`/permits/${id}/close/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function rejectPermit(id: number, data: { reason: string }) {
  return request<PermitDetail>(`/permits/${id}/reject/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cancelPermit(id: number, data?: { reason?: string }) {
  return request<PermitDetail>(`/permits/${id}/cancel/`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
}

export function fetchPermitStats(organizationId?: number, signal?: AbortSignal) {
  const url = organizationId ? `/permits/stats/?organization=${organizationId}` : "/permits/stats/";
  return request<PermitSummaryStats>(url, { signal });
}

export function fetchShiftHandovers(params?: Record<string, string | number>, signal?: AbortSignal) {
  const query = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  return request<ShiftHandoverItem[]>(`/permits/handovers/${query}`, { signal });
}

export function fetchShiftHandoverDetail(id: number, signal?: AbortSignal) {
  return request<ShiftHandoverItem>(`/permits/handovers/${id}/`, { signal });
}

export function createShiftHandover(data: Record<string, any>) {
  return request<ShiftHandoverItem>("/permits/handovers/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function acknowledgeShiftHandover(id: number, data?: { acknowledgement_notes?: string }) {
  return request<ShiftHandoverItem>(`/permits/handovers/${id}/acknowledge/`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
}

export function fetchShiftSafetySummary(
  organizationId: number,
  workplaceId?: number,
  signal?: AbortSignal
) {
  const wpParam = workplaceId ? `&workplace=${workplaceId}` : "";
  return request<ShiftSafetySummary>(
    `/permits/handovers/safety-summary/?organization=${organizationId}${wpParam}`,
    { signal }
  );
}



// ---------------------------------------------------------------------------
// Phase 09 — Assets, preventive maintenance and calibration
// ---------------------------------------------------------------------------

export type EquipmentCategory =
  | "fire_extinguisher"
  | "ppe"
  | "gas_detection"
  | "electrical"
  | "rescue"
  | "lifting"
  | "other";

export type EquipmentStatus =
  | "ready"
  | "under_maintenance"
  | "out_of_service"
  | "retired";

export type CalibrationStatus =
  | "not_required"
  | "missing"
  | "valid"
  | "due_soon"
  | "expired"
  | "failed";

export type CalibrationResult = "passed" | "failed";
export type MaintenanceWorkType = "preventive" | "corrective";
export type MaintenanceWorkOrderStatus = "planned" | "in_progress" | "completed" | "cancelled";

export interface EquipmentListItem {
  id: number;
  organization: number;
  workplace: number | null;
  workplace_name: string | null;
  code: string;
  name: string;
  category: EquipmentCategory;
  category_display: string;
  category_detail: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  status: EquipmentStatus;
  status_display: string;
  calibration_required: boolean;
  calibration_status: CalibrationStatus;
  calibration_status_display: string;
  calibration_due_on: string | null;
  is_calibration_valid: boolean;
  open_work_orders_count: number;
  is_synthetic: boolean;
  can_manage: boolean;
  can_conduct_work: boolean;
  can_calibrate: boolean;
  created_at: string;
  updated_at: string;
}

export interface HazardReference {
  id: number;
  title: string;
  category: string;
  category_display: string;
  status: string;
  status_display: string;
}

export interface PermitReference {
  id: number;
  reference_code: string;
  title: string;
  status: string;
  status_display: string;
  valid_until: string;
}

export interface MaintenancePlan {
  id: number;
  organization: number;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  title: string;
  interval_days: number;
  instructions: string;
  responsible: number | null;
  responsible_name: string | null;
  start_date: string;
  next_due_date: string;
  is_active: boolean;
  is_overdue: boolean;
  is_due_soon: boolean;
  is_synthetic: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceWorkOrder {
  id: number;
  organization: number;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  plan: number | null;
  plan_title: string | null;
  title: string;
  work_type: MaintenanceWorkType;
  work_type_display: string;
  status: MaintenanceWorkOrderStatus;
  status_display: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  scheduled_date: string;
  completed_date: string | null;
  description: string;
  findings: string;
  result: string;
  cancellation_reason: string;
  is_synthetic: boolean;
  can_start: boolean;
  can_complete: boolean;
  can_cancel: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalibrationRecord {
  id: number;
  organization: number;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  performed_on: string;
  next_due_on: string;
  provider: string;
  certificate_number: string;
  result: CalibrationResult;
  result_display: string;
  notes: string;
  document_reference: string;
  performed_by: number | null;
  performed_by_name: string | null;
  created_at: string;
}

export interface RelatedIncident {
  id: number;
  title: string;
  status: string;
  status_display: string;
  occurred_at: string;
}

export interface RelatedInspection {
  id: number;
  title: string;
  status: string;
  status_display: string;
  created_at: string;
}

export interface RelatedNonConformity {
  id: number;
  description: string;
  severity: string;
  severity_display: string;
  status: string;
  status_display: string;
  created_at: string;
}

export interface RelatedCorrectiveAction {
  id: number;
  description: string;
  status: string;
  status_display: string;
  due_date: string | null;
  nonconformity_id: number;
}

export interface EquipmentDetail extends EquipmentListItem {
  description: string;
  specifications: string;
  purchase_date: string | null;
  installation_date: string | null;
  related_hazards: HazardReference[];
  related_permits: PermitReference[];
  maintenance_plans: MaintenancePlan[];
  work_orders: MaintenanceWorkOrder[];
  calibrations: CalibrationRecord[];
  related_incidents: RelatedIncident[];
  related_inspections: RelatedInspection[];
  related_nonconformities: RelatedNonConformity[];
  related_corrective_actions: RelatedCorrectiveAction[];
}

export interface EquipmentStats {
  total_equipment: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  ready_count: number;
  under_maintenance_count: number;
  out_of_service_count: number;
  retired_count: number;
  maintenance_overdue_count: number;
  maintenance_due_soon_count: number;
  open_work_order_count: number;
  overdue_work_order_count: number;
  calibration_due_soon_count: number;
  calibration_expired_count: number;
  calibration_failed_count: number;
  calibration_missing_count: number;
  calibration_valid_count: number;
  calibration_invalid_count: number;
  calibration_due_soon_days: number;
  maintenance_due_soon_days: number;
}

function assetQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== "",
  );
  if (entries.length === 0) return "";
  return `?${entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&")}`;
}

export function fetchEquipment(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<EquipmentListItem[]>(`/assets/equipment/${assetQuery(params)}`, { signal });
}

export function fetchEquipmentDetail(id: number, signal?: AbortSignal) {
  return request<EquipmentDetail>(`/assets/equipment/${id}/`, { signal });
}

export function createEquipment(data: Record<string, unknown>) {
  return request<EquipmentDetail>("/assets/equipment/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEquipment(id: number, data: Record<string, unknown>) {
  return request<EquipmentDetail>(`/assets/equipment/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function changeEquipmentStatus(
  id: number,
  data: { status: EquipmentStatus; reason?: string },
) {
  return request<EquipmentDetail>(`/assets/equipment/${id}/status/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchEquipmentStats(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<EquipmentStats>(`/assets/equipment/stats/${assetQuery(params)}`, { signal });
}

export function fetchMaintenancePlans(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<MaintenancePlan[]>(`/assets/maintenance-plans/${assetQuery(params)}`, {
    signal,
  });
}

export function createMaintenancePlan(data: Record<string, unknown>) {
  return request<MaintenancePlan>("/assets/maintenance-plans/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateMaintenancePlan(id: number, data: Record<string, unknown>) {
  return request<MaintenancePlan>(`/assets/maintenance-plans/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchMaintenanceWorkOrders(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<MaintenanceWorkOrder[]>(
    `/assets/maintenance-work-orders/${assetQuery(params)}`,
    { signal },
  );
}

export function createMaintenanceWorkOrder(data: Record<string, unknown>) {
  return request<MaintenanceWorkOrder>("/assets/maintenance-work-orders/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function startMaintenanceWorkOrder(id: number) {
  return request<MaintenanceWorkOrder>(`/assets/maintenance-work-orders/${id}/start/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function completeMaintenanceWorkOrder(
  id: number,
  data: { result: string; findings?: string; completed_date?: string },
) {
  return request<MaintenanceWorkOrder>(`/assets/maintenance-work-orders/${id}/complete/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cancelMaintenanceWorkOrder(id: number, reason: string) {
  return request<MaintenanceWorkOrder>(`/assets/maintenance-work-orders/${id}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function fetchCalibrations(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<CalibrationRecord[]>(`/assets/calibrations/${assetQuery(params)}`, {
    signal,
  });
}

export function createCalibration(data: Record<string, unknown>) {
  return request<CalibrationRecord>("/assets/calibrations/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Phase 10: Workforce, Training, Competency & PPE
// ---------------------------------------------------------------------------

export interface Employee {
  id: number;
  organization: number;
  organization_name?: string;
  workplace?: number | null;
  workplace_name?: string | null;
  employee_no: string;
  first_name: string;
  last_name: string;
  full_name: string;
  job_title: string;
  user?: number | null;
  user_detail?: { id: number; username: string; full_name?: string } | null;
  is_active: boolean;
  notes?: string;
  training_count?: number;
  active_competency_count?: number;
  active_ppe_count?: number;
  can_manage?: boolean;
  is_synthetic?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DeliveryType = "in_person" | "practical" | "online" | "blended";

export interface TrainingCourse {
  id: number;
  organization: number;
  code: string;
  title: string;
  category: string;
  description: string;
  objectives: string;
  duration_minutes: number;
  delivery_type: DeliveryType;
  delivery_type_display?: string;
  is_mandatory: boolean;
  requires_renewal: boolean;
  validity_months?: number | null;
  is_active: boolean;
  session_count?: number;
  trained_employee_count?: number;
  can_manage?: boolean;
  is_synthetic?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type SessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface TrainingSession {
  id: number;
  organization: number;
  course: number;
  course_detail?: { id: number; code: string; title: string; duration_minutes: number };
  workplace?: number | null;
  workplace_name?: string | null;
  scheduled_on: string;
  trainer_name: string;
  capacity?: number | null;
  status: SessionStatus;
  status_display?: string;
  notes?: string;
  attendance_count?: number;
  capacity_remaining?: number | null;
  can_train?: boolean;
  can_manage?: boolean;
  is_synthetic?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type AttendanceStatus = "registered" | "attended" | "absent" | "cancelled";
export type AssessmentResult = "pending" | "passed" | "failed";

export interface TrainingAttendance {
  id: number;
  organization: number;
  session: number;
  session_detail?: { id: number; course: number; course_title: string; scheduled_on: string; status: string };
  employee: number;
  employee_detail?: { id: number; employee_no: string; full_name: string; job_title: string };
  attendance_status: AttendanceStatus;
  attendance_status_display?: string;
  assessment_result: AssessmentResult;
  assessment_result_display?: string;
  score?: number | null;
  completed_on?: string | null;
  notes?: string;
  is_passed?: boolean;
  can_edit?: boolean;
  recorded_by_name?: string | null;
  is_synthetic?: boolean;
  created_at?: string;
}

export interface Competency {
  id: number;
  organization: number;
  code: string;
  name: string;
  description: string;
  allowed_activities: string;
  is_mandatory: boolean;
  validity_months?: number | null;
  accepted_courses?: number[];
  accepted_courses_detail?: Array<{ id: number; code: string; title: string }>;
  is_active: boolean;
  valid_record_count?: number;
  expired_record_count?: number;
  can_manage?: boolean;
  is_synthetic?: boolean;
  created_at?: string;
}

export type CompetencyStatus = "active" | "suspended" | "revoked";
export type EffectiveCompetencyStatus = "valid" | "expiring_soon" | "expired" | "suspended" | "revoked";

export interface EmployeeCompetency {
  id: number;
  organization: number;
  employee: number;
  employee_detail?: { id: number; employee_no: string; full_name: string; job_title: string };
  competency: number;
  competency_detail?: { id: number; code: string; name: string; validity_months?: number };
  achieved_on: string;
  expires_on?: string | null;
  source_course?: number | null;
  source_course_title?: string | null;
  source_session?: number | null;
  source_session_label?: string | null;
  certificate_number?: string;
  status: CompetencyStatus;
  effective_status: EffectiveCompetencyStatus;
  effective_status_display?: string;
  days_until_expiry?: number | null;
  is_valid: boolean;
  notes?: string;
  can_issue?: boolean;
  recorded_by_name?: string | null;
  is_synthetic?: boolean;
  created_at?: string;
}

export interface PermitTypeCompetencyRequirement {
  id: number;
  organization: number;
  permit_type: PermitType;
  permit_type_display?: string;
  competency: number;
  competency_detail?: { id: number; code: string; name: string };
  notes?: string;
  can_manage?: boolean;
  is_synthetic?: boolean;
  created_at?: string;
}

export interface PermitCompetencyValidation {
  permit_id: number;
  permit_type: string;
  has_requirements: boolean;
  required_competencies: Array<{ id: number; code: string; name: string }>;
  assigned_employees: Array<{ id: number; employee_no: string; full_name: string }>;
  is_compliant: boolean;
  blocking_reasons: string[];
  matrix: Array<{
    employee_id: number;
    employee_name: string;
    competency_id: number;
    competency_name: string;
    status: string;
    is_valid: boolean;
  }>;
}

export interface PPEItem {
  id: number;
  organization: number;
  code: string;
  name: string;
  category: string;
  description: string;
  usage_requirements: string;
  sizes: string;
  replacement_interval_days?: number | null;
  inspection_required: boolean;
  is_durable: boolean;
  tracks_serial: boolean;
  is_active: boolean;
  stock_total?: number;
  active_assignment_count?: number;
  can_manage?: boolean;
  is_synthetic?: boolean;
  created_at?: string;
}

export interface PPEStock {
  id: number;
  organization: number;
  item: number;
  item_code?: string;
  item_name?: string;
  workplace?: number | null;
  workplace_name?: string | null;
  location_name: string;
  quantity_on_hand: number;
  quantity_minimum: number;
  is_below_minimum?: boolean;
  is_active: boolean;
  can_manage?: boolean;
  is_synthetic?: boolean;
  created_at?: string;
}

export type PPEAssignmentStatus = "active" | "returned" | "replaced" | "disposed";

export interface PPEAssignment {
  id: number;
  organization: number;
  employee: number;
  employee_detail?: { id: number; employee_no: string; full_name: string };
  item: number;
  item_code?: string;
  item_name?: string;
  item_category?: string;
  tracks_serial?: boolean;
  stock: number;
  stock_location?: string;
  quantity: number;
  serial_number: string;
  issued_on: string;
  condition_on_issue: string;
  replacement_due_on?: string | null;
  returned_on?: string | null;
  return_condition?: string;
  status: PPEAssignmentStatus;
  status_display?: string;
  is_overdue?: boolean;
  is_due_soon?: boolean;
  notes?: string;
  can_operate?: boolean;
  events?: Array<{
    id: number;
    event_type: string;
    event_type_display: string;
    event_date: string;
    actor_name?: string;
    details?: Record<string, unknown>;
  }>;
  is_synthetic?: boolean;
  created_at?: string;
}

export interface WorkforceStats {
  employees_total: number;
  employees_active: number;
  employees_without_account: number;
  courses_active: number;
  sessions_upcoming: number;
  sessions_completed: number;
  attendance_passed: number;
  attendance_failed: number;
  attendance_absent: number;
  attendance_pending: number;
  competency_records_total: number;
  competency_valid: number;
  competency_expiring_soon: number;
  competency_expired: number;
  competency_suspended: number;
  competency_revoked: number;
  competency_due_soon_days: number;
  ppe_items: number;
  ppe_items_active: number;
  ppe_stock_below_minimum: number;
  ppe_active_assignments: number;
  ppe_assignments_due_soon: number;
  ppe_assignments_overdue: number;
  ppe_replacement_due_soon_days: number;
}

function workforceQuery(params?: Record<string, string | number | undefined | boolean>) {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== "",
  );
  if (entries.length === 0) return "";
  const query = new URLSearchParams();
  for (const [key, value] of entries) {
    query.set(key, String(value));
  }
  return `?${query.toString()}`;
}

export function fetchWorkforceStats(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<WorkforceStats>(`/workforce/stats/${workforceQuery(params)}`, { signal });
}

export function fetchEmployees(
  params?: Record<string, string | number | undefined | boolean>,
  signal?: AbortSignal,
) {
  return request<Employee[]>(`/workforce/employees/${workforceQuery(params)}`, { signal });
}

export function createEmployee(data: Record<string, unknown>) {
  return request<Employee>("/workforce/employees/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEmployee(id: number, data: Record<string, unknown>) {
  return request<Employee>(`/workforce/employees/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchEmployeeTrainingHistory(id: number, signal?: AbortSignal) {
  return request<TrainingAttendance[]>(`/workforce/employees/${id}/training/`, { signal });
}

export function fetchEmployeeCompetencyHistory(id: number, signal?: AbortSignal) {
  return request<EmployeeCompetency[]>(`/workforce/employees/${id}/competencies/`, { signal });
}

export function fetchEmployeePPEHistory(id: number, signal?: AbortSignal) {
  return request<PPEAssignment[]>(`/workforce/employees/${id}/ppe/`, { signal });
}

export function fetchCourses(
  params?: Record<string, string | number | undefined | boolean>,
  signal?: AbortSignal,
) {
  return request<TrainingCourse[]>(`/workforce/courses/${workforceQuery(params)}`, { signal });
}

export function createCourse(data: Record<string, unknown>) {
  return request<TrainingCourse>("/workforce/courses/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCourse(id: number, data: Record<string, unknown>) {
  return request<TrainingCourse>(`/workforce/courses/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchTrainingSessions(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<TrainingSession[]>(`/workforce/training-sessions/${workforceQuery(params)}`, { signal });
}

export function createTrainingSession(data: Record<string, unknown>) {
  return request<TrainingSession>("/workforce/training-sessions/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTrainingSession(id: number, data: Record<string, unknown>) {
  return request<TrainingSession>(`/workforce/training-sessions/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchTrainingAttendances(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<TrainingAttendance[]>(`/workforce/training-attendances/${workforceQuery(params)}`, { signal });
}

export function createTrainingAttendance(data: Record<string, unknown>) {
  return request<TrainingAttendance>("/workforce/training-attendances/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTrainingAttendance(id: number, data: Record<string, unknown>) {
  return request<TrainingAttendance>(`/workforce/training-attendances/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchCompetencies(
  params?: Record<string, string | number | undefined | boolean>,
  signal?: AbortSignal,
) {
  return request<Competency[]>(`/workforce/competencies/${workforceQuery(params)}`, { signal });
}

export function createCompetency(data: Record<string, unknown>) {
  return request<Competency>("/workforce/competencies/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCompetency(id: number, data: Record<string, unknown>) {
  return request<Competency>(`/workforce/competencies/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchEmployeeCompetencies(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<EmployeeCompetency[]>(`/workforce/employee-competencies/${workforceQuery(params)}`, { signal });
}

export function issueEmployeeCompetency(data: Record<string, unknown>) {
  return request<EmployeeCompetency>("/workforce/employee-competencies/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEmployeeCompetencyStatus(id: number, data: { status: CompetencyStatus; reason?: string }) {
  return request<EmployeeCompetency>(`/workforce/employee-competencies/${id}/status/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchPermitRequirements(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<PermitTypeCompetencyRequirement[]>(`/workforce/permit-requirements/${workforceQuery(params)}`, { signal });
}

export function createPermitRequirement(data: Record<string, unknown>) {
  return request<PermitTypeCompetencyRequirement>("/workforce/permit-requirements/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deletePermitRequirement(id: number) {
  return request<void>(`/workforce/permit-requirements/${id}/`, {
    method: "DELETE",
  });
}

export function fetchPPEItems(
  params?: Record<string, string | number | undefined | boolean>,
  signal?: AbortSignal,
) {
  return request<PPEItem[]>(`/workforce/ppe-items/${workforceQuery(params)}`, { signal });
}

export function createPPEItem(data: Record<string, unknown>) {
  return request<PPEItem>("/workforce/ppe-items/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePPEItem(id: number, data: Record<string, unknown>) {
  return request<PPEItem>(`/workforce/ppe-items/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchPPEStock(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<PPEStock[]>(`/workforce/ppe-stock/${workforceQuery(params)}`, { signal });
}

export function createPPEStock(data: Record<string, unknown>) {
  return request<PPEStock>("/workforce/ppe-stock/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePPEStock(id: number, data: Record<string, unknown>) {
  return request<PPEStock>(`/workforce/ppe-stock/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchPPEAssignments(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<PPEAssignment[]>(`/workforce/ppe-assignments/${workforceQuery(params)}`, { signal });
}

export function createPPEAssignment(data: Record<string, unknown>) {
  return request<PPEAssignment>("/workforce/ppe-assignments/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function returnPPEAssignment(id: number, data: { condition?: string; returned_on?: string; notes?: string }) {
  return request<PPEAssignment>(`/workforce/ppe-assignments/${id}/return/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function replacePPEAssignment(id: number, data: Record<string, unknown>) {
  return request<PPEAssignment>(`/workforce/ppe-assignments/${id}/replace/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function disposePPEAssignment(id: number, data: { condition?: string; notes?: string }) {
  return request<PPEAssignment>(`/workforce/ppe-assignments/${id}/dispose/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchPermitCompetencyStatus(permitId: number, signal?: AbortSignal) {
  return request<PermitCompetencyValidation>(`/permits/${permitId}/competency-status/`, { signal });
}

// ---------------------------------------------------------------------------
// Phase 12: Jobs, Contractors & Attendance
// ---------------------------------------------------------------------------

export interface JobPosition {
  id: number;
  organization: number;
  code: string;
  title: string;
  description: string;
  department: string;
  risk_level: "low" | "medium" | "high" | "critical";
  risk_level_display?: string;
  required_competencies: number[];
  required_competency_details?: { id: number; code: string; name: string }[];
  required_qualifications: string;
  is_active: boolean;
  assignments_count?: number;
  is_synthetic?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeJobAssignment {
  id: number;
  organization: number;
  employee: number;
  employee_name?: string;
  job_position: number;
  job_position_title?: string;
  job_position_code?: string;
  start_date: string;
  end_date?: string | null;
  is_primary: boolean;
  notes?: string;
  is_synthetic?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ContractorCompany {
  id: number;
  organization: number;
  name: string;
  registration_no: string;
  economic_code: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  contract_start?: string | null;
  contract_end?: string | null;
  status: "pending" | "approved" | "suspended" | "blacklisted";
  status_display?: string;
  safety_score: number | string;
  notes?: string;
  workers_count?: number;
  documents_count?: number;
  is_synthetic?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ContractorDocument {
  id: number;
  organization: number;
  contractor: number;
  contractor_name?: string;
  document_type: "hse_plan" | "insurance_policy" | "qualification_cert" | "iso_cert" | "other";
  document_type_display?: string;
  title: string;
  file_url?: string;
  valid_from?: string | null;
  valid_until?: string | null;
  status: "submitted" | "verified" | "expired" | "rejected";
  status_display?: string;
  verified_by?: number | null;
  verified_by_name?: string | null;
  verification_notes?: string;
  is_expired?: boolean;
  is_synthetic?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ContractorWorker {
  id: number;
  organization: number;
  contractor: number;
  contractor_name?: string;
  national_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  mobile: string;
  trade: string;
  badge_number: string;
  is_active: boolean;
  medical_clearance_date?: string | null;
  medical_expiry_date?: string | null;
  safety_induction_date?: string | null;
  notes?: string;
  is_synthetic?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ContractorEvaluation {
  id: number;
  organization: number;
  contractor: number;
  contractor_name?: string;
  evaluation_date: string;
  evaluator?: number | null;
  evaluator_name?: string | null;
  score: number | string;
  criteria_scores?: Record<string, any>;
  findings: string;
  recommendation: "continue" | "warning" | "conditional_approval" | "terminate";
  recommendation_display?: string;
  is_synthetic?: boolean;
  created_at?: string;
}

export interface AttendanceRecord {
  id: number;
  organization: number;
  workplace?: number | null;
  workplace_name?: string | null;
  person_type: "employee" | "contractor_worker";
  person_type_display?: string;
  employee?: number | null;
  employee_name?: string | null;
  contractor_worker?: number | null;
  contractor_worker_name?: string | null;
  person_name?: string;
  date: string;
  check_in: string;
  check_out?: string | null;
  entry_source: "gate_scanner" | "biometric" | "manual_roster" | "mobile_kiosk";
  entry_source_display?: string;
  status: "present" | "late" | "absent" | "early_departure";
  status_display?: string;
  verified_by?: number | null;
  verified_by_name?: string | null;
  notes?: string;
  is_synthetic?: boolean;
  created_at?: string;
}

export interface AttendanceRoster {
  date: string;
  total_recorded: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  early_departure_count: number;
  employee_count: number;
  contractor_worker_count: number;
}

export function fetchJobPositions(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<JobPosition[]>(`/workforce/jobs/${workforceQuery(params)}`, { signal });
}

export function createJobPosition(data: Record<string, unknown>) {
  return request<JobPosition>("/workforce/jobs/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchEmployeeJobAssignments(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<EmployeeJobAssignment[]>(`/workforce/job-assignments/${workforceQuery(params)}`, { signal });
}

export function createEmployeeJobAssignment(data: Record<string, unknown>) {
  return request<EmployeeJobAssignment>("/workforce/job-assignments/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchContractors(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<ContractorCompany[]>(`/workforce/contractors/${workforceQuery(params)}`, { signal });
}

export function createContractor(data: Record<string, unknown>) {
  return request<ContractorCompany>("/workforce/contractors/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchContractorDocuments(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<ContractorDocument[]>(`/workforce/contractor-documents/${workforceQuery(params)}`, { signal });
}

export function createContractorDocument(data: Record<string, unknown>) {
  return request<ContractorDocument>("/workforce/contractor-documents/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function verifyContractorDocument(id: number, data: { status: string; verification_notes?: string }) {
  return request<ContractorDocument>(`/workforce/contractor-documents/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchContractorWorkers(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<ContractorWorker[]>(`/workforce/contractor-workers/${workforceQuery(params)}`, { signal });
}

export function createContractorWorker(data: Record<string, unknown>) {
  return request<ContractorWorker>("/workforce/contractor-workers/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchContractorEvaluations(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<ContractorEvaluation[]>(`/workforce/contractor-evaluations/${workforceQuery(params)}`, { signal });
}

export function createContractorEvaluation(data: Record<string, unknown>) {
  return request<ContractorEvaluation>("/workforce/contractor-evaluations/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchAttendanceRecords(
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<AttendanceRecord[]>(`/workforce/attendance/${workforceQuery(params)}`, { signal });
}

export function createAttendanceRecord(data: Record<string, unknown>) {
  return request<AttendanceRecord>("/workforce/attendance/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchAttendanceRoster(
  date?: string,
  organizationId?: number,
  signal?: AbortSignal,
) {
  const p: Record<string, string | number | undefined> = {};
  if (date) p.date = date;
  if (organizationId) p.organization = organizationId;
  return request<AttendanceRoster>(`/workforce/attendance/roster/${workforceQuery(p)}`, { signal });
}


