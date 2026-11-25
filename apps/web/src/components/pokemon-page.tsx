// The Pokémon page: one species in a competitive format, with room to read. The identity card (types,
// abilities, base stats) on the side; the set editor's Meta tab (read-only, the Pokémon it lists link to
// their own page) and the whole learnset in the main column.
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";

import { CategoryIcon, ink, loadDex, STAT_COLORS, TypeIcon } from "@/components/data-colors";
import { DexTip } from "@/components/dex-tip";
import { MethodChip } from "@/components/member-details";
import { MetaPanel } from "@/components/meta-panel";
import { ariaSort, SortButton, sortRows, useSort } from "@/components/sortable";
import {
  AddToTeam,
  RecommendedSets,
  useFormatOption,
  useRecommendations,
} from "@/components/pokemon-sets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { useFormatName } from "@/components/stacked-list";
import { TypeChip } from "@/components/type-chip";
import { FORM_ARTWORK_IDS } from "@/data/form-artwork-ids";
import type { MessageKey } from "@/i18n/messages";
import { artwork } from "@/lib/artwork";
import { useI18n, useNames } from "@/lib/i18n";
import { howToLearn, type LearnData, type Method } from "@/lib/learn";
import { learnableMoves, loadLearnData } from "@/lib/learn-data";
import { FORMATS, formatGen, GENS } from "@/lib/legality";
import { calcStat, calcStatGen12, STAT_EXP_MAX, STATS, type Stat } from "@/lib/sets";

type Dex = Awaited<ReturnType<typeof loadDex>>;

const ALL_GENS = [...GENS, 3, 2, 1];

// By name ("Gengar") or national dex number ("94", how adventure teams store their members).
function findSpecies(dex: Dex, key: string) {
  if (!/^\d+$/.test(key)) return dex.species.get(key);
  const num = Number(key);
  return dex.species.all().find((s) => s.num === num && !s.forme) ?? dex.species.get(key);
}

