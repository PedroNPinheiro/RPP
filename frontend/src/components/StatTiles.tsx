import type { Part } from "../types";

interface Props {
  parts: Part[];
}

function compactCurrency(total: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: total >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: total >= 100_000 ? 1 : 0,
  }).format(total);
}

export function StatTiles({ parts }: Props) {
  const delayed = parts.filter((p) => Number(p.delay_days) > 0).length;
  const open = parts.filter((p) => Number(p.balance_qty) > 0).length;
  const currency = parts.find((p) => p.currency)?.currency ?? "EUR";
  const totalValue = parts.reduce((s, p) => s + (Number(p.line_value) || 0), 0);

  return (
    <div className="tiles">
      <div className="tile">
        <div className="label">PO lines</div>
        <div className="value">{parts.length}</div>
        <div className="context">flagged Replacement Parts</div>
      </div>
      <div className="tile">
        <div className="label">Open</div>
        <div className="value">{open}</div>
        <div className="context">awaiting receipt</div>
      </div>
      <div className="tile">
        <div className="label">Delayed</div>
        <div className={`value${delayed > 0 ? " crit" : ""}`}>{delayed}</div>
        <div className="context">past expected date</div>
      </div>
      <div className="tile">
        <div className="label">Total value</div>
        <div className="value">{compactCurrency(totalValue, currency)}</div>
        <div className="context">sum of open lines</div>
      </div>
    </div>
  );
}
