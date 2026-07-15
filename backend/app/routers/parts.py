from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from psycopg.rows import dict_row

from ..auth import get_current_user, require_editor
from ..db import pool
from ..notify import drawings_notify_enabled, send_drawings_notification
from ..schemas import AuditEntry, BulkUpdate, Part, PartUpdate

router = APIRouter(prefix="/api/parts", tags=["parts"])


@router.get("", response_model=list[Part])
def list_parts(user: dict = Depends(get_current_user)):
    with pool.connection() as conn:
        conn.row_factory = dict_row
        return conn.execute(
            "SELECT p.*, (SELECT count(*) FROM part_attachments a "
            "WHERE a.part_id = p.id) AS attachment_count "
            "FROM parts_dashboard p ORDER BY p.poh_num, p.poh_line"
        ).fetchall()


def _s(v) -> str | None:
    """Stringify a value for the audit log (None stays NULL)."""
    return None if v is None else str(v)


@router.post("/bulk", response_model=list[Part])
def bulk_update(patch: BulkUpdate, tasks: BackgroundTasks, user: dict = Depends(require_editor)):
    """Apply the same team-field values to many lines in one transaction.
    Audits per line, exactly like single edits. POST (not PATCH) so the
    path can't be shadowed by the /{part_id} route."""
    fields = patch.fields.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    if not patch.ids:
        raise HTTPException(status_code=400, detail="No lines selected")

    cols = list(fields.keys())
    set_clause = ", ".join(f"{col} = %({col})s" for col in cols)

    with pool.connection() as conn:
        conn.row_factory = dict_row
        current_rows = conn.execute(
            f"SELECT id, poh_num, poh_line, {', '.join(cols)} FROM parts "
            f"WHERE id = ANY(%s) FOR UPDATE",
            (patch.ids,),
        ).fetchall()
        if not current_rows:
            raise HTTPException(status_code=404, detail="No matching lines")

        conn.execute(
            f"UPDATE parts SET {set_clause}, updated_by = %(updated_by)s, "
            f"updated_at = now() WHERE id = ANY(%(ids)s)",
            {**fields, "ids": patch.ids, "updated_by": user["email"]},
        )
        audit_rows = [
            (row["id"], row["poh_num"], row["poh_line"],
             col, _s(row[col]), _s(fields[col]), user["email"])
            for row in current_rows
            for col in cols
            if row[col] != fields[col]
        ]
        if audit_rows:
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO part_audit "
                    "(part_id, poh_num, poh_line, field, old_value, new_value, changed_by) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    audit_rows,
                )
        conn.commit()

        result = conn.execute(
            "SELECT * FROM parts_dashboard WHERE id = ANY(%s) "
            "ORDER BY poh_num, poh_line",
            (patch.ids,),
        ).fetchall()

    # 'Drawings?' just flipped to Yes on these lines -> notify (post-response)
    if fields.get("drawings_required") is True and drawings_notify_enabled():
        ticked_ids = {r["id"] for r in current_rows if not r["drawings_required"]}
        ticked = [dict(r) for r in result if r["id"] in ticked_ids]
        if ticked:
            tasks.add_task(send_drawings_notification, ticked, user["email"])
    return result


@router.patch("/{part_id}", response_model=Part)
def update_part(part_id: int, patch: PartUpdate, tasks: BackgroundTasks, user: dict = Depends(require_editor)):
    # Only fields the client actually sent; keys are constrained to PartUpdate's
    # whitelist, so the composed column list can never include a Sage column.
    fields = patch.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    cols = list(fields.keys())
    set_clause = ", ".join(f"{col} = %({col})s" for col in cols)
    params = {**fields, "id": part_id, "updated_by": user["email"]}

    with pool.connection() as conn:
        conn.row_factory = dict_row
        # read current values (locked) so the audit diff and the update are
        # one atomic unit
        current = conn.execute(
            f"SELECT poh_num, poh_line, {', '.join(cols)} FROM parts "
            f"WHERE id = %s FOR UPDATE",
            (part_id,),
        ).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Part not found")

        changes = [
            (col, current[col], fields[col])
            for col in cols
            if current[col] != fields[col]
        ]

        conn.execute(
            f"UPDATE parts SET {set_clause}, updated_by = %(updated_by)s, "
            f"updated_at = now() WHERE id = %(id)s",
            params,
        )
        for col, old, new in changes:
            conn.execute(
                "INSERT INTO part_audit "
                "(part_id, poh_num, poh_line, field, old_value, new_value, changed_by) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (part_id, current["poh_num"], current["poh_line"],
                 col, _s(old), _s(new), user["email"]),
            )
        conn.commit()

        # Re-read from the view so computed columns come back too.
        final = conn.execute(
            "SELECT * FROM parts_dashboard WHERE id = %s", (part_id,)
        ).fetchone()

    if (
        drawings_notify_enabled()
        and any(col == "drawings_required" and bool(new) and not bool(old)
                for col, old, new in changes)
    ):
        tasks.add_task(send_drawings_notification, [dict(final)], user["email"])
    return final


@router.get("/{part_id}/audit", response_model=list[AuditEntry])
def part_audit(part_id: int, user: dict = Depends(get_current_user)):
    with pool.connection() as conn:
        conn.row_factory = dict_row
        return conn.execute(
            "SELECT field, old_value, new_value, changed_by, changed_at "
            "FROM part_audit WHERE part_id = %s "
            "ORDER BY changed_at DESC, id DESC LIMIT 200",
            (part_id,),
        ).fetchall()
