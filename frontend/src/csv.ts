import { COLUMNS } from "./columns";
import type { Part } from "./types";

/* Excel-friendly CSV: UTF-8 BOM + semicolon delimiter (pt-PT Excel default). */

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(parts: Part[]) {
  const cols = COLUMNS.filter((c) => c.key !== "poh_num");
  const header = ["PO", "Line", ...cols.map((c) => c.label)];
  const rows = parts.map((p) => [
    p.poh_num,
    p.poh_line,
    ...cols.map((c) => p[c.key]),
  ]);

  const csv =
    "﻿" +
    [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `replacement-parts-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
