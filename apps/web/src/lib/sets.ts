// Sets a player can start from: Smogon analysis sets, the most used build, or a blank one.
// Pure: tested in sets.test.mjs.

import { z } from "zod";

export const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
export type Stat = (typeof STATS)[number];
export type Evs = Record<Stat, number>;

// Gen 3+ rules: 252 per stat, 510 in total.
export const EV_MAX = 252;
export const EV_TOTAL = 510;

export interface SetDraft {
  item: string;
  ability: string;
  teraType?: string;
  nature: string;
  evs: Evs;
  ivs: Evs;
  moves: string[]; // up to 4, "" for an empty slot
}

export interface Recommendation {
  name: string; // analysis set name, or "usage" for the most used build
  draft: SetDraft;
}

// Usage shares per option (0.25 = 25%), as in Smogon's moveset stats.
export interface Build {
  abilities: Record<string, number>;
  items: Record<string, number>;
  moves: Record<string, number>;
  teraTypes: Record<string, number>;
  spreads: Record<string, number>; // "Jolly:0/252/4/0/0/252"
}

// A Smogon analysis set (data.pkmn.cc/sets): any field may list alternatives, possibly nested.
export interface AnalysisSet {
  moves: (string | string[])[];
  item?: string | string[];
  ability?: string | string[];
  nature?: string | string[];
  evs?: Partial<Evs> | Partial<Evs>[];
  ivs?: Partial<Evs> | Partial<Evs>[];
  teratypes?: string | string[];
}

export const emptyEvs = (): Evs => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

export const maxIvs = (): Evs => ({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });

export const emptyDraft = (ability: string): SetDraft => ({
  item: "",
  ability,
  nature: "Serious",
  evs: emptyEvs(),
  ivs: maxIvs(),
  moves: ["", "", "", ""],
});

// The first listed option is the analysis' main pick.
const first = <T>(value: T | T[] | undefined): T | undefined =>
  Array.isArray(value) ? first(value[0] as T | T[]) : value;

const fourMoves = (moves: string[]) => [...moves, "", "", "", ""].slice(0, 4);

export function fromAnalysis(
  name: string,
  set: AnalysisSet,
  fallbackAbility: string,
): Recommendation {
  const evs = first(set.evs);
  return {
    name,
    draft: {
      item: first(set.item) ?? "",
      ability: first(set.ability) ?? fallbackAbility,
      teraType: first(set.teratypes),
      nature: first(set.nature) ?? "Serious",
      evs: { ...emptyEvs(), ...evs },
      ivs: { ...maxIvs(), ...first(set.ivs) },
      moves: fourMoves(set.moves.map((m) => first(m) ?? "")),
    },
  };
}

// "Jolly:0/252/4/0/0/252" -> nature and EVs.
export function parseSpread(spread: string): { nature: string; evs: Evs } {
  const [nature = "Serious", values = ""] = spread.split(":");
  const numbers = values.split("/").map(Number);
  return {
    nature,
    evs: Object.fromEntries(STATS.map((s, i) => [s, numbers[i] || 0])) as Evs,
  };
}

const best = (shares: Record<string, number>, skip: string[] = []) =>
  Object.entries(shares)
    .filter(([key]) => key !== "" && !skip.includes(key))
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

// The most used option of every slot: what the ladder plays most often.
export function fromUsage(build: Build, fallbackAbility: string): Recommendation {
  const spread = best(build.spreads)[0];
  const { nature, evs } = spread ? parseSpread(spread) : { nature: "Serious", evs: emptyEvs() };
  return {
    name: "usage",
    draft: {
      item: best(build.items, ["Nothing", "nothing"])[0] ?? "",
      ability: best(build.abilities)[0] ?? fallbackAbility,
      teraType: best(build.teraTypes, ["Nothing", "nothing"])[0],
      nature,
      evs,
      ivs: maxIvs(),
      moves: fourMoves(best(build.moves, ["Nothing", "nothing"]).slice(0, 4)),
    },
  };
}

export const evTotal = (evs: Evs) => STATS.reduce((sum, s) => sum + evs[s], 0);

