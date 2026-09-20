export function LoadingNote({ text = "Loading..." }: { text?: string }) {
  return (
    <p role="status" className="py-6 text-muted">
      {text}
    </p>
  );
}
