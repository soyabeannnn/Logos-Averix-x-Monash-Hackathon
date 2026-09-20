"use client";

import { useEffect, useRef, useState } from "react";
import { errorText } from "@/lib/format";

export interface Remote<T> {
  /** Last successfully loaded data. Kept while a reload is in flight to avoid flicker. */
  data: T | undefined;
  error: string | null;
  /** True until the request for the current `deps` has settled. */
  loading: boolean;
  reload: () => void;
}

interface Settled<T> {
  key: string;
  data?: T;
  error?: string;
}

/**
 * Load remote data whenever `deps` change (compared by value) or `reload()` is called.
 * Out-of-order responses are ignored, so a slow old request can never overwrite a newer one.
 */
export function useRemote<T>(fetcher: () => Promise<T>, deps: readonly unknown[]): Remote<T> {
  const [reloads, setReloads] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>();
  const latestFetcher = useRef(fetcher);
  const key = `${JSON.stringify(deps)}#${reloads}`;

  useEffect(() => {
    latestFetcher.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    latestFetcher
      .current()
      .then((data) => !cancelled && setSettled({ key, data }))
      .catch((error: unknown) => !cancelled && setSettled((prev) => ({ key, data: prev?.data, error: errorText(error) })));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const current = settled?.key === key;
  return {
    data: settled?.data,
    error: current ? (settled?.error ?? null) : null,
    loading: !current,
    reload: () => setReloads((count) => count + 1),
  };
}
