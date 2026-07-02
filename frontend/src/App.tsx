import { useCallback, useEffect, useState } from "react";
import { getParts, getSyncStatus, patchPart } from "./api";
import type { Part, SyncStatus } from "./types";
import { PartsTable } from "./components/PartsTable";
import { StatTiles } from "./components/StatTiles";
import { SyncBanner } from "./components/SyncBanner";

export default function App() {
  const [parts, setParts] = useState<Part[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [p, s] = await Promise.all([getParts(), getSyncStatus()]);
      setParts(p);
      setSync(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePatch = useCallback(async (id: number, fields: Partial<Part>) => {
    try {
      const updated = await patchPart(id, fields);
      setParts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>Replacement Parts</h1>
          <div className="subtitle">Live from Sage X3 · syncs every 15 min</div>
        </div>
        <SyncBanner sync={sync} onRefresh={load} />
      </header>

      {error && <div className="error">⚠ {error}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <StatTiles parts={parts} />
          <PartsTable parts={parts} onPatch={handlePatch} />
        </>
      )}
    </div>
  );
}
