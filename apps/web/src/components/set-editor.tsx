// Set editor: start from a recommended set (Smogon analysis or most used build) or from scratch,
// then customise item, ability, Tera type, nature, EVs and moves before adding the Pokémon.
import { Button } from "@pkmnteambuilder/ui/components/button";
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { type QueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon } from "lucide-react";
import { Fragment, useEffect, useId, useState } from "react";

import type { MessageKey } from "@/i18n/messages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { ink, ItemIcon, loadDex, STAT_COLORS, TypeIcon } from "@/components/data-colors";
import { MetaPanel } from "@/components/meta-panel";
import { TYPE_COLORS } from "@/components/type-chip";
import { ShowdownPaste } from "@/components/showdown-paste";
import { useI18n, useNameResolver, useNames } from "@/lib/i18n";
import { formatPercent } from "@/lib/format";
import { learnableMoves, loadLearnData } from "@/lib/learn-data";
import { formatGen } from "@/lib/legality";
import {
  type Build,
  emptyDraft,
  emptyEvs,
  type Evs,
  type Stat,
  EV_TOTAL,
  evTotal,
  coverage,
  fromAnalysis,
  fromUsage,
  type AnalysisSet,
  type Recommendation,
  type SetDraft,
  calcStat,
  setEv,
  setIv,
  checkDraft,
  importSet,
  toShowdown,
  type ImportProblem,
  STATS,
} from "@/lib/sets";

const TERA_TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
  "Stellar",
];

// Smogon analysis sets for a format ("gen6ou"), mirrored with CORS by pkmn. VGC has none.
async function loadAnalysisSets(
  format: string,
): Promise<Record<string, Record<string, AnalysisSet>>> {
  // pkmn's own host: data.pkmn.cc only redirects here, which cost a round trip on every open.
  const res = await fetch(`https://pkmn.github.io/smogon/data/sets/${format}.json`);
  if (!res.ok) return {};
  return res.json();
}

