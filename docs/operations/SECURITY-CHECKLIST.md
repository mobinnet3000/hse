# HSE Guard — Production & Staging Security Checklist

This document details the security verification matrix, hardening controls, and compliance criteria required before promoting HSE Guard to staging or production.

---

## 1. Security Architecture Summary

HSE Guard adopts a defense-in-depth security model across five architectural boundaries:
1. **Network & Edge:** TLS 1.3 termination, strict CORS origin whitelisting, IP throttling.
2. **Session & Transport:** `HttpOnly`, `SameSite=Lax`, `Secure` cookies with full CSRF protection.
3. **Application & Access Control:** Multi-tenant organization boundaries, role-based capability checks (`can_review`, `can_conduct_inspections`), and active membership enforcement.
4. **Data Input & File Security:** Strict file extension/MIME validation, executable blocking, CSV formula injection neutralization, and media directory path containment.
5. **Observability & Auditing:** Immutable audit logs (`apps.auditlog`), request correlation tracing (`X-Request-ID`), and sanitized logging with zero credential leakage.

---

## 2. Hardening Matrix & Pre-Release Checklist

| Category | Security Control | Verified Implementation | Status |
| :--- | :--- | :--- | :---: |
| **Transport** | HTTPS Enforcement | `DJANGO_SECURE_SSL_REDIRECT=True`, Nginx redirect 80 -> 443 | Verified |
| **Transport** | HSTS (Strict-Transport-Security) | `SECURE_HSTS_SECONDS=31536000`, include subdomains & preload | Verified |
| **Session** | Session Cookie Security | `SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SECURE=True`, `SESSION_COOKIE_SAMESITE="Lax"` | Verified |
| **Session** | CSRF Protection | `CsrfViewMiddleware` active, `CSRF_COOKIE_SECURE=True`, `CSRF_COOKIE_SAMESITE="Lax"` | Verified |
| **Network** | CORS Whitelist | `CORS_ALLOWED_ORIGINS` bound to `FRONTEND_ORIGIN` env; no wildcard `*` | Verified |
| **Network** | Frame Protection | `X_FRAME_OPTIONS = "DENY"`, prevents Clickjacking attacks | Verified |
| **Network** | MIME Sniffing | `SECURE_CONTENT_TYPE_NOSNIFF = True` and `X-Content-Type-Options: nosniff` on file streams | Verified |
| **Rate Limiting**| API Throttling | `AnonRateThrottle` at 120/min, `login` throttle at 10/min, `register` at 5/min | Verified |
| **Tenancy** | Cross-Tenant Isolation | All ModelViewSets enforce `accessible_organization_ids` and reject inactive members | Verified |
| **File Storage** | Executable File Upload Block | `validate_file_upload` blocks `.exe`, `.bat`, `.cmd`, `.sh`, `.py`, `.js`, `.dll`, `.msi`, etc. | Verified |
| **File Storage** | Path Traversal Prevention | Document and evidence streaming verifies `resolved_path.startswith(settings.MEDIA_ROOT)` | Verified |
| **Reporting** | CSV Formula Injection Guard | `sanitize_csv_cell` neutralizes `=`, `+`, `-`, `@`, `\t`, `\r` by prepending single quote | Verified |
| **Database** | SQL Injection Immunity | 100% Django ORM parameterized queries; zero raw unescaped SQL execution | Verified |
| **Secret Mgmt** | Production Secret Key Validation | Startup check rejects `len(SECRET_KEY) < 50` or default dev key when `DEBUG=False` | Verified |
| **Audit Log** | Immutable Audit Trail | `log_event()` writes non-destructive records for document downloads, status changes, and approvals | Verified |
| **Tracing** | Request Correlation ID | `RequestCorrelationMiddleware` injects `X-Request-ID` into every incoming and outgoing response | Verified |

---

## 3. Specific Vulnerability Mitigations

### 3.1 CSV / Formula Injection Mitigation
When exporting tabular data to Microsoft Excel or LibreOffice Calc via `/api/v1/reports/export/`:
- Malicious strings such as `=cmd|' /C calc'!A0` or `@SUM(...)` are automatically escaped via `sanitize_csv_cell`:
```python
def sanitize_csv_cell(cell):
    if cell is None:
        return ""
    if isinstance(cell, str) and cell and cell[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{cell}"
    return cell
```
- In automated test suite: `apps.core.tests_staging.StagingSecurityHardeningTests.test_csv_formula_injection_sanitization` asserts formula neutralization.

### 3.2 Executable & Malicious File Upload Prevention
Uploaded files are intercepted by `validate_file_upload` before persistence:
- Disallowed extensions: `.exe, .bat, .cmd, .sh, .py, .js, .vbs, .ps1, .dll, .msi, .com, .scr, .php, .phtml, .cgi, .pl, .jar, .apk, .bin`.
- Filename normalization: Strips path elements via `os.path.basename` to prevent directory traversal in multipart filenames.
- Enforced on:
  - Non-conformity evidence uploads (`/api/v1/non-conformities/<id>/evidence/`).
  - Controlled documents revisions (`/api/v1/documents/documents/<id>/revisions/`).
  - Chat message attachments (`/api/v1/chat/conversations/<id>/messages/`).

### 3.3 Path Traversal Guard on File Streaming
When authorized users download controlled documents (`DocumentViewSet._stream_file`):
```python
file_path = version.file.path
media_root = os.path.abspath(str(settings.MEDIA_ROOT))
resolved_path = os.path.abspath(file_path)
if not resolved_path.startswith(media_root) or not os.path.exists(resolved_path):
    raise Http404("فایل فیزیکی در مخزن امن یافت نشد.")
```
Ensures files can never be streamed outside the dedicated application media boundary.

---

## 4. Pre-Staging Verification Commands

Execute the following commands prior to initiating staging deployment:

```bash
# 1. Run Django System Check
python backend/manage.py check --deploy

# 2. Run Staging Security Test Suite
python backend/manage.py test apps.core.tests_staging

# 3. Verify No Unapplied Migrations
python backend/manage.py makemigrations --check

# 4. Verify Secret Key Length in Staging .env
python -c "
import os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('backend/.env')
k = os.getenv('DJANGO_SECRET_KEY', '')
if len(k) < 50:
    print('FAIL: DJANGO_SECRET_KEY is shorter than 50 characters!')
    sys.exit(1)
print(f'PASS: Secret key length is {len(k)} chars.')
"
```
