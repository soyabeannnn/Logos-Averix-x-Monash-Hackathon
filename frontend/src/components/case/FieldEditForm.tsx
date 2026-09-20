"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, SelectField, TextField } from "@/components/ui/Fields";
import { FIELD_LABELS } from "@/lib/constants";
import type { ComparisonRow, DocType } from "@/lib/types";

interface FieldEditFormProps {
  row: ComparisonRow;
  onSubmit: (doc: DocType, value: string, reason: string) => Promise<string | null>;
  onClose: () => void;
}

const currentValue = (row: ComparisonRow, doc: DocType) => String((doc === "SI" ? row.si : row.bl) ?? "");

/** Inline correction of one extracted value on either document. */
export function FieldEditForm({ row, onSubmit, onClose }: FieldEditFormProps) {
  const [doc, setDoc] = useState<DocType>("SI");
  const [value, setValue] = useState(currentValue(row, "SI"));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function changeDoc(next: DocType) {
    setDoc(next);
    setValue(currentValue(row, next));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return setError("A short reason is required.");
    setSaving(true);
    const failure = await onSubmit(doc, value, reason.trim());
    setSaving(false);
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-2 py-1.5 md:grid-cols-[110px_1fr_1.4fr_auto_auto] md:items-end">
      <SelectField label="Document" value={doc} onChange={(event) => changeDoc(event.target.value as DocType)}>
        <option value="SI">SI</option>
        <option value="BL">BL</option>
      </SelectField>
      <TextField label={`New value for ${FIELD_LABELS[row.field]}`} value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
      <TextField label="Reason for correction (required)" value={reason} onChange={(event) => setReason(event.target.value)} />
      <Button type="submit" variant="solid" disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
      <Button onClick={onClose}>Cancel</Button>
      <FormError message={error} className="md:col-span-5" />
    </form>
  );
}
