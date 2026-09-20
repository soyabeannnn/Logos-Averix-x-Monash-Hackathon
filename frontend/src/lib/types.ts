/** Shapes returned by the Logos FastAPI backend. Keep in sync with logos/service.py. */

export type Category =
  | "BL_COMPARISON"
  | "SI_REQUEST"
  | "INVOICE_QUERY"
  | "GENERAL"
  | "SPAM"
  | "UNKNOWN";

export type Status = "OK" | "MISMATCH" | "NEEDS_REVIEW" | "CLASSIFIED";

export type DocType = "SI" | "BL";

export type FieldName =
  | "shipper"
  | "consignee"
  | "notify_party"
  | "port_of_loading"
  | "port_of_discharge"
  | "container_count"
  | "gross_weight_kg";

export type FieldValue = string | number | null;

export interface EmailSummary {
  id: string;
  sender: string;
  subject: string;
  category: Category;
  confidence: number | null;
  status: Status;
  processed_at: string;
  shipment_ref: string | null;
  resolved_by: string | null;
}

export interface Reason {
  code: string;
  message: string;
  evidence: string;
  doc: DocType | null;
  field: FieldName | null;
}

export interface ComparisonRow {
  field: FieldName;
  si: FieldValue;
  bl: FieldValue;
  /** true = match, false = mismatch, null = a side is missing */
  match: boolean | null;
}

export interface EditLogEntry {
  id: number;
  email_id: string;
  doc: DocType | "EMAIL";
  field: FieldName | "category";
  old_value: string | null;
  new_value: string;
  editor: string;
  reason: string;
  timestamp: string;
}

export type Evidence = Partial<Record<FieldName, string>>;

export interface EmailDetail extends EmailSummary {
  body: string;
  attachments: string[];
  rationale: string | null;
  comparison: ComparisonRow[];
  reasons: Reason[];
  escalated_by: string | null;
  resolved_at: string | null;
  si_evidence: Evidence | null;
  bl_evidence: Evidence | null;
  edit_log: EditLogEntry[];
}

export interface ReviewItem extends EmailSummary {
  reasons: Reason[];
  escalated_by: string | null;
}

export interface SourceText {
  id: string;
  subject: string;
  body: string;
  si_text: string | null;
  bl_text: string | null;
}

export interface Stats {
  total: number;
  mismatches: number;
  needs_review: number;
  clean: number;
  by_category: Partial<Record<Category, number>>;
}

export interface ProcessStatus {
  running: boolean;
  cancelled: boolean;
  done: number;
  total: number;
  errors: number;
  started_at: string | null;
  finished_at: string | null;
}

export type ReportFormat = "pdf" | "docx";
