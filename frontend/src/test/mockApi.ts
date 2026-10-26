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
    "/permits/simops-radar/": () =>
      jsonResponse({
        organization: 1,
        total_active_planned_permits: 0,
        active_conflicts: 0,
        workplaces: [],
      }),
    "/permits/simops-conflicts/": () => jsonResponse([]),
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
    "/workforce/stats/": () =>
      jsonResponse({
        employees_total: 10,
        employees_active: 8,
        employees_without_account: 3,
        courses_active: 4,
        sessions_upcoming: 2,
        sessions_completed: 4,
        attendance_passed: 20,
        attendance_failed: 2,
        attendance_absent: 3,
        attendance_pending: 0,
        competency_records_total: 15,
        competency_valid: 12,
        competency_expiring_soon: 2,
        competency_expired: 1,
        competency_suspended: 0,
        competency_revoked: 0,
        competency_due_soon_days: 30,
        ppe_items: 6,
        ppe_items_active: 6,
        ppe_stock_below_minimum: 1,
        ppe_active_assignments: 14,
        ppe_assignments_due_soon: 2,
        ppe_assignments_overdue: 1,
        ppe_replacement_due_soon_days: 30,
      }),
    "/workforce/employees/": () => jsonResponse([]),
    "/workforce/courses/": () => jsonResponse([]),
    "/workforce/training-sessions/": () => jsonResponse([]),
    "/workforce/training-attendances/": () => jsonResponse([]),
    "/workforce/competencies/": () => jsonResponse([]),
    "/workforce/employee-competencies/": () => jsonResponse([]),
    "/workforce/permit-requirements/": () => jsonResponse([]),
    "/workforce/ppe-items/": () => jsonResponse([]),
    "/workforce/ppe-stock/": () => jsonResponse([]),
    "/workforce/ppe-assignments/": () => jsonResponse([]),
    "/workforce/contractors/": () => jsonResponse([]),
    "/workforce/contractor-documents/": () => jsonResponse([]),
    "/workforce/contractor-workers/": () => jsonResponse([]),
    "/workforce/contractor-evaluations/": () => jsonResponse([]),
    "/workforce/jobs/": () => jsonResponse([]),
    "/workforce/job-assignments/": () => jsonResponse([]),
    "/workforce/attendance/": () => jsonResponse([]),
    "/workforce/attendance/roster/": () =>
      jsonResponse({
        date: "2026-10-26",
        total_recorded: 0,
        present_count: 0,
        late_count: 0,
        absent_count: 0,
        early_departure_count: 0,
        employee_count: 0,
        contractor_worker_count: 0,
        attendance_records: [],
      }),
    ...overrides,
  };
}

