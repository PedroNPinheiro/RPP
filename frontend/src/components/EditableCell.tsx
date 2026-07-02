import type { Col } from "../columns";
import type { Part } from "../types";

interface Props {
  part: Part;
  col: Col;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
}

// Inline editor for a team column. Text/date commit on blur (only if changed);
// select and checkbox commit immediately.
export function EditableCell({ part, col, onPatch }: Props) {
  const value = part[col.key];

  if (col.type === "bool") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) =>
          onPatch(part.id, { [col.key]: e.target.checked } as Partial<Part>)
        }
      />
    );
  }

  if (col.type === "select") {
    return (
      <select
        className="cell-input cell-select"
        value={(value ?? "") as string}
        onChange={(e) => {
          const next = e.target.value === "" ? null : e.target.value;
          onPatch(part.id, { [col.key]: next } as Partial<Part>);
        }}
      >
        <option value="">—</option>
        {col.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {/* keep a legacy value visible even if it's not in the option list */}
        {value && !col.options?.includes(String(value)) && (
          <option value={String(value)}>{String(value)}</option>
        )}
      </select>
    );
  }

  const emptyDate = col.type === "date" && !value;
  return (
    <input
      className={`cell-input${emptyDate ? " empty-date" : ""}`}
      type={col.type === "date" ? "date" : "text"}
      defaultValue={(value ?? "") as string}
      onBlur={(e) => {
        const next = e.target.value === "" ? null : e.target.value;
        const current = (value ?? null) as string | null;
        if (next !== current) {
          onPatch(part.id, { [col.key]: next } as Partial<Part>);
        }
      }}
    />
  );
}
