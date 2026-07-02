import { useCallback, useEffect, useMemo, useState } from "react";
import { getParts, getSyncStatus, patchPart } from "./api";
import type { Part, SyncStatus } from "./types";
import { PartsTable } from "./components/PartsTable";
import { StatTiles } from "./components/StatTiles";
import { SyncBanner } from "./components/SyncBanner";

import { isCompleted, isDelayed } from "./logic";

type View = "open" | "delayed" | "completed" | "all";
type Theme = "light" | "dark";

function initialTheme(): Theme {
  const saved = localStorage.getItem("rpp-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [parts, setParts] = useState<Part[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("open");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [grouped, setGrouped] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("rpp-theme", theme);
  }, [theme]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [p, s] = await Promise.all([getParts(), getSyncStatus()]);
      setParts(p);
      setSync(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePatch = useCallback(async (id: number, fields: Partial<Part>) => {
    try {
      const updated = await patchPart(id, fields);
      setParts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const visible = useMemo(() => {
    let rows = parts;
    if (view === "open") rows = rows.filter((p) => !isCompleted(p));
    if (view === "delayed") rows = rows.filter(isDelayed);
    if (view === "completed") rows = rows.filter(isCompleted);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) =>
        [p.poh_num, p.item_code, p.item_desc, p.supplier_name, p.tracking, p.notes]
          .some((f) => f && f.toLowerCase().includes(q)),
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>Replacement Parts</h1>
          <div className="subtitle">Live from Sage X3 · syncs every 15 min</div>
        </div>
        <div className="header-actions">
          <button
            className="btn icon-btn"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <SyncBanner sync={sync} onRefresh={load} />
        </div>
      </header>

      {error && <div className="error">⚠ {error}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
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

          <PartsTable
            parts={visible}
            totalCount={parts.length}
            grouped={grouped}
            onPatch={handlePatch}
          />
        </>
      )}
    </div>
  );
}
