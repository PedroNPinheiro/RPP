"""
Replacement Parts sync — ONE-SHOT.

Run on the Windows VM (the only host with Sage access) by Windows Task
Scheduler every 15 min. Reads the flagged PO lines from Sage X3 and UPSERTs
them into cloud Postgres over the WireGuard tunnel. Updates ONLY the
Sage-owned columns, so the team's manually-filled columns are never touched.

After upserting, it RECONCILES: lines no longer present in Sage's flagged set
(e.g. a line whose article was changed — Sage replaces it with a new line
number) are deleted, so the dashboard doesn't accumulate orphans. Deletion is
guarded so an empty or implausibly small Sage read can never wipe the table.

Config comes from a .env file next to this script — no secrets in code.
Use a READ-ONLY Sage login in production. Exit code 0 = success, 1 = failure.
"""
import os
import sys
import logging
from datetime import datetime, timezone
from pathlib import Path

import pyodbc
import psycopg
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
# utf-8-sig tolerates a BOM (PowerShell's Set-Content -Encoding UTF8 adds one).
load_dotenv(HERE / ".env", encoding="utf-8-sig")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(HERE / "sync.log", encoding="utf-8"),
              logging.StreamHandler()],
)
log = logging.getLogger("rpp-sync")

SAGE_CONN = os.environ["SAGE_CONN"]
SAGE_SCHEMA = os.getenv("SAGE_SCHEMA", "CASCOQLD")
SAGE_RP_FILTER = os.getenv("SAGE_RP_FILTER", "h.ZRPP_0 = 2").strip()
PG_CONN = os.environ["PG_CONN"]

# Column order must match the SELECT below and the parts table.
SAGE_COLS = [
    "poh_num", "poh_line", "po_date", "item_code", "item_desc", "qty_ordered",
    "qty_received", "line_value", "unit_price", "currency", "expected_receipt",
    "line_site", "receipt_site", "supplier_code", "supplier_name", "order_ref",
    "sage_tracking", "sage_delivered",
]
UPDATE_COLS = [c for c in SAGE_COLS if c not in ("poh_num", "poh_line")]

QUERY = f"""
    SELECT q.POHNUM_0, q.POPLIN_0, q.ORDDAT_0, q.ITMREF_0, p.ITMDES1_0,
           q.QTYPUU_0, q.RCPQTYPUU_0, q.LINAMT_0, p.NETPRI_0, h.CUR_0,
           q.EXTRCPDAT_0, q.LINSTOFCY_0, h.RCPFCY_0, h.BPSNUM_0, h.BPRNAM_0,
           h.ORDREF_0, h.ZTRKNUM_0, h.ZPODEL_0
    FROM {SAGE_SCHEMA}.PORDERQ q
    JOIN {SAGE_SCHEMA}.PORDER  h ON h.POHNUM_0 = q.POHNUM_0
    LEFT JOIN {SAGE_SCHEMA}.PORDERP p
           ON p.POHNUM_0 = q.POHNUM_0 AND p.POPLIN_0 = q.POPLIN_0
    WHERE {SAGE_RP_FILTER}
    ORDER BY q.POHNUM_0, q.POPLIN_0
"""

UPSERT = (f"INSERT INTO parts ({', '.join(SAGE_COLS)}, synced_at) "
          f"VALUES ({', '.join(['%s'] * len(SAGE_COLS))}, now()) "
          f"ON CONFLICT (poh_num, poh_line) DO UPDATE SET "
          + ", ".join(f"{c}=EXCLUDED.{c}" for c in UPDATE_COLS)
          + ", synced_at=now()")

RUN_OK = ("INSERT INTO sync_runs (started_at, finished_at, rows_upserted, ok, error)"
          " VALUES (%s, now(), %s, true, null)")
RUN_ERR = ("INSERT INTO sync_runs (started_at, finished_at, rows_upserted, ok, error)"
           " VALUES (%s, now(), 0, false, %s)")

# Reconcile safety: never delete more than this share of the table in one run,
# and never fewer than this floor of rows — a bad/partial Sage read that would
# orphan most lines is skipped and logged instead of silently wiping data.
RECONCILE_MAX_FRACTION = 0.40
RECONCILE_MIN_FLOOR = 25


def reconcile(cur) -> int:
    """Delete lines not touched by this run's UPSERT. Every current line just
    got synced_at = now() (constant within this transaction), so a NULL or
    older synced_at means the line is gone from Sage. Guarded against mass
    deletion. Returns the number removed."""
    stale, total = cur.execute(
        "SELECT count(*) FILTER (WHERE synced_at IS NULL OR synced_at < now()), "
        "count(*) FROM parts"
    ).fetchone()
    if stale == 0:
        return 0
    limit = max(RECONCILE_MIN_FLOOR, int(total * RECONCILE_MAX_FRACTION))
    if stale > limit:
        log.warning(
            "reconcile SKIPPED: %d/%d lines look stale (over safety limit %d) — "
            "not deleting; check the Sage read before trusting this run", stale, total, limit,
        )
        return 0
    gone = cur.execute(
        "DELETE FROM parts WHERE synced_at IS NULL OR synced_at < now() "
        "RETURNING poh_num, poh_line"
    ).fetchall()
    for pn, pl in gone:
        log.info("reconcile removed stale line %s / %s", pn, pl)
    return len(gone)


def main() -> int:
    started = datetime.now(timezone.utc)
    try:
        with pyodbc.connect(SAGE_CONN, timeout=30) as sc:
            rows = [tuple(r) for r in sc.cursor().execute(QUERY).fetchall()]
        removed = 0
        with psycopg.connect(PG_CONN, connect_timeout=15) as pg:
            with pg.cursor() as cur:
                cur.executemany(UPSERT, rows)
                # only reconcile when we actually read flagged lines — an empty
                # read is treated as a failure, never as "delete everything"
                if rows:
                    removed = reconcile(cur)
            pg.execute(RUN_OK, (started, len(rows)))
            pg.commit()
        log.info("synced %d PO line(s), removed %d stale line(s)", len(rows), removed)
        return 0
    except Exception as e:
        log.exception("sync failed")
        try:
            with psycopg.connect(PG_CONN, connect_timeout=10) as pg:
                pg.execute(RUN_ERR, (started, str(e)))
                pg.commit()
        except Exception:
            log.warning("could not record failure in sync_runs")
        return 1


if __name__ == "__main__":
    sys.exit(main())
