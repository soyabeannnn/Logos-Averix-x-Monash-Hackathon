"use client";

import { Button } from "@/components/ui/Button";
import type { ProcessStatus } from "@/lib/types";

interface RunControlsProps {
  status: ProcessStatus | undefined;
  running: boolean;
  selectedCount: number;
  onStart: () => void;
  onCancel: () => void;
  onArchiveSelected: () => void;
}

/** Run / Cancel the pipeline and batch-archive the ticked rows. Buttons appear only when applicable. */
export function RunControls({ status, running, selectedCount, onStart, onCancel, onArchiveSelected }: RunControlsProps) {
  return (
    <>
      <Button variant="solid" onClick={onStart} disabled={running}>
        Run pipeline
      </Button>
      {running && <Button onClick={onCancel}>Cancel</Button>}
      {selectedCount > 0 && <Button onClick={onArchiveSelected}>Archive selected ({selectedCount})</Button>}
      <span role="status" className="text-muted">
        {running && status ? `Processing ${status.done} / ${status.total}...` : ""}
      </span>
    </>
  );
}
