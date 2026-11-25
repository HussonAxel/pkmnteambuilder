// A whole format's ladder data for the team page's Meta tab: usage per cutoff (with last month's, for
// trends), every species' checks and counters, and their most used spreads.
// Sources: scripts/build-smogon-usage.mjs (usage, meta), build-usage-history.mjs (cutoffs, last month),
// and build-vgc-usage.mjs for the gen 9 regulations (usage and spreads only, no counters).
import type { Counter } from "@/lib/meta-team";

interface UsageFile {
  usage: Record<string, number>;
}
interface MetaFile {
  species: Record<string, { counters: Counter[]; spreads: Record<string, number> }>;
}
export interface HistoryFile {
  month: string;
  cutoff: number; // the default (1695 in OU, 1630 elsewhere)
  cutoffs: Record<string, Record<string, number>>;
  previous?: { month: string; usage: Record<string, number> };
}

const usageFiles = import.meta.glob<UsageFile>("../data/smogon/*.usage.json", {
  import: "default",
});
const metaFiles = import.meta.glob<MetaFile>("../data/smogon/*.meta.json", { import: "default" });
const historyFiles = import.meta.glob<HistoryFile>("../data/usage-history/*.json", {
  import: "default",
});

export interface FormatMeta {
  usage: Record<string, number>; // default cutoff
  history?: HistoryFile;
  counters: Record<string, Counter[]>;
  spreads: Record<string, Record<string, number>>;
}

export async function loadFormatMeta(format: string): Promise<FormatMeta | null> {
  const smogon = usageFiles[`../data/smogon/${format}.usage.json`];
  if (smogon) {
    const [usage, meta, history] = await Promise.all([
      smogon(),
      metaFiles[`../data/smogon/${format}.meta.json`]?.(),
      historyFiles[`../data/usage-history/${format}.json`]?.(),
    ]);
    const species = meta?.species ?? {};
    return {
      usage: usage.usage,
      history,
      counters: Object.fromEntries(Object.entries(species).map(([n, s]) => [n, s.counters])),
      spreads: Object.fromEntries(Object.entries(species).map(([n, s]) => [n, s.spreads])),
    };
  }
  // Gen 9 regulations: retired, a fixed snapshot without checks and counters.
  const [{ VGC_USAGE }, { VGC_BUILDS }] = await Promise.all([
    import("@/data/vgc-usage"),
    import("@/data/vgc-builds"),
  ]);
  const usage = VGC_USAGE[format]?.usage;
  if (!usage) return null;
  const builds = VGC_BUILDS[format] ?? {};
  return {
    usage,
    counters: {},
    spreads: Object.fromEntries(Object.entries(builds).map(([n, b]) => [n, b.spreads])),
  };
}
