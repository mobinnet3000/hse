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
