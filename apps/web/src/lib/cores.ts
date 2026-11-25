// What a format's ladder plays most together, for the Meta page: duo cores, likely trios and the month's
// risers and fallers. From Smogon's usage stats only: they count teams, not wins.
// Pure: tested in cores.test.mjs.
import type { UsageStats } from "./teammates.ts";

export interface Core {
  members: string[];
  share: number; // share of teams running all of them (trios: an estimate)
}

const pairKey = (names: readonly string[]) => [...names].sort().join("\u0000");

// Duos most often on the same team. teammates[A][B] is the share of A's teams that also run B, so
// usage(A) × teammates[A][B] is the share of all teams with both. Both directions give the same number,
// but each species only keeps its top teammates: the larger side is the one that wasn't cut.
export function topDuos(stats: UsageStats, limit = 12): Core[] {
  const pairs = new Map<string, Core>();
  for (const [a, partners] of Object.entries(stats.teammates)) {
    const usageA = stats.usage[a] ?? 0;
    for (const [b, given] of Object.entries(partners)) {
      if (a === b) continue;
      const share = usageA * given;
      const key = pairKey([a, b]);
      const seen = pairs.get(key);
      if (!seen || seen.share < share) pairs.set(key, { members: [a, b], share });
    }
  }
  return [...pairs.values()]
    .map((core) => ({
      ...core,
      // Most used first, so a core reads "Great Tusk + Gholdengo" whichever side listed it.
      members: [...core.members].sort((x, y) => (stats.usage[y] ?? 0) - (stats.usage[x] ?? 0)),
    }))
    .sort((x, y) => y.share - x.share)
    .slice(0, limit);
}

// Trios built on the top duos. Smogon only publishes pairs, so a trio's share is an estimate: the duo's
// share times how often the third runs with both (geometric mean of its two teammate shares). A third
// missing from either list (rarely paired) isn't proposed.
export function likelyTrios(stats: UsageStats, limit = 8, fromDuos = 20): Core[] {
  const trios = new Map<string, Core>();
  for (const { members, share } of topDuos(stats, fromDuos)) {
    const [a, b] = members as [string, string];
    const withA = stats.teammates[a] ?? {};
    const withB = stats.teammates[b] ?? {};
    for (const [c, shareA] of Object.entries(withA)) {
      const shareB = withB[c];
      if (c === a || c === b || shareB === undefined) continue;
      const estimate = share * Math.sqrt(shareA * shareB);
      const key = pairKey([a, b, c]);
      const seen = trios.get(key);
      if (!seen || seen.share < estimate) trios.set(key, { members: [a, b, c], share: estimate });
    }
  }
  return [...trios.values()]
    .map((core) => ({
      ...core,
      members: [...core.members].sort((x, y) => (stats.usage[y] ?? 0) - (stats.usage[x] ?? 0)),
    }))
    .sort((x, y) => y.share - x.share)
    .slice(0, limit);
}

export interface Mover {
  name: string;
  usage: number;
  change: number; // in share (0.012 = +1.2 points)
}

// Biggest month-over-month changes among species that matter (at least `floor` usage either month).
// A species missing from a month was under the snapshot's 0.05% threshold: read as 0.
export function movers(
  now: Record<string, number>,
  before: Record<string, number>,
  limit = 5,
  floor = 0.01,
): { rising: Mover[]; falling: Mover[] } {
  const all = [...new Set([...Object.keys(now), ...Object.keys(before)])]
    .map((name) => ({
      name,
      usage: now[name] ?? 0,
      change: (now[name] ?? 0) - (before[name] ?? 0),
    }))
    .filter((m) => m.usage >= floor || (before[m.name] ?? 0) >= floor);
  return {
    rising: all
      .filter((m) => m.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, limit),
    falling: all
      .filter((m) => m.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, limit),
  };
}
