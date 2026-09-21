import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Neighbors } from "@/lib/neighbors";

interface StepLinkProps {
  id: string | null;
  query: string;
  children: React.ReactNode;
}

function StepLink({ id, query, children }: StepLinkProps) {
  if (!id) {
    return (
      <span aria-disabled="true" className={cn(buttonClasses("outline", "sm"), "cursor-not-allowed opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={`/emails/${encodeURIComponent(id)}${query}`} className={buttonClasses("outline", "sm")}>
      {children}
    </Link>
  );
}

interface CaseNavProps {
  /** Query string of the inbox view the user came from; keeps Back and Previous/Next in that list. */
  query: string;
  neighbors: Neighbors | null;
  /** The case was opened from the Archived list, so Back returns there. */
  archived?: boolean;
}

export function CaseNav({ query, neighbors, archived = false }: CaseNavProps) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
      <Link href={`${archived ? "/archived" : "/"}${query}`} className="font-medium text-link hover:underline">
        {archived ? "← Back to archive" : "← Back to inbox"}
      </Link>
      {neighbors && neighbors.total > 1 && (
        <nav aria-label="Browse cases" className="flex items-center gap-2.5">
          <StepLink id={neighbors.prevId} query={query}>← Previous</StepLink>
          <span className="text-[13px] text-muted">
            {neighbors.position} of {neighbors.total}
          </span>
          <StepLink id={neighbors.nextId} query={query}>Next →</StepLink>
        </nav>
      )}
    </div>
  );
}
