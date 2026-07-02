from typing import Optional

from fastapi import APIRouter
from psycopg.rows import dict_row

from ..db import pool
from ..schemas import SyncStatus

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    try:
        with pool.connection() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "db": "up"}
    except Exception as e:  # surfaced by a monitor / the dashboard banner
        return {"status": "degraded", "db": "down", "error": str(e)}


@router.get("/api/sync-status", response_model=Optional[SyncStatus])
def sync_status():
    """Latest sync run — powers the dashboard's 'last synced' indicator."""
    with pool.connection() as conn:
        conn.row_factory = dict_row
        return conn.execute(
            "SELECT started_at, rows_upserted, ok FROM sync_runs ORDER BY id DESC LIMIT 1"
        ).fetchone()
