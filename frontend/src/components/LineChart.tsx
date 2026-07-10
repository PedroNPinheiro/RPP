import { useRef, useState } from "react";
import type { LineSeries } from "../charts";
import { fmtDate } from "../format";

interface Props {
  title: string;
  dates: string[];
  series: LineSeries[];
  emptyText?: string;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (v <= m * pow) return m * pow;
  return 10 * pow;
}

const M = { top: 12, right: 16, bottom: 40, left: 40 };
const PLOT_H = 210;

export function LineChart({ title, dates, series, emptyText }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = dates.length;
  const plotW = Math.max(n <= 1 ? 200 : (n - 1) * 60, 200);
  const width = M.left + plotW + M.right;
  const height = M.top + PLOT_H + M.bottom;

  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const xOf = (i: number) => (n <= 1 ? M.left + plotW / 2 : M.left + (i / (n - 1)) * plotW);
  const yOf = (v: number) => M.top + PLOT_H - (v / max) * PLOT_H;

  // thin x labels so they don't collide
  const labelStep = Math.ceil(n / 8) || 1;

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const mx = e.clientX - rect.left;
    const i = Math.round(((mx - M.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        <div className="legend">
          {series.map((s) => (
            <span key={s.name} className="legend-item">
              <span className="legend-dot" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {n === 0 ? (
        <div className="chart-empty">
          {emptyText ?? "No history yet — snapshots start today and build daily."}
        </div>
      ) : (
        <div className="chart-scroll">
          <div className="chart-plot" style={{ width }}>
            <svg
              ref={svgRef}
              width={width}
              height={height}
              role="img"
              aria-label={title}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={M.left}
                    x2={width - M.right}
                    y1={yOf(t)}
                    y2={yOf(t)}
                    className={t === 0 ? "axis-baseline" : "gridline"}
                  />
                  <text x={M.left - 8} y={yOf(t) + 3} className="tick-label" textAnchor="end">
                    {Math.round(t)}
                  </text>
                </g>
              ))}

              {/* x labels */}
              {dates.map((d, i) =>
                i % labelStep === 0 || i === n - 1 ? (
                  <text
                    key={d}
                    x={xOf(i)}
                    y={M.top + PLOT_H + 16}
                    className="tick-label"
                    textAnchor="middle"
                  >
                    {fmtDate(d).slice(0, 5)}
                  </text>
                ) : null,
              )}

              {/* crosshair */}
              {hover !== null && (
                <line
                  x1={xOf(hover)}
                  x2={xOf(hover)}
                  y1={M.top}
                  y2={M.top + PLOT_H}
                  className="crosshair"
                />
              )}

              {/* series */}
              {series.map((s) => {
                const d = s.values
                  .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(v)}`)
                  .join(" ");
                return (
                  <g key={s.name}>
                    <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {hover !== null && (
                      <circle cx={xOf(hover)} cy={yOf(s.values[hover])} r={3.5} fill={s.color} className="dot-ring" />
                    )}
                  </g>
                );
              })}
            </svg>

            {hover !== null && (
              <div
                className="chart-tooltip"
                style={{ left: Math.min(xOf(hover), width - 100), top: M.top }}
              >
                <div className="tt-title">{fmtDate(dates[hover])}</div>
                {series.map((s) => (
                  <div key={s.name} className="tt-row">
                    <span className="legend-dot" style={{ background: s.color }} />
                    <span className="tt-name">{s.name}</span>
                    <span className="tt-val">{s.values[hover]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
