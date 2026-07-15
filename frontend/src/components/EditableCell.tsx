import { useApp } from "../AppCtx";
import type { Col } from "../columns";
import { fmtDate } from "../format";
import type { Part } from "../types";

/* status → dot color (color always beside the status text, never alone) */
const STATUS_DOT: Record<string, string> = {
  "Por Iniciar": "st-todo",
  "Em Andamento": "st-prog",
  "Pronto para Sair": "st-ready",
  "Enviado/Já Saiu": "st-ship", // retired option; old lines keep it
  "Problema/Falta de Informação": "st-crit",
  Cancelado: "st-cancel",
  Completo: "st-done",
};

interface Props {
  part: Part;
  col: Col;
  onPatch: (id: number, fields: Partial<Part>) => Promise<void>;
}

function statusTone(colKey: string, v: string): string {
  if (colKey === "priority" && v.startsWith("P1")) return " sel-crit";
  if (colKey === "priority" && v.startsWith("P2")) return " sel-warn";
  if (colKey === "status" && v === "Completo") return " sel-good";
  if (colKey === "status" && v.startsWith("Problema")) return " sel-crit";
  if (colKey === "status" && v === "Pronto para Sair") return " sel-ready";
  if (colKey === "status" && v === "Cancelado") return " sel-off";
  if (colKey === "status" && v === "Enviado/Já Saiu") return " sel-info";
  if (colKey === "status" && (v === "Em Andamento" || v === "Em progresso")) return " sel-warn";
  return "";
}

// Inline editor for a team column. Text/date commit on blur (only if changed);
// select and checkbox commit immediately. Renders read-only for viewers.
export function EditableCell({ part, col, onPatch }: Props) {
  const { canEdit } = useApp();
  const value = part[col.key];

  if (col.type === "select") {
    const v = (value ?? "") as string;
    const tone = statusTone(String(col.key), v);
    const dot = col.key === "status" ? STATUS_DOT[v] : undefined;
    const variant = col.key === "priority" ? " pill-priority" : "";

    if (!canEdit) {
      if (!v) return <span className="cell-ro">—</span>;
      return (
        <span className={`pill-select ro${variant}${tone}`} title={v}>
          {dot && <span className={`status-dot ${dot}`} />}
          <span className="pill-ro-text">{v}</span>
        </span>
      );
    }
    return (
      <span className={`pill-select${variant}${tone}${v ? "" : " sel-empty"}`} title={v || undefined}>
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
          {value && !col.options?.includes(String(value)) && (
            <option value={String(value)}>{String(value)}</option>
          )}
        </select>
      </span>
    );
  }

  if (col.type === "bool") {
    if (!canEdit) return <span className="cell-ro">{value ? "Yes" : "—"}</span>;
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onPatch(part.id, { [col.key]: e.target.checked } as Partial<Part>)}
      />
    );
  }

  // text / date
  if (!canEdit) {
    const text = col.type === "date" ? fmtDate(value) : ((value ?? "") as string);
    return <span className="cell-ro">{text || "—"}</span>;
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
