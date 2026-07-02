from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row

from ..auth import get_current_user
from ..db import pool
from ..schemas import AuditEntry, Part, PartUpdate

router = APIRouter(prefix="/api/parts", tags=["parts"])


@router.get("", response_model=list[Part])
def list_parts(user: dict = Depends(get_current_user)):
    with pool.connection() as conn:
        conn.row_factory = dict_row
        return conn.execute(
            "SELECT * FROM parts_dashboard ORDER BY poh_num, poh_line"
        ).fetchall()


def _s(v) -> str | None:
    """Stringify a value for the audit log (None stays NULL)."""
    return None if v is None else str(v)


@router.patch("/{part_id}", response_model=Part)
def update_part(part_id: int, patch: PartUpdate, user: dict = Depends(get_current_user)):
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
        return conn.execute(
            "SELECT * FROM parts_dashboard WHERE id = %s", (part_id,)
        ).fetchone()


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
