"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useRemote } from "@/hooks/useRemote";
import { api } from "@/lib/api";
import type { Stats } from "@/lib/types";

interface StatsApi {
  stats: Stats | undefined;
  /** Call after anything that can change counts (run, edit, resolve, archive, category change). */
  refresh: () => void;
}

const StatsContext = createContext<StatsApi | null>(null);

export function StatsProvider({ children }: { children: ReactNode }) {
  const remote = useRemote(api.stats, []);
  const { data: stats, reload } = remote;
  const value = useMemo(() => ({ stats, refresh: reload }), [stats, reload]);
  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>;
}

export function useStats(): StatsApi {
  const context = useContext(StatsContext);
  if (!context) throw new Error("useStats must be used inside <StatsProvider>");
  return context;
}
