import { useCallback, useEffect, useState } from "react";
import { getAudit } from "../api";
import { COLUMNS, FIELD_LABELS } from "../columns";
import { fmtDateTime } from "../format";
import type { AuditEntry, Part } from "../types";

/* audit stores strings; convert back to the field's real type for a PATCH */
function coerce(field: string, raw: string | null): unknown {
  if (raw === null) return null;
  const col = COLUMNS.find((c) => String(c.key) === field);
  if (col?.type === "bool") return raw === "True" || raw === "true";
  return raw;
}

interface Props {
  part: Part;
  onClose: () => void;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
}

export function HistoryModal({ part, onClose, onPatch }: Props) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadEntries = useCallback(() => {
    getAudit(part.id)
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [part.id]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const restore = async (e: AuditEntry) => {
    setBusy(true);
    try {
      await onPatch(part.id, { [e.field]: coerce(e.field, e.old_value) } as Partial<Part>);
      loadEntries(); // the restore itself becomes a new audit entry
    } finally {
      setBusy(false);
    }
  };

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
                <span className="audit-when">{fmtDateTime(e.changed_at)}</span>
                <span className="audit-who">{e.changed_by}</span>
                <button
                  className="audit-restore"
                  disabled={busy}
                  title={`Set ${FIELD_LABELS[e.field] ?? e.field} back to "${e.old_value ?? "—"}"`}
                  onClick={() => restore(e)}
                >
                  ↩ restore
                </button>
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
