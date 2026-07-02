import { useMemo, useState } from "react";
import { COLUMNS, type Col } from "../columns";
import type { Part } from "../types";
import { EditableCell } from "./EditableCell";

interface Props {
  parts: Part[];
  totalCount: number;
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
  if (d === null || d === undefined) return null;
  if (d > 0) return <span className="chip late">▲ {d}d late</span>;
  return <span className="chip neutral">on time</span>;
}

type SortDir = "asc" | "desc";

export function PartsTable({ parts, totalCount, onPatch }: Props) {
  const [sortKey, setSortKey] = useState<keyof Part>("poh_num");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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
                  className={c.type === "number" ? "num" : ""}
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
            {sorted.map((p, i) => {
              const samePO = i > 0 && sorted[i - 1].poh_num === p.poh_num;
              return (
                <tr key={p.id}>
                  {COLUMNS.map((c) => {
                    /* merged / special cells */
                    if (c.key === "poh_num") {
                      return (
                        <td key="poh_num" className={samePO ? "muted-cell" : ""}>
                          {p.poh_num}
                          <span className="line-tag">·{p.poh_line}</span>
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
                        <td key={String(c.key)} className="ellipsis" title={text}>
                          {text}
                        </td>
                      );
                    }
                    return (
                      <td key={String(c.key)} className={numCls}>
                        {text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
