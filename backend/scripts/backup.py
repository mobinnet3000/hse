#!/usr/bin/env python3
"""
HSE Guard — Safe Database & Media Backup Utility
Performs online non-blocking backup of the SQLite database using SQLite's backup API,
archives the media directory, and generates SHA-256 verification checksums.
"""

import argparse
import hashlib
import os
import shutil
import sqlite3
import sys
import tarfile
from datetime import datetime
from pathlib import Path


def calculate_sha256(filepath: Path) -> str:
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


def perform_backup(base_dir: Path, output_dir: Path) -> int:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_dir = output_dir / f"backup_{timestamp}"
    target_dir.mkdir(parents=True, exist_ok=True)

    print(f"[*] Starting HSE Guard backup to: {target_dir}")

    # 1. Database backup
    db_source = base_dir / "db.sqlite3"
    db_backup_file = target_dir / "db_backup.sqlite3"

    if db_source.exists():
        print(f"[*] Backing up SQLite database ({db_source})...")
        try:
            src_conn = sqlite3.connect(db_source)
            dst_conn = sqlite3.connect(db_backup_file)
            with dst_conn:
                src_conn.backup(dst_conn)
            dst_conn.close()
            src_conn.close()

            # Verify backup integrity
            verify_conn = sqlite3.connect(db_backup_file)
            cursor = verify_conn.cursor()
            cursor.execute("PRAGMA integrity_check;")
            integrity_result = cursor.fetchone()[0]
            verify_conn.close()

            if integrity_result != "ok":
                print(f"[!] Integrity check FAILED: {integrity_result}", file=sys.stderr)
                return 1
            print(f"[+] SQLite database backed up successfully. Integrity: {integrity_result}")
        except Exception as e:
            print(f"[!] Database backup failed: {e}", file=sys.stderr)
            return 1
    else:
        print(f"[-] SQLite database not found at {db_source}. Skipping.")

    # 2. Media archive
    media_source = base_dir / "media"
    media_backup_file = target_dir / "media_backup.tar.gz"

    if media_source.exists() and any(media_source.iterdir()):
        print(f"[*] Archiving media directory ({media_source})...")
        try:
            with tarfile.open(media_backup_file, "w:gz") as tar:
                tar.add(media_source, arcname="media")
            print(f"[+] Media archive created successfully.")
        except Exception as e:
            print(f"[!] Media archive failed: {e}", file=sys.stderr)
            return 1
    else:
        print(f"[-] Media directory empty or not present at {media_source}. Skipping media archive.")

    # 3. Checksums
    checksum_file = target_dir / "SHA256SUMS"
    with open(checksum_file, "w") as chk:
        if db_backup_file.exists():
            db_sha = calculate_sha256(db_backup_file)
            chk.write(f"{db_sha}  {db_backup_file.name}\n")
            print(f"[+] DB SHA-256: {db_sha}")
        if media_backup_file.exists():
            media_sha = calculate_sha256(media_backup_file)
            chk.write(f"{media_sha}  {media_backup_file.name}\n")
            print(f"[+] Media SHA-256: {media_sha}")

    print(f"[SUCCESS] HSE Guard backup completed successfully in {target_dir}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="HSE Guard Database and Media Backup Utility")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("/tmp/hse_backups"),
        help="Destination directory for backup archives (default: /tmp/hse_backups)",
    )
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    exit_code = perform_backup(base_dir, args.output_dir)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
