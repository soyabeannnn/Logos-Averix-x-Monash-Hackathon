"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

const STORAGE_KEY = "logos.reviewer";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return ""; // storage can be blocked (private windows, previews)
  }
}

function writeName(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* keep working without persistence */
  }
  listeners.forEach((listener) => listener());
}

interface ReviewerApi {
  /** The signed-in reviewer's name (stands in for real authentication). */
  name: string;
  setName: (name: string) => void;
}

const ReviewerContext = createContext<ReviewerApi | null>(null);

export function ReviewerProvider({ children }: { children: ReactNode }) {
  // useSyncExternalStore keeps server and first client render identical ("") and avoids a hydration mismatch.
  const name = useSyncExternalStore(subscribe, readName, () => "");
  const setName = useCallback((next: string) => writeName(next), []);
  const value = useMemo(() => ({ name, setName }), [name, setName]);
  return <ReviewerContext.Provider value={value}>{children}</ReviewerContext.Provider>;
}

export function useReviewer(): ReviewerApi {
  const context = useContext(ReviewerContext);
  if (!context) throw new Error("useReviewer must be used inside <ReviewerProvider>");
  return context;
}
