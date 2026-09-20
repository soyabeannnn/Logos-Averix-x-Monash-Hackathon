import type { Category, FieldName, Status } from "./types";

export const FIELD_ORDER: readonly FieldName[] = [
  "shipper",
  "consignee",
  "notify_party",
  "port_of_loading",
  "port_of_discharge",
  "container_count",
  "gross_weight_kg",
];

export const FIELD_LABELS: Record<FieldName, string> = {
  shipper: "Shipper",
  consignee: "Consignee",
  notify_party: "Notify Party",
  port_of_loading: "Port of Loading",
  port_of_discharge: "Port of Discharge",
  container_count: "Container Count",
  gross_weight_kg: "Gross Weight (kg)",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  BL_COMPARISON: "Comparison",
  SI_REQUEST: "New SI",
  INVOICE_QUERY: "Invoice",
  GENERAL: "General",
  SPAM: "Spam",
  UNKNOWN: "Unclassified",
};

/** Categories a reviewer may assign (UNKNOWN is system-only). */
export const ASSIGNABLE_CATEGORIES: readonly Category[] = [
  "BL_COMPARISON",
  "SI_REQUEST",
  "INVOICE_QUERY",
  "GENERAL",
  "SPAM",
];

export const STATUS_LABELS: Record<Status, string> = {
  OK: "Matched",
  MISMATCH: "Mismatch",
  NEEDS_REVIEW: "Needs Review",
  CLASSIFIED: "Classified",
};

export const NAME_REQUIRED_MESSAGE = "Enter your name under 'Signed in as' first.";
export const POLL_INTERVAL_MS = 2000;
export const SEARCH_DEBOUNCE_MS = 250;
