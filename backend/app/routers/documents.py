"""Secure document management: encrypted storage, permissions, signed downloads."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import security
from app.core.deps import audit, get_current_user, is_staff, rate_limit
from app.db import get_db
from app.models import Document, Project, ResearchRequest, User
from app.models_enums import DocumentKind, DocumentStatus
from app.routers.common import jdump, pick
from app.services import storage

router = APIRouter(tags=["documents"])


def can_access_document(db: Session, user: User, doc: Document) -> bool:
    if is_staff(user):
        return True
    if doc.owner_id == user.id:
        return True
    if doc.project_id:
        p = db.get(Project, doc.project_id)
        if p and (p.client_id == user.id or p.assigned_professional_id == user.id):
            return True
    if doc.request_id:
        r = db.get(ResearchRequest, doc.request_id)
        if r and r.client_id == user.id:
            return True
    return False


@router.post("/documents/upload", status_code=201)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    kind: str = Form(DocumentKind.OTHER.value),
    project_id: str | None = Form(None),
    request_id: str | None = Form(None),
    description: str | None = Form(None),
    copyright_confirmed: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _rl: None = Depends(rate_limit("upload", 30, 300)),
):
    if not copyright_confirmed:
        raise HTTPException(422, "Please confirm you own this material or have permission/licence to use it")
    if kind not in {k.value for k in DocumentKind}:
        kind = DocumentKind.OTHER.value

    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "Files must be 25 MB or smaller")
    filename = storage.safe_filename(file.filename or "document")
    error = storage.validate_upload(filename, file.content_type, len(data))
    if error:
        raise HTTPException(422, error)

    doc = Document(
        owner_id=user.id, kind=kind, project_id=project_id, request_id=request_id,
        filename=filename, content_type=file.content_type, size_bytes=len(data),
        storage_key="pending", copyright_confirmed=True, description=description,
    )
    db.add(doc)
    db.flush()
    storage_key, sha, scan = storage.store_document(user.id, doc.id, data)
    doc.storage_key = storage_key
    doc.sha256 = sha
    doc.scan_status = scan
    if scan == "INFECTED":
        doc.status = DocumentStatus.FLAGGED.value
        audit(db, request, user, "document.flagged_malware", "document", doc.id, {"filename": filename})
    db.commit()
    return pick(doc, "id", "filename", "size_bytes", "content_type", "kind", "status", "scan_status",
                "sha256", "created_at", "description")


@router.get("/documents")
def list_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                   project_id: str | None = None, request_id: str | None = None, mine: bool = False):
    stmt = select(Document).where(Document.status != DocumentStatus.REMOVED.value)
    if project_id:
        stmt = stmt.where(Document.project_id == project_id)
    if request_id:
        stmt = stmt.where(Document.request_id == request_id)
    if mine:
        stmt = stmt.where(Document.owner_id == user.id)
    if not is_staff(user) and not (project_id or request_id or mine):
        stmt = stmt.where(Document.owner_id == user.id)
    docs = db.scalars(stmt.order_by(Document.created_at.desc()).limit(200)).all()
    items = []
    for d in docs:
        if can_access_document(db, user, d):
            owner = db.get(User, d.owner_id)
            items.append(pick(d, "id", "filename", "size_bytes", "content_type", "kind", "status",
                              "scan_status", "created_at", "project_id", "request_id",
                              owner_name=owner.full_name if owner else None))
    return {"items": items}


@router.post("/documents/{doc_id}/download-url")
def download_url(doc_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc or doc.status == DocumentStatus.REMOVED.value or not can_access_document(db, user, doc):
        raise HTTPException(404, "Document not found")
    if doc.scan_status == "INFECTED":
        raise HTTPException(409, "This file was blocked by malware scanning")
    token = security.new_download_token(doc.id, user.id)
    return {"url": f"/api/files/download?token={token}", "expires_in": 600, "filename": doc.filename}


@router.get("/files/download")
def download_file(token: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    verified = security.verify_download_token(token)
    if not verified:
        raise HTTPException(400, "This download link is invalid or has expired")
    doc_id, token_user = verified
    if token_user != user.id:
        raise HTTPException(403, "This download link belongs to a different session")
    doc = db.get(Document, doc_id)
    if not doc or doc.status == DocumentStatus.REMOVED.value or not can_access_document(db, user, doc):
        raise HTTPException(404, "Document not found")
    data = storage.read_document(doc.storage_key)
    if data is None:
        raise HTTPException(404, "File content is unavailable")
    audit(db, None, user, "document.downloaded", "document", doc.id)
    db.commit()
    media_type = doc.content_type or "application/octet-stream"
    disposition = "inline" if (media_type.startswith(("application/pdf", "image/", "text/"))) else "attachment"
    return Response(
        content=data, media_type=media_type,
        headers={"Content-Disposition": f'{disposition}; filename="{doc.filename}"'},
    )


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc or doc.status == DocumentStatus.REMOVED.value:
        raise HTTPException(404, "Document not found")
    if doc.owner_id != user.id and not is_staff(user):
        raise HTTPException(403, "Not permitted")
    doc.status = DocumentStatus.REMOVED.value
    doc.deleted_at = datetime.now(timezone.utc)
    storage.delete_document(doc.storage_key)
    audit(db, request, user, "document.deleted", "document", doc.id)
    db.commit()
    return {"ok": True}
