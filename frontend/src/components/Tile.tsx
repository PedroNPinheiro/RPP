import type { ReactNode } from "react";

export type TileTint = "blue" | "amber" | "red" | "green" | "neutral";

interface Props {
  icon: ReactNode;
  tint: TileTint;
  label: string;
  value: ReactNode;
  context?: string;
  crit?: boolean;
  onClick?: () => void;
}

export function Tile({ icon, tint, label, value, context, crit, onClick }: Props) {
  return (
    <div
      className={`tile${onClick ? " tile-btn" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="tile-body">
        <div className="label">{label}</div>
        <div className={`value${crit ? " crit" : ""}`}>{value}</div>
        {context && <div className="context">{context}</div>}
      </div>
      <div className={`tile-icon t-${tint}`}>{icon}</div>
    </div>
  );
}
