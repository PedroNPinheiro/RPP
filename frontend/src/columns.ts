import type { Part } from "./types";

export type ColType = "text" | "date" | "number" | "bool";
export type ColGroup = "sage" | "computed" | "team";

export interface Col {
  key: keyof Part;
  label: string;
  type: ColType;
  group: ColGroup;
  editable?: boolean;
}

// Column order roughly follows the original Smartsheet. Sage + computed are
// read-only; team columns are editable and PATCH back to the API.
export const COLUMNS: Col[] = [
  { key: "poh_num", label: "PO", type: "text", group: "sage" },
  { key: "poh_line", label: "Line", type: "number", group: "sage" },
  { key: "item_code", label: "Code", type: "text", group: "sage" },
  { key: "item_desc", label: "Item", type: "text", group: "sage" },
  { key: "qty_ordered", label: "Qty", type: "number", group: "sage" },
  { key: "qty_received", label: "Received", type: "number", group: "sage" },
  { key: "balance_qty", label: "Balance", type: "number", group: "computed" },
  { key: "line_value", label: "Value", type: "number", group: "sage" },
  { key: "currency", label: "Cur", type: "text", group: "sage" },
  { key: "po_date", label: "PO Date", type: "date", group: "sage" },
  { key: "expected_receipt", label: "Expected", type: "date", group: "sage" },
  { key: "delay_days", label: "Delay", type: "number", group: "computed" },
  { key: "supplier_name", label: "Supplier", type: "text", group: "sage" },
  { key: "line_site", label: "Site", type: "text", group: "sage" },

  { key: "status", label: "Status", type: "text", group: "team", editable: true },
  { key: "priority", label: "Priority", type: "text", group: "team", editable: true },
  { key: "dest_type", label: "Dest Type", type: "text", group: "team", editable: true },
  { key: "shipping_method", label: "Shipping", type: "text", group: "team", editable: true },
  { key: "tank", label: "Tank", type: "text", group: "team", editable: true },
  { key: "required_ship", label: "Required Ship", type: "date", group: "team", editable: true },
  { key: "real_ship_date", label: "Real Ship", type: "date", group: "team", editable: true },
  { key: "drawings_required", label: "Drawings?", type: "bool", group: "team", editable: true },
  { key: "tracking", label: "Tracking", type: "text", group: "team", editable: true },
  { key: "notes", label: "Notes", type: "text", group: "team", editable: true },
];
