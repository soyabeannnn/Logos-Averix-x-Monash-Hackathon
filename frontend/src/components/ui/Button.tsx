import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "solid" | "outline" | "accent";
type ButtonSize = "md" | "sm";

const BASE =
  "inline-block rounded-full border-2 border-plum font-semibold no-underline hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  solid: "bg-tangerine text-white", // main actions
  outline: "bg-sky text-plum", // secondary actions
  accent: "bg-lavender text-plum",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-5 py-2",
  sm: "px-3.5 py-1.5",
};

export function buttonClasses(variant: ButtonVariant = "outline", size: ButtonSize = "md", extra?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...rest} />;
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/** Client-side navigation styled as a button. */
export function ButtonLink({ href, variant, size, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, size)}>
      {children}
    </Link>
  );
}

/** Plain anchor for file downloads, which must bypass client-side routing. */
export function DownloadLink({
  variant,
  size,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <a {...rest} download className={buttonClasses(variant, size)} />;
}

/** A button that looks like a text link, for inline actions. */
export function LinkButton({ className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn("cursor-pointer font-medium text-link hover:underline", className)} {...rest} />;
}
