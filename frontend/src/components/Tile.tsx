import type { ReactNode } from "react";

export type TileTint = "blue" | "amber" | "red" | "green" | "neutral";

interface Props {
  icon: ReactNode;
  tint: TileTint;
  label: string;
  value: ReactNode;
  context?: string;
  crit?: boolean;
}

export function Tile({ icon, tint, label, value, context, crit }: Props) {
  return (
    <div className="tile">
      <div className="tile-body">
        <div className="label">{label}</div>
        <div className={`value${crit ? " crit" : ""}`}>{value}</div>
        {context && <div className="context">{context}</div>}
      </div>
      <div className={`tile-icon t-${tint}`}>{icon}</div>
    </div>
  );
}
