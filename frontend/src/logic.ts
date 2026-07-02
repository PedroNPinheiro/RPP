import type { Part } from "./types";

export const STATUS_COMPLETE = "Completo";

/** Completed = team marked it Completo, or Sage shows it fully received. */
export function isCompleted(p: Part): boolean {
  if (p.status === STATUS_COMPLETE) return true;
  return p.qty_ordered !== null && Number(p.balance_qty) <= 0;
}

export function isDelayed(p: Part): boolean {
  return Number(p.delay_days) > 0 && !isCompleted(p);
}
