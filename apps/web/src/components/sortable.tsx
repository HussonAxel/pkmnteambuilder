// Sortable table columns: a click on a header sorts by it, a second click reverses the order. The header
// says which way it sorts (an arrow, and aria-sort for screen readers); the other headers show a faint
// two-way arrow on hover.
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

export type SortDir = "asc" | "desc";

export interface Sort<K extends string> {
  key: K;
  dir: SortDir;
}

// `first`: the direction a column starts in on its first click (numbers usually read best high to low).
export function useSort<K extends string>(
  initial: Sort<K>,
  first: Partial<Record<K, SortDir>> = {},
) {
  const [sort, setSort] = useState<Sort<K>>(initial);
  const toggle = (key: K) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: first[key] ?? "asc" },
    );
  return { sort, setSort, toggle };
}

// Sorts a copy of `rows` by `value` (numbers or strings) in the sort's direction; ties keep their order.
export function sortRows<T>(
  rows: readonly T[],
  dir: SortDir,
  value: (row: T) => number | string,
  locale?: string,
): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: value(row) }))
    .sort((a, b) => {
      const c =
        typeof a.v === "number" && typeof b.v === "number"
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), locale);
      return c * sign || a.i - b.i;
    })
    .map((x) => x.row);
}

// The header cell's content: a button with the column's label and the sort arrow.
export function SortButton<K extends string>({
  column,
  sort,
  onSort,
  align = "left",
  children,
  className,
}: {
  column: K;
  sort: Sort<K>;
  onSort: (key: K) => void;
  align?: "left" | "center" | "right";
  children: ReactNode;
  className?: string;
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "group/sort inline-flex items-center gap-1 rounded-sm font-normal transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        align === "right" && "flex-row-reverse",
        active && "text-foreground",
        className,
      )}
    >
      {children}
      <Icon
        size={11}
        aria-hidden
        className={cn("shrink-0", !active && "opacity-0 group-hover/sort:opacity-50")}
      />
    </button>
  );
}

// aria-sort for the header cell (<th aria-sort={ariaSort(sort, column)}>).
export const ariaSort = <K extends string>(sort: Sort<K>, column: K) =>
  sort.key === column ? (sort.dir === "asc" ? "ascending" : "descending") : undefined;