// A stat is clamped to 0–252 and to what the 510 total still allows.
export function setEv(evs: Evs, stat: Stat, value: number): Evs {
  const others = evTotal(evs) - evs[stat];
  const clamped = Math.max(0, Math.min(EV_MAX, EV_TOTAL - others, Math.round(value) || 0));
  return { ...evs, [stat]: clamped };
}

// Gen 3+ stat formula. A nature raises one stat by 10% and lowers another by 10% (or neither).
export function calcStat(
  stat: Stat,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature?: { plus?: Stat; minus?: Stat },
): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (stat === "hp") return base === 1 ? 1 : core + level + 10; // Shedinja always has 1 HP
  const mod = nature?.plus === stat ? 1.1 : nature?.minus === stat ? 0.9 : 1;
  return Math.floor((core + 5) * mod);
}

export const setIv = (ivs: Evs, stat: Stat, value: number): Evs => ({
  ...ivs,
  [stat]: Math.max(0, Math.min(31, Math.round(value) || 0)),
});

// ---- Import from a Showdown paste ----

const STAT_LABELS: Record<string, Stat> = {
  hp: "hp",
  atk: "atk",
  def: "def",
  spa: "spa",
  spd: "spd",
  spe: "spe",
};

// "252 HP / 4 Def / 252 Spe" -> { hp: 252, def: 4, spe: 252 }
function parseStatLine(line: string): Partial<Record<Stat, number>> {
  const out: Partial<Record<Stat, number>> = {};
  for (const part of line.split("/")) {
    const [, n, label] = part.trim().match(/^(-?\d+)\s+(\w+)$/) ?? [];
    const stat = label && STAT_LABELS[label.toLowerCase()];
    if (stat) out[stat] = Number(n);
  }
  return out;
}

// Showdown's export format. Unknown lines (Level, Shiny, Happiness…) are ignored.
export function parseShowdown(text: string) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const [head = "", ...rest] = lines;
  const [name = "", item = ""] = head.split(" @ ").map((s) => s.trim());
  // "Nickname (Species) (M)": drop the gender, then prefer the species in parentheses.
  const noGender = name.replace(/\s*\((M|F)\)$/, "");
  const species = noGender.match(/\(([^()]+)\)$/)?.[1] ?? noGender;
  const set = {
    species,
    item,
    ability: "",
    teraType: undefined as string | undefined,
    nature: "Serious",
    evs: {} as Partial<Record<Stat, number>>,
    ivs: {} as Partial<Record<Stat, number>>,
    moves: [] as string[],
  };
  for (const line of rest) {
    if (line.startsWith("-")) set.moves.push(line.slice(1).trim());
    else if (line.startsWith("Ability:")) set.ability = line.slice(8).trim();
    else if (line.startsWith("Tera Type:")) set.teraType = line.slice(10).trim();
    else if (line.startsWith("EVs:")) set.evs = parseStatLine(line.slice(4));
    else if (line.startsWith("IVs:")) set.ivs = parseStatLine(line.slice(4));
    else if (line.endsWith(" Nature")) set.nature = line.slice(0, -7).trim();
  }
  return set;
}

// Structural rules, whatever the species. Messages are i18n keys.
const statSchema = (max: number) =>
  z
    .int({ error: "import.badNumber" })
    .min(0, { error: "import.badNumber" })
    .max(max, {
      error: max === EV_MAX ? "import.evMax" : "import.ivMax",
    });

export const importedSetSchema = z.object({
  species: z.string().min(1, { error: "import.noSpecies" }),
  item: z.string(),
  ability: z.string(),
  teraType: z.string().optional(),
  nature: z.string(),
  evs: z
    .partialRecord(z.enum(STATS), statSchema(EV_MAX))
    .refine((evs) => Object.values(evs).reduce((a, b) => a + (b ?? 0), 0) <= EV_TOTAL, {
      error: "import.evTotal",
    }),
  ivs: z.partialRecord(z.enum(STATS), statSchema(31)),
  moves: z
    .array(z.string().min(1))
    .min(1, { error: "import.noMoves" })
    .max(4, { error: "import.tooManyMoves" }),
});
export type ImportedSet = z.infer<typeof importedSetSchema>;

