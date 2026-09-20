import type { Reason } from "@/lib/types";
import { EvidenceBlock } from "./EvidenceBlock";

/** Escalation reasons, each with the source evidence that triggered it. */
export function ReasonList({ reasons }: { reasons: readonly Reason[] }) {
  return (
    <ul className="space-y-3">
      {reasons.map((reason, index) => (
        <li key={`${reason.code}-${reason.doc}-${reason.field}-${index}`}>
          <div className="font-medium">{reason.message}</div>
          {reason.evidence && <EvidenceBlock text={reason.evidence} />}
        </li>
      ))}
    </ul>
  );
}
