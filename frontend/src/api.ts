import type { Attachment, AuditEntry, Part, RecentAuditEntry, SyncStatus } from "./types";

const BASE = "/api";

export async function getParts(): Promise<Part[]> {
  const r = await fetch(`${BASE}/parts`);
  if (!r.ok) throw new Error(`Failed to load parts (${r.status})`);
  return r.json();
}

export async function patchPart(id: number, fields: Partial<Part>): Promise<Part> {
  const r = await fetch(`${BASE}/parts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!r.ok) throw new Error(`Failed to save (${r.status})`);
  return r.json();
}

export async function getSyncStatus(): Promise<SyncStatus | null> {
  const r = await fetch(`${BASE}/sync-status`);
  if (!r.ok) return null;
  return r.json();
}

export async function getRecentAudit(limit = 50): Promise<RecentAuditEntry[]> {
  const r = await fetch(`${BASE}/audit/recent?limit=${limit}`);
  if (!r.ok) throw new Error(`Failed to load activity (${r.status})`);
  return r.json();
}

export async function getAudit(partId: number): Promise<AuditEntry[]> {
  const r = await fetch(`${BASE}/parts/${partId}/audit`);
  if (!r.ok) throw new Error(`Failed to load history (${r.status})`);
  return r.json();
}

export async function getAttachments(partId: number): Promise<Attachment[]> {
  const r = await fetch(`${BASE}/parts/${partId}/attachments`);
  if (!r.ok) throw new Error(`Failed to load attachments (${r.status})`);
  return r.json();
}

export async function uploadAttachment(partId: number, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`${BASE}/parts/${partId}/attachments`, {
    method: "POST",
    body: form,
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => null);
    throw new Error(detail?.detail ?? `Upload failed (${r.status})`);
  }
  return r.json();
}

export async function deleteAttachment(id: number): Promise<void> {
  const r = await fetch(`${BASE}/attachments/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`Delete failed (${r.status})`);
}

export const attachmentUrl = (id: number, download = false) =>
  `${BASE}/attachments/${id}/download${download ? "?download=1" : ""}`;
