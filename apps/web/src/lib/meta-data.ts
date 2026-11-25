// Loads a species' ladder facts from the build-time snapshots (scripts/build-smogon-usage.mjs for every
// format id but the gen 9 VGC regulations, which come from build-vgc-usage.mjs).
import type { Meta } from "./meta";
import type { Build } from "./sets";

interface SmogonMetaFile {
  battles: number;
  species: Record<
    string,
    {
      rank: number;
      lead: number;
      viability: [number, number, number, number];
      counters: [string, number, number, number][];
      spreads: Record<string, number>;
    }
  >;
}
interface UsageFile {
  usage: Record<string, number>;
  teammates: Record<string, Record<string, number>>;
}

const usageFiles = import.meta.glob<UsageFile>("../data/smogon/*.usage.json", {
  import: "default",
});
const buildFiles = import.meta.glob<Record<string, Build>>("../data/smogon/*.builds.json", {
  import: "default",
});
const metaFiles = import.meta.glob<SmogonMetaFile>("../data/smogon/*.meta.json", {
  import: "default",
});

const rankOf = (usage: Record<string, number>, species: string) =>
  Object.values(usage).filter((share) => share > (usage[species] ?? 0)).length + 1;

// null when the format has no stats, or the species too little usage to have any.
export async function loadMeta(format: string, species: string): Promise<Meta | null> {
  const path = (kind: string) => `../data/smogon/${format}.${kind}.json`;
  if (usageFiles[path("usage")]) {
    const [usage, builds, meta] = await Promise.all([
      usageFiles[path("usage")]!(),
      buildFiles[path("builds")]?.() ?? {},
      metaFiles[path("meta")]?.(),
    ]);
    if (!(species in usage.usage)) return null;
    const own = meta?.species[species];
    return {
      usage: usage.usage[species]!,
      rank: own?.rank ?? rankOf(usage.usage, species),
      battles: meta?.battles,
      lead: own?.lead,
      viability: own?.viability,
      counters: (own?.counters ?? []).map(([name, score, ko, switched]) => ({
        name,
        score,
        ko,
        switched,
      })),
      teammates: usage.teammates[species] ?? {},
      build: builds[species],
      spreads: own?.spreads ?? builds[species]?.spreads ?? {},
    };
  }
  // Gen 9 VGC regulations: snapshot of Smogon's moveset files (no counters or viability there).
  const [{ VGC_USAGE }, { VGC_BUILDS }] = await Promise.all([
    import("@/data/vgc-usage"),
    import("@/data/vgc-builds"),
  ]);
  const stats = VGC_USAGE[format];
  if (!stats || !(species in stats.usage)) return null;
  const build = VGC_BUILDS[format]?.[species];
  return {
    usage: stats.usage[species]!,
    rank: rankOf(stats.usage, species),
    counters: [],
    teammates: stats.teammates[species] ?? {},
    build,
    spreads: build?.spreads ?? {},
  };
}
