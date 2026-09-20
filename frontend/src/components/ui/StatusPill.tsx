import { STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { Status } from "@/lib/types";

/** Status colours are semantic (not brand colours) so meaning never depends on the palette alone. */
export const STATUS_STYLES: Record<Status, string> = {
  OK: "bg-ok-bg text-ok",
  MISMATCH: "bg-bad-bg text-bad",
  NEEDS_REVIEW: "bg-warn-bg text-warn",
  CLASSIFIED: "bg-other-bg text-other",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
