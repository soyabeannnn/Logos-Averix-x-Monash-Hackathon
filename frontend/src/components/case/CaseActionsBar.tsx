"use client";

import { Button, DownloadLink } from "@/components/ui/Button";
import { api } from "@/lib/api";

interface CaseActionsBarProps {
  id: string;
  resolved: boolean;
  sourceOpen: boolean;
  escalating: boolean;
  onToggleSource: () => void;
  onToggleEscalate: () => void;
  onResolve: () => void;
}

/** Comparison-case actions. Once resolved, only viewing the source and exporting remain. */
export function CaseActionsBar({ id, resolved, sourceOpen, escalating, onToggleSource, onToggleEscalate, onResolve }: CaseActionsBarProps) {
  return (
    <div className="mb-[18px] flex flex-wrap gap-2.5">
      {!resolved && (
        <Button onClick={onToggleEscalate} aria-expanded={escalating}>
          Escalate to Team
        </Button>
      )}
      <Button onClick={onToggleSource} aria-expanded={sourceOpen}>
        {sourceOpen ? "Hide Source" : "View Source"}
      </Button>
      {!resolved && (
        <Button variant="solid" onClick={onResolve}>
          Mark Resolved
        </Button>
      )}
      <span className="ml-auto flex gap-2.5">
        <DownloadLink variant="accent" href={api.reportUrl(id, "pdf")}>
          Download PDF
        </DownloadLink>
        <DownloadLink variant="accent" href={api.reportUrl(id, "docx")}>
          Download Word
        </DownloadLink>
      </span>
    </div>
  );
}
