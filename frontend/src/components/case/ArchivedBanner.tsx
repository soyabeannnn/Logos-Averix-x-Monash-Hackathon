import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";

interface ArchivedBannerProps {
  archivedAt: string;
  onUnarchive: () => void;
}

/** Shown on an archived case: says where it went and offers the way back. */
export function ArchivedBanner({ archivedAt, onUnarchive }: ArchivedBannerProps) {
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-plum bg-lavender-soft px-4 py-3"
    >
      <span>
        Archived on {formatDateTime(archivedAt)}. It is hidden from the inbox and review queue.
      </span>
      <Button variant="solid" size="sm" onClick={onUnarchive}>
        Unarchive
      </Button>
    </div>
  );
}
