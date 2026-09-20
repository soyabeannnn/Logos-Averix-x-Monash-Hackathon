import { Card, CardTitle } from "@/components/ui/Card";
import { CATEGORY_LABELS, FIELD_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { Category, EditLogEntry } from "@/lib/types";

function describe(entry: EditLogEntry) {
  if (entry.field === "category") {
    const label = (value: string | null) => CATEGORY_LABELS[value as Category] ?? value ?? "missing";
    return { title: "Category", from: label(entry.old_value), to: label(entry.new_value) };
  }
  return {
    title: `${FIELD_LABELS[entry.field]} (${entry.doc})`,
    from: entry.old_value ?? "missing",
    to: entry.new_value,
  };
}

/** Audit trail of every reviewer correction, newest first. */
export function EditHistory({ log }: { log: readonly EditLogEntry[] }) {
  return (
    <Card aria-labelledby="history-title">
      <CardTitle id="history-title">Edit history</CardTitle>
      {log.length === 0 ? (
        <p className="text-muted">No edits recorded for this case</p>
      ) : (
        <ul>
          {log.map((entry) => {
            const { title, from, to } = describe(entry);
            return (
              <li key={entry.id} className="border-b border-line py-2.5 last:border-b-0">
                <strong>{title}</strong>: <span className="font-mono text-[13px]">{from}</span> →{" "}
                <span className="font-mono text-[13px]">{to}</span>
                <br />
                <span className="text-[13px] text-muted">
                  {entry.editor} · {formatDateTime(entry.timestamp)} · Reason: {entry.reason}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
