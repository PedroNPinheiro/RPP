import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentAudit } from "../api";
import { aggregateByMonth, fmtEUR, MONTH_SHORT } from "../analytics";
import { FIELD_LABELS } from "../columns";
import { ColumnChart, type ChartDatum } from "../components/ColumnChart";
import { fmtDateTime } from "../format";
import type { Part, RecentAuditEntry } from "../types";
import { isCompleted, isDelayed } from "../logic";
import { PageHeader } from "../components/PageHeader";
import { PartDetail } from "../components/PartDetail";
import { PartsTable } from "../components/PartsTable";
import { StatTiles } from "../components/StatTiles";
import { exportCsv } from "../csv";

type View = "open" | "delayed" | "completed" | "all";

interface Props {
  parts: Part[];
  loading: boolean;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
}

export function Dashboard({ parts, loading, onPatch }: Props) {
  const [view, setView] = useState<View>("open");
  const [search, setSearch] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [recent, setRecent] = useState<RecentAuditEntry[] | null>(null);

  useEffect(() => {
    getRecentAudit(6).then(setRecent).catch(() => setRecent([]));
  }, [parts]);

  const valueData: ChartDatum[] = useMemo(() => {
    const aggs = aggregateByMonth(parts);
    return aggs.map((a, i) => ({
      label: MONTH_SHORT[a.month - 1],
      sub: a.month === 1 || i === 0 ? String(a.year) : undefined,
      values: [a.openValue, a.completedValue],
    }));
  }, [parts]);

  // derive from the live list so drawer edits show immediately
  const selected = useMemo(
    () => parts.find((p) => p.id === selectedId) ?? null,
    [parts, selectedId],
  );

  const visible = useMemo(() => {
    let rows = parts;
    if (view === "open") rows = rows.filter((p) => !isCompleted(p));
    if (view === "delayed") rows = rows.filter(isDelayed);
    if (view === "completed") rows = rows.filter(isCompleted);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) =>
        [p.poh_num, p.item_code, p.item_desc, p.supplier_name, p.tracking, p.notes].some(
          (f) => f && f.toLowerCase().includes(q),
        ),
      );
    }
    return rows;
  }, [parts, view, search]);

  const counts = useMemo(
    () => ({
      open: parts.filter((p) => !isCompleted(p)).length,
      delayed: parts.filter(isDelayed).length,
      completed: parts.filter(isCompleted).length,
      all: parts.length,
    }),
    [parts],
  );

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={`${parts.length} line${parts.length === 1 ? "" : "s"} · live from Sage X3 · syncs every 15 min`}
      />

      <StatTiles parts={parts} onSelect={setView} />

      <div className="toolbar">
        <div className="seg">
          <button className={view === "open" ? "on" : ""} onClick={() => setView("open")}>
            Open <span className="count">{counts.open}</span>
          </button>
          <button className={view === "delayed" ? "on" : ""} onClick={() => setView("delayed")}>
            Delayed <span className="count">{counts.delayed}</span>
          </button>
          <button
            className={view === "completed" ? "on" : ""}
            onClick={() => setView("completed")}
          >
            Completed <span className="count">{counts.completed}</span>
          </button>
          <button className={view === "all" ? "on" : ""} onClick={() => setView("all")}>
            All <span className="count">{counts.all}</span>
          </button>
        </div>
        <div className="toolbar-right">
          <button
            className={`btn${grouped ? " btn-on" : ""}`}
            onClick={() => setGrouped((g) => !g)}
            title="Group lines under their purchase order"
          >
            Group by PO
          </button>
          <button
            className="btn"
            onClick={() => exportCsv(visible)}
            title="Download the current view as CSV (opens in Excel)"
          >
            ⬇ Export
          </button>
          <input
            className="search"
            type="search"
            placeholder="Search PO, code, item, supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <PartsTable
        parts={visible}
        totalCount={parts.length}
        grouped={grouped}
        selectedId={selectedId}
        onPatch={onPatch}
        onOpen={(p) => setSelectedId(p.id)}
      />

      <div className="dash-bottom">
        <ColumnChart
          title="Value by month"
          series={[
            { name: "Open", colorVar: "--series-1" },
            { name: "Completed", colorVar: "--series-2" },
          ]}
          data={valueData}
          format={(n) => fmtEUR(n, true)}
        />

        <div className="chart-card">
          <div className="chart-head">
            <h3>Recent activity</h3>
            <Link className="panel-link" to="/activity">
              View all ›
            </Link>
          </div>
          {!recent && <div className="loading">Loading…</div>}
          {recent && recent.length === 0 && (
            <div className="audit-empty">No changes yet.</div>
          )}
          {recent?.map((e, i) => (
            <div key={i} className="audit-row">
              <div className="audit-meta">
                <span className="audit-when">{fmtDateTime(e.changed_at)}</span>
                <span className="audit-who">{e.changed_by}</span>
                <span className="activity-ref">
                  {e.poh_num} · {e.item_desc ?? `line ${e.poh_line}`}
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

      {selected && (
        <PartDetail
          part={selected}
          onClose={() => setSelectedId(null)}
          onPatch={onPatch}
        />
      )}
    </>
  );
}
