import { cn } from "@/lib/cn";
import type { Stats } from "@/lib/types";

interface Card {
  status: string;
  label: string;
  value: (stats: Stats) => number;
  fill: string;
}

const CARDS: readonly Card[] = [
  { status: "", label: "Total Processed", value: (s) => s.total, fill: "bg-lavender" },
  { status: "MISMATCH", label: "Mismatches Found", value: (s) => s.mismatches, fill: "bg-bubblegum" },
  { status: "NEEDS_REVIEW", label: "Needs Review", value: (s) => s.needs_review, fill: "bg-sunshine" },
  { status: "OK", label: "Clean Matches", value: (s) => s.clean, fill: "bg-mint" },
];

interface StatCardsProps {
  stats: Stats | undefined;
  activeStatus: string;
  onSelect: (status: string) => void;
}

/** Count cards that double as status filters. */
export function StatCards({ stats, activeStatus, onSelect }: StatCardsProps) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
      {CARDS.map((card) => {
        const pressed = activeStatus === card.status;
        return (
          <button
            key={card.label}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(card.status)}
            className={cn(
              "cursor-pointer rounded-2xl border-2 border-plum px-4 py-3.5 text-left hover:brightness-95",
              pressed ? "bg-plum text-cream" : `${card.fill} text-plum`,
            )}
          >
            <div className={cn("text-[28px] leading-tight font-semibold", pressed && "text-sunshine")}>
              {stats ? card.value(stats) : "-"}
            </div>
            <div className="text-[13px]">{card.label}</div>
          </button>
        );
      })}
    </div>
  );
}
