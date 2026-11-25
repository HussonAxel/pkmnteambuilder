// A type as a coloured chip with its icon. Icons: partywhale/pokemon-type-icons (MIT, public/types/LICENSE);
// the colours are the ones those icons use, so chip and icon match.
import { useNames } from "@/lib/i18n";

export const TYPE_COLORS: Record<string, string> = {
  bug: "#9f9f28",
  dark: "#4f4747",
  dragon: "#576fbc",
  electric: "#dfbc28",
  fairy: "#e18ce1",
  fighting: "#e49021",
  fire: "#e4613e",
  flying: "#74aad0",
  ghost: "#6f4570",
  grass: "#439837",
  ground: "#a4733c",
  ice: "#47c8c8",
  normal: "#828282",
  poison: "#9354cb",
  psychic: "#e96c8c",
  rock: "#a9a481",
  steel: "#77b2cb",
  water: "#3a9de2",
};

export function TypeChip({ type }: { type: string }) {
  const names = useNames();
  const key = type.toLowerCase();
  const color = TYPE_COLORS[key];
  if (!color) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-0.5 text-[11px] leading-none font-medium uppercase"
      // Tinted fill and border from the type colour. The text mixes it with the theme's text colour so
      // dark types (Dark, Ghost) stay readable on dark backgrounds and Electric on light ones.
      style={{
        backgroundColor: `${color}1f`,
        borderColor: `${color}59`,
        color: `color-mix(in oklab, ${color} 70%, var(--foreground))`,
      }}
    >
      <img src={`/types/${key}.svg`} alt="" width={16} height={16} className="size-4 shrink-0" />
      {names.type(type)}
    </span>
  );
}
