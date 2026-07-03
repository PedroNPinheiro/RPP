import type { Part } from "./types";

/** Statuses that mean "done" (legacy Completo kept for old rows). */
export const COMPLETE_STATUSES = new Set(["Enviado/Já Saiu", "Completo"]);

/** Completed = team marked it shipped/done, or Sage shows it fully received. */
export function isCompleted(p: Part): boolean {
  if (p.status && COMPLETE_STATUSES.has(p.status)) return true;
  return p.qty_ordered !== null && Number(p.balance_qty) <= 0;
}

export function isDelayed(p: Part): boolean {
  return Number(p.delay_days) > 0 && !isCompleted(p);
}
