// The header's Pokémon search: type a name (French or English, accents and case don't count), pick one,
// land on its Pokémon page. "/" opens it from anywhere outside a text field.
import { Popover, PopoverContent, PopoverTrigger } from "@pkmnteambuilder/ui/components/popover";
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FORM_ARTWORK_IDS } from "@/data/form-artwork-ids";
import { artwork } from "@/lib/artwork";
import { fold, useI18n, useNames } from "@/lib/i18n";
import { formatGen, formatInfo, GENS } from "@/lib/legality";

const MAX_RESULTS = 8;

interface Entry {
  name: string; // @pkmn/dex name
  id: number; // PokeAPI id: artwork and localised name
  gens: number[]; // generations (4 to 9) where it's playable, newest first
}

// Every species and playable forme, with the generations it exists in. Loaded on first open.
async function loadSpecies(): Promise<Entry[]> {
  const { Dex } = await import("@pkmn/dex");
  const dexes = GENS.map((gen) => [gen, Dex.forGen(gen)] as const);
  return Dex.species
    .all()
    .filter(
      (s) =>
        s.exists &&
        s.num > 0 &&
        !s.battleOnly &&
        !["Gmax", "Totem"].some((f) => s.forme.includes(f)) &&
        (!s.isNonstandard || s.isNonstandard === "Past"),
    )
    .map((s) => ({
      name: s.name,
      id: FORM_ARTWORK_IDS[s.name] ?? s.num,
      gens: dexes
        .filter(([, dex]) => {
          const sp = dex.species.get(s.name);
          return sp.exists && !sp.isNonstandard;
        })
        .map(([gen]) => gen),
    }))
    .filter((e) => e.gens.length > 0);
}

export function PokemonSearch() {
  const { t } = useI18n();
  const names = useNames();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // On a Pokémon page, the next one opens in the same format when it can.
  const currentFormat = useRouterState({
    select: (s) => {
      const match = s.matches.find((m) => m.routeId === "/pokemon/$species");
      return (match?.search as { format?: string } | undefined)?.format;
    },
  });
  const species = useQuery({
    queryKey: ["search-species"],
    queryFn: loadSpecies,
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  });

  // "/" anywhere but in a field opens the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = fold(query);
    if (!q || !species.data) return [];
    const scored = species.data.flatMap((e) => {
      const local = fold(names.pokemon(e.id, e.name));
      const english = fold(e.name);
      const score =
        local.startsWith(q) || english.startsWith(q)
          ? 0
          : local.includes(q) || english.includes(q)
            ? 1
            : -1;
      return score < 0 ? [] : [{ e, score }];
    });
    return scored
      .sort((a, b) => a.score - b.score || a.e.id - b.e.id)
      .slice(0, MAX_RESULTS)
      .map((r) => r.e);
  }, [query, species.data, names]);

  const go = (entry: Entry) => {
    // Keep the page's format when the species is in its generation; else its newest generation's OU.
    const keep = currentFormat && entry.gens.includes(formatGen(currentFormat));
    const format = keep ? currentFormat : `gen${entry.gens[0]}ou`;
    setOpen(false);
    setQuery("");
    void navigate({
      to: "/pokemon/$species",
      params: { species: entry.name },
      search: { format: formatInfo(format) ? format : "gen9ou" },
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t("search.label")}
            title={`${t("search.label")} (/)`}
            className="flex size-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:text-foreground"
          />
        }
      >
        <SearchIcon size={14} />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="grid w-80 gap-2 rounded-2xl p-2">
        <input
          autoFocus
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="pokemon-search-results"
          aria-activedescendant={results[active] ? `pokemon-search-${active}` : undefined}
          aria-label={t("search.label")}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              go(results[active]);
            }
          }}
          className="h-10 w-full rounded-xl bg-muted/40 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
        />
        {query && (
          <ul id="pokemon-search-results" role="listbox" className="grid gap-0.5">
            {!species.data ? (
              <li className="px-2 py-1.5 text-muted-foreground">{t("common.loading")}</li>
            ) : results.length === 0 ? (
              <li className="px-2 py-1.5 text-muted-foreground">{t("search.empty")}</li>
            ) : (
              results.map((entry, i) => (
                <li
                  key={entry.name}
                  id={`pokemon-search-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerEnter={() => setActive(i)}
                  // Before the input's blur, so the click lands.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(entry)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                    i === active ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  <img
                    src={artwork(entry.id)}
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                    className="size-7 shrink-0 rounded-full bg-muted object-contain"
                  />
                  <span className="truncate">{names.pokemon(entry.id, entry.name)}</span>
                  {/* Formes share a localised name: the English one tells them apart. */}
                  {entry.name.includes("-") && (
                    <span className="ml-auto truncate text-xs text-muted-foreground/70">
                      {entry.name}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
