import type { Part } from "./types";

/* must match NONE_BUCKET in backend/app/routers/analytics.py so live
   charts and snapshot history land in the same bucket */
export const NONE_BUCKET = "(no status)";

/* Status/priority colors match the app's status dots so the whole product
   speaks one visual language. Every chart also carries a legend + table,
   which satisfies the colorblind relief rule for the green/red pair. */
export const STATUS_ORDER = [
  "Por Iniciar",
  "Em Andamento",
  "Pronto para Sair",
  "Enviado/Já Saiu", // retired option; old lines/snapshots may still hold it
  "Problema/Falta de Informação",
  "Cancelado",
  "Completo",
];
export const STATUS_COLORS: Record<string, string> = {
  "Por Iniciar": "#64748b",
  "Em Andamento": "#eda100",
  "Pronto para Sair": "#0ca30c",
  "Enviado/Já Saiu": "#2a78d6", // retired; styled blue in-app like Completo
  "Problema/Falta de Informação": "#d03b3b",
  "Cancelado": "#475569",
  "Completo": "#2a78d6",
};

export const PRIORITY_ORDER = ["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"];
export const PRIORITY_COLORS: Record<string, string> = {
  "P1 - Critical": "#d03b3b",
  "P2 - High": "#eda100",
  "P3 - Medium": "#2a78d6",
  "P4 - Low": "#64748b",
};

/* How late a line is. Escalating warning -> serious -> critical, so the chart
   reads as severity at a glance (buckets must match SNAPSHOT_DELAY in
   backend/app/routers/analytics.py). */
export const DELAY_ORDER = ["1-7 days", "8-30 days", "31+ days"];
export const DELAY_COLORS: Record<string, string> = {
  "1-7 days": "#eda100",
  "8-30 days": "#eb6834",
  "31+ days": "#d03b3b",
};

/* Drawings progress among lines that require a drawing: pending (amber, needs
   engineering) vs concluded (green). Buckets must match SNAPSHOT_DRAWINGS in
   backend/app/routers/analytics.py. */
export const DRAWINGS_ORDER = ["Pending", "Concluded"];
export const DRAWINGS_COLORS: Record<string, string> = {
  Pending: "#eda100",
  Concluded: "#0ca30c",
};

const OTHER_COLOR = "#8a94a6";
export type Dim = "status" | "priority" | "delay" | "drawings";

const DIM_COLORS: Record<Dim, Record<string, string>> = {
  status: STATUS_COLORS,
  priority: PRIORITY_COLORS,
  delay: DELAY_COLORS,
  drawings: DRAWINGS_COLORS,
};
const DIM_ORDER: Record<Dim, string[]> = {
  status: STATUS_ORDER,
  priority: PRIORITY_ORDER,
  delay: DELAY_ORDER,
  drawings: DRAWINGS_ORDER,
};

export function colorFor(dim: Dim, bucket: string): string {
  return DIM_COLORS[dim][bucket] ?? OTHER_COLOR;
}

function orderBuckets(dim: Dim, present: string[]): string[] {
  const canonical = DIM_ORDER[dim];
  const known = canonical.filter((b) => present.includes(b));
  const extras = present.filter((b) => !canonical.includes(b)).sort();
  return [...known, ...extras];
}

export interface Bar {
  label: string;
  value: number;
  color: string;
}

