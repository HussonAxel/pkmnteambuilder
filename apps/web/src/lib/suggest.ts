// Adventure suggestions (note de cadrage, 2.4): the Pokémon available at the step that best fill the
// team's type gaps. score = 2 × types newly hit super effectively + 3 × weaknesses fixed
// − 3 × weaknesses added, by types only (a Pokémon's own types are its attack types).
// Pure: tested in suggest.test.mjs.
import { type Chart, defense, offense } from "./type-chart.ts";

export interface CoverageSuggestion<T> {
  candidate: T;
  score: number;
  covers: string[]; // types nobody hit super effectively, that it does
  fixes: string[]; // the team's shared weaknesses it resists
  adds: string[]; // shared weaknesses it adds to
}

export function coverageSuggestions<T extends { types: readonly string[] }>(
  chart: Chart,
  types: readonly string[],
  team: readonly { types: readonly string[] }[],
  candidates: readonly T[],
  limit = 3,
): CoverageSuggestion<T>[] {
  const hitByTeam = new Set(types.filter((t) => team.some((m) => offense(chart, m.types, t) > 1)));
  // Shared weaknesses: 2+ members weak and nobody resisting (the coverage tab's alert).
  const shared = types.filter((t) => {
    const taken = team.map((m) => defense(chart, m.types, t));
    return taken.filter((x) => x > 1).length >= 2 && !taken.some((x) => x < 1);
  });
  return candidates
    .map((candidate) => {
      const covers = types.filter(
        (t) => !hitByTeam.has(t) && offense(chart, candidate.types, t) > 1,
      );
      const fixes = shared.filter((t) => defense(chart, candidate.types, t) < 1);
      const adds = shared.filter((t) => defense(chart, candidate.types, t) > 1);
      return {
        candidate,
        score: 2 * covers.length + 3 * fixes.length - 3 * adds.length,
        covers,
        fixes,
        adds,
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
