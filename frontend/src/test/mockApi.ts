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
    "/organizations/1/memberships/": () =>
      jsonResponse([
        {
          id: 1,
          user: 1,
          username: "ali",
          full_name: "علی",
          organization: 1,
          role: "workshop_supervisor",
          role_display: "سرپرست کارگاه",
          is_active: true,
        },
      ]),
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
    "/permits/": () => jsonResponse([]),
    "/permits/stats/": () =>
      jsonResponse({
        total_permits: 0,
        active_count: 0,
        suspended_count: 0,
        requested_count: 0,
        approved_count: 0,
        closed_count: 0,
        expired_count: 0,
        by_type: {},
        by_status: {},
      }),
    "/permits/handovers/": () => jsonResponse([]),
    "/permits/handovers/safety-summary/": () =>
      jsonResponse({
        active_permits_count: 0,
        active_permits: [],
        unresolved_hazards_count: 0,
        unresolved_hazards: [],
        open_capas_count: 0,
        open_capas: [],
        recent_incidents_count: 0,
        recent_incidents: [],
      }),
    "/assets/equipment/": () => jsonResponse([]),
    "/assets/equipment/stats/": () =>
      jsonResponse({
        total_equipment: 0,
        by_status: {},
        by_category: {},
        ready_count: 0,
        under_maintenance_count: 0,
        out_of_service_count: 0,
        retired_count: 0,
        maintenance_overdue_count: 0,
        maintenance_due_soon_count: 0,
        open_work_order_count: 0,
        overdue_work_order_count: 0,
        calibration_due_soon_count: 0,
        calibration_expired_count: 0,
        calibration_failed_count: 0,
        calibration_missing_count: 0,
        calibration_valid_count: 0,
        calibration_invalid_count: 0,
        calibration_due_soon_days: 30,
        maintenance_due_soon_days: 7,
      }),
    "/assets/maintenance-plans/": () => jsonResponse([]),
    "/assets/maintenance-work-orders/": () => jsonResponse([]),
    "/assets/calibrations/": () => jsonResponse([]),
    ...overrides,
  };
}