export function environmentRoutes(overrides: Routes = {}): Routes {
  return {
    "/auth/me/": () => jsonResponse(testUser),
    "/health/": () => jsonResponse({ status: "ok", database: "ok" }),
    "/organizations/": () => jsonResponse([testOrganization]),
    "/workplaces/": () =>
      jsonResponse([
        { id: 1, name: "سوله نورد", code: "WP-ROLL", organization: 1 },
      ]),
    "/environment/summary/": () =>
      jsonResponse({
        aspects_total: 4,
        aspects_significant: 2,
        waste_records_count: 5,
        hazardous_waste_kg: 1250,
        non_hazardous_waste_kg: 8400,
        active_stored_waste_count: 2,
        emission_records_count: 6,
        emission_exceedances_count: 1,
        hygiene_surveys_count: 8,
        hygiene_exceedances_count: 1,
      }),
    "/environment/thresholds/": () =>
      jsonResponse([
        {
          id: 1,
          name: "حداکثر مجاز COD پساب",
          category: "wastewater",
          category_display: "پساب و فاضلاب صنعتی",
          parameter: "COD",
          limit_type: "max_limit",
          limit_type_display: "حداکثر مجاز",
          limit_value: 100,
          unit: "mg/L",
          standard_reference: "استاندارد محیط زیست",
          is_active: true,
        },
      ]),
    "/environment/aspects/": () =>
      jsonResponse([
        {
          id: 1,
          workplace: 1,
          workplace_name: "سوله نورد",
          activity_or_process: "ذوب در کوره قوس",
          aspect: "انتشار غبار و CO",
          impact: "آلودگی هوا",
          condition: "normal",
          condition_display: "شرایط عادی",
          severity_score: 4,
          probability_score: 4,
          significance_score: 16,
          is_significant: true,
          control_measures: "فیلتر بگ‌هاوس صنعتی",
        },
      ]),
    "/environment/waste/": () =>
      jsonResponse([
        {
          id: 1,
          workplace: 1,
          workplace_name: "سوله نورد",
          waste_name: "روغن سوخته هیدرولیک",
          waste_type: "hazardous",
          waste_type_display: "پسماند خطرناک و ویژه",
          quantity: 450,
          unit: "liter",
          unit_display: "لیتر",
          storage_location: "انبار ویژه",
          generation_date: "2026-10-20",
          status: "stored",
          status_display: "انبارش موقت در سایت",
        },
      ]),
    "/environment/emissions/": () =>
      jsonResponse([
        {
          id: 1,
          workplace: 1,
          workplace_name: "سوله نورد",
          sampling_point: "حوضچه خروجی تصفیه‌خانه",
          category: "wastewater",
          category_display: "پساب خروجی",
          sample_date: "2026-10-22",
          parameter: "COD",
          measured_value: 165.5,
          unit: "mg/L",
          standard_limit: 100,
          is_exceedance: true,
          laboratory_name: "آزمایشگاه آب آزما",
          non_conformity: 101,
        },
      ]),
    "/environment/hygiene/": () =>
      jsonResponse([
        {
          id: 1,
          workplace: 1,
          workplace_name: "سوله نورد",
          category: "noise",
          category_display: "صدا و ارتعاش",
          location_details: "ایستگاه اپراتوری نورد",
          survey_date: "2026-10-25",
          surveyor_name: "مهندس کاظمی",
          measured_value: 91.5,
          unit: "dBA",
          standard_limit: 85,
          is_exceedance: true,
          assessment_result: "unacceptable",
          assessment_result_display: "غیرمجاز و بحرانی",
          control_recommendation: "استفاده اجباری از ایرماف ۳۰ دسی‌بل",
        },
      ]),
    ...overrides,
  };
}

