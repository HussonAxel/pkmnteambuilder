// What the ladder plays on a species in a format, in the set editor's "Meta" tab: usage and rank,
// option shares (a click applies one to the set), spreads and their roles, skill ceiling,
// teammates, threats and type matchups. Also backs the Pokémon page (routes/pokemon.$species.tsx),
// read-only there: no set to apply options to, and the listed Pokémon link to their own page.
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import { ink, ItemIcon, loadDex, STAT_COLORS, TypeIcon } from "@/components/data-colors";
import { TYPE_COLORS, TypeChip } from "@/components/type-chip";
import { FORM_ARTWORK_IDS } from "@/data/form-artwork-ids";
import type { MessageKey } from "@/i18n/messages";
import { artwork } from "@/lib/artwork";
import { useI18n, useNames } from "@/lib/i18n";
import { useFormat } from "@/lib/format";
import { ranked, roleShares, STAPLE, statDistribution } from "@/lib/meta";
import { loadMeta } from "@/lib/meta-data";
import { EV_MAX, parseSpread, type SetDraft, STATS } from "@/lib/sets";

// Titles say what a section holds: no subtitle under them.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Bar({ share, max = 1, color }: { share: number; max?: number; color?: string }) {
  return (
    <span className="h-1.5 overflow-hidden rounded-full bg-muted/50">
      <span
        className={cn("block h-full rounded-full", !color && "bg-foreground/60")}
        style={{ width: `${Math.min(100, (share / max) * 100)}%`, backgroundColor: color }}
      />
    </span>
  );
}

// Each role takes the colour of the stat it's built around.
const ROLE_COLORS: Record<string, string> = {
  fastPhysical: STAT_COLORS.atk!,
  fastSpecial: STAT_COLORS.spa!,
  bulkyPhysical: "#e4613e",
  bulkySpecial: "#576fbc",
  physicalWall: STAT_COLORS.def!,
  specialWall: STAT_COLORS.spd!,
  fastBulky: STAT_COLORS.spe!,
  bulky: STAT_COLORS.hp!,
  trickRoom: "#9354cb",
  other: "#828282",
};

// One option per row: name, bar, share. Rows that match the set are ringed; a click applies them.
function OptionList({
  title,
  options,
  label = (name) => name,
  icon,
  color,
  isCurrent,
  onPick,
  limit = 8,
  relative = false,
}: {
  title: string;
  options: [string, number][];
  label?: (name: string) => React.ReactNode;
  icon?: (name: string) => React.ReactNode;
  color?: (name: string) => string | undefined; // bar colour, e.g. the move's type

  isCurrent: (name: string) => boolean;
  onPick?: (name: string) => void;
  limit?: number;
  relative?: boolean; // bars scaled to the top option (long tails of small shares, like spreads)
}) {
  const { t } = useI18n();
  const fmt = useFormat();
  const pct = (share: number) => fmt.percent(share, 1);
  if (!options.length) return null;
  const max = relative ? (options[0]?.[1] ?? 1) : 1;
  return (
    <div className="grid content-start gap-1">
      <h4 className="mb-1 text-xs font-medium text-muted-foreground">{title}</h4>
      {options.slice(0, limit).map(([name, share]) => (
        <button
          key={name}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(name)}
          title={onPick ? t("meta.apply") : undefined}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_4rem_3rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors enabled:hover:bg-muted/50",
            isCurrent(name) ? "text-foreground ring-1 ring-foreground" : "text-muted-foreground",
            // Hierarchy: what most players run stands out, the long tail fades.
            share >= 0.5 && "font-medium",
            share < 0.05 && !isCurrent(name) && "opacity-60",
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {icon?.(name)}
            <span className="truncate">{label(name)}</span>
            {share >= STAPLE && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none text-foreground">
                {t("meta.staple")}
              </span>
            )}
          </span>
          <Bar share={share} max={max} color={color?.(name)} />
          <span className="text-right tabular-nums">{pct(share)}</span>
        </button>
      ))}
    </div>
  );
}

