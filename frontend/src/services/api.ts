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

export function fetchWorkplaces(organizationId: number, signal?: AbortSignal) {
  return request<Workplace[]>(`/workplaces/?${query({ organization: organizationId })}`, {
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


