# HSE Guard — Master Execution Plan: Phase 16
## HSE Document Control, Versioning & Secure Archive

**Phase Status:** VERIFIED  
**Execution Target:** `apps/documents` (Backend) & `frontend/src/features/documents` (Frontend)  
**Security Level:** Tenant-Isolated, Role-Guarded, Immutable-Versions, Secure File Stream

---

## 1. Executive Summary & Goals

Phase 16 establishes a centralized, enterprise-grade **HSE Document Control & Secure Archive** subsystem within the HSE Guard platform. In industrial HSE environments, documents (Safety Policies, Standard Operating Procedures [SOPs], Emergency Response Plans, Work Instructions, Safety Data Sheets [SDS], Permits, Training Manuals, and Audit Certificates) are legal and operational lifelines.

Key objectives:
1. **Configurable Document Registry:** Unique reference numbering (`DOC-XXX-000`), categories, department, confidentiality levels (`public`, `internal`, `confidential`, `strictly_confidential`), site/workplace linkages, and owner/author tracking.
2. **Strict Lifecycle State Machine:** 
   `draft` → `submitted` → `under_review` → `approved` → `effective` → `superseded` | `expired` | `archived` | `withdrawn` (with `rejected` for rework).
3. **Immutable Revisions & Versioning:** Every revision creates an immutable `DocumentVersion` with hash, size, mime type, change summary, and reviewer approval history. Superseded versions are preserved and cannot be mutated.
4. **Secure File Vault:** Secure file uploads, sanitized storage naming, strict tenant-scoped streaming endpoints (`/api/v1/documents/documents/<id>/download/` and `/preview/`). Private file paths and media root are never exposed publicly.
5. **Read Receipts & Employee Acknowledgment:** Track required employee acknowledgments, deadlines, and compliance percentages.
6. **Integration with HSE Domains:** Cross-link documents to PTW, Workforce, Equipment, Incidents, Risks, and Environment without data duplication.
7. **Full Audit Trail & Notifications:** Event logging for uploads, revisions, approvals, rejections, downloads, and archives; automated notifications for pending reviews and expiring documents.
8. **Persian-First RTL UI:** High-fidelity document register, filters, revision history, approval modal, acknowledgment tracking, and review-due queues.

---

## 2. Architecture & Data Model Specification

### 2.1 Domain Models (`apps/documents/models.py`)

1. **`DocumentCategory`** (Optional/Configurable, or TextChoices + Organization-defined):
   - Standard categories: `policy` (خط‌مشی), `procedure` (روش اجرایی / SOP), `work_instruction` (دستورالعمل کاری), `form` (فرم و چک‌لیست), `sds` (برگه اطلاعات ایمنی مواد / SDS), `risk_assessment` (ارزیابی ریسک / JSA), `permit_template` (مجوز و پروانه کار), `certificate` (گواهینامه و استاندارد), `training_material` (جزوه و محتوای آموزشی), `inspection_audit` (گزارش بازرسی و ممیزی), `technical_file` (پرونده فنی و نقشه‌ها), `environmental_record` (سوابق زیست‌محیطی), `other` (سایر).

2. **`Document`**:
   - `organization`: FK to `organizations.Organization` (tenant-scoped).
   - `document_number`: CharField(max_length=100, db_index=True) — Unique per organization.
   - `title`: CharField(max_length=255).
   - `description`: TextField(blank=True).
   - `category`: CharField(max_length=50, choices=DocumentCategory.choices).
   - `confidentiality`: CharField(choices: `public`, `internal`, `confidential`, `strictly_confidential`, default=`internal`).
   - `status`: CharField(choices: `draft`, `submitted`, `under_review`, `approved`, `effective`, `rejected`, `superseded`, `expired`, `archived`, `withdrawn`, default=`draft`).
   - `department`: CharField(max_length=150, blank=True).
   - `workplace`: FK to `workplaces.Workplace` (null=True, blank=True).
   - `owner`: FK to `accounts.User` (responsible custodian).
   - `author`: FK to `accounts.User` (creator/author).
   - `assigned_reviewer`: FK to `accounts.User` (null=True, blank=True).
   - `current_version`: FK to `DocumentVersion` (null=True, blank=True, related_name="current_for_documents").
   - `effective_date`: DateField(null=True, blank=True).
   - `next_review_date`: DateField(null=True, blank=True).
   - `expiry_date`: DateField(null=True, blank=True).
   - `retention_years`: IntegerField(default=5).
   - `archived_at`: DateTimeField(null=True, blank=True).
   - `archived_reason`: TextField(blank=True).
   - `tags`: CharField(max_length=255, blank=True).
   - `requires_acknowledgment`: BooleanField(default=False).
   - `acknowledgment_target_roles`: JSONField(default=list, blank=True).
   - `is_synthetic`: BooleanField(default=False).
   - `created_at` / `updated_at`.

3. **`DocumentVersion`** (Immutable):
   - `document`: FK to `Document` (related_name="versions").
   - `version_number`: CharField(max_length=30) — e.g., "1.0", "1.1", "2.0".
   - `file`: FileField(upload_to=secure_document_upload_path).
   - `original_filename`: CharField(max_length=255).
   - `file_size_bytes`: BigIntegerField(default=0).
   - `file_hash_sha256`: CharField(max_length=64, blank=True).
   - `mime_type`: CharField(max_length=100, blank=True).
   - `change_summary`: TextField(blank=True).
   - `uploaded_by`: FK to `accounts.User`.
   - `status`: CharField(choices: `draft`, `under_review`, `approved`, `rejected`, `superseded`, `archived`, default=`draft`).
   - `reviewed_by`: FK to `accounts.User` (null=True, blank=True).
   - `reviewed_at`: DateTimeField(null=True, blank=True).
   - `review_notes`: TextField(blank=True).
   - `created_at`: DateTimeField(auto_now_add=True).

