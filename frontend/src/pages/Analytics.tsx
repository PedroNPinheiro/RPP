import { useMemo, useState } from "react";
import { aggregateByMonth, fmtEUR, MONTH_SHORT, years } from "../analytics";
import { ColumnChart, type ChartDatum } from "../components/ColumnChart";
import { IconBanknote, IconCheckCircle, IconClock, IconLayers } from "../components/Icons";
import { Tile } from "../components/Tile";
import { isCompleted } from "../logic";
import type { Part } from "../types";

interface Props {
  parts: Part[];
  loading: boolean;
}

const SERIES = [
  { name: "Open", colorVar: "--series-1" },
  { name: "Completed", colorVar: "--series-2" },
];

export function Analytics({ parts, loading }: Props) {
  const [year, setYear] = useState<number | "all">("all");

  const allAggs = useMemo(() => aggregateByMonth(parts), [parts]);
  const yearList = useMemo(() => years(allAggs), [allAggs]);

  const aggs = useMemo(
    () => (year === "all" ? allAggs : allAggs.filter((a) => a.year === year)),
    [allAggs, year],
  );

  const scoped = useMemo(
    () =>
      year === "all"
        ? parts
        : parts.filter((p) => p.po_date && new Date(p.po_date).getFullYear() === year),
    [parts, year],
  );

  const openValue = scoped
    .filter((p) => !isCompleted(p))
    .reduce((s, p) => s + (Number(p.line_value) || 0), 0);
  const completedValue = scoped
    .filter(isCompleted)
    .reduce((s, p) => s + (Number(p.line_value) || 0), 0);

  const valueData: ChartDatum[] = aggs.map((a, i) => ({
    label: MONTH_SHORT[a.month - 1],
    sub: a.month === 1 || i === 0 ? String(a.year) : undefined,
    values: [a.openValue, a.completedValue],
  }));
  const linesData: ChartDatum[] = aggs.map((a, i) => ({
    label: MONTH_SHORT[a.month - 1],
    sub: a.month === 1 || i === 0 ? String(a.year) : undefined,
    values: [a.openLines, a.completedLines],
  }));

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <>
      <div className="page-head">
        <h2>Analytics</h2>
        <div className="seg">
          <button className={year === "all" ? "on" : ""} onClick={() => setYear("all")}>
            All years
          </button>
          {yearList.map((y) => (
            <button key={y} className={year === y ? "on" : ""} onClick={() => setYear(y)}>
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="tiles">
        <Tile
          icon={<IconClock />}
          tint="amber"
          label="Open value"
          value={fmtEUR(openValue)}
          context="POs not yet completed"
        />
        <Tile
          icon={<IconCheckCircle />}
          tint="green"
          label="Completed value"
          value={fmtEUR(completedValue)}
          context="received or marked Completo"
        />
        <Tile
          icon={<IconBanknote />}
          tint="blue"
          label="Total value"
          value={fmtEUR(openValue + completedValue)}
          context="all replacement-parts lines"
        />
        <Tile
          icon={<IconLayers />}
          tint="neutral"
          label="PO lines"
          value={scoped.length}
          context={year === "all" ? "all time" : `in ${year}`}
        />
      </div>

      <div className="charts-grid">
        <ColumnChart
          title="Value by month"
          series={SERIES}
          data={valueData}
          format={(n) => fmtEUR(n, true)}
        />
        <ColumnChart
          title="PO lines by month"
          series={SERIES}
          data={linesData}
          format={(n) => String(Math.round(n))}
        />
      </div>

      {/* table view — the dependable identity/value channel behind the charts */}
      <div className="table-card">
        <div className="table-scroll" style={{ maxHeight: 360 }}>
          <table>
            <thead>
              <tr className="head-row">
                <th>Month</th>
                <th className="num">Open value</th>
                <th className="num">Completed value</th>
                <th className="num">Total</th>
                <th className="num">Open lines</th>
                <th className="num">Completed lines</th>
              </tr>
            </thead>
            <tbody>
              {[...aggs].reverse().map((a) => (
                <tr key={a.key}>
                  <td>
                    {MONTH_SHORT[a.month - 1]} {a.year}
                  </td>
                  <td className="num">{fmtEUR(a.openValue)}</td>
                  <td className="num">{fmtEUR(a.completedValue)}</td>
                  <td className="num">{fmtEUR(a.openValue + a.completedValue)}</td>
                  <td className="num">{a.openLines}</td>
                  <td className="num">{a.completedLines}</td>
                </tr>
              ))}
              {aggs.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No data yet — flag some POs in Sage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
