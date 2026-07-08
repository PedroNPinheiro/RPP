import { useEffect, useMemo, useState } from "react";
import { aggregateByMonth, fmtEUR, MONTH_SHORT } from "../analytics";
import { getSnapshots } from "../api";
import {
  pivotSnapshots,
  summaryByField,
  type SnapshotResponse,
} from "../charts";
import { BarChart } from "../components/BarChart";
import { ColumnChart, type ChartDatum } from "../components/ColumnChart";
import { LineChart } from "../components/LineChart";
import { PageHeader } from "../components/PageHeader";
import type { Part } from "../types";

interface Props {
  parts: Part[];
  loading: boolean;
}

const VALUE_SERIES = [
  { name: "Open", colorVar: "--series-1" },
  { name: "Completed", colorVar: "--series-2" },
];

export function Analytics({ parts, loading }: Props) {
  const [snap, setSnap] = useState<SnapshotResponse | null>(null);

  useEffect(() => {
    getSnapshots().then(setSnap).catch(() => setSnap({ today: "", rows: [] }));
  }, [parts]);

  const statusBars = useMemo(() => summaryByField(parts, "status"), [parts]);
  const priorityBars = useMemo(() => summaryByField(parts, "priority"), [parts]);

  const statusHist = useMemo(
    () => pivotSnapshots(snap?.rows ?? [], "status"),
    [snap],
  );
  const priorityHist = useMemo(
    () => pivotSnapshots(snap?.rows ?? [], "priority"),
    [snap],
  );

  const aggs = useMemo(() => aggregateByMonth(parts), [parts]);
  const valueData: ChartDatum[] = aggs.map((a, i) => ({
    label: MONTH_SHORT[a.month - 1],
    sub: a.month === 1 || i === 0 ? String(a.year) : undefined,
    values: [a.openValue, a.completedValue],
  }));

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <>
      <PageHeader title="Analytics" sub="Status, priorities and value across all lines" />

      {/* current distribution */}
      <div className="charts-grid">
        <BarChart title="Resumo Status" bars={statusBars} />
        <BarChart title="Resumo Prioridades" bars={priorityBars} />
      </div>

      {/* history — accumulates one point per day */}
      <div className="charts-grid">
        <LineChart
          title="Histórico Status"
          dates={statusHist.dates}
          series={statusHist.series}
        />
        <LineChart
          title="Histórico Prioridades"
          dates={priorityHist.dates}
          series={priorityHist.series}
        />
      </div>

      {/* value over time */}
      <div className="charts-grid">
        <ColumnChart
          title="Valor por mês"
          series={VALUE_SERIES}
          data={valueData}
          format={(n) => fmtEUR(n, true)}
        />
      </div>
    </>
  );
}
