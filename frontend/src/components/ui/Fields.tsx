import { useId, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const CONTROL = "w-full rounded-[10px] border-2 border-plum bg-white px-2.5 py-[7px] text-plum";
const LABEL = "mb-0.5 block text-xs text-muted";

interface LabelProps {
  label: string;
}

/** Text input that always carries a visible, associated label. */
export function TextField({ label, className, ...rest }: LabelProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} type="text" className={CONTROL} {...rest} />
    </div>
  );
}

export function SelectField({ label, className, children, ...rest }: LabelProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select id={id} className={CONTROL} {...rest}>
        {children}
      </select>
    </div>
  );
}

export function FormError({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-[13px] text-bad", className)}>
      {message}
    </p>
  );
}

export { CONTROL as controlClasses };
