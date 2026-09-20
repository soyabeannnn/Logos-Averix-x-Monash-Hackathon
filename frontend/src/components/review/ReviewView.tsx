"use client";

import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/Fields";
import { LoadingNote } from "@/components/ui/Loading";
import { useRemote } from "@/hooks/useRemote";
import { api } from "@/lib/api";
import { ReviewCard } from "./ReviewCard";

export function ReviewView() {
  const queue = useRemote(api.reviewQueue, []);

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Needs Review</h1>
      <p className="mb-5 text-muted">Cases the system would not decide on its own. Each shows why and the source evidence.</p>

      <FormError message={queue.error} className="mb-3" />
      {!queue.data && !queue.error && <LoadingNote />}
      {queue.data?.length === 0 && <Card className="text-muted">Nothing needs review.</Card>}
      {queue.data?.map((item) => <ReviewCard key={item.id} item={item} onChanged={queue.reload} />)}
    </>
  );
}
