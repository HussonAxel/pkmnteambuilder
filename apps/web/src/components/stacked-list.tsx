import { Button } from "@pkmnteambuilder/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@pkmnteambuilder/ui/components/dialog";
import { Input } from "@pkmnteambuilder/ui/components/input";
import { Label } from "@pkmnteambuilder/ui/components/label";
import {
  BoxIcon,
  CopyIcon,
  PencilIcon,
  Trash2Icon,
  GemIcon,
  InfoIcon,
  Maximize2Icon,
  type LucideIcon,
  ArrowLeftIcon,
  MapIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  SwordsIcon,
  TrophyIcon,
  CheckIcon,
  ChevronDownIcon,
  Share2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { FORM_ARTWORK_IDS } from "@/data/form-artwork-ids";
import { DexTip, frenchDescription } from "@/components/dex-tip";
import { MemberDetails } from "@/components/member-details";
import { prefetchSetFormat, prefetchSetSpecies, SetEditor } from "@/components/set-editor";
import { artwork } from "@/lib/artwork";
import { PokemonImg, SpriteScope } from "@/lib/sprites";
import {
  type Build,
  emptyEvs,
  type Evs,
  maxIvs,
  type SetDraft,
  STATS,
  missingParts,
  toShowdown,
} from "@/lib/sets";
import { encodeTeam, SHARE_PREFIX } from "@/lib/share";
import { GAMES } from "@/data/games/index";
import {
  affectedBy,
  availableIn,
  bestSource,
  DEFAULT_RULES,
  type GameData,
  type GamePokemon,
  RULE_KEYS,
  ruleImpact,
  type Rules,
  type Source,
} from "@/lib/availability";
import { authClient } from "@/lib/auth-client";
import { fold, type Lang, toIdentifier, useI18n, useNames } from "@/lib/i18n";
import { useTeams } from "@/lib/teams";
import { MESSAGES, type MessageKey } from "@/i18n/messages";
import { formatPercent, useFormat } from "@/lib/format";
import {
  competitiveFormats,
  formatGen,
  formatInfo,
  gensOf,
  type TeamMode,
  tiersAmong,
} from "@/lib/legality";
import { blockedStarters } from "@/lib/starters";
import { suggestTeammates, type UsageStats } from "@/lib/teammates";
import { Popover, PopoverContent, PopoverTrigger } from "@pkmnteambuilder/ui/components/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@pkmnteambuilder/ui/components/tooltip";
import { AnimatePresence, motion } from "motion/react";
import {
  Fragment,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";

export type PokemonType =
  | "Normal"
  | "Fire"
  | "Water"
  | "Electric"
  | "Grass"
  | "Ice"
  | "Fighting"
  | "Poison"
  | "Ground"
  | "Flying"
  | "Psychic"
  | "Bug"
  | "Rock"
  | "Ghost"
  | "Dragon"
  | "Dark"
  | "Steel"
  | "Fairy";

// PokeAPI type identifiers ("fire") to the capitalised form @pkmn/dex uses.
const toType = (identifier: string) =>
  (identifier[0]!.toUpperCase() + identifier.slice(1)) as PokemonType;

export interface PokemonSet {
  id: string;
  pokeapiId: number; // localised name + official artwork
  name: string; // English (@pkmn/dex) name; fallback while names load
  item: string; // "" until the set is edited
  ability: string; // "" when unknown (adventure)
  types: PokemonType[];
  teraType?: PokemonType; // gen 9 only
  moves: string[]; // up to 4
  nature?: string;
  evs?: Evs;
  ivs?: Evs;
  inTeam: boolean;
}

export const MAX_ROWS = 6;

const sweepSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 0.5,
};

const TYPE_STYLES: Record<PokemonType, string> = {
  Normal: "bg-neutral-50 text-neutral-700 border-neutral-200",
  Fire: "bg-orange-50 text-orange-800 border-orange-200",
  Water: "bg-sky-50 text-sky-800 border-sky-200",
  Electric: "bg-yellow-50 text-yellow-800 border-yellow-200",
  Grass: "bg-green-50 text-green-800 border-green-200",
  Ice: "bg-cyan-50 text-cyan-800 border-cyan-200",
  Fighting: "bg-red-50 text-red-800 border-red-200",
  Poison: "bg-purple-50 text-purple-800 border-purple-200",
  Ground: "bg-amber-50 text-amber-800 border-amber-200",
  Flying: "bg-indigo-50 text-indigo-800 border-indigo-200",
  Psychic: "bg-rose-50 text-rose-800 border-rose-200",
  Bug: "bg-lime-50 text-lime-800 border-lime-200",
  Rock: "bg-stone-50 text-stone-800 border-stone-200",
  Ghost: "bg-violet-50 text-violet-800 border-violet-200",
  Dragon: "bg-blue-50 text-blue-800 border-blue-200",
  Dark: "bg-zinc-100 text-zinc-800 border-zinc-300",
  Steel: "bg-slate-50 text-slate-700 border-slate-200",
  Fairy: "bg-pink-50 text-pink-800 border-pink-200",
};

export const TypeBadge = ({
  type,
  tera,
  small,
}: {
  type: PokemonType;
  tera?: boolean;
  small?: boolean; // fits next to a name in a row
}) => {
  const { t } = useI18n();
  const names = useNames();
  return (
    <div
      className={cn(
        "flex items-center rounded-full border shrink-0",
        small ? "gap-1 px-1.5 py-0.5" : "gap-1.5 px-2.5 py-1",
        TYPE_STYLES[type],
      )}
    >
      {tera && <GemIcon size={small ? 10 : 12} strokeWidth={1.8} aria-hidden />}
      {tera && <span className="sr-only">{t("pokemon.tera", { type: "" }).trim()}</span>}
      <span
        className={cn(
          "font-normal tracking-tight uppercase whitespace-nowrap",
          small ? "text-[10px] leading-none" : "text-xs",
        )}
      >
        {names.type(type)}
      </span>
    </div>
  );
};

// The item's bag sprite from the games, via PokeAPI. Most are 30×30 pixel art, shown
// at 24px with nearest-neighbour scaling; gen 9 items only have 160px renders, which fill their
// canvas, so they're drawn smaller (16px) and smoothly to match. Negative margins keep the 14px line.
const ItemSprite = ({ item }: { item: string }) => {
  const [failed, setFailed] = useState(false);
  const [hd, setHd] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${toIdentifier(item)}.png`}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      onError={() => setFailed(true)}
      onLoad={(e) => setHd(e.currentTarget.naturalWidth > 64)}
      className={cn(
        "shrink-0 object-contain",
        // Same visible size for both: pixel sprites have ~5px of empty border at 24px.
        hd ? "-my-px size-4" : "-my-[5px] -mx-1 size-6 [image-rendering:pixelated]",
      )}
    />
  );
};

const itemVariants = {
  hidden: { opacity: 0, x: 10, y: 15, rotate: 1 },
  visible: { opacity: 1, x: 0, y: 0, rotate: 0 },
};

export interface RowAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

// A calm slide that settles without bouncing.
const actionsSpring = { type: "spring", visualDuration: 0.5, bounce: 0 } as const;

const MemberItem = ({
  member,
  status,
  actions,
  menuOpen = false,
  onMenuChange,
  setTip = false,
  onRemove,
  missing,
  children,
}: {
  member: PokemonSet;
  status?: MemberStatus;
  // A click on the row slides these actions over it, from the right.
  actions?: RowAction[];
  menuOpen?: boolean;
  onMenuChange?: (open: boolean) => void;
  setTip?: boolean; // competitive modes: hovering the row shows its set
  // Removal mode (full party): a × at the end of the row removes the Pokémon.
  onRemove?: () => void;
  // Competitive modes: what the set still lacks (i18n keys); a badge flags incomplete sets.
  missing?: string[];
  // Shown under the row, inside its separators (the Box's move details).
  children?: React.ReactNode;
}) => {
  const names = useNames();
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);
  // The ability's own tooltip sits inside the row: hide the set card while it shows.
  const [abilityTipOpen, setAbilityTipOpen] = useState(false);
  const firstAction = useRef<HTMLButtonElement>(null);
  const name = names.pokemon(member.pokeapiId, member.name);
  const interactive = Boolean(actions?.length && onMenuChange);

  // Close on a press outside the row; focus the first action when it opens.
  useEffect(() => {
    if (!menuOpen) return;
    // preventScroll: focusing a button still off to the right would scroll the clipping pill
    // to reveal it mid-slide, which made the menu jump and snap back at the end.
    firstAction.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) onMenuChange?.(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen, onMenuChange]);

  return (
    <motion.div
      variants={itemVariants}
      transition={sweepSpring}
      style={{ originX: 1, originY: 1 }}
      className="py-4 first:pt-0 border-b border-border/40 last:border-0"
    >
      <div ref={rowRef} className="relative">
        <SetTip member={member} disabled={!setTip || menuOpen || abilityTipOpen}>
          <div
            // A div, not a button: the row can hold the "why" tooltip button.
            role={interactive ? "button" : undefined}
            tabIndex={interactive && !menuOpen ? 0 : undefined}
            aria-label={interactive ? t("row.actions", { name }) : undefined}
            aria-expanded={interactive ? menuOpen : undefined}
            aria-hidden={menuOpen || undefined}
            onClick={interactive ? () => onMenuChange?.(true) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onMenuChange?.(true);
                    }
                  }
                : undefined
            }
            className={cn(
              "flex items-center group",
              interactive &&
                "cursor-pointer rounded-full outline-none transition-colors hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            <div className="relative mr-5 shrink-0">
              <PokemonImg
                id={member.pokeapiId}
                decoding="async"
                alt={name}
                className={`w-12 h-12 rounded-full bg-muted object-contain ring-2 shadow-sm grayscale-[0.1] group-hover:grayscale-0 transition-all duration-300 ${status && status.state !== "new" ? "ring-red-500" : "ring-background"}`}
              />
              {member.inTeam && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-background rounded-full flex items-center justify-center shadow-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3 min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <h3 className="text-base font-semibold text-foreground tracking-tight leading-none truncate">
                    {name}
                  </h3>
                  {missing && missing.length > 0 && (
                    // Compact flag next to the name; hover and screen readers say what's missing.
                    <span
                      role="img"
                      title={`${t("incomplete.label")} · ${missing.map((key) => t(key as MessageKey)).join(" · ")}`}
                      aria-label={`${t("incomplete.label")}: ${missing
                        .map((key) => t(key as MessageKey))
                        .join(", ")}`}
                      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    >
                      <TriangleAlertIcon size={12} strokeWidth={2.5} aria-hidden />
                    </span>
                  )}
                </span>
                {member.teraType ? (
                  <TypeBadge type={member.teraType} tera small />
                ) : (
                  <div className="flex gap-1">
                    {member.types.map((t) => (
                      <TypeBadge key={t} type={t} small />
                    ))}
                  </div>
                )}
              </div>
              {/* Not overflow-hidden: the item sprite overhangs the line without growing it. */}
              <div className="flex items-center gap-2 text-sm font-medium leading-none text-muted-foreground opacity-80 min-w-0">
                {status ? (
                  <span className="flex items-center gap-1.5">
                    <span className={status.state === "new" ? "text-green-600" : "text-red-500"}>
                      {status.label}
                    </span>
                    {status.why.length > 0 && <WhyTip lines={status.why} />}
                  </span>
                ) : (
                  <>
                    {member.ability && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <AbilityTip ability={member.ability} onOpenChange={setAbilityTipOpen} />
                        <span className="truncate">{names.ability(member.ability)}</span>
                      </span>
                    )}
                    {member.ability && member.item && <span aria-hidden>·</span>}
                    {member.item && (
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="truncate">{names.item(member.item)}</span>
                        <ItemSprite item={member.item} />
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            {onRemove && (
              <button
                type="button"
                aria-label={t("row.removeOne", { name })}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="ml-3 flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 transition-colors hover:bg-rose-500/20 focus-visible:ring-1 focus-visible:ring-rose-500 outline-none"
              >
                <XIcon size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </SetTip>

        {/* Clips the slide to the row's pill shape. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <AnimatePresence>
            {menuOpen && actions && (
              <motion.div
                role="menu"
                aria-label={t("row.actions", { name })}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={actionsSpring}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onMenuChange?.(false);
                  }
                }}
                className="pointer-events-auto absolute inset-0 flex items-center gap-1 rounded-full bg-muted p-1"
              >
                <PokemonImg
                  id={member.pokeapiId}
                  decoding="async"
                  alt=""
                  className="ml-1 size-10 shrink-0 rounded-full object-contain"
                />
                {actions.map((action, i) => (
                  <button
                    key={action.key}
                    ref={i === 0 ? firstAction : undefined}
                    type="button"
                    role="menuitem"
                    disabled={action.disabled}
                    onClick={() => {
                      action.onSelect();
                      onMenuChange?.(false);
                    }}
                    className={cn(
                      "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors outline-none focus-visible:bg-background/70 disabled:pointer-events-none disabled:opacity-40",
                      action.danger
                        ? "text-rose-500 hover:bg-rose-500/10"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    )}
                  >
                    <action.icon size={16} strokeWidth={2} />
                    <span className="max-w-full truncate px-1">{action.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  aria-label={t("row.close")}
                  onClick={() => onMenuChange?.(false)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-background/70 hover:text-foreground focus-visible:bg-background/70"
                >
                  <XIcon size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {children}
    </motion.div>
  );
};

// Same footprint as MemberItem so the list keeps a fixed height of MAX_ROWS rows.
// Dimmed via children: motion animates the row's own opacity for the stagger.
// Party slots open the add dialog when clicked; box slots are decorative.
const EmptySlot = ({ onOpen }: { onOpen?: () => void }) => {
  const { t } = useI18n();
  // border, not ring: Tailwind rings are box-shadows and can't be dashed
  const circle = (
    <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/60 mr-4 transition-opacity group-hover/slot:border-muted-foreground opacity-40 group-hover/slot:opacity-100">
      {onOpen && (
        <PlusIcon
          size={18}
          strokeWidth={2.5}
          className="absolute text-muted-foreground opacity-0 transition-opacity group-hover/slot:opacity-100"
        />
      )}
    </span>
  );
  const label = (
    <span className="text-sm font-medium text-muted-foreground opacity-40 transition-opacity group-hover/slot:opacity-100">
      {t("team.emptySlot")}
    </span>
  );
  const line = "flex w-full items-center py-4 first:pt-0 border-b border-border/40 last:border-0";
  return onOpen ? (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={t("add.title")}
      variants={itemVariants}
      transition={sweepSpring}
      className="group/slot block w-full border-b border-border/40 py-1.5 text-left first:pt-0 last:border-0 focus-visible:outline-none"
    >
      {/* The hover surface sits inside the row, so it never touches the separators or the Box bar. */}
      <span className="-mx-2 flex items-center rounded-xl px-2 py-2.5 transition-colors group-hover/slot:bg-muted/40 group-focus-visible/slot:ring-1 group-focus-visible/slot:ring-ring">
        {circle}
        {label}
      </span>
    </motion.button>
  ) : (
    <motion.div aria-hidden variants={itemVariants} transition={sweepSpring} className={line}>
      {circle}
      {label}
    </motion.div>
  );
};

// Teammate suggestions (Smogon and VGC only): the species most used alongside the party, legal in the
// format, once the party has a member and a free slot. The home card and the team page share it.
export function useTeammateSuggestions(team: Team, party: PokemonSet[]) {
  const wanted = team.mode !== "adventure" && party.length > 0 && party.length < MAX_ROWS;
  const stats = useQuery({
    queryKey: ["usage", team.mode, team.format],
    queryFn: () => loadUsage(team.mode, team.format),
    enabled: wanted,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const options = useQuery({
    queryKey: ["pokemon-options", team.mode, team.format],
    queryFn: () => loadOptions(team.mode, team.format),
    enabled: wanted,
    staleTime: Number.POSITIVE_INFINITY,
  });
  // Only species legal in this format, which also gives us their artwork and types.
  const legal = useMemo(() => new Map(options.data?.map((o) => [o.name, o])), [options.data]);
  if (!wanted || !stats.data) return [];
  return suggestTeammates(
    stats.data.teammates,
    party.map((m) => m.name),
  )
    .flatMap(({ name, share }) => {
      const option = legal.get(name);
      return option ? [{ option, share }] : [];
    })
    .slice(0, 3);
}

// First free party slot (Smogon and VGC teams): species often paired with the current members, one
// click to add. Adventure teams get none: their slots stay empty.
const SuggestionSlot = ({
  suggestions,
  onPick,
}: {
  // share: how often the species is used alongside the current members.
  suggestions: { option: PokemonOption; share: number }[];
  onPick: (option: PokemonOption) => void;
}) => {
  const { t } = useI18n();
  const names = useNames();
  const fmt = useFormat();
  return (
    <motion.div
      variants={itemVariants}
      transition={sweepSpring}
      className="flex items-center py-4 first:pt-0 border-b border-border/40 last:border-0"
    >
      <div className="w-12 h-12 mr-4 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/60 opacity-40" />
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-xs leading-none text-muted-foreground">{t("team.suggested")}</p>
        <div className="flex gap-1.5">
          {suggestions.map(({ option, share }) => {
            const name = names.pokemon(option.pokeapiId, option.name);
            return (
              <button
                key={option.key}
                type="button"
                title={t("team.addSuggestion", { name })}
                onClick={() => onPick(option)}
                className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-muted/40 py-0.5 pr-2 pl-0.5 text-xs transition-colors outline-none hover:bg-muted/70 focus-visible:ring-1 focus-visible:ring-ring"
              >
                <PokemonImg
                  id={option.pokeapiId}
                  decoding="async"
                  alt=""
                  className="size-6 shrink-0 object-contain"
                />
                <span className="truncate text-foreground">{name}</span>
                <span className="ml-auto pl-1 tabular-nums text-muted-foreground">
                  {fmt.percent(share)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

// Both dialogs mirror the team card: 40px radius, p-8, muted pill inputs, rounded-xl close.
export const dialogContentClass =
  "gap-6 rounded-[28px] border border-border bg-background p-8 font-sans text-sm ring-0 sm:max-w-[440px]";

export const DialogHeading = ({ title, description }: { title: string; description?: string }) => {
  const { t } = useI18n();
  return (
    <DialogHeader className="flex-row items-start justify-between gap-4">
      <div className="grid gap-1.5">
        <DialogTitle className="text-lg font-semibold tracking-tight text-foreground leading-none">
          {title}
        </DialogTitle>
        {description && (
          <DialogDescription className="text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        )}
      </div>
      <DialogClose
        aria-label={t("dialog.close")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground transition-all hover:text-foreground active:scale-90"
      >
        <XIcon size={18} strokeWidth={2.5} />
      </DialogClose>
    </DialogHeader>
  );
};

// Share a team: a link that carries the whole team (lib/share.ts), and the party as a Showdown paste.
export function ShareTeamDialog({ team }: { team: Team }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // The team's own page is public once its owner is signed in (lib/teams-sync.tsx); someone else's
  // team shown here (read-only) is public already.
  const { data: session } = authClient.useSession();
  const { teams } = useTeams();
  const pageIsPublic = !!session || !teams.some((x) => x.id === team.id);
  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => setPageUrl(`${window.location.origin}/team/${team.id}`), [team.id]);
  const link = useQuery({
    queryKey: ["share-link", team],
    queryFn: async () =>
      // Opens the team's page, read-only, with a button to keep a copy (routes/team.shared.tsx).
      `${window.location.origin}/team/shared${SHARE_PREFIX}${await encodeTeam({
        name: team.name,
        mode: team.mode,
        format: team.format,
        rules: team.rules,
        pokemon: team.pokemon.map(({ id: _id, ...set }) => set),
      })}`,
    enabled: open,
  });
  const paste = team.pokemon
    .filter((m) => m.inTeam)
    .map((m) => toShowdown(m.name, memberDraft(m)))
    .join("\n\n");
  const copy = (text: string) =>
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(t("share.copied")))
      .catch(() => toast.error(t("common.copyFailed")));
  const box =
    "w-full rounded-xl border-none bg-muted/40 px-3 py-2.5 text-xs text-foreground outline-none";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={t("share.button")}
            title={t("share.button")}
            disabled={team.pokemon.length === 0}
            className="h-9 w-9 shrink-0 rounded-full border-border/50 text-muted-foreground hover:bg-muted/50"
          />
        }
      >
        <Share2Icon size={16} strokeWidth={2.25} />
      </DialogTrigger>
      <DialogContent showCloseButton={false} className={`${dialogContentClass} sm:max-w-[520px]`}>
        <DialogHeading title={t("share.title")} />
        <section className="grid gap-2">
          <h3 className="text-sm font-medium text-foreground">{t("share.page")}</h3>
          {pageIsPublic ? (
            <>
              <div className="flex gap-2">
                <input
                  readOnly
                  aria-label={t("share.page")}
                  value={pageUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className={cn(box, "min-w-0 flex-1 truncate font-mono")}
                />
                <Button
                  type="button"
                  onClick={() => copy(pageUrl)}
                  className="h-10 shrink-0 rounded-full px-4 text-xs"
                >
                  <CopyIcon size={14} /> {t("share.copy")}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t("share.pageSignIn")}</p>
          )}
        </section>
        <section className="grid gap-2">
          <h3 className="text-sm font-medium text-foreground">{t("share.link")}</h3>
          <div className="flex gap-2">
            <input
              readOnly
              aria-label={t("share.link")}
              value={link.data ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              className={cn(box, "min-w-0 flex-1 truncate font-mono")}
            />
            <Button
              type="button"
              disabled={!link.data}
              onClick={() => link.data && copy(link.data)}
              className="h-10 shrink-0 rounded-full px-4 text-xs"
            >
              <CopyIcon size={14} /> {t("share.copy")}
            </Button>
          </div>
        </section>
        {paste && (
          <section className="grid gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{t("share.showdown")}</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(paste)}
                className="h-8 rounded-full border-border/50 px-3 text-xs text-muted-foreground hover:bg-muted/50"
              >
                <CopyIcon size={13} /> {t("share.copy")}
              </Button>
            </div>
            <textarea
              readOnly
              aria-label={t("share.showdown")}
              value={paste}
              rows={10}
              className={cn(box, "resize-y font-mono leading-relaxed")}
            />
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

const MODE_ICONS: Record<TeamMode, LucideIcon> = {
  smogon: SwordsIcon,
  vgc: TrophyIcon,
  adventure: MapIcon,
};
const MODES = Object.keys(MODE_ICONS) as TeamMode[];

// The same versions, grouped by generation (the game index is already in release order).
const GENERATIONS = [...new Set(GAMES.map((g) => g.generation))].map((gen) => ({
  gen,
  versions: GAMES.filter((g) => g.generation === gen).flatMap((g) => [...g.versions]),
}));
const gameOf = (version: string) =>
  GAMES.find((g) => (g.versions as readonly string[]).includes(version));

// Display name of a format in the current language ("Gen 6 · OU"; short: "OU"). The stored id stays neutral.
export function useFormatName() {
  const { t } = useI18n();
  const names = useNames();
  return (mode: TeamMode, format: string, short = false) => {
    if (mode === "adventure") return names.version(format);
    const info = formatInfo(format);
    const name =
      info && "rules" in info
        ? t("format.regulation", { letter: info.rules })
        : (info?.name ?? format);
    return short ? name : `${t("format.gen", { gen: formatGen(format) })} · ${name}`;
  };
}

// A format's legal species, generated by scripts/build-formats.mjs: one small file per format.
const legalSpecies = import.meta.glob<string[]>("../data/formats/*.json", { import: "default" });

export interface NewTeam {
  name: string;
  mode: TeamMode;
  format: string;
  rules?: Rules; // adventure only: which kinds of Pokémon the player allows (note de cadrage 2.1)
}

const stepMotion = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.15 },
};

// A pill wrapping a visually hidden radio or checkbox; it fills when checked.
const toggleChip =
  "cursor-pointer rounded-full border border-border/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 has-checked:text-foreground has-checked:ring-1 has-checked:ring-foreground has-focus-visible:ring-1 has-focus-visible:ring-ring";

const pillButton =
  "h-10 rounded-full border-border/50 px-5 text-sm text-muted-foreground hover:bg-muted/50";

// Adventure only: which kinds of Pokémon the player allows, each with how many Pokémon it decides.
function AdventureRules({
  version,
  rules,
  onChange,
}: {
  version: string;
  rules: Rules;
  onChange: (rules: Rules) => void;
}) {
  const { t } = useI18n();
  const names = useNames();
  const { data: counts } = useQuery({
    queryKey: ["rule-impact", version],
    queryFn: async () => ruleImpact(await loadGame(version), version),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const otherVersions = (gameOf(version)?.versions ?? []).filter((v) => v !== version);
  // A single-version game (Yellow, Crystal, Platinum…) has no exclusives to allow.
  const keys = RULE_KEYS.filter((k) => k !== "exclusives" || otherVersions.length > 0);

  return (
    // A container query: the dialog, not the screen, decides between one and two columns.
    <fieldset className="@container grid gap-3">
      <legend className="mb-1 text-sm font-medium text-foreground">{t("rules.title")}</legend>
      <p className="-mt-1 mb-1 text-xs text-muted-foreground">{t("rules.description")}</p>
      <div className="grid grid-cols-1 gap-2 @xs:auto-rows-fr @xs:grid-cols-2">
        {keys
          .filter((key) => !counts || counts[key] > 0)
          .map((key) => (
            <RuleBlock
              key={key}
              version={version}
              rule={key}
              checked={rules[key]}
              onChange={(checked) => onChange({ ...rules, [key]: checked })}
              title={
                key === "exclusives"
                  ? t("rules.exclusives", {
                      versions: otherVersions.map(names.version).join(" / "),
                    })
                  : t(`rules.${key}`)
              }
              count={counts?.[key]}
            />
          ))}
      </div>
    </fieldset>
  );
}

// One rule: a card that toggles it, with how many Pokémon it decides and the list of them.
function RuleBlock({
  version,
  rule,
  checked,
  onChange,
  title,
  count,
}: {
  version: string;
  rule: keyof Rules;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  count?: number;
}) {
  const { t } = useI18n();
  const names = useNames();
  const fmt = useFormat();
  const { data } = useQuery({
    queryKey: ["rule-members", version, rule],
    queryFn: async () => affectedBy(await loadGame(version), version, rule),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const shown = data?.slice(0, 60) ?? [];
  const rest = (data?.length ?? 0) - shown.length;
  return (
    // The card toggles the rule (a filled check and a contour when allowed); its footer button lists
    // the Pokémon it decides, on hover, tap or focus.
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl transition-colors has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-ring",
        checked ? "bg-muted/40 ring-1 ring-foreground" : "bg-muted/20 hover:bg-muted/40",
      )}
    >
      <label className="flex flex-1 cursor-pointer items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span className="grid min-w-0 flex-1 gap-1">
          <span
            className={cn(
              "text-sm font-medium leading-snug transition-colors",
              checked ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {title}
          </span>
          <span className="text-xs leading-snug text-muted-foreground">
            {t(`rules.${rule}.hint`)}
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
            checked
              ? "bg-foreground text-background"
              : "border-2 border-muted-foreground/30 text-transparent",
          )}
        >
          <CheckIcon size={12} strokeWidth={3} />
        </span>
      </label>
      {count !== undefined && (
        <div className="px-3 pb-3">
          <Popover>
            <PopoverTrigger
              openOnHover
              delay={150}
              disabled={shown.length === 0}
              aria-label={t("rules.show", { count })}
              className="inline-flex items-center gap-1.5 rounded-full bg-background/70 py-1 pr-2 pl-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-popup-open:bg-background data-popup-open:text-foreground"
            >
              <span className="font-semibold tabular-nums text-foreground">
                {fmt.number(count)}
              </span>
              {t("rules.countUnit", { count })}
              <ChevronDownIcon size={12} aria-hidden />
            </PopoverTrigger>
            <PopoverContent className="grid w-72 gap-2 rounded-2xl p-3">
              <p className="text-xs font-medium text-foreground">
                {title} · {t("rules.count", { count: fmt.number(count) })}
              </p>
              <div className="flex flex-wrap gap-1">
                {shown.map((p) => {
                  const name = names.pokemon(p.id, String(p.species));
                  return (
                    <img
                      key={p.id}
                      src={artwork(p.id)}
                      decoding="async"
                      alt={name}
                      title={name}
                      loading="lazy"
                      className="size-8 object-contain"
                    />
                  );
                })}
              </div>
              {rest > 0 && (
                <span className="text-center text-[11px] text-muted-foreground">
                  {t("rules.more", { count: rest })}
                </span>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

// Placeholder card leading the team grid; the grid stretches it to the row height.
export function NewTeamCard({ onCreate }: { onCreate?: (team: NewTeam) => void }) {
  const { t } = useI18n();
  const formatName = useFormatName();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TeamMode | null>(null);
  // The picked format; in Adventure, the game ("" until one is picked), which drives the rule counters.
  const [version, setVersion] = useState("");
  // Which generation is unfolded in the version list.
  const [openGen, setOpenGen] = useState<number | null>(null);
  // Smogon and VGC: the generation whose formats are listed.
  const [competitiveGen, setCompetitiveGen] = useState(9);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reset on open, not on close, so step 2 doesn't flash back to step 1 during the exit animation.
        if (next) {
          setMode(null);
          setVersion("");
          setOpenGen(null);
          setRules(DEFAULT_RULES);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="group flex min-h-[24rem] w-full flex-col items-center justify-center gap-4 rounded-[28px] border-2 border-dashed border-muted-foreground/40 font-sans text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/60 transition-transform group-hover:scale-105">
          <PlusIcon size={24} strokeWidth={2} />
        </span>
        <span className="text-base font-medium tracking-tight">{t("team.new")}</span>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={`${dialogContentClass} max-h-[90dvh] overflow-y-auto sm:max-w-[480px]`}
      >
        <DialogHeading
          title={mode ? t("team.newOf", { mode: t(`mode.${mode}`) }) : t("team.new")}
          description={mode ? undefined : t("team.pickMode")}
        />

        <AnimatePresence mode="wait" initial={false}>
          {!mode ? (
            <motion.div key="mode" {...stepMotion} className="grid grid-cols-3 gap-2">
              {MODES.map((key) => {
                const Icon = MODE_ICONS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setMode(key);
                      // Competitive modes start on the newest generation's first format; Adventure waits for a game.
                      setCompetitiveGen(9);
                      setVersion(key === "adventure" ? "" : competitiveFormats(key, 9)[0]!);
                    }}
                    className="group/mode flex flex-col items-center gap-3 rounded-2xl bg-muted/40 p-3 text-center transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground/80 transition-transform group-hover/mode:scale-105">
                      <Icon size={20} strokeWidth={2} />
                    </span>
                    <span className="grid gap-1.5">
                      <span className="text-sm font-medium tracking-tight text-foreground leading-none">
                        {t(`mode.${key}`)}
                      </span>
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        {t(`mode.${key}.description`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </motion.div>
          ) : (
            <motion.form
              key={mode}
              {...stepMotion}
              className="grid gap-6"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                onCreate?.({
                  name:
                    String(data.get("name")).trim() ||
                    t("team.defaultName", { format: formatName(mode, String(data.get("format"))) }),
                  mode,
                  format: String(data.get("format")),
                  rules: mode === "adventure" ? rules : undefined,
                });
                setOpen(false);
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="team-name" className="text-sm font-medium text-foreground">
                  {t("team.name")}
                </Label>
                <Input
                  id="team-name"
                  name="name"
                  autoFocus
                  autoComplete="off"
                  placeholder={
                    version ? t("team.defaultName", { format: formatName(mode, version) }) : ""
                  }
                  className="h-11 w-full rounded-2xl border-none bg-muted/40 px-4 text-base text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-border"
                />
              </div>
              <fieldset className="grid gap-3">
                {mode === "adventure" && openGen !== null ? (
                  <legend className="mb-3">
                    {/* The title is the way back to the generations. */}
                    <button
                      type="button"
                      onClick={() => setOpenGen(null)}
                      className="flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
                    >
                      <ArrowLeftIcon size={14} />
                      {t("format.gen", { gen: openGen })}
                    </button>
                  </legend>
                ) : (
                  <legend className="mb-3 text-sm font-medium text-foreground">
                    {t(`mode.${mode}.format`)}
                  </legend>
                )}
                {mode === "adventure" ? (
                  <div className="grid gap-2">
                    {/* Generations first; a generation replaces them with its games, and back returns. */}
                    <div
                      className={cn("-mx-2 grid grid-cols-3 gap-2", openGen !== null && "hidden")}
                    >
                      {GENERATIONS.map(({ gen }) => (
                        <button
                          key={gen}
                          type="button"
                          onClick={() => {
                            setOpenGen(gen);
                            // A game picked in another generation no longer applies.
                            if (
                              !GENERATIONS.find((g) => g.gen === gen)?.versions.some(
                                (v) => v === version,
                              )
                            )
                              setVersion("");
                          }}
                          className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-muted/40 p-4 text-center text-sm font-medium tracking-tight text-foreground transition-colors hover:bg-muted/70"
                        >
                          {t("format.gen", { gen })}
                        </button>
                      ))}
                    </div>
                    {/* Hidden, not unmounted: the radios must stay in the form for submit. */}
                    {GENERATIONS.map(({ gen, versions }) => (
                      <div key={gen} className={cn("grid gap-2", openGen !== gen && "hidden")}>
                        <div className="-mx-2 grid grid-cols-3 gap-2">
                          {versions.map((format) => (
                            <label
                              key={format}
                              className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl bg-muted/40 p-4 text-center text-sm font-medium tracking-tight text-foreground transition-colors hover:bg-muted/70 has-checked:ring-1 has-checked:ring-foreground has-focus-visible:ring-1 has-focus-visible:ring-ring"
                            >
                              <input
                                type="radio"
                                name="format"
                                value={format}
                                checked={version === format}
                                onChange={() => setVersion(format)}
                                className="sr-only"
                              />
                              {formatName(mode, format)}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {/* Generation first: each one has its own tiers or VGC seasons. */}
                    <div
                      role="group"
                      aria-label={t("format.genPick")}
                      className="flex flex-wrap gap-2"
                    >
                      {gensOf(mode).map((gen) => (
                        <button
                          key={gen}
                          type="button"
                          aria-pressed={competitiveGen === gen}
                          onClick={() => {
                            setCompetitiveGen(gen);
                            setVersion(competitiveFormats(mode, gen)[0]!);
                          }}
                          className={cn(
                            toggleChip,
                            "aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background",
                          )}
                        >
                          {t("format.gen", { gen })}
                        </button>
                      ))}
                    </div>
                    {mode === "smogon" ? (
                      <div className="grid grid-cols-3 gap-2">
                        {competitiveFormats(mode, competitiveGen).map((format) => {
                          const tier = formatInfo(format)?.name ?? format;
                          return (
                            <label
                              key={format}
                              className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl bg-muted/40 p-3 text-center transition-colors hover:bg-muted/70 has-checked:ring-1 has-checked:ring-foreground has-focus-visible:ring-1 has-focus-visible:ring-ring"
                            >
                              <input
                                type="radio"
                                name="format"
                                value={format}
                                checked={version === format}
                                onChange={() => setVersion(format)}
                                className="sr-only"
                              />
                              <span className="text-sm font-medium tracking-tight text-foreground">
                                {tier}
                              </span>
                              <span className="text-xs leading-snug text-muted-foreground">
                                {t(`tier.${tier}` as MessageKey)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        className={
                          mode === "vgc"
                            ? "grid grid-cols-2 gap-2"
                            : "flex max-h-56 flex-wrap gap-2 overflow-y-auto"
                        }
                      >
                        {competitiveFormats(mode, competitiveGen).map((format) => {
                          const info = formatInfo(format);
                          return (
                            <label
                              key={format}
                              className={cn(
                                toggleChip,
                                mode === "vgc" && "rounded-2xl px-3.5 py-2.5",
                              )}
                            >
                              <input
                                type="radio"
                                name="format"
                                value={format}
                                checked={version === format}
                                onChange={() => setVersion(format)}
                                className="sr-only"
                              />
                              {formatName(mode, format, true)}
                              {/* Gen 9 regulation letters say nothing by themselves: show what each one allows. */}
                              {info && "rules" in info && (
                                <span className="mt-1 block leading-snug opacity-70">
                                  {t(`format.rules.${info.rules}` as MessageKey)}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </fieldset>
              {/* Rules depend on the game: shown once one is picked in the open generation. */}
              {mode === "adventure" && version && openGen !== null && (
                <AdventureRules version={version} rules={rules} onChange={setRules} />
              )}
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode(null)}
                  className={pillButton}
                >
                  {t("team.back")}
                </Button>
                <Button
                  type="submit"
                  disabled={mode === "adventure" && !version}
                  className="h-10 rounded-full px-5 text-sm"
                >
                  {t("team.create")}
                </Button>
              </DialogFooter>
            </motion.form>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export interface Team extends NewTeam {
  id: string;
  pokemon: PokemonSet[];
  updatedAt?: number; // last change in this browser (ms), for the account sync (lib/teams.tsx)
}

export interface PokemonOption {
  key: string;
  pokeapiId: number;
  name: string; // English (@pkmn/dex) name, also the usage-stats key; fallback while names load
  types: PokemonType[];
  ability: string;
  abilities?: string[]; // every ability the species can have (competitive only)
  tier?: string; // Smogon only
}

// Loaded on first open: the dex chunk is ~1.8 MB, so it stays out of the page bundle.
export async function loadCompetitive(format: string): Promise<PokemonOption[]> {
  const file = legalSpecies[`../data/formats/${format}.json`];
  if (!file) throw new Error(`Unknown format: ${format}`);
  const [{ Dex }, legal] = await Promise.all([import("@pkmn/dex"), file()]);
  // Types, abilities and tiers as of the format's generation.
  const dex = Dex.forGen(formatGen(format));
  return legal
    .map((name) => dex.species.get(name))
    .map((s) => ({
      key: s.name,
      // Cosmetic formes PokeAPI has no artwork for fall back to the base species.
      pokeapiId: FORM_ARTWORK_IDS[s.name] ?? s.num,
      name: s.name,
      types: s.types as PokemonType[],
      ability: s.abilities[0],
      abilities: [...new Set(Object.values(s.abilities))],
      tier: s.tier,
    }));
}

const gameFiles = import.meta.glob<GameData>("../data/games/*.json", { import: "default" });

export async function loadGame(version: string): Promise<GameData> {
  const info = gameOf(version);
  if (!info) throw new Error(`Unknown game version: ${version}`);
  return gameFiles[`../data/games/${info.versionGroup}.json`]!();
}

// Adventure: what the player can obtain in that version under the team's rules.
async function loadAdventure(
  version: string,
  rules: Rules = DEFAULT_RULES,
): Promise<PokemonOption[]> {
  const game = await loadGame(version);
  return availableIn(game, version, rules).map(({ pokemon }) => ({
    key: String(pokemon.id),
    pokeapiId: pokemon.id,
    name: `#${pokemon.species}`,
    types: pokemon.types.map(toType),
    ability: "",
  }));
}

