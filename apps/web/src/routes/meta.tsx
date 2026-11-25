// The Meta page: what a format's ladder plays this month (most used, risers and fallers) and the cores
// it builds on (duos, likely trios), each one click from a new team with the most used sets.
// From Smogon's usage stats only (lib/format-meta.ts): they count teams, not wins.
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, InfoIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { loadDex, TypeIcon } from "@/components/data-colors";
import { defaultDraft } from "@/components/set-editor";
import { Card, pokeapiId, Sprite, Usage } from "@/components/meta-tab";
import {
  loadBuildFor,
  loadCompetitive,
  newMember,
  type Team,
  useFormatName,
} from "@/components/stacked-list";
import { artwork } from "@/lib/artwork";
import { type Core, likelyTrios, movers, topDuos } from "@/lib/cores";
import { useFormat } from "@/lib/format";
import { hasStats, loadFormatMeta } from "@/lib/format-meta";
import { useI18n, useNames } from "@/lib/i18n";
import { type CompetitiveMode, FORMATS, type FormatInfo, formatInfo, gensOf } from "@/lib/legality";
import { trend } from "@/lib/meta-team";
import { useTeams } from "@/lib/teams";

const DEFAULT_FORMAT = "gen9ou";
const TOP = 30;

const withStats = (f: FormatInfo) => hasStats(f.id, f.mode, f.gen);
const formatsOf = (mode: CompetitiveMode, gen: number) =>
  FORMATS.filter((f) => f.mode === mode && f.gen === gen && withStats(f));

export const Route = createFileRoute("/meta")({
  validateSearch: (search: Record<string, unknown>): { format?: string } => {
    const info = typeof search.format === "string" ? formatInfo(search.format) : undefined;
    return { format: info && withStats(info) ? info.id : undefined };
  },
  head: () => ({ meta: [{ title: "Meta · pkmnteambuilder" }] }),
  component: MetaPage,
});

function MetaPage() {
  const { t } = useI18n();
  const info = formatInfo(Route.useSearch().format ?? DEFAULT_FORMAT)!;
  return (
    <div className="container mx-auto grid grid-cols-1 content-start gap-6 px-4 py-6">
      <h1 className="text-xl font-semibold tracking-tight">{t("meta.title")}</h1>
      <FormatPicker info={info} />
      {/* Keyed: a new format starts back on its default cutoff. */}
      <Board key={info.id} format={info.id} mode={info.mode} gen={info.gen} />
    </div>
  );
}

const chip = (active: boolean) =>
  cn(
    "rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    active && "border-foreground bg-foreground text-background hover:bg-foreground",
  );

