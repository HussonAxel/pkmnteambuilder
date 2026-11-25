// "One starter per playthrough" (note de cadrage, 2.1): once a starter's family is on the team, the other
// starters' families can't be obtained. Pure: tested in starters.test.mjs.
import type { GameData } from "./availability.ts";

// The first stage of a Pokémon's family in this game, following evolution sources ("from", not breeding).
export function familyRoot(game: Pick<GameData, "pokemon">, id: number): number {
  const byId = new Map(game.pokemon.map((p) => [p.id, p]));
  let current = id;
  for (let guard = 0; guard < 4; guard++) {
    const parent = byId.get(current)?.sources.find((s) => s.from && s.m !== "breed")?.from;
    if (!parent || parent === current) break;
    current = parent;
  }
  return current;
}

// Pokémon ids the player can no longer pick: every member of the other starters' families, once one
// starter family is owned (party or Box). Empty while no starter is owned.
export function blockedStarters(
  game: Pick<GameData, "pokemon" | "starters">,
  owned: readonly number[],
): Set<number> {
  const starters = new Set(game.starters);
  const ownedRoots = new Set(
    owned.map((id) => familyRoot(game, id)).filter((r) => starters.has(r)),
  );
  if (ownedRoots.size === 0) return new Set();
  return new Set(
    game.pokemon
      .map((p) => p.id)
      .filter((id) => {
        const root = familyRoot(game, id);
        return starters.has(root) && !ownedRoots.has(root);
      }),
  );
}
