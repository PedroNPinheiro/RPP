import { useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { getParts, getSyncStatus, patchPart } from "./api";
import type { Part, SyncStatus } from "./types";
import { SyncBanner } from "./components/SyncBanner";
import { Analytics } from "./pages/Analytics";
import { Dashboard } from "./pages/Dashboard";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  const saved = localStorage.getItem("rpp-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [parts, setParts] = useState<Part[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("rpp-theme", theme);
  }, [theme]);

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
    <>
      <nav className="appbar">
        <div className="appbar-inner">
          <div className="brand" title="Live from Sage X3 · syncs every 15 min">
            <span className="brand-mark">RP</span>
            <span className="brand-name">Replacement Parts</span>
          </div>

          <div className="tabs">
            <NavLink to="/" end className={({ isActive }) => `tab${isActive ? " on" : ""}`}>
              Dashboard
            </NavLink>
            <NavLink
              to="/analytics"
              className={({ isActive }) => `tab${isActive ? " on" : ""}`}
            >
              Analytics
            </NavLink>
          </div>

          <div className="header-actions">
            <button
              className="btn icon-btn"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <SyncBanner sync={sync} onRefresh={load} />
          </div>
        </div>
      </nav>

      <main className="app">
        {error && <div className="error">⚠ {error}</div>}
        <Routes>
          <Route path="/" element={<Dashboard parts={parts} loading={loading} onPatch={handlePatch} />} />
          <Route path="/analytics" element={<Analytics parts={parts} loading={loading} />} />
        </Routes>
      </main>
    </>
  );
}
