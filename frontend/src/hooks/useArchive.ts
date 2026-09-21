"use client";

import { api } from "@/lib/api";
import { errorText } from "@/lib/format";
import { useStats } from "@/providers/StatsProvider";
import { useToast } from "@/providers/ToastProvider";

/**
 * Archive or unarchive emails, with a toast and a stats refresh.
 * Each action resolves to true on success so the caller can update its own state.
 */
export function useArchive(onChanged: () => void) {
  const { toast } = useToast();
  const { refresh } = useStats();

  async function apply(ids: readonly string[], archive: boolean): Promise<boolean> {
    try {
      const { changed } = await (archive ? api.archiveEmails(ids) : api.unarchiveEmails(ids));
      toast(archive ? `Archived ${changed} email(s). Find them under Archived.` : `Unarchived ${changed} email(s).`);
      onChanged();
      refresh();
      return true;
    } catch (error) {
      toast(errorText(error));
      return false;
    }
  }

  return {
    archive: (ids: readonly string[]) => apply(ids, true),
    unarchive: (ids: readonly string[]) => apply(ids, false),
  };
}
