import { useMemo, useState, type ReactNode } from "react";
import { TABLE_COLUMNS, type Col } from "../columns";
import { fmtDate } from "../format";
import { isCompleted } from "../logic";
import type { Part } from "../types";
import { EditableCell } from "./EditableCell";

/* row background wash by status (like the source sheet) */
const STATUS_ROW: Record<string, string> = {
  "Em Andamento": "row-prog",                 // yellow
  "Problema/Falta de Informação": "row-crit", // red
  "Enviado/Já Saiu": "row-done",              // blue
  Completo: "row-comp",                       // green
  // legacy value
  "Em progresso": "row-prog",
};

/* when grouped, PO-level facts live in the group header, not on every line */
const GROUP_HIDDEN = new Set<string>(["supplier_name", "po_date"]);

/* ---- formatting ---- */
function fmtNumber(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v).trim();
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function fmtCurrency(v: unknown, currency: string | null): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

function displayValue(part: Part, col: Col): string {
  const v = part[col.key];
  if (v === null || v === undefined) return "";
  if (col.type === "number") return fmtNumber(v);
  if (col.type === "date") return fmtDate(v);
  return String(v).trim();
}

/* per-line state: quiet colored text, icon + label (never color alone).
   Green ✓ is reserved for the team-closed state (Completo). "received" is a
   neutral Sage-delivery note — the line is still Open until marked Completo. */
function DelayCell({ part }: { part: Part }) {
  if (isCompleted(part)) return <span className="dstat ok">✓ done</span>;
  const received = Number(part.balance_qty) <= 0 && part.qty_ordered !== null;
  if (received) return <span className="dstat quiet">received</span>;
  const d = part.delay_days;
  if (d === null || d === undefined) return null;
  if (d > 0) return <span className="dstat late">▲ {d}d late</span>;
  return <span className="dstat quiet">on time</span>;
}

/* PO-level state: one pill per group header */
function GroupChip({ lines }: { lines: Part[] }) {
  if (lines.every(isCompleted)) return <span className="chip ready">✓ completed</span>;
  const worst = Math.max(
    ...lines.filter((l) => !isCompleted(l)).map((l) => Number(l.delay_days) || 0),
  );
  if (worst > 0) return <span className="chip late">▲ {worst}d late</span>;
  return <span className="chip neutral">on time</span>;
}

function FragmentRows({ header, lines }: { header: ReactNode; lines: ReactNode[] }) {
  return (
    <>
      {header}
      {lines}
    </>
  );
}

/* one PO line row — clicking it opens the detail drawer */
function renderLine(
  p: Part,
  cols: Col[],
  inGroup: boolean,
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>,
  onOpen: (p: Part) => void,
  selected: boolean,
) {
  return (
    <tr
      key={p.id}
      className={`line-row${selected ? " selected" : ""}${
        p.status && STATUS_ROW[p.status] ? ` ${STATUS_ROW[p.status]}` : ""
      }`}
      onClick={() => onOpen(p)}
    >
      {cols.map((c) => {
        if (c.key === "poh_num") {
          return (
            <td key="poh_num" className={inGroup ? "line-cell" : "po-cell"}>
              {inGroup ? (
                <span className="line-tag">line {p.poh_line}</span>
              ) : (
                <>
                  {p.poh_num}
                  <span className="line-tag">·{p.poh_line}</span>
                </>
              )}
            </td>
          );
        }
        if (c.key === "line_value") {
          return (
            <td key="line_value" className="num">
              {fmtCurrency(p.line_value, p.currency)}
            </td>
          );
        }
        if (c.key === "qty_received") {
          const zero = !Number(p.qty_received);
          return (
            <td key="qty_received" className={`num${zero ? " num-muted" : ""}`}>
              {fmtNumber(p.qty_received)}
            </td>
          );
        }
        if (c.key === "balance_qty") {
          const open = Number(p.balance_qty) > 0;
          return (
            <td key="balance_qty" className={`num ${open ? "num-strong" : "num-muted"}`}>
              {fmtNumber(p.balance_qty)}
            </td>
          );
        }
        if (c.key === "delay_days") {
          return (
            <td key="delay_days" className="num">
              <DelayCell part={p} />
            </td>
          );
        }
        if (c.editable) {
          // inline quick-edit; don't let the click bubble into the drawer
          return (
            <td key={String(c.key)} className="team" onClick={(e) => e.stopPropagation()}>
              <EditableCell part={p} col={c} onPatch={onPatch} />
            </td>
          );
        }
        const text = displayValue(p, c);
        if (c.key === "item_code") {
          return (
            <td key="item_code" className="code-cell">
              {text}
            </td>
          );
        }
        if (c.type === "date") {
          return (
            <td key={String(c.key)} className="date-cell">
              {text}
            </td>
          );
        }
        if (c.ellipsis) {
          return (
            <td key={String(c.key)} className="ellipsis" title={text}>
              {text}
            </td>
          );
        }
        return (
          <td key={String(c.key)} className={c.type === "number" ? "num" : ""}>
            {text}
          </td>
        );
      })}
      <td className="open-cell">
        {Number(p.attachment_count) > 0 && (
          <span className="att-count" title={`${p.attachment_count} attachment(s)`}>
            ⎘{p.attachment_count}
          </span>
        )}
        ›
      </td>
    </tr>
  );
}