// Usage and teammate shares per species name, from Smogon's monthly ladder stats. Adventure has none.
// Both modes read snapshots generated at build time (scripts/build-vgc-usage.mjs and
// build-smogon-usage.mjs), each tier in its own small chunk.
const smogonUsage = import.meta.glob<UsageStats>("../data/smogon/*.usage.json", {
  import: "default",
});
const smogonBuilds = import.meta.glob<Record<string, Build>>("../data/smogon/*.builds.json", {
  import: "default",
});
const EMPTY_USAGE: UsageStats = { usage: {}, teammates: {} };

// Ladder snapshots keyed by format id: Smogon tiers and past VGC seasons (build-smogon-usage.mjs),
// gen 9 regulations (build-vgc-usage.mjs). Formats without stats (gen6vgc2015…) get none.
async function loadUsage(mode: TeamMode, format: string): Promise<UsageStats> {
  const file = smogonUsage[`../data/smogon/${format}.usage.json`];
  if (file) return file();
  if (mode === "vgc") return (await import("@/data/vgc-usage")).VGC_USAGE[format] ?? EMPTY_USAGE;
  return EMPTY_USAGE;
}

const loadOptions = (mode: TeamMode, format: string, rules?: Rules) =>
  mode === "adventure" ? loadAdventure(format, rules) : loadCompetitive(format);

