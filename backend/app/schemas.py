from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class Part(BaseModel):
    """A full PO line as shown on the dashboard (parts_dashboard view)."""
    id: int
    poh_num: str
    poh_line: int

    # --- Sage-synced (read-only in the UI) ---
    po_date: Optional[date] = None
    item_code: Optional[str] = None
    item_desc: Optional[str] = None
    qty_ordered: Optional[Decimal] = None
    qty_received: Optional[Decimal] = None
    line_value: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    currency: Optional[str] = None
    expected_receipt: Optional[date] = None
    line_site: Optional[str] = None
    receipt_site: Optional[str] = None
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    order_ref: Optional[str] = None
    of_number: Optional[str] = None
    pc_number: Optional[str] = None
    sage_tracking: Optional[str] = None
    sage_delivered: Optional[int] = None
    synced_at: Optional[datetime] = None

    # --- Team-filled (editable) ---
    entregue_war: Optional[date] = None
    sent_to_production: Optional[date] = None
    production_closing: Optional[date] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    area: Optional[str] = None
    tank: Optional[str] = None
    estimated_date: Optional[date] = None
    required_ship: Optional[date] = None
    eta_pc: Optional[date] = None
    drawings_required: Optional[bool] = None
    drawings_desc: Optional[str] = None
    dest_type: Optional[str] = None
    real_ship_date: Optional[date] = None
    shipping_method: Optional[str] = None
    tracking: Optional[str] = None
    notes: Optional[str] = None
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None

    # populated by the list endpoint
    attachment_count: Optional[int] = None

    # --- Computed (from the view) ---
    today: Optional[date] = None
    balance_qty: Optional[Decimal] = None
    delay_days: Optional[int] = None
    ready: Optional[str] = None


class PartUpdate(BaseModel):
    """Only the team-editable columns. This model IS the security boundary:
    the PATCH endpoint can only touch fields declared here, so the API can
    never overwrite a Sage-synced column (and the sync can never clobber these).

    of_number / pc_number are team-filled for now (the sync never writes
    them); if we later automate them from Sage, remove them from this model.
    """
    of_number: Optional[str] = None
    pc_number: Optional[str] = None
    entregue_war: Optional[date] = None
    sent_to_production: Optional[date] = None
    production_closing: Optional[date] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    area: Optional[str] = None
    tank: Optional[str] = None
    estimated_date: Optional[date] = None
    required_ship: Optional[date] = None
    eta_pc: Optional[date] = None
    drawings_required: Optional[bool] = None
    drawings_desc: Optional[str] = None
    dest_type: Optional[str] = None
    real_ship_date: Optional[date] = None
    shipping_method: Optional[str] = None
    tracking: Optional[str] = None
    notes: Optional[str] = None


class BulkUpdate(BaseModel):
    """Bulk edit: same PartUpdate whitelist applied to many lines at once."""
    ids: list[int]
    fields: PartUpdate


class SyncStatus(BaseModel):
    started_at: Optional[datetime] = None
    rows_upserted: Optional[int] = None
    ok: Optional[bool] = None


class AuditEntry(BaseModel):
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[str] = None
    changed_at: Optional[datetime] = None


class Attachment(BaseModel):
    id: int
    filename: str
    content_type: Optional[str] = None
    size_bytes: int
    uploaded_by: Optional[str] = None
    uploaded_at: Optional[datetime] = None


class RecentAuditEntry(AuditEntry):
    part_id: int
    poh_num: str
    poh_line: int
    item_desc: Optional[str] = None
