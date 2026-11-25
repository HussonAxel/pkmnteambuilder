// Type matchups for the team page's coverage tab, with the type chart of the team's generation (no Fairy
// before gen 6, Steel resisting Ghost and Dark up to gen 5). Pure: tested in type-chart.test.mjs.
// Abilities (Levitate, Flash Fire…) and Tera aren't counted: types only, as the brief's first step.

// @pkmn/dex's damageTaken codes: 0 neutral, 1 weak, 2 resists, 3 immune.
const MULTIPLIER = [1, 2, 0.5, 0] as const;

// chart[defending][attacking] = multiplier.
export type Chart = Record<string, Record<string, number>>;

export interface DexTypes {
  types: {
    all(): readonly {
      name: string;
      exists: boolean;
      isNonstandard?: string | null;
      damageTaken: Record<string, number>;
    }[];
  };
}

// The generation's playable types: not "???" (isNonstandard), and not Stellar, a Tera type only.
export function chartOf(dex: DexTypes): { types: string[]; chart: Chart } {
  const types = dex.types
    .all()
    .filter((t) => t.exists && !t.isNonstandard && t.name !== "Stellar")
    .map((t) => t.name)
    .sort();
  const chart: Chart = {};
  for (const t of dex.types.all()) {
    if (!types.includes(t.name)) continue;
    chart[t.name] = Object.fromEntries(
      types.map((atk) => [atk, MULTIPLIER[t.damageTaken[atk] ?? 0]]),
    );
  }
  return { types, chart };
}

// Damage taken by a Pokémon of these types from an attack of that type (×4, ×2, ×1, ×½, ×¼, ×0).
export const defense = (chart: Chart, types: readonly string[], attack: string) =>
  types.reduce((m, t) => m * (chart[t]?.[attack] ?? 1), 1);

// Best multiplier any of these attacking types deals to a single defending type.
export const offense = (chart: Chart, attacks: readonly string[], defending: string) =>
  attacks.length ? Math.max(...attacks.map((a) => chart[defending]?.[a] ?? 1)) : 0;

export interface Alert {
  kind: "uncovered" | "stacked" | "unresisted";
  type: string;
  weak?: number;
}

// The brief's alerts: a type nobody hits super effectively; 3+ members weak to the same type; or 2+ weak
// and nobody resisting it.
export function alerts(
  chart: Chart,
  types: readonly string[],
  members: { types: readonly string[]; attacks: readonly string[] }[],
): Alert[] {
  const out: Alert[] = [];
  for (const type of types) {
    const taken = members.map((m) => defense(chart, m.types, type));
    const weak = taken.filter((x) => x > 1).length;
    const resist = taken.filter((x) => x < 1).length;
    if (weak >= 3) out.push({ kind: "stacked", type, weak });
    else if (weak >= 2 && resist === 0) out.push({ kind: "unresisted", type, weak });
  }
  for (const type of types)
    if (members.length && !members.some((m) => offense(chart, m.attacks, type) > 1))
      out.push({ kind: "uncovered", type });
  return out;
}
