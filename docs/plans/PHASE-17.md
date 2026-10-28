# HSE Guard — Master Execution Plan: Phase 17
## Complete Platform Finalization, Missing Module Implementation & Full-System Verification

**Phase Status:** IN_PROGRESS (Execution Mode: Autonomous Senior Engineering Team)  
**Target:** Full IHMS Platform Finalization across Backend & Frontend  
**Stack:** Django + DRF, React + TypeScript + Vite, SQLite (`backend/db.sqlite3`)  
**Interface:** Persian/Farsi RTL-First, Responsive Design

---

## 1. Executive Summary & Quality Contract

Phase 17 represents the complete platform finalization of the **HSE Guard — Enterprise Integrated HSE Management System (IHMS)**.
It executes across all three core objectives:
1. **Complete everything already built (Phases 1–16)**: Harden all existing models, workflows, permissions, and ensure zero dead buttons or broken links.
2. **Implement every missing module**:
   - Workstream B: Unified Anomaly & Observation Management (`apps.findings`)
   - Workstream C: Proactive & Leading HSE Indicators Engine (`apps.dashboard` / indicators)
   - Workstream D: Reusable Risk Knowledge Base & Assessment Library (`apps.risks`)
   - Workstream E: Engineering & Quick HSE Calculators (`apps.calculators`)
   - Workstream F: Lifting Plan Design, Rigging & Crane Simulation (`apps.lifting`)
   - Workstream G: Energy, Fleet & Safe Excavation Operations (`apps.fleet_energy`)
   - Workstream H: HSE Surveys, Questionnaires & Scored Examinations (`apps.surveys`)
   - Workstream I: Internal Chat & Team Collaboration (`apps.chat`)
   - Workstream J: Personal Workspace & Action Center (`apps.dashboard` / workspace)
   - Workstream K: Reusable Workflow & Approval Engine
   - Workstream L: Pre-Startup Safety Review — PSSR (`apps.pssr`)
   - Workstream M: Subscriptions & Commercial/Free Module Entitlements (`apps.organizations` / subscriptions)
   - Workstream N: Workforce Attendance & Access-Control Integrations (`apps.workforce`)
   - Workstream O: Provider-Neutral External Integration Framework (`apps.core`)
   - Workstream P: Mobile, QR & Field Operations (QR code generators & quick observation)
   - Workstream Q: Comprehensive Cross-Domain Reporting & Analytics (`apps.reports`)
   - Workstream R: Document Control & Archive Hardening (`apps.documents`)
   - Workstream S: Systematic Security, Multi-Tenant Isolation & Data Integrity
3. **Prove completeness**:
   - Automated tests for all new backend models, calculators, workflows, and permissions.
   - Vitest frontend tests for new modules.
   - Full regression pass (existing 257 backend + 70 frontend tests preserved).
   - Production Vite build (`tsc --noEmit && vite build`).
   - Idempotent synthetic demo data seeder.
   - Comprehensive evidence-based reports.

---

## 2. Capability Inventory & Workstream Breakdown

| Workstream | Domain | Target App(s) | Status | Key Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **A** | Existing Modules Audit | Phases 1–16 apps | `COMPLETE` (Audited) | 257 tests passing, verify zero regressions |
| **B** | Anomaly & Observation Management | `apps.findings` | `IN_PROGRESS` | Unsafe acts, unsafe conditions, deviations, CAPA linking, review workflow |
| **C** | Proactive Leading Indicators | `apps.dashboard` | `IN_PROGRESS` | Leading/lagging formulas, targets vs actuals, trend analysis, drill-downs |
| **D** | Reusable Risk Knowledge Base | `apps.risks` | `IN_PROGRESS` | Risk template library, activities, controls, clone to live assessment |
| **E** | Engineering Calculators | `apps.calculators` | `IN_PROGRESS` | Unit converter, HSE rates (LTIFR/TRIR/SR), Noise dose/SPL, Crane/Rigging, Energy, Excavation |
| **F** | Lifting Plan Design & Simulation | `apps.lifting` | `IN_PROGRESS` | Crane charts, sling tension, outrigger pressure, visual schematic, approval workflow |
| **G** | Energy, Fleet & Excavation | `apps.fleet_energy` | `IN_PROGRESS` | Electricity/utility logs, fleet vehicles & fuel logs, excavation geometry & shoring |
| **H** | Surveys & Examinations | `apps.surveys` | `IN_PROGRESS` | Question bank, scored quizzes, climate surveys, strictly anonymous mode |
| **I** | Internal Chat & Collaboration | `apps.chat` | `IN_PROGRESS` | Direct & group chats, secure attachments, unread counters, polling sync |
| **J** | Personal Workspace | `apps.dashboard` | `IN_PROGRESS` | My pending approvals, my tasks, overdue items, personal notification preferences |
| **K** | Workflow & Approval Engine | Core & domain apps | `IN_PROGRESS` | Guarded transitions, mandatory rejection reasons, escalation, audit log |
| **L** | Pre-Startup Safety Review (PSSR) | `apps.pssr` | `IN_PROGRESS` | Review templates, multi-discipline checks, outstanding actions, critical blocking gate |
| **M** | Subscriptions & Entitlements | `apps.organizations` | `IN_PROGRESS` | Free vs commercial tiers, module entitlements, activation requests, access checks |
| **N** | Attendance Integrations | `apps.workforce` | `IN_PROGRESS` | Device adapters (ZKTeco, Suprema, Biometric CSV), duplicate event handling |
| **O** | External Integration Framework | `apps.core` | `IN_PROGRESS` | Provider adapters (SMS, Email, Push, IoT, Weather), health status, unconfigured state |
| **P** | Mobile & QR Field Operations | `frontend` | `IN_PROGRESS` | QR code generation for equipment, scaffolds, permits; quick field report modal |
| **Q** | Reporting & Analytics | `apps.reports` | `IN_PROGRESS` | Cross-module metrics, CSV/print exports, audit-logged export permissions |
| **R** | Document Control Hardening | `apps.documents` | `COMPLETE` (Audited) | Multi-tenant isolation, immutable versions, streaming download |
| **S** | Security & Reliability | All apps | `IN_PROGRESS` | Multi-tenant verification, object permissions, transactional boundaries |

