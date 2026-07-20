import { useEffect, useState, type ReactNode } from "react";

/* Shared "maximize this chart" behaviour for the chart cards.
   Returns the toggle button to drop into .chart-head, a frame() that lifts the
   card into a full-screen overlay when open, and `max` so the chart can size
   itself taller. Esc closes; the page behind is scroll-locked. */
export function useMaximize() {
  const [max, setMax] = useState(false);

  useEffect(() => {
    if (!max) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMax(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [max]);

  const button = (
    <button
      type="button"
      className="chart-max"
      onClick={() => setMax((m) => !m)}
      title={max ? "Close (Esc)" : "Maximize"}
      aria-label={max ? "Close chart" : "Maximize chart"}
    >
      {max ? "✕" : "⤢"}
    </button>
  );

  const frame = (card: ReactNode) =>
    max ? (
      <div
        className="chart-overlay"
        role="dialog"
        aria-modal="true"
        onClick={() => setMax(false)}
      >
        {/* stop clicks inside the card from closing the overlay */}
        <div className="chart-overlay-inner" onClick={(e) => e.stopPropagation()}>
          {card}
        </div>
      </div>
    ) : (
      card
    );

  return { max, button, frame };
}
