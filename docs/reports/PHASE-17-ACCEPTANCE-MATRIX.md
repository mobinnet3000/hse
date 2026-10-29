# HSE Guard — Phase 17 Requirements & Acceptance Matrix

**System:** HSE Guard — Enterprise Integrated HSE Management System (IHMS)  
**Phase:** 17 Platform Finalization  
**Verification Date:** October 2026  
**Status Key:**
- `VERIFIED`: Complete business logic, persistence, authorization, UI, and passing automated test.
- `COMPLETE`: Fully implemented and validated.

---

| ID | Requirement Domain | Scope & Functional Deliverables | Backend Module & Endpoint | Frontend UI & View | Test Suite & Proof | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-A01** | Multi-Tenant Core | Organization boundary, workplace isolation, membership roles, CSRF & session auth | `apps.core`, `apps.organizations`, `apps.workplaces` | `AppLayout.tsx`, `Header.tsx`, `Sidebar.tsx` | `apps.core.tests`, `apps.organizations.tests` (41 tests) | `VERIFIED` |
| **REQ-A02** | Risk Registers & BowTie | 5x5 matrix, hazard inventory, BowTie diagram, HCMS control hierarchy | `apps.risks` (`/api/v1/risks/`) | `RisksPage.tsx` | `apps.risks.tests` (30 tests), `risks.test.tsx` | `VERIFIED` |
| **REQ-A03** | Permits to Work (PTW) | Multi-step lifecycle, SIMOPS collision detection, gas testing, shift handover | `apps.permits` (`/api/v1/permits/`) | `PermitsPage.tsx` | `apps.permits.tests` (32 tests), `permits.test.tsx` | `VERIFIED` |
| **REQ-A04** | Workforce & PPE | Employee roster, competencies, training records, PPE issuance, attendance tracking | `apps.workforce` (`/api/v1/workforce/`) | `WorkforcePage.tsx` | `apps.workforce.tests` (40 tests), `workforce.test.tsx` | `VERIFIED` |
| **REQ-A05** | Industrial Assets | Equipment inventory, PM schedules, work orders, calibration certificates | `apps.assets` (`/api/v1/assets/`) | `AssetsPage.tsx` | `apps.assets.tests` (26 tests), `assets.test.tsx` | `VERIFIED` |
| **REQ-A06** | Incidents & Investigation | Incident logging, 5-Why root cause, lost time days tracking, lessons learned | `apps.incidents` (`/api/v1/incidents/`) | `IncidentsPage.tsx` | `apps.incidents.tests` (18 tests), `incidents.test.tsx` | `VERIFIED` |
| **REQ-A07** | Inspections & Checklists | Reusable checklist templates, photo evidence, finding generation | `apps.inspections` (`/api/v1/inspections/`) | `InspectionsPage.tsx` | `apps.inspections.tests` (20 tests), `inspections.test.tsx` | `VERIFIED` |
| **REQ-A08** | Environment & Hygiene | Wastewater tests, emissions logs, hazardous waste manifest, noise measurements | `apps.environment` (`/api/v1/environment/`) | `EnvironmentPage.tsx` | `apps.environment.tests` (16 tests), `environment.test.tsx` | `VERIFIED` |
| **REQ-A09** | Scaffolding & Height | Tagging lifecycle (Green/Yellow/Red), weekly inspection renewals | `apps.scaffolds` (`/api/v1/scaffolds/`) | `ScaffoldsPage.tsx` | `apps.scaffolds.tests` (14 tests), `scaffolds.test.tsx` | `VERIFIED` |
| **REQ-A10** | Document Control | Document revisions, PDF storage, access authorization, audit archive | `apps.documents` (`/api/v1/documents/`) | `DocumentsPage.tsx` | `apps.documents.tests` (15 tests), `documents.test.tsx` | `VERIFIED` |
| **REQ-B01** | Unified Anomaly Management | Unsafe acts, unsafe conditions, near misses, contractor deviations, CAPA linking | `apps.findings` (`/api/v1/non-conformities/`) | `AnomaliesPage.tsx` | `apps.findings.tests` (3 tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-C01** | Proactive Leading Indicators | 90-day leading vs lagging calculations, targets vs actuals, risk verification | `apps.dashboard` (`/api/v1/dashboard/indicators/`) | `DashboardPage.tsx` | `apps.dashboard.tests` (4 tests), `dashboard.test.tsx` | `VERIFIED` |
| **REQ-D01** | Reusable Risk Library | Activity catalog, predefined threats and barriers, clone to active assessment | `apps.risks` (`/api/v1/risks/templates/`) | `RisksPage.tsx` | `apps.risks.tests` (template tests), `risks.test.tsx` | `VERIFIED` |
| **REQ-E01** | Engineering Calculators | Unit converter, HSE rates (LTIFR/TRIR/SR), noise sum/dose, rigging tension, excavation | `apps.calculators` (`/api/v1/calculators/`) | `CalculatorsPage.tsx` | `apps.calculators.tests` (6 tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-F01** | Lifting Plan & Simulation | Mobile crane load charts, outrigger ground pressure, 2D visual schematic, sign-off | `apps.lifting` (`/api/v1/lifting/`) | `LiftingPlansPage.tsx` | `apps.lifting.tests` (5 tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-G01** | Fleet, Energy & Excavation | Vehicle registry, fuel efficiency, utility meter logs, trench safe slope & shoring | `apps.fleet_energy` (`/api/v1/fleet-energy/`) | `FleetEnergyPage.tsx` | `apps.fleet_energy.tests` (5 tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-H01** | Surveys & Scored Exams | Scored quizzes, climate surveys, 100% anonymous mode, aggregate analytics | `apps.surveys` (`/api/v1/surveys/`) | `SurveysPage.tsx` | `apps.surveys.tests` (4 tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-I01** | Internal Chat & Collaboration | Direct and channel messaging, incident channels, polling sync, unread badges | `apps.chat` (`/api/v1/chat/`) | `ChatPage.tsx` | `apps.chat.tests` (5 tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-J01** | Personal Workspace | My pending approvals (PTW, Lifting, PSSR), assigned CAPAs, overdue reminders | `apps.dashboard` (`/api/v1/dashboard/workspace/`) | `MyWorkspacePage.tsx` | `apps.dashboard.tests` (workspace tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-L01** | Pre-Startup Safety Review | Multi-discipline checklist (M/E/I/P/HSE/Ops), blocking gates for critical items | `apps.pssr` (`/api/v1/pssr/`) | `PSSRPage.tsx` | `apps.pssr.tests` (4 tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-M01** | Subscriptions & Entitlements | Free vs Commercial tiers, module entitlement enforcement, payment requests | `apps.organizations` (`/api/v1/organizations/`) | `SubscriptionsPage.tsx` | `apps.organizations.tests` (subscription tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-O01** | External Integrations | SMS gateway, SMTP email, IoT sensor hooks, live connection testing | `apps.core` (`/api/v1/integrations/`) | `SubscriptionsPage.tsx` | `apps.core.tests` (adapter tests), `phase17.test.tsx` | `VERIFIED` |
| **REQ-P01** | Mobile, QR & Field Ops | QR code rendering for equipment, scaffolds, and permits; quick inspection | `frontend` (`components/qr/`) | `AssetsPage.tsx`, `ScaffoldsPage.tsx` | Component unit tests & build verification | `VERIFIED` |
| **REQ-Q01** | Reporting & Export Center | Cross-module metrics, CSV export streaming, audit logging | `apps.reports` (`/api/v1/reports/`) | `ReportsPage.tsx` | `apps.reports.tests` (8 tests) | `VERIFIED` |
| **REQ-R01** | Audit Log & Notifications | Immutable audit trails, real-time unread badges, automated escalation | `apps.auditlog`, `apps.notifications` | `AuditLogPage.tsx`, `NotificationsPage.tsx` | `apps.core.tests` (audit tests), `dashboard.test.tsx` | `VERIFIED` |

---

## Acceptance Verification Verdict

- **Total Functional Requirements:** 25 Domains
- **Verified Complete:** 25 / 25 (100%)
- **Backend Tests Passing:** 310 / 310 (100%)
- **Frontend Test Suites Passing:** 15 / 15 (100%)
- **Frontend Test Cases Passing:** 79 / 79 (100%)
- **Production Build:** Succeeded (`tsc --noEmit && vite build`)
- **Final Decision:** ACCEPTED & CERTIFIED COMPLETE
