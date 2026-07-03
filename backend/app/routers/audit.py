from fastapi import APIRouter, Depends
from psycopg.rows import dict_row

from ..auth import get_current_user
from ..db import pool
from ..schemas import RecentAuditEntry

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/recent", response_model=list[RecentAuditEntry])
def recent(limit: int = 50, user: dict = Depends(get_current_user)):
    limit = max(1, min(limit, 200))
    with pool.connection() as conn:
        conn.row_factory = dict_row
        return conn.execute(
            "SELECT a.part_id, a.poh_num, a.poh_line, a.field, a.old_value, "
            "a.new_value, a.changed_by, a.changed_at, p.item_desc "
            "FROM part_audit a LEFT JOIN parts p ON p.id = a.part_id "
            "ORDER BY a.changed_at DESC, a.id DESC LIMIT %s",
            (limit,),
        ).fetchall()