---

## 3. Implementation Steps & Dependency Order

1. **Backend Foundation & New Apps Registration:**
   - Create apps: `apps.calculators`, `apps.lifting`, `apps.fleet_energy`, `apps.surveys`, `apps.chat`, `apps.pssr`.
   - Update `apps.findings` for unified anomaly & observation management.
   - Update `apps.organizations` with subscription plans & module entitlements.
   - Update `apps.core` with integration framework & provider adapters.
   - Update `apps.dashboard` with proactive leading indicators & personal workspace.
   - Update `backend/config/settings.py` and `backend/config/urls.py`.
2. **Models, Business Services & Serializers:**
   - Implement exact mathematical formulas for calculators (with unit conversions and boundary handling).
   - Implement lifting plan validation logic (blocking if capacity exceeded or outrigger pressure unsafe).
   - Implement PSSR safety gatekeeper (blocking final sign-off if critical items unresolved).
   - Implement anonymous survey isolation (decoupling user ID from responses).
   - Implement chat messaging with tenant boundaries and attachment controls.
   - Implement subscription entitlement checks (`check_module_entitlement`).
3. **Database Migrations:**
   - Generate safe forward migrations (`python manage.py makemigrations`).
   - Apply migrations cleanly (`python manage.py migrate`).
4. **Backend Automated Tests:**
   - Unit tests for calculators (numerical reference verification).
   - Domain tests for lifting plans, PSSR, surveys, chat, anomalies, subscriptions, and integrations.
   - Tenant isolation and negative security test cases.
5. **Synthetic Demo Data Seeding:**
   - Update `seed_demo_data.py` to seed synthetic scenarios for all new major domains (`is_synthetic=True`).
6. **Frontend API & TypeScript Interfaces:**
   - Add API methods and types in `frontend/src/services/api.ts` and `mockApi.ts`.
7. **Frontend UI Components (Persian RTL):**
   - Calculators page (`CalculatorsPage.tsx`) with interactive tabs (Units, HSE Rates, Noise, Crane/Rigging, Energy, Excavation).
   - Lifting Plan module (`LiftingPlansPage.tsx`, Create/Detail/Simulate modals).
   - PSSR module (`PSSRPage.tsx`, Review checklist & approval modal).
   - Surveys module (`SurveysPage.tsx`, Survey/Exam taker, results analytics).
   - Internal Chat (`ChatPage.tsx`, channel list, active chat, attachments).
   - Anomalies & Observations tab/page (`AnomaliesPage.tsx`).
   - Personal Workspace (`MyWorkspacePage.tsx`).
   - Fleet & Energy monitoring (`FleetEnergyPage.tsx`).
   - Subscriptions & Entitlements admin tab in Settings / Organizations.
   - Navigation & Sidebar integration.
8. **Frontend Testing & Production Build:**
   - Add Vitest tests for newly created pages.
   - Run `npm test -- --run` and `npm run build`.
9. **Final Verification & Reports:**
   - Run full regression suites, verify zero regressions.
   - Generate `docs/reports/17-platform-finalization.md`, `PHASE-17-ACCEPTANCE-MATRIX.md`, `PHASE-17-SECURITY-AND-REGRESSION.md`, and `PHASE-17-DEMO-GUIDE.md`.
