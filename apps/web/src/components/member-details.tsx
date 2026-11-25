// Box details: how this Pokémon learns each of its moves in its team's generation, to plan breeding and TMs.
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { FORM_ARTWORK_IDS } from "@/data/form-artwork-ids";
import { artwork } from "@/lib/artwork";
import { useI18n, useNames } from "@/lib/i18n";
import { howToLearn, type LearnData, type Method } from "@/lib/learn";
import { loadLearnData } from "@/lib/learn-data";
import type { PokemonSet } from "@/components/stacked-list";

// Fathers shown as icons before the rest collapses into "+N".
const MAX_FATHERS = 8;

// gen: the team's generation, whose learnsets apply.
export function MemberDetails({ member, gen }: { member: PokemonSet; gen: number }) {
  const { t } = useI18n();
  // The learnsets load on first unfold, not when the Box opens.
  const [opened, setOpened] = useState(false);

  // Native <details>: an accessible accordion (keyboard, screen readers) with no state to keep.
  // Closed by default: the Box stays compact, each set unfolds on demand.
  return (
    <details
      onToggle={(e) => e.currentTarget.open && setOpened(true)}
      className="group mt-3 rounded-2xl bg-muted/30 text-xs"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {t("learn.title")}
        <ChevronDownIcon
          size={16}
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-4 pb-4">
        <LearnList member={member} gen={gen} enabled={opened} />
      </div>
    </details>
  );
}

// How the member learns each of its moves, without the accordion: the Box wraps it in one, the team
// page shows it in a tab. enabled: load the learnsets now (false until the accordion first opens).
export function LearnList({
  member,
  gen,
  enabled = true,
}: {
  member: PokemonSet;
  gen: number;
  enabled?: boolean;
}) {
  const { t } = useI18n();
  const { data, isError } = useQuery({
    queryKey: ["learn", gen],
    queryFn: () => loadLearnData(gen),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (member.moves.length === 0)
    return <p className="text-muted-foreground">{t("learn.noMoves")}</p>;
  if (isError) return <p className="text-muted-foreground">{t("learn.loadError")}</p>;
  if (!data) return <p className="text-muted-foreground">{t("learn.loading")}</p>;
  return (
    <ul className="grid gap-3">
      {member.moves.map((move) => (
        <MoveLine key={move} data={data} species={member.name} move={move} />
      ))}
    </ul>
  );
}

// One move: its name with how to learn it on the right, then the egg fathers underneath.
function MoveLine({ data, species, move }: { data: LearnData; species: string; move: string }) {
  const { t } = useI18n();
  const names = useNames();
  const how = howToLearn(data, species, move);
  const egg = how?.find((m) => m.kind === "egg");
  return (
    <li className="grid gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{names.move(move)}</span>
        {!how ? (
          <span className="text-right text-red-500">{t("learn.cannot")}</span>
        ) : (
          <div className="flex flex-wrap justify-end gap-1.5">
            {how.map((m) => (
              <MethodChip key={`${m.kind}-${m.by ?? ""}`} method={m} data={data} />
            ))}
          </div>
        )}
      </div>
      {egg &&
        (egg.fathers.length > 0 ? (
          <Fathers fathers={egg.fathers} data={data} />
        ) : (
          <Chain chain={egg.chain} data={data} />
        ))}
    </li>
  );
}

const chip = "rounded-full border border-border/60 px-2 py-0.5 text-muted-foreground";

function MethodChip({ method, data }: { method: Method; data: LearnData }) {
  const { t } = useI18n();
  const names = useNames();
  const label = (() => {
    switch (method.kind) {
      case "level":
        return t("learn.level", { level: method.level });
      case "evolution":
        return method.level
          ? t("learn.evolutionAt", { level: method.level })
          : t("learn.evolution");
      case "tm":
        // TM items are localised by the names files ("CT99" in French).
        return method.item ? names.item(method.item) : t("learn.tm");
      case "tutor":
        return t("learn.tutor");
      case "event":
        return t("learn.event");
      case "egg":
        return t("learn.egg");
    }
  })();
  // "Lv. 27 · Bellsprout": a pre-evolution learns it, before evolving.
  const by = method.by && names.pokemon(pokeapiId(data, method.by), method.by);
  return (
    <span className={chip} title={by ? t("learn.by", { name: by }) : undefined}>
      {label}
      {by && ` · ${by}`}
    </span>
  );
}

// No father shares an egg group: the breeding chain that gets there, or why there is none.
function Chain({ chain, data }: { chain?: string[]; data: LearnData }) {
  const { t } = useI18n();
  const names = useNames();
  if (!chain) return <p className="text-muted-foreground">{t("learn.noBreeding")}</p>;
  return (
    <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
      <span className="mr-1">{t("learn.chain")}</span>
      {chain.map((step, i) => {
        const id = pokeapiId(data, step);
        const name = names.pokemon(id, step);
        return (
          <span key={step} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon size={12} aria-hidden />}
            <img
              src={artwork(id)}
              alt={name}
              title={name}
              loading="lazy"
              className="size-6 rounded-full bg-muted object-contain"
            />
          </span>
        );
      })}
    </div>
  );
}

function Fathers({ fathers, data }: { fathers: string[]; data: LearnData }) {
  const names = useNames();
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {fathers.slice(0, MAX_FATHERS).map((father) => {
        const id = pokeapiId(data, father);
        const name = names.pokemon(id, father);
        return (
          <img
            key={father}
            src={artwork(id)}
            alt={name}
            title={name}
            loading="lazy"
            className="size-6 rounded-full bg-muted object-contain"
          />
        );
      })}
      {fathers.length > MAX_FATHERS && (
        <span
          className="text-muted-foreground"
          title={fathers
            .slice(MAX_FATHERS)
            .map((f) => names.pokemon(pokeapiId(data, f), f))
            .join(", ")}
        >
          {t("learn.more", { count: fathers.length - MAX_FATHERS })}
        </span>
      )}
    </div>
  );
}

// PokeAPI id (artwork and localised name) of a @pkmn/dex species name.
const pokeapiId = (data: LearnData, name: string) =>
  FORM_ARTWORK_IDS[name] ?? data.species.find(([n]) => n === name)?.[1] ?? 0;
