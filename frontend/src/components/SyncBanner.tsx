import type { SyncStatus } from "../types";

function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

interface Props {
  sync: SyncStatus | null;
  onRefresh: () => void;
}

export function SyncBanner({ sync, onRefresh }: Props) {
  const failed = sync?.ok === false;
  return (
    <div className={`sync-banner ${failed ? "sync-bad" : ""}`}>
      <span className="sync-dot" />
      <span>
        Last sync: <strong>{ago(sync?.started_at)}</strong>
        {sync && (
          <>
            {" "}
            · {sync.rows_upserted} rows{failed ? " · FAILED" : ""}
          </>
        )}
      </span>
      <button className="btn" onClick={onRefresh}>
        Reload
      </button>
    </div>
  );
}
