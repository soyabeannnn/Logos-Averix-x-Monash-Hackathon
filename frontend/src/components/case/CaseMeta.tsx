"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { CATEGORY_LABELS } from "@/lib/constants";
import { formatConfidence, formatDateTime } from "@/lib/format";
import type { EmailDetail } from "@/lib/types";
import type { CaseActions } from "@/hooks/useCaseActions";
import { CategoryForm } from "./CategoryForm";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 font-medium break-words">{children}</dd>
    </div>
  );
}

interface CaseMetaProps {
  detail: EmailDetail;
  onChangeCategory: CaseActions["changeCategory"];
}

export function CaseMeta({ detail, onChangeCategory }: CaseMetaProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <Item label="From">{detail.sender}</Item>
        <Item label="Processed">{formatDateTime(detail.processed_at)}</Item>
        <Item label="Classification confidence">
          {formatConfidence(detail.confidence)} ({CATEGORY_LABELS[detail.category]})
          <LinkButton onClick={() => setEditing((open) => !open)} aria-expanded={editing} className="mt-0.5 block text-[13px]">
            Wrong? Change
          </LinkButton>
        </Item>
        <Item label="Shipment ref">{detail.shipment_ref ?? "not stated"}</Item>
      </dl>
      {editing && <CategoryForm current={detail.category} onSubmit={onChangeCategory} onCancel={() => setEditing(false)} />}
    </Card>
  );
}