// A team member's set as the editor's draft.
// A new team member from a picked Pokémon, with its set when one was built. Shared by the team card
// and the team page. Terastallization only exists in the gen 9 competitive formats.
export function newMember(
  team: Team,
  option: PokemonOption,
  inTeam: boolean,
  draft?: SetDraft,
): PokemonSet {
  const tera =
    team.mode !== "adventure" && formatGen(team.format) === 9 ? option.types[0] : undefined;
  return {
    id: crypto.randomUUID(),
    pokeapiId: option.pokeapiId,
    name: option.name,
    item: draft?.item ?? "",
    ability: draft?.ability ?? option.ability,
    types: option.types,
    teraType: (draft?.teraType as PokemonType | undefined) ?? tera,
    moves: draft?.moves.filter(Boolean) ?? [],
    nature: draft?.nature,
    evs: draft?.evs,
    ivs: draft?.ivs,
    inTeam,
  };
}

// A member with an edited set (the editor's draft) applied.
export function withDraft(team: Team, member: PokemonSet, draft: SetDraft): PokemonSet {
  const tera =
    team.mode !== "adventure" && formatGen(team.format) === 9 ? member.types[0] : undefined;
  return {
    ...member,
    item: draft.item,
    ability: draft.ability,
    teraType: (draft.teraType as PokemonType | undefined) ?? tera,
    moves: draft.moves.filter(Boolean),
    nature: draft.nature,
    evs: draft.evs,
    ivs: draft.ivs,
  };
}

