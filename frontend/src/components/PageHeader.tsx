import type { ReactNode } from "react";
import { useApp } from "../AppCtx";
import { SyncBanner } from "./SyncBanner";

interface Props {
  title: string;
  sub?: string;
  extra?: ReactNode; // page-specific controls (e.g. year filter)
}

export function PageHeader({ title, sub, extra }: Props) {
  const { theme, toggleTheme, sync, reload } = useApp();
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      <div className="page-actions">
        {extra}
        <button
          className="btn icon-btn"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <SyncBanner sync={sync} onRefresh={reload} />
      </div>
    </div>
  );
}
