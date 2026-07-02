import { useMemo, useState, type ReactNode } from "react";
import { COLUMNS, type Col } from "../columns";
import { isCompleted } from "../logic";
import type { Part } from "../types";
import { EditableCell } from "./EditableCell";

interface Props {
  parts: Part[];
  totalCount: number;
  grouped: boolean;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
}

/* ---- column groups band (Sage / Computed / Team) ---- */
interface Band {
  label: string;
  span: number;
  cls: string;
}
function groupBands(): Band[] {
  const bands: Band[] = [];
  for (const c of COLUMNS) {
    const label =
      c.group === "sage" ? "Sage X3" : c.group === "computed" ? "Computed" : "Team input";
    const last = bands[bands.length - 1];
    if (last && last.label === label) last.span += 1;
    else bands.push({ label, span: 1, cls: c.group === "team" ? "gb-team" : "" });
  }
  return bands;
}

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
  return String(v).trim();
}

/* Delay as a status chip — icon + label, color never alone */
function DelayCell({ part }: { part: Part }) {
  const d = part.delay_days;
  const received = Number(part.balance_qty) <= 0 && part.qty_ordered !== null;
  if (received) return <span className="chip ready">✓ received</span>;
  if (isCompleted(part)) return <span className="chip ready">✓ completed</span>;
  if (d === null || d === undefined) return null;
  if (d > 0) return <span className="chip late">▲ {d}d late</span>;
  return <span className="chip neutral">on time</span>;
}

type SortDir = "asc" | "desc";

/* frozen columns: PO, Code, Item stay visible during horizontal scroll */
const STICKY: Partial<Record<string, string>> = {
  poh_num: "stick stick-1",
  item_code: "stick stick-2",
  item_desc: "stick stick-3",
};
const stickyCls = (key: string) => STICKY[key] ?? "";

/* ---- PO group header: aggregate status chip ---- */
function GroupChip({ lines }: { lines: Part[] }) {
  if (lines.every(isCompleted)) return <span className="chip ready">✓ completed</span>;
  const worst = Math.max(
    ...lines.filter((l) => !isCompleted(l)).map((l) => Number(l.delay_days) || 0),
  );
  if (worst > 0) return <span className="chip late">▲ {worst}d late</span>;
  return <span className="chip neutral">on time</span>;
}

/* header + line rows, keyed as one unit */
function FragmentRows({ header, lines }: { header: ReactNode; lines: ReactNode[] }) {
  return (
    <>
      {header}
      {lines}
    </>
  );
}

/* one PO line row; inside a group the PO cell shows only the line number */
function renderLine(
  p: Part,
  inGroup: boolean,
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>,
) {
  return (
    <tr key={p.id}>
      {COLUMNS.map((c) => {
        if (c.key === "poh_num") {
          return (
            <td key="poh_num" className={`${stickyCls("poh_num")} ${inGroup ? "line-cell" : ""}`.trim()}>
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
        if (c.key === "delay_days") {
          return (
            <td key="delay_days" className="num">
              <DelayCell part={p} />
            </td>
          );
        }
        const numCls = c.type === "number" ? "num" : "";
        if (c.editable) {
          return (
            <td key={String(c.key)} className={`team ${numCls}`}>
              <EditableCell part={p} col={c} onPatch={onPatch} />
            </td>
          );
        }
        const text = displayValue(p, c);
        if (c.ellipsis) {
          return (
            <td
              key={String(c.key)}
              className={`ellipsis ${stickyCls(String(c.key))}`.trim()}
              title={text}
            >
              {text}
            </td>
          );
        }
        return (
          <td key={String(c.key)} className={`${numCls} ${stickyCls(String(c.key))}`.trim()}>
            {text}
          </td>
        );
      })}
    </tr>
  );
}

export function PartsTable({ parts, totalCount, grouped, onPatch }: Props) {
  const [sortKey, setSortKey] = useState<keyof Part>("poh_num");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleGroup = (po: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(po)) next.delete(po);
      else next.add(po);
      return next;
    });

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    const numeric = col?.type === "number";
    return [...parts].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined || av === "") return 1;
      if (bv === null || bv === undefined || bv === "") return -1;
      let cmp = numeric
        ? Number(av) - Number(bv)
        : String(av).localeCompare(String(bv));
      if (cmp === 0) {
        // stable within a PO
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
    // group order: by PO number, honoring direction when sorting by PO
    const keys = [...m.keys()].sort((a, b) => a.localeCompare(b));
    if (sortKey === "poh_num" && sortDir === "desc") keys.reverse();
    return keys.map((k) => ({ po: k, lines: m.get(k)! }));
  }, [sorted, sortKey, sortDir]);

  const bands = groupBands();

  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr className="group-row">
              {bands.map((b, i) => (
                <th key={i} colSpan={b.span} className={b.cls}>
                  {b.label}
                </th>
              ))}
            </tr>
            <tr className="head-row">
              {COLUMNS.map((c) => (
                <th
                  key={String(c.key)}
                  className={`${c.type === "number" ? "num" : ""} ${stickyCls(String(c.key))}`.trim()}
                  onClick={() => toggleSort(c.key)}
                  title="Sort"
                >
                  {c.label}
                  {sortKey === c.key && (
                    <span className="sort-arrow">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
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
                          <td colSpan={COLUMNS.length}>
                            <div className="po-header-content">
                              <span className="po-chevron">{isOpen ? "▾" : "▸"}</span>
                              <strong>{po}</strong>
                              <span className="po-meta">{first.supplier_name}</span>
                              <span className="po-meta">{first.po_date ?? ""}</span>
                              <span className="po-meta">
                                {lines.length} line{lines.length === 1 ? "" : "s"} ·{" "}
                                {fmtCurrency(total, first.currency)}
                              </span>
                              <GroupChip lines={lines} />
                            </div>
                          </td>
                        </tr>
                      }
                      lines={isOpen ? lines.map((p) => renderLine(p, true, onPatch)) : []}
                    />
                  );
                })
              : sorted.map((p) => renderLine(p, false, onPatch))}
            {parts.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="empty">
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
        <span>Sage columns are read-only · yellow columns are editable</span>
      </div>
    </div>
  );
}