// What every species shares: legal items, natures and the species list. Loaded once per generation.
async function loadCommonChoices(generation: number) {
  const { Dex } = await import("@pkmn/dex");
  const gen = Dex.forGen(generation);
  return {
    items: gen.items
      .all()
      .filter((i) => i.exists && !i.isNonstandard)
      .map((i) => i.name)
      .sort(),
    natures: gen.natures
      .all()
      .map((n) => ({
        name: n.name,
        plus: n.plus as Stat | undefined,
        minus: n.minus as Stat | undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    // Species of this generation (no Mega/Gmax/battle-only formes), for the paste's first line.
    species: gen.species
      .all()
      .filter((s) => s.exists && s.num > 0 && !s.battleOnly && !s.isNonstandard)
      .map((s) => s.name)
      .sort(),
  };
}

// This species' moves in that generation (precomputed by scripts/build-learn.mjs), base stats, abilities.
async function loadSpeciesChoices(species: string, generation: number) {
  const [{ Dex }, learn] = await Promise.all([import("@pkmn/dex"), loadLearnData(generation)]);
  const sp = Dex.forGen(generation).species.get(species);
  return {
    moves: learnableMoves(learn, species).sort(),
    baseStats: sp.baseStats as Evs,
    abilities: [...new Set(Object.values(sp.abilities) as string[])],
    // Gen 5+ only: @pkmn/dex has no "H" slot before hidden abilities existed.
    hiddenAbility: sp.abilities.H as string | undefined,
  };
}

// The usual 252 / 252 / 4 spreads: two maxed stats, the 4 leftover EVs in a third.
const EV_PRESETS: [Stat, Stat, Stat][] = [
  ["atk", "spe", "hp"],
  ["spa", "spe", "hp"],
  ["hp", "atk", "spd"],
  ["hp", "spa", "spd"],
  ["hp", "def", "spd"],
  ["hp", "spd", "def"],
];
const presetEvs = ([a, b, rest]: [Stat, Stat, Stat]): Evs => ({
  ...emptyEvs(),
  [a]: 252,
  [b]: 252,
  [rest]: 4,
});

// The beUI select trigger, restyled like the text fields next to it.
const trigger =
  "h-10 rounded-xl border-transparent bg-muted/40 hover:border-transparent hover:bg-muted/70";

const field =
  "h-10 w-full rounded-xl border-none bg-muted/40 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-ring";

// What the editor loads, shared with the prefetch below so both use the same cache entries.
const formatQueries = (format: string) => {
  const gen = formatGen(format);
  return {
    analysis: queryOptions({
      queryKey: ["analysis-sets", format],
      queryFn: () => loadAnalysisSets(format),
      staleTime: Number.POSITIVE_INFINITY,
    }),
    common: queryOptions({
      queryKey: ["set-choices-common", gen],
      queryFn: () => loadCommonChoices(gen),
      staleTime: Number.POSITIVE_INFINITY,
    }),
  };
};
const speciesQueries = (
  mode: "smogon" | "vgc",
  format: string,
  species: string,
  loadBuild: () => Promise<Build | undefined>,
) => {
  const gen = formatGen(format);
  return {
    build: queryOptions({
      queryKey: ["build", mode, format, species],
      queryFn: async () => (await loadBuild()) ?? null,
      staleTime: Number.POSITIVE_INFINITY,
    }),
    own: queryOptions({
      queryKey: ["set-choices", species, gen],
      queryFn: () => loadSpeciesChoices(species, gen),
      staleTime: Number.POSITIVE_INFINITY,
    }),
  };
};

// Smogon's analysis sets of a format, same cache entry as the editor's: for the Pokémon page.
export const analysisQuery = (format: string) => formatQueries(format).analysis;

// Warm what every species of a format shares (analysis sets, items, natures): when the picker opens.
export function prefetchSetFormat(
  queryClient: QueryClient,
  mode: "smogon" | "vgc",
  format: string,
) {
  const q = formatQueries(format);
  if (mode === "smogon") void queryClient.prefetchQuery(q.analysis);
  void queryClient.prefetchQuery(q.common);
}

// Warm one species' build and moves: on hover or focus, so a click opens the editor ready.
export function prefetchSetSpecies(
  queryClient: QueryClient,
  mode: "smogon" | "vgc",
  format: string,
  species: string,
  loadBuild: () => Promise<Build | undefined>,
) {
  prefetchSetFormat(queryClient, mode, format);
  const q = speciesQueries(mode, format, species, loadBuild);
  void queryClient.prefetchQuery(q.build);
  void queryClient.prefetchQuery(q.own);
}

// The set the editor would open a new species on, without opening it: Smogon's first analysis set,
// else the most used build. undefined when the format has neither (the member starts blank).
export async function defaultDraft(
  queryClient: QueryClient,
  mode: "smogon" | "vgc",
  format: string,
  species: string,
  fallbackAbility: string,
  loadBuild: () => Promise<Build | undefined>,
): Promise<SetDraft | undefined> {
  if (mode === "smogon") {
    // A failed fetch (offline, pkmn down) just falls back to usage.
    const analysis = await queryClient
      .fetchQuery(formatQueries(format).analysis)
      .catch((): Record<string, Record<string, AnalysisSet>> => ({}));
    const [first] = Object.entries(analysis[species] ?? {});
    if (first) return fromAnalysis(first[0], first[1], fallbackAbility).draft;
  }
  const build = await queryClient.fetchQuery(
    speciesQueries(mode, format, species, loadBuild).build,
  );
  return build ? fromUsage(build, fallbackAbility).draft : undefined;
}

export function SetEditor({
  mode,
  format,
  species,
  pokeapiId,
  sprite,
  abilities: abilitiesProp,
  loadBuild,
  initial,
  confirmLabel,
  onBack,
  onConfirm,
}: {
  mode: "smogon" | "vgc";
  format: string;
  species: string; // @pkmn/dex name
  pokeapiId: number;
  sprite: string;
  abilities?: string[]; // defaults to the species' abilities from @pkmn/dex
  loadBuild: () => Promise<Build | undefined>;
  onBack: () => void;
  // Editing a Pokémon already on the team: start from its set, not a recommendation.
  initial?: SetDraft;
  confirmLabel?: string;
  onConfirm: (draft: SetDraft) => void;
}) {
  const { t, lang } = useI18n();
  const names = useNames();
  const ids = useId();
  const gen = formatGen(format);
  // Terastallization only exists in gen 9.
  const teraTypes = gen === 9 ? TERA_TYPES : [];

  const formatQ = formatQueries(format);
  const speciesQ = speciesQueries(mode, format, species, loadBuild);
  const analysis = useQuery({ ...formatQ.analysis, enabled: mode === "smogon" });
  const build = useQuery(speciesQ.build);
  const common = useQuery(formatQ.common);
  const own = useQuery(speciesQ.own);
  const dex = useQuery({
    queryKey: ["dex", gen],
    queryFn: () => loadDex(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const choices = {
    data: common.data && own.data ? { ...common.data, ...own.data } : undefined,
  };
  // Items and moves are typed in the player's language and kept as English (Showdown) names.
  const itemNames = useNameResolver(common.data?.items, names.item);
  const moveNames = useNameResolver(own.data?.moves, names.move);
  const sorted = (options: string[]) => [...options].sort((a, b) => a.localeCompare(b, lang));

  const abilities = abilitiesProp ?? choices.data?.abilities ?? [initial?.ability ?? ""];
  const fallbackAbility = abilities[0] ?? "";
  const recommendations: Recommendation[] = [
    ...Object.entries(analysis.data?.[species] ?? {}).map(([name, set]) =>
      fromAnalysis(name, set, fallbackAbility),
    ),
    ...(build.data ? [fromUsage(build.data, fallbackAbility)] : []),
  ];
  const loading = (mode === "smogon" && analysis.isPending) || build.isPending;

  // Which starting point is loaded: a recommendation's name, "blank", or none yet.
  const [picked, setPicked] = useState<string | null>(initial ? "current" : null);
  const [draft, setDraft] = useState<SetDraft>(() => initial ?? emptyDraft(fallbackAbility));
  // Load the first recommendation once they arrive, unless the player already chose.
  useEffect(() => {
    if (picked === null && !loading && recommendations[0]) {
      setPicked(recommendations[0].name);
      setDraft(recommendations[0].draft);
    }
  }, [loading, picked, recommendations]);

  const pick = (key: string, next: SetDraft) => {
    setPicked(key);
    setDraft(next);
  };
  const update = (patch: Partial<SetDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const total = evTotal(draft.evs);
  const [importing, setImporting] = useState(false);
  const [paste, setPaste] = useState("");
  const [problems, setProblems] = useState<ImportProblem[]>([]);
  const runImport = () => {
    if (!choices.data) return;
    const result = importSet(paste, {
      species,
      abilities,
      moves: choices.data.moves,
      items: choices.data.items,
      natures: choices.data.natures.map((n) => n.name),
      teraTypes,
    });
    if (result.problems) return setProblems(result.problems);
    setProblems([]);
    setImporting(false);
    pick("import", result.draft);
  };
  const [tab, setTab] = useState<"set" | "stats" | "meta">("set");
  // Saving checks the set against the species' legal moves, items, abilities and natures. Once a
  // save was refused, problems update live as the player fixes them.
  const [triedSave, setTriedSave] = useState(false);
  const legal = choices.data && {
    abilities,
    moves: choices.data.moves,
    items: choices.data.items,
    natures: choices.data.natures.map((n) => n.name),
    teraTypes,
  };
  const saveProblems = triedSave && legal ? checkDraft(draft, legal).problems : [];
  const invalid = (field: string) =>
    saveProblems.some((p) => p.field === field) && "ring-1 ring-rose-500";
  const save = () => {
    if (!legal) return;
    const checked = checkDraft(draft, legal);
    if (!checked.problems.length) return onConfirm(checked.draft);
    setTriedSave(true);
    // Show the tab holding the first problem (nature lives in Stats, the rest in Set).
    setTab(checked.problems[0]?.field === "nature" ? "stats" : "set");
  };
  const level = mode === "vgc" ? 50 : 100; // VGC battles are set to level 50, Smogon to 100
  const nature = choices.data?.natures.find((n) => n.name === draft.nature);
  // Natures grouped by the stat they raise (in stat order), then by the one they lower;
  // the neutral ones come last.
  const natureList = choices.data?.natures ?? [
    { name: draft.nature, plus: undefined, minus: undefined },
  ];
  const natureGroups = [...STATS.slice(1), undefined]
    .map((plus) => ({
      plus,
      natures: natureList
        .filter((n) => n.plus === plus)
        .sort(
          (a, b) => (a.minus ? STATS.indexOf(a.minus) : 0) - (b.minus ? STATS.indexOf(b.minus) : 0),
        ),
    }))
    .filter((g) => g.natures.length);
  const label = (r: Recommendation) => (r.name === "usage" ? t("set.usage") : r.name);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("set.back")}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon size={16} />
        </button>
        <img src={sprite} alt="" width={48} height={48} className="size-12 object-contain" />
        <span className="text-base font-semibold tracking-tight text-foreground">
          {names.pokemon(pokeapiId, species)}
        </span>
      </div>

      <section className="grid gap-3">
        <h3 className="text-sm font-medium text-foreground">{t("set.recommended")}</h3>
        <div className="flex flex-wrap gap-2">
          {loading && <span className="text-xs text-muted-foreground">{t("set.loading")}</span>}
          {recommendations.map((r) => {
            // Smogon measures each choice, not named sets: an estimate from its moves and item.
            const cov = build.data ? coverage(r.draft, build.data) : undefined;
            const pct = (share: number) => formatPercent(lang, share);
            return (
              <button
                key={r.name}
                type="button"
                aria-pressed={picked === r.name}
                onClick={() => pick(r.name, r.draft)}
                title={
                  cov &&
                  `${t("set.coverageHint")}\n${cov.parts.map((p) => `${p.name === r.draft.item ? names.item(p.name) : names.move(p.name)} ${pct(p.share)}`).join(" · ")}`
                }
                className={cn(
                  "rounded-full border border-border/50 px-3 py-1.5 text-xs transition-colors hover:bg-muted/50",
                  picked === r.name
                    ? "text-foreground ring-1 ring-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label(r)}
                {cov && cov.parts.length > 0 && (
                  <span className="ml-1.5 tabular-nums opacity-60">≈ {pct(cov.score)}</span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={picked === "blank"}
            onClick={() => pick("blank", emptyDraft(fallbackAbility))}
            className={cn(
              "rounded-full border border-dashed border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted/50",
              picked === "blank"
                ? "text-foreground ring-1 ring-foreground"
                : "text-muted-foreground",
            )}
          >
            {t("set.blank")}
          </button>
          <button
            type="button"
            aria-expanded={importing}
            aria-pressed={picked === "import"}
            onClick={() => setImporting((v) => !v)}
            className={cn(
              "rounded-full border border-dashed border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted/50",
              picked === "import" || importing
                ? "text-foreground ring-1 ring-foreground"
                : "text-muted-foreground",
            )}
          >
            {t("set.import")}
          </button>
        </div>
        {importing && (
          <div className="grid gap-2">
            <ShowdownPaste
              value={paste}
              onChange={setPaste}
              label={t("set.import")}
              options={{
                species: choices.data?.species ?? [species],
                item: choices.data?.items ?? [],
                ability: abilities,
                tera: teraTypes,
                move: choices.data?.moves ?? [],
                natures: choices.data?.natures.map((n) => n.name) ?? [],
              }}
              placeholder={toShowdown(
                species,
                recommendations[0]?.draft ?? {
                  ...emptyDraft(fallbackAbility),
                  item: "Leftovers",
                  moves: ["Move 1", "Move 2", "Move 3", "Move 4"],
                },
              )}
              className={cn(field, "h-auto resize-y py-2 font-mono text-xs leading-relaxed")}
            />
            <p className="text-xs text-muted-foreground">{t("set.importHint")}</p>
            {problems.length > 0 && (
              <ul role="alert" className="grid gap-1 text-xs text-rose-500">
                {problems.map((p) => (
                  <li key={p.key + (p.value ?? "")}>
                    {t(p.key as MessageKey, { value: p.value ?? "" })}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setImporting(false)}
                className="h-9 rounded-full border-border/50 px-4 text-xs text-muted-foreground hover:bg-muted/50"
              >
                {t("set.importCancel")}
              </Button>
              <Button
                type="button"
                disabled={!paste.trim() || !choices.data}
                onClick={runImport}
                className="h-9 rounded-full px-4 text-xs"
              >
                {t("set.importApply")}
              </Button>
            </div>
          </div>
        )}
      </section>

      <div role="tablist" className="flex gap-1 rounded-full bg-muted/40 p-1">
        {(["set", "stats", "meta"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "h-8 flex-1 rounded-full text-xs font-medium transition-colors",
              tab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(key === "set" ? "set.tabSet" : key === "stats" ? "set.tabStats" : "set.tabMeta")}
          </button>
        ))}
      </div>

      {tab === "set" && (
        <>
          <section className="grid grid-cols-2 gap-3">
            <label className="col-span-2 grid gap-1.5 text-xs text-muted-foreground">
              {t("set.item")}
              <span className="relative flex items-center">
                {draft.item && (
                  <span className="pointer-events-none absolute left-3 flex">
                    <ItemIcon item={draft.item} />
                  </span>
                )}
                <input
                  className={cn(field, draft.item && "pl-10", invalid("item"))}
                  list={`${ids}-items`}
                  value={itemNames.display(draft.item)}
                  onChange={(e) => update({ item: itemNames.resolve(e.target.value) })}
                  autoComplete="off"
                />
              </span>
            </label>
            <div className="grid gap-1.5 text-xs text-muted-foreground">
              {t("set.ability")}
              <Select value={draft.ability} onValueChange={(ability) => update({ ability })}>
                <SelectTrigger className={cn(trigger, invalid("ability"))}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...abilities, draft.ability].filter(Boolean))].map((a) => (
                    <SelectItem key={a} value={a}>
                      {/* One span: the item is a flex row, so a second child would be pushed apart. */}
                      <span>
                        {names.ability(a)}
                        {a === choices.data?.hiddenAbility && (
                          <span className="text-muted-foreground"> - {t("set.hiddenAbility")}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {gen === 9 && (
              <div className="grid gap-1.5 text-xs text-muted-foreground">
                {t("set.tera")}
                <Select
                  value={draft.teraType ?? ""}
                  onValueChange={(type) => update({ teraType: type || undefined })}
                >
                  <SelectTrigger className={cn(trigger, invalid("tera"))}>
                    <span className="flex min-w-0 items-center gap-2">
                      <TypeIcon type={draft.teraType} />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {TERA_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {names.type(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm font-medium text-foreground">{t("set.moves")}</h3>
            <div className="grid grid-cols-2 gap-3">
              {draft.moves.map((move, i) => {
                // The move's type: an icon and a coloured edge, so the coverage reads at a glance.
                const type =
                  move && dex.data?.moves.get(move).exists
                    ? dex.data.moves.get(move).type
                    : undefined;
                return (
                  <span key={`move-${i}`} className="relative flex items-center">
                    {type && (
                      <span className="pointer-events-none absolute left-3 flex">
                        <TypeIcon type={type} />
                      </span>
                    )}
                    <input
                      className={cn(field, type && "pl-9", invalid(`move-${i}`))}
                      // A border, not a box-shadow: the focus and invalid rings are box-shadows too.
                      style={{
                        border: type
                          ? `1px solid ${ink(TYPE_COLORS[type.toLowerCase()])}`
                          : undefined,
                      }}
                      list={`${ids}-moves`}
                      value={moveNames.display(move)}
                      aria-label={t("set.move", { n: i + 1 })}
                      placeholder={t("set.move", { n: i + 1 })}
                      onChange={(e) => {
                        const next = moveNames.resolve(e.target.value);
                        update({ moves: draft.moves.map((m, j) => (j === i ? next : m)) });
                      }}
                      autoComplete="off"
                    />
                  </span>
                );
              })}
            </div>
          </section>
        </>
      )}

      {tab === "meta" && (
        <MetaPanel format={format} gen={gen} species={species} draft={draft} onApply={update} />
      )}

      {tab === "stats" && (
        <section className="grid gap-4">
          <div className="grid gap-1.5 text-xs text-muted-foreground">
            {t("set.nature")}
            <Select value={draft.nature} onValueChange={(nature) => update({ nature })}>
              <SelectTrigger className={cn(trigger, invalid("nature"))}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {natureGroups.map(({ plus, natures }) => (
                  <div
                    key={plus ?? "neutral"}
                    role="group"
                    aria-label={
                      plus ? `+${t(`stat.${plus}` as MessageKey)}` : t("set.natureNeutral")
                    }
                  >
                    <div
                      aria-hidden
                      className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/60 uppercase"
                    >
                      {plus ? `+${t(`stat.${plus}` as MessageKey)}` : t("set.natureNeutral")}
                    </div>
                    {natures.map((n) => (
                      // One string child: the select reads it as the label shown in the trigger.
                      <SelectItem key={n.name} value={n.name}>
                        {n.plus && n.minus
                          ? `${names.nature(n.name)} (+${t(`stat.${n.plus}` as MessageKey)} −${t(`stat.${n.minus}` as MessageKey)})`
                          : names.nature(n.name)}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-foreground">{t("set.evs")}</h3>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  total === EV_TOTAL ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {total} / {EV_TOTAL}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EV_PRESETS.map((preset) => {
                const evs = presetEvs(preset);
                const active = STATS.every((s) => draft.evs[s] === evs[s]);
                return (
                  <button
                    key={preset.join("-")}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ evs })}
                    className={cn(
                      "rounded-full border border-border/50 px-3 py-1.5 text-xs transition-colors hover:bg-muted/50",
                      active ? "text-foreground ring-1 ring-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span style={{ color: ink(STAT_COLORS[preset[0]]) }}>
                      {t(`stat.${preset[0]}` as MessageKey)}
                    </span>
                    <span className="mx-1 text-muted-foreground/50">·</span>
                    <span style={{ color: ink(STAT_COLORS[preset[1]]) }}>
                      {t(`stat.${preset[1]}` as MessageKey)}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => update({ evs: emptyEvs() })}
                className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
              >
                {t("set.evsReset")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[4.5rem_2.5rem_1fr_4.5rem_4rem_3rem] items-center gap-x-3 gap-y-2 text-xs">
            <span />
            <span className="text-muted-foreground">{t("set.base")}</span>
            <span />
            <span className="text-muted-foreground">{t("set.evShort")}</span>
            <span className="text-muted-foreground">{t("set.ivShort")}</span>
            <span className="text-right text-muted-foreground">{t("learn.level", { level })}</span>
            {STATS.map((stat) => {
              const base = choices.data?.baseStats[stat] ?? 0;
              const value = calcStat(stat, base, draft.ivs[stat], draft.evs[stat], level, nature);
              const effect = nature?.plus === stat ? "up" : nature?.minus === stat ? "down" : null;
              return (
                <Fragment key={stat}>
                  <span
                    className="flex items-center gap-1 font-medium"
                    style={{ color: ink(STAT_COLORS[stat]) }}
                  >
                    {t(`stat.${stat}` as MessageKey)}
                    {/* The nature's effect keeps green / red, on the arrow and the final stat. */}
                    {effect === "up" && (
                      <ArrowUpIcon
                        size={12}
                        aria-label={t("set.natureUp")}
                        className="text-emerald-500"
                      />
                    )}
                    {effect === "down" && (
                      <ArrowDownIcon
                        size={12}
                        aria-label={t("set.natureDown")}
                        className="text-rose-500"
                      />
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{base}</span>
                  {/* 255 is the highest base stat in the games (Blissey's HP). */}
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (base / 255) * 100)}%`,
                        backgroundColor: STAT_COLORS[stat],
                      }}
                    />
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={252}
                    step={4}
                    aria-label={t("set.statEv", { stat: t(`stat.${stat}` as MessageKey) })}
                    className={cn(field, "h-8 px-2 tabular-nums")}
                    // Invested stats get their colour on the edge.
                    style={{
                      boxShadow: draft.evs[stat] ? `inset 3px 0 0 ${STAT_COLORS[stat]}` : undefined,
                    }}
                    value={draft.evs[stat]}
                    onChange={(e) =>
                      update({ evs: setEv(draft.evs, stat, Number(e.target.value)) })
                    }
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={31}
                    aria-label={t("set.statIv", { stat: t(`stat.${stat}` as MessageKey) })}
                    className={cn(field, "h-8 px-2 tabular-nums")}
                    value={draft.ivs[stat]}
                    onChange={(e) =>
                      update({ ivs: setIv(draft.ivs, stat, Number(e.target.value)) })
                    }
                  />
                  <span
                    className={cn(
                      "text-right text-sm font-semibold tabular-nums",
                      effect === "up" && "text-emerald-500",
                      effect === "down" && "text-rose-500",
                      !effect && "text-foreground",
                    )}
                  >
                    {choices.data ? value : "—"}
                  </span>
                </Fragment>
              );
            })}
          </div>
        </section>
      )}

      <datalist id={`${ids}-items`}>
        {sorted(itemNames.options).map((i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
      <datalist id={`${ids}-moves`}>
        {sorted(moveNames.options).map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      {saveProblems.length > 0 && (
        <ul
          role="alert"
          className="grid gap-1 rounded-xl bg-rose-500/10 px-4 py-3 text-xs text-rose-500"
        >
          {saveProblems.map((p) => (
            <li key={p.key + (p.value ?? "") + (p.field ?? "")}>
              {t(p.key as MessageKey, { value: p.value ?? "" })}
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-10 rounded-full border-border/50 px-5 text-sm text-muted-foreground hover:bg-muted/50"
        >
          {t("set.back")}
        </Button>
        <Button
          type="button"
          disabled={!choices.data}
          onClick={save}
          className="h-10 rounded-full px-5 text-sm"
        >
          {confirmLabel ?? t("set.add")}
        </Button>
      </div>
    </div>
  );
}
