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
  // fragment, not a wrapper div: the chip and button sit directly in
  // .page-actions so every header control shares the same flex gap
  return (
    <>
      <span className={`sync-chip${failed ? " bad" : ""}`}>
        <span className="dot" />
        {failed ? (
          <>⚠ last sync failed</>
        ) : (
          <>
            Synced <strong>{ago(sync?.started_at)}</strong>
          </>
        )}
      </span>
      <button className="btn pill" onClick={onRefresh}>
        Reload
      </button>
    </>
  );
}
