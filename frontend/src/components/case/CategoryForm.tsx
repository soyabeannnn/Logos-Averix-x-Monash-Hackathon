"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, SelectField, TextField } from "@/components/ui/Fields";
import { ASSIGNABLE_CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";
import type { Category } from "@/lib/types";

interface CategoryFormProps {
  current: Category;
  /** Resolves to an error message, or null when saved. */
  onSubmit: (category: Category, reason: string) => Promise<string | null>;
  onCancel: () => void;
}

export function CategoryForm({ current, onSubmit, onCancel }: CategoryFormProps) {
  const options = ASSIGNABLE_CATEGORIES.filter((category) => category !== current);
  const [category, setCategory] = useState<Category>(options[0]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return setError("A short reason is required.");
    setSaving(true);
    setError(await onSubmit(category, reason.trim()));
    setSaving(false);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 grid gap-2 border-t border-line pt-3 md:grid-cols-[200px_1fr_auto_auto] md:items-end">
      <SelectField label="New category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {CATEGORY_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <TextField label="Reason for correction (required)" value={reason} onChange={(event) => setReason(event.target.value)} />
      <Button type="submit" variant="solid" disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
      <Button onClick={onCancel}>Cancel</Button>
      <p className="text-[13px] text-muted md:col-span-4">
        Changing to or from Comparison re-runs or discards the SI/BL comparison for this email.
      </p>
      <FormError message={error} className="md:col-span-4" />
    </form>
  );
}
