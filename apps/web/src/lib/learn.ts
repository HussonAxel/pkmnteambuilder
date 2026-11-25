// How a species learns a move in a generation, read from src/data/learn/gen<N>.json (scripts/build-learn.mjs).
// Pure: tested in learn.test.mjs.

export interface LearnData {
  moves: string[];
  species: [name: string, num: number, eggGroups: string][]; // egg groups joined by "/"
  // species -> "moveIndex:L20,M,E@Prevo;…". "@Prevo": that pre-evolution learns it, before evolving.
  learn: Record<string, string>;
  fathers: Record<string, number[]>; // egg move index -> species indices that learn it themselves
  carriers: Record<string, number[]>; // egg move index -> species indices that hatch with it
  tm: Record<string, string>; // move index -> TM item identifier ("tm036")
}

export type Method = (
  | { kind: "level"; level: number }
  | { kind: "evolution"; level?: number } // learned when it evolves (at that level, if any)
  | { kind: "tm"; item?: string }
  // fathers: learn it themselves and share an egg group. chain: when there are none, the shortest
  // breeding chain from one that learns it to one sharing an egg group (none: no breeding route).
  | { kind: "egg"; fathers: string[]; chain?: string[] }
  | { kind: "tutor" }
  | { kind: "event" }
) & { by?: string }; // the pre-evolution that learns it, when not this species

// null: the species can't learn this move in gen 9.
export function howToLearn(data: LearnData, species: string, move: string): Method[] | null {
  const index = data.moves.indexOf(move);
  if (index === -1) return null;
  const entry = data.learn[species]
    ?.split(";")
    .find((e) => e.slice(0, e.indexOf(":")) === String(index));
  if (!entry) return null;

  const groups = new Set(data.species.find(([name]) => name === species)?.[2].split("/"));
  const methods = entry
    .slice(entry.indexOf(":") + 1)
    .split(",")
    .map((token): Method => {
      const [code = "", by] = token.split("@");
      const method = ((): Method => {
        if (code[0] === "L") return { kind: "level", level: Number(code.slice(1)) };
        if (code[0] === "V")
          return { kind: "evolution", level: Number(code.slice(1)) || undefined };
        if (code === "M") return { kind: "tm", item: data.tm[index] };
        if (code === "T") return { kind: "tutor" };
        if (code === "S") return { kind: "event" };
        // Egg: fathers must share an egg group with the Pokémon being bred.
        const fathers = (data.fathers[index] ?? [])
          .map((i) => data.species[i]!)
          .filter(([name, , g]) => name !== species && g.split("/").some((x) => groups.has(x)))
          .map(([name]) => name);
        if (fathers.length) return { kind: "egg", fathers };
        return { kind: "egg", fathers, chain: breedingChain(data, index, groups) };
      })();
      return by ? { ...method, by } : method;
    });
  // Learned naturally (level, evolution, TM, tutor): breeding or events would only complicate things.
  const natural = methods.some((m) => m.kind !== "egg" && m.kind !== "event");
  return natural ? methods.filter((m) => m.kind !== "egg" && m.kind !== "event") : methods;
}

// Shortest chain passing an egg move on: it starts with a Pokémon that learns it itself, each next one
// shares an egg group with the previous and hatches with the move, and the last shares one with `groups`.
function breedingChain(data: LearnData, index: number, groups: Set<string>): string[] | undefined {
  const groupsOf = (i: number) => data.species[i]![2].split("/");
  const carriers = data.carriers[index] ?? [];
  const queue = (data.fathers[index] ?? []).map((i) => [i]);
  const seen = new Set(queue.flat());
  while (queue.length) {
    const path = queue.shift()!;
    const last = groupsOf(path.at(-1)!);
    for (const c of carriers) {
      if (seen.has(c) || !groupsOf(c).some((g) => last.includes(g))) continue;
      const next = [...path, c];
      if (groupsOf(c).some((g) => groups.has(g))) return next.map((i) => data.species[i]![0]);
      seen.add(c);
      queue.push(next);
    }
  }
  return undefined;
}