export const memberDraft = (member: PokemonSet): SetDraft => ({
  item: member.item,
  ability: member.ability,
  teraType: member.teraType,
  nature: member.nature ?? "Serious",
  evs: member.evs ?? emptyEvs(),
  ivs: member.ivs ?? maxIvs(),
  moves: [...member.moves, "", "", "", ""].slice(0, 4),
});

// The most used build of a species: VGC from the snapshot, Smogon from the shared usage query.
export async function loadBuildFor(
  queryClient: QueryClient,
  mode: TeamMode,
  format: string,
  species: string,
): Promise<Build | undefined> {
  const file = smogonBuilds[`../data/smogon/${format}.builds.json`];
  if (!file && mode === "vgc")
    return (await import("@/data/vgc-builds")).VGC_BUILDS[format]?.[species];
  const builds = await queryClient.fetchQuery({
    queryKey: ["smogon-builds", format],
    queryFn: () => file?.() ?? Promise.resolve({}),
    staleTime: Number.POSITIVE_INFINITY,
  });
  return builds[species];
}

export function AddPokemonDialog({
  mode,
  format,
  rules,
  variant = "add",
  onAdd,
  open: controlledOpen,
  onOpenChange,
  onAddSet,
  startWith,
  blocked,
}: {
  mode: TeamMode;
  format: string;
  rules?: Rules;
  // Adventure: Pokémon the player can't pick any more (another starter's family), greyed out.
  blocked?: ReadonlySet<number>;
  variant?: "add" | "wish";
  onAdd: (option: PokemonOption) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // When set (competitive party adds), a click opens the set editor instead of adding at once.
  onAddSet?: (option: PokemonOption, draft: SetDraft) => void;
  // Opens straight on this Pokémon's set editor (a teammate suggestion was picked).
  startWith?: PokemonOption | null;
}) {
  const { t } = useI18n();
  const names = useNames();
  const fmt = useFormat();
  const formatName = useFormatName();
  const queryClient = useQueryClient();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const [editing, setEditing] = useState<PokemonOption | null>(null);
  useEffect(() => {
    if (open && startWith) setEditing(startWith);
  }, [open, startWith]);
  const setOpen = (next: boolean) => {
    if (next) setEditing(null);
    setInnerOpen(next);
    onOpenChange?.(next);
  };
  const loadBuild = (species: string) => loadBuildFor(queryClient, mode, format, species);
  // Picking a Pokémon opens the set editor: warm its data so the click doesn't wait.
  const opensEditor = !!onAddSet && mode !== "adventure";
  useEffect(() => {
    if (open && opensEditor) prefetchSetFormat(queryClient, mode, format);
  }, [open, opensEditor, queryClient, mode, format]);
  const prefetchSpecies = (species: string) => {
    if (opensEditor)
      prefetchSetSpecies(queryClient, mode, format, species, () => loadBuild(species));
  };
  const [query, setQuery] = useState("");
  // Tiers ticked in the filter; none ticked shows every legal species.
  const [pickedTiers, setPickedTiers] = useState<string[]>([]);
  const [showUsage, setShowUsage] = useState(false);
  const [sortByUsage, setSortByUsage] = useState(false);
  const hasUsage = mode !== "adventure";
  const usage = useQuery({
    queryKey: ["usage", mode, format],
    queryFn: () => loadUsage(mode, format),
    enabled: open && (showUsage || sortByUsage) && hasUsage,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const { data, isError } = useQuery({
    queryKey: ["pokemon-options", mode, format, rules],
    queryFn: () => loadOptions(mode, format, rules),
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  });
  // Tier filter chips: the Smogon tiers among this format's legal species.
  const tiers = mode === "smogon" ? tiersAmong((data ?? []).map((o) => o.tier)) : [];

  // Typing stays responsive: the list filters on a deferred copy of the query.
  const q = fold(useDeferredValue(query));
  const usageShares = usage.data?.usage;
  const results = useMemo(() => {
    const list = (data ?? []).filter(
      (o) =>
        (pickedTiers.length === 0 || (o.tier !== undefined && pickedTiers.includes(o.tier))) &&
        (fold(names.pokemon(o.pokeapiId, o.name)).includes(q) || fold(o.name).includes(q)),
    );
    // Most used first; species without stats keep their dex order at the end.
    if (sortByUsage && usageShares)
      list.sort((a, b) => (usageShares[b.name] ?? 0) - (usageShares[a.name] ?? 0));
    return list;
  }, [data, pickedTiers, q, names, sortByUsage, usageShares]);
  const gridScroll = useRef<HTMLDivElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setQuery("");
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          variant === "wish" ? (
            <Button
              variant="outline"
              aria-label={t("wish.add")}
              className="h-9 shrink-0 gap-1.5 rounded-full border-border/50 px-3 text-xs text-muted-foreground hover:bg-muted/50"
            />
          ) : (
            <Button
              variant="outline"
              size="icon"
              aria-label={t("add.title")}
              className="h-9 w-9 shrink-0 rounded-full border-border/50 text-muted-foreground hover:bg-muted/50"
            />
          )
        }
      >
        {variant === "wish" ? (
          <>
            <StarIcon size={14} strokeWidth={2} />
            <span>{t("wish.button")}</span>
          </>
        ) : (
          <PlusIcon size={18} strokeWidth={2.5} />
        )}
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={`${dialogContentClass} max-h-[90dvh] overflow-y-auto sm:max-w-2xl`}
      >
        {editing && mode !== "adventure" ? (
          <SetEditor
            key={editing.key}
            mode={mode}
            format={format}
            species={editing.name}
            pokeapiId={editing.pokeapiId}
            sprite={artwork(editing.pokeapiId)}
            abilities={editing.abilities ?? [editing.ability]}
            loadBuild={() => loadBuild(editing.name)}
            onBack={() => setEditing(null)}
            onConfirm={(draft) => {
              onAddSet?.(editing, draft);
              setOpen(false);
            }}
          />
        ) : (
          <>
            <DialogHeading
              title={variant === "wish" ? t("wish.add") : t("add.title")}
              description={
                data
                  ? pickedTiers.length
                    ? t("add.countInTiers", {
                        count: results.length,
                        tiers: pickedTiers.join(", "),
                      })
                    : t("add.countAllowed", {
                        count: results.length,
                        format: formatName(mode, format),
                      })
                  : t("add.onlyAllowed", { format: formatName(mode, format) })
              }
            />
            <div className="relative">
              <SearchIcon
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 z-10"
                size={15}
              />
              <Input
                aria-label={t("add.search")}
                placeholder={t("add.searchPlaceholder")}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 w-full rounded-2xl border-none bg-muted/40 pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-border"
              />
            </div>
            <div className="flex flex-wrap gap-2 empty:hidden">
              {tiers.length > 1 && (
                <fieldset className="contents">
                  <legend className="sr-only">{t("add.filterTier")}</legend>
                  {tiers.map((tier) => (
                    <label key={tier} className={toggleChip}>
                      <input
                        type="checkbox"
                        checked={pickedTiers.includes(tier)}
                        onChange={(e) =>
                          setPickedTiers((prev) =>
                            e.target.checked
                              ? tiers.filter((x) => x === tier || prev.includes(x))
                              : prev.filter((x) => x !== tier),
                          )
                        }
                        className="sr-only"
                      />
                      {tier}
                    </label>
                  ))}
                </fieldset>
              )}
              {hasUsage && (
                <label className={`${toggleChip} ml-auto`}>
                  <input
                    type="checkbox"
                    checked={sortByUsage}
                    onChange={(e) => setSortByUsage(e.target.checked)}
                    className="sr-only"
                  />
                  {t("add.sortUsage")}
                </label>
              )}
              {hasUsage && (
                <label className={toggleChip}>
                  <input
                    type="checkbox"
                    checked={showUsage}
                    onChange={(e) => setShowUsage(e.target.checked)}
                    className="sr-only"
                  />
                  {usage.isError ? t("add.usageUnavailable") : t("add.usage")}
                </label>
              )}
            </div>
            <div ref={gridScroll} className="-mx-2 h-[60vh] overflow-y-auto px-2">
              {isError ? (
                <p className="p-4 text-center text-muted-foreground">{t("add.loadError")}</p>
              ) : !data ? (
                <p className="p-4 text-center text-muted-foreground">{t("add.loading")}</p>
              ) : results.length === 0 ? (
                <p className="p-4 text-center text-muted-foreground">{t("add.empty")}</p>
              ) : (
                <VirtualGrid
                  items={results}
                  scrollRef={gridScroll}
                  render={(option) => {
                    const name = names.pokemon(option.pokeapiId, option.name);
                    const isBlocked = blocked?.has(option.pokeapiId);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        title={isBlocked ? t("starter.blocked", { name }) : name}
                        disabled={isBlocked}
                        onPointerEnter={() => prefetchSpecies(option.name)}
                        onFocus={() => prefetchSpecies(option.name)}
                        onClick={() => {
                          if (opensEditor) return setEditing(option);
                          onAdd(option);
                          setOpen(false);
                        }}
                        className="group/tile relative flex min-w-0 flex-col items-center gap-2 rounded-2xl bg-muted/30 px-3 pt-4 pb-4 text-center transition-colors enabled:hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
                      >
                        {showUsage && usage.data && (
                          <span className="absolute top-2 right-2 rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums leading-none text-muted-foreground">
                            {fmt.percent(usage.data.usage[option.name] ?? 0, 1)}
                          </span>
                        )}
                        <PokemonImg
                          id={option.pokeapiId}
                          decoding="async"
                          alt=""
                          loading="lazy"
                          className="mb-1 aspect-square w-full max-w-24 object-contain transition-transform group-hover/tile:scale-105"
                        />
                        <span className="w-full truncate text-sm font-medium tracking-tight text-foreground leading-tight">
                          {name}
                        </span>
                        <span className="flex flex-wrap justify-center gap-1">
                          {option.types.map((type) => (
                            <span
                              key={type}
                              className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase leading-none ${TYPE_STYLES[type]}`}
                            >
                              {names.type(type)}
                            </span>
                          ))}
                        </span>
                      </button>
                    );
                  }}
                />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// A responsive grid (like repeat(auto-fill, minmax(8.5rem, 1fr))) that only mounts the rows in view:
// a format lists up to ~900 species, each tile with an image.
const TILE_MIN = 136; // 8.5rem
const TILE_GAP = 12;
function VirtualGrid<T extends { key: string }>({
  items,
  scrollRef,
  render,
}: {
  items: T[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  render: (item: T) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const cols = Math.max(1, Math.floor((width + TILE_GAP) / (TILE_MIN + TILE_GAP)));
  const rows = Math.ceil(items.length / cols);
  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 190,
    gap: TILE_GAP,
    overscan: 3,
  });
  return (
    <div ref={ref} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          className="absolute top-0 left-0 grid w-full gap-3"
          style={{
            transform: `translateY(${row.start}px)`,
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {items.slice(row.index * cols, (row.index + 1) * cols).map((item) => (
            <Fragment key={item.key}>{render(item)}</Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

// Where a Pokémon is first obtainable, in the player's language.
type Translate = ReturnType<typeof useI18n>["t"];
type Names = ReturnType<typeof useNames>;
// Encounter methods and evolution triggers with a label: identifiers from the game data (PokeAPI).
const hasKey = (key: string): key is MessageKey => key in MESSAGES.en;

function describeSource(src: Source, game: GameData, t: Translate, lang: Lang, names: Names) {
  const step = game.steps[src.s]?.[lang] ?? "";
  const where = src.l ? names.location(src.l) : "";
  const methodKey = `method.${src.m}`;
  const how = src.m === undefined ? "" : hasKey(methodKey) ? t(methodKey) : src.m;
  // The reasons behind the step, one line each, for the "why this step" tooltip.
  const why: string[] = [];
  if (src.from !== undefined) {
    why.push(t("why.evolved", { from: names.pokemon(src.from, "") }));
    if (src.c?.lv)
      why.push(t("why.level", { level: src.c.lv }), t("why.levelStep", { level: src.c.lv }));
    else if (src.c?.item) why.push(t("why.item", { item: names.item(src.c.item) }));
    else if (src.c?.trigger === "trade") why.push(t("why.trade"));
    else if (src.c?.trigger) {
      const triggerKey = `trigger.${src.c.trigger}`;
      why.push(t("why.other", { trigger: hasKey(triggerKey) ? t(triggerKey) : src.c.trigger }));
    }
  } else if (src.m === "breed") {
    why.push(t("why.breed"));
  } else if (where) {
    why.push(t("why.place", { how, where }));
  }
  why.push(t("why.stepRule", { step }));
  return {
    step,
    where,
    how,
    chance:
      src.r === undefined
        ? undefined
        : formatPercent(lang, src.r / 100, Number.isInteger(src.r) ? 0 : 1),
    why,
  };
}

// Small "i" that explains, on hover or focus, why a Pokémon is available at its step.
// What an ability does: from @pkmn/dex, or the games' French text (scripts/build-descriptions.mjs).
function AbilityTip({
  ability,
  onOpenChange,
}: {
  ability: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const names = useNames();
  const [open, setOpen] = useState(false);
  const desc = useQuery({
    queryKey: ["ability-desc", lang, ability],
    queryFn: async () => {
      const french = await frenchDescription(lang, "ability", ability);
      if (french) return french;
      const { Dex } = await import("@pkmn/dex");
      const a = Dex.forGen(9).abilities.get(ability);
      return a.exists ? a.shortDesc || a.desc : "";
    },
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange(next);
      }}
    >
      <PopoverTrigger
        openOnHover
        delay={150}
        render={
          <button
            type="button"
            aria-label={t("row.abilityInfo", { ability: names.ability(ability) })}
            // Stay in the row without opening its action menu.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        }
      >
        <InfoIcon size={13} strokeWidth={2} />
      </PopoverTrigger>
      <PopoverContent className="grid w-64 gap-1 font-normal">
        <p className="font-semibold">{names.ability(ability)}</p>
        <p className="text-muted-foreground">{desc.data || (desc.isPending ? "…" : "—")}</p>
      </PopoverContent>
    </Popover>
  );
}

// The member's set on hover, laid out like a Showdown export.
function SetTip({
  member,
  disabled,
  children,
}: {
  member: PokemonSet;
  disabled: boolean;
  children: React.ReactElement;
}) {
  const names = useNames();
  return (
    <Tooltip disabled={disabled}>
      <TooltipTrigger delay={250} render={children} />
      <TooltipContent
        arrow={false}
        side="right"
        align="start"
        sideOffset={12}
        className="grid w-72 max-w-none gap-2 rounded-xl border border-border bg-card p-4 text-left text-xs font-normal leading-snug text-card-foreground ring-0 shadow-none"
      >
        <div className="mb-1 border-b border-border/40 pb-2 text-sm font-semibold">
          {names.pokemon(member.pokeapiId, member.name)}
        </div>
        <SetSummary member={member} />
      </TooltipContent>
    </Tooltip>
  );
}

// A set's item, ability, Tera type, nature, spreads and moves: the hover tip and the team page.
// moves={false}: the team page shows them as the set editor does instead.
// tipsGen: describe the item and ability on hover, for that generation (not inside the hover tip itself).
export function SetSummary({
  member,
  moves = true,
  tipsGen,
}: {
  member: PokemonSet;
  moves?: boolean;
  tipsGen?: number;
}) {
  const { t } = useI18n();
  const names = useNames();
  const spread = (values: Evs | undefined, skip: number) =>
    STATS.filter((s) => values && values[s] !== skip)
      .map((s) => `${values?.[s]} ${t(`stat.${s}` as MessageKey)}`)
      .join(" / ");
  const evs = spread(member.evs, 0);
  const ivs = spread(member.ivs, 31);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0">{value}</span>
    </div>
  );
  return (
    <>
      {member.item &&
        row(
          t("set.item"),
          <span className="flex items-center gap-1">
            <ItemSprite item={member.item} />
            {tipsGen ? (
              <DexTip kind="item" name={member.item} gen={tipsGen}>
                {names.item(member.item)}
              </DexTip>
            ) : (
              names.item(member.item)
            )}
          </span>,
        )}
      {member.ability &&
        row(
          t("set.ability"),
          tipsGen ? (
            <DexTip kind="ability" name={member.ability} gen={tipsGen}>
              {names.ability(member.ability)}
            </DexTip>
          ) : (
            names.ability(member.ability)
          ),
        )}
      {member.teraType && row(t("set.tera"), names.type(member.teraType))}
      {member.nature && row(t("set.nature"), names.nature(member.nature))}
      {evs && row(t("set.evs"), evs)}
      {ivs && row(t("set.ivs"), ivs)}
      {moves && member.moves.length > 0 && (
        <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/40 pt-2">
          {member.moves.map((m) => (
            <li
              key={m}
              className="truncate before:mr-1 before:text-muted-foreground before:content-['–']"
            >
              {names.move(m)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function WhyTip({ lines }: { lines: string[] }) {
  const { t } = useI18n();
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={100}
        render={
          <button
            type="button"
            aria-label={t("why.button")}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        }
      >
        <InfoIcon size={13} strokeWidth={2} />
      </PopoverTrigger>
      {/* Same surface as the cards, rounded like the pills. */}
      <PopoverContent className="grid w-72 gap-1.5 rounded-2xl font-normal">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// How a party member relates to the progression step the player is at.
interface MemberStatus {
  state: "new" | "later" | "never";
  label: string;
  why: string[];
}

// Progression of an adventure: the step the player has reached, shown as a slider.
function ProgressBar({
  steps,
  value,
  onChange,
}: {
  steps: GameData["steps"];
  value: number;
  onChange: (step: number) => void;
}) {
  const { t, lang } = useI18n();
  const current = steps[value]?.[lang] ?? "";
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>{t("progress.label")}</span>
        <span className="truncate text-foreground">{current}</span>
      </div>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={t("progress.label")}
        aria-valuetext={current}
        className="w-full accent-foreground"
      />
    </div>
  );
}

// Wishlist: each wanted Pokémon with the earliest place and way to get it, at the current step.
// One wished Pokémon: when and where it unlocks, and how close the player is to that step.
function WishRow({
  option,
  src,
  game,
  progress,
  onRemove,
}: {
  option: PokemonOption;
  src?: Source;
  game: GameData;
  progress: number;
  onRemove: (pokeapiId: number) => void;
}) {
  const { t, lang } = useI18n();
  const names = useNames();
  const info = src ? describeSource(src, game, t, lang, names) : undefined;
  const available = !!src && src.s <= progress;
  // Full once it is obtainable, otherwise the share of the way to its unlock step.
  const ratio = !src ? 0 : available ? 1 : progress / src.s;
  return (
    <li className="grid gap-1.5 rounded-2xl bg-muted/30 p-3">
      <div className="flex items-center gap-3">
        <PokemonImg
          id={option.pokeapiId}
          decoding="async"
          alt=""
          loading="lazy"
          className="size-10 shrink-0 rounded-full bg-muted object-contain"
        />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">
            {names.pokemon(option.pokeapiId, option.name)}
          </span>
          {info ? (
            <span
              className={`flex items-center gap-1.5 text-xs ${available ? "text-green-600" : "text-red-500"}`}
            >
              {available ? t("wish.now") : t("wish.later", { step: info.step })}
              <WhyTip lines={info.why} />
            </span>
          ) : (
            <span className="text-xs text-red-500">{t("wish.never")}</span>
          )}
        </div>
        <button
          type="button"
          aria-label={t("wish.remove")}
          onClick={() => onRemove(option.pokeapiId)}
          className="flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <XIcon size={16} strokeWidth={2.5} />
        </button>
      </div>
      {info && (
        <>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
          <span className="truncate text-[11px] text-muted-foreground">
            {[info.where, info.how, info.chance].filter(Boolean).join(" · ")}
          </span>
        </>
      )}
    </li>
  );
}

// The wishlist, shown in the Box panel of an adventure team.
function WishList({
  items,
  game,
  progress,
  onRemove,
}: {
  items: { option: PokemonOption; src?: Source }[];
  game: GameData;
  progress: number;
  onRemove: (pokeapiId: number) => void;
}) {
  const { t } = useI18n();
  if (items.length === 0)
    return <p className="p-4 text-center text-xs text-muted-foreground">{t("wish.empty")}</p>;
  return (
    <ul className="grid gap-1.5 pb-2">
      {items.map(({ option, src }) => (
        <WishRow
          key={option.key}
          option={option}
          src={src}
          game={game}
          progress={progress}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}

export default function StackedList({
  team,
  onAddPokemon,
  onRemovePokemon,
  onUpdatePokemon,
}: {
  team: Team;
  onAddPokemon: (pokemon: PokemonSet) => void;
  onRemovePokemon: (id: string) => void;
  onUpdatePokemon: (pokemon: PokemonSet) => void;
}) {
  const { t, lang } = useI18n();
  const names = useNames();
  const fmt = useFormat();
  const formatName = useFormatName();
  const [isExpanded, setIsExpanded] = useState(false);
  // The Box list is only mounted while open (or animating shut): collapsed, it would render every
  // member a second time, with its images and tooltips, under the party.
  const [boxMounted, setBoxMounted] = useState(false);
  useEffect(() => {
    if (isExpanded) setBoxMounted(true);
  }, [isExpanded]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAllMembers = useMemo(() => {
    const q = fold(searchQuery);
    return team.pokemon.filter((m) =>
      [
        names.pokemon(m.pokeapiId, m.name),
        m.name,
        m.item && names.item(m.item),
        m.ability && names.ability(m.ability),
        ...m.types.map(names.type),
        m.teraType ? names.type(m.teraType) : "",
        m.nature ? names.nature(m.nature) : "",
        ...(m.moves ?? []).map(names.move),
      ].some((v) => fold(v || "").includes(q)),
    );
  }, [searchQuery, team.pokemon, names]);
  const teamMembers = team.pokemon.filter((m) => m.inTeam);
  const partyFull = teamMembers.length >= MAX_ROWS;
  // Removal mode, only offered on a full party; it ends once a slot frees up.
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    if (!partyFull) setRemoving(false);
  }, [partyFull]);
  const visibleActiveMembers = teamMembers.slice(0, MAX_ROWS);
  const emptySlots = MAX_ROWS - visibleActiveMembers.length;
  const visibleBoxMembers = filteredAllMembers.slice(0, MAX_ROWS);

  const suggestions = useTeammateSuggestions(team, teamMembers);

  // Opening a member's menu comes just before "Edit set": warm the editor's data then.
  const prefetchMember = (member: PokemonSet) => {
    if (team.mode === "adventure") return;
    prefetchSetSpecies(queryClient, team.mode, team.format, member.name, () =>
      loadBuildFor(queryClient, team.mode, team.format, member.name),
    );
  };
  // Party is capped at MAX_ROWS; extra Pokémon go to the Box.
  const addOption = (option: PokemonOption) =>
    onAddPokemon(newMember(team, option, teamMembers.length < MAX_ROWS));
  const addSet = (option: PokemonOption, draft: SetDraft) =>
    onAddPokemon(newMember(team, option, teamMembers.length < MAX_ROWS, draft));
  // A team member's set, opened in the editor (competitive modes only).
  const queryClient = useQueryClient();
  const [editingMember, setEditingMember] = useState<PokemonSet | null>(null);
  // The row menu: one open at a time across party and Box.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const competitive = team.mode !== "adventure";
  const rowActions = (member: PokemonSet): RowAction[] => [
    ...(competitive
      ? [
          {
            key: "edit",
            label: t("row.edit"),
            icon: PencilIcon,
            onSelect: () => setEditingMember(member),
          },
        ]
      : []),
    ...(competitive
      ? [
          {
            key: "copy",
            label: t("row.copy"),
            icon: CopyIcon,
            onSelect: () => {
              navigator.clipboard
                .writeText(toShowdown(member.name, memberDraft(member)))
                .then(() => toast.success(t("row.copied")))
                .catch(() => toast.error(t("row.copyFailed")));
            },
          },
        ]
      : []),
    {
      key: "remove",
      label: t("row.remove"),
      icon: Trash2Icon,
      danger: true,
      onSelect: () => onRemovePokemon(member.id),
    },
  ];
  const saveMember = (member: PokemonSet, draft: SetDraft) =>
    onUpdatePokemon(withDraft(team, member, draft));

  // A suggested teammate opens its set editor first, like a pick from the Add dialog.
  const [suggestedPick, setSuggestedPick] = useState<PokemonOption | null>(null);
  const pickSuggestion = (option: PokemonOption) => {
    if (team.mode === "adventure") return addOption(option);
    setSuggestedPick(option);
    setPartyAddOpen(true);
  };
  const emptyBoxSlots = MAX_ROWS - visibleBoxMembers.length;

  // Adventure teams track progression: the game's data says when each Pokémon becomes obtainable.
  const isAdventure = team.mode === "adventure";
  const game = useQuery({
    queryKey: ["game", team.format],
    queryFn: () => loadGame(team.format),
    enabled: isAdventure,
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
  const [progress, setProgress] = useState(0);
  const [wishlist, setWishlist] = useState<PokemonOption[]>([]);
  const [boxView, setBoxView] = useState<"box" | "wish">("wish");
  const [partyAddOpen, setPartyAddOpen] = useState(false);
  const rules = team.rules ?? DEFAULT_RULES;
  const speciesById = useMemo(
    () => new Map<number, GamePokemon>(game?.pokemon.map((p) => [p.id, p]) ?? []),
    [game],
  );
  const sourceOf = (pokeapiId: number): Source | undefined => {
    const pokemon = speciesById.get(pokeapiId);
    return pokemon ? bestSource(pokemon, team.format, rules) : undefined;
  };
  const statusOf = (member: PokemonSet): MemberStatus | undefined => {
    if (!game) return undefined;
    const src = sourceOf(member.pokeapiId);
    if (!src) return { state: "never", label: t("progress.never"), why: [] };
    const { step, why } = describeSource(src, game, t, lang, names);
    if (src.s > progress) return { state: "later", label: t("progress.later", { step }), why };
    if (src.s === progress) return { state: "new", label: t("progress.new"), why };
    return undefined;
  };

  const wishItems = wishlist.map((option) => ({ option, src: sourceOf(option.pokeapiId) }));

  // One starter per playthrough (note de cadrage 2.1): the other starters' families, once one is owned.
  const starterBlocked = useMemo(
    () =>
      game
        ? blockedStarters(
            game,
            team.pokemon.map((p) => p.pokeapiId),
          )
        : new Set<number>(),
    [game, team.pokemon],
  );

  // A wish joins the team: straight in if there is a free slot, otherwise it replaces someone (chosen by the player).
  const [replacing, setReplacing] = useState<PokemonOption | null>(null);
  const teamRef = useRef(teamMembers);
  teamRef.current = teamMembers;
  const notified = useRef(new Set<number>());
  const joinTeam = (option: PokemonOption) => {
    onAddPokemon({
      id: crypto.randomUUID(),
      pokeapiId: option.pokeapiId,
      name: option.name,
      item: "",
      ability: option.ability,
      types: option.types,
      moves: [],
      inTeam: true,
    });
    setWishlist((w) => w.filter((o) => o.pokeapiId !== option.pokeapiId));
  };
  const onWishAvailable = (option: PokemonOption) =>
    teamRef.current.length < MAX_ROWS ? joinTeam(option) : setReplacing(option);

  // Each wish notifies once, the first time its step is reached.
  useEffect(() => {
    if (!game) return;
    for (const option of wishlist) {
      const src = sourceOf(option.pokeapiId);
      if (!src || src.s > progress || notified.current.has(option.pokeapiId)) continue;
      notified.current.add(option.pokeapiId);
      const info = describeSource(src, game, t, lang, names);
      toast(t("wish.toast", { name: names.pokemon(option.pokeapiId, option.name) }), {
        description: [info.where, info.how, info.chance].filter(Boolean).join(" · "),
        action: { label: t("wish.toastAction"), onClick: () => onWishAvailable(option) },
      });
    }
    // Only react to progression and wishlist changes; sourceOf and friends are derived from them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, wishlist, game]);

  return (
    // Adventure teams can show their game's sprites (lib/sprites.tsx, a viewer preference).
    <SpriteScope versionGroup={isAdventure ? gameOf(team.format)?.versionGroup : undefined}>
      <div className="relative w-full pb-0 font-sans not-prose bg-background rounded-[28px] border border-border flex flex-col overflow-hidden shadow-none">
        <div className="flex flex-col h-full bg-background">
          <div className="p-8 pb-3">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                  <span className="truncate">{team.name}</span>
                  <span className="text-xs bg-muted px-2 py-1 mt-0.5 rounded-full text-muted-foreground leading-none font-normal">
                    {teamMembers.length}
                  </span>
                </h2>
                <p className="mt-1 text-xs text-muted-foreground truncate">
                  {t(`mode.${team.mode}`)} · {formatName(team.mode, team.format)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isAdventure && game && (
                  <>
                    <AddPokemonDialog
                      mode={team.mode}
                      format={team.format}
                      rules={team.rules}
                      blocked={starterBlocked}
                      variant="wish"
                      onAdd={(option) =>
                        setWishlist((w) =>
                          w.some((o) => o.pokeapiId === option.pokeapiId) ? w : [...w, option],
                        )
                      }
                    />
                  </>
                )}
                <Link
                  to="/team/$teamId"
                  params={{ teamId: team.id }}
                  aria-label={t("page.open")}
                  title={t("page.open")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <Maximize2Icon size={16} />
                </Link>
                <ShareTeamDialog team={team} />
                {partyFull ? (
                  // A full party can't take more: the "+" becomes a toggle for removing Pokémon.
                  <Button
                    variant="outline"
                    size="icon"
                    aria-pressed={removing}
                    aria-label={removing ? t("row.removeDone") : t("row.removeMode")}
                    title={removing ? t("row.removeDone") : t("row.removeMode")}
                    onClick={() => setRemoving((r) => !r)}
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-full border-border/50 hover:bg-muted/50",
                      removing
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {removing ? (
                      <CheckIcon size={18} strokeWidth={2.5} />
                    ) : (
                      <XIcon size={18} strokeWidth={2.5} />
                    )}
                  </Button>
                ) : (
                  <AddPokemonDialog
                    mode={team.mode}
                    format={team.format}
                    rules={team.rules}
                    blocked={starterBlocked}
                    onAdd={addOption}
                    onAddSet={addSet}
                    startWith={suggestedPick}
                    open={partyAddOpen}
                    onOpenChange={(open) => {
                      setPartyAddOpen(open);
                      if (!open) setSuggestedPick(null);
                    }}
                  />
                )}
              </div>
            </div>
            {isAdventure && game && game.steps.length > 1 && (
              <ProgressBar steps={game.steps} value={progress} onChange={setProgress} />
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-[100px] custom-scrollbar scroll-visible">
            <motion.div
              initial={false}
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
              className="space-y-0.5"
            >
              {visibleActiveMembers.map((member) => (
                <MemberItem
                  key={`active-${member.id}`}
                  member={member}
                  status={statusOf(member)}
                  actions={removing ? undefined : rowActions(member)}
                  // Keyed by place: the same Pokémon can also be listed in the Box.
                  menuOpen={menuFor === `active-${member.id}`}
                  onMenuChange={(open) => {
                    if (open) prefetchMember(member);
                    setMenuFor(open ? `active-${member.id}` : null);
                  }}
                  setTip={competitive && !removing}
                  onRemove={removing ? () => onRemovePokemon(member.id) : undefined}
                  missing={competitive ? missingParts(member) : undefined}
                />
              ))}
              {Array.from({ length: emptySlots }, (_, i) =>
                i === 0 && suggestions.length > 0 ? (
                  <SuggestionSlot
                    key="suggestions"
                    suggestions={suggestions}
                    onPick={pickSuggestion}
                  />
                ) : (
                  <EmptySlot key={`empty-${i}`} onOpen={() => setPartyAddOpen(true)} />
                ),
              )}
            </motion.div>
          </div>
        </div>

        <Dialog
          open={editingMember !== null}
          onOpenChange={(open) => !open && setEditingMember(null)}
        >
          <DialogContent
            showCloseButton={false}
            className={`${dialogContentClass} max-h-[90dvh] overflow-y-auto sm:max-w-2xl`}
          >
            {editingMember && team.mode !== "adventure" && (
              <SetEditor
                key={editingMember.id}
                mode={team.mode}
                format={team.format}
                species={editingMember.name}
                pokeapiId={editingMember.pokeapiId}
                sprite={artwork(editingMember.pokeapiId)}
                loadBuild={() =>
                  loadBuildFor(queryClient, team.mode, team.format, editingMember.name)
                }
                initial={memberDraft(editingMember)}
                confirmLabel={t("set.save")}
                onBack={() => setEditingMember(null)}
                onConfirm={(draft) => {
                  saveMember(editingMember, draft);
                  setEditingMember(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Pick who leaves the team for a wish that just became available. */}
        <Dialog open={replacing !== null} onOpenChange={(open) => !open && setReplacing(null)}>
          <DialogContent showCloseButton={false} className={dialogContentClass}>
            {replacing && (
              <>
                <DialogHeading
                  title={t("wish.replaceTitle")}
                  description={t("wish.replaceDescription", {
                    name: names.pokemon(replacing.pokeapiId, replacing.name),
                  })}
                />
                <ul className="grid gap-1">
                  {teamMembers.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onRemovePokemon(member.id);
                          joinTeam(replacing);
                          setReplacing(null);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl bg-muted/40 p-2 text-left transition-colors hover:bg-muted/70"
                      >
                        <PokemonImg
                          id={member.pokeapiId}
                          decoding="async"
                          alt=""
                          className="size-10 shrink-0 rounded-full bg-muted object-contain"
                        />
                        <span className="truncate text-sm text-foreground">
                          {names.pokemon(member.pokeapiId, member.name)}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {t("wish.replaceAction")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </DialogContent>
        </Dialog>

        <motion.div
          layout
          initial={false}
          animate={{
            height: isExpanded ? "calc(100% - 20px)" : "68px",
            width: isExpanded ? "calc(100% - 20px)" : "calc(100% - 40px)",
            bottom: isExpanded ? "10px" : "20px",
            left: isExpanded ? "10px" : "20px",
            borderRadius: isExpanded ? "20px" : "16px",
          }}
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 30,
            mass: 0.8,
          }}
          className="absolute z-50 overflow-hidden border border-border shadow-none flex flex-col group/bar bg-card"
          style={{ cursor: isExpanded ? "default" : "pointer" }}
          onClick={() => !isExpanded && setIsExpanded(true)}
          role={isExpanded ? undefined : "button"}
          tabIndex={isExpanded ? undefined : 0}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? undefined : t("box.open")}
          onKeyDown={(e) => {
            if (!isExpanded && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setIsExpanded(true);
            }
          }}
        >
          <div
            className={`flex items-center justify-between px-3 h-[68px] shrink-0 transition-colors ${
              isExpanded ? "border-b border-border/40" : "hover:bg-muted/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-transform group-hover/bar:scale-105">
                <BoxIcon size={20} strokeWidth={2} />
              </div>
              <motion.div layout="position">
                <h4 className="text-base font-medium text-foreground tracking-tight leading-none  ">
                  {isAdventure && game ? t("wish.button") : t("box.title")}
                </h4>
                <p className="text-xs font-normal leading-none text-muted-foreground  mt-1">
                  {isAdventure && game
                    ? t("wish.summary", {
                        count: wishItems.length,
                        available: wishItems.filter((w) => w.src && w.src.s <= progress).length,
                      })
                    : t("box.count", { count: team.pokemon.length })}
                </p>
              </motion.div>
            </div>

            <div className="flex items-center gap-3">
              {!isExpanded && (
                <div className="flex items-center gap-0">
                  <div className="flex -space-x-3">
                    {/* Adventure teams preview their wishlist here, the Box is one tab further in. */}
                    {(isAdventure && game
                      ? wishItems.map(({ option, src }) => ({
                          key: option.key,
                          id: option.pokeapiId,
                          name: option.name,
                          // Ring fills as the player gets closer to the step that unlocks it.
                          ratio: !src ? 0 : src.s <= progress ? 1 : progress / src.s,
                        }))
                      : team.pokemon.map((m) => ({
                          key: m.id,
                          id: m.pokeapiId,
                          name: m.name,
                          ratio: undefined,
                        }))
                    )
                      .slice(0, 3)
                      .map((m) => {
                        const img = (
                          <motion.img
                            src={artwork(m.id)}
                            decoding="async"
                            className="w-10 h-10 rounded-full bg-muted object-contain ring-1 ring-background shadow-sm z-1"
                            alt={names.pokemon(m.id, m.name)}
                          />
                        );
                        return m.ratio === undefined ? (
                          <span key={`sum-${m.key}`} className="contents">
                            {img}
                          </span>
                        ) : (
                          <span
                            key={`sum-${m.key}`}
                            className="relative z-1 inline-flex rounded-full p-[3px]"
                            style={{
                              background: `conic-gradient(hsl(${m.ratio * 120} 70% 50%) ${Math.round(m.ratio * 100)}%, var(--muted) 0)`,
                            }}
                            title={fmt.percent(m.ratio)}
                          >
                            {img}
                          </span>
                        );
                      })}
                    {(isAdventure && game ? wishItems.length : team.pokemon.length) > 3 && (
                      <div className="w-10 h-10 rounded-full ring-1 ring-background bg-muted flex items-center justify-center shadow-sm relative z-0">
                        <span className="text-sm font-normal leading-none text-muted-foreground">
                          +{(isAdventure && game ? wishItems.length : team.pokemon.length) - 3}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isExpanded && (
                <button
                  type="button"
                  aria-label={t("box.close")}
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground transition-all flex items-center justify-center bg-muted/60 active:scale-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                >
                  <XIcon size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="px-6 py-4"
                >
                  {isAdventure && game && (
                    <div className="mb-3 flex gap-1.5">
                      {(["wish", "box"] as const).map((view) => (
                        <button
                          key={view}
                          type="button"
                          aria-pressed={boxView === view}
                          onClick={() => setBoxView(view)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs transition-colors",
                            boxView === view
                              ? "text-foreground ring-1 ring-foreground"
                              : "border-border/50 text-muted-foreground hover:bg-muted/50",
                          )}
                        >
                          {view === "box" ? t("box.title") : t("wish.button")}
                          {view === "wish" && (
                            <span className="ml-1.5 tabular-nums">{wishlist.length}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={cn("relative", boxView === "wish" && "hidden")}>
                    <SearchIcon
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 z-10"
                      size={15}
                    />
                    <Input
                      aria-label={t("box.search")}
                      placeholder={t("box.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 transition-all w-full box-border pl-10"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar scroll-visible">
              <motion.div
                initial="hidden"
                animate={isExpanded ? "visible" : "hidden"}
                onAnimationComplete={(definition) => {
                  if (definition === "hidden") setBoxMounted(false);
                }}
                variants={{
                  visible: {
                    transition: { staggerChildren: 0.03, delayChildren: 0.1 },
                  },
                  hidden: {
                    transition: { staggerChildren: 0.02, staggerDirection: -1 },
                  },
                }}
                className="space-y-0.5"
              >
                {!boxMounted ? null : isAdventure && game && boxView === "wish" ? (
                  <WishList
                    items={wishItems}
                    game={game}
                    progress={progress}
                    onRemove={(id) => setWishlist((w) => w.filter((o) => o.pokeapiId !== id))}
                  />
                ) : (
                  <>
                    {visibleBoxMembers.map((member) => (
                      <MemberItem
                        key={`list-${member.id}`}
                        member={member}
                        status={statusOf(member)}
                        actions={rowActions(member)}
                        menuOpen={menuFor === `list-${member.id}`}
                        onMenuChange={(open) => {
                          if (open) prefetchMember(member);
                          setMenuFor(open ? `list-${member.id}` : null);
                        }}
                        setTip={competitive}
                        missing={competitive ? missingParts(member) : undefined}
                      >
                        {/* The Box is where sets get planned: each one shows how to get its moves. */}
                        {competitive && (
                          <MemberDetails member={member} gen={formatGen(team.format)} />
                        )}
                      </MemberItem>
                    ))}
                    {Array.from({ length: emptyBoxSlots }, (_, i) => (
                      <EmptySlot key={`box-empty-${i}`} />
                    ))}
                  </>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </SpriteScope>
  );
}
