"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { FIELD_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatValue } from "@/lib/format";
import type { ComparisonRow, DocType, Evidence, FieldValue } from "@/lib/types";
import type { CaseActions } from "@/hooks/useCaseActions";
import { EvidenceBlock } from "./EvidenceBlock";
import { FieldEditForm } from "./FieldEditForm";

const TH = "border-b-2 border-plum bg-lavender-soft px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-muted uppercase";
const TD = "px-3 py-2.5 align-top break-words";

const ROW_STYLES = {
  mismatch: { row: "bg-bad-bg", mark: "text-bad", label: "Mismatch" },
  missing: { row: "bg-warn-bg", mark: "text-warn", label: "Missing" },
  match: { row: "", mark: "text-ok", label: "Match" },
} as const;

const rowKind = (match: boolean | null) => (match === null ? "missing" : match ? "match" : "mismatch");

function Value({ value }: { value: FieldValue }) {
  return value === null ? <span className="text-muted italic">missing</span> : <>{formatValue(value)}</>;
}

interface RowProps {
  row: ComparisonRow;
  siEvidence: string | undefined;
  blEvidence: string | undefined;
  onEdit: CaseActions["editField"];
}

function ComparisonRowView({ row, siEvidence, blEvidence, onEdit }: RowProps) {
  const [panel, setPanel] = useState<"source" | "edit" | null>(null);
  const style = ROW_STYLES[rowKind(row.match)];
  const toggle = (next: "source" | "edit") => setPanel((current) => (current === next ? null : next));
  const noExcerpt = <span className="text-muted italic">No source excerpt recorded</span>;

  return (
    <>
      <tr className={cn("border-b border-line", style.row)}>
        <th scope="row" className={cn(TD, "text-left")}>
          <LinkButton onClick={() => toggle("source")} aria-expanded={panel === "source"} title="Show source excerpt" className="text-plum hover:text-link">
            {FIELD_LABELS[row.field]} <span aria-hidden="true">▾</span>
          </LinkButton>
        </th>
        <td className={TD}>
          <Value value={row.si} />
        </td>
        <td className={TD}>
          <Value value={row.bl} />
        </td>
        <td className={cn(TD, "text-xs font-semibold", style.mark)}>{style.label}</td>
        <td className={TD}>
          <LinkButton onClick={() => toggle("edit")} aria-expanded={panel === "edit"}>
            Edit
          </LinkButton>
        </td>
      </tr>
      {panel === "source" && (
        <tr className="bg-lavender-soft">
          <td colSpan={5} className="px-3 py-2.5">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[13px] text-muted">SI excerpt (as extracted)</div>
                {siEvidence ? <EvidenceBlock text={siEvidence} /> : <div className="mt-1.5">{noExcerpt}</div>}
              </div>
              <div>
                <div className="text-[13px] text-muted">Draft BL excerpt (as extracted)</div>
                {blEvidence ? <EvidenceBlock text={blEvidence} /> : <div className="mt-1.5">{noExcerpt}</div>}
              </div>
            </div>
          </td>
        </tr>
      )}
      {panel === "edit" && (
        <tr className="border-b border-line">
          <td colSpan={5} className="px-3 py-2">
            <FieldEditForm
              row={row}
              onSubmit={(doc: DocType, value, reason) => onEdit(doc, row.field, value, reason)}
              onClose={() => setPanel(null)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

interface ComparisonTableProps {
  rows: readonly ComparisonRow[];
  siEvidence: Evidence | null;
  blEvidence: Evidence | null;
  onEdit: CaseActions["editField"];
}

export function ComparisonTable({ rows, siEvidence, blEvidence, onEdit }: ComparisonTableProps) {
  return (
    <Card flush className="overflow-x-auto" aria-labelledby="comparison-title">
      <div className="px-[18px] pt-[18px]">
        <CardTitle id="comparison-title">Shipping Instruction vs draft Bill of Lading</CardTitle>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className={TH}>Field</th>
            <th scope="col" className={TH}>SI (source of truth)</th>
            <th scope="col" className={TH}>Draft BL</th>
            <th scope="col" className={TH}>Result</th>
            <th scope="col" className={TH}>Edit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ComparisonRowView key={row.field} row={row} siEvidence={siEvidence?.[row.field]} blEvidence={blEvidence?.[row.field]} onEdit={onEdit} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}
