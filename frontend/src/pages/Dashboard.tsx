import { useMemo, useState } from "react";
import { useApp } from "../AppCtx";
import { CATEGORY_OPTIONS, COLUMNS } from "../columns";
import type { Part } from "../types";
import { isCancelled, isClosed, isCompleted, isDelayed } from "../logic";
import { PageHeader } from "../components/PageHeader";
import { PartDetail } from "../components/PartDetail";
import { PartsTable, type GroupOrder } from "../components/PartsTable";
import { DashboardSkeleton } from "../components/Skeleton";
import { StatTiles } from "../components/StatTiles";
import { exportCsv } from "../csv";

type View = "open" | "delayed" | "completed" | "cancelled" | "all";

interface Props {
  parts: Part[];
  loading: boolean;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
  onBulkPatch: (ids: number[], fields: Partial<Part>) => Promise<void>;
}

/* fields offered in the bulk bar: every editable team column except
   booleans (no clear tri-state) */
const BULK_COLS = COLUMNS.filter((c) => c.editable && c.type !== "bool");

export function Dashboard({ parts, loading, onPatch, onBulkPatch }: Props) {
  const { canEdit } = useApp();
  const [view, setView] = useState<View>("open");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [groupOrder, setGroupOrder] = useState<GroupOrder>("po");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [bulkField, setBulkField] = useState<keyof Part>("shipping_method");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleChecked = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const checkMany = (ids: number[], on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const bulkCol = BULK_COLS.find((c) => c.key === bulkField)!;
  const applyBulk = async () => {
    setBulkBusy(true);
    try {
      await onBulkPatch([...checked], { [bulkField]: bulkValue || null } as Partial<Part>);
      setChecked(new Set());
      setBulkValue("");
    } catch {
      /* error surfaced by App; keep selection so the user can retry */
    } finally {
      setBulkBusy(false);
    }
  };

  // derive from the live list so drawer edits show immediately
  const selected = useMemo(
    () => parts.find((p) => p.id === selectedId) ?? null,
    [parts, selectedId],
  );

  const visible = useMemo(() => {
    let rows = parts;
    if (view === "open") rows = rows.filter((p) => !isClosed(p));
    if (view === "delayed") rows = rows.filter(isDelayed);
    if (view === "completed") rows = rows.filter(isCompleted);
    if (view === "cancelled") rows = rows.filter(isCancelled);
    if (category) rows = rows.filter((p) => (p.category || "") === category);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) =>
        [p.poh_num, p.item_code, p.item_desc, p.supplier_name, p.tracking, p.notes].some(
          (f) => f && f.toLowerCase().includes(q),
        ),
      );
    }
    return rows;
  }, [parts, view, search, category]);

  const counts = useMemo(
    () => ({
      open: parts.filter((p) => !isClosed(p)).length,
      delayed: parts.filter(isDelayed).length,
      completed: parts.filter(isCompleted).length,
      cancelled: parts.filter(isCancelled).length,
      all: parts.length,
    }),
    [parts],
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={`${parts.length} line${parts.length === 1 ? "" : "s"} · live from Sage X3 · syncs every 15 min`}
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
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
          <button
            className={view === "cancelled" ? "on" : ""}
            onClick={() => setView("cancelled")}
          >
            Cancelled <span className="count">{counts.cancelled}</span>
          </button>
          <button className={view === "all" ? "on" : ""} onClick={() => setView("all")}>
            All <span className="count">{counts.all}</span>
          </button>
        </div>
        <div className="toolbar-right">
          <select
            className="filter-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            title="Filter by category"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            className={`btn${grouped ? " btn-on" : ""}`}
            onClick={() => setGrouped((g) => !g)}
            title="Group lines under their purchase order"
          >
            Group by PO
          </button>
          {grouped && (
            <select
              className="filter-select"
              value={groupOrder}
              onChange={(e) => setGroupOrder(e.target.value as GroupOrder)}
              title="Order of the PO groups"
            >
              <option value="po">Order · PO №</option>
              <option value="date_desc">Order · newest PO</option>
              <option value="date_asc">Order · oldest PO</option>
            </select>
          )}
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
        groupOrder={groupOrder}
        selectedId={selectedId}
        onPatch={onPatch}
        onOpen={(p) => setSelectedId(p.id)}
        checkedIds={checked}
        onToggleCheck={toggleChecked}
        onCheckMany={checkMany}
      />

      {canEdit && checked.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{checked.size} selected</span>
          <select
            className="filter-select"
            value={String(bulkField)}
            onChange={(e) => {
              setBulkField(e.target.value as keyof Part);
              setBulkValue("");
            }}
          >
            {BULK_COLS.map((c) => (
              <option key={String(c.key)} value={String(c.key)}>{c.label}</option>
            ))}
          </select>
          {bulkCol.type === "select" ? (
            <select
              className="filter-select"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
            >
              <option value="">— clear —</option>
              {bulkCol.options?.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              className="filter-select"
              type={bulkCol.type === "date" ? "date" : "text"}
              value={bulkValue}
              placeholder="value (empty clears)"
              onChange={(e) => setBulkValue(e.target.value)}
            />
          )}
          <button className="btn" disabled={bulkBusy} onClick={applyBulk}>
            {bulkBusy ? "Applying…" : `Apply to ${checked.size}`}
          </button>
          <button className="btn" onClick={() => setChecked(new Set())} title="Clear selection">
            ✕
          </button>
        </div>
      )}
        </>
      )}

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
