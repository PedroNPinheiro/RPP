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
/* the team's categories, carried over from the old Smartsheet sections */
export const CATEGORY_OPTIONS = [
  "DIRECT CASCO US",
  "DIRECT CASCO UK",
  "DIRECT TO STORE",
  "STOCK IN HOUSE",
  "Electrics",
  "Aluminium",
  "WK",
  "Plumbing",
  "Glass Tanks",
  "GLASS COMPONENTS",
  "Joinery",
  "Vinyl",
  "Straightforward Supplies",
];
export const AREA_OPTIONS = ["Produção", "Logística"];
export const DEST_TYPE_OPTIONS = ["CSS - Stock", "CSR - Replacement"];
export const SHIPPING_OPTIONS = [
  "1 - UPS",
  "2 - Truck",
  "3 - Container MSC",
  "4 - Air Pallet",
  "5 - Self Transport by Engineer",
  "6 - Costumer to Collect",
  "7 - To Be Defined",
  "8 - DPD",
  "9 - Direct Delivery from Supplier",
];
export const STATUS_OPTIONS = [
  "Por Iniciar",
  "Em Andamento",
  "Pronto para Sair",
  "Problema/Falta de Informação",
  "Cancelado",
  "Completo",
];

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

  { key: "status", label: "Status", type: "select", group: "team", editable: true, options: STATUS_OPTIONS },
  { key: "priority", label: "Priority", type: "select", group: "team", editable: true, options: PRIORITY_OPTIONS },
  { key: "category", label: "Category", type: "select", group: "team", editable: true, options: CATEGORY_OPTIONS },
  { key: "area", label: "Área", type: "select", group: "team", editable: true, options: AREA_OPTIONS },
  { key: "of_number", label: "OF", type: "text", group: "team", editable: true },
  { key: "pc_number", label: "PC", type: "text", group: "team", editable: true },
  { key: "dest_type", label: "Dest Type", type: "select", group: "team", editable: true, options: DEST_TYPE_OPTIONS },
  { key: "shipping_method", label: "Shipping", type: "select", group: "team", editable: true, options: SHIPPING_OPTIONS },
  { key: "tank", label: "Tank", type: "text", group: "team", editable: true },
  { key: "entregue_war", label: "Entregue WAR", type: "date", group: "team", editable: true },
  { key: "sent_to_production", label: "Sent to Prod", type: "date", group: "team", editable: true },
  { key: "production_closing", label: "Prod Closing", type: "date", group: "team", editable: true },
  { key: "estimated_date", label: "Estimated Ship", type: "date", group: "team", editable: true },
  { key: "required_ship", label: "Required Ship", type: "date", group: "team", editable: true },
  { key: "real_ship_date", label: "Real Ship", type: "date", group: "team", editable: true },
  { key: "eta_pc", label: "ETA PC", type: "date", group: "team", editable: true },
  { key: "drawings_required", label: "Drawings?", type: "bool", group: "team", editable: true },
  { key: "drawings_desc", label: "Drawings Desc", type: "text", group: "team", editable: true },
  { key: "drawings_done", label: "Drawing concluded", type: "bool", group: "team", editable: true },
  { key: "tracking", label: "Tracking", type: "text", group: "team", editable: true },
  { key: "notes", label: "Notes", type: "text", group: "team", editable: true, ellipsis: true },
];

export const FIELD_LABELS: Record<string, string> = {
  ...Object.fromEntries(COLUMNS.map((c) => [String(c.key), c.label])),
  attachment: "Attachment",
};

/* The table shows only the essentials — everything else lives in the
   detail drawer. This is what keeps the table free of horizontal scroll. */
const TABLE_KEYS: (keyof Part)[] = [
  "poh_num", "item_code", "item_desc", "qty_ordered", "qty_received",
  "balance_qty", "po_date",
  "expected_receipt", "status", "priority", "area", "category",
  "of_number", "pc_number",
];
export const TABLE_COLUMNS: Col[] = TABLE_KEYS.map(
  (k) => COLUMNS.find((c) => c.key === k)!,
);

/* Detail drawer form, grouped into sections */
export const DETAIL_GROUPS: { title: string; keys: (keyof Part)[] }[] = [
  { title: "Workflow", keys: ["status", "priority", "area", "category"] },
  { title: "References", keys: ["of_number", "pc_number", "tank"] },
  { title: "Logistics", keys: ["dest_type", "shipping_method", "tracking"] },
  {
    title: "Dates",
    keys: [
      "entregue_war", "sent_to_production", "production_closing",
      "estimated_date", "required_ship", "real_ship_date", "eta_pc",
    ],
  },
  { title: "Drawings", keys: ["drawings_required", "drawings_desc", "drawings_done"] },
  { title: "Notes", keys: ["notes"] },
];

export const colByKey = (k: keyof Part): Col | undefined =>
  COLUMNS.find((c) => c.key === k);
