# Phase 10 — Training, Competency and PPE

## Baseline audit (before implementation)

- Branch: `main`
- HEAD at audit: `16ef509` (`9 final`), working tree clean.
- Phase 09 was already committed by the repository owner. No Phase 09 work is being rewritten.
- Real database: `backend/db.sqlite3` is 0 bytes and is not migrated or modified in this phase.
- Existing final Phase 09 evidence: 194 backend tests passing, 42 frontend tests passing, production build passing.
- The project does not contain a formal employee, training, competency, or PPE model.
- Users may belong to multiple organizations. Organization roles come from `Membership`.
- Existing roles: `org_admin`, `hse_manager`, `hse_inspector`, `workshop_supervisor`, `action_owner`, `executive_viewer`, `read_only_auditor`.
- PTW has a `requester`, `responsible_supervisor`, free-text `assigned_workers`, and explicit workflow action endpoints. There is no structured crew list and no competency check.
- Audit (`apps.auditlog.services.log_event`) and in-app notifications (`apps.notifications.services.notify_user`) are reusable.
- File upload is not implemented. PPE/certificate documents will remain textual references only.
- CSV export uses `apps.reports.views.ReportExportView` with `export_csv`.
- Frontend is React/TypeScript with Persian RTL pages, a single `NavTab` switch, and Vitest tests using `mockApi`.

## Architecture decision

A new Django app `apps.workforce` owns the Phase 10 domain:

- `Employee` — personnel identity, optionally linked to a login account.
- `TrainingCourse`, `TrainingSession`, `TrainingAttendance` — course catalogue, delivery events and historical attendance/assessment records.
- `Competency`, `EmployeeCompetency` — competency definitions and historical issuance/renewal/revocation records.
- `PPEItem`, `PPEStock`, `PPEAssignment`, `PPEAssignmentEvent` — catalogue, tenant/workplace stock, atomic issue/return/replace lifecycle and append-only history.

The PTW app receives two minimal additions:

- `Permit.assigned_employees` — structured crew relation, while retaining the legacy free-text `assigned_workers`.
- `PermitTypeCompetencyRequirement` — organization-configurable mapping from permit type to required competencies.

Competency validation is centralized in `apps.workforce.services` and called from the permit approval, activation, and resume services. Hiding UI buttons is never the enforcement mechanism.

## Data and safety rules

- Every domain record carries an organization. Cross-organization relations are rejected server-side.
- Employee numbers, course codes, competency codes, and PPE item codes are unique per organization.
- A user is optional on an employee; personnel without login accounts can receive training and PPE.
- A passed assessment requires a completed session, attended status, and completion date.
- Attendance is unique per session + employee. Re-taking a course creates a new session/attendance, not a silent overwrite.
- Course/session records are never hard-deleted.
- Effective competency status is computed lazily from the latest record:
  - revoked and suspended are never valid;
  - a record with `expires_on < today` is expired;
  - a record expiring within 30 days is expiring soon but remains valid;
  - missing or expired records never satisfy a PTW requirement.
- Renewal creates a new `EmployeeCompetency` record; prior records remain.
- Issuing a competency is an explicit action; it is not automatically derived from course attendance.
- PTW approval/activation/resume is rejected when a configured competency requirement is missing, expired, suspended, revoked, or cannot be resolved to a structured employee. Unverifiable is displayed as `unknown`, not as valid.
- PPE issue, return, and replacement run inside database transactions with row locks and never allow negative stock.
- Durable/serialized PPE cannot have two active assignments with the same serial number.
- PPE assignments and events are never hard-deleted; return/replacement/disposal is recorded as events.
- Sensitive actions are audited. Assignment to a linked user and failed safety validation notify/report clearly.
- No new scheduler is introduced; expiry/replacement warnings are lazy calculations and reports.

## Permissions

- `org_admin`, `hse_manager`: manage employees, courses, sessions, competencies, PPE catalogue/stock, and PTW competency rules.
- `org_admin`, `hse_manager`, `hse_inspector`: record attendance/results and issue/suspend/revoke competencies.
- `org_admin`, `hse_manager`, `hse_inspector`, `workshop_supervisor`: issue/return/replace PPE.
- Every active organization member can read Phase 10 data for their organization.
- `platform_admin` follows the existing platform-wide behavior.

## Task plan and status

| # | Task | Depends on | Status |
|---|------|------------|--------|
| 1 | Audit models, PTW, roles, audit/notification, seed, frontend patterns | — | DONE |
| 2 | Write Phase 10 plan and baseline | 1 | DONE |
| 3 | Add `workforce` models, migrations, admin | 2 | DONE |
| 4 | Add PTW crew/competency requirement models and migration | 3 | DONE |
| 5 | Implement centralized services, tenant rules, audit/notifications | 3,4 | DONE |
| 6 | Implement serializers/views/URLs and PTW competency endpoints | 5 | DONE |
| 7 | Add CSV exports and report integration | 6 | DONE |
| 8 | Add safe, idempotent Phase 10 demo data | 3–7 | DONE |
| 9 | Build Persian RTL workforce UI and PTW competency display | 6 | DONE |
| 10 | Add backend and frontend regression tests | 3–9 | DONE |
| 11 | Run checks, migrations check, full tests, build, diff checks | 10 | DONE |
| 12 | Write engineering report and Persian demo guide | 11 | DONE |

## Planned API surface

- `/api/v1/workforce/employees/` and `/employees/<id>/`
- `/api/v1/workforce/employees/<id>/training/`, `/competencies/`, `/ppe/`
- `/api/v1/workforce/courses/` and `/courses/<id>/`
- `/api/v1/workforce/training-sessions/` and `/training-sessions/<id>/`
- `/api/v1/workforce/training-attendances/` and `/training-attendances/<id>/`
- `/api/v1/workforce/competencies/` and `/competencies/<id>/`
- `/api/v1/workforce/employee-competencies/`, `/employee-competencies/<id>/`, `.../status/`
- `/api/v1/workforce/permit-requirements/` and `/permit-requirements/<id>/`
- `/api/v1/workforce/ppe-items/` and `/ppe-items/<id>/`
- `/api/v1/workforce/ppe-stock/` and `/ppe-stock/<id>/`
- `/api/v1/workforce/ppe-assignments/`, `/ppe-assignments/<id>/`, `.../return/`, `.../replace/`, `.../dispose/`
- `/api/v1/workforce/stats/`
- `/api/v1/permits/<id>/` includes `assigned_employees` and `competency_validation`
- `/api/v1/reports/export/training/`, `.../competencies/`, `.../ppe/`

## Acceptance criteria

- Tenant isolation is tested across lists, details, create relations, PTW checks and reports.
- All critical workflow checks are server-side.
- Full backend/frontend suites and build pass with recorded output.
- Seed is idempotent, synthetic, password-safe, and tested on a separate database.
- The Persian demo guide reflects verified accounts and scenarios.
- No commit, push, deploy, real database reset, Docker, or fabricated result.
