import { useState } from "react";
import type { Bar } from "../charts";
import { useMaximize } from "./useMaximize";

interface Props {
  title: string;
  bars: Bar[];
  format?: (n: number) => string;
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

const M = { top: 22, right: 12, bottom: 46, left: 52 };
const PLOT_H = 210;
const BAR_MAX = 66;

export function BarChart({ title, bars, format }: Props) {
  const { max: maximized, button: maxBtn, frame } = useMaximize();
  const fmt = format ?? ((n: number) => String(Math.round(n)));
  const [hover, setHover] = useState<number | null>(null);

  const n = Math.max(bars.length, 1);
  // maximized: taller plot and roomier bands, since there's screen to spare
  const plotH = maximized ? Math.max(420, Math.round(window.innerHeight * 0.55)) : PLOT_H;
  const bandW = maximized
    ? Math.min(240, Math.max(110, 1100 / n))
    : Math.min(150, Math.max(70, 560 / n));
  const barW = Math.min(maximized ? BAR_MAX * 1.6 : BAR_MAX, bandW - 26);
  const plotW = n * bandW;
  const width = M.left + plotW + M.right;
  const height = M.top + plotH + M.bottom;

  const max = niceMax(Math.max(0, ...bars.map((b) => b.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const yOf = (v: number) => M.top + plotH - (v / max) * plotH;

  return frame(
    <div className={`chart-card${maximized ? " expanded" : ""}`}>
      <div className="chart-head">
        <h3>{title}</h3>
        {maxBtn}
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
                  {fmt(t)}
                </text>
              </g>
            ))}

            {bars.map((b, i) => {
              const x = M.left + i * bandW + (bandW - barW) / 2;
              const h = (b.value / max) * plotH;
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
                    {fmt(b.value)}
                  </text>
                  <foreignObject
                    x={M.left + i * bandW}
                    y={M.top + plotH + 6}
                    width={bandW}
                    height={M.bottom - 6}
                  >
                    <div className="bar-label">{b.label}</div>
                  </foreignObject>
                  <rect
                    x={M.left + i * bandW}
                    y={M.top}
                    width={bandW}
                    height={plotH}
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
