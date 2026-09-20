import { CATEGORY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { Category, Stats } from "@/lib/types";

const PILL_ORDER: readonly Category[] = ["BL_COMPARISON", "SI_REQUEST", "INVOICE_QUERY", "GENERAL", "SPAM", "UNKNOWN"];

interface CategoryPillsProps {
  active: string;
  stats: Stats | undefined;
  onSelect: (category: string) => void;
}

export function CategoryPills({ active, stats, onSelect }: CategoryPillsProps) {
  const options: Array<{ value: string; label: string; count: number | undefined }> = [
    { value: "", label: "All", count: stats?.total },
    ...PILL_ORDER.map((category) => ({
      value: category,
      label: CATEGORY_LABELS[category],
      count: stats ? (stats.by_category[category] ?? 0) : undefined,
    })),
  ];

  return (
    <div role="group" aria-label="Filter by category" className="mb-4 flex flex-wrap gap-2">
      {options.map(({ value, label, count }) => {
        const pressed = active === value;
        return (
          <button
            key={value || "all"}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(value)}
            className={cn(
              "cursor-pointer rounded-full border-2 border-plum px-3 py-1 text-[13px]",
              pressed ? "bg-sunshine font-semibold" : "bg-white font-medium hover:bg-lavender-soft",
            )}
          >
            {label}{" "}
            <span className={cn("ml-1 rounded-[10px] px-[7px] text-xs font-semibold", pressed ? "bg-plum text-cream" : "bg-lavender text-plum")}>
              {count ?? "-"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
