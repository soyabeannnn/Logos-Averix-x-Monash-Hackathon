/** Raw document text or evidence excerpt, in monospace. */
export function EvidenceBlock({ text }: { text: string }) {
  return (
    <pre className="mt-1.5 max-h-[260px] overflow-auto rounded-[10px] border border-line bg-lavender-soft px-3 py-2.5 font-mono text-[13px] break-words whitespace-pre-wrap">
      {text}
    </pre>
  );
}
