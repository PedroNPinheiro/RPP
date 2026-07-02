import type { Part } from "./types";

export type ColType = "text" | "date" | "number" | "bool" | "select";
export type ColGroup = "sage" | "computed" | "team";

export interface Col {
  key: keyof Part;
  label: string;
  type: ColType;
  group: ColGroup;
  editable?: boolean;
  options?: string[]; // for type "select"
  ellipsis?: boolean; // cap width, ellipsize, tooltip
}

export const PRIORITY_OPTIONS = ["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"];
export const DEST_TYPE_OPTIONS = ["CSS - Stock", "CSR - Replacement"];

// Line and Currency are merged into the PO and Value cells (rendered in
// PartsTable), so they don't occupy their own columns.
export const COLUMNS: Col[] = [
  { key: "poh_num", label: "PO", type: "text", group: "sage" },
  { key: "item_code", label: "Code", type: "text", group: "sage" },
  { key: "item_desc", label: "Item", type: "text", group: "sage", ellipsis: true },
  { key: "qty_ordered", label: "Qty", type: "number", group: "sage" },
  { key: "qty_received", label: "Rcvd", type: "number", group: "sage" },
  { key: "balance_qty", label: "Balance", type: "number", group: "computed" },
  { key: "line_value", label: "Value", type: "number", group: "sage" },
  { key: "po_date", label: "PO Date", type: "date", group: "sage" },
  { key: "expected_receipt", label: "Expected", type: "date", group: "sage" },
  { key: "delay_days", label: "Delay", type: "number", group: "computed" },
  { key: "supplier_name", label: "Supplier", type: "text", group: "sage", ellipsis: true },
  { key: "line_site", label: "Site", type: "text", group: "sage" },

  { key: "status", label: "Status", type: "text", group: "team", editable: true },
  { key: "priority", label: "Priority", type: "select", group: "team", editable: true, options: PRIORITY_OPTIONS },
  { key: "dest_type", label: "Dest Type", type: "select", group: "team", editable: true, options: DEST_TYPE_OPTIONS },
  { key: "shipping_method", label: "Shipping", type: "text", group: "team", editable: true },
  { key: "tank", label: "Tank", type: "text", group: "team", editable: true },
  { key: "required_ship", label: "Required Ship", type: "date", group: "team", editable: true },
  { key: "real_ship_date", label: "Real Ship", type: "date", group: "team", editable: true },
  { key: "drawings_required", label: "Drawings?", type: "bool", group: "team", editable: true },
  { key: "tracking", label: "Tracking", type: "text", group: "team", editable: true },
  { key: "notes", label: "Notes", type: "text", group: "team", editable: true, ellipsis: true },
];
