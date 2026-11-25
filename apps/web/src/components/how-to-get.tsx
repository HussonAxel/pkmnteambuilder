// The team page's "How to get" tab: where to get the held item and the TMs in that generation's game,
// what the set needs beyond catching the Pokémon (mint, Ability Patch, Tera Shards), then how it learns
// its moves. Built to scan: one line per thing, the key fact on the right, details on hover.
// Sources are credited in the footer.
import { useQuery } from "@tanstack/react-query";
import {
  GemIcon,
  HammerIcon,
  LeafIcon,
  type LucideIcon,
  MapPinIcon,
  ShoppingBagIcon,
  SparklesIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { ItemIcon, loadDex } from "@/components/data-colors";
import { LearnList } from "@/components/member-details";
import type { PokemonSet } from "@/components/stacked-list";
import { useI18n, useNames } from "@/lib/i18n";
import { useFormat } from "@/lib/format";
import { howToLearn, learnedAs } from "@/lib/learn";
import { loadLearnData } from "@/lib/learn-data";
import { needsTm, splitPlaces, tmCost } from "@/lib/shopping";
import { gameLabel, itemSourcesQuery, tmSourcesQuery, usePlaceNames } from "@/lib/sources";

// Places shown before "+N" (the rest are in the hover text).
const PLACES = 2;

export function HowToGet({ member, gen }: { member: PokemonSet; gen: number }) {
  const { t, lang } = useI18n();
  const fmt = useFormat();
  const names = useNames();
  const sources = useQuery(itemSourcesQuery(gen));
  const tmSources = useQuery(tmSourcesQuery(gen));
  const learn = useQuery({
    queryKey: ["learn", gen],
    queryFn: () => loadLearnData(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });
  // Same cache entry as the set editor's ["dex", gen]: for the hidden ability check.
  const dex = useQuery({
    queryKey: ["dex", gen],
    queryFn: () => loadDex(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });
  // The set's moves that need a TM (no level-up or evolution route), with where to get it.
  const tms = learn.data
    ? member.moves
        .filter((move) => needsTm(howToLearn(learn.data, member.name, move)))
        .map((move) => ({ move, source: tmSources.data?.[learnedAs(move)] }))
    : [];
  const itemRows = member.item ? sources.data?.[member.item] : undefined;
  const hidden = dex.data?.species.get(member.name).abilities.H;

  // Rules of the games that changed what a caught Pokémon can become (gen 8 mints and patches, gen 9
  // Tera): a short chip each, the full sentence on hover.
  const tips: { icon: LucideIcon; label: string; hint: string }[] = [];
  if (gen >= 8 && member.nature) {
    const item = names.item(`${member.nature} Mint`);
    tips.push({
      icon: LeafIcon,
      label: item,
      hint: t("obtain.mint", { nature: names.nature(member.nature), item }),
    });
  }
  if (gen >= 8 && member.ability && member.ability === hidden) {
    const item = names.item("Ability Patch");
    tips.push({ icon: SparklesIcon, label: item, hint: t("obtain.patch", { item }) });
  }
  // The set editor also offers Stellar, which PokemonType doesn't list (and has no shard).
  if (gen === 9 && member.teraType && (member.teraType as string) !== "Stellar") {
    const item = names.item(`${member.teraType} Tera Shard`);
    tips.push({
      icon: GemIcon,
      label: `50 × ${item}`,
      hint: t("obtain.tera", { type: names.type(member.teraType), item }),
    });
  }

  return (
    <div className="grid gap-5 text-xs leading-snug">
      {member.item && (
        <Section title={t("set.item")}>
          <div className="grid gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ItemIcon item={member.item} />
              {names.item(member.item)}
            </span>
            {itemRows?.length ? (
              itemRows.map((row) => (
                <div
                  key={row.games + (row.found ?? "") + (row.other ?? "")}
                  className="grid gap-0.5 pl-6"
                >
                  {/* Only DLC rows say their game: the base game is a given. */}
                  {row.games.includes("·") && <Chip>{gameLabel(lang, t, row.games).dlc}</Chip>}
                  {row.found && <Places icon={MapPinIcon} found={row.found} />}
                  {row.other && <Line icon={ShoppingBagIcon} text={row.other} />}
                </div>
              ))
            ) : (
              <p className="pl-6 text-muted-foreground">
                {sources.isPending ? t("common.loading") : t("obtain.noItem")}
              </p>
            )}
          </div>
        </Section>
      )}

      {tms.length > 0 && (
        <Section title={t("obtain.tms")}>
          <ul className="grid gap-3">
            {tms.map(({ move, source }) => {
              const row = source?.rows[0];
              const cost = row ? tmCost(row) : undefined;
              const price = cost?.lp
                ? `${fmt.number(cost.lp)} ${t("obtain.lp")}`
                : cost?.price
                  ? fmt.money(cost.price)
                  : undefined;
              return (
                <li key={move} className="grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Chip>{source ? names.item(source.tm) : t("learn.tm")}</Chip>
                      <span className="truncate text-sm font-medium text-foreground">
                        {names.move(move)}
                      </span>
                    </span>
                    {price && <span className="shrink-0 font-medium text-foreground">{price}</span>}
                  </div>
                  {cost && cost.materials.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pl-1">
                      <HammerIcon size={12} className="mr-0.5 shrink-0 text-muted-foreground" />
                      {cost.materials.map((m) => (
                        <Chip key={m.name}>
                          {names.item(m.name)} ×{m.count}
                        </Chip>
                      ))}
                    </div>
                  )}
                  {row?.found && <Places icon={MapPinIcon} found={row.found} />}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {tips.length > 0 && (
        <Section title={t("obtain.build")}>
          <div className="flex flex-wrap gap-1.5">
            {tips.map(({ icon: Icon, label, hint }) => (
              <span
                key={label}
                title={hint}
                className="flex cursor-help items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-foreground"
              >
                <Icon size={12} className="text-muted-foreground" />
                {label}
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title={t("obtain.moves")}>
        <LearnList member={member} gen={gen} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

const Chip = ({ children }: { children: ReactNode }) => (
  <span className="w-fit shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
    {children}
  </span>
);

// One muted line with its icon, cut to one line; a click or tap shows it in full (`full` if given),
// the hover title too on desktop.
function Line({ icon: Icon, text, full }: { icon: LucideIcon; text: string; full?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      title={full ?? text}
      className="flex min-w-0 items-start gap-1.5 rounded-sm text-left text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <Icon size={12} className="mt-0.5 shrink-0" />
      <span className={open ? "whitespace-normal" : "truncate"}>
        {open ? (full ?? text) : text}
      </span>
    </button>
  );
}

// Where it's found: the first places, then "+N" for the rest (DLC ones included), all of them on
// hover or tap.
function Places({ icon, found }: { icon: LucideIcon; found: string }) {
  const placeNames = usePlaceNames();
  const split = splitPlaces(found);
  const base = split.base.map(placeNames.place);
  const dlc = split.dlc.map((d) => ({
    name: placeNames.dlc(d.name),
    places: d.places.map(placeNames.place),
  }));
  const all = [...base, ...dlc.flatMap((d) => d.places)];
  if (all.length === 0) return null;
  const shown = (base.length ? base : all).slice(0, PLACES);
  const more = all.length - shown.length;
  const full = [base.join(", "), ...dlc.map((d) => `${d.name}: ${d.places.join(", ")}`)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Line icon={icon} text={`${shown.join(", ")}${more > 0 ? ` +${more}` : ""}`} full={full} />
  );
}
