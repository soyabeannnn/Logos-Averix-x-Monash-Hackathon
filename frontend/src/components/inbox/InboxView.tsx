"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/Fields";
import { useProcessRun } from "@/hooks/useProcessRun";
import { useRemote } from "@/hooks/useRemote";
import { api } from "@/lib/api";
import { errorText } from "@/lib/format";
import { filtersFromParams, filtersToQuery, type EmailFilters } from "@/lib/filters";
import { useStats } from "@/providers/StatsProvider";
import { useToast } from "@/providers/ToastProvider";
import { CategoryPills } from "./CategoryPills";
import { EmailTable } from "./EmailTable";
import { RunControls } from "./RunControls";
import { SearchBox } from "./SearchBox";
import { StatCards } from "./StatCards";

export function InboxView() {
  const router = useRouter();
  const pathname = usePathname();
  const filters = filtersFromParams(useSearchParams());
  const { toast } = useToast();
  const { stats, refresh: refreshStats } = useStats();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const emails = useRemote(() => api.emails(filters), [filters.category, filters.status, filters.q]);
  const run = useProcessRun(() => {
    emails.reload();
    refreshStats();
  });

  const rows = emails.data ?? [];
  const selectedIds = rows.filter((row) => selected.has(row.id)).map((row) => row.id);
  const hasFilters = Boolean(filters.category || filters.status || filters.q);

  function applyFilters(patch: Partial<EmailFilters>) {
    router.replace(`${pathname}${filtersToQuery({ ...filters, ...patch })}`);
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => (checked ? next.add(row.id) : next.delete(row.id)));
      return next;
    });
  }

  async function deleteEmails(ids: readonly string[], label: string) {
    const them = ids.length === 1 ? "it" : "them";
    const ok = window.confirm(
      `Delete ${label}? This also removes any edit history for ${them}. Running the pipeline again will re-process ${them}.`,
    );
    if (!ok) return;
    try {
      const { deleted } = await api.deleteEmails(ids);
      setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      toast(`Deleted ${deleted} email(s).`);
      emails.reload();
      refreshStats();
    } catch (error) {
      toast(errorText(error));
    }
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
          onDeleteSelected={() => deleteEmails(selectedIds, `${selectedIds.length} selected email(s)`)}
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
            emails.loading
              ? "Loading..."
              : hasFilters
                ? "No emails match this filter."
                : "No emails processed yet. Choose “Run pipeline” to process the inbox."
          }
          onToggle={toggle}
          onToggleAll={toggleAll}
          onDelete={(id) => deleteEmails([id], id)}
        />
      </Card>
    </>
  );
}
