"use client";

import Link from "next/link";
import { useState } from "react";
import { CategoryForm } from "@/components/case/CategoryForm";
import { ReasonList } from "@/components/case/ReasonList";
import { SourcePanel } from "@/components/case/SourcePanel";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCaseActions } from "@/hooks/useCaseActions";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { ReviewItem } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

interface ReviewCardProps {
  item: ReviewItem;
  /** Called after a change so the queue can reload; the card leaves the queue if it is now cleared. */
  onChanged: () => void;
}

export function ReviewCard({ item, onChanged }: ReviewCardProps) {
  const [panel, setPanel] = useState<"category" | "source" | null>(null);
  const { toast } = useToast();
  const actions = useCaseActions(item.id, onChanged);
  const toggle = (next: "category" | "source") => setPanel((current) => (current === next ? null : next));

  async function resolve() {
    const failure = await actions.resolve();
    if (failure) toast(failure);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 md:flex-nowrap">
        <div className="min-w-0 flex-1 break-words">
          <h2 className="text-base font-semibold">
            <Link href={`/emails/${encodeURIComponent(item.id)}`} className="text-inherit no-underline hover:text-link hover:underline">
              {item.subject}
            </Link>
          </h2>
          <div className="text-[13px] text-muted">
            {item.sender} · {CATEGORY_LABELS[item.category] ?? item.category}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-3.5 gap-y-2.5 md:w-auto md:flex-none md:flex-nowrap md:whitespace-nowrap">
          {item.category === "BL_COMPARISON" && (
            <Link href={`/emails/${encodeURIComponent(item.id)}`} className="font-medium text-link hover:underline">
              Open case →
            </Link>
          )}
          <LinkButton onClick={() => toggle("category")} aria-expanded={panel === "category"}>
            Change Category
          </LinkButton>
          <LinkButton onClick={() => toggle("source")} aria-expanded={panel === "source"}>
            View Source
          </LinkButton>
          <Button variant="solid" onClick={resolve}>
            Confirm &amp; Resolve
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <ReasonList reasons={item.reasons} />
      </div>

      {panel === "category" && (
        <CategoryForm current={item.category} onSubmit={actions.changeCategory} onCancel={() => setPanel(null)} />
      )}
      {panel === "source" && (
        <div className="mt-3.5">
          <SourcePanel id={item.id} />
        </div>
      )}
    </Card>
  );
}
