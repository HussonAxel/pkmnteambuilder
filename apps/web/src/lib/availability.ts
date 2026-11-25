// Which Pokémon a player can get in an adventure, from the generated game files. Pure: tested in availability.test.mjs.

// Flags a source needs the player's rules to allow (note de cadrage 2.1).
// dlc: a paid expansion (Sword/Shield's Isle of Armor and Crown Tundra, Scarlet/Violet's Teal Mask and Indigo Disk).
export type Flag = "trade" | "static" | "gift" | "rare" | "postgame" | "dlc";

export interface Source {
  v: string[]; // versions with this source
  f: Flag[];
  s: number; // progression step
  l?: number; // PokeAPI location id
  m?: string; // encounter method, or "breed"
  r?: number; // chance (%) of the encounter slot; absent for gifts, statics and breeding
  // For evolutions (from set): the condition the evolution needs.
  c?: { lv?: number; item?: string; trigger?: string };
  from?: number; // pokemon it evolves or hatches from
  note?: string;
}

export interface GamePokemon {
  id: number; // PokeAPI pokemon id (also the official artwork id)
  species: number;
  dex: number | null; // regional dex number
  types: string[]; // PokeAPI type identifiers, as of the game's generation
  sources: Source[];
}

export interface GameData {
  versionGroup: string;
  generation: number;
  versions: string[];
  progression: boolean;
  steps: { en: string; fr: string }[];
  postgame: number;
  starters: number[];
  pokemon: GamePokemon[];
}

export type Rules = Record<Flag | "exclusives", boolean>;
export type RuleCounts = Record<keyof Rules, number>;

// Defaults from the note de cadrage 2.1: other-version exclusives and trade evolutions hidden.
export const DEFAULT_RULES: Rules = {
  exclusives: false,
  trade: false,
  static: true,
  gift: true,
  rare: true,
  postgame: true,
  dlc: false, // most playthroughs are of the base game; teams saved before this rule read it as off
};

// Earliest step at which each Pokémon is obtainable in `version`, under `rules`. Unobtainable ones are left out.
// Whether a source is open to this version under the team's rules.
function allowed(s: Source, version: string, rules: Rules): boolean {
  // Other-version sources reach this version by trading; the exclusives toggle allows them.
  if (!s.v.includes(version) && !rules.exclusives) return false;
  // A rule missing from older saved teams (dlc) counts as off.
  return !s.f.some((flag) => !rules[flag]);
}

// Earliest step at which each Pokémon is obtainable in `version`, under `rules`. Unobtainable ones are left out.
export function availableIn(
  game: GameData,
  version: string,
  rules: Rules = DEFAULT_RULES,
): { pokemon: GamePokemon; step: number }[] {
  const out = [];
  for (const pokemon of game.pokemon) {
    const best = bestSource(pokemon, version, rules);
    if (best) out.push({ pokemon, step: best.s });
  }
  return out;
}

// The source that makes a Pokémon obtainable first. Among sources at the same step, the most likely one wins.
export function bestSource(
  pokemon: GamePokemon,
  version: string,
  rules: Rules = DEFAULT_RULES,
): Source | undefined {
  let best: Source | undefined;
  for (const s of pokemon.sources) {
    if (!allowed(s, version, rules)) continue;
    if (!best || s.s < best.s || (s.s === best.s && (s.r ?? 0) > (best.r ?? 0))) best = s;
  }
  return best;
}

export const RULE_KEYS = [
  "exclusives",
  "trade",
  "static",
  "gift",
  "rare",
  "postgame",
  "dlc",
] as const;

// How many Pokémon each rule decides: obtainable with every rule on, minus obtainable with only that one off.
// This is the counter next to each switch (note de cadrage, feature 2).
// The Pokémon a rule decides: obtainable with every rule on, but not once that rule is off.
export function affectedBy(game: GameData, version: string, rule: keyof Rules): GamePokemon[] {
  const all = Object.fromEntries(RULE_KEYS.map((k) => [k, true])) as Rules;
  const on = new Set(availableIn(game, version, all).map((a) => a.pokemon.id));
  const kept = new Set(
    availableIn(game, version, { ...all, [rule]: false }).map((a) => a.pokemon.id),
  );
  return game.pokemon.filter((p) => on.has(p.id) && !kept.has(p.id));
}

export function ruleImpact(game: GameData, version: string): RuleCounts {
  const all = Object.fromEntries(RULE_KEYS.map((k) => [k, true])) as Rules;
  const base = availableIn(game, version, all).length;
  return Object.fromEntries(
    RULE_KEYS.map((k) => [k, base - availableIn(game, version, { ...all, [k]: false }).length]),
  ) as RuleCounts;
}
