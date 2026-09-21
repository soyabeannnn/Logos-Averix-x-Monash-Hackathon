"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useReviewer } from "@/providers/ReviewerProvider";
import { useStats } from "@/providers/StatsProvider";

const NAV = [
  { href: "/", label: "Inbox", isActive: (path: string) => path === "/" || path.startsWith("/emails") },
  { href: "/review", label: "Needs Review", isActive: (path: string) => path.startsWith("/review") },
  { href: "/archived", label: "Archived", isActive: (path: string) => path.startsWith("/archived") },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { stats } = useStats();
  const { name, setName } = useReviewer();

  return (
    <aside className="sidebar flex w-full flex-none flex-col bg-plum px-4 py-5 text-cream md:sticky md:top-0 md:h-screen md:w-60">
      <div className="mb-7 flex items-center gap-2.5">
        <div
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-[10px] border-2 border-cream bg-lavender text-xl leading-none"
        >
          🪐
        </div>
        <div>
          <div className="text-[17px] leading-tight font-semibold">Logos</div>
          <div className="text-[11px] leading-snug text-lavender">Shipping Document Verification</div>
        </div>
      </div>

      <nav aria-label="Primary">
        {NAV.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mb-1 flex items-center justify-between rounded-full px-3 py-[9px] font-medium",
                active ? "bg-sunshine font-semibold text-plum" : "text-cream hover:bg-white/10",
              )}
            >
              {item.label}
              {item.href === "/review" && stats && stats.needs_review > 0 && (
                <span className="rounded-[10px] bg-bubblegum px-2 text-xs font-semibold text-plum">{stats.needs_review}</span>
              )}
              {item.href === "/archived" && stats && stats.archived > 0 && (
                <span className="rounded-[10px] bg-lavender px-2 text-xs font-semibold text-plum">{stats.archived}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-6">
        <label htmlFor="reviewer" className="text-xs text-lavender">
          Signed in as:
        </label>
        <input
          id="reviewer"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className="w-full rounded-[10px] border-2 border-cream bg-white px-2.5 py-[7px] text-plum"
        />
      </div>
    </aside>
  );
}
