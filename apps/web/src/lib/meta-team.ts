// The team against its format's metagame, from Smogon's stats: who threatens it (checks and counters),
// how it fares against the most used Pokémon (types), who outspeeds it, and usage trends.
// Pure: tested in meta-team.test.mjs.
import { type Chart, defense } from "./type-chart.ts";

// Smogon's "Checks and Counters" for a species: [opponent, score, KO %, switch-out %].
export type Counter = [name: string, score: number, ko: number, switched: number];

export interface Threat {
  name: string;
  usage: number;
  members: string[]; // team members it checks or counters
  ko: number; // mean share of those matchups that end with the member KOed
  switched: number; // … or forced out
}

// Pokémon that check or counter several members: they appear in those members' counters lists.
// Most members first, then most used.
export function teamThreats(
  members: readonly string[],
  counters: Record<string, readonly Counter[] | undefined>,
  usage: Record<string, number>,
  limit = 8,
): Threat[] {
  const byOpponent = new Map<string, { members: string[]; ko: number[]; switched: number[] }>();
  for (const member of members) {
    for (const [name, , ko, switched] of counters[member] ?? []) {
      if (members.includes(name)) continue;
      const entry = byOpponent.get(name) ?? { members: [], ko: [], switched: [] };
      entry.members.push(member);
      entry.ko.push(ko);
      entry.switched.push(switched);
      byOpponent.set(name, entry);
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return [...byOpponent]
    .map(([name, e]) => ({
      name,
      usage: usage[name] ?? 0,
      members: e.members,
      ko: mean(e.ko),
      switched: mean(e.switched),
    }))
    .sort((a, b) => b.members.length - a.members.length || b.usage - a.usage)
    .slice(0, limit);
}

export interface Matchup {
  hitters: number; // members with a super effective attack on it
  best: number; // best multiplier the team deals it (its two types multiplied)
  threatened: number; // members weak to one of its own types (its likely STAB)
}

// How the team fares against one opposing Pokémon, by types: the team's attack types against both its
// types, and its own types (as STAB) against each member.
export function matchup(
  chart: Chart,
  members: readonly { types: readonly string[]; attacks: readonly string[] }[],
  opponentTypes: readonly string[],
): Matchup {
  const dealt = members.map((m) =>
    m.attacks.length ? Math.max(...m.attacks.map((a) => defense(chart, opponentTypes, a))) : 0,
  );
  return {
    hitters: dealt.filter((x) => x > 1).length,
    best: Math.max(0, ...dealt),
    threatened: members.filter((m) => opponentTypes.some((t) => defense(chart, m.types, t) > 1))
      .length,
  };
}

// Month-over-month change of a usage share (+0.012 = 1.2 points up); undefined without last month.
export const trend = (now: number | undefined, before: number | undefined) =>
  before === undefined || now === undefined ? undefined : now - before;

// Trick Room pays off when most of the meta's threats outspeed most of the team: the team's median
// speed is under most threats' speeds.
export function trickRoomHint(teamSpeeds: readonly number[], threatSpeeds: readonly number[]) {
  if (!teamSpeeds.length || !threatSpeeds.length) return false;
  const sorted = [...teamSpeeds].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return threatSpeeds.filter((s) => s > median).length / threatSpeeds.length > 0.6;
}
