import { useEffect, useState } from "react";
import { getRecentAudit } from "../api";
import { FIELD_LABELS } from "../columns";
import { fmtDateTime } from "../format";
import type { RecentAuditEntry } from "../types";

export function Activity() {
  const [entries, setEntries] = useState<RecentAuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecentAudit(100)
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Activity</h2>
          <div className="page-sub">Recent changes made by the team, newest first</div>
        </div>
      </div>

      {error && <div className="error">⚠ {error}</div>}
      {!entries && !error && <div className="loading">Loading…</div>}

      {entries && (
        <div className="table-card">
          <div className="activity-list">
            {entries.length === 0 && (
              <div className="audit-empty">No changes recorded yet.</div>
            )}
            {entries.map((e, i) => (
              <div key={i} className="audit-row activity-row">
                <div className="audit-meta">
                  <span className="audit-when">{fmtDateTime(e.changed_at)}</span>
                  <span className="audit-who">{e.changed_by}</span>
                  <span className="activity-ref">
                    {e.poh_num} · line {e.poh_line}
                    {e.item_desc ? ` · ${e.item_desc}` : ""}
                  </span>
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
      )}
    </>
  );
}
