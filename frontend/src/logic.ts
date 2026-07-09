import type { Part } from "./types";

export const STATUS_COMPLETE = "Completo";

/** A line is Completed only when the team sets status = "Completo".
 *  (Sage receipt / "Enviado" no longer auto-complete it.) */
export function isCompleted(p: Part): boolean {
  return p.status === STATUS_COMPLETE;
}

export function isDelayed(p: Part): boolean {
  return Number(p.delay_days) > 0 && !isCompleted(p);
}
