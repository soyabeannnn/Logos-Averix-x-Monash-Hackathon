/** Inbox filters live in the URL so views are shareable and survive navigation. */

export interface EmailFilters {
  category: string;
  status: string;
  q: string;
}

export const EMPTY_FILTERS: EmailFilters = { category: "", status: "", q: "" };

interface ParamReader {
  get(name: string): string | null;
}

export function filtersFromParams(params: ParamReader): EmailFilters {
  return {
    category: params.get("category") ?? "",
    status: params.get("status") ?? "",
    q: params.get("q") ?? "",
  };
}

/** Returns "?category=..&status=.." with empty values omitted, or "" when nothing is set. */
export function filtersToQuery(filters: Partial<EmailFilters>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
