// Colours and small icons shared by the set editor and its Meta tab, so data reads at a glance:
// Showdown's stat colours, type icons (public/types) and item bag sprites.
import { typeColor, typeKey } from "@/components/type-chip";
import { toIdentifier } from "@/lib/i18n";

// Showdown's stat colours, so a spread reads at a glance (and matches what players know).
export const STAT_COLORS: Record<string, string> = {
  hp: "#ff5959",
  atk: "#f5ac78",
  def: "#fae078",
  spa: "#9db7f5",
  spd: "#a7db8d",
  spe: "#fa92b2",
};

// Text in a data colour, mixed with the theme's text colour so pastels stay readable on light themes.
export const ink = (color?: string) =>
  color ? `color-mix(in oklab, ${color} 75%, var(--foreground))` : undefined;

export const TypeIcon = ({ type }: { type?: string }) =>
  type && typeColor(type) ? (
    <img
      src={`/types/${typeKey(type)}.svg`}
      alt=""
      width={14}
      height={14}
      className="size-3.5 shrink-0"
    />
  ) : null;

// A move's damage category, drawn after the games' convention (and Showdown's, Bulbapedia's): an impact
// burst on red for physical, ripples on blue for special, a swirl on grey for status. Our own SVGs in
// public/categories, in the type icons' style. Before gen 4 the category follows the move's type;
// @pkmn/dex already gives it per generation.
export const CategoryIcon = ({ category, size = 14 }: { category?: string; size?: number }) =>
  category && ["Physical", "Special", "Status"].includes(category) ? (
    <img
      src={`/categories/${category.toLowerCase()}.svg`}
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  ) : null;

// The item's bag sprite (same source as the team rows), hidden when PokeAPI has none.
export const ItemIcon = ({ item }: { item: string }) => (
  <img
    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${toIdentifier(item)}.png`}
    alt=""
    width={20}
    height={20}
    loading="lazy"
    onError={(e) => {
      e.currentTarget.style.visibility = "hidden";
    }}
    className="-my-1 size-5 shrink-0 object-contain [image-rendering:pixelated]"
  />
);

// The species' types and an id for its artwork, for itself and the Pokémon it lists.
export async function loadDex(gen: number) {
  const { Dex } = await import("@pkmn/dex");
  return Dex.forGen(gen);
}