export function scaffoldRoutes(overrides: Routes = {}): Routes {
  return {
    "/auth/me/": () => jsonResponse(testUser),
    "/health/": () => jsonResponse({ status: "ok", database: "ok" }),
    "/organizations/": () => jsonResponse([testOrganization]),
    "/workplaces/": () => jsonResponse([{ id: 1, name: "کارگاه نورد", code: "WP-01" }]),
    "/workforce/contractors/": () =>
      jsonResponse([
        {
          id: 1,
          name: "شرکت فنی مهندسی سازه برتر",
          registration_number: "101010",
          status: "approved",
          status_display: "تایید شده",
          qualification_score: 85,
        },
      ]),
    "/scaffolds/summary/": () =>
      jsonResponse({
        total_scaffolds: 3,
        green_count: 1,
        yellow_count: 1,
        red_count: 1,
        dismantled_count: 0,
        overdue_inspections_count: 1,
      }),
    "/scaffolds/scaffolds/": (init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init?.body || "{}"));
        return jsonResponse(
          {
            id: 99,
            tag_number: body.tag_number || "SCF-TEST-099",
            location_details: body.location_details || "تست کارگاه",
            workplace: body.workplace || 1,
            workplace_name: "کارگاه نورد",
            scaffold_type: body.scaffold_type || "modular_system",
            scaffold_type_display: "مدولار پیش‌ساخته",
            load_duty: body.load_duty || "heavy_duty",
            load_duty_display: "سنگین (۳۰۰ کیلوگرم بر متر مربع)",
            tag_status: "red_unsafe",
            tag_status_display: "قرمز (ناایمن - ورود اکیداً ممنوع)",
            height_meters: 10,
            length_meters: 12,
            width_meters: 3,
            inspection_interval_days: 7,
            is_inspection_overdue: false,
            erected_by: "علی شفیعی",
            erection_date: "2026-10-25",
            inspections: [],
          },
          201
        );
      }
      return jsonResponse([
        {
          id: 1,
          tag_number: "SCF-ROLL-001",
          location_details: "پای ستون نورد اصلی",
          workplace: 1,
          workplace_name: "کارگاه نورد",
          scaffold_type: "modular_system",
          scaffold_type_display: "مدولار پیش‌ساخته",
          load_duty: "heavy_duty",
          load_duty_display: "سنگین (۳۰۰ کیلوگرم بر متر مربع)",
          tag_status: "green_safe",
          tag_status_display: "سبز (ایمن و تاییدشده)",
          height_meters: 12.5,
          length_meters: 15.0,
          width_meters: 4.0,
          inspection_interval_days: 7,
          is_inspection_overdue: false,
          last_inspection_date: "2026-10-25",
          next_inspection_due: "2026-11-01",
          erected_by: "مهندس شفیعی",
          erection_date: "2026-10-24",
          inspections: [],
        },
        {
          id: 2,
          tag_number: "SCF-CAST-002",
          location_details: "مخزن ریخته‌گری",
          workplace: 1,
          workplace_name: "کارگاه ریخته‌گری",
          scaffold_type: "tube_coupler",
          scaffold_type_display: "لوله و بست",
          load_duty: "medium_duty",
          load_duty_display: "متوسط (۲۰۰ کیلوگرم بر متر مربع)",
          tag_status: "yellow_restricted",
          tag_status_display: "زرد (دسترسی مشروط)",
          yellow_restrictions: "فقط نفرات داربست‌بند با هارنس کامل مجاز به تردد هستند",
          height_meters: 8.0,
          length_meters: 6.0,
          width_meters: 2.5,
          inspection_interval_days: 7,
          is_inspection_overdue: false,
          last_inspection_date: null,
          next_inspection_due: null,
          erected_by: "اکبر حیدری",
          erection_date: "2026-10-25",
          inspections: [],
        },
        {
          id: 3,
          tag_number: "SCF-TWR-003",
          location_details: "برج هوایی کوره",
          workplace: 1,
          workplace_name: "کارگاه نورد",
          scaffold_type: "mobile_tower",
          scaffold_type_display: "برجک متحرک",
          load_duty: "light_duty",
          load_duty_display: "سبک (۱۵۰ کیلوگرم بر متر مربع)",
          tag_status: "red_unsafe",
          tag_status_display: "قرمز (ناایمن - ورود اکیداً ممنوع)",
          yellow_restrictions: "نقص در مهاربندی و عدم نصب تخته پنجه",
          height_meters: 6.0,
          length_meters: 3.0,
          width_meters: 3.0,
          inspection_interval_days: 7,
          is_inspection_overdue: true,
          last_inspection_date: "2026-10-15",
          next_inspection_due: "2026-10-22",
          erected_by: "مهندس شفیعی",
          erection_date: "2026-10-10",
          inspections: [],
        },
      ]);
    },
    "/scaffolds/scaffolds/1/tag-card/": () =>
      jsonResponse({
        tag_number: "SCF-ROLL-001",
        organization_name: "سازمان الف",
        workplace_name: "کارگاه نورد",
        location_details: "پای ستون نورد اصلی",
        scaffold_type_display: "مدولار پیش‌ساخته",
        load_duty_display: "سنگین (۳۰۰ کیلوگرم بر متر مربع)",
        tag_status: "green_safe",
        tag_status_display: "سبز (ایمن و آماده کار)",
        valid_until: "2026-11-01",
        next_inspection_due: "2026-11-01",
        is_overdue: false,
        restrictions: "",
        erected_by: "مهندس شفیعی",
        qr_payload: "HSE-GUARD:SCAFFOLD:1:SCF-ROLL-001",
      }),
    "/scaffolds/scaffolds/1/inspect/": () =>
      jsonResponse({
        id: 10,
        inspector_name: "مهندس ایمنی",
        result_tag: "green_safe",
        inspection_date: "2026-10-26",
      }),
    "/scaffolds/scaffolds/1/change-tag/": () =>
      jsonResponse({
        id: 1,
        tag_status: "red_unsafe",
      }),
    ...overrides,
  };
}

