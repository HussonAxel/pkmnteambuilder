// The team page's coverage tab: the general type chart of the team's generation, attacking types down
// the side and defending types across the top, with the team laid over it:
//  - rows of the attack types the team uses, and columns of its members' types, are highlighted;
//  - two columns on the right count the members weak to / resisting each attacking type;
//  - a row at the bottom counts the members hitting each defending type super effectively.
// Then the brief's alerts in plain words. Type chart from lib/type-chart.ts.
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { loadDex, TypeIcon } from "@/components/data-colors";
import { MAX_ROWS, type PokemonSet, type Team } from "@/components/stacked-list";
import { GAMES } from "@/data/games/index";
import { useI18n, useNames } from "@/lib/i18n";
import { formatGen } from "@/lib/legality";
import { alerts, chartOf, defense, offense } from "@/lib/type-chart";

const teamGen = (team: Team) =>
  team.mode === "adventure"
    ? (GAMES.find((g) => (g.versions as readonly string[]).includes(team.format))?.generation ?? 9)
    : formatGen(team.format);

// The classic chart's colours, from the attacker's side: super effective green, not very red, none grey.
const CELL: Record<number, { label: string; tint: string }> = {
  2: { label: "2", tint: "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300" },
  0.5: { label: "½", tint: "bg-red-500/15 text-red-700 dark:text-red-300" },
  0: { label: "0", tint: "bg-foreground/15 text-foreground" },
};

