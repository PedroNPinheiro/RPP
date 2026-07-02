import { COLUMNS } from "../columns";
import type { Part } from "../types";
import { EditableCell } from "./EditableCell";

interface Props {
  parts: Part[];
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
}

function fmtNumber(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return (Math.round(n * 100) / 100).toString();
}

function displayValue(part: Part, key: keyof Part, type: string): string {
  const v = part[key];
  if (type === "number") return fmtNumber(v);
  return v === null || v === undefined ? "" : String(v);
}

export function PartsTable({ parts, onPatch }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={String(c.key)} className={c.group}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.id} className={Number(p.delay_days) > 0 ? "delayed" : ""}>
              {COLUMNS.map((c) => (
                <td key={String(c.key)} className={c.group}>
                  {c.editable ? (
                    <EditableCell part={p} col={c} onPatch={onPatch} />
                  ) : (
                    displayValue(p, c.key, c.type)
                  )}
                </td>
              ))}
            </tr>
          ))}
          {parts.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="empty">
                No replacement-parts POs yet. Tick the checkbox on a PO in Sage.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
