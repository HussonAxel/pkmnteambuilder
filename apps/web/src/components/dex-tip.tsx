// What an item, ability or move does, on hover, tap or keyboard focus (a popover: tooltips ignore touch).
// Descriptions come from @pkmn/dex for the team's generation, or in French from the games' own texts
// (scripts/build-descriptions.mjs), loaded on first open.
import { Popover, PopoverContent, PopoverTrigger } from "@pkmnteambuilder/ui/components/popover";
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { loadDex } from "@/components/data-colors";
import type { MessageKey } from "@/i18n/messages";
import { type Lang, toIdentifier, useI18n, useNames } from "@/lib/i18n";

type Kind = "item" | "ability" | "move";

const KIND_TABLE = { item: "items", ability: "abilities", move: "moves" } as const;

// The in-game French text, when there is one; English from @pkmn/dex otherwise.
export async function frenchDescription(lang: Lang, kind: Kind, name: string) {
  if (lang !== "fr") return undefined;
  const texts = (await import("@/data/descriptions/fr.json")).default as Record<
    (typeof KIND_TABLE)[Kind],
    Record<string, string>
  >;
  const table = texts[KIND_TABLE[kind]];
  return table[toIdentifier(name)] ?? table[toIdentifier(name.replace(/\s*\(.*\)$/, ""))];
}

interface Description {
  desc: string;
  move?: { type: string; category: string; power?: number; accuracy?: number };
}

async function describe(
  lang: Lang,
  kind: Kind,
  name: string,
  gen: number,
): Promise<Description | null> {
  const [dex, french] = await Promise.all([loadDex(gen), frenchDescription(lang, kind, name)]);
  const entry =
    kind === "item"
      ? dex.items.get(name)
      : kind === "ability"
        ? dex.abilities.get(name)
        : dex.moves.get(name);
  if (!entry.exists) return null;
  const desc = french ?? (entry.shortDesc || entry.desc);
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
  const { t, lang } = useI18n();
  const names = useNames();
  const [open, setOpen] = useState(false);
  const info = useQuery({
    queryKey: ["dex-desc", lang, kind, name, gen],
    queryFn: () => describe(lang, kind, name, gen),
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const title =
    kind === "item"
      ? names.item(name)
      : kind === "ability"
        ? names.ability(name)
        : names.move(name);
  const move = info.data?.move;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        openOnHover
        delay={200}
        nativeButton={false}
        // Focusable so keyboard users get the description too; a dotted underline says it has one.
        render={
          <span
            tabIndex={0}
            // A tap opens the description without also triggering the row or card around it.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className={cn(
              "cursor-help rounded-sm underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none focus-visible:ring-1 focus-visible:ring-ring",
              className,
            )}
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="grid w-72 gap-1 font-normal">
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
      </PopoverContent>
    </Popover>
  );
}
