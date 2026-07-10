import { createContext, useContext } from "react";
import type { SyncStatus } from "./types";

export interface AppCtxValue {
  theme: "light" | "dark";
  toggleTheme: () => void;
  sync: SyncStatus | null;
  reload: () => void;
  canEdit: boolean;
}

export const AppCtx = createContext<AppCtxValue>({
  theme: "light",
  toggleTheme: () => {},
  sync: null,
  reload: () => {},
  canEdit: true,
});

export const useApp = () => useContext(AppCtx);
