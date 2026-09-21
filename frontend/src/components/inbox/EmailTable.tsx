import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { CATEGORY_LABELS } from "@/lib/constants";
import { formatConfidence, formatDateTime } from "@/lib/format";
import type { EmailSummary } from "@/lib/types";

const TH = "sticky top-0 z-[1] border-b-2 border-plum bg-lavender-soft px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-muted uppercase";
const TD = "border-b border-line px-3 py-3 align-top";

/** The icon button at the end of each row (archive in the inbox, unarchive in the archive). */
export interface RowAction {
  label: string;
  icon: ReactNode;
  onClick: (id: string) => void;
}

interface EmailTableProps {
  rows: readonly EmailSummary[];
  selected: ReadonlySet<string>;
  /** Query string carried to the detail page so Previous/Next follows this list. */
  query: string;
  emptyMessage: ReactNode;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  action: RowAction;
}

export function EmailTable({ rows, selected, query, emptyMessage, onToggle, onToggleAll, action }: EmailTableProps) {
  if (rows.length === 0) return <p className="p-[18px] text-muted">{emptyMessage}</p>;

  const allSelected = rows.every((row) => selected.has(row.id));

  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th scope="col" className={TH}>
            <input type="checkbox" aria-label="Select all shown emails" checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} />
          </th>
          <th scope="col" className={TH}>#</th>
          <th scope="col" className={TH}>Sender / Subject</th>
          <th scope="col" className={TH}>Category</th>
          <th scope="col" className={TH}>Status</th>
          <th scope="col" className={TH}>Processed</th>
          <th scope="col" className={TH}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id} className="hover:bg-lavender-soft">
            <td className={TD}>
              <input
                type="checkbox"
                aria-label={`Select ${row.id}`}
                checked={selected.has(row.id)}
                onChange={(event) => onToggle(row.id, event.target.checked)}
              />
            </td>
            <td className={`${TD} w-px text-[13px] whitespace-nowrap text-muted tabular-nums`} title={row.id}>
              {index + 1}
            </td>
            <td className={TD}>
              <Link href={`/emails/${encodeURIComponent(row.id)}${query}`} className="font-medium text-inherit no-underline hover:text-link hover:underline">
                {row.subject}
              </Link>
              <div className="text-[13px] text-muted">{row.sender}</div>
            </td>
            <td className={TD}>
              {CATEGORY_LABELS[row.category] ?? row.category}
              {row.confidence !== null && <div className="text-[13px] text-muted">{formatConfidence(row.confidence)} conf.</div>}
            </td>
            <td className={TD}>
              <StatusPill status={row.status} />
            </td>
            <td className={`${TD} text-[13px] text-muted`}>{formatDateTime(row.processed_at)}</td>
            <td className={TD}>
              <div className="grid grid-cols-[4.5rem_2rem] items-center gap-2">
                <Link href={`/emails/${encodeURIComponent(row.id)}${query}`} className="font-medium whitespace-nowrap text-link hover:underline">
                  {row.category === "BL_COMPARISON" ? "View →" : "Source →"}
                </Link>
                <button
                  type="button"
                  onClick={() => action.onClick(row.id)}
                  aria-label={`${action.label} ${row.id}`}
                  title={action.label}
                  className="grid size-8 cursor-pointer place-items-center rounded-[10px] border-2 border-transparent text-muted hover:border-plum hover:bg-lavender hover:text-plum"
                >
                  {action.icon}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
