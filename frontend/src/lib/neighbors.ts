export interface Neighbors {
  /** 1-based position within the list */
  position: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
}

/** Previous/next ids around `id` in an ordered list, or null when `id` is not in the list. */
export function neighbors(ids: readonly string[], id: string): Neighbors | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;
  return {
    position: index + 1,
    total: ids.length,
    prevId: index > 0 ? ids[index - 1] : null,
    nextId: index < ids.length - 1 ? ids[index + 1] : null,
  };
}
