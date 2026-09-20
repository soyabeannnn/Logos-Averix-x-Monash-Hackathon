"use client";

import { useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { NAME_REQUIRED_MESSAGE } from "@/lib/constants";
import { errorText } from "@/lib/format";
import type { Category, DocType, FieldName } from "@/lib/types";
import { useReviewer } from "@/providers/ReviewerProvider";
import { useStats } from "@/providers/StatsProvider";
import { useToast } from "@/providers/ToastProvider";

/**
 * Reviewer actions on one email. Each returns an error message (or null on success) so the calling
 * form can show it inline. On success it toasts, refreshes the global counts and calls `onChanged`.
 */
export function useCaseActions(id: string, onChanged: () => void) {
  const { name } = useReviewer();
  const { toast } = useToast();
  const { refresh } = useStats();

  const perform = useCallback(
    async (action: (editor: string) => Promise<unknown>, success: string): Promise<string | null> => {
      const editor = name.trim();
      if (!editor) return NAME_REQUIRED_MESSAGE;
      try {
        await action(editor);
        toast(success);
        refresh();
        onChanged();
        return null;
      } catch (error) {
        return errorText(error);
      }
    },
    [name, toast, refresh, onChanged],
  );

  return useMemo(
    () => ({
      editField: (doc: DocType, field: FieldName, value: string, reason: string) =>
        perform((editor) => api.editField(id, { doc, field, new_value: value, editor, reason }), "Correction saved and logged."),
      changeCategory: (category: Category, reason: string) =>
        perform((editor) => api.changeCategory(id, { category, editor, reason }), "Category updated and logged."),
      escalate: (note: string) => perform((editor) => api.escalate(id, editor, note), "Escalated to team."),
      resolve: () => perform((editor) => api.resolve(id, editor), "Case resolved. It is now in the Inbox."),
    }),
    [id, perform],
  );
}

export type CaseActions = ReturnType<typeof useCaseActions>;
