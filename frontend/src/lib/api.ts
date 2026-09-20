import { filtersToQuery, type EmailFilters } from "./filters";
import type {
  Category,
  DocType,
  EmailDetail,
  EmailSummary,
  FieldName,
  ProcessStatus,
  ReportFormat,
  ReviewItem,
  SourceText,
  Stats,
} from "./types";

/** All backend calls go through Next.js's `/api` rewrite (see next.config.ts). */
const BASE = "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function detailMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "detail" in body) {
    const { detail } = body as { detail: unknown };
    return typeof detail === "string" ? detail : JSON.stringify(detail);
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store", ...init });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(detailMessage(body) ?? response.statusText, response.status);
  }
  return body as T;
}

function post<T>(path: string, payload: unknown = {}): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const emailPath = (id: string) => `/emails/${encodeURIComponent(id)}`;

export const api = {
  stats: () => request<Stats>("/stats"),
  emails: (filters: Partial<EmailFilters> = {}) =>
    request<EmailSummary[]>(`/emails${filtersToQuery(filters)}`),
  email: (id: string) => request<EmailDetail>(emailPath(id)),
  source: (id: string) => request<SourceText>(`${emailPath(id)}/source`),
  reviewQueue: () => request<ReviewItem[]>("/review-queue"),

  processStatus: () => request<ProcessStatus>("/process/status"),
  startRun: () => post<ProcessStatus>("/process"),
  cancelRun: () => post<ProcessStatus>("/process/cancel"),

  editField: (id: string, edit: { doc: DocType; field: FieldName; new_value: string; editor: string; reason: string }) =>
    post<EmailDetail>(`${emailPath(id)}/edit`, edit),
  changeCategory: (id: string, change: { category: Category; editor: string; reason: string }) =>
    post<EmailDetail>(`${emailPath(id)}/category`, change),
  escalate: (id: string, editor: string, note: string) =>
    post<EmailDetail>(`${emailPath(id)}/escalate`, { editor, note }),
  resolve: (id: string, editor: string) => post<EmailDetail>(`${emailPath(id)}/resolve`, { editor }),
  deleteEmails: (ids: readonly string[]) => post<{ deleted: number }>("/emails/batch-delete", { ids }),

  /** A URL (not a fetch) so the browser handles the file download. */
  reportUrl: (id: string, format: ReportFormat) => `${BASE}${emailPath(id)}/report?format=${format}`,
};