// What the species may legally run, from @pkmn/dex.
export interface Legal {
  species: string;
  abilities: string[];
  moves: string[];
  items: string[];
  natures: string[];
  teraTypes: string[];
}

// `field` says where the problem is ("item", "ability", "nature", "tera", "move-0"…), for the editor.
export type ImportProblem = { key: string; value?: string; field?: string };

// Checks a set against what the species may legally run, and spells every value the canonical way
// ("toxic" -> "Toxic"). Used when saving from the editor and when importing a paste.
export function checkDraft(
  draft: SetDraft,
  legal: Omit<Legal, "species">,
): { draft: SetDraft; problems: ImportProblem[] } {
  const problems: ImportProblem[] = [];
  const find = (list: string[], value: string) => list.find((x) => norm(x) === norm(value));
  const ability = draft.ability ? find(legal.abilities, draft.ability) : legal.abilities[0];
  if (!ability) problems.push({ key: "import.badAbility", value: draft.ability, field: "ability" });
  const item = draft.item.trim() ? find(legal.items, draft.item) : "";
  if (item === undefined)
    problems.push({ key: "import.badItem", value: draft.item, field: "item" });
  const nature = find(legal.natures, draft.nature);
  if (!nature) problems.push({ key: "import.badNature", value: draft.nature, field: "nature" });
  // No Tera list means a generation without Terastallization: the field is ignored.
  const teraType =
    draft.teraType && legal.teraTypes.length ? find(legal.teraTypes, draft.teraType) : undefined;
  if (draft.teraType && legal.teraTypes.length && !teraType)
    problems.push({ key: "import.badTera", value: draft.teraType, field: "tera" });
  const moves = draft.moves.map((m) => (m.trim() ? find(legal.moves, m) : ""));
  draft.moves.forEach((m, i) => {
    if (moves[i] === undefined)
      problems.push({ key: "import.badMove", value: m, field: `move-${i}` });
  });
  const picked = moves.filter(Boolean);
  if (new Set(picked).size !== picked.length) problems.push({ key: "import.duplicateMove" });
  return {
    draft: {
      ...draft,
      item: item ?? draft.item,
      ability: ability ?? draft.ability,
      teraType: teraType ?? (legal.teraTypes.length ? draft.teraType : undefined),
      nature: nature ?? draft.nature,
      moves: moves.map((m, i) => m ?? draft.moves[i]!),
    },
    problems,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Parse, check structure with Zod, then legality for this species. Returns the draft or the problems.
export function importSet(
  text: string,
  legal: Legal,
): { draft: SetDraft; problems?: undefined } | { draft?: undefined; problems: ImportProblem[] } {
  const parsed = importedSetSchema.safeParse(parseShowdown(text));
  if (!parsed.success)
    return {
      problems: [...new Set(parsed.error.issues.map((i) => i.message))].map((key) => ({ key })),
    };
  const set = parsed.data;
  const problems: ImportProblem[] = [];
  if (norm(set.species) !== norm(legal.species))
    problems.push({ key: "import.wrongSpecies", value: set.species });
  const checked = checkDraft(
    {
      item: set.item,
      ability: set.ability,
      teraType: set.teraType,
      nature: set.nature,
      evs: { ...emptyEvs(), ...set.evs },
      ivs: { ...maxIvs(), ...set.ivs },
      moves: fourMoves(set.moves),
    },
    legal,
  );
  problems.push(...checked.problems);
  if (problems.length) return { problems };
  return { draft: checked.draft };
}

// ---- Autocomplete inside a Showdown paste ----

export type PasteField = "species" | "item" | "ability" | "tera" | "move" | "stat" | "line";

// What the word under the caret is, judged from its line: the first line is "Species @ Item",
// "Ability:", "Tera Type:", "EVs:"/"IVs:" and "- move" lines say what they hold, and any other
// line starts a keyword or a nature. `start` is where the word being typed begins.
export function pasteContext(
  text: string,
  caret: number,
): { field: PasteField; query: string; start: number } | null {
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  const before = text.slice(lineStart, caret);
  const at = (offset: number, field: PasteField) => ({
    field,
    query: before.slice(offset),
    start: lineStart + offset,
  });
  if (text.slice(0, lineStart).trim() === "") {
    const item = before.indexOf(" @ ");
    if (item >= 0) return at(item + 3, "item");
    // "Nickname (Species": the species is what follows the parenthesis.
    return at(before.lastIndexOf("(") + 1, "species");
  }
  const prefix = before.match(/^(Ability:\s*|Tera Type:\s*|-\s*)/);
  if (prefix) {
    const field = prefix[1].startsWith("A")
      ? "ability"
      : prefix[1].startsWith("T")
        ? "tera"
        : "move";
    return at(prefix[1].length, field);
  }
  if (/^[EI]Vs:/.test(before)) {
    // "252 Sp": a stat name follows a number.
    const stat = before.match(/\d+\s+(\w*)$/);
    return stat ? at(before.length - stat[1].length, "stat") : null;
  }
  if (before.includes(":")) return null; // Level:, Happiness:… take free values
  return at(before.length - before.trimStart().length, "line");
}

export const STAT_NAMES = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"];
export const PASTE_KEYWORDS = ["Ability: ", "Tera Type: ", "EVs: ", "IVs: ", "- "];

// Prefix matches first, then matches inside the name ("Orb" finds "Life Orb"), alphabetically.
export function rankSuggestions(options: readonly string[], query: string, limit = 8): string[] {
  const q = norm(query);
  if (!q) return options.slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const o of options) {
    const n = norm(o);
    if (n === q) continue; // already typed in full
    if (n.startsWith(q)) starts.push(o);
    else if (n.includes(q)) contains.push(o);
  }
  return [...starts, ...contains].slice(0, limit);
}

// A draft written back in Showdown's format (the paste field's template).
export function toShowdown(species: string, draft: SetDraft): string {
  const stats = (values: Evs, skip: number) =>
    STATS.filter((s) => values[s] !== skip)
      .map((s) => `${values[s]} ${STAT_NAMES[STATS.indexOf(s)]}`)
      .join(" / ");
  const evs = stats(draft.evs, 0);
  const ivs = stats(draft.ivs, 31);
  return [
    draft.item ? `${species} @ ${draft.item}` : species,
    draft.ability && `Ability: ${draft.ability}`,
    draft.teraType && `Tera Type: ${draft.teraType}`,
    evs && `EVs: ${evs}`,
    `${draft.nature} Nature`,
    ivs && `IVs: ${ivs}`,
    ...draft.moves.filter(Boolean).map((m) => `- ${m}`),
  ]
    .filter(Boolean)
    .join("\n");
}

// What a competitive set still lacks, as i18n keys (empty when complete). Adventure teams don't
// track sets, so callers only use this in the Smogon and VGC modes.
export function missingParts(set: {
  item: string;
  moves: string[];
  nature?: string;
  evs?: Evs;
}): string[] {
  const missing: string[] = [];
  if (!set.item.trim()) missing.push("incomplete.item");
  if (set.moves.filter((m) => m.trim()).length < 4) missing.push("incomplete.moves");
  if (!set.evs || evTotal(set.evs) === 0) missing.push("incomplete.evs");
  if (!set.nature) missing.push("incomplete.nature");
  return missing;
}

// How common a set's choices are in the format: the mean usage share of its moves and item. Smogon only
// measures each choice, never a named set, so this is an estimate. A move or item outside the build's
// top options (the snapshot keeps the top 10 moves and 6 items) counts as 0.
export function coverage(
  draft: Pick<SetDraft, "moves" | "item">,
  build: Pick<Build, "moves" | "items">,
): { score: number; parts: { name: string; share: number }[] } {
  const parts = [
    ...draft.moves.filter(Boolean).map((name) => ({ name, share: build.moves[name] ?? 0 })),
    ...(draft.item ? [{ name: draft.item, share: build.items[draft.item] ?? 0 }] : []),
  ];
  const score = parts.length ? parts.reduce((sum, p) => sum + p.share, 0) / parts.length : 0;
  return { score, parts };
}
