#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${1:-/tmp/hse_backups}"

echo "=================================================="
echo " HSE Guard — Controlled Staging Backup Routine"
echo "=================================================="

PYTHON_BIN="${BASE_DIR}/.venv/bin/python"
if [ ! -f "${PYTHON_BIN}" ]; then
    PYTHON_BIN="python3"
fi

"${PYTHON_BIN}" "${SCRIPT_DIR}/backup.py" --output-dir "${BACKUP_DIR}"
