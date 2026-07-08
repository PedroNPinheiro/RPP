import { useEffect, useMemo, useState } from "react";
import { getSnapshots } from "../api";
import {
  DIMENSIONS,
  distinctValues,
  pivotSnapshots,
  summarize,
  type DimKey,
  type Measure,
  type SnapshotResponse,
} from "../charts";
import { fmtEUR } from "../analytics";
import { BarChart } from "../components/BarChart";
import { LineChart } from "../components/LineChart";
import { PageHeader } from "../components/PageHeader";
import { isCompleted } from "../logic";
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

export function Analytics({ parts, loading }: Props) {
  const [snap, setSnap] = useState<SnapshotResponse | null>(null);
  const [filters, setFilters] = useState<Partial<Record<DimKey, string>>>({});
  const [completion, setCompletion] = useState<Completion>("all");
  const [groupBy, setGroupBy] = useState<DimKey>("status");
  const [measure, setMeasure] = useState<Measure>("count");

  useEffect(() => {
    getSnapshots().then(setSnap).catch(() => setSnap({ today: "", rows: [] }));
  }, [parts]);

  const filtered = useMemo(() => {
    return parts.filter((p) => {
      if (completion === "open" && isCompleted(p)) return false;
      if (completion === "completed" && !isCompleted(p)) return false;
      for (const { key } of FILTERS) {
        const want = filters[key];
        if (want && ((p[key] as string | null) || "") !== want) return false;
      }
      return true;
    });
  }, [parts, filters, completion]);

  const bars = useMemo(
    () => summarize(filtered, groupBy, measure),
    [filtered, groupBy, measure],
  );

  const statusHist = useMemo(() => pivotSnapshots(snap?.rows ?? [], "status"), [snap]);
  const priorityHist = useMemo(() => pivotSnapshots(snap?.rows ?? [], "priority"), [snap]);

  const totalVal = filtered.reduce((s, p) => s + (Number(p.line_value) || 0), 0);
  const fmt = (n: number) => (measure === "value" ? fmtEUR(n, true) : String(Math.round(n)));
  const setFilter = (key: DimKey, v: string) =>
    setFilters((f) => ({ ...f, [key]: v || undefined }));
  const activeFilters = Object.values(filters).filter(Boolean).length + (completion !== "all" ? 1 : 0);
  const dimLabel = DIMENSIONS.find((d) => d.key === groupBy)?.label ?? "";

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <>
      <PageHeader
        title="Analytics"
        sub={`${filtered.length} of ${parts.length} lines${activeFilters ? " · filtered" : ""}`}
      />

      {/* filter bar */}
      <div className="filter-bar">
        <div className="seg">
          {(["all", "open", "completed"] as Completion[]).map((c) => (
            <button
              key={c}
              className={completion === c ? "on" : ""}
              onClick={() => setCompletion(c)}
            >
              {c === "all" ? "All" : c === "open" ? "Open" : "Completed"}
            </button>
          ))}
        </div>
        {FILTERS.map(({ key, label }) => (
          <label key={key} className="filter-field">
            <span>{label}</span>
            <select
              className="filter-select"
              value={filters[key] ?? ""}
              onChange={(e) => setFilter(key, e.target.value)}
            >
              <option value="">All</option>
              {distinctValues(parts, key).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
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
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* explorer: pick dimension + measure */}
      <div className="builder">
        <label className="filter-field">
          <span>Group by</span>
          <select
            className="filter-select"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as DimKey)}
          >
            {DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Measure</span>
          <select
            className="filter-select"
            value={measure}
            onChange={(e) => setMeasure(e.target.value as Measure)}
          >
            <option value="count">Number of lines</option>
            <option value="value">Value (€)</option>
          </select>
        </label>
        <div className="builder-total">
          {filtered.length} lines · {fmtEUR(totalVal)}
        </div>
      </div>

      <BarChart
        title={`${measure === "value" ? "Value" : "Lines"} by ${dimLabel}`}
        bars={bars}
        format={fmt}
      />

      {/* history — all lines, accumulates daily */}
      <div className="section-label">History (all lines · one point per day)</div>
      <div className="charts-grid">
        <LineChart title="Histórico Status" dates={statusHist.dates} series={statusHist.series} />
        <LineChart
          title="Histórico Prioridades"
          dates={priorityHist.dates}
          series={priorityHist.series}
        />
      </div>
    </>
  );
}
