// The Pokémon page's recommended sets (Smogon's analysis sets, then the most used build, as the set
// editor offers them) and the "Add to a team" menu: one of the player's teams in this format, or a new one.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pkmnteambuilder/ui/components/dropdown-menu";
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CopyIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { analysisQuery } from "@/components/set-editor";
import {
  loadBuildFor,
  loadCompetitive,
  MAX_ROWS,
  newMember,
  type PokemonOption,
  SetSummary,
  type Team,
} from "@/components/stacked-list";
import { useI18n, useNames } from "@/lib/i18n";
import { type CompetitiveMode, formatGen, formatInfo } from "@/lib/legality";
import {
  fromAnalysis,
  fromUsage,
  type Recommendation,
  type SetDraft,
  toShowdown,
} from "@/lib/sets";
import { useTeams } from "@/lib/teams";

// The species as the team builder lists it in this format: undefined while loading, null when the
// format doesn't allow it.
// No format (a generation alone, on the Pokémon page): nothing is loaded.
export function useFormatOption(format: string | undefined, species: string) {
  const mode = (formatInfo(format ?? "")?.mode ?? "smogon") as CompetitiveMode;
  // Same cache entry as the team builder's species list.
  const options = useQuery({
    queryKey: ["pokemon-options", mode, format],
    queryFn: () => loadCompetitive(format!),
    enabled: !!format,
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (!options.data) return undefined;
  return options.data.find((o) => o.name === species) ?? null;
}

// Analysis sets then the most used build, as the set editor lists them.
export function useRecommendations(
  format: string | undefined,
  species: string,
  fallbackAbility: string,
) {
  const queryClient = useQueryClient();
  const mode = (formatInfo(format ?? "")?.mode ?? "smogon") as CompetitiveMode;
  const analysis = useQuery({
    ...analysisQuery(format ?? ""),
    enabled: !!format && mode === "smogon",
  });
  // Same cache entry as the set editor's build query.
  const build = useQuery({
    queryKey: ["build", mode, format, species],
    queryFn: async () => (await loadBuildFor(queryClient, mode, format!, species)) ?? null,
    enabled: !!format,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const recommendations: Recommendation[] = [
    ...Object.entries(analysis.data?.[species] ?? {}).map(([name, set]) =>
      fromAnalysis(name, set, fallbackAbility),
    ),
    ...(build.data ? [fromUsage(build.data, fallbackAbility)] : []),
  ];
  const loading = (mode === "smogon" && analysis.isPending) || build.isPending;
  return { recommendations, loading };
}

export function RecommendedSets({
  format,
  option,
  recommendations,
  loading,
}: {
  format: string;
  option: PokemonOption | null | undefined;
  recommendations: Recommendation[];
  loading: boolean;
}) {
  const { t } = useI18n();
  if (loading) return <p className="text-xs text-muted-foreground">{t("common.loading")}</p>;
  if (!recommendations.length || !option)
    return <p className="text-xs text-muted-foreground">{t("pokemon.noSets")}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {recommendations.map((rec) => (
        <SetCard key={rec.name} format={format} option={option} rec={rec} />
      ))}
    </div>
  );
}

function SetCard({
  format,
  option,
  rec,
}: {
  format: string;
  option: PokemonOption;
  rec: Recommendation;
}) {
  const { t } = useI18n();
  const mode = formatInfo(format)!.mode as CompetitiveMode;
  // The set as a team member would hold it, for the summary the team page shows.
  const member = newMember(
    { id: "", name: "", mode, format, pokemon: [] },
    option,
    true,
    rec.draft,
  );
  return (
    <article className="grid content-start gap-3 rounded-2xl bg-muted/30 p-4 text-xs leading-snug">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-medium text-foreground">
          {rec.name === "usage" ? t("set.usage") : rec.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={t("row.copy")}
            title={t("row.copy")}
            onClick={() =>
              navigator.clipboard
                .writeText(toShowdown(option.name, rec.draft))
                .then(() => toast.success(t("row.copied")))
                .catch(() => toast.error(t("common.copyFailed")))
            }
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <CopyIcon size={14} />
          </button>
          <AddToTeam format={format} option={option} draft={rec.draft} compact />
        </div>
      </div>
      <SetSummary member={member} tipsGen={formatGen(format)} />
    </article>
  );
}

// Adds the species (with `draft` as its set, if any) to one of the player's teams in this format, or
// to a new one. A full party sends it to the Box.
export function AddToTeam({
  format,
  option,
  draft,
  compact = false,
}: {
  format: string;
  option: PokemonOption | null | undefined;
  draft?: SetDraft;
  compact?: boolean; // icon only, for the set cards
}) {
  const { t } = useI18n();
  const names = useNames();
  const navigate = useNavigate();
  const { teams, addTeam, addPokemon } = useTeams();
  const info = formatInfo(format);
  const mode = info?.mode as CompetitiveMode | undefined;
  const mine = teams.filter((team) => team.format === format);
  const disabled = !option || !mode;
  const label = draft && compact ? t("pokemon.addSet") : t("pokemon.add");

  const open = (team: Team) => navigate({ to: "/team/$teamId", params: { teamId: team.id } });
  const addTo = (team: Team) => {
    if (!option) return;
    const party = team.pokemon.filter((p) => p.inTeam).length;
    const inParty = party < MAX_ROWS;
    addPokemon(team.id, newMember(team, option, inParty, draft));
    const name = names.pokemon(option.pokeapiId, option.name);
    toast.success(t(inParty ? "pokemon.added" : "pokemon.addedBox", { name, team: team.name }), {
      action: { label: t("pokemon.open"), onClick: () => void open(team) },
    });
  };
  const createTeam = () => {
    if (!option || !mode) return;
    const team: Team = {
      id: crypto.randomUUID(),
      name: names.pokemon(option.pokeapiId, option.name),
      mode,
      format,
      pokemon: [],
    };
    team.pokemon = [newMember(team, option, true, draft)];
    addTeam(team);
    void open(team);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            aria-label={label}
            title={option === null ? t("pokemon.notLegal") : label}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              compact
                ? "size-8 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                : "h-10 bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90",
            )}
          />
        }
      >
        <PlusIcon size={compact ? 14 : 16} />
        {!compact && (option === null ? t("pokemon.notLegal") : label)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 bg-card">
        {mine.length > 0 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("pokemon.yourTeams")}</DropdownMenuLabel>
              {mine.map((team) => (
                <DropdownMenuItem key={team.id} onClick={() => addTo(team)}>
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {team.pokemon.filter((p) => p.inTeam).length}/{MAX_ROWS}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={createTeam}>
          <PlusIcon />
          {t("pokemon.newTeam")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
