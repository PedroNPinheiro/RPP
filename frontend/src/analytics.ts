import { isCompleted } from "./logic";
import type { Part } from "./types";

export interface MonthAgg {
  key: string; // "2026-07"
  year: number;
  month: number; // 1-12
  openValue: number;
  completedValue: number;
  openLines: number;
  completedLines: number;
}

export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Aggregate PO lines by po_date month; months without data are filled in
 *  so the time axis is continuous. */
export function aggregateByMonth(parts: Part[]): MonthAgg[] {
  const map = new Map<string, MonthAgg>();
  for (const p of parts) {
    if (!p.po_date) continue;
    const d = new Date(p.po_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        key,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        openValue: 0,
        completedValue: 0,
        openLines: 0,
        completedLines: 0,
      };
      map.set(key, agg);
    }
    const value = Number(p.line_value) || 0;
    if (isCompleted(p)) {
      agg.completedValue += value;
      agg.completedLines += 1;
    } else {
      agg.openValue += value;
      agg.openLines += 1;
    }
  }
  const aggs = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  if (aggs.length < 2) return aggs;

  // fill gaps for a continuous axis
  const filled: MonthAgg[] = [];
  let y = aggs[0].year;
  let m = aggs[0].month;
  const last = aggs[aggs.length - 1];
  let i = 0;
  while (y < last.year || (y === last.year && m <= last.month)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (i < aggs.length && aggs[i].key === key) {
      filled.push(aggs[i]);
      i += 1;
    } else {
      filled.push({
        key, year: y, month: m,
        openValue: 0, completedValue: 0, openLines: 0, completedLines: 0,
      });
    }
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return filled;
}

export function years(aggs: MonthAgg[]): number[] {
  return [...new Set(aggs.map((a) => a.year))].sort();
}

export function fmtEUR(n: number, compact = false): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
}
