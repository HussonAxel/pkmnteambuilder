// The team page's Meta tab (competitive teams): the team against its format's ladder.
//  - Threats: the Pokémon that check or counter several members (Smogon's checks and counters).
//  - The 20 most used: how many members hit each super effectively, and how many it threatens (types).
//  - Speed: the team and the meta's threats on one ladder, with a Trick Room hint.
// Usage can be read at any ladder cutoff Smogon publishes, with last month's trend.
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, HourglassIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { loadDex } from "@/components/data-colors";
import { MAX_ROWS, type PokemonSet, type Team } from "@/components/stacked-list";
import { FORM_ARTWORK_IDS } from "@/data/form-artwork-ids";
import { artwork } from "@/lib/artwork";
import { useFormat } from "@/lib/format";
import { loadFormatMeta } from "@/lib/format-meta";
import { useI18n, useNames } from "@/lib/i18n";
import { formatGen } from "@/lib/legality";
import { matchup, teamThreats, trend, trickRoomHint } from "@/lib/meta-team";
import { calcStat, parseSpread } from "@/lib/sets";
import { ariaSort, SortButton, sortRows, useSort } from "@/components/sortable";

type TopColumn = "pokemon" | "usage" | "youHit" | "itHits";
import { chartOf } from "@/lib/type-chart";

const TOP = 20;
const SPEED_THREATS = 12;

