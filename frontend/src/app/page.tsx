import { Suspense } from "react";
import { InboxView } from "@/components/inbox/InboxView";
import { LoadingNote } from "@/components/ui/Loading";

export default function InboxPage() {
  return (
    <Suspense fallback={<LoadingNote />}>
      <InboxView />
    </Suspense>
  );
}
