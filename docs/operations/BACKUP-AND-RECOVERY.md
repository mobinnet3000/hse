# HSE Guard — Backup and Disaster Recovery Runbook

This runbook establishes standard operational procedures for backup creation, storage encryption, scheduled retention, integrity verification, and point-in-time recovery for HSE Guard relational databases and document media stores.

---

## 1. Backup Scope & Recovery Objectives

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | <= 1 Hour (Staging) / <= 15 Min (Production) | Maximum acceptable data loss window during catastrophic infrastructure failure. |
| **Recovery Time Objective (RTO)** | <= 30 Minutes | Total elapsed time to provision, restore, verify, and declare application operational. |
| **Components Protected** | 1. Relational Database (PostgreSQL / SQLite)<br>2. Uploaded Media & Evidences (`MEDIA_ROOT`)<br>3. Configuration Files (`.env`, Nginx configuration) | Complete system state preservation. |

---

## 2. PostgreSQL Backup Procedures

### 2.1 Daily Full Snapshot (`pg_dump`)
Run a compressed, custom-format dump including blobs and schema metadata:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/hse-guard/db"
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
DUMP_FILE="${BACKUP_DIR}/hse_guard_pg_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

# Execute PostgreSQL Dump
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -F c \
    -b \
    -v \
    -f "${DUMP_FILE}"

# Compute SHA-256 Checksum
sha256sum "${DUMP_FILE}" > "${DUMP_FILE}.sha256"

# Encrypt backup using GPG
gpg --batch --yes --passphrase "${BACKUP_ENCRYPTION_KEY}" -c "${DUMP_FILE}"
rm -f "${DUMP_FILE}"

echo "PostgreSQL backup completed: ${DUMP_FILE}.gpg"
```

### 2.2 Point-in-Time Recovery (WAL Archiving)
For zero-RPO production installations, enable WAL (Write-Ahead Logging) archiving in `postgresql.conf`:
```ini
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /var/backups/hse-guard/wal/%f && cp %p /var/backups/hse-guard/wal/%f'
archive_timeout = 900 # Force rotation every 15 minutes
```

---

## 3. Media & Document Store Backup (`media/`)

Uploaded attachments (PSSR certificates, PTW gas readings, lifting simulations, non-conformity photos) are stored in `MEDIA_ROOT`.

### 3.1 Incremental Snapshot via `rsync`
```bash
#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="/opt/hse-guard/media/"
TARGET_DIR="/var/backups/hse-guard/media_snapshots/current"
ARCHIVE_DIR="/var/backups/hse-guard/media_snapshots/history_$(date +'%Y%m%d')"

mkdir -p "${TARGET_DIR}" "${ARCHIVE_DIR}"

rsync -avz --delete \
    --backup --backup-dir="${ARCHIVE_DIR}" \
    "${SOURCE_DIR}" "${TARGET_DIR}"

echo "Media backup synchronization completed."
```

---

## 4. SQLite Development Backup (Fallback)

When operating with SQLite (`db.sqlite3`):
```bash
#!/usr/bin/env bash
set -euo pipefail

DB_FILE="/opt/hse-guard/app/backend/db.sqlite3"
BACKUP_FILE="/var/backups/hse-guard/sqlite/db_$(date +'%Y%m%d_%H%M%S').sqlite3"

mkdir -p "$(dirname "${BACKUP_FILE}")"

# Use SQLite online backup API to ensure write safety
sqlite3 "${DB_FILE}" ".backup '${BACKUP_FILE}'"
gzip -9 "${BACKUP_FILE}"

echo "SQLite backup completed: ${BACKUP_FILE}.gz"
```

---

## 5. Automated Scheduling & Retention Policy

### 5.1 Systemd Timer Configuration (`/etc/systemd/system/hse-backup.timer`)
```ini
[Unit]
Description=Run HSE Guard Nightly Backup Timer

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

### 5.2 Retention Policy
Retain snapshots according to standard compliance rules:
- **Daily Backups:** Retain for 7 days.
- **Weekly Backups:** Retain for 4 weeks.
- **Monthly Backups:** Retain for 12 months.
- **Annual Backups:** Retain for 7 years (audit log compliance).

Pruning script:
```bash
find /var/backups/hse-guard/db/ -name "*.dump.gpg" -type f -mtime +30 -delete
```

---

## 6. Restoration & Disaster Recovery Procedure

### 6.1 Restoring PostgreSQL Database
1. Stop application services to prevent conflicting writes:
   ```bash
   sudo systemctl stop hse-guard-backend
   ```

2. Decrypt target backup:
   ```bash
   gpg --batch --yes --passphrase "${BACKUP_ENCRYPTION_KEY}" -d "${DUMP_FILE}.gpg" > "${DUMP_FILE}"
   ```

3. Verify SHA-256 checksum:
   ```bash
   sha256sum -c "${DUMP_FILE}.sha256"
   ```

4. Drop existing database and recreate clean target:
   ```bash
   sudo -u postgres dropdb "${DB_NAME}"
   sudo -u postgres createdb -O "${DB_USER}" -E UTF8 "${DB_NAME}"
   ```

5. Restore using `pg_restore`:
   ```bash
   PGPASSWORD="${DB_PASSWORD}" pg_restore \
       -h "${DB_HOST}" \
       -p "${DB_PORT}" \
       -U "${DB_USER}" \
       -d "${DB_NAME}" \
       -v \
       --clean --if-exists \
       "${DUMP_FILE}"
   ```

6. Clean up unencrypted temporary dump:
   ```bash
   rm -f "${DUMP_FILE}"
   ```

### 6.2 Restoring Media Store
```bash
rsync -avz /var/backups/hse-guard/media_snapshots/current/ /opt/hse-guard/media/
sudo chown -R hseguard:hseguard /opt/hse-guard/media
sudo chmod -R 0750 /opt/hse-guard/media
```

### 6.3 Post-Restoration Sanity Verification
1. Restart services:
   ```bash
   sudo systemctl start hse-guard-backend
   sudo systemctl restart nginx
   ```
2. Verify system liveness and database connection:
   ```bash
   curl -f http://127.0.0.1:8000/api/v1/health/
   curl -f http://127.0.0.1:8000/api/v1/readiness/
   ```
3. Authenticate with an administrative user and verify dashboard analytics.
