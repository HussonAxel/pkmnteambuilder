// Where to get items and TMs, per generation (scripts/build-item-sources.mjs, build-tm-sources.mjs,
// from Bulbapedia): one small file each per generation, loaded on demand.
import type { TmSource } from "@/lib/shopping";

export interface ItemSource {
  games: string; // "SV", "SV · ID" (DLC)
  found?: string;
  other?: string; // shop, prize, Pickup…
}

const itemFiles = import.meta.glob<{ items: Record<string, ItemSource[]> }>(
  "../data/item-sources/*.json",
  { import: "default" },
);
const tmFiles = import.meta.glob<{ moves: Record<string, TmSource> }>("../data/tm-sources/*.json", {
  import: "default",
});

export const itemSourcesQuery = (gen: number) => ({
  queryKey: ["item-sources", gen],
  queryFn: async () => (await itemFiles[`../data/item-sources/gen${gen}.json`]?.())?.items ?? {},
  staleTime: Number.POSITIVE_INFINITY,
});

export const tmSourcesQuery = (gen: number) => ({
  queryKey: ["tm-sources", gen],
  queryFn: async () => (await tmFiles[`../data/tm-sources/gen${gen}.json`]?.())?.moves ?? {},
  staleTime: Number.POSITIVE_INFINITY,
});
