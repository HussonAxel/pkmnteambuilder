// Loads a generation's learn data (scripts/build-learn.mjs): one chunk per generation, fetched only for
// teams of that generation. Kept apart from learn.ts, which node --test imports (no import.meta.glob there).
import { HIDDEN_POWER_TYPES, type LearnData } from "@/lib/learn";

const files = import.meta.glob<LearnData>("../data/learn/*.json", { import: "default" });

export async function loadLearnData(gen: number): Promise<LearnData> {
  const file = files[`../data/learn/gen${gen}.json`];
  if (!file) throw new Error(`No learn data for gen ${gen}`);
  return file();
}

// Every move a species can learn in that generation, pre-evolutions' included; Hidden Power also
// under each of its types ("Hidden Power Fire"), as Showdown sets write it.
export const learnableMoves = (data: LearnData, species: string): string[] =>
  data.learn[species]
    ?.split(";")
    .map((e) => data.moves[Number(e.slice(0, e.indexOf(":")))]!)
    .flatMap((move) =>
      move === "Hidden Power"
        ? [move, ...HIDDEN_POWER_TYPES.map((type) => `Hidden Power ${type}`)]
        : [move],
    ) ?? [];
