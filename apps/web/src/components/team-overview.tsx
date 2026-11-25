// The team page: the whole party with full sets, then the Box. Editable for the player's own teams
// (routes/team.$teamId.tsx), read-only for a shared link (routes/team.shared.tsx). Built from the
// home card's pieces: set summary, move details, set editor, add and share dialogs.
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { Dialog, DialogContent } from "@pkmnteambuilder/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@pkmnteambuilder/ui/components/dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  BoxIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { DexTip } from "@/components/dex-tip";
import { HowToGet } from "@/components/how-to-get";
import { ShoppingList } from "@/components/shopping-list";
import { MetaTab } from "@/components/meta-tab";
import { TypeCoverage } from "@/components/type-coverage";
import { prefetchSetSpecies, SetEditor } from "@/components/set-editor";
import {
  AddPokemonDialog,
  dialogContentClass,
  loadBuildFor,
  loadGame,
  MAX_ROWS,
  memberDraft,
  newMember,
  type PokemonSet,
  SetSummary,
  ShareTeamDialog,
  type PokemonOption,
  type Team,
  TypeBadge,
  useFormatName,
  useTeammateSuggestions,
  withDraft,
} from "@/components/stacked-list";
import { ink, loadDex, TypeIcon } from "@/components/data-colors";
import { TYPE_COLORS } from "@/components/type-chip";
import { artwork } from "@/lib/artwork";
import { useFormat } from "@/lib/format";
import { useI18n, useNames } from "@/lib/i18n";
import { formatGen } from "@/lib/legality";
import { PokemonImg, SpriteScope } from "@/lib/sprites";
import { blockedStarters } from "@/lib/starters";
import { GAMES } from "@/data/games/index";

// The team card's surface (StackedList): 28px radius, hairline border, page background.
const cardClass = "rounded-[28px] border border-border bg-background p-6";

export interface TeamActions {
  onAdd: (pokemon: PokemonSet) => void;
  onUpdate: (pokemon: PokemonSet) => void;
  onRemove: (id: string) => void;
}

