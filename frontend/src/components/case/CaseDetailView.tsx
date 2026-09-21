"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { LoadingNote } from "@/components/ui/Loading";
import { useArchive } from "@/hooks/useArchive";
import { useCaseActions } from "@/hooks/useCaseActions";
import { useRemote } from "@/hooks/useRemote";
import { api } from "@/lib/api";
import { filtersFromParams, filtersToQuery } from "@/lib/filters";
import { neighbors } from "@/lib/neighbors";
import type { Category } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";
import { ArchivedBanner } from "./ArchivedBanner";
import { CaseActionsBar } from "./CaseActionsBar";
import { CaseMeta } from "./CaseMeta";
import { CaseNav } from "./CaseNav";
import { ComparisonTable } from "./ComparisonTable";
import { EditHistory } from "./EditHistory";
import { EscalateForm } from "./EscalateForm";
import { ReasonList } from "./ReasonList";
import { SourcePanel } from "./SourcePanel";
import { VerdictBanner } from "./VerdictBanner";

export function CaseDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const filters = filtersFromParams(useSearchParams());
  const query = filtersToQuery(filters);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const detail = useRemote(() => api.email(id), [id]);
  const siblings = useRemote(() => api.emails(filters), [filters.category, filters.status, filters.q, filters.archived]);
  const actions = useCaseActions(id, detail.reload);
  const { unarchive } = useArchive(detail.reload);
  const fromArchive = filters.archived === "1";

  /** After a case changes state, drop the inbox filters so it is still visible when the user goes back. */
  const clearFilters = () => router.replace(`/emails/${encodeURIComponent(id)}`);

  async function unarchiveCase() {
    if (await unarchive([id])) clearFilters(); // it now belongs to the inbox list
  }

  async function resolve() {
    const failure = await actions.resolve();
    if (failure) toast(failure);
    else clearFilters();
  }

  async function changeCategory(category: Category, reason: string) {
    const failure = await actions.changeCategory(category, reason);
    if (!failure) clearFilters();
    return failure;
  }

  async function escalate(note: string) {
    const failure = await actions.escalate(note);
    if (!failure) setEscalating(false);
    return failure;
  }

  const data = detail.data;
  if (!data) {
    return detail.error ? (
      <>
        <CaseNav query={query} neighbors={null} archived={fromArchive} />
        <p role="alert" className="text-bad">{detail.error}</p>
        <Link href="/" className="font-medium text-link hover:underline">Return to the inbox</Link>
      </>
    ) : (
      <LoadingNote />
    );
  }

  const isComparison = data.category === "BL_COMPARISON";
  const siblingIds = (siblings.data ?? []).map((email) => email.id);

  return (
    <>
      <CaseNav query={query} neighbors={neighbors(siblingIds, id)} archived={fromArchive} />
      <h1 className="mb-4 text-2xl font-semibold">{data.subject}</h1>
      {data.archived_at && <ArchivedBanner archivedAt={data.archived_at} onUnarchive={unarchiveCase} />}

      <CaseMeta detail={data} onChangeCategory={changeCategory} />
      <VerdictBanner detail={data} />

      {isComparison && (
        <CaseActionsBar
          id={id}
          resolved={Boolean(data.resolved_by)}
          sourceOpen={sourceOpen}
          escalating={escalating}
          onToggleSource={() => setSourceOpen((open) => !open)}
          onToggleEscalate={() => setEscalating((open) => !open)}
          onResolve={resolve}
        />
      )}
      {isComparison && escalating && <EscalateForm onSubmit={escalate} onCancel={() => setEscalating(false)} />}

      {(sourceOpen || !isComparison) && <SourcePanel id={id} />}

      {data.reasons.length > 0 && (
        <Card>
          <CardTitle>Open escalations</CardTitle>
          <ReasonList reasons={data.reasons} />
        </Card>
      )}

      {isComparison && (
        <ComparisonTable rows={data.comparison} siEvidence={data.si_evidence} blEvidence={data.bl_evidence} onEdit={actions.editField} />
      )}

      <EditHistory log={data.edit_log} />
    </>
  );
}
