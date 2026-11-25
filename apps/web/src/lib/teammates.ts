// Teammate suggestions from Smogon usage stats. Pure: tested in teammates.test.mjs.
// Shares are fractions (0.25 = 25%), keyed by @pkmn/dex species name.
export interface UsageStats {
  usage: Record<string, number>;
  // teammates[A][B]: share of teams with A that also run B.
  teammates: Record<string, Record<string, number>>;
}

export interface Suggestion {
  name: string;
  share: number; // what the UI shows as "X%"
}

// Every species often paired with `team`, best first. Members are never suggested.
export function suggestTeammates(
  teammates: UsageStats["teammates"],
  team: readonly string[],
): Suggestion[] {
  // Members without stats (rare picks) give no signal, so they are left out of the scoring.
  const known = team.filter((name) => teammates[name]);
  if (known.length === 0) return [];

  // Average share across members, so it stays a readable %. A candidate missing from a member's
  // list counts as 0 there (VGC snapshots keep only each species' top teammates).
  const totals = new Map<string, number>();
  for (const member of known)
    for (const [name, share] of Object.entries(teammates[member]!))
      if (!team.includes(name)) totals.set(name, (totals.get(name) ?? 0) + share);
  return [...totals]
    .map(([name, total]) => ({ name, share: total / known.length }))
    .sort((a, b) => b.share - a.share);
}
