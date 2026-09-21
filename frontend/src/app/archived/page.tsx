import { Suspense } from "react";
import { ArchivedView } from "@/components/archive/ArchivedView";
import { LoadingNote } from "@/components/ui/Loading";

export default function ArchivedPage() {
  return (
    <Suspense fallback={<LoadingNote />}>
      <ArchivedView />
    </Suspense>
  );
}