/* current distribution — for the summary bar charts */
export function summaryByField(parts: Part[], dim: Dim): Bar[] {
  const field = dim === "status" ? "status" : "priority";
  const counts = new Map<string, number>();
  for (const p of parts) {
    const v = (p[field] as string | null) || NONE_BUCKET;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return orderBuckets(dim, [...counts.keys()]).map((b) => ({
    label: b,
    value: counts.get(b) ?? 0,
    color: colorFor(dim, b),
  }));
}

/* ---- historical snapshots ---- */
export type SnapScope = "all" | "open";
export interface SnapshotRow {
  snap_date: string;
  dimension: Dim;
  scope: SnapScope;
  bucket: string;
  count: number;
}
export interface SnapshotResponse {
  today: string;
  rows: SnapshotRow[];
}
export interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

/* ---- interactive explorer: group any dimension, measure count or value ---- */
export type DimKey =
  | "status"
  | "priority"
  | "category"
  | "area"
  | "dest_type"
  | "supplier_name"
  | "shipping_method"
  | "line_site";

export const DIMENSIONS: { key: DimKey; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "category", label: "Category" },
  { key: "area", label: "Área" },
  { key: "dest_type", label: "Dest Type" },
  { key: "supplier_name", label: "Supplier" },
  { key: "shipping_method", label: "Shipping" },
  { key: "line_site", label: "Site" },
];

export type Measure = "count" | "value";

// categorical palette for dimensions that aren't status/priority
const CAT_PALETTE = [
  "#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7",
  "#e34948", "#e87ba4", "#eb6834",
];

function dimColor(dim: DimKey, bucket: string, index: number): string {
  if (dim === "status") return STATUS_COLORS[bucket] ?? OTHER_COLOR;
  if (dim === "priority") return PRIORITY_COLORS[bucket] ?? OTHER_COLOR;
  return CAT_PALETTE[index % CAT_PALETTE.length];
}

export function distinctValues(parts: Part[], key: DimKey): string[] {
  return [...new Set(parts.map((p) => (p[key] as string | null) || "").filter(Boolean))].sort();
}

export interface Breakdown {
  label: string;
  color: string;
  count: number;
  value: number;
}

/* per-bucket count AND value (the bar chart shows one; the table shows both) */
export function breakdown(parts: Part[], dim: DimKey): Breakdown[] {
  const counts = new Map<string, number>();
  const values = new Map<string, number>();
  for (const p of parts) {
    const key = (p[dim] as string | null) || NONE_BUCKET;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    values.set(key, (values.get(key) ?? 0) + (Number(p.line_value) || 0));
  }
  const order =
    dim === "status" || dim === "priority"
      ? orderBuckets(dim, [...counts.keys()])
      : [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return order.map((label, i) => ({
    label,
    color: dimColor(dim, label, i),
    count: counts.get(label) ?? 0,
    value: values.get(label) ?? 0,
  }));
}

export function summarize(parts: Part[], dim: DimKey, measure: Measure): Bar[] {
  const totals = new Map<string, number>();
  for (const p of parts) {
    const key = (p[dim] as string | null) || NONE_BUCKET;
    const add = measure === "value" ? Number(p.line_value) || 0 : 1;
    totals.set(key, (totals.get(key) ?? 0) + add);
  }
  let ordered: string[];
  if (dim === "status" || dim === "priority") {
    ordered = orderBuckets(dim, [...totals.keys()]);
  } else {
    ordered = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }
  return ordered.map((label, i) => ({
    label,
    value: totals.get(label) ?? 0,
    color: dimColor(dim, label, i),
  }));
}

export function pivotSnapshots(
  rows: SnapshotRow[],
  dim: Dim,
  scope: SnapScope = "all",
): { dates: string[]; series: LineSeries[] } {
  const filt = rows.filter((r) => r.dimension === dim && r.scope === scope);
  // date axis spans every snapshot day in scope, not just the days this
  // dimension has rows for — so "zero delayed today" plots as 0 rather than
  // silently dropping the day
  const dates = [
    ...new Set(rows.filter((r) => r.scope === scope).map((r) => r.snap_date)),
  ].sort();
  const lookup = new Map(filt.map((r) => [`${r.snap_date}|${r.bucket}`, r.count]));
  const buckets = orderBuckets(dim, [...new Set(filt.map((r) => r.bucket))]);
  const series = buckets.map((b) => ({
    name: b,
    color: colorFor(dim, b),
    values: dates.map((d) => lookup.get(`${d}|${b}`) ?? 0),
  }));
  return { dates, series };
}