type SortDir = "asc" | "desc";

interface Props {
  parts: Part[];
  totalCount: number;
  grouped: boolean;
  selectedId: number | null;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
  onOpen: (p: Part) => void;
}

export function PartsTable({ parts, totalCount, grouped, selectedId, onPatch, onOpen }: Props) {
  const [sortKey, setSortKey] = useState<keyof Part>("poh_num");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const cols = useMemo(
    () =>
      grouped
        ? TABLE_COLUMNS.filter((c) => !GROUP_HIDDEN.has(String(c.key)))
        : TABLE_COLUMNS,
    [grouped],
  );

  const toggleGroup = (po: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(po)) next.delete(po);
      else next.add(po);
      return next;
    });

  const sorted = useMemo(() => {
    const col = TABLE_COLUMNS.find((c) => c.key === sortKey);
    const numeric = col?.type === "number";
    return [...parts].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined || av === "") return 1;
      if (bv === null || bv === undefined || bv === "") return -1;
      let cmp = numeric ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      if (cmp === 0) {
        cmp = a.poh_num.localeCompare(b.poh_num) || a.poh_line - b.poh_line;
        return cmp;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [parts, sortKey, sortDir]);

  const toggleSort = (key: keyof Part) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /* group the (already filtered+sorted) lines by PO, preserving line order */
  const groups = useMemo(() => {
    const m = new Map<string, Part[]>();
    for (const p of sorted) {
      const g = m.get(p.poh_num);
      if (g) g.push(p);
      else m.set(p.poh_num, [p]);
    }
    const keys = [...m.keys()].sort((a, b) => a.localeCompare(b));
    if (sortKey === "poh_num" && sortDir === "desc") keys.reverse();
    return keys.map((k) => ({ po: k, lines: m.get(k)! }));
  }, [sorted, sortKey, sortDir]);

  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr className="head-row">
              {cols.map((c) => (
                <th
                  key={String(c.key)}
                  className={[
                    c.type === "number" ? "num" : "",
                    c.editable ? "th-team" : "",
                    c.ellipsis ? "th-flex" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleSort(c.key)}
                  title="Click to sort"
                >
                  {c.label}
                  {sortKey === c.key && (
                    <span className="sort-arrow">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
              <th className="open-th" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {grouped
              ? groups.map(({ po, lines }) => {
                  const first = lines[0];
                  const total = lines.reduce((s, l) => s + (Number(l.line_value) || 0), 0);
                  const isOpen = !collapsed.has(po);
                  return (
                    <FragmentRows
                      key={po}
                      header={
                        <tr className="po-header" onClick={() => toggleGroup(po)}>
                          <td colSpan={cols.length + 1}>
                            <div className="po-header-content">
                              <span className="po-chevron">{isOpen ? "▾" : "▸"}</span>
                              <strong>{po}</strong>
                              <span className="po-meta">{first.supplier_name}</span>
                              <span className="po-sep">·</span>
                              <span className="po-meta">{fmtDate(first.po_date)}</span>
                              <span className="po-sep">·</span>
                              <span className="po-meta">
                                {lines.length} line{lines.length === 1 ? "" : "s"} ·{" "}
                                {fmtCurrency(total, first.currency)}
                              </span>
                              <GroupChip lines={lines} />
                            </div>
                          </td>
                        </tr>
                      }
                      lines={
                        isOpen
                          ? lines.map((p) =>
                              renderLine(p, cols, true, onPatch, onOpen, p.id === selectedId),
                            )
                          : []
                      }
                    />
                  );
                })
              : sorted.map((p) =>
                  renderLine(p, cols, false, onPatch, onOpen, p.id === selectedId),
                )}
            {parts.length === 0 && (
              <tr>
                <td colSpan={cols.length + 1} className="empty">
                  {totalCount === 0
                    ? "No replacement-parts POs yet. Tick the checkbox on a PO in Sage."
                    : "Nothing matches the current filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>
          Showing {parts.length} of {totalCount} line{totalCount === 1 ? "" : "s"}
        </span>
        <span>Click a line to open its details</span>
      </div>
    </div>
  );
}
