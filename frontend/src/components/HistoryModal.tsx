import { useEffect, useState } from "react";
import { getAudit } from "../api";
import { COLUMNS } from "../columns";
import type { AuditEntry, Part } from "../types";

const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  COLUMNS.map((c) => [String(c.key), c.label]),
);

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

interface Props {
  part: Part;
  onClose: () => void;
}

export function HistoryModal({ part, onClose }: Props) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAudit(part.id)
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [part.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Change history</h3>
            <div className="modal-sub">
              {part.poh_num} · line {part.poh_line} · {part.item_desc}
            </div>
          </div>
          <button className="btn icon-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error">⚠ {error}</div>}
          {!entries && !error && <div className="loading">Loading…</div>}
          {entries && entries.length === 0 && (
            <div className="audit-empty">No changes recorded yet.</div>
          )}
          {entries?.map((e, i) => (
            <div key={i} className="audit-row">
              <div className="audit-meta">
                <span className="audit-when">{fmtWhen(e.changed_at)}</span>
                <span className="audit-who">{e.changed_by}</span>
              </div>
              <div className="audit-change">
                <span className="audit-field">{FIELD_LABELS[e.field] ?? e.field}</span>
                <span className="audit-old">{e.old_value ?? "—"}</span>
                <span className="audit-arrow">→</span>
                <span className="audit-new">{e.new_value ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
