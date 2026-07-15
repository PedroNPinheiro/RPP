import { useEffect, useMemo, useState } from "react";
import { getSnapshots } from "../api";
import {
  breakdown,
  DIMENSIONS,
  distinctValues,
  pivotSnapshots,
  type DimKey,
  type Measure,
  type SnapshotResponse,
} from "../charts";
import { fmtEUR } from "../analytics";
import { BarChart } from "../components/BarChart";
import { IconAlert, IconBanknote, IconCheckCircle, IconClock, IconLayers } from "../components/Icons";
import { LineChart } from "../components/LineChart";
import { PageHeader } from "../components/PageHeader";
import { Tile } from "../components/Tile";
import { isClosed, isCompleted, isDelayed } from "../logic";
import type { Part } from "../types";

interface Props {
  parts: Part[];
  loading: boolean;
}

type Completion = "all" | "open" | "completed";

const FILTERS: { key: DimKey; label: string }[] = [
  { key: "supplier_name", label: "Supplier" },
  { key: "line_site", label: "Site" },
  { key: "dest_type", label: "Dest Type" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
];

type RangeKey = "all" | "30d" | "90d" | "year" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom…" },
];

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

export function Analytics({ parts, loading }: Props) {
  const [snap, setSnap] = useState<SnapshotResponse | null>(null);
  const [snapFailed, setSnapFailed] = useState(false);
  const [filters, setFilters] = useState<Partial<Record<DimKey, string>>>({});
  const [completion, setCompletion] = useState<Completion>("all");
  const [groupBy, setGroupBy] = useState<DimKey>("status");
  const [measure, setMeasure] = useState<Measure>("count");
  const [range, setRange] = useState<RangeKey>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // date window as ISO bounds; lines filter on po_date, history on snap day
  const bounds = useMemo(() => {
    switch (range) {
      case "30d": return { min: isoDaysAgo(30), max: undefined };
      case "90d": return { min: isoDaysAgo(90), max: undefined };
      case "year": return { min: `${new Date().getFullYear()}-01-01`, max: undefined };
      case "custom": return { min: dateFrom || undefined, max: dateTo || undefined };
      default: return { min: undefined, max: undefined };
    }
  }, [range, dateFrom, dateTo]);

  const inBounds = useMemo(() => {
    const { min, max } = bounds;
    return (iso: string | null | undefined) => {
      if (!min && !max) return true;
      if (!iso) return false; // an active range excludes lines with no date
      const d = iso.slice(0, 10);
      return (!min || d >= min) && (!max || d <= max);
    };
  }, [bounds]);

  useEffect(() => {
    getSnapshots()
      .then((s) => {
        setSnap(s);
        setSnapFailed(false);
      })
      .catch(() => {
        // keep the page usable, but never dress a failure up as "no data"
        setSnap({ today: "", rows: [] });
        setSnapFailed(true);
      });
  }, [parts]);

  const filtered = useMemo(() => {
    return parts.filter((p) => {
      if (completion === "open" && isClosed(p)) return false;
      if (completion === "completed" && !isCompleted(p)) return false;
      if (!inBounds(p.po_date)) return false;
      for (const { key } of FILTERS) {
        const want = filters[key];
        if (want && ((p[key] as string | null) || "") !== want) return false;
      }
      return true;
    });
  }, [parts, filters, completion, inBounds]);

  const rows = useMemo(() => breakdown(filtered, groupBy), [filtered, groupBy]);
  const bars = useMemo(
    () => rows.map((r) => ({ label: r.label, value: measure === "value" ? r.value : r.count, color: r.color })),
    [rows, measure],
  );

  // the date range also scopes which snapshot days the history shows
  const histRows = useMemo(
    () => (snap?.rows ?? []).filter((r) => inBounds(r.snap_date)),
    [snap, inBounds],
  );
  const statusHist = useMemo(() => pivotSnapshots(histRows, "status"), [histRows]);
  const priorityHist = useMemo(() => pivotSnapshots(histRows, "priority"), [histRows]);

  // KPIs (respond to filters)
  const openCount = filtered.filter((p) => !isClosed(p)).length;
  const completedCount = filtered.filter(isCompleted).length;
  const delayed = filtered.filter(isDelayed).length;
  const totalVal = filtered.reduce((s, p) => s + (Number(p.line_value) || 0), 0);
  const openVal = filtered
    .filter((p) => !isClosed(p))
    .reduce((s, p) => s + (Number(p.line_value) || 0), 0);

  const measureTotal = rows.reduce((s, r) => s + (measure === "value" ? r.value : r.count), 0);
  const fmtVal = (n: number) => (measure === "value" ? fmtEUR(n, true) : String(Math.round(n)));
  const setFilter = (key: DimKey, v: string) => setFilters((f) => ({ ...f, [key]: v || undefined }));
  const activeFilters =
    Object.values(filters).filter(Boolean).length +
    (completion !== "all" ? 1 : 0) +
    (bounds.min || bounds.max ? 1 : 0);
  const dimLabel = DIMENSIONS.find((d) => d.key === groupBy)?.label ?? "";

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <>
      <PageHeader
        title="Analytics"
        sub={`${filtered.length} of ${parts.length} lines${activeFilters ? " · filtered" : ""}`}
      />

      <div className="tiles">
        <Tile icon={<IconLayers />} tint="blue" label="Lines" value={filtered.length} />
        <Tile icon={<IconClock />} tint="amber" label="Open" value={openCount} />
        <Tile icon={<IconCheckCircle />} tint="green" label="Completed" value={completedCount} />
        <Tile icon={<IconAlert />} tint={delayed ? "red" : "neutral"} label="Delayed" value={delayed} crit={delayed > 0} />
        <Tile icon={<IconBanknote />} tint="blue" label="Total value" value={fmtEUR(totalVal, true)} context={`open ${fmtEUR(openVal, true)}`} />
      </div>

      {/* filter bar */}
      <div className="filter-bar">
        <div className="seg">
          {(["all", "open", "completed"] as Completion[]).map((c) => (
            <button key={c} className={completion === c ? "on" : ""} onClick={() => setCompletion(c)}>
              {c === "all" ? "All" : c === "open" ? "Open" : "Completed"}
            </button>
          ))}
        </div>
        <label className="filter-field">
          <span>PO date</span>
          <select className="filter-select" value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </label>
        {range === "custom" && (
          <>
            <label className="filter-field">
              <span>From</span>
              <input type="date" className="filter-select" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="filter-field">
              <span>To</span>
              <input type="date" className="filter-select" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </>
        )}
        {FILTERS.map(({ key, label }) => (
          <label key={key} className="filter-field">
            <span>{label}</span>
            <select className="filter-select" value={filters[key] ?? ""} onChange={(e) => setFilter(key, e.target.value)}>
              <option value="">All</option>
              {distinctValues(parts, key).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        {activeFilters > 0 && (
          <button
            className="btn"
            onClick={() => {
              setFilters({});
              setCompletion("all");
              setRange("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* explorer: builder + chart + breakdown table */}
      <div className="builder">
        <label className="filter-field">
          <span>Group by</span>
          <select className="filter-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value as DimKey)}>
            {DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Measure</span>
          <select className="filter-select" value={measure} onChange={(e) => setMeasure(e.target.value as Measure)}>
            <option value="count">Number of lines</option>
            <option value="value">Value (€)</option>
          </select>
        </label>
      </div>

      <div className="explore-grid">
        <BarChart title={`${measure === "value" ? "Value" : "Lines"} by ${dimLabel}`} bars={bars} format={fmtVal} />

        <div className="table-card breakdown-card">
          <div className="chart-head"><h3>Breakdown</h3></div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr className="head-row">
                  <th>{dimLabel}</th>
                  <th className="num">Lines</th>
                  <th className="num">Value</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const metric = measure === "value" ? r.value : r.count;
                  const share = measureTotal ? (metric / measureTotal) * 100 : 0;
                  return (
                    <tr key={r.label}>
                      <td>
                        <span className="bd-dot" style={{ background: r.color }} />
                        {r.label}
                      </td>
                      <td className="num">{r.count}</td>
                      <td className="num">{fmtEUR(r.value)}</td>
                      <td className="num">{share.toFixed(0)}%</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="empty">No lines match the filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* history — all lines, accumulates daily; date range scopes the days */}
      <div className="section-label">
        History (all lines · one point per day{bounds.min || bounds.max ? " · date-filtered" : ""})
      </div>
      <div className="charts-grid">
        <LineChart
          title="Status History"
          dates={statusHist.dates}
          series={statusHist.series}
          emptyText={snapFailed ? "Couldn't load history — check the backend log." : undefined}
        />
        <LineChart
          title="Priority History"
          dates={priorityHist.dates}
          series={priorityHist.series}
          emptyText={snapFailed ? "Couldn't load history — check the backend log." : undefined}
        />
      </div>
    </>
  );
}
