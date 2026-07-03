import { useCallback, useEffect, useState } from "react";
import { getAudit } from "../api";
import { colByKey, DETAIL_GROUPS, FIELD_LABELS, type Col } from "../columns";
import { fmtDate, fmtDateTime } from "../format";
import { isCompleted } from "../logic";
import type { AuditEntry, Part } from "../types";

/* ---- one labeled form field ---- */
function Field({
  part,
  col,
  onPatch,
}: {
  part: Part;
  col: Col;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
}) {
  const value = part[col.key];
  const commit = (next: unknown) => {
    if (next !== (value ?? null)) {
      onPatch(part.id, { [col.key]: next } as Partial<Part>);
    }
  };

  if (col.type === "bool") {
    return (
      <label className="f-check">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onPatch(part.id, { [col.key]: e.target.checked } as Partial<Part>)}
        />
        {col.label}
      </label>
    );
  }

  if (col.type === "select") {
    return (
      <div className="f-field">
        <label className="f-label">{col.label}</label>
        <select
          className="f-input"
          value={(value ?? "") as string}
          onChange={(e) => commit(e.target.value === "" ? null : e.target.value)}
        >
          <option value=""> </option>
          {col.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {value && !col.options?.includes(String(value)) && (
            <option value={String(value)}>{String(value)}</option>
          )}
        </select>
      </div>
    );
  }

  if (col.key === "notes") {
    return (
      <div className="f-field f-wide">
        <label className="f-label">{col.label}</label>
        <textarea
          className="f-input f-textarea"
          rows={3}
          defaultValue={(value ?? "") as string}
          onBlur={(e) => commit(e.target.value === "" ? null : e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="f-field">
      <label className="f-label">{col.label}</label>
      <input
        className="f-input"
        type={col.type === "date" ? "date" : "text"}
        defaultValue={(value ?? "") as string}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onBlur={(e) => commit(e.target.value === "" ? null : e.target.value)}
      />
    </div>
  );
}

/* audit stores strings; convert back to the field's real type for a PATCH */
function coerce(field: string, raw: string | null): unknown {
  if (raw === null) return null;
  const col = colByKey(field as keyof Part);
  if (col?.type === "bool") return raw === "True" || raw === "true";
  return raw;
}

function DelayChip({ part }: { part: Part }) {
  const received = Number(part.balance_qty) <= 0 && part.qty_ordered !== null;
  if (received) return <span className="chip ready">✓ received</span>;
  if (isCompleted(part)) return <span className="chip ready">✓ completed</span>;
  const d = part.delay_days;
  if (d !== null && d !== undefined && d > 0)
    return <span className="chip late">▲ {d}d late</span>;
  return <span className="chip neutral">on time</span>;
}

interface Props {
  part: Part;
  onClose: () => void;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
}

export function PartDetail({ part, onClose, onPatch }: Props) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAudit = useCallback(() => {
    getAudit(part.id).then(setEntries).catch(() => setEntries([]));
  }, [part.id]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit, part.updated_at]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const restore = async (e: AuditEntry) => {
    setBusy(true);
    try {
      await onPatch(part.id, { [e.field]: coerce(e.field, e.old_value) } as Partial<Part>);
    } finally {
      setBusy(false);
    }
  };

  const fmtQty = (v: unknown) =>
    v === null || v === undefined ? "—" : new Intl.NumberFormat().format(Number(v));

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <div className="drawer-title">
            <h3 title={part.item_desc ?? ""}>{part.item_desc || part.item_code}</h3>
            <div className="drawer-sub">
              {part.poh_num} · line {part.poh_line} ·{" "}
              <span className="code-inline">{part.item_code}</span>
            </div>
          </div>
          <div className="drawer-head-right">
            <DelayChip part={part} />
            <button className="btn icon-btn" onClick={onClose} title="Close (Esc)">
              ✕
            </button>
          </div>
        </div>

        <div className="drawer-body">
          {/* Sage facts — read-only */}
          <div className="facts">
            <div className="fact">
              <span className="f-label">Ordered</span>
              <span className="fact-v">{fmtQty(part.qty_ordered)}</span>
            </div>
            <div className="fact">
              <span className="f-label">Received</span>
              <span className="fact-v">{fmtQty(part.qty_received)}</span>
            </div>
            <div className="fact">
              <span className="f-label">Balance</span>
              <span className="fact-v">{fmtQty(part.balance_qty)}</span>
            </div>
            <div className="fact">
              <span className="f-label">Value</span>
              <span className="fact-v">
                {part.line_value
                  ? new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: part.currency || "EUR",
                    }).format(Number(part.line_value))
                  : "—"}
              </span>
            </div>
            <div className="fact">
              <span className="f-label">PO date</span>
              <span className="fact-v">{fmtDate(part.po_date) || "—"}</span>
            </div>
            <div className="fact">
              <span className="f-label">Expected</span>
              <span className="fact-v">{fmtDate(part.expected_receipt) || "—"}</span>
            </div>
            <div className="fact">
              <span className="f-label">Supplier</span>
              <span className="fact-v">{part.supplier_name || "—"}</span>
            </div>
            <div className="fact">
              <span className="f-label">Site</span>
              <span className="fact-v">{part.line_site || "—"}</span>
            </div>
          </div>

          {/* Team form */}
          {DETAIL_GROUPS.map((g) => (
            <section key={g.title} className="f-section">
              <h4>{g.title}</h4>
              <div className="f-grid">
                {g.keys.map((k) => {
                  const col = colByKey(k);
                  if (!col) return null;
                  return <Field key={String(k)} part={part} col={col} onPatch={onPatch} />;
                })}
              </div>
            </section>
          ))}

          {/* History */}
          <section className="f-section">
            <h4>Change history</h4>
            {!entries && <div className="loading">Loading…</div>}
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
          </section>
        </div>
      </aside>
    </>
  );
}
