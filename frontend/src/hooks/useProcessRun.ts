"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import { errorText } from "@/lib/format";
import type { ProcessStatus } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

/**
 * Drives the pipeline run: start, cancel, and polling while it is running.
 * `onProgress` fires on each poll during a run and once more when it ends, so lists can refresh.
 * A pop-up reports the outcome only for a run that was observed finishing.
 */
export function useProcessRun(onProgress: () => void) {
  const { toast } = useToast();
  const [status, setStatus] = useState<ProcessStatus>();
  const wasRunning = useRef(false);
  const progressRef = useRef(onProgress);

  useEffect(() => {
    progressRef.current = onProgress;
  });

  const applyStatus = useCallback(
    (next: ProcessStatus) => {
      if (wasRunning.current && !next.running) {
        const errors = next.errors ? `, ${next.errors} error(s)` : "";
        toast(`Run ${next.cancelled ? "cancelled" : "finished"}: ${next.done} of ${next.total} processed${errors}.`);
      }
      if (next.running || wasRunning.current) progressRef.current();
      wasRunning.current = next.running;
      setStatus(next);
    },
    [toast],
  );

  /** On failure keep the last known status; the next poll retries. */
  const refresh = useCallback(() => api.processStatus().then(applyStatus, () => undefined), [applyStatus]);

  useEffect(() => {
    let cancelled = false;
    api.processStatus().then(
      (initial) => !cancelled && applyStatus(initial),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [applyStatus]);

  const running = status?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [running, refresh]);

  const start = useCallback(async () => {
    try {
      setStatus(await api.startRun());
      wasRunning.current = true;
    } catch (error) {
      toast(errorText(error));
    }
  }, [toast]);

  const cancel = useCallback(async () => {
    try {
      await api.cancelRun();
      toast("Cancelling after in-flight emails finish...");
    } catch (error) {
      toast(errorText(error));
    }
    void refresh();
  }, [toast, refresh]);

  return { status, running, start, cancel };
}
