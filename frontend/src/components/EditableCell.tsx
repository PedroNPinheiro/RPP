import type { Col } from "../columns";
import type { Part } from "../types";

interface Props {
  part: Part;
  col: Col;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
}

// Inline editor for a team column. Text/date commit on blur (only if changed);
// checkbox commits immediately.
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

  return (
    <input
      className="cell-input"
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
