"""Secure document storage.

- Files are encrypted at rest (Fernet) and stored outside any public path.
- Downloads go through short-lived HMAC-signed URLs validated server-side;
  private research documents are never exposed through static/public URLs.
- Uploads pass validation (extension/MIME allowlist, size cap) and a malware
  scanning hook (checks the EICAR test signature in development; production
  deployments plug ClamAV into `scan_content`).
- The interface mirrors an S3-style object store so production can swap the
  local driver for AWS S3 / MinIO without touching call sites.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

BLOCKED_EXTENSIONS = {
    ".exe", ".msi", ".bat", ".cmd", ".sh", ".com", ".scr", ".ps1", ".jar",
    ".vbs", ".js", ".dll", ".so", ".bin", ".apk",
}
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".tsv", ".txt", ".md",
    ".ppt", ".pptx", ".odt", ".ods", ".odp", ".rtf", ".zip", ".sav", ".dta",
    ".rdata", ".rds", ".r", ".py", ".ipynb", ".do", ".spv", ".por", ".json",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".tif", ".tiff", ".eps",
}

EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


def _fernet() -> Fernet:
    key = settings.encryption_key
    if not key:
        # Deterministic dev key derived from the app secret. Production must
        # set WULWETH_ENCRYPTION_KEY (Fernet) and manage it via a secret store.
        digest = hashlib.sha256(("wulweth-doc-encryption:" + settings.secret_key).encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key)


def validate_upload(filename: str, content_type: str | None, size_bytes: int) -> str | None:
    """Returns an error string, or None when acceptable."""
    ext = Path(filename).suffix.lower()
    if ext in BLOCKED_EXTENSIONS:
        return "This file type is not permitted for security reasons."
    if ALLOWED_EXTENSIONS and ext not in ALLOWED_EXTENSIONS:
        return f"File type '{ext or 'unknown'}' is not supported. Allowed: documents, data files, images, archives."
    if size_bytes <= 0:
        return "The file appears to be empty."
    if size_bytes > settings.max_upload_mb * 1024 * 1024:
        return f"Files must be {settings.max_upload_mb} MB or smaller."
    return None


def scan_content(data: bytes) -> str:
    """Malware scanning hook. Returns PENDING | CLEAN | INFECTED."""
    if EICAR.encode() in data:
        return "INFECTED"
    return "CLEAN"


def store_document(owner_id: str, document_id: str, data: bytes) -> tuple[str, str, str]:
    """Encrypt and persist bytes. Returns (storage_key, sha256, scan_status)."""
    directory = settings.storage_dir / owner_id[:2] / owner_id
    directory.mkdir(parents=True, exist_ok=True)
    storage_key = f"{owner_id[:2]}/{owner_id}/{document_id}.bin"
    token = _fernet().encrypt(data)
    (settings.storage_dir / storage_key).write_bytes(token)
    sha = hashlib.sha256(data).hexdigest()
    return storage_key, sha, scan_content(data)


def read_document(storage_key: str) -> bytes | None:
    path = (settings.storage_dir / storage_key).resolve()
    if not str(path).startswith(str(settings.storage_dir.resolve())):
        return None  # path traversal guard
    if not path.exists():
        return None
    try:
        return _fernet().decrypt(path.read_bytes())
    except (InvalidToken, OSError):
        return None


def delete_document(storage_key: str) -> None:
    path = settings.storage_dir / storage_key
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def safe_filename(name: str) -> str:
    name = os.path.basename(name)
    name = re.sub(r"[^\w.\- ()\[\]]+", "_", name).strip()
    return name[:200] or "document"