export function documentRoutes(overrides: Routes = {}): Routes {
  return {
    ...scaffoldRoutes(),
    "/documents/summary/": () =>
      jsonResponse({
        total_documents: 5,
        effective_documents: 2,
        under_review_documents: 1,
        draft_documents: 1,
        rejected_documents: 0,
        archived_documents: 1,
        expiring_soon: 1,
        review_due_soon: 1,
        total_acknowledgments: 3,
        categories_breakdown: [
          { category: "procedure", count: 3 },
          { category: "policy", count: 2 },
        ],
      }),
    "/documents/documents/": () =>
      jsonResponse([
        {
          id: 1,
          organization: 1,
          document_number: "DOC-SOP-001",
          title: "دستورالعمل جامع ایمنی کار در ارتفاع",
          category: "procedure",
          category_display: "روش اجرایی استاندارد (SOP)",
          confidentiality: "internal",
          confidentiality_display: "داخلی سازمان",
          status: "effective",
          status_display: "لازم‌الاجرا و جاری",
          department: "واحد ایمنی",
          workplace_name: "کارگاه نورد",
          owner_name: "مدیر ایمنی",
          author_name: "کارشناس ایمنی",
          assigned_reviewer_name: "مدیر ایمنی",
          current_version_id: 10,
          current_version_number: "2.0",
          current_version_filename: "SOP_Work_At_Height_v2.0.pdf",
          current_version_size: 245760,
          current_version_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          effective_date: "2026-10-10",
          next_review_date: "2027-10-10",
          expiry_date: "2028-10-10",
          is_expired: false,
          is_review_overdue: false,
          is_review_due_soon: false,
          is_effective: true,
          requires_acknowledgment: true,
          acknowledgments_count: 2,
          versions_count: 2,
          tags: "ارتفاع, داربست",
          updated_at: "2026-10-20T10:00:00Z",
          created_at: "2026-10-01T08:00:00Z",
        },
      ]),
    "/documents/documents/1/": () =>
      jsonResponse({
        id: 1,
        organization: 1,
        document_number: "DOC-SOP-001",
        title: "دستورالعمل جامع ایمنی کار در ارتفاع",
        description: "الزامات کار در ارتفاع بالای ۱.۸ متر",
        category: "procedure",
        category_display: "روش اجرایی استاندارد (SOP)",
        confidentiality: "internal",
        confidentiality_display: "داخلی سازمان",
        status: "effective",
        status_display: "لازم‌الاجرا و جاری",
        department: "واحد ایمنی",
        current_version_id: 10,
        current_version_number: "2.0",
        current_version_filename: "SOP_Work_At_Height_v2.0.pdf",
        current_version_size: 245760,
        current_version_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        effective_date: "2026-10-10",
        next_review_date: "2027-10-10",
        expiry_date: "2028-10-10",
        is_expired: false,
        is_review_overdue: false,
        is_review_due_soon: false,
        is_effective: true,
        requires_acknowledgment: true,
        acknowledgments_count: 2,
        versions_count: 2,
        tags: "ارتفاع, داربست",
        versions: [
          {
            id: 10,
            document: 1,
            version_number: "2.0",
            original_filename: "SOP_Work_At_Height_v2.0.pdf",
            file_size_bytes: 245760,
            file_hash_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            mime_type: "application/pdf",
            change_summary: "افزودن الزامات تگ داربست",
            uploaded_by_name: "کارشناس ایمنی",
            status: "approved",
            status_display: "تأییدشده و فعال",
            created_at: "2026-10-10T12:00:00Z",
            download_url: "/api/v1/documents/documents/1/versions/10/download/",
          },
          {
            id: 1,
            document: 1,
            version_number: "1.0",
            original_filename: "SOP_Work_At_Height_v1.0.pdf",
            file_size_bytes: 128000,
            file_hash_sha256: "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
            mime_type: "application/pdf",
            change_summary: "نسخه اولیه",
            uploaded_by_name: "کارشناس ایمنی",
            status: "superseded",
            status_display: "منسوخ / جایگزین‌شده",
            created_at: "2026-10-01T08:00:00Z",
            download_url: "/api/v1/documents/documents/1/versions/1/download/",
          },
        ],
        review_logs: [
          {
            id: 1,
            document: 1,
            version_number: "2.0",
            reviewer_name: "مدیر ایمنی",
            action: "approved",
            action_display: "تأیید و تصویب مدرک",
            decision_reason: "نگارش ۲ تصویب شد",
            created_at: "2026-10-10T12:30:00Z",
          },
        ],
        acknowledgments: [
          {
            id: 1,
            document: 1,
            version: 10,
            version_number: "2.0",
            user: 2,
            user_name: "محمد کاظمی",
            acknowledged_at: "2026-10-12T09:00:00Z",
            signature_note: "مطالعه و تعهد به رعایت",
          },
        ],
        cross_links: [],
      }),
    "/documents/documents/1/acknowledge/": () =>
      jsonResponse({
        message: "ثبت شد",
        acknowledgment: {
          id: 2,
          document: 1,
          version: 10,
          version_number: "2.0",
          user: 1,
          user_name: "علی",
          acknowledged_at: "2026-10-26T18:00:00Z",
        },
      }),
    ...overrides,
  };
}
