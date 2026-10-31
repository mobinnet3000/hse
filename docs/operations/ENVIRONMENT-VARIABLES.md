# HSE Guard — Environment Variables Reference & Configuration Dictionary

This document provides the definitive specification of all environment variables supported and required across HSE Guard backend and frontend environments (Development, Staging, and Production).

---

## 1. Security & Configuration Principles

1. **Zero Secret Leakage:** Never commit `.env` files into version control. Only `.env.example` templates may reside in the repository.
2. **Fail-Closed Startup:** If `DJANGO_DEBUG=False`, the application strictly refuses to start if `DJANGO_SECRET_KEY` is missing, default, or shorter than 50 characters.
3. **Environment Segregation:** Staging and production must use isolated credentials, distinct database instances, and separate storage buckets/directories.

---

## 2. Backend Environment Variables (`backend/.env`)

| Variable Name | Required | Default (Dev) | Allowed / Format | Description & Production Rules |
| :--- | :---: | :--- | :--- | :--- |
| `DJANGO_SECRET_KEY` | **Yes** | `insecure-dev-only-change-me` | String (min 50 chars in prod) | Cryptographic salt for session signing and tokens. In production/staging, must be generated via `secrets.token_urlsafe(64)` and >= 50 characters. |
| `DJANGO_DEBUG` | **Yes** | `True` | `True`, `False`, `1`, `0` | Debug mode. **MUST be `False` in staging and production.** Disables debug error pages, enables strict SSL/HSTS checks. |
| `DJANGO_ALLOWED_HOSTS` | **Yes** | `localhost,127.0.0.1` | Comma-separated domain names / IPs | Host header validation to prevent HTTP Host poisoning. Example: `staging.hseguard.ir,127.0.0.1`. |
| `DB_ENGINE` | **Yes** | `sqlite3` | `sqlite3`, `postgresql`, `postgres` | Database backend engine. Use `sqlite3` for local dev/testing; **`postgresql` is mandatory for staging and production.** |
| `DB_NAME` | If PG | `hse_guard` | String | Name of the PostgreSQL database instance. |
| `DB_USER` | If PG | `postgres` | String | Database user with least-privilege permissions on `DB_NAME`. |
| `DB_PASSWORD` | If PG | *(empty)* | String | Strong database user password. |
| `DB_HOST` | If PG | `localhost` | Hostname / IP address | PostgreSQL host (e.g., `127.0.0.1` or private RDS/cloud host). |
| `DB_PORT` | If PG | `5432` | Integer (1–65535) | PostgreSQL listening port. |
| `DB_CONN_MAX_AGE` | No | `60` | Integer (seconds) | Persistent database connection lifetime for connection pooling under WSGI. |
| `DATABASE_PATH` | If SQLite | `db.sqlite3` | Path relative to `backend/` | File path for SQLite database when `DB_ENGINE=sqlite3`. |
| `FRONTEND_ORIGIN` | **Yes** | `http://localhost:5173` | Comma-separated full URIs | CORS and CSRF trusted origin whitelist. Example: `https://staging.hseguard.ir,https://app.hseguard.ir`. |
| `DJANGO_SECURE_SSL_REDIRECT` | No | `True` (when `DEBUG=False`) | Boolean | Redirects all non-HTTPS requests to HTTPS. Set to `False` only if reverse proxy (Nginx) terminates TLS. |
| `DJANGO_SECURE_HSTS_SECONDS` | No | `31536000` | Integer (seconds) | HTTP Strict Transport Security duration (default 1 year). |
| `MEDIA_DIR` | No | `media` | Directory name or path | Media directory for uploaded evidence, certificates, and documents. |
| `SMS_PANEL_URL` | No | *(empty)* | HTTP/HTTPS URL | Outbound SMS gateway endpoint for emergency notifications and OTP dispatch. |
| `SMS_PANEL_API_KEY` | No | *(empty)* | String / Bearer token | API token for SMS provider authentication. |
| `WEATHER_API_URL` | No | *(empty)* | HTTP/HTTPS URL | Meteorological forecast endpoint for SIMOPS, Crane Lifting, and Excavation weather checks. |
| `WEATHER_API_KEY` | No | *(empty)* | String / API key | Access key for third-party weather API. |
| `IOT_MQTT_BROKER_HOST` | No | `localhost` | Hostname / IP | MQTT broker address for real-time gas detection and sensor telemetries. |
| `IOT_MQTT_BROKER_PORT` | No | `1883` | Integer | MQTT listening port (1883 plain, 8883 TLS). |
| `AI_PROVIDER` | No | *(empty)* | `gemini`, `openai`, `local` | LLM inference backend for HSE Assistant. |
| `AI_API_KEY` | No | *(empty)* | String | API key for AI assistant provider. |

---

## 3. Frontend Environment Variables (`frontend/.env`)

Vite reads environment variables prefixed with `VITE_` during build time.

| Variable Name | Required | Default | Format | Description |
| :--- | :---: | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** | `/api/v1` | URL path or full URI | Base URL prefix for all backend REST API requests. In staging and production behind an Nginx reverse proxy, using `/api/v1` (relative) avoids hardcoded hostnames and CORS preflight overhead. |

---

## 4. Staging vs Production Preset Configurations

### 4.1 Staging Environment (`backend/.env`)
```ini
DJANGO_SECRET_KEY=wG5k8N!x2q9$vL7@jM4#zP1&rT3*bC6^yU9(eQ2)sA5+dF8_kH0=mZ3[xV7]bN4{q
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=staging.hseguard.internal,127.0.0.1
DB_ENGINE=postgresql
DB_NAME=hse_guard_staging
DB_USER=hse_guard_staging_user
DB_PASSWORD=Secure-Staging-Database-Pass-2026!
DB_HOST=127.0.0.1
DB_PORT=5432
DB_CONN_MAX_AGE=60
FRONTEND_ORIGIN=https://staging.hseguard.internal
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SECURE_HSTS_SECONDS=31536000
```

### 4.2 Production Environment (`backend/.env`)
```ini
DJANGO_SECRET_KEY=9aB$7fG#2kL*8qW@4xZ^1mP&5vR(3tY)6cD!0sH+8jN=2wM[5eX]7bV{4yU}9oI
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=app.hseguard.ir,api.hseguard.ir
DB_ENGINE=postgresql
DB_NAME=hse_guard_prod
DB_USER=hse_guard_prod_user
DB_PASSWORD=Production-UltraSecure-DbPassword-2026!
DB_HOST=10.0.1.5
DB_PORT=5432
DB_CONN_MAX_AGE=120
FRONTEND_ORIGIN=https://app.hseguard.ir
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SECURE_HSTS_SECONDS=31536000
```

---

## 5. Startup Validation Verification

When starting the application via Gunicorn or manage.py:
1. `config.settings` executes early validation:
   - Verifies `DJANGO_SECRET_KEY` length >= 50 characters when `DJANGO_DEBUG=False`.
   - Rejects default dev key (`insecure-dev-only-change-me`).
   - Configures secure cookie flags (`SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`, `X_FRAME_OPTIONS="DENY"`).
2. If invalid, the process aborts with an `ImproperlyConfigured` exception before accepting any socket connections.
