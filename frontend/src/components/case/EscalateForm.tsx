"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Fields";

interface EscalateFormProps {
  onSubmit: (note: string) => Promise<string | null>;
  onCancel: () => void;
}

export function EscalateForm({ onSubmit, onCancel }: EscalateFormProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(await onSubmit(note.trim()));
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="mb-[18px] grid gap-2 rounded-2xl border-2 border-plum bg-white p-3.5 md:grid-cols-[1fr_auto_auto] md:items-end">
      <TextField label="Note for the team (optional)" value={note} onChange={(event) => setNote(event.target.value)} autoFocus />
      <Button type="submit" disabled={saving}>
        {saving ? "Escalating..." : "Escalate"}
      </Button>
      <Button onClick={onCancel}>Cancel</Button>
      <FormError message={error} className="md:col-span-3" />
    </form>
  );
}