function FormatPicker({ info }: { info: FormatInfo }) {
  const { t } = useI18n();
  const formatName = useFormatName();
  const mode = info.mode as CompetitiveMode;
  const gens = gensOf(mode).filter((gen) => formatsOf(mode, gen).length > 0);
  const to = (format: string) => ({ to: "/meta" as const, search: { format } });
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {(["smogon", "vgc"] as const).map((m) => (
          <Link
            key={m}
            {...to(
              formatsOf(
                m,
                gensOf(m).find((g) => formatsOf(m, g).length)!,
              )[0]!.id,
            )}
            aria-current={m === mode ? "page" : undefined}
            className={cn(chip(m === mode), "px-4 py-1.5 text-sm")}
          >
            {t(`mode.${m}`)}
          </Link>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        {gens.map((gen) => (
          <Link
            key={gen}
            {...to(formatsOf(mode, gen)[0]!.id)}
            aria-current={gen === info.gen ? "page" : undefined}
            className={chip(gen === info.gen)}
          >
            {t("format.gen", { gen })}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {formatsOf(mode, info.gen).map((f) => (
          <Link
            key={f.id}
            {...to(f.id)}
            aria-current={f.id === info.id ? "page" : undefined}
            className={chip(f.id === info.id)}
          >
            {formatName(f.mode, f.id, true)}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Board({ format, mode, gen }: { format: string; mode: CompetitiveMode; gen: number }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const names = useNames();
  const meta = useQuery({
    queryKey: ["format-meta", format],
    queryFn: () => loadFormatMeta(format),
    staleTime: Number.POSITIVE_INFINITY,
  });
  // Same cache entries as the set editor's ["dex", gen] and the add dialog's legal species.
  const dex = useQuery({
    queryKey: ["dex", gen],
    queryFn: () => loadDex(gen),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const options = useQuery({
    queryKey: ["pokemon-options", mode, format],
    queryFn: () => loadCompetitive(format),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [cutoff, setCutoff] = useState<string | null>(null);
  const start = useStartTeam(format, mode, options.data);

  const cores = useMemo(() => {
    if (!meta.data) return null;
    const stats = { usage: meta.data.usage, teammates: meta.data.teammates };
    return { duos: topDuos(stats, 10), trios: likelyTrios(stats, 6) };
  }, [meta.data]);

  if (meta.isPending || !dex.data)
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!meta.data || !cores)
    return <p className="text-sm text-muted-foreground">{t("meta.noStats")}</p>;

  const { history, teammates } = meta.data;
  const shown = cutoff ?? (history ? String(history.cutoff) : null);
  const usage = (shown && history?.cutoffs[shown]) || meta.data.usage;
  const top = Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP);
  const defaultUsage = history?.cutoffs[String(history.cutoff)];
  const change = (name: string) => trend(defaultUsage?.[name], history?.previous?.usage[name]);
  const moved = defaultUsage && history?.previous && movers(defaultUsage, history.previous.usage);

  const species = (name: string) => {
    const sp = dex.data.species.get(name);
    const id = pokeapiId(name, sp.num);
    return { num: sp.num, types: sp.types as string[], label: names.pokemon(id, name) };
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {history ? (
          <>
            <span>{t("mt.cutoff")}</span>
            {Object.keys(history.cutoffs).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={shown === c}
                onClick={() => setCutoff(c)}
                className={chip(shown === c)}
              >
                {c === "0" ? t("mt.allPlayers") : `${c}+`}
              </button>
            ))}
          </>
        ) : (
          mode === "vgc" && gen === 9 && <span>{t("meta.retired")}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t("meta.top", { n: top.length })}>
          <ol className="grid grid-cols-1 gap-1">
            {top.map(([name, share], i) => {
              const sp = species(name);
              const partners = Object.entries(teammates[name] ?? {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
              return (
                <li
                  key={name}
                  className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/40"
                >
                  <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <Sprite name={name} num={sp.num} small />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {sp.label}
                      </span>
                      <span className="flex shrink-0 gap-0.5">
                        {sp.types.map((type) => (
                          <TypeIcon key={type} type={type} />
                        ))}
                      </span>
                    </span>
                  </span>
                  {partners.length > 0 && (
                    <span
                      className="hidden shrink-0 items-center gap-1 text-muted-foreground sm:flex"
                      title={partners
                        .map(([p, s]) => `${species(p).label} ${fmt.percent(s)}`)
                        .join(" · ")}
                    >
                      <span className="text-[10px] uppercase opacity-70">{t("meta.with")}</span>
                      <span className="flex -space-x-1.5">
                        {partners.map(([p]) => (
                          <img
                            key={p}
                            src={artwork(pokeapiId(p, species(p).num))}
                            alt=""
                            loading="lazy"
                            className="size-5 rounded-full bg-muted object-contain ring-1 ring-background"
                          />
                        ))}
                      </span>
                    </span>
                  )}
                  <span className="w-16 shrink-0 text-right">
                    <Usage share={share} change={change(name)} />
                  </span>
                  <button
                    type="button"
                    disabled={!start.ready}
                    onClick={() => start.run([name])}
                    aria-label={t("meta.buildAround", { name: sp.label })}
                    title={t("meta.buildAround", { name: sp.label })}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <PlusIcon size={13} />
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="grid grid-cols-1 content-start gap-6">
          <Card title={t("meta.duos")}>
            <CoreList cores={cores.duos} species={species} start={start} />
          </Card>
          <Card title={t("meta.trios")}>
            <CoreList cores={cores.trios} species={species} start={start} estimate />
          </Card>
          {moved && history?.previous && (
            <Card title={t("meta.movers", { month: fmt.month(history.previous.month) })}>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["rising", "falling"] as const).map((way) => (
                  <div key={way} className="grid content-start gap-1.5">
                    <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {t(`meta.${way}`)}
                    </h4>
                    {moved[way].map((m) => {
                      const sp = species(m.name);
                      return (
                        <div key={m.name} className="flex items-center gap-2">
                          <Sprite name={m.name} num={sp.num} small />
                          <span className="min-w-0 flex-1 truncate">{sp.label}</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 tabular-nums",
                              way === "rising"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {way === "rising" ? (
                              <ArrowUpIcon size={11} />
                            ) : (
                              <ArrowDownIcon size={11} />
                            )}
                            {fmt.delta(m.change * 100)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <InfoIcon size={14} className="mt-px shrink-0" />
        {t("meta.disclaimer")}
      </p>
    </div>
  );
}

type SpeciesInfo = (name: string) => { num: number; types: string[]; label: string };

function CoreList({
  cores,
  species,
  start,
  estimate,
}: {
  cores: Core[];
  species: SpeciesInfo;
  start: StartTeam;
  estimate?: boolean;
}) {
  const { t } = useI18n();
  const fmt = useFormat();
  if (cores.length === 0) return <p className="text-muted-foreground">{t("meta.noCores")}</p>;
  return (
    <ul className="grid grid-cols-1 gap-1.5">
      {cores.map((core) => {
        const labels = core.members.map((m) => species(m).label);
        return (
          <li
            key={core.members.join("+")}
            className="flex items-center gap-3 rounded-xl bg-muted/30 px-2 py-1.5"
          >
            <span className="flex shrink-0 -space-x-2">
              {core.members.map((m) => (
                <span key={m} className="rounded-full ring-2 ring-background">
                  <Sprite name={m} num={species(m).num} />
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">
                {labels.join(" + ")}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {t(estimate ? "meta.teamsEstimate" : "meta.teams", {
                  share: fmt.percent(core.share, 1),
                })}
              </span>
            </span>
            <button
              type="button"
              disabled={!start.ready}
              onClick={() => start.run(core.members)}
              title={t("meta.startHint", { name: labels.join(" + ") })}
              className="shrink-0 rounded-full border border-border/60 px-3 py-1 text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
            >
              {t("meta.start")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface StartTeam {
  ready: boolean;
  run: (members: string[]) => void;
}

// A new team from a core: each member with the set the editor would open it on (Smogon analysis, else
// the most used build), then its team page, where the first
// free slot already suggests who usually comes next.
function useStartTeam(
  format: string,
  mode: CompetitiveMode,
  options: Awaited<ReturnType<typeof loadCompetitive>> | undefined,
): StartTeam {
  const { t } = useI18n();
  const names = useNames();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { addTeam } = useTeams();
  const [busy, setBusy] = useState(false);
  const legal = useMemo(() => new Map(options?.map((o) => [o.name, o])), [options]);

  const run = async (members: string[]) => {
    const picked = members.flatMap((name) => legal.get(name) ?? []);
    if (picked.length === 0) return void toast.error(t("meta.notLegal"));
    setBusy(true);
    try {
      const team: Team = {
        id: crypto.randomUUID(),
        name: picked.map((o) => names.pokemon(o.pokeapiId, o.name)).join(" + "),
        mode,
        format,
        pokemon: [],
      };
      const drafts = await Promise.all(
        picked.map((o) =>
          defaultDraft(queryClient, mode, format, o.name, o.ability, () =>
            loadBuildFor(queryClient, mode, format, o.name),
          ),
        ),
      );
      team.pokemon = picked.map((o, i) => newMember(team, o, true, drafts[i]));
      addTeam(team);
      toast.success(t("meta.created", { name: team.name }));
      await navigate({ to: "/team/$teamId", params: { teamId: team.id } });
    } finally {
      setBusy(false);
    }
  };
  return { ready: !!options && !busy, run: (members) => void run(members) };
}
