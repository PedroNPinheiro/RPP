import type { Part } from "./types";

export const STATUS_COMPLETE = "Completo";
export const STATUS_CANCELLED = "Cancelado";

/** A line is Completed only when the team sets status = "Completo".
 *  (Sage receipt / "Enviado" no longer auto-complete it.) */
export function isCompleted(p: Part): boolean {
  return p.status === STATUS_COMPLETE;
}

export function isCancelled(p: Part): boolean {
  return p.status === STATUS_CANCELLED;
}

/** Closed = off the team's plate: completed or cancelled. "Open" everywhere
 *  means not closed. */
export function isClosed(p: Part): boolean {
  return isCompleted(p) || isCancelled(p);
}

export function isDelayed(p: Part): boolean {
  return Number(p.delay_days) > 0 && !isClosed(p);
}
