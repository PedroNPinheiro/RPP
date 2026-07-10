from datetime import date

from fastapi import APIRouter, Depends
from psycopg.rows import dict_row

from ..auth import get_current_user
from ..db import pool

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

NONE_BUCKET = "(no status)"

# rebuild today's snapshot for both dimensions from the current parts
REBUILD = """
    DELETE FROM status_snapshot WHERE snap_date = CURRENT_DATE;

    INSERT INTO status_snapshot (snap_date, dimension, bucket, count)
    SELECT CURRENT_DATE, 'status', COALESCE(NULLIF(status, ''), %(none)s), count(*)
    FROM parts GROUP BY COALESCE(NULLIF(status, ''), %(none)s);

    INSERT INTO status_snapshot (snap_date, dimension, bucket, count)
    SELECT CURRENT_DATE, 'priority', COALESCE(NULLIF(priority, ''), %(none)s), count(*)
    FROM parts GROUP BY COALESCE(NULLIF(priority, ''), %(none)s);
"""


def rebuild_today() -> None:
    """Replace today's snapshot with the current parts distribution.
    Idempotent — also run hourly by the background task in main.py so
    history has no gaps on days nobody opens Analytics."""
    with pool.connection() as conn:
        conn.execute(REBUILD, {"none": NONE_BUCKET})
        conn.commit()


@router.get("/snapshots")
def snapshots(user: dict = Depends(get_current_user)):
    """Ensure today's snapshot exists, then return the full daily history."""
    rebuild_today()
    with pool.connection() as conn:
        conn.row_factory = dict_row
        rows = conn.execute(
            "SELECT snap_date, dimension, bucket, count "
            "FROM status_snapshot ORDER BY snap_date, dimension, bucket"
        ).fetchall()
    return {
        "today": date.today().isoformat(),
        "rows": rows,
    }
