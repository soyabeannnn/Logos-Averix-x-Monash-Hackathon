"use client";

import { useId } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { FormError } from "@/components/ui/Fields";
import { LoadingNote } from "@/components/ui/Loading";
import { useRemote } from "@/hooks/useRemote";
import { api } from "@/lib/api";
import { EvidenceBlock } from "./EvidenceBlock";

function Part({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <>
      <h3 className="mt-3.5 text-sm font-semibold">{title}</h3>
      <EvidenceBlock text={text} />
    </>
  );
}

/** Raw email body and SI/BL text. Mount it only when opened; it loads on mount. */
export function SourcePanel({ id }: { id: string }) {
  const titleId = useId();
  const { data, error, loading } = useRemote(() => api.source(id), [id]);
  const empty = data && !data.body && !data.si_text && !data.bl_text;

  return (
    <Card aria-labelledby={titleId}>
      <CardTitle id={titleId}>Source</CardTitle>
      <FormError message={error} />
      {loading && !data && <LoadingNote />}
      {data && (
        <>
          <Part title="Email body" text={data.body} />
          <Part title="Shipping Instruction (SI) raw text" text={data.si_text} />
          <Part title="Draft Bill of Lading (BL) raw text" text={data.bl_text} />
          {empty && <p className="text-muted">No source text available.</p>}
        </>
      )}
    </Card>
  );
}