// A teammate or threat: a link to its own page when `species` is given, a plain tile otherwise.
function Tile({
  species,
  format,
  children,
}: {
  species?: string;
  format: string;
  children: React.ReactNode;
}) {
  const className = "flex min-w-0 items-center gap-2 rounded-xl bg-muted/40 p-2";
  if (!species) return <div className={className}>{children}</div>;
  return (
    <Link
      to="/pokemon/$species"
      params={{ species }}
      search={{ format }}
      className={cn(
        className,
        "transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
    >
      {children}
    </Link>
  );
}

export function MetaPanel({
  format,
  gen,
  species,
  draft,
  onApply,
  links = false,
}: {
  format: string;
  gen: number;
  species: string; // @pkmn/dex name
  draft?: SetDraft; // the set being edited; without one, nothing is ringed or clickable
  onApply?: (patch: Partial<SetDraft>) => void;
  links?: boolean; // teammates and threats link to their Pokémon page (not inside the set editor)
}) {
  const { t } = useI18n();
  const fmt = useFormat();
  const pct = (share: number) => fmt.percent(share, 1);
  const names = useNames();
  const meta = useQuery({
    queryKey: ["meta", format, species],
    queryFn: () => loadMeta(format, species),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const dex = useQuery({
    queryKey: ["dex", gen],
    queryFn: () => loadDex(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (meta.isPending) return <p className="text-xs text-muted-foreground">{t("set.loading")}</p>;
  const data = meta.data;
  const d = dex.data;
  const idOf = (name: string) => FORM_ARTWORK_IDS[name] ?? d?.species.get(name).num ?? 0;
  const statLabel = (s: string) => t(`stat.${s}` as MessageKey);
  const spreadLabel = (spread: string) => {
    const { nature, evs } = parseSpread(spread);
    const stats = STATS.filter((s) => evs[s]);
    return (
      <>
        <span className="text-foreground">{names.nature(nature)}</span>
        <span className="mx-1.5 text-muted-foreground/50">·</span>
        {stats.map((s, i) => (
          <Fragment key={s}>
            {i > 0 && <span className="mx-1 text-muted-foreground/40">/</span>}
            <span className="tabular-nums" style={{ color: ink(STAT_COLORS[s]) }}>
              {evs[s]} {statLabel(s)}
            </span>
          </Fragment>
        ))}
      </>
    );
  };
  const moveType = (move: string) => d?.moves.get(move).type;

  // Type matchups for the current set: Tera replaces the types once chosen (Stellar keeps them).
  const ownTypes = d?.species.get(species).types ?? [];
  const tera = gen === 9 && draft?.teraType && draft.teraType !== "Stellar" ? draft.teraType : null;
  const defending = tera ? [tera] : ownTypes;
  const matchups = d
    ? d.types
        .all()
        .filter((type) => type.exists && type.name !== "Stellar" && !type.isNonstandard)
        .map((type) => ({
          type: type.name,
          mult: d.getImmunity(type.name, defending)
            ? 2 ** d.getEffectiveness(type.name, defending)
            : 0,
        }))
    : [];
  const groups = [4, 2, 0.5, 0.25, 0]
    .map((mult) => ({ mult, types: matchups.filter((m) => m.mult === mult).map((m) => m.type) }))
    .filter((g) => g.types.length);

  return (
    <div className="grid gap-6">
      {!data ? (
        <p className="rounded-xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">
          {t("meta.none")}
        </p>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [t("meta.usage"), pct(data.usage)],
              [t("meta.rank"), `#${data.rank}`],
              ...(data.battles ? [[t("meta.battles"), fmt.number(data.battles)]] : []),
              ...(data.lead ? [[t("meta.lead"), pct(data.lead)]] : []),
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1 rounded-xl bg-muted/40 px-3 py-2.5">
                <span className="text-[11px] text-muted-foreground">{label}</span>
                <span className="text-lg font-semibold tracking-tight tabular-nums text-foreground">
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Option shares: click to apply */}
          {data.build && (
            <Section title={t("meta.options")}>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <OptionList
                  title={t("set.moves")}
                  options={ranked(data.build.moves)}
                  limit={10}
                  label={names.move}
                  icon={(m) => <TypeIcon type={moveType(m)} />}
                  color={(m) => TYPE_COLORS[moveType(m)?.toLowerCase() ?? ""]}
                  isCurrent={(m) => !!draft?.moves.includes(m)}
                  onPick={
                    draft &&
                    onApply &&
                    ((m) => {
                      if (draft.moves.includes(m)) return;
                      // First empty slot, else the last one.
                      const slot = draft.moves.indexOf("");
                      const i = slot === -1 ? draft.moves.length - 1 : slot;
                      onApply({ moves: draft.moves.map((x, j) => (j === i ? m : x)) });
                    })
                  }
                />
                <div className="grid content-start gap-4">
                  <OptionList
                    title={t("set.item")}
                    options={ranked(data.build.items)}
                    label={names.item}
                    icon={(item) => <ItemIcon item={item} />}
                    isCurrent={(i) => draft?.item === i}
                    onPick={onApply && ((item) => onApply({ item }))}
                  />
                  <OptionList
                    title={t("set.ability")}
                    options={ranked(data.build.abilities)}
                    label={names.ability}
                    isCurrent={(a) => draft?.ability === a}
                    onPick={onApply && ((ability) => onApply({ ability }))}
                  />
                  {gen === 9 && (
                    <OptionList
                      title={t("set.tera")}
                      options={ranked(data.build.teraTypes)}
                      label={names.type}
                      icon={(type) => <TypeIcon type={type} />}
                      color={(type) => TYPE_COLORS[type.toLowerCase()]}
                      isCurrent={(type) => draft?.teraType === type}
                      onPick={onApply && ((teraType) => onApply({ teraType }))}
                    />
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Spreads, where the EVs go, and what they're built for */}
          {Object.keys(data.spreads).length > 0 && (
            <Section title={t("meta.spreads")}>
              <OptionList
                title={t("meta.topSpreads")}
                options={ranked(data.spreads)}
                label={spreadLabel}
                limit={8}
                relative
                isCurrent={(spread) => {
                  if (!draft) return false;
                  const { nature, evs } = parseSpread(spread);
                  return nature === draft.nature && STATS.every((s) => evs[s] === draft.evs[s]);
                }}
                onPick={onApply && ((spread) => onApply(parseSpread(spread)))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid content-start gap-1.5">
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("meta.distribution")}
                  </h4>
                  {Object.entries(statDistribution(data.spreads)).map(([stat, ev]) => (
                    <div
                      key={stat}
                      className="grid grid-cols-[3.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span style={{ color: ink(STAT_COLORS[stat]) }}>{statLabel(stat)}</span>
                      <Bar share={ev} max={EV_MAX} color={STAT_COLORS[stat]} />
                      <span className="text-right tabular-nums">{ev}</span>
                    </div>
                  ))}
                </div>
                <div className="grid content-start gap-1.5">
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("meta.roles")}
                  </h4>
                  {roleShares(data.spreads).map(([role, share]) => (
                    <div
                      key={role}
                      className="grid grid-cols-[minmax(0,1fr)_4rem_3rem] items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: ROLE_COLORS[role] }}
                        />
                        <span className="truncate">{t(`meta.role.${role}` as MessageKey)}</span>
                      </span>
                      <Bar share={share} color={ROLE_COLORS[role]} />
                      <span className="text-right tabular-nums">{pct(share)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* Skill ceiling: how well the best players do with it (GXE, 0-100) */}
          {data.viability && (
            <Section title={t("meta.ceiling")}>
              <div className="grid gap-1.5">
                {(
                  [
                    [t("meta.top1"), data.viability[1]],
                    [t("meta.top99"), data.viability[2]],
                    [t("meta.top95"), data.viability[3]],
                  ] as const
                ).map(([label, gxe]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[6rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span>{label}</span>
                    <Bar share={gxe} max={100} />
                    <span className="text-right tabular-nums">{gxe} GXE</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Teammates and threats share one tile layout */}
          {[
            {
              key: "teammates",
              title: t("meta.teammates"),
              rows: ranked(data.teammates)
                .slice(0, 9)
                .map(([name, share]) => ({ name, value: pct(share), sub: "" })),
            },
            {
              key: "threats",
              title: t("meta.threats"),
              rows: data.counters.slice(0, 9).map((c) => ({
                name: c.name,
                value: fmt.percent(c.ko + c.switched),
                sub: t("meta.koSwitch", {
                  ko: Math.round(c.ko * 100),
                  sw: Math.round(c.switched * 100),
                }),
              })),
            },
          ]
            .filter((block) => block.rows.length)
            .map((block) => (
              <Section key={block.key} title={block.title}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {block.rows.map((row) => (
                    <Tile key={row.name} species={links ? row.name : undefined} format={format}>
                      <img
                        src={artwork(idOf(row.name))}
                        alt=""
                        width={36}
                        height={36}
                        loading="lazy"
                        decoding="async"
                        className="size-9 shrink-0 object-contain"
                      />
                      <span className="grid min-w-0 gap-0.5">
                        <span className="truncate text-xs font-medium text-foreground">
                          {names.pokemon(idOf(row.name), row.name)}
                        </span>
                        <span className="truncate text-[11px] tabular-nums text-muted-foreground">
                          {row.sub || row.value}
                        </span>
                      </span>
                    </Tile>
                  ))}
                </div>
              </Section>
            ))}
        </>
      )}

      {/* Type matchups of the current set */}
      {groups.length > 0 && (
        <Section
          title={tera ? t("meta.matchupsTera", { type: names.type(tera) }) : t("meta.matchups")}
        >
          <div className="grid gap-2">
            {groups.map(({ mult, types }) => (
              <div key={mult} className="flex items-start gap-3">
                <span
                  className={cn(
                    "w-10 shrink-0 pt-1 text-xs font-medium tabular-nums",
                    mult > 1
                      ? "text-rose-500"
                      : mult === 0
                        ? "text-foreground"
                        : "text-emerald-500",
                  )}
                >
                  ×{mult === 0.5 ? "½" : mult === 0.25 ? "¼" : mult}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {types.map((type) => (
                    <TypeChip key={type} type={type} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
