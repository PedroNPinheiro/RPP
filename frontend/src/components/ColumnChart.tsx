import { useState } from "react";

export interface ChartSeries {
  name: string;
  colorVar: string; // CSS custom property, e.g. "--series-1"
}
export interface ChartDatum {
  label: string; // "Jul"
  sub?: string;  // "2026" — shown under the label at year boundaries
  values: number[]; // one per series
}

interface Props {
  title: string;
  series: ChartSeries[];
  data: ChartDatum[];
  format: (n: number) => string;
}

/* data-end rounded top, square baseline (mark spec) */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, h, w / 2));
  return [
    `M${x},${y + h}`,
    `L${x},${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h}`,
    "Z",
  ].join(" ");
}

/* round the axis max up to a clean 1/2/5 step */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) {
    if (v <= m * pow) return m * pow;
  }
  return 10 * pow;
}

const M = { top: 12, right: 12, bottom: 36, left: 54 };
const PLOT_H = 200;
const BAR_W = 22; // ≤ 24px (mark spec)
const BAR_GAP = 2; // surface gap between touching marks
const TARGET_W = 620; // spread bands across the card when data is sparse

export function ColumnChart({ title, series, data, format }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const groupW = series.length * BAR_W + (series.length - 1) * BAR_GAP;
  const bandW = Math.max(
    groupW + 16,
    Math.min(130, Math.floor(TARGET_W / Math.max(data.length, 1))),
  );
  const plotW = Math.max(data.length * bandW, 120);
  const width = M.left + plotW + M.right;
  const height = M.top + PLOT_H + M.bottom;

  const rawMax = Math.max(0, ...data.flatMap((d) => d.values));
  const max = niceMax(rawMax);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const yOf = (v: number) => M.top + PLOT_H - (v / max) * PLOT_H;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        <div className="legend">
          {series.map((s) => (
            <span key={s.name} className="legend-item">
              <span className="legend-dot" style={{ background: `var(${s.colorVar})` }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="chart-empty">No data yet</div>
      ) : (
        <div className="chart-scroll">
          <div className="chart-plot" style={{ width }}>
            <svg width={width} height={height} role="img" aria-label={title}>
              {/* hairline gridlines + tick labels */}
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={M.left} x2={width - M.right}
                    y1={yOf(t)} y2={yOf(t)}
                    className={t === 0 ? "axis-baseline" : "gridline"}
                  />
                  <text x={M.left - 8} y={yOf(t) + 3} className="tick-label" textAnchor="end">
                    {format(t)}
                  </text>
                </g>
              ))}

              {/* columns */}
              {data.map((d, i) => {
                const x0 = M.left + i * bandW + (bandW - groupW) / 2;
                return (
                  <g key={d.label + i} opacity={hover === null || hover === i ? 1 : 0.45}>
                    {d.values.map((v, si) => {
                      const h = (v / max) * PLOT_H;
                      if (h <= 0) return null;
                      return (
                        <path
                          key={si}
                          d={topRoundedRect(x0 + si * (BAR_W + BAR_GAP), yOf(v), BAR_W, h, 4)}
                          style={{ fill: `var(${series[si].colorVar})` }}
                        />
                      );
                    })}
                    {/* x labels */}
                    <text
                      x={x0 + groupW / 2} y={M.top + PLOT_H + 15}
                      className="tick-label" textAnchor="middle"
                    >
                      {d.label}
                    </text>
                    {d.sub && (
                      <text
                        x={x0 + groupW / 2} y={M.top + PLOT_H + 28}
                        className="tick-sub" textAnchor="middle"
                      >
                        {d.sub}
                      </text>
                    )}
                    {/* hover hit target — bigger than the mark */}
                    <rect
                      x={M.left + i * bandW} y={M.top}
                      width={bandW} height={PLOT_H}
                      fill="transparent"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}
            </svg>

            {hover !== null && data[hover] && (
              <div
                className="chart-tooltip"
                style={{
                  left: Math.min(M.left + hover * bandW + bandW / 2, width - 90),
                  top: M.top,
                }}
              >
                <div className="tt-title">
                  {data[hover].label} {data[hover].sub ?? ""}
                </div>
                {series.map((s, si) => (
                  <div key={s.name} className="tt-row">
                    <span className="legend-dot" style={{ background: `var(${s.colorVar})` }} />
                    <span className="tt-name">{s.name}</span>
                    <span className="tt-val">{format(data[hover].values[si])}</span>
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
