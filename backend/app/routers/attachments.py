import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from psycopg.rows import dict_row

from ..auth import get_current_user, require_editor
from ..config import settings
from ..db import pool
from ..schemas import Attachment

router = APIRouter(tags=["attachments"])

MAX_SIZE = 25 * 1024 * 1024  # 25 MB
CHUNK = 1024 * 1024


def _safe_ext(name: str) -> str:
    ext = Path(name).suffix.lower()
    return ext if re.fullmatch(r"\.[a-z0-9]{1,8}", ext) else ""


@router.get("/api/parts/{part_id}/attachments", response_model=list[Attachment])
def list_attachments(part_id: int, user: dict = Depends(get_current_user)):
    with pool.connection() as conn:
        conn.row_factory = dict_row
        return conn.execute(
            "SELECT id, filename, content_type, size_bytes, uploaded_by, uploaded_at "
            "FROM part_attachments WHERE part_id = %s ORDER BY uploaded_at DESC",
            (part_id,),
        ).fetchall()


@router.post("/api/parts/{part_id}/attachments", response_model=Attachment)
async def upload_attachment(
    part_id: int, file: UploadFile, user: dict = Depends(require_editor)
):
    updir = Path(settings.upload_dir)
    updir.mkdir(parents=True, exist_ok=True)
    original = file.filename or "file"
    stored = uuid.uuid4().hex + _safe_ext(original)
    dest = updir / stored

    size = 0
    try:
        with open(dest, "wb") as f:
            while chunk := await file.read(CHUNK):
                size += len(chunk)
                if size > MAX_SIZE:
                    raise HTTPException(status_code=413, detail="File too large (max 25 MB)")
                f.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        with pool.connection() as conn:
            conn.row_factory = dict_row
            part = conn.execute(
                "SELECT poh_num, poh_line FROM parts WHERE id = %s", (part_id,)
            ).fetchone()
            if not part:
                raise HTTPException(status_code=404, detail="Part not found")
            row = conn.execute(
                "INSERT INTO part_attachments (part_id, poh_num, poh_line, filename, "
                "stored_name, content_type, size_bytes, uploaded_by) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
                "RETURNING id, filename, content_type, size_bytes, uploaded_by, uploaded_at",
                (part_id, part["poh_num"], part["poh_line"], original, stored,
                 file.content_type, size, user["email"]),
            ).fetchone()
            conn.execute(
                "INSERT INTO part_audit (part_id, poh_num, poh_line, field, "
                "old_value, new_value, changed_by) "
                "VALUES (%s, %s, %s, 'attachment', NULL, %s, %s)",
                (part_id, part["poh_num"], part["poh_line"], original, user["email"]),
            )
            conn.commit()
        return row
    except Exception:
        dest.unlink(missing_ok=True)
        raise


@router.get("/api/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int, download: bool = False, user: dict = Depends(get_current_user)
):
    with pool.connection() as conn:
        conn.row_factory = dict_row
        row = conn.execute(
            "SELECT filename, stored_name, content_type FROM part_attachments WHERE id = %s",
            (attachment_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Attachment not found")
    path = Path(settings.upload_dir) / row["stored_name"]
    if not path.is_file():
        raise HTTPException(status_code=410, detail="File missing on disk")
    # inline lets the browser preview PDFs/images in a tab;
    # ?download=1 forces a save dialog
    return FileResponse(
        path,
        filename=row["filename"],
        media_type=row["content_type"] or "application/octet-stream",
        content_disposition_type="attachment" if download else "inline",
    )


@router.delete("/api/attachments/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: int, user: dict = Depends(require_editor)):
    with pool.connection() as conn:
        conn.row_factory = dict_row
        row = conn.execute(
            "DELETE FROM part_attachments WHERE id = %s "
            "RETURNING part_id, poh_num, poh_line, filename, stored_name",
            (attachment_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Attachment not found")
        conn.execute(
            "INSERT INTO part_audit (part_id, poh_num, poh_line, field, "
            "old_value, new_value, changed_by) "
            "VALUES (%s, %s, %s, 'attachment', %s, NULL, %s)",
            (row["part_id"], row["poh_num"], row["poh_line"], row["filename"],
             user["email"]),
        )
        conn.commit()
    (Path(settings.upload_dir) / row["stored_name"]).unlink(missing_ok=True)
