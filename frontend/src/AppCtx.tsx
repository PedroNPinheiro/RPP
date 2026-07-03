import { createContext, useContext } from "react";
import type { SyncStatus } from "./types";

export interface AppCtxValue {
  theme: "light" | "dark";
  toggleTheme: () => void;
  sync: SyncStatus | null;
  reload: () => void;
}

export const AppCtx = createContext<AppCtxValue>({
  theme: "light",
  toggleTheme: () => {},
  sync: null,
  reload: () => {},
});

export const useApp = () => useContext(AppCtx);