export function PokemonPage({
  species,
  format,
  gen: genOnly,
  onScope,
}: {
  species: string; // @pkmn/dex name or national dex number, as in the URL
  format?: string; // a competitive format; absent: the generation alone (stats and moves, no strategy)
  gen?: number;
  onScope: (scope: string) => void; // a format id, or "gen<N>" for a generation alone
}) {
  const { t } = useI18n();
  const names = useNames();
  const gen = format ? formatGen(format) : (genOnly ?? 9);
  // Same cache entry as the set editor's ["dex", gen].
  const dex = useQuery({
    queryKey: ["dex", gen],
    queryFn: () => loadDex(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const sp = dex.data && findSpecies(dex.data, species);
  // Species from a later generation exist in @pkmn/dex's older data, flagged "Future".
  const found = !!sp?.exists && sp.num > 0 && sp.gen <= gen;
  const id = sp ? (FORM_ARTWORK_IDS[sp.name] ?? sp.num) : 0;
  const name = sp && found ? names.pokemon(id, sp.name) : species;
  const option = useFormatOption(format, sp?.name ?? species);
  const sets = useRecommendations(format, sp?.name ?? species, sp?.abilities[0] ?? "");

  return (
    <div className="container mx-auto grid max-w-6xl content-start gap-8 px-4 py-6">
      <header className="grid gap-4">
        <BackLink />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5">
            {found && (
              <img
                src={artwork(id)}
                alt=""
                width={144}
                height={144}
                className="size-24 shrink-0 rounded-[28px] bg-muted/40 object-contain p-2 sm:size-36"
              />
            )}
            <div className="grid min-w-0 gap-2">
              {found && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t("pokemon.dex", { num: String(sp.num).padStart(4, "0") })}
                </span>
              )}
              <h1 className="truncate text-3xl font-semibold tracking-tight text-foreground">
                {name}
              </h1>
              {found && (
                <div className="flex flex-wrap gap-1.5">
                  {sp.types.map((type) => (
                    <TypeChip key={type} type={type} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <FormatPicker value={format ?? `gen${gen}`} onChange={onScope} />
            {/* The set the editor would start from: the first recommendation, if any. */}
            {found && format && (
              <AddToTeam format={format} option={option} draft={sets.recommendations[0]?.draft} />
            )}
          </div>
        </div>
      </header>

      {!dex.data ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !found || !sp ? (
        <p className="rounded-[28px] bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          {t("pokemon.notFound", { gen })}
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          {/* The identity card stays in view while the main column scrolls. */}
          <aside className="grid gap-6 lg:sticky lg:top-20">
            {/* Abilities came with gen 3. */}
            {gen >= 3 && <Abilities abilities={sp.abilities} gen={gen} />}
            <BaseStats
              base={sp.baseStats}
              gen={gen}
              level={format?.includes("vgc") ? 50 : format?.endsWith("lc") ? 5 : 100}
            />
          </aside>
          <div className="grid min-w-0 gap-6">
            {format && (
              <>
                <Panel title={t("pokemon.sets")}>
                  <RecommendedSets format={format} option={option} {...sets} />
                </Panel>
                <Panel title={t("pokemon.meta")}>
                  <MetaPanel format={format} gen={gen} species={sp.name} links />
                </Panel>
              </>
            )}
            <Learnset species={sp.name} gen={gen} dex={dex.data} />
          </div>
        </div>
      )}
    </div>
  );
}

// Back to where the player came from (a team, another Pokémon), or to the teams on a direct visit.
function BackLink() {
  const { t } = useI18n();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const className =
    "inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground";
  return canGoBack ? (
    <button type="button" onClick={() => router.history.back()} className={className}>
      <ArrowLeftIcon size={14} />
      {t("pokemon.back")}
    </button>
  ) : (
    <Link to="/" className={className}>
      <ArrowLeftIcon size={14} />
      {t("page.back")}
    </Link>
  );
}

// Every competitive format, newest generation first, each generation led by itself alone (no strategy
// data): the only choice for gens 1 to 3.
function FormatPicker({ value, onChange }: { value: string; onChange: (scope: string) => void }) {
  const { t } = useI18n();
  const formatName = useFormatName();
  return (
    <label className="grid min-w-0 flex-1 gap-1.5 text-xs text-muted-foreground sm:w-64 sm:flex-none">
      {t("pokemon.format")}
      <Select value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger className="h-10 rounded-xl border-transparent bg-muted/40 hover:border-transparent hover:bg-muted/70">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALL_GENS.map((gen) => (
            <div key={gen} role="group" aria-label={t("format.gen", { gen })}>
              <div
                aria-hidden
                className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/60 uppercase"
              >
                {t("format.gen", { gen })}
              </div>
              <SelectItem value={`gen${gen}`}>{t("pokemon.genOnly", { gen })}</SelectItem>
              {FORMATS.filter((f) => f.gen === gen).map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {formatName(f.mode, f.id)}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

// Titles say what a panel holds: no subtitle under them.
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-4 rounded-[28px] border border-border bg-background p-6">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Abilities({ abilities, gen }: { abilities: object; gen: number }) {
  const { t } = useI18n();
  const names = useNames();
  // Slots "0", "1", "H" (hidden), "S" (special event); one ability can fill two.
  const list = [
    ...new Map((Object.entries(abilities) as [string, string][]).map(([slot, a]) => [a, slot])),
  ];
  return (
    <Panel title={t("pokemon.abilities")}>
      <ul className="grid gap-2 text-sm">
        {list.map(([ability, slot]) => (
          <li key={ability} className="flex items-center justify-between gap-2">
            <DexTip kind="ability" name={ability} gen={gen} className="text-foreground">
              {names.ability(ability)}
            </DexTip>
            {slot === "H" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t("pokemon.hidden")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// Base stats with their bar (255 is the highest base stat, Blissey's HP), and what each becomes at the
// format's level: 0 EVs and a neutral nature, to 252 EVs and a boosting one.
function BaseStats({
  base,
  gen,
  level,
}: {
  base: Record<Stat, number>;
  gen: number;
  level: number;
}) {
  const { t } = useI18n();
  // Gen 1 has a single Special stat (@pkmn/dex gives it as both Sp. Atk and Sp. Def).
  const stats = gen === 1 ? STATS.filter((s) => s !== "spd") : STATS;
  const total = stats.reduce((sum, s) => sum + base[s], 0);
  // Gens 1-2: max DVs, from no stat experience to the most; since gen 3: 31 IVs, 0 EVs and a neutral
  // nature to 252 EVs and a boosting one.
  const range = (stat: Stat) =>
    gen <= 2
      ? [
          calcStatGen12(stat, base[stat], 15, 0, level),
          calcStatGen12(stat, base[stat], 15, STAT_EXP_MAX, level),
        ]
      : [
          calcStat(stat, base[stat], 31, 0, level),
          calcStat(stat, base[stat], 31, 252, level, { plus: stat }),
        ];
  return (
    <Panel title={t("pokemon.baseStats")}>
      <div className="grid grid-cols-[3rem_2rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-2 text-xs">
        <span />
        <span />
        <span />
        <span
          className="text-right text-muted-foreground"
          title={t(gen <= 2 ? "pokemon.rangeHintGen12" : "pokemon.rangeHint")}
        >
          {t("pokemon.range", { level })}
        </span>
        {stats.map((stat) => {
          const [min, max] = range(stat);
          return (
            <Fragment key={stat}>
              <span className="font-medium" style={{ color: ink(STAT_COLORS[stat]) }}>
                {gen === 1 && stat === "spa" ? t("stat.spc") : t(`stat.${stat}` as MessageKey)}
              </span>
              <span className="text-right font-medium tabular-nums text-foreground">
                {base[stat]}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-muted/50">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (base[stat] / 255) * 100)}%`,
                    backgroundColor: STAT_COLORS[stat],
                  }}
                />
              </span>
              <span className="text-right tabular-nums text-muted-foreground">
                {min}–{max}
              </span>
            </Fragment>
          );
        })}
        <span className="border-t border-border/40 pt-2 text-muted-foreground">
          {t("pokemon.total")}
        </span>
        <span className="border-t border-border/40 pt-2 text-right font-semibold tabular-nums text-foreground">
          {total}
        </span>
        <span className="col-span-2 border-t border-border/40 pt-2" />
      </div>
    </Panel>
  );
}

const FILTERS = ["all", "level", "tm", "egg", "tutor", "event"] as const;
type Filter = (typeof FILTERS)[number];

// Learned on evolving reads as level-up: both come with the Pokémon, no item or breeding needed.
const filterOf = (m: Method): Filter => (m.kind === "evolution" ? "level" : m.kind);
// The "How" column's order: level-up by level (on evolving first), then TMs by number (HMs, TRs after),
// egg moves, tutors, events. A move learned several ways sorts by its first.
const methodRank = (m: Method) => {
  switch (m.kind) {
    case "evolution":
      return 0;
    case "level":
      return m.level;
    case "tm": {
      const [, kind = "tm", n = "0"] = /^(tm|hm|tr)(\d+)/.exec(m.item ?? "") ?? [];
      return { tm: 1000, hm: 1500, tr: 2000 }[kind as "tm"] + Number(n);
    }
    case "egg":
      return 3000;
    case "tutor":
      return 4000;
    case "event":
      return 5000;
  }
};
const howRank = (how: Method[]) => Math.min(...how.map(methodRank));
const CATEGORY_ORDER: Record<string, number> = { Physical: 0, Special: 1, Status: 2 };

type LearnColumn = "move" | "category" | "power" | "accuracy" | "how";

// Every move the species learns in that generation (its pre-evolutions' included), and how.
function Learnset({ species, gen, dex }: { species: string; gen: number; dex: Dex }) {
  const { t, lang } = useI18n();
  const names = useNames();
  const [filter, setFilterState] = useState<Filter>("all");
  // Power and accuracy read best high to low on their first click.
  const { sort, setSort, toggle } = useSort<LearnColumn>(
    { key: "move", dir: "asc" },
    { power: "desc", accuracy: "desc" },
  );
  // Level-up moves read in level order: that filter sorts by "How"; the others by name.
  const setFilter = (next: Filter) => {
    setFilterState(next);
    setSort({ key: next === "level" ? "how" : "move", dir: "asc" });
  };
  const learn = useQuery({
    queryKey: ["learn", gen],
    queryFn: () => loadLearnData(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const rows = useMemo(() => {
    if (!learn.data) return [];
    const data = learn.data;
    return (
      learnableMoves(data, species)
        // One Hidden Power, not one per type.
        .filter((move) => !/^Hidden Power ./.test(move))
        .map((move) => ({
          move,
          how: howToLearn(data, species, move) ?? [],
          info: dex.moves.get(move),
        }))
        .filter((row) => row.how.length > 0 && row.info.exists)
    );
  }, [learn.data, species, dex]);

  const counts = Object.fromEntries(
    FILTERS.map((f) => [
      f,
      f === "all" ? rows.length : rows.filter((r) => r.how.some((m) => filterOf(m) === f)).length,
    ]),
  ) as Record<Filter, number>;
  const filtered = sortRows(
    rows.filter((r) => filter === "all" || r.how.some((m) => filterOf(m) === filter)),
    "asc",
    (r) => names.move(r.move),
    lang,
  );
  // Ties (same power, same category…) stay in name order.
  const shown = sortRows(
    filtered,
    sort.dir,
    (r): number | string => {
      switch (sort.key) {
        case "move":
          return names.move(r.move);
        case "category":
          return CATEGORY_ORDER[r.info.category] ?? 3;
        case "power":
          return r.info.basePower;
        case "accuracy":
          // Moves that never miss rank above 100%.
          return r.info.accuracy === true ? 101 : r.info.accuracy;
        case "how":
          // Restricted to the filtered method, so "TMs" sorts by TM number.
          return howRank(filter === "all" ? r.how : r.how.filter((m) => filterOf(m) === filter));
      }
    },
    lang,
  );
  const header = (column: LearnColumn, label: ReactNode, align?: "left" | "right") => (
    <SortButton column={column} sort={sort} onSort={toggle} align={align}>
      {label}
    </SortButton>
  );

  return (
    <Panel title={t("pokemon.learnset")}>
      {learn.isError ? (
        <p className="text-xs text-muted-foreground">{t("learn.loadError")}</p>
      ) : !learn.data ? (
        <p className="text-xs text-muted-foreground">{t("learn.loading")}</p>
      ) : (
        <>
          <div role="tablist" className="flex flex-wrap gap-1.5">
            {FILTERS.filter((f) => counts[f] > 0).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border border-border/50 px-3 py-1 text-xs transition-colors hover:bg-muted/50",
                  filter === f
                    ? "border-foreground bg-foreground text-background hover:bg-foreground"
                    : "text-muted-foreground",
                )}
              >
                {t(`pokemon.filter.${f}` as MessageKey)}
                <span className="ml-1.5 tabular-nums opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th
                    aria-sort={ariaSort(sort, "move")}
                    className="px-2 pb-2 text-left font-normal"
                  >
                    {header("move", t("pokemon.col.move"))}
                  </th>
                  <th
                    aria-sort={ariaSort(sort, "category")}
                    className="px-2 pb-2 text-left font-normal"
                  >
                    {/* Phones: the icons say it; the header keeps a short, sortable label. */}
                    {header(
                      "category",
                      <>
                        <span className="hidden sm:inline">{t("pokemon.col.category")}</span>
                        <span className="sm:hidden">{t("pokemon.col.categoryShort")}</span>
                      </>,
                    )}
                  </th>
                  <th
                    aria-sort={ariaSort(sort, "power")}
                    className="px-2 pb-2 text-right font-normal"
                  >
                    {header("power", t("pokemon.col.power"), "right")}
                  </th>
                  <th
                    aria-sort={ariaSort(sort, "accuracy")}
                    className="hidden px-2 pb-2 text-right font-normal sm:table-cell"
                  >
                    {header("accuracy", t("pokemon.col.accuracy"), "right")}
                  </th>
                  <th
                    aria-sort={ariaSort(sort, "how")}
                    className="px-2 pb-2 text-right font-normal"
                  >
                    {header("how", t("pokemon.col.how"), "right")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ move, how, info }) => (
                  <tr key={move} className="border-t border-border/30">
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-2">
                        <TypeIcon type={info.type} />
                        <DexTip kind="move" name={move} gen={gen} className="text-foreground">
                          {names.move(move)}
                        </DexTip>
                      </span>
                    </td>
                    {/* The icon always; its name next to it from sm up (and on hover). */}
                    <td className="px-2 py-1.5 text-muted-foreground">
                      <span
                        className="flex items-center gap-1.5"
                        title={t(`tip.${info.category}` as MessageKey)}
                      >
                        <CategoryIcon category={info.category} />
                        <span className="hidden sm:inline">
                          {t(`tip.${info.category}` as MessageKey)}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {info.basePower || "—"}
                    </td>
                    <td className="hidden px-2 py-1.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {info.accuracy === true ? "—" : `${info.accuracy}%`}
                    </td>
                    <td className="px-2 py-1.5">
                      <MethodChips how={how} data={learn.data} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

function MethodChips({ how, data }: { how: Method[]; data: LearnData }) {
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {how.map((m) => (
        <MethodChip key={`${m.kind}-${m.by ?? ""}`} method={m} data={data} />
      ))}
    </span>
  );
}
