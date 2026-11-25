// What an item, ability or move does, on hover or keyboard focus. Descriptions come from @pkmn/dex for
// the team's generation (English only: PokeAPI's French texts aren't bundled), loaded on first open.
import { Tooltip, TooltipContent, TooltipTrigger } from "@pkmnteambuilder/ui/components/tooltip";
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { loadDex } from "@/components/data-colors";
import type { MessageKey } from "@/i18n/messages";
import { useI18n, useNames } from "@/lib/i18n";

type Kind = "item" | "ability" | "move";

interface Description {
  desc: string;
  move?: { type: string; category: string; power?: number; accuracy?: number };
}

async function describe(kind: Kind, name: string, gen: number): Promise<Description | null> {
  const dex = await loadDex(gen);
  const entry =
    kind === "item"
      ? dex.items.get(name)
      : kind === "ability"
        ? dex.abilities.get(name)
        : dex.moves.get(name);
  if (!entry.exists) return null;
  const desc = entry.shortDesc || entry.desc;
  if (kind !== "move") return { desc };
  const move = dex.moves.get(name);
  return {
    desc,
    move: {
      type: move.type,
      category: move.category,
      power: move.basePower || undefined,
      accuracy: move.accuracy === true ? undefined : move.accuracy,
    },
  };
}

export function DexTip({
  kind,
  name,
  gen = 9,
  className,
  children,
}: {
  kind: Kind;
  name: string; // English (@pkmn/dex) name
  gen?: number;
  className?: string; // classes of the hover target
  children: ReactNode;
}) {
  const { t } = useI18n();
  const names = useNames();
  const [open, setOpen] = useState(false);
  const info = useQuery({
    queryKey: ["dex-desc", kind, name, gen],
    queryFn: () => describe(kind, name, gen),
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const title =
    kind === "item" ? names.item(name) : kind === "ability" ? names.ability(name) : name;
  const move = info.data?.move;
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        delay={200}
        // Focusable so keyboard users get the description too; a dotted underline says it has one.
        render={
          <span
            tabIndex={0}
            className={cn(
              "cursor-help rounded-sm underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none focus-visible:ring-1 focus-visible:ring-ring",
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        arrow={false}
        sideOffset={6}
        className="grid max-w-72 gap-1 rounded-xl border border-border bg-card p-3 text-left text-xs font-normal leading-snug text-card-foreground ring-0 shadow-none"
      >
        <p className="font-semibold">{title}</p>
        {move && (
          <p className="text-muted-foreground">
            {[
              names.type(move.type),
              t(`tip.${move.category}` as MessageKey),
              move.power && t("tip.power", { value: move.power }),
              move.accuracy && t("tip.accuracy", { value: move.accuracy }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <p className="text-muted-foreground">{info.data?.desc || (info.isPending ? "…" : "—")}</p>
      </TooltipContent>
    </Tooltip>
  );
}
