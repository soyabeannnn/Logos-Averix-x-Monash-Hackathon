import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Drop the inner padding, e.g. for edge-to-edge tables (callers add overflow rules). */
  flush?: boolean;
}

export function Card({ flush, className, ...rest }: CardProps) {
  return (
    <section
      className={cn("mb-[18px] rounded-2xl border-2 border-plum bg-white", !flush && "p-[18px]", className)}
      {...rest}
    />
  );
}

export function CardTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-3 text-base font-semibold">
      {children}
    </h2>
  );
}
