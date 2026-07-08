import { useState } from "react";
import type { Bar } from "../charts";

interface Props {
  title: string;
  bars: Bar[];
}

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

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (v <= m * pow) return m * pow;
  return 10 * pow;
}

const M = { top: 22, right: 12, bottom: 46, left: 40 };
const PLOT_H = 210;
const BAR_MAX = 66;

export function BarChart({ title, bars }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const n = Math.max(bars.length, 1);
  const bandW = Math.min(150, Math.max(70, 560 / n));
  const barW = Math.min(BAR_MAX, bandW - 26);
  const plotW = n * bandW;
  const width = M.left + plotW + M.right;
  const height = M.top + PLOT_H + M.bottom;

  const max = niceMax(Math.max(0, ...bars.map((b) => b.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const yOf = (v: number) => M.top + PLOT_H - (v / max) * PLOT_H;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
      </div>
      {bars.length === 0 ? (
        <div className="chart-empty">No data yet</div>
      ) : (
        <div className="chart-scroll">
          <svg width={width} height={height} role="img" aria-label={title}>
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

            {bars.map((b, i) => {
              const x = M.left + i * bandW + (bandW - barW) / 2;
              const h = (b.value / max) * PLOT_H;
              return (
                <g
                  key={b.label}
                  opacity={hover === null || hover === i ? 1 : 0.5}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {h > 0 && (
                    <path d={topRoundedRect(x, yOf(b.value), barW, h, 4)} style={{ fill: b.color }} />
                  )}
                  <text
                    x={x + barW / 2}
                    y={yOf(b.value) - 7}
                    className="bar-value"
                    textAnchor="middle"
                  >
                    {b.value}
                  </text>
                  <foreignObject
                    x={M.left + i * bandW}
                    y={M.top + PLOT_H + 6}
                    width={bandW}
                    height={M.bottom - 6}
                  >
                    <div className="bar-label">{b.label}</div>
                  </foreignObject>
                  <rect
                    x={M.left + i * bandW}
                    y={M.top}
                    width={bandW}
                    height={PLOT_H}
                    fill="transparent"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
