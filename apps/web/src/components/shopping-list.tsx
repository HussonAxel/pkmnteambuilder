// The team's shopping list (team page): the held items to get, the TMs to buy or craft with their total
// cost and, in Scarlet/Violet, the materials those TMs need with where the Pokémon that drop them live.
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ItemIcon, loadDex } from "@/components/data-colors";
import { loadGame, MAX_ROWS, type Team } from "@/components/stacked-list";
import { FORM_ARTWORK_IDS } from "@/data/form-artwork-ids";
import { artwork } from "@/lib/artwork";
import { useI18n, useNames } from "@/lib/i18n";
import { useFormat } from "@/lib/format";
import { howToLearn, learnedAs } from "@/lib/learn";
import { loadLearnData } from "@/lib/learn-data";
import { formatGen } from "@/lib/legality";
import { needsTm, shoppingList } from "@/lib/shopping";
import { gameLabel, itemSourcesQuery, tmSourcesQuery, usePlaceNames } from "@/lib/sources";

// Where to farm a material: the first places its Pokémon spawns (walking or fixed spawns).
const FARM_PLACES = 3;

export function ShoppingList({ team }: { team: Team }) {
  const { t, lang } = useI18n();
  const fmt = useFormat();
  const placeNames = usePlaceNames();
  const names = useNames();
  const gen = formatGen(team.format);
  const party = team.pokemon.filter((p) => p.inTeam).slice(0, MAX_ROWS);

  const learn = useQuery({
    queryKey: ["learn", gen],
    queryFn: () => loadLearnData(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const tmSources = useQuery(tmSourcesQuery(gen));
  const itemSources = useQuery(itemSourcesQuery(gen));
  // Scarlet/Violet only: materials -> the Pokémon dropping them -> where it spawns (generated game file).
  const dex = useQuery({
    queryKey: ["dex", gen],
    queryFn: () => loadDex(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const game = useQuery({
    queryKey: ["game", "scarlet"],
    queryFn: () => loadGame("scarlet"),
    enabled: gen === 9,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (!learn.data || !tmSources.data) return null;
  const list = shoppingList(
    party.map((p) => p.item),
    // One TM teaches every Hidden Power type: listed under the games' name.
    party.flatMap((p) =>
      p.moves.filter((m) => needsTm(howToLearn(learn.data, p.name, m))).map(learnedAs),
    ),
    tmSources.data,
  );
  if (list.items.length === 0 && list.tms.length === 0) return null;

  const farmPlaces = (species: string) => {
    const num = dex.data?.species.get(species).num;
    const pokemon = game.data?.pokemon.find((p) => p.id === num);
    const places = new Set(
      (pokemon?.sources ?? [])
        .filter((s) => s.l && (s.m === "walk" || s.m === "fixed"))
        .map((s) => names.location(s.l!))
        .filter(Boolean),
    );
    return [...places].slice(0, FARM_PLACES);
  };

  return (
    <section className="grid gap-4">
      <h2 className="text-sm font-medium text-muted-foreground">{t("shop.title")}</h2>
      <div className="grid gap-6 rounded-[28px] border border-border bg-background p-6 text-xs leading-snug md:grid-cols-2 lg:grid-cols-3">
        {list.items.length > 0 && (
          <Column title={t("shop.items")}>
            {list.items.map(({ name, count }) => {
              const row = itemSources.data?.[name]?.[0];
              const where = row?.found ? placeNames.place(row.found) : row?.other;
              return (
                <li key={name} className="grid gap-0.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ItemIcon item={name} />
                    {names.item(name)}
                    {count > 1 && <span className="text-muted-foreground">×{count}</span>}
                  </span>
                  {where && (
                    <span className="line-clamp-2 text-muted-foreground" title={where}>
                      {row &&
                        [gameLabel(lang, t, row.games).games, gameLabel(lang, t, row.games).dlc]
                          .filter(Boolean)
                          .join(" · ")}{" "}
                      · {where}
                    </span>
                  )}
                </li>
              );
            })}
          </Column>
        )}

        {list.tms.length > 0 && (
          <Column
            title={t("shop.tms")}
            footer={
              (list.total.price > 0 || list.total.lp > 0) &&
              [
                list.total.price > 0 && fmt.money(list.total.price),
                list.total.lp > 0 && `${fmt.number(list.total.lp)} ${t("obtain.lp")}`,
              ]
                .filter(Boolean)
                .join(" · ")
            }
          >
            {list.tms.map((tm) => (
              <li key={tm.move} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {names.item(tm.tm)}
                  </span>
                  <span className="truncate font-medium">{names.move(tm.move)}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {tm.lp
                    ? `${fmt.number(tm.lp)} ${t("obtain.lp")}`
                    : tm.price
                      ? fmt.money(tm.price)
                      : ""}
                </span>
              </li>
            ))}
          </Column>
        )}

        {list.materials.length > 0 && (
          <Column title={t("shop.materials")}>
            {list.materials.map((m) => {
              const num = dex.data?.species.get(m.species).num;
              const places = farmPlaces(m.species);
              return (
                <li key={m.name} className="flex items-start gap-2">
                  {num ? (
                    <img
                      src={artwork(FORM_ARTWORK_IDS[m.species] ?? num)}
                      alt=""
                      loading="lazy"
                      className="size-7 shrink-0 rounded-full bg-muted object-contain"
                    />
                  ) : null}
                  <span className="grid gap-0.5">
                    <span className="font-medium">
                      {names.item(m.name)} <span className="text-muted-foreground">×{m.count}</span>
                    </span>
                    {places.length > 0 && (
                      <span className="text-muted-foreground">
                        {t("shop.farm", {
                          pokemon: names.pokemon(num ?? 0, m.species),
                          places: places.join(", "),
                        })}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </Column>
        )}
      </div>
    </section>
  );
}

function Column({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <ul className="grid gap-2.5">{children}</ul>
      {footer && (
        <p className="border-t border-border/40 pt-2 font-medium text-foreground">{footer}</p>
      )}
    </div>
  );
}
