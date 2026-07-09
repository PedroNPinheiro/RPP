import type { Col } from "../columns";
import type { Part } from "../types";

/* status → dot color (color always beside the status text, never alone) */
const STATUS_DOT: Record<string, string> = {
  "Por Iniciar": "st-todo",
  "Em Andamento": "st-prog",
  "Pronto para Sair": "st-pend",
  "Enviado/Já Saiu": "st-ship",
  "Problema/Falta de Informação": "st-crit",
  "Completo": "st-done",
  // legacy values
  "Por começar": "st-todo",
  "Em progresso": "st-prog",
  "Pendente": "st-pend",
};

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
    const v = (value ?? "") as string;
    // meaningful color on high-signal values (paired with the text itself)
    let tone = "";
    if (col.key === "priority" && v.startsWith("P1")) tone = " sel-crit";
    else if (col.key === "priority" && v.startsWith("P2")) tone = " sel-warn";
    else if (col.key === "status" && v === "Completo") tone = " sel-good";
    else if (col.key === "status" && v.startsWith("Problema")) tone = " sel-crit";
    else if (col.key === "status" && v === "Enviado/Já Saiu") tone = " sel-info";
    else if (col.key === "status" && (v === "Em Andamento" || v === "Em progresso")) tone = " sel-info";
    const dot = col.key === "status" ? STATUS_DOT[v] : undefined;
    return (
      <span className={`pill-select${tone}${v ? "" : " sel-empty"}`}>
        {dot && <span className={`status-dot ${dot}`} />}
        <select
          className="pill-select-input"
          value={v}
          onChange={(e) => {
            const next = e.target.value === "" ? null : e.target.value;
            onPatch(part.id, { [col.key]: next } as Partial<Part>);
          }}
        >
          <option value=""> </option>
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
      </span>
    );
  }

  const emptyDate = col.type === "date" && !value;
  return (
    <input
      className={`cell-input${emptyDate ? " empty-date" : ""}`}
      type={col.type === "date" ? "date" : "text"}
      defaultValue={(value ?? "") as string}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
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
