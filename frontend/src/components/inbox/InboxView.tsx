"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/Fields";
import { ArchiveIcon } from "@/components/ui/Icons";
import { useArchive } from "@/hooks/useArchive";
import { useProcessRun } from "@/hooks/useProcessRun";
import { useRemote } from "@/hooks/useRemote";
import { useRowSelection } from "@/hooks/useRowSelection";
import { api } from "@/lib/api";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { filtersFromParams, filtersToQuery, type EmailFilters } from "@/lib/filters";
import type { Category, Status } from "@/lib/types";
import { useStats } from "@/providers/StatsProvider";
import { CategoryPills } from "./CategoryPills";
import { EmailTable } from "./EmailTable";
import { RunControls } from "./RunControls";
import { SearchBox } from "./SearchBox";
import { StatCards } from "./StatCards";

/** e.g. "Invoice + Mismatch + “acme”", so an empty result explains which filters combine. */
function describeFilters({ category, status, q }: EmailFilters): string {
  const parts = [
    category && (CATEGORY_LABELS[category as Category] ?? category),
    status && (STATUS_LABELS[status as Status] ?? status),
    q && `“${q}”`,
  ].filter(Boolean);
  return parts.join(" + ");
}

export function InboxView() {
  const router = useRouter();
  const pathname = usePathname();
  // The inbox only ever lists active emails; archived ones live on the Archived page.
  const filters = { ...filtersFromParams(useSearchParams()), archived: "" };
  const { stats, refresh: refreshStats } = useStats();

  const emails = useRemote(() => api.emails(filters), [filters.category, filters.status, filters.q]);
  const run = useProcessRun(() => {
    emails.reload();
    refreshStats();
  });

  const rows = emails.data ?? [];
  const { selected, selectedIds, toggle, toggleAll, deselect } = useRowSelection(rows);
  const { archive } = useArchive(emails.reload);
  const hasFilters = Boolean(filters.category || filters.status || filters.q);

  function applyFilters(patch: Partial<EmailFilters>) {
    router.replace(`${pathname}${filtersToQuery({ ...filters, ...patch })}`);
  }

  async function archiveEmails(ids: readonly string[]) {
    if (await archive(ids)) deselect(ids);
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Inbox</h1>
      <p className="mb-5 text-muted">Shipping operations mail, classified and checked.</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={filters.q} onCommit={(q) => applyFilters({ q })} />
        <RunControls
          status={run.status}
          running={run.running}
          selectedCount={selectedIds.length}
          onStart={run.start}
          onCancel={run.cancel}
          onArchiveSelected={() => archiveEmails(selectedIds)}
        />
      </div>

      <CategoryPills active={filters.category} stats={stats} onSelect={(category) => applyFilters({ category })} />
      <StatCards stats={stats} activeStatus={filters.status} onSelect={(status) => applyFilters({ status })} />

      <FormError message={emails.error} className="mb-3" />
      <Card flush className="max-h-[calc(100vh-220px)] min-h-[260px] overflow-auto">
        <EmailTable
          rows={rows}
          selected={selected}
          query={filtersToQuery(filters)}
          emptyMessage={
            emails.loading ? (
              "Loading..."
            ) : hasFilters ? (
              <>
                No emails match {describeFilters(filters)}.{" "}
                <LinkButton onClick={() => router.replace(pathname)}>Clear filters</LinkButton>
              </>
            ) : (
              "No emails processed yet. Choose “Run pipeline” to process the inbox."
            )
          }
          onToggle={toggle}
          onToggleAll={toggleAll}
          action={{ label: "Archive", icon: <ArchiveIcon />, onClick: (id) => archiveEmails([id]) }}
        />
      </Card>
    </>
  );
}
