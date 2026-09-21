"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmailTable } from "@/components/inbox/EmailTable";
import { SearchBox } from "@/components/inbox/SearchBox";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/Fields";
import { UnarchiveIcon } from "@/components/ui/Icons";
import { useArchive } from "@/hooks/useArchive";
import { useRemote } from "@/hooks/useRemote";
import { useRowSelection } from "@/hooks/useRowSelection";
import { api } from "@/lib/api";
import { filtersFromParams, filtersToQuery } from "@/lib/filters";

/** Archived emails: hidden from the inbox and review queue, kept with their results and history. */
export function ArchivedView() {
  const router = useRouter();
  const pathname = usePathname();
  const filters = { ...filtersFromParams(useSearchParams()), category: "", status: "", archived: "1" };

  const emails = useRemote(() => api.emails(filters), [filters.q]);
  const rows = emails.data ?? [];
  const { selected, selectedIds, toggle, toggleAll, deselect } = useRowSelection(rows);
  const { unarchive } = useArchive(emails.reload);

  async function unarchiveEmails(ids: readonly string[]) {
    if (await unarchive(ids)) deselect(ids);
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Archived</h1>
      <p className="mb-5 text-muted">
        Archived emails are hidden from the inbox and review queue. Their results and edit history are kept, and you can
        restore them at any time.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={filters.q} onCommit={(q) => router.replace(`${pathname}${filtersToQuery({ q })}`)} />
        {selectedIds.length > 0 && (
          <Button variant="solid" onClick={() => unarchiveEmails(selectedIds)}>
            Unarchive selected ({selectedIds.length})
          </Button>
        )}
      </div>

      <FormError message={emails.error} className="mb-3" />
      <Card flush className="max-h-[calc(100vh-220px)] min-h-[260px] overflow-auto">
        <EmailTable
          rows={rows}
          selected={selected}
          query={filtersToQuery(filters)}
          emptyMessage={
            emails.loading
              ? "Loading..."
              : filters.q
                ? `No archived emails match “${filters.q}”.`
                : "Nothing is archived. Use the archive button on an inbox row to move an email here."
          }
          onToggle={toggle}
          onToggleAll={toggleAll}
          action={{ label: "Unarchive", icon: <UnarchiveIcon />, onClick: (id) => unarchiveEmails([id]) }}
        />
      </Card>
    </>
  );
}
