import type { Part } from "./types";

export const NONE_BUCKET = "(sem estado)";

/* Status/priority colors match the app's status dots so the whole product
   speaks one visual language. Every chart also carries a legend + table,
   which satisfies the colorblind relief rule for the green/red pair. */
export const STATUS_ORDER = [
  "Por Iniciar",
  "Em Andamento",
  "Pronto para Sair",
  "Enviado/Já Saiu",
  "Problema/Falta de Informação",
];
export const STATUS_COLORS: Record<string, string> = {
  "Por Iniciar": "#64748b",
  "Em Andamento": "#2a78d6",
  "Pronto para Sair": "#eda100",
  "Enviado/Já Saiu": "#0ca30c",
  "Problema/Falta de Informação": "#d03b3b",
  // legacy values still color correctly
  "Por começar": "#64748b",
  "Em progresso": "#2a78d6",
  Pendente: "#eda100",
  Completo: "#0ca30c",
};

export const PRIORITY_ORDER = ["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"];
export const PRIORITY_COLORS: Record<string, string> = {
  "P1 - Critical": "#d03b3b",
  "P2 - High": "#eda100",
  "P3 - Medium": "#2a78d6",
  "P4 - Low": "#64748b",
};

const OTHER_COLOR = "#8a94a6";
export type Dim = "status" | "priority";

export function colorFor(dim: Dim, bucket: string): string {
  const map = dim === "status" ? STATUS_COLORS : PRIORITY_COLORS;
  return map[bucket] ?? OTHER_COLOR;
}

function orderBuckets(dim: Dim, present: string[]): string[] {
  const canonical = dim === "status" ? STATUS_ORDER : PRIORITY_ORDER;
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
export interface SnapshotRow {
  snap_date: string;
  dimension: Dim;
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

export function pivotSnapshots(
  rows: SnapshotRow[],
  dim: Dim,
): { dates: string[]; series: LineSeries[] } {
  const filt = rows.filter((r) => r.dimension === dim);
  const dates = [...new Set(filt.map((r) => r.snap_date))].sort();
  const lookup = new Map(filt.map((r) => [`${r.snap_date}|${r.bucket}`, r.count]));
  const buckets = orderBuckets(dim, [...new Set(filt.map((r) => r.bucket))]);
  const series = buckets.map((b) => ({
    name: b,
    color: colorFor(dim, b),
    values: dates.map((d) => lookup.get(`${d}|${b}`) ?? 0),
  }));
  return { dates, series };
}
