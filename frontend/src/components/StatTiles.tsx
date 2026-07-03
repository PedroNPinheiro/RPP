import { isCompleted, isDelayed } from "../logic";
import type { Part } from "../types";
import { IconAlert, IconBanknote, IconClock, IconLayers } from "./Icons";
import { Tile } from "./Tile";

type View = "open" | "delayed" | "completed" | "all";

interface Props {
  parts: Part[];
  onSelect?: (view: View) => void;
}

function compactCurrency(total: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: total >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: total >= 100_000 ? 1 : 0,
  }).format(total);
}

export function StatTiles({ parts, onSelect }: Props) {
  const delayed = parts.filter(isDelayed).length;
  const openParts = parts.filter((p) => !isCompleted(p));
  const currency = parts.find((p) => p.currency)?.currency ?? "EUR";
  const totalValue = openParts.reduce((s, p) => s + (Number(p.line_value) || 0), 0);

  return (
    <div className="tiles">
      <Tile
        icon={<IconLayers />}
        tint="blue"
        label="PO lines"
        value={parts.length}
        context="flagged Replacement Parts"
        onClick={onSelect && (() => onSelect("all"))}
      />
      <Tile
        icon={<IconClock />}
        tint="amber"
        label="Open"
        value={openParts.length}
        context="not yet completed"
        onClick={onSelect && (() => onSelect("open"))}
      />
      <Tile
        icon={<IconAlert />}
        tint={delayed > 0 ? "red" : "neutral"}
        label="Delayed"
        value={delayed}
        context="past expected date"
        crit={delayed > 0}
        onClick={onSelect && (() => onSelect("delayed"))}
      />
      <Tile
        icon={<IconBanknote />}
        tint="green"
        label="Open value"
        value={compactCurrency(totalValue, currency)}
        context="sum of open lines"
        onClick={onSelect && (() => onSelect("open"))}
      />
    </div>
  );
}
