from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row

from ..auth import get_current_user
from ..db import pool
from ..schemas import Part, PartUpdate

router = APIRouter(prefix="/api/parts", tags=["parts"])


@router.get("", response_model=list[Part])
def list_parts(user: dict = Depends(get_current_user)):
    with pool.connection() as conn:
        conn.row_factory = dict_row
        return conn.execute(
            "SELECT * FROM parts_dashboard ORDER BY poh_num, poh_line"
        ).fetchall()


@router.patch("/{part_id}", response_model=Part)
def update_part(part_id: int, patch: PartUpdate, user: dict = Depends(get_current_user)):
    # Only fields the client actually sent; keys are constrained to PartUpdate's
    # whitelist, so the composed column list can never include a Sage column.
    fields = patch.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{col} = %({col})s" for col in fields)
    params = {**fields, "id": part_id, "updated_by": user["email"]}

    with pool.connection() as conn:
        conn.row_factory = dict_row
        updated = conn.execute(
            f"UPDATE parts SET {set_clause}, updated_by = %(updated_by)s, "
            f"updated_at = now() WHERE id = %(id)s RETURNING id",
            params,
        ).fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail="Part not found")
        conn.commit()
        # Re-read from the view so computed columns come back too.
        return conn.execute(
            "SELECT * FROM parts_dashboard WHERE id = %s", (part_id,)
        ).fetchone()
