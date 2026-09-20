"use client";

import { Button } from "@/components/ui/Button";
import type { ProcessStatus } from "@/lib/types";

interface RunControlsProps {
  status: ProcessStatus | undefined;
  running: boolean;
  selectedCount: number;
  onStart: () => void;
  onCancel: () => void;
  onDeleteSelected: () => void;
}

/** Run / Cancel the pipeline and batch-delete the ticked rows. Buttons appear only when applicable. */
export function RunControls({ status, running, selectedCount, onStart, onCancel, onDeleteSelected }: RunControlsProps) {
  return (
    <>
      <Button variant="solid" onClick={onStart} disabled={running}>
        Run pipeline
      </Button>
      {running && <Button onClick={onCancel}>Cancel</Button>}
      {selectedCount > 0 && <Button onClick={onDeleteSelected}>Delete selected ({selectedCount})</Button>}
      <span role="status" className="text-muted">
        {running && status ? `Processing ${status.done} / ${status.total}...` : ""}
      </span>
    </>
  );
}