export function MetaTab({ team }: { team: Team }) {
  const { t, lang } = useI18n();
  const names = useNames();
  const gen = formatGen(team.format);
  const meta = useQuery({
    queryKey: ["format-meta", team.format],
    queryFn: () => loadFormatMeta(team.format),
    staleTime: Number.POSITIVE_INFINITY,
  });
  // Same cache entry as the set editor's ["dex", gen].
  const dex = useQuery({
    queryKey: ["dex", gen],
    queryFn: () => loadDex(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [cutoff, setCutoff] = useState<string | null>(null);
  // The top 20 table: most used first; the counts read best high to low on their first click.
  const { sort, toggle } = useSort<TopColumn>(
    { key: "usage", dir: "desc" },
    { usage: "desc", youHit: "desc", itHits: "desc" },
  );
  const party = team.pokemon.filter((p) => p.inTeam).slice(0, MAX_ROWS);

  if (party.length === 0) return <p className="text-sm text-muted-foreground">{t("mt.empty")}</p>;
  if (meta.isPending || !dex.data)
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!meta.data) return <p className="text-sm text-muted-foreground">{t("mt.noFormat")}</p>;

  const { history, counters, spreads } = meta.data;
  const shown = cutoff ?? (history ? String(history.cutoff) : null);
  const usage = (shown && history?.cutoffs[shown]) || meta.data.usage;
  const top = Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([name, share]) => ({ name, share }));
  const change = (name: string) =>
    trend(history?.cutoffs[String(history.cutoff)]?.[name], history?.previous?.usage[name]);

  const { chart } = chartOf(dex.data);
  const attacksOf = (p: PokemonSet) => {
    const fromMoves = p.moves
      .map((m) => dex.data.moves.get(m))
      .filter((m) => m.exists && m.category !== "Status")
      .map((m) => m.type as string);
    return [...new Set(fromMoves.length ? fromMoves : p.types)];
  };
  const members = party.map((p) => ({ p, types: p.types as string[], attacks: attacksOf(p) }));
  const threats = teamThreats(
    party.map((p) => p.name),
    counters,
    usage,
  );

  // Speeds at the format's level: VGC 50, Little Cup 5, Smogon 100. Threats use their most used spread.
  const level = team.mode === "vgc" ? 50 : team.format.endsWith("lc") ? 5 : 100;
  const natures = dex.data.natures;
  const speed = (species: string, nature: string | undefined, ev: number, iv: number) => {
    const sp = dex.data.species.get(species);
    const n = nature ? natures.get(nature) : undefined;
    return calcStat("spe", sp.baseStats.spe, iv, ev, level, n?.exists ? n : undefined);
  };
  const teamSpeeds = party.map((p) => ({
    name: p.name,
    pokeapiId: p.pokeapiId,
    value: speed(p.name, p.nature, p.evs?.spe ?? 0, p.ivs?.spe ?? 31),
    own: true,
  }));
  const threatSpeeds = top.slice(0, SPEED_THREATS).flatMap(({ name }) => {
    if (party.some((p) => p.name === name)) return [];
    const [spread] = Object.entries(spreads[name] ?? {}).sort((a, b) => b[1] - a[1])[0] ?? [];
    const parsed = spread ? parseSpread(spread) : undefined;
    return [
      {
        name,
        pokeapiId: pokeapiId(name, dex.data.species.get(name).num),
        value: speed(name, parsed?.nature, parsed?.evs.spe ?? 0, 31),
        own: false,
      },
    ];
  });
  const ladder = [...teamSpeeds, ...threatSpeeds].sort((a, b) => b.value - a.value);
  const trickRoom = trickRoomHint(
    teamSpeeds.map((s) => s.value),
    threatSpeeds.map((s) => s.value),
  );

  return (
    <div className="grid gap-6">
      {history && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t("mt.cutoff")}</span>
          {Object.keys(history.cutoffs).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={shown === c}
              onClick={() => setCutoff(c)}
              className={cn(
                "rounded-full border border-border/50 px-3 py-1 transition-colors hover:bg-muted/50",
                shown === c &&
                  "border-foreground bg-foreground text-background hover:bg-foreground",
              )}
            >
              {c === "0" ? t("mt.allPlayers") : `${c}+`}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("mt.teamThreats")}>
          {threats.length === 0 ? (
            <p className="text-muted-foreground">{t("mt.noCounters")}</p>
          ) : (
            <ul className="grid gap-2.5">
              {threats.map((th) => (
                <li key={th.name} className="flex items-center gap-3">
                  <Sprite name={th.name} num={dex.data.species.get(th.name).num} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <SpeciesLink
                        species={th.name}
                        format={team.format}
                        className="truncate font-medium text-foreground"
                      >
                        {names.pokemon(
                          pokeapiId(th.name, dex.data.species.get(th.name).num),
                          th.name,
                        )}
                      </SpeciesLink>
                      <Usage share={th.usage} change={change(th.name)} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                      <span>{t("mt.counters", { n: th.members.length })}</span>
                      <span className="flex -space-x-1.5">
                        {th.members.map((m) => {
                          const p = party.find((x) => x.name === m);
                          return p ? (
                            <img
                              key={m}
                              src={artwork(p.pokeapiId)}
                              alt=""
                              title={names.pokemon(p.pokeapiId, p.name)}
                              className="size-5 rounded-full bg-muted object-contain ring-1 ring-background"
                            />
                          ) : null;
                        })}
                      </span>
                      <span className="ml-auto tabular-nums">
                        {t("mt.koSwitch", {
                          ko: Math.round(th.ko * 100),
                          switched: Math.round(th.switched * 100),
                        })}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("mt.vsTop", { n: TOP })}>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                {(
                  [
                    ["pokemon", t("mt.pokemon"), "left"],
                    ["usage", t("mt.usage"), "right"],
                    ["youHit", t("mt.youHit"), "center"],
                    ["itHits", t("mt.itHits"), "center"],
                  ] as const
                ).map(([column, label, align]) => (
                  <th
                    key={column}
                    aria-sort={ariaSort(sort, column)}
                    className={cn(
                      "pb-2 font-normal",
                      align === "left"
                        ? "text-left"
                        : align === "right"
                          ? "text-right"
                          : "text-center",
                    )}
                  >
                    <SortButton column={column} sort={sort} onSort={toggle} align={align}>
                      {label}
                    </SortButton>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortRows(
                top.map(({ name, share }) => {
                  const sp = dex.data.species.get(name);
                  return { name, share, sp, m: matchup(chart, members, sp.types) };
                }),
                sort.dir,
                (row): number | string =>
                  sort.key === "pokemon"
                    ? names.pokemon(pokeapiId(row.name, row.sp.num), row.name)
                    : sort.key === "usage"
                      ? row.share
                      : sort.key === "youHit"
                        ? row.m.hitters
                        : row.m.threatened,
                lang,
              ).map(({ name, share, sp, m }) => {
                return (
                  <tr key={name} className="border-t border-border/30">
                    <td className="py-1">
                      <span className="flex items-center gap-2">
                        <Sprite name={name} num={sp.num} small />
                        <SpeciesLink species={name} format={team.format} className="truncate">
                          {names.pokemon(pokeapiId(name, sp.num), name)}
                        </SpeciesLink>
                      </span>
                    </td>
                    <td className="py-1 text-right">
                      <Usage share={share} change={change(name)} />
                    </td>
                    <td
                      title={t("mt.youHitHint", { n: m.hitters, best: m.best })}
                      className={cn(
                        "py-1 text-center font-medium tabular-nums",
                        m.hitters === 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      {m.hitters}
                    </td>
                    <td
                      title={t("mt.itHitsHint", { n: m.threatened })}
                      className={cn(
                        "py-1 text-center tabular-nums",
                        m.threatened >= 3
                          ? "font-semibold text-red-600 dark:text-red-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {m.threatened}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title={t("mt.speed", { level })}>
        {trickRoom && (
          <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
            <HourglassIcon size={14} />
            {t("mt.trickRoom")}
          </p>
        )}
        <ol className="grid gap-1 sm:grid-cols-2">
          {ladder.map((s) => (
            <li
              key={`${s.own ? "own" : "meta"}-${s.name}`}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1",
                s.own ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="w-9 text-right tabular-nums">{s.value}</span>
              <img
                src={artwork(s.pokeapiId)}
                alt=""
                className="size-6 rounded-full bg-muted object-contain"
              />
              <span className="truncate">{names.pokemon(s.pokeapiId, s.name)}</span>
              {s.own && (
                <span className="ml-auto text-[10px] uppercase opacity-70">{t("mt.yours")}</span>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

// PokeAPI id (artwork, localised name) of a @pkmn/dex species name.
export const pokeapiId = (name: string, num: number) => FORM_ARTWORK_IDS[name] ?? num;

export function Sprite({ name, num, small }: { name: string; num: number; small?: boolean }) {
  return (
    <img
      src={artwork(pokeapiId(name, num))}
      alt=""
      loading="lazy"
      className={cn("shrink-0 rounded-full bg-muted object-contain", small ? "size-6" : "size-9")}
    />
  );
}

export function Usage({ share, change }: { share: number; change?: number }) {
  // Under 0.1 point, no arrow: noise.
  const moved = change !== undefined && Math.abs(change) >= 0.001 ? change : undefined;
  const fmt = useFormat();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
      {fmt.percent(share, 1)}
      {moved !== undefined && (
        <span
          title={fmt.delta(moved * 100)}
          className={cn(
            "inline-flex items-center",
            moved > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
          )}
        >
          {moved > 0 ? <ArrowUpIcon size={11} /> : <ArrowDownIcon size={11} />}
        </span>
      )}
    </span>
  );
}

// Titles say what a card holds: no subtitle under them.
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 content-start gap-3 rounded-[28px] border border-border bg-background p-6 text-xs">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

// A meta Pokémon's name, linking to its Pokémon page in the team's format.
function SpeciesLink({
  species,
  format,
  className,
  children,
}: {
  species: string;
  format: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to="/pokemon/$species"
      params={{ species }}
      search={{ format }}
      className={cn(
        "rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </Link>
  );
}
