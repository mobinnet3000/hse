# Plan: Pre-Phase 11 Product Completion, Complete UI/UX Redesign & 10-Phase Audit

## Objective
Audit the first 10 phases of HSE Guard, identify and repair functional/integration gaps, build a comprehensive multi-tenant demo data suite on an isolated database, create a unified Design System with Light/Dark/System themes, and execute a complete UI/UX redesign of the layout, dashboard, and all module pages.

## Task Breakdown & Dependency Matrix

| ID | Task | Depends On | Status | Acceptance Criteria |
|---|---|---|---|---|
| **T01** | Initial Environment & Codebase Audit across Phases 1–10 | — | DONE | Git status clean, HEAD recorded, inspection of all 10 domain apps, reports, and existing tests. |
| **T02** | Create Dependency-Aware Task Plan (`PRE_PHASE_11_PRODUCT_COMPLETION.md`) | T01 | DONE | Documented plan with task owners, dependencies, and verification criteria. |
| **T03** | Backend Defects & Missing Integration Fixes | T01 | DONE | Add missing report exports (`permits`, `incidents`), verify error handling in edge cases, ensure all endpoints reject cross-tenant access. |
| **T04** | Enhanced Multi-Tenant Demo Data (`seed_demo_data.py`) | T03 | DONE | Rich synthetic data for both `foolad-alborz` and `sepehr-petro` across all 10 modules, idempotent, tested on isolated database. |
| **T05** | Unified Design System & Design Tokens (`global.css`, variables) | T01 | DONE | Color tokens, elevations, typography, radii, semantic states, complete `:root[data-theme="light"]` and `[data-theme="dark"]`. |
| **T06** | Theme Provider & Toggle Engine (Light / Dark / System) | T05 | DONE | `ThemeContext.tsx`, local storage persistence, system preference auto-detection, keyboard and visual toggle in Header. |
| **T07** | Reusable Core UI Components | T05, T06 | DONE | StatusBadge, Button, Card, Modal, SearchFilterBar, EmptyState, LoadingState, ErrorState, Responsive Table wrappers. |
| **T08** | Redesign Shell & Navigation (`AppLayout.tsx`, `Sidebar.tsx`, `Header.tsx`) | T06, T07 | DONE | Collapsible sidebar, grouped domain categories, active state indicators, mobile drawer, breadcrumbs, tenant switcher, user profile chip. |
| **T09** | Redesign Executive Dashboard (`DashboardPage.tsx`) | T07, T08 | DONE | Multi-domain KPI cards (incidents, permits, capa, assets, workforce), urgent items, role-aware sections, trend meters, zero hardcoded numbers. |
| **T10** | Redesign Module Pages (Workforce, Permits, Assets, Incidents, etc.) | T07, T08 | DONE | Replace inline hardcoded styles with design system tokens, responsive data tables, accessible modals, empty/loading states. |
| **T11** | Backend Tests Execution & Verification | T03, T04 | DONE | Full Django test suite passing (211+ tests) with zero failures. |
| **T12** | Frontend Tests Execution & Verification | T06-T10 | DONE | Vitest test suite updated and passing for theme switcher, layout, dashboard, and redesigned components. |
| **T13** | Quality Gates & Production Build Verification | T11, T12 | DONE | `npm run build` cleanly succeeds, `makemigrations --check` detects no drift. |
| **T14** | Comprehensive Engineering Documentation | T03-T13 | DONE | `PRE_PHASE_11_PRODUCT_AUDIT.md`, `PRE_PHASE_11-DEMO-GUIDE.md`, `PRE_PHASE_11-UI-UX.md`, and updates to `TECHNICAL.md` and `README.md`. |

---

## Safety Constraints
- **NO Docker or container workflows.**
- **NO Git commit, push, or deployment.**
- **DO NOT reset or modify the real database (`backend/db.sqlite3`).**
- **All demo seeding tested exclusively on isolated SQLite file.**
- **All demo data must be flagged `is_synthetic=True`.**
- **Existing user passwords and secrets must never be reset or overwritten.**
