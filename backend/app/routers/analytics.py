from datetime import date

from fastapi import APIRouter, Depends
from psycopg.rows import dict_row

from ..auth import get_current_user
from ..db import pool

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

NONE_BUCKET = "(no status)"

# Closed = completed or cancelled. Each day we record TWO scopes so the
# history can be viewed either way: 'all' (every line) and 'open' (excludes
# closed) — the 'open' trend shows the live backlog instead of an
# ever-growing cumulative total.
CLOSED_STATUSES = ("Completo", "Cancelado")

# one statement per execute — psycopg's parameterized queries use prepared
# statements, which reject multiple commands in a single call. {where} is a
# trusted literal (never user input), filled per scope below.
SNAPSHOT_DIM = """
    INSERT INTO status_snapshot (snap_date, dimension, scope, bucket, count)
    SELECT CURRENT_DATE, %(dim)s, %(scope)s, COALESCE(NULLIF({col}, ''), %(none)s), count(*)
    FROM parts
    {where}
    GROUP BY COALESCE(NULLIF({col}, ''), %(none)s)
"""
OPEN_WHERE = "WHERE status IS NULL OR status <> ALL(%(closed)s)"

# Delay evolution: how many lines are past their expected receipt date, split
# by how late they are. Reads parts_dashboard because delay_days is computed
# there (same definition the dashboard's Delayed tab uses).
SNAPSHOT_DELAY = """
    INSERT INTO status_snapshot (snap_date, dimension, scope, bucket, count)
    SELECT CURRENT_DATE, 'delay', %(scope)s, bucket, count(*)
    FROM (
        SELECT CASE
                 WHEN delay_days <= 7  THEN '1-7 days'
                 WHEN delay_days <= 30 THEN '8-30 days'
                 ELSE '31+ days'
               END AS bucket
        FROM parts_dashboard
        WHERE delay_days > 0
        {and_open}
    ) t
    GROUP BY bucket
"""
AND_OPEN = "AND (status IS NULL OR status <> ALL(%(closed)s))"

# Drawings progress: among lines that REQUIRE a drawing, how many are concluded
# vs still pending. Buckets must match DRAWINGS_ORDER in frontend/src/charts.ts.
SNAPSHOT_DRAWINGS = """
    INSERT INTO status_snapshot (snap_date, dimension, scope, bucket, count)
    SELECT CURRENT_DATE, 'drawings', %(scope)s, bucket, count(*)
    FROM (
        SELECT CASE WHEN drawings_done THEN 'Concluded' ELSE 'Pending' END AS bucket
        FROM parts
        WHERE drawings_required = true
        {and_open}
    ) t
    GROUP BY bucket
"""


def rebuild_today() -> None:
    """Replace today's snapshot with the current parts distribution, in both
    scopes. Idempotent — also run hourly by the background task in main.py so
    history has no gaps on days nobody opens Analytics."""
    params = {"none": NONE_BUCKET, "closed": list(CLOSED_STATUSES)}
    with pool.connection() as conn:
        conn.execute("DELETE FROM status_snapshot WHERE snap_date = CURRENT_DATE")
        # dimension name == the parts column grouped on. 'area' gets its own
        # "no value" label; status/priority keep the shared NONE_BUCKET.
        for dim in ("status", "priority", "area"):
            none = "(no área)" if dim == "area" else NONE_BUCKET
            conn.execute(
                SNAPSHOT_DIM.format(col=dim, where=""),
                {**params, "dim": dim, "scope": "all", "none": none},
            )
            conn.execute(
                SNAPSHOT_DIM.format(col=dim, where=OPEN_WHERE),
                {**params, "dim": dim, "scope": "open", "none": none},
            )
        # 'all' = everything past due (incl. lines since closed);
        # 'open' = still-open late lines, matching the Delayed tab
        conn.execute(SNAPSHOT_DELAY.format(and_open=""), {**params, "scope": "all"})
        conn.execute(SNAPSHOT_DELAY.format(and_open=AND_OPEN), {**params, "scope": "open"})
        # drawings-required lines: concluded vs pending ('open' = still-open ones)
        conn.execute(SNAPSHOT_DRAWINGS.format(and_open=""), {**params, "scope": "all"})
        conn.execute(SNAPSHOT_DRAWINGS.format(and_open=AND_OPEN), {**params, "scope": "open"})
        conn.commit()


@router.get("/snapshots")
def snapshots(user: dict = Depends(get_current_user)):
    """Ensure today's snapshot exists, then return the full daily history."""
    rebuild_today()
    with pool.connection() as conn:
        conn.row_factory = dict_row
        rows = conn.execute(
            "SELECT snap_date, dimension, scope, bucket, count "
            "FROM status_snapshot ORDER BY snap_date, dimension, scope, bucket"
        ).fetchall()
    return {
        "today": date.today().isoformat(),
        "rows": rows,
    }