export function TypeCoverage({ team }: { team: Team }) {
  const { t } = useI18n();
  const names = useNames();
  const gen = teamGen(team);
  // Same cache entry as the set editor's ["dex", gen].
  const dex = useQuery({
    queryKey: ["dex", gen],
    queryFn: () => loadDex(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const party = team.pokemon.filter((p) => p.inTeam).slice(0, MAX_ROWS);

  if (party.length === 0) return <p className="text-sm text-muted-foreground">{t("cov.empty")}</p>;
  if (!dex.data) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  const { types, chart } = chartOf(dex.data);
  // Offense: the set's damaging moves' types; the Pokémon's own types when it has none (Adventure).
  const attacksOf = (p: PokemonSet) => {
    const fromMoves = p.moves
      .map((m) => dex.data.moves.get(m))
      .filter((m) => m.exists && m.category !== "Status")
      .map((m) => m.type as string);
    return [...new Set(fromMoves.length ? fromMoves : p.types)];
  };
  const members = party.map((p) => ({ p, types: p.types as string[], attacks: attacksOf(p) }));
  const teamAttacks = new Set(members.flatMap((m) => m.attacks));
  const teamTypes = new Set(members.flatMap((m) => m.types));

  const weak = (attack: string) =>
    members.filter((m) => defense(chart, m.types, attack) > 1).length;
  const resist = (attack: string) =>
    members.filter((m) => defense(chart, m.types, attack) < 1).length;
  const hitters = (defending: string) =>
    members.filter((m) => offense(chart, m.attacks, defending) > 1).length;
  const list = alerts(chart, types, members);
  const uncovered = list.filter((a) => a.kind === "uncovered").map((a) => a.type);

  return (
    <div className="grid gap-4">
      {/* Alerts as badges above the chart: the full sentence is on hover and for screen readers. */}
      <div className="flex flex-wrap gap-2">
        {list
          .filter((a) => a.kind !== "uncovered")
          .map((a) => {
            const sentence = t(a.kind === "stacked" ? "cov.stacked" : "cov.unresisted", {
              n: a.weak ?? 0,
              type: names.type(a.type),
            });
            return (
              <span
                key={a.kind + a.type}
                title={sentence}
                aria-label={sentence}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs",
                  // No resistance at all is the worse case: a stronger tint.
                  a.kind === "unresisted"
                    ? "border-red-500/50 bg-red-500/15 text-red-600 dark:text-red-400"
                    : "border-red-500/25 bg-red-500/5 text-red-600 dark:text-red-400",
                )}
              >
                <TypeIcon type={a.type} />
                <span className="font-medium">{names.type(a.type)}</span>
                <span className="opacity-80">
                  {t(a.kind === "stacked" ? "cov.badgeStacked" : "cov.badgeUnresisted", {
                    n: a.weak ?? 0,
                  })}
                </span>
              </span>
            );
          })}
        {uncovered.length > 0 && (
          <span
            title={t("cov.uncovered", { types: uncovered.map(names.type).join(", ") })}
            aria-label={t("cov.uncovered", { types: uncovered.map(names.type).join(", ") })}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 py-1 pr-2.5 pl-2.5 text-xs text-amber-600 dark:text-amber-400"
          >
            <span className="font-medium">{t("cov.badgeUncovered")}</span>
            <span className="flex items-center gap-1">
              {uncovered.map((type) => (
                <TypeIcon key={type} type={type} />
              ))}
            </span>
          </span>
        )}
        {list.length === 0 && (
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400">
            {t("cov.none")}
          </span>
        )}
      </div>

      {/* Scrolls sideways on narrow screens; the attacking type column stays in place. */}
      <div className="overflow-x-auto rounded-[28px] border border-border bg-background p-4">
        <table className="w-full border-separate border-spacing-0.5 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background p-1 text-left text-[10px] font-normal text-muted-foreground">
                {t("cov.atkDef")}
              </th>
              {types.map((type) => (
                <th
                  key={type}
                  scope="col"
                  title={names.type(type)}
                  className={cn(
                    "min-w-8 rounded-md p-1 font-normal",
                    teamTypes.has(type) && "bg-muted",
                  )}
                >
                  <span className="flex flex-col items-center gap-1">
                    <TypeIcon type={type} />
                    <span
                      className={cn(
                        "text-[10px] uppercase",
                        teamTypes.has(type)
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {names.type(type).slice(0, 3)}
                    </span>
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="min-w-12 pl-2 text-[10px] font-medium text-muted-foreground"
              >
                {t("cov.weak")}
              </th>
              <th scope="col" className="min-w-12 text-[10px] font-medium text-muted-foreground">
                {t("cov.resist")}
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((attack) => {
              const used = teamAttacks.has(attack);
              const w = weak(attack);
              const r = resist(attack);
              const alert = w >= 3 || (w >= 2 && r === 0);
              return (
                <tr key={attack}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 rounded-md bg-background p-1 pr-2 text-left font-normal",
                      used && "bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <TypeIcon type={attack} />
                      <span
                        className={used ? "font-semibold text-foreground" : "text-muted-foreground"}
                      >
                        {names.type(attack)}
                      </span>
                    </span>
                  </th>
                  {types.map((defending) => {
                    const v = chart[defending]?.[attack] ?? 1;
                    const cell = CELL[v];
                    return (
                      <td
                        key={defending}
                        title={`${names.type(attack)} → ${names.type(defending)} ×${v}`}
                        className={cn(
                          "h-7 rounded-md text-center font-medium tabular-nums",
                          cell ? cell.tint : "bg-muted/20",
                          // The team's own crossing points stand out a little more.
                          (used || teamTypes.has(defending)) && !cell && "bg-muted/50",
                        )}
                      >
                        {cell?.label}
                      </td>
                    );
                  })}
                  <td
                    title={t("cov.weakHint", { type: names.type(attack) })}
                    className={cn(
                      "pl-2 text-center tabular-nums",
                      alert
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {w}
                  </td>
                  <td
                    title={t("cov.resistHint", { type: names.type(attack) })}
                    className="text-center text-muted-foreground tabular-nums"
                  >
                    {r}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-background p-1 pt-3 pr-2 text-left font-medium text-muted-foreground"
              >
                {t("cov.covered")}
              </th>
              {types.map((defending) => {
                const n = hitters(defending);
                return (
                  <td
                    key={defending}
                    title={t("cov.coveredHint", { type: names.type(defending) })}
                    className={cn(
                      "pt-3 text-center tabular-nums",
                      n === 0
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {n}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{t("cov.note")}</p>
    </div>
  );
}
