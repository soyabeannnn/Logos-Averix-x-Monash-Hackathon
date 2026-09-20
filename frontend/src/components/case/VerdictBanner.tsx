import { CATEGORY_LABELS, FIELD_ORDER } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { EmailDetail } from "@/lib/types";
import { STATUS_STYLES } from "@/components/ui/StatusPill";

function headline(detail: EmailDetail): { lead: string; rest: string } {
  const mismatches = detail.comparison.filter((row) => row.match === false).length;
  if (detail.category !== "BL_COMPARISON" && detail.status !== "NEEDS_REVIEW") {
    return { lead: `${CATEGORY_LABELS[detail.category]}.`, rest: "No document comparison is needed for this email." };
  }
  if (detail.status === "NEEDS_REVIEW") {
    return {
      lead: "Needs review.",
      rest: `${detail.reasons.length} open escalation(s); this case cannot be trusted until a reviewer confirms it.`,
    };
  }
  if (detail.status === "MISMATCH") {
    return { lead: "Mismatch.", rest: `${mismatches} of ${FIELD_ORDER.length} fields differ between the SI and the draft BL.` };
  }
  return { lead: "Matched.", rest: `All ${FIELD_ORDER.length} fields agree between the SI and the draft BL.` };
}

export function VerdictBanner({ detail }: { detail: EmailDetail }) {
  const { lead, rest } = headline(detail);
  return (
    <div role="status" className={cn("mb-[18px] rounded-2xl border-2 border-plum px-[18px] py-3.5 font-medium", STATUS_STYLES[detail.status])}>
      <strong className="font-semibold">{lead}</strong> {rest}
      {detail.resolved_by && ` Resolved by ${detail.resolved_by} on ${formatDateTime(detail.resolved_at)}.`}
    </div>
  );
}
