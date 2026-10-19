import { vi } from "vitest";

export const testUser = {
  id: 1,
  username: "ali",
  email: "",
  first_name: "علی",
  last_name: "",
  global_role: "standard",
};

export const testOrganization = { id: 1, name: "سازمان الف", code: "org-a", is_active: true };

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const unauthenticated = () =>
  jsonResponse({ error: { code: "not_authenticated", message: "ورود لازم است." } }, 403);

type Routes = Record<string, (init?: RequestInit) => Response | Promise<Response>>;

export function mockApi(routes: Routes) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const path = url.replace(/^.*\/api\/v1/, "").split("?")[0];
    const handler = routes[path];
    if (!handler) {
      return jsonResponse({ error: { code: "not_found", message: "not found" } }, 404);
    }
    return handler(init);
  });
}

export function riskRoutes(overrides: Routes = {}): Routes {
  return {
    "/auth/me/": () => jsonResponse(testUser),
    "/health/": () => jsonResponse({ status: "ok", database: "ok" }),
    "/organizations/": () => jsonResponse([testOrganization]),
    "/workplaces/": () => jsonResponse([]),
    "/risks/": () => jsonResponse([]),
    "/risks/assessments/": () => jsonResponse([]),
    "/checklists/": () => jsonResponse([]),
    "/inspections/": () => jsonResponse([]),
    "/non-conformities/": () => jsonResponse([]),
    "/corrective-actions/": () => jsonResponse([]),
    "/dashboard/metrics/": () =>
      jsonResponse({
        inspections: { draft: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 },
        risks: { low: 0, medium: 0, high: 0, critical: 0, total: 0, hazards_count: 0 },
        non_conformities: { open: 0, in_progress: 0, ready_for_review: 0, closed: 0, total: 0 },
        corrective_actions: { open: 0, completed: 0, overdue: 0, total: 0 },
        urgent_deadlines: { inspections: [], actions: [] },
      }),
    "/notifications/": () => jsonResponse([]),
    "/audit-logs/": () => jsonResponse([]),
    "/knowledge-base/": () => jsonResponse([]),
    "/knowledge-base/meta/": () => jsonResponse({ categories: [], statuses: [] }),
    "/ai/status/": () =>
      jsonResponse({
        provider: "grounded_rule_engine",
        is_live_configured: false,
        active_engine: "grounded_rule_engine",
        engine_label: "موتور تحلیلی پایگاه دانش مقررات و استانداردها",
        verified_regulations_count: 8,
        supported_features: [],
        disclaimer: "مشورتی است.",
      }),
    "/incidents/": () => jsonResponse([]),
    "/incidents/summary-stats/": () =>
      jsonResponse({
        total_incidents: 0,
        near_miss_count: 0,
        under_investigation_count: 0,
        closed_count: 0,
        total_lost_time_days: 0,
        by_type: {},
        by_severity: {},
        by_status: {},
      }),
    ...overrides,
  };
}