4. **`DocumentAcknowledgment`**:
   - `document`: FK to `Document` (related_name="acknowledgments").
   - `version`: FK to `DocumentVersion` (related_name="acknowledgments").
   - `user`: FK to `accounts.User` (related_name="document_acknowledgments").
   - `acknowledged_at`: DateTimeField(auto_now_add=True).
   - `signature_note`: CharField(max_length=255, blank=True).
   - UniqueConstraint: `[document, version, user]`.

5. **`DocumentReviewLog`**:
   - `document`: FK to `Document` (related_name="review_logs").
   - `version`: FK to `DocumentVersion` (null=True, blank=True).
   - `reviewer`: FK to `accounts.User`.
   - `action`: CharField(choices: `submitted`, `approved`, `rejected`, `superseded`, `archived`, `restored`).
   - `decision_reason`: TextField(blank=True).
   - `created_at`: DateTimeField(auto_now_add=True).

6. **`DocumentLink`** (Cross-Domain Integrations):
   - `document`: FK to `Document` (related_name="cross_links").
   - `target_type`: CharField(choices: `permit`, `asset`, `incident`, `risk`, `scaffold`, `environmental_aspect`, `contractor`).
   - `target_id`: PositiveIntegerField().
   - `link_note`: CharField(max_length=255, blank=True).
   - `created_by`: FK to `accounts.User`.
   - `created_at`: DateTimeField(auto_now_add=True).

---

## 3. Workflow & Business Rules

1. **Sequential Lifecycle:**
   - A document starts in `draft`.
   - Creator submits for review (`submit_for_review`), status becomes `under_review`.
   - Authorized reviewer (`HSE_MANAGER`, `ORG_ADMIN`, or specific `assigned_reviewer`) can:
     - `approve`: Version becomes `approved`, document status becomes `approved` (or `effective` if effective_date <= today). Any previous approved version is marked `superseded`.
     - `reject`: Version becomes `rejected`, requires a non-empty `reason`. Creator can update or submit a new revision.
   - Scheduled / on-demand status evaluation:
     - If `expiry_date` is past, status shifts to `expired`.
     - If `next_review_date` is <= 14 days, document appears in review-due queue and notification is dispatched.
   - Archive:
     - `archive`: Document moved to `archived` with mandatory `reason`.
     - `restore`: Document restored from archive to `superseded` or `draft`.

2. **File Security & Confidentiality:**
   - Files are stored in `media/documents/<org_id>/<uuid>.<ext>` with random UUID names, preventing file guessing or path traversal.
   - No direct URL serving: downloads must go through `/api/v1/documents/documents/<id>/download/` or `/preview/`.
   - Strict confidentiality permissions:
     - `public` / `internal`: accessible to all active organization members.
     - `confidential`: accessible to managers (`ORG_ADMIN`, `HSE_MANAGER`, `WORKSHOP_SUPERVISOR`, author, owner, reviewer).
     - `strictly_confidential`: accessible only to `ORG_ADMIN`, `HSE_MANAGER`, author, owner.

3. **Audit Log & Notifications:**
   - Every state transition, upload, download, and review decision logs an `AuditEvent` with `entity_type="Document"`.
   - Notifications dispatched to reviewer on submission, author on approval/rejection, and workers for required acknowledgments.

---

## 4. Frontend Design & Persian RTL Features

- **Document Register View:**
  - Search by title, document number, tags.
  - Filter by Category, Status, Confidentiality, Department, Workplace.
  - Quick Tabs: All Documents, Active & Effective, Pending Review, Review Due / Expiring, Archive.
  - Summary KPI cards: Total Documents, Effective & Approved, Under Review, Expiring / Overdue Review, Acknowledgment Rate.
- **Document Detail & Version History:**
  - Metadata overview (number, status badge, confidentiality badge, dates).
  - Current version card with file size, sha256, secure download button.
  - Version history timeline: previous revisions, change summaries, reviewers.
  - Review & Approval modal with rejection reason requirement.
  - New Revision modal with file upload, version number, and change log.
  - Employee Acknowledgment section: "مطالعه کردم و متعهد به اجرا هستم" button, list of acknowledged users.
- **Cross-Domain Integration Links:**
  - View associated Permits, Equipment, Incidents, Risks.

---

## 5. Verification & Acceptance Criteria

- [x] All Django migrations applied with 0 unapplied changes (`makemigrations --check --dry-run`: 0 drift).
- [x] 100% of backend tests pass across `apps.documents` and all related apps (244/244 passed).
- [x] 100% of frontend tests pass (`npm test -- --run`: 70/70 passed in 14 suites).
- [x] Clean Vite production build (`npm run build`: 0 TypeScript errors).
- [x] Complete synthetic demo data seeded idempotently (`is_synthetic=True`, exit code 0 on consecutive runs).
- [x] Documentation created: `docs/plans/PHASE-16.md`, `docs/reports/16_document_control_and_archive.md`, and `docs/reports/PHASE-16-DEMO-GUIDE.md`.
- [x] Git diff hygiene verified (`git diff --check`: 0 issues).
