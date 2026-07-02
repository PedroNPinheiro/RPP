import { useMemo, useState } from "react";
import type { Part } from "../types";
import { isCompleted, isDelayed } from "../logic";
import { PartsTable } from "../components/PartsTable";
import { StatTiles } from "../components/StatTiles";

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
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <div className="page-sub">
            {parts.length} line{parts.length === 1 ? "" : "s"} · live from Sage X3 · syncs
            every 15 min
          </div>
        </div>
      </div>

      <StatTiles parts={parts} />

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
          <input
            className="search"
            type="search"
            placeholder="Search PO, code, item, supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <PartsTable parts={visible} totalCount={parts.length} grouped={grouped} onPatch={onPatch} />
    </>
  );
}
