"use client";

import type { ReactNode } from "react";
import { ReviewerProvider } from "@/providers/ReviewerProvider";
import { StatsProvider } from "@/providers/StatsProvider";
import { ToastProvider } from "@/providers/ToastProvider";

/** Single place that wires up app-wide client state. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ReviewerProvider>
        <StatsProvider>{children}</StatsProvider>
      </ReviewerProvider>
    </ToastProvider>
  );
}
