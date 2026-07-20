import { useEffect, useRef, useState } from "react";
import type { LineSeries } from "../charts";
import { fmtDate } from "../format";
import { useMaximize } from "./useMaximize";

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
  const { max: maximized, button: maxBtn, frame } = useMaximize();
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fitW, setFitW] = useState(0);
  // legend click isolates/restores a series; empty set = everything shown
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // legend hover spotlights one series without changing what's shown
  const [spot, setSpot] = useState<string | null>(null);
  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const visible = series.filter((s) => !hidden.has(s.name));

  const n = dates.length;
  const hasData = n > 0;

  // stretch the plot to the card; overflow into horizontal scroll only
  // once the daily points genuinely need more room
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFitW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasData]);

  const plotH = maximized ? Math.max(420, Math.round(window.innerHeight * 0.55)) : PLOT_H;
  const plotW = Math.max((n - 1) * (maximized ? 90 : 60), fitW - M.left - M.right - 2, 200);
  const width = M.left + plotW + M.right;
  const height = M.top + plotH + M.bottom;

  // scale to what's actually shown, so isolating a small series doesn't
  // leave it looking tiny against the full-set axis
  const max = niceMax(Math.max(1, ...visible.flatMap((s) => s.values)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const xOf = (i: number) => (n <= 1 ? M.left + plotW / 2 : M.left + (i / (n - 1)) * plotW);
  const yOf = (v: number) => M.top + plotH - (v / max) * plotH;

  // thin x labels so they don't collide
  const labelStep = Math.ceil(n / 8) || 1;

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const mx = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((mx - M.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return frame(
    <div className={`chart-card${maximized ? " expanded" : ""}`}>
      <div className="chart-head">
        <h3>{title}</h3>
        <div className="legend">
          {series.map((s) => {
            const off = hidden.has(s.name);
            return (
              <button
                key={s.name}
                type="button"
                className={`legend-item legend-btn${off ? " off" : ""}`}
                aria-pressed={!off}
                title={off ? `Show ${s.name}` : `Click to hide · hover to spotlight`}
                onClick={() => toggle(s.name)}
                onMouseEnter={() => !off && setSpot(s.name)}
                onMouseLeave={() => setSpot(null)}
              >
                <span className="legend-dot" style={{ background: s.color }} />
                {s.name}
              </button>
            );
          })}
          {hidden.size > 0 && (
            <button type="button" className="legend-reset" onClick={() => setHidden(new Set())}>
              Show all
            </button>
          )}
        </div>
        {maxBtn}
      </div>

      {n === 0 ? (
        <div className="chart-empty">
          {emptyText ?? "No history yet — snapshots start today and build daily."}
        </div>
      ) : visible.length === 0 ? (
        <div className="chart-empty">
          All series hidden —{" "}
          <button type="button" className="legend-reset inline" onClick={() => setHidden(new Set())}>
            show all
          </button>
        </div>
      ) : (
        <div className="chart-scroll" ref={scrollRef}>
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
                    y={M.top + plotH + 16}
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
                  y2={M.top + plotH}
                  className="crosshair"
                />
              )}

              {/* series — spotlighted one drawn last so it sits on top */}
              {[...visible]
                .sort((a, b) => (a.name === spot ? 1 : 0) - (b.name === spot ? 1 : 0))
                .map((s) => {
                  const isSpot = spot === s.name;
                  const dim = spot !== null && !isSpot;
                  const d = s.values
                    .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(v)}`)
                    .join(" ");
                  return (
                    <g key={s.name} opacity={dim ? 0.14 : 1} style={{ transition: "opacity 0.12s ease" }}>
                      <path
                        d={d}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={isSpot ? 3.25 : 2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {/* point markers so sparse history (esp. a single day) is
                          visible; the surface ring keeps overlapping dots apart.
                          hidden once the line is dense enough to carry itself */}
                      {n <= 48 &&
                        s.values.map((v, i) => (
                          <circle key={i} cx={xOf(i)} cy={yOf(v)} r={isSpot ? 3.75 : 3} fill={s.color} className="pt-marker" />
                        ))}
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
                {visible.map((s) => (
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
