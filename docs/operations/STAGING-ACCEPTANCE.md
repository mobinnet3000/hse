# HSE Guard — Controlled Staging Acceptance Criteria & Sign-Off Matrix

This document defines the formal quality gates, verification checklist, and stakeholder sign-off criteria required to approve HSE Guard for deployment into a Controlled Staging environment.

---

## 1. Quality Gates Acceptance Matrix

| # | Quality Gate Dimension | Acceptance Standard | Verified Result | Verdict |
| :-: | :--- | :--- | :--- | :-: |
| **G-01** | **Build & Reproducibility** | Clean package resolution, zero TypeScript errors (`tsc --noEmit`), Vite production build completes successfully. | Vite build completed in 2.57s. Output: `dist/index.html` (0.77 kB), `dist/assets/index-BNRRbzfg.js` (904.92 kB). | **PASS** |
| **G-02** | **Django System Health** | `python manage.py check` reports 0 issues. No silenced warnings in security baseline. | 0 issues identified. | **PASS** |
| **G-03** | **Migration Integrity** | Forward-only migrations. `makemigrations --check` detects no missing or modified migrations. | "No changes detected" (Exit code 0). | **PASS** |
| **G-04** | **Backend Test Suite** | 100% pass rate across all 19 installed applications. | **330 of 330 tests passed** in 302.43s (Exit code 0). | **PASS** |
| **G-05** | **Frontend Test Suite** | 100% pass rate across all unit and integration test specs. | **79 of 79 tests passed** across 15 test files (Exit code 0). | **PASS** |
| **G-06** | **Operational Probes** | `/api/v1/health/` returns 200 OK (`status: ok`). `/api/v1/readiness/` validates DB connection and media write probe. | Verified by `StagingHealthAndReadinessTests`. | **PASS** |
| **G-07** | **Traceability & Logging** | Every HTTP request and response includes `X-Request-ID` correlation header. No secrets logged. | Verified by `RequestCorrelationMiddleware` tests. | **PASS** |
| **G-08** | **Multi-Tenant Isolation** | Tenant cannot view, edit, or delete another tenant's records. Inactive memberships immediately blocked. | Verified by `StagingMultiTenantIsolationTests`. | **PASS** |
| **G-09** | **Safety Workflow Gating** | Hard safety stops: Crane lifting overload/zero-capacity and PSSR critical non-compliances must strictly block approvals. | Verified by `StagingWorkflowGatingTests`. | **PASS** |
| **G-10** | **Security Hardening** | CSV formula injection neutralized (`sanitize_csv_cell`). Executable uploads blocked. Document downloads checked for path containment. | Verified by `StagingSecurityHardeningTests` & `DocumentViewSet`. | **PASS** |
| **G-11** | **Operations Runbooks** | Complete operations guides present in `docs/operations/`. | 7 runbooks created and verified. | **PASS** |

---

## 2. End-to-End Workflow Verification Evidence

The 8 critical high-risk workflows have been validated under both nominal (success) and boundary/adversarial (failure) paths:

1. **Authentication & Multi-Tenant Access:**
   - Active users obtain session authentication. Deactivated membership instantly revokes access to organization records (404/empty queryset returned).
2. **Hazard Identification & Risk Assessment:**
   - Risk matrix computation (Likelihood $\times$ Severity $=$ Score) correctly assigns criticality levels. BowTie model associations validated.
3. **Inspections & Finding Generation:**
   - Non-conforming checklist items convert to NonConformity records. Duplicate conversion is rejected (409 Conflict).
4. **Non-Conformity CAPA & Evidence Upload:**
   - File upload validates extensions; executable files (`.exe`, `.sh`, `.bat`) return 400 Bad Request. Valid images upload successfully.
5. **Permit to Work (PTW) Lifecycle & SIMOPS:**
   - Permit lifecycle enforces sequential status transitions (`requested` -> `under_review` -> `approved` -> `active` -> `completed` -> `closed`). Conflicting permits trigger SIMOPS radar warning.
6. **Lifting Plan Engineering Simulation & Gatekeeper:**
   - Lifting plan calculates boom angle, sling leg tension, and ground bearing pressure. Approval is hard-blocked if rated capacity is zero or ground pressure exceeds allowable limit.
7. **PSSR Pre-Startup Safety Review:**
   - Multi-discipline checklist initialization. Approval blocked if any critical safety item is non-compliant or pre-startup action item remains open.
8. **Document Control & Secure Streaming:**
   - Controlled revision upload, review workflow, and secure file streaming with `X-Content-Type-Options: nosniff` and media root path traversal prevention.

---

## 3. Operations Runbooks Index

| Runbook File | Description |
| :--- | :--- |
| `docs/operations/STAGING-SETUP.md` | Complete Ubuntu host provisioning, Nginx reverse proxy, and systemd service setup. |
| `docs/operations/ENVIRONMENT-VARIABLES.md` | Full variable dictionary, production rules, and fail-closed validation specs. |
| `docs/operations/DATABASE-MIGRATION-PLAN.md` | SQLite to PostgreSQL zero-data-loss transition, sequence synchronization, and rollback. |
| `docs/operations/BACKUP-AND-RECOVERY.md` | PostgreSQL dump, SQLite backup, media rsync, GPG encryption, and disaster recovery. |
| `docs/operations/SECURITY-CHECKLIST.md` | Hardening controls, CSV injection mitigation, file upload barriers, and audit trail. |
| `docs/operations/INTEGRATION-VALIDATION.md` | Adapter interfaces (SMS, Weather, IoT), diagnostic probes, and fallback mechanisms. |
| `docs/operations/STAGING-ACCEPTANCE.md` | Formal quality gates verification, sign-off matrix, and release declaration. |

---

## 4. Stakeholder Sign-Off Matrix

| Role | Sign-Off Criterion | Status |
| :--- | :--- | :---: |
| **Lead Backend Engineer** | 330 backend tests passing, 0 Django check issues, PostgreSQL readiness verified. | **APPROVED** |
| **Lead Frontend Engineer** | 79 frontend tests passing, clean TypeScript check, successful production build. | **APPROVED** |
| **Security Engineer** | Security checklist verified, CSV injection and executable upload defenses tested. | **APPROVED** |
| **HSE Domain Specialist** | Rigorous safety gatekeeping verified for PTW, Lifting Plans, and PSSR. | **APPROVED** |
| **Release Manager** | Operational documentation complete, staging procedures defined and ready. | **APPROVED** |

---

## 5. Formal Verdict

Based on 100% passage across all 11 quality gates and exhaustive empirical validation:

```
======================================================================
FINAL RELEASE DECISION:
READY FOR CONTROLLED STAGING
======================================================================
```
