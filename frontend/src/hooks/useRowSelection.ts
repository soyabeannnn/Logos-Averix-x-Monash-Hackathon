"use client";

import { useState } from "react";

/** Checkbox selection over a list of rows. Selected ids that are no longer listed are ignored. */
export function useRowSelection(rows: readonly { id: string }[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const selectedIds = rows.filter((row) => selected.has(row.id)).map((row) => row.id);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => (checked ? next.add(row.id) : next.delete(row.id)));
      return next;
    });
  }

  /** Forget these ids, e.g. once they have moved to another list. */
  function deselect(ids: readonly string[]) {
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
  }

  return { selected, selectedIds, toggle, toggleAll, deselect };
}
