import { Suspense } from "react";
import { CaseDetailView } from "@/components/case/CaseDetailView";
import { LoadingNote } from "@/components/ui/Loading";

export default async function CasePage(props: PageProps<"/emails/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense fallback={<LoadingNote />}>
      {/* key resets the view's local state (open panels, forms) when stepping between cases */}
      <CaseDetailView key={id} id={id} />
    </Suspense>
  );
}
