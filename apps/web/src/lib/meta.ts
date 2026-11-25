// Ladder facts about one species in one format, for the set editor's "Meta" tab.
// Pure: tested in meta.test.mjs. Loading lives in meta-data.ts (Vite-only import.meta.glob).
import { type Build, type Evs, parseSpread, STATS, type Stat } from "./sets.ts";

export interface Counter {
  name: string;
  score: number; // Smogon's checks & counters score
  ko: number; // share of encounters the threat KOed this species
  switched: number; // share it forced this species out
}

export interface Meta {
  usage: number; // weighted usage share
  rank: number;
  battles?: number; // the format's battle count for the month (Smogon snapshots only)
  lead?: number;
  // [players, best GXE, 99th percentile GXE, 95th percentile GXE]
  viability?: [number, number, number, number];
  counters: Counter[];
  teammates: Record<string, number>;
  build?: Build;
  spreads: Record<string, number>;
}

// Options sorted by share, most used first.
export const ranked = (shares: Record<string, number> = {}) =>
  Object.entries(shares)
    .filter(([name]) => name && name.toLowerCase() !== "nothing")
    .sort((a, b) => b[1] - a[1]);

// Average EVs per stat across the listed spreads, weighted by their share.
export function statDistribution(spreads: Record<string, number>): Evs {
  const sum = Object.fromEntries(STATS.map((s) => [s, 0])) as Evs;
  let total = 0;
  for (const [spread, share] of Object.entries(spreads)) {
    const { evs } = parseSpread(spread);
    for (const s of STATS) sum[s] += evs[s] * share;
    total += share;
  }
  return Object.fromEntries(STATS.map((s) => [s, total ? Math.round(sum[s] / total) : 0])) as Evs;
}

export const ROLES = [
  "trickRoom",
  "fastPhysical",
  "fastSpecial",
  "bulkyPhysical",
  "bulkySpecial",
  "physicalWall",
  "specialWall",
  "fastBulky",
  "bulky",
  "other",
] as const;
export type Role = (typeof ROLES)[number];

// Natures that lower Speed: with 0 Speed EVs, the spread is built for Trick Room.
const SLOW_NATURES = new Set(["Brave", "Relaxed", "Quiet", "Sassy"]);
const invested = (evs: Evs, stat: Stat) => evs[stat] >= 180;

// What a spread is built for, from where its EVs went.
export function spreadRole(spread: string): Role {
  const { nature, evs } = parseSpread(spread);
  if (SLOW_NATURES.has(nature) && evs.spe === 0) return "trickRoom";
  if (invested(evs, "spe") && invested(evs, "atk")) return "fastPhysical";
  if (invested(evs, "spe") && invested(evs, "spa")) return "fastSpecial";
  if (invested(evs, "hp") && invested(evs, "atk")) return "bulkyPhysical";
  if (invested(evs, "hp") && invested(evs, "spa")) return "bulkySpecial";
  if (invested(evs, "hp") && invested(evs, "def")) return "physicalWall";
  if (invested(evs, "hp") && invested(evs, "spd")) return "specialWall";
  if (invested(evs, "hp") && invested(evs, "spe")) return "fastBulky";
  // HP plus split defenses (support spreads tuned to survive specific hits).
  if (invested(evs, "hp")) return "bulky";
  return "other";
}

// Share of each role among the listed spreads, normalised to 1, biggest first.
export function roleShares(spreads: Record<string, number>): [Role, number][] {
  const shares = new Map<Role, number>();
  let total = 0;
  for (const [spread, share] of Object.entries(spreads)) {
    const role = spreadRole(spread);
    shares.set(role, (shares.get(role) ?? 0) + share);
    total += share;
  }
  return [...shares]
    .map(([role, share]): [Role, number] => [role, total ? share / total : 0])
    .sort((a, b) => b[1] - a[1]);
}

// Options nearly everyone runs.
export const STAPLE = 0.9;
