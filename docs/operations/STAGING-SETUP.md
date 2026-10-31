# HSE Guard — Controlled Staging Environment Setup Guide

## 1. Overview and Architecture

HSE Guard is an enterprise-grade Integrated Health, Safety, and Environment Management System (IHMS).
In a controlled staging environment, the application is deployed on a dedicated Linux staging host or VM to mirror production topology closely while preventing unintended live data exposure or unverified external communications.

### Staging Topology
- **Web / Reverse Proxy Server:** Nginx 1.22+ (terminates TLS, enforces HSTS, proxies API to Gunicorn, serves built frontend static assets).
- **Backend Application Server:** Python 3.11+ / Django 5.2.16 with Gunicorn (WSGI, multi-worker process model with `X-Request-ID` correlation logging).
- **Relational Database:** PostgreSQL 15+ with dedicated `hse_guard_staging` database and least-privilege credentials.
- **Frontend SPA:** React 19 + TypeScript + Vite build output (served by Nginx with client-side SPA fallback).
- **Persistent Storage:** Local POSIX volume or mounted block storage with strict permissions (`0750`) for user media uploads (`MEDIA_ROOT`).
- **External Adapters:** Provider-neutral integration layer configured with staging sandbox credentials or mock providers.

---

## 2. System Prerequisites

The staging host must meet the following minimum resource and software requirements:

### Hardware Specifications
- **CPU:** 4 vCPUs minimum (8 vCPUs recommended).
- **RAM:** 8 GB minimum (16 GB recommended).
- **Storage:** 80 GB SSD (NVMe preferred) with separate partitions for OS, `/var/log`, `/var/lib/postgresql`, and application media.

### Operating System & Packages
- Ubuntu 22.04 LTS or 24.04 LTS (x86_64).
- System packages:
  ```bash
  sudo apt-get update && sudo apt-get install -y \
      build-essential \
      python3-dev \
      python3-venv \
      python3-pip \
      postgresql \
      postgresql-contrib \
      libpq-dev \
      nginx \
      curl \
      git \
      tar \
      gzip \
      ufw
  ```
- **Node.js Environment (for building frontend assets):**
  - Node.js 20 LTS and npm 10+:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

---

## 3. Database Configuration (PostgreSQL)

1. Connect to PostgreSQL as superuser:
   ```bash
   sudo -u postgres psql
   ```

2. Create dedicated database user and database with UTF-8 encoding:
   ```sql
   CREATE USER hse_guard_staging WITH PASSWORD 'SECURE_RANDOM_STAGING_PASSWORD_HERE';
   CREATE DATABASE hse_guard_staging OWNER hse_guard_staging ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C';
   GRANT ALL PRIVILEGES ON DATABASE hse_guard_staging TO hse_guard_staging;
   \c hse_guard_staging
   GRANT ALL ON SCHEMA public TO hse_guard_staging;
   \q
   ```

3. Ensure PostgreSQL only listens on `127.0.0.1` unless connecting over an encrypted private VPC network.

---

## 4. Application Deployment Steps

### 4.1 Clone and Directory Structure
```bash
sudo useradd -r -s /bin/bash -m -d /opt/hse-guard hseguard
sudo mkdir -p /opt/hse-guard/app /opt/hse-guard/media /opt/hse-guard/static /opt/hse-guard/logs
sudo chown -R hseguard:hseguard /opt/hse-guard

# Switch to service user
sudo -u hseguard -i
cd /opt/hse-guard/app
git clone <repository_url> .
```

### 4.2 Backend Virtual Environment and Dependencies
```bash
cd /opt/hse-guard/app/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
pip install gunicorn
```

### 4.3 Environment Configuration
Create `/opt/hse-guard/app/backend/.env` with strict permissions:
```bash
chmod 600 /opt/hse-guard/app/backend/.env
```
Populate `.env` with staging values (see `docs/operations/ENVIRONMENT-VARIABLES.md`).

### 4.4 Database Migrations and Static Collection
```bash
python manage.py migrate --noinput
python manage.py collectstatic --noinput
```

### 4.5 Frontend Build
```bash
cd /opt/hse-guard/app/frontend
npm ci
npm run build
```
Verify that the `frontend/dist/` bundle contains `index.html` and assets.

---

## 5. Systemd Service Configuration

Create `/etc/systemd/system/hse-guard-backend.service`:
```ini
[Unit]
Description=HSE Guard Django Application Server (Gunicorn)
After=network.target postgresql.service

[Service]
Type=notify
User=hseguard
Group=hseguard
WorkingDirectory=/opt/hse-guard/app/backend
EnvironmentFile=/opt/hse-guard/app/backend/.env
ExecStart=/opt/hse-guard/app/backend/.venv/bin/gunicorn config.wsgi:application \
    --workers 4 \
    --worker-class gthread \
    --threads 2 \
    --timeout 60 \
    --bind 127.0.0.1:8000 \
    --access-logfile /opt/hse-guard/logs/gunicorn_access.log \
    --error-logfile /opt/hse-guard/logs/gunicorn_error.log
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=30
PrivateTmp=true
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable and start backend:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hse-guard-backend
sudo systemctl status hse-guard-backend
```

---

## 6. Nginx Web Server and TLS Reverse Proxy

Create `/etc/nginx/sites-available/hse-guard-staging`:
```nginx
server {
    listen 80;
    server_name staging.hseguard.internal;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.hseguard.internal;

    ssl_certificate /etc/ssl/certs/staging.hseguard.internal.crt;
    ssl_certificate_key /etc/ssl/private/staging.hseguard.internal.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Maximum file upload size (matches backend 25MB ceiling)
    client_max_body_size 25M;

    # Frontend Single Page Application
    root /opt/hse-guard/app/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Assets for Django Admin / DRF
    location /static/ {
        alias /opt/hse-guard/app/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # User Media (Access-controlled)
    location /media/ {
        alias /opt/hse-guard/app/backend/media/;
        expires 7d;
        add_header Cache-Control "private";
    }

    # Backend API and Admin Reverse Proxy
    location ~ ^/(api|admin)/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Liveness & Readiness Probes (Unauthenticated)
    location ~ ^/api/v1/(health|readiness)/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 10s;
    }
}
```

Enable site configuration:
```bash
sudo ln -s /etc/nginx/sites-available/hse-guard-staging /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Staging Verification Checks

Execute the verification steps:
1. **Liveness check:**
   ```bash
   curl -k https://staging.hseguard.internal/api/v1/health/
   # Expected: {"status":"ok","service":"hse-guard"}
   ```
2. **Readiness check:**
   ```bash
   curl -k https://staging.hseguard.internal/api/v1/readiness/
   # Expected: {"status":"ready","database":"connected","storage":"writable"}
   ```
3. **Trace correlation verification:**
   ```bash
   curl -i -k https://staging.hseguard.internal/api/v1/health/
   # Verify X-Request-ID header is present in the response
   ```