export function TeamOverview({
  team,
  actions,
  headerAction,
}: {
  team: Team;
  actions?: TeamActions; // absent: read-only
  headerAction?: ReactNode;
}) {
  const { t } = useI18n();
  const formatName = useFormatName();
  const queryClient = useQueryClient();
  const competitive = team.mode !== "adventure";
  const party = team.pokemon.filter((p) => p.inTeam).slice(0, MAX_ROWS);
  const box = team.pokemon.filter((p) => !party.includes(p));
  const partyFull = party.length >= MAX_ROWS;
  const [editing, setEditing] = useState<PokemonSet | null>(null);
  const [view, setView] = useState<"team" | "coverage" | "meta">("team");
  // Adventure: one starter per playthrough, as on the home card (lib/starters.ts).
  const game = useQuery({
    queryKey: ["game", team.format],
    queryFn: () => loadGame(team.format),
    enabled: team.mode === "adventure",
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
  const starterBlocked = useMemo(
    () =>
      game
        ? blockedStarters(
            game,
            team.pokemon.map((p) => p.pokeapiId),
          )
        : undefined,
    [game, team.pokemon],
  );
  const [adding, setAdding] = useState(false);
  // Teammate suggestions in the first free slot, as on the home card; picking one opens its set editor.
  const suggestions = useTeammateSuggestions(team, actions ? party : []);
  const [suggestedPick, setSuggestedPick] = useState<PokemonOption | null>(null);

  const loadBuild = (species: string) => loadBuildFor(queryClient, team.mode, team.format, species);
  const card = (member: PokemonSet) => (
    <MemberCard
      key={member.id}
      team={team}
      member={member}
      inParty={party.includes(member)}
      actions={
        actions && {
          edit: competitive ? () => setEditing(member) : undefined,
          prefetch:
            team.mode === "adventure"
              ? undefined
              : () =>
                  prefetchSetSpecies(
                    queryClient,
                    team.mode as "smogon" | "vgc",
                    team.format,
                    member.name,
                    () => loadBuild(member.name),
                  ),
          move: party.includes(member)
            ? () => actions.onUpdate({ ...member, inTeam: false })
            : partyFull
              ? undefined
              : () => actions.onUpdate({ ...member, inTeam: true }),
          remove: () => actions.onRemove(member.id),
        }
      }
    />
  );

  return (
    <SpriteScope versionGroup={game ? versionGroupOf(team.format) : undefined}>
      <div className="container mx-auto grid max-w-6xl content-start gap-8 px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/"
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon size={14} />
              {t("page.back")}
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <span className="truncate">{team.name}</span>
              <span className="mt-0.5 rounded-full bg-muted px-2 py-1 text-xs leading-none font-normal text-muted-foreground">
                {party.length}/{MAX_ROWS}
              </span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(`mode.${team.mode}`)} · {formatName(team.mode, team.format)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
            {actions && (
              <AddPokemonDialog
                mode={team.mode}
                format={team.format}
                rules={team.rules}
                blocked={starterBlocked}
                open={adding}
                onOpenChange={(open) => {
                  setAdding(open);
                  if (!open) setSuggestedPick(null);
                }}
                startWith={suggestedPick}
                onAdd={(option) => actions.onAdd(newMember(team, option, !partyFull))}
                onAddSet={
                  competitive
                    ? (option, draft) => actions.onAdd(newMember(team, option, !partyFull, draft))
                    : undefined
                }
              />
            )}
            <ShareTeamDialog team={team} />
          </div>
        </header>

        {/* The team itself, or its type coverage table. */}
        <div role="tablist" className="flex w-fit gap-1 rounded-full bg-muted/40 p-1">
          {(competitive
            ? (["team", "coverage", "meta"] as const)
            : (["team", "coverage"] as const)
          ).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                "h-9 rounded-full px-5 text-sm font-medium transition-colors",
                view === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(
                key === "team"
                  ? "page.tabTeam"
                  : key === "coverage"
                    ? "page.tabCoverage"
                    : "page.tabMeta",
              )}
            </button>
          ))}
        </div>

        {view === "coverage" ? (
          <TypeCoverage team={team} />
        ) : view === "meta" && competitive ? (
          <MetaTab team={team} />
        ) : (
          <>
            <section className="grid gap-4">
              <h2 className="text-sm font-medium text-muted-foreground">{t("page.party")}</h2>
              {/* Two rows of three on wide screens: the whole party at a glance. */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {party.map(card)}
                {suggestions.length > 0 && (
                  <SuggestionCard
                    suggestions={suggestions}
                    onPick={(option) => {
                      setSuggestedPick(option);
                      setAdding(true);
                    }}
                    onOther={() => setAdding(true)}
                  />
                )}
                {Array.from(
                  { length: MAX_ROWS - party.length - (suggestions.length > 0 ? 1 : 0) },
                  (_, i) => (
                    // Styled like the home page's "New team" card: it stretches to the row, so the whole
                    // card is the dashed outline and its content sits centred.
                    <button
                      key={`empty-${i}`}
                      type="button"
                      disabled={!actions}
                      onClick={() => setAdding(true)}
                      className="group/slot flex min-h-48 flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-muted-foreground/40 text-muted-foreground opacity-60 transition-opacity enabled:hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/60 transition-transform group-enabled/slot:group-hover/slot:scale-105">
                        {actions && <PlusIcon size={20} strokeWidth={2} />}
                      </span>
                      <span className="text-sm font-medium tracking-tight">
                        {t("team.emptySlot")}
                      </span>
                    </button>
                  ),
                )}
              </div>
            </section>

            {competitive && <ShoppingList team={team} />}

            {box.length > 0 && (
              <section className="grid gap-4">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t("page.box")} · {box.length}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{box.map(card)}</div>
              </section>
            )}
          </>
        )}

        {actions && (
          <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
            <DialogContent
              showCloseButton={false}
              className={`${dialogContentClass} max-h-[90dvh] overflow-y-auto sm:max-w-2xl`}
            >
              {editing && team.mode !== "adventure" && (
                <SetEditor
                  key={editing.id}
                  mode={team.mode}
                  format={team.format}
                  species={editing.name}
                  pokeapiId={editing.pokeapiId}
                  sprite={artwork(editing.pokeapiId)}
                  loadBuild={() => loadBuild(editing.name)}
                  initial={memberDraft(editing)}
                  confirmLabel={t("set.save")}
                  onBack={() => setEditing(null)}
                  onConfirm={(draft) => {
                    actions.onUpdate(withDraft(team, editing, draft));
                    setEditing(null);
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </SpriteScope>
  );
}

// The first free slot of a competitive party: the species most used with it, one tap to add with its set.
function SuggestionCard({
  suggestions,
  onPick,
  onOther,
}: {
  suggestions: { option: PokemonOption; share: number }[];
  onPick: (option: PokemonOption) => void;
  onOther: () => void;
}) {
  const { t } = useI18n();
  const names = useNames();
  const fmt = useFormat();
  return (
    <div className="flex min-h-48 flex-col gap-3 rounded-[28px] border-2 border-dashed border-muted-foreground/40 p-5">
      <p className="flex items-center gap-1.5 text-sm font-medium tracking-tight text-muted-foreground">
        <SparklesIcon size={14} />
        {t("team.suggested")}
      </p>
      <div className="grid gap-1.5">
        {suggestions.map(({ option, share }) => {
          const name = names.pokemon(option.pokeapiId, option.name);
          return (
            <button
              key={option.key}
              type="button"
              aria-label={t("team.addSuggestion", { name })}
              onClick={() => onPick(option)}
              className="flex items-center gap-3 rounded-2xl bg-muted/40 py-1.5 pr-3 pl-1.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <PokemonImg
                id={option.pokeapiId}
                decoding="async"
                alt=""
                className="size-9 shrink-0 object-contain"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {name}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {fmt.percent(share)}
              </span>
              <PlusIcon size={14} className="shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onOther}
        className="mt-auto w-fit rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {t("team.suggestOther")}
      </button>
    </div>
  );
}

const gameGen = (version: string) =>
  GAMES.find((g) => (g.versions as readonly string[]).includes(version))?.generation ?? 9;
const versionGroupOf = (version: string) =>
  GAMES.find((g) => (g.versions as readonly string[]).includes(version))?.versionGroup;

interface CardActions {
  edit?: () => void;
  prefetch?: () => void;
  move?: () => void; // party <-> Box; absent when the party is full
  remove: () => void;
}

function MemberCard({
  team,
  member,
  inParty,
  actions,
}: {
  team: Team;
  member: PokemonSet;
  inParty: boolean;
  actions?: CardActions;
}) {
  const { t } = useI18n();
  const names = useNames();
  const name = names.pokemon(member.pokeapiId, member.name);
  const hasSet = !!(member.item || member.ability || member.moves.length);
  // Competitive sets get a second tab: how to get the item and the moves, what the set needs.
  const learnable = team.mode !== "adventure" && hasSet;
  const [tab, setTab] = useState<"set" | "learn">("set");
  return (
    <article className={`${cardClass} grid content-start gap-5`}>
      {/* The team card's member row: round artwork, then the name over its types. */}
      <div className="flex items-center">
        <PokemonImg
          id={member.pokeapiId}
          alt=""
          className="mr-4 size-12 shrink-0 rounded-full bg-muted object-contain shadow-sm ring-2 ring-background"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base leading-none font-semibold tracking-tight text-foreground">
            {/* The member's Pokémon page: in the team's format, or (adventure) its game's generation
                alone. Adventure members are stored by national dex number ("#94"). */}
            <Link
              to="/pokemon/$species"
              params={{ species: team.mode === "adventure" ? member.name.slice(1) : member.name }}
              search={
                team.mode === "adventure" ? { gen: gameGen(team.format) } : { format: team.format }
              }
              title={t("pokemon.view", { name })}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {name}
            </Link>
          </h3>
          {/* Its own types, then apart, after a divider, the Tera type (gem icon). */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {member.types.map((type) => (
                <TypeBadge key={type} type={type} small />
              ))}
            </div>
            {member.teraType && (
              <>
                <span aria-hidden className="h-4 w-px bg-border" />
                <TypeBadge type={member.teraType} tera small />
              </>
            )}
          </div>
          {/* Item and ability are in the set just below; say so only when there is none. */}
          {!hasSet && (
            <p className="mt-2 text-sm leading-none font-medium text-muted-foreground opacity-80">
              {t("page.noSet")}
            </p>
          )}
        </div>
        {actions && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={t("row.actions", { name })}
                  // Opening the menu comes just before "Edit set": warm the editor's data then.
                  onPointerEnter={actions.prefetch}
                  onFocus={actions.prefetch}
                  className="ml-2 flex size-8 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              }
            >
              <EllipsisIcon size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 bg-card">
              {actions.edit && (
                <DropdownMenuItem onClick={actions.edit}>
                  <PencilIcon />
                  {t("row.edit")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={actions.move} disabled={!actions.move}>
                {inParty ? <BoxIcon /> : <UsersIcon />}
                {inParty ? t("page.toBox") : t("page.toParty")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={actions.remove}>
                <Trash2Icon />
                {t("row.remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Two tabs keep every card one height: the set, or how to get its moves. */}
      {learnable && (
        <div role="tablist" className="flex gap-1 rounded-full bg-muted/40 p-1">
          {(["set", "learn"] as const).map((key) => (
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
              {t(key === "set" ? "set.tabSet" : "page.tabLearn")}
            </button>
          ))}
        </div>
      )}

      {tab === "learn" && learnable ? (
        <div className="text-xs">
          <HowToGet member={member} gen={formatGen(team.format)} />
        </div>
      ) : (
        <>
          {hasSet && (
            <div className="grid gap-2 border-t border-border/40 pt-4 text-xs leading-snug">
              <SetSummary
                member={member}
                moves={false}
                tipsGen={team.mode === "adventure" ? undefined : formatGen(team.format)}
              />
            </div>
          )}

          {member.moves.length > 0 && (
            <MoveList
              moves={member.moves}
              gen={team.mode === "adventure" ? undefined : formatGen(team.format)}
            />
          )}
        </>
      )}
    </article>
  );
}

// The moves as the set editor shows them: a muted field each, the type's icon and a border in its colour.
function MoveList({ moves, gen }: { moves: string[]; gen?: number }) {
  const names = useNames();
  // Same cache entry as the set editor's ["dex", gen]. Adventure teams have no moves to type.
  const dex = useQuery({
    queryKey: ["dex", gen],
    queryFn: () => loadDex(gen!),
    enabled: gen !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return (
    <ul className="grid grid-cols-2 gap-2">
      {moves.map((move) => {
        const data = dex.data?.moves.get(move);
        const type = data?.exists ? data.type : undefined;
        return (
          <li
            key={move}
            className="relative flex h-10 min-w-0 items-center rounded-xl bg-muted/40 px-3 text-sm text-foreground"
            style={{
              border: type ? `1px solid ${ink(TYPE_COLORS[type.toLowerCase()])}` : undefined,
            }}
          >
            {type && (
              <span className="mr-2 flex shrink-0">
                <TypeIcon type={type} />
              </span>
            )}
            {gen === undefined ? (
              <span className="truncate">{names.move(move)}</span>
            ) : (
              <DexTip kind="move" name={move} gen={gen} className="truncate">
                {names.move(move)}
              </DexTip>
            )}
          </li>
        );
      })}
    </ul>
  );
}
