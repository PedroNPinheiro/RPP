import { useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { getParts, getSyncStatus, patchPart } from "./api";
import { AppCtx } from "./AppCtx";
import type { Part, SyncStatus } from "./types";
import { IconChart, IconClock, IconGrid } from "./components/Icons";
import { Activity } from "./pages/Activity";
import { Analytics } from "./pages/Analytics";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";

type Theme = "light" | "dark";
type AuthUser = { email: string; name: string; role: "editor" | "viewer" };

function initialTheme(): Theme {
  const saved = localStorage.getItem("rpp-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/* company logo card: drop the real logo at frontend/public/logo.png;
   falls back to the RP mark if the file isn't there */
function LogoCard() {
  const [hasLogo, setHasLogo] = useState(true);
  return (
    <div className="logo-card">
      {hasLogo ? (
        <img src="/logo.png" alt="CASCO Pet" onError={() => setHasLogo(false)} />
      ) : (
        <div className="logo-fallback">
          <span className="brand-mark">RP</span>
          <span>Replacement Parts</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [parts, setParts] = useState<Part[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [user, setUser] = useState<AuthUser | null | "loading">("loading");

  // gate the app: who am I? if unauthenticated, show the login screen
  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { email: string; name: string; role?: string }) =>
        setUser({ email: d.email, name: d.name, role: d.role === "viewer" ? "viewer" : "editor" }),
      )
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("rpp-theme", theme);
  }, [theme]);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [p, s] = await Promise.all([getParts(), getSyncStatus()]);
      setParts(p);
      setSync(s);
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // keep data fresh without flashing the UI (sync runs every 15 min anyway)
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) load(true);
    }, 120_000);
    return () => clearInterval(id);
  }, [load]);

  const handlePatch = useCallback(async (id: number, fields: Partial<Part>) => {
    try {
      const updated = await patchPart(id, fields);
      setParts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const canEdit = typeof user === "object" && user !== null ? user.role === "editor" : true;
  const ctx = {
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    sync,
    reload: () => load(),
    canEdit,
  };

  if (user === "loading") return <div className="loading">Loading…</div>;
  if (!user) return <Login error={new URLSearchParams(window.location.search).has("auth_error")} />;

  return (
    <AppCtx.Provider value={ctx}>
    <div className="shell">
      <aside className="sidebar">
        <LogoCard />
        <div className="nav-label">Navigation</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? " on" : ""}`}>
          <IconGrid />
          <span>Dashboard</span>
          <span className="nav-chev">›</span>
        </NavLink>
        <NavLink
          to="/analytics"
          className={({ isActive }) => `nav-item${isActive ? " on" : ""}`}
        >
          <IconChart />
          <span>Analytics</span>
          <span className="nav-chev">›</span>
        </NavLink>
        <NavLink
          to="/activity"
          className={({ isActive }) => `nav-item${isActive ? " on" : ""}`}
        >
          <IconClock />
          <span>Activity</span>
          <span className="nav-chev">›</span>
        </NavLink>

        <div className="side-spacer" />

        {user && (
          <div className="user-chip">
            <span className="user-avatar">{initials(user.name)}</span>
            <span className="user-meta">
              <span className="user-name" title={user.email}>
                {user.name}
              </span>
              <span className="user-status">
                {user.role === "viewer" ? (
                  <span className="role-tag">Read-only</span>
                ) : (
                  <>
                    <span className="dot" /> Live · Sage X3
                  </>
                )}
              </span>
            </span>
            <a className="user-signout" href="/auth/logout" title="Sign out">
              ⏻
            </a>
          </div>
        )}
      </aside>

      <div className="main">
        <main className="content">
          {error && <div className="error">⚠ {error}</div>}
          <Routes>
            <Route
              path="/"
              element={<Dashboard parts={parts} loading={loading} onPatch={handlePatch} />}
            />
            <Route path="/analytics" element={<Analytics parts={parts} loading={loading} />} />
            <Route path="/activity" element={<Activity />} />
          </Routes>
        </main>
      </div>
    </div>
    </AppCtx.Provider>
  );
}
