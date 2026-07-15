// Mirrors the backend Part schema. NUMERIC values arrive as strings (they
// come from Postgres NUMERIC / Python Decimal), so numeric fields are strings.

export interface Part {
  id: number;
  poh_num: string;
  poh_line: number;

  // Sage-synced (read-only)
  po_date: string | null;
  item_code: string | null;
  item_desc: string | null;
  qty_ordered: string | null;
  qty_received: string | null;
  line_value: string | null;
  unit_price: string | null;
  currency: string | null;
  expected_receipt: string | null;
  line_site: string | null;
  receipt_site: string | null;
  supplier_code: string | null;
  supplier_name: string | null;
  order_ref: string | null;
  of_number: string | null;
  pc_number: string | null;
  sage_tracking: string | null;
  sage_delivered: number | null;
  synced_at: string | null;

  // Team-filled (editable)
  entregue_war: string | null;
  sent_to_production: string | null;
  production_closing: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  tank: string | null;
  estimated_date: string | null;
  required_ship: string | null;
  eta_pc: string | null;
  drawings_required: boolean | null;
  drawings_desc: string | null;
  dest_type: string | null;
  real_ship_date: string | null;
  shipping_method: string | null;
  tracking: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;

  attachment_count?: number | null;

  // Computed (view)
  today: string | null;
  balance_qty: string | null;
  delay_days: number | null;
  ready: string | null;
}

export interface SyncStatus {
  started_at: string | null;
  rows_upserted: number | null;
  ok: boolean | null;
}

export interface AuditEntry {
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string | null;
}

export interface Attachment {
  id: number;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  uploaded_by: string | null;
  uploaded_at: string | null;
}

export interface RecentAuditEntry extends AuditEntry {
  part_id: number;
  poh_num: string;
  poh_line: number;
  item_desc: string | null;
}
