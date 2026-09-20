import type { FieldValue } from "./types";

/** Human-readable value; numbers get thousands separators. Callers render null as "missing". */
export function formatValue(value: Exclude<FieldValue, null>): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : value;
}

export function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "";
}

export function formatConfidence(confidence: number | null): string {
  return confidence === null ? "n/a" : `${Math.round(confidence * 100)}%`;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
