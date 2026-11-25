// Era sprites (note de cadrage, section 5): Adventure teams can show the in-game sprite of their game
// (gens 1 to 6, PokeAPI/sprites) instead of the official artwork. A viewer preference, kept in this
// browser; a team's components read their game from <SpriteScope>.
import {
  createContext,
  type ImgHTMLAttributes,
  type ReactNode,
  use,
  useEffect,
  useState,
} from "react";
import { artwork } from "@/lib/artwork";

// Same pinned revision as the artwork thumbnails' source.
const BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/c0542f7c51215d9672439012838c99f520596cbd/sprites/pokemon/versions";
// Version group -> sprite folder. ORAS has no full set: X/Y's sprites stand in. None from gen 7 on.
const ERA: Record<string, string> = {
  "red-blue": "generation-i/red-blue",
  yellow: "generation-i/yellow",
  "gold-silver": "generation-ii/gold",
  crystal: "generation-ii/crystal",
  "ruby-sapphire": "generation-iii/ruby-sapphire",
  emerald: "generation-iii/emerald",
  "firered-leafgreen": "generation-iii/firered-leafgreen",
  "diamond-pearl": "generation-iv/diamond-pearl",
  platinum: "generation-iv/platinum",
  "heartgold-soulsilver": "generation-iv/heartgold-soulsilver",
  "black-white": "generation-v/black-white",
  "black-2-white-2": "generation-v/black-white",
  "x-y": "generation-vi/x-y",
  "omega-ruby-alpha-sapphire": "generation-vi/x-y",
};
export const hasEraSprites = (versionGroup?: string) => !!versionGroup && versionGroup in ERA;

const STORAGE_KEY = "pkmnteambuilder.eraSprites";

const PreferenceContext = createContext<{ enabled: boolean; setEnabled: (on: boolean) => void }>({
  enabled: false,
  setEnabled: () => {},
});

export function EraSpritesProvider({ children }: { children: ReactNode }) {
  const [enabled, setState] = useState(false);
  useEffect(() => {
    try {
      setState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Storage blocked: the preference just doesn't stick.
    }
  }, []);
  const setEnabled = (on: boolean) => {
    setState(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      // Same as above.
    }
  };
  return <PreferenceContext value={{ enabled, setEnabled }}>{children}</PreferenceContext>;
}

export const useEraSprites = () => use(PreferenceContext);

// The game whose sprites apply to the images below (an Adventure team's version group).
const ScopeContext = createContext<string | undefined>(undefined);
export const SpriteScope = ({
  versionGroup,
  children,
}: {
  versionGroup?: string;
  children: ReactNode;
}) => <ScopeContext value={versionGroup}>{children}</ScopeContext>;

// A Pokémon's picture: its game's sprite when the preference is on and one exists, else the artwork.
// Falls back to the artwork if the sprite is missing (some formes have none).
export function PokemonImg({
  id,
  className,
  style,
  ...props
}: { id: number } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "id">) {
  const { enabled } = useEraSprites();
  const versionGroup = use(ScopeContext);
  const folder = enabled && versionGroup ? ERA[versionGroup] : undefined;
  const [failed, setFailed] = useState(false);
  const era = folder && !failed;
  return (
    <img
      {...props}
      src={era ? `${BASE}/${folder}/${id}.png` : artwork(id)}
      onError={() => setFailed(true)}
      className={className}
      // Pixel art stays crisp when scaled up.
      style={era ? { ...style, imageRendering: "pixelated" } : style}
    />
  );
}
