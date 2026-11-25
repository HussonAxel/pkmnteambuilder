// Where to get items and TMs, per generation (scripts/build-item-sources.mjs, build-tm-sources.mjs,
// from Bulbapedia): one small file each per generation, loaded on demand.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { MessageKey } from "@/i18n/messages";
import { type Lang, useI18n } from "@/lib/i18n";
import type { TmSource } from "@/lib/shopping";

export interface ItemSource {
  games: string; // "SV", "SV · ID" (DLC)
  found?: string;
  other?: string; // shop, prize, Pickup…
}

// Bulbapedia's game initials in French ("SwSh" -> "ÉB"); a DLC ("SV · ID") is named in full.
const FRENCH_GAMES: Record<string, string> = {
  SV: "ÉV",
  S: "É",
  V: "V",
  SwSh: "ÉB",
  Sw: "É",
  Sh: "B",
  SMUSUM: "SL/USUL",
  SM: "SL",
  USUM: "USUL",
  ORAS: "ROSA",
  OR: "RO",
  AS: "SA",
  XYORAS: "XY/ROSA",
  BW: "NB",
  B: "N",
  W: "B",
  B2W2: "N2B2",
  B2: "N2",
  W2: "B2",
  BWB2W2: "NB/N2B2",
  DPPt: "DPPt",
  DP: "DP",
  HGSS: "HGSS",
};
const DLCS = { IA: "dlc.ia", CT: "dlc.ct", TM: "dlc.tm", ID: "dlc.id" } as const;

export function gameLabel(
  lang: Lang,
  t: (key: MessageKey) => string,
  games: string,
): { games: string; dlc?: string } {
  const [base = games, dlc] = games.split(" · ");
  return {
    games: lang === "fr" ? (FRENCH_GAMES[base] ?? base) : base,
    dlc: dlc && dlc in DLCS ? t(DLCS[dlc as keyof typeof DLCS]) : dlc,
  };
}

// Bulbapedia's texts are English: in French, the place names PokeAPI knows are swapped for theirs
// (scripts/build-descriptions.mjs), and "Only in The Teal Mask" names the DLC. The rest stays English.
const DLC_NAMES: Record<string, (typeof DLCS)[keyof typeof DLCS]> = {
  "The Isle of Armor": "dlc.ia",
  "The Crown Tundra": "dlc.ct",
  "The Teal Mask": "dlc.tm",
  "The Indigo Disk": "dlc.id",
};
export function usePlaceNames() {
  const { lang, t } = useI18n();
  const { data } = useQuery({
    queryKey: ["place-names", lang],
    queryFn: async () =>
      lang === "fr"
        ? ((await import("@/data/places/fr.json")).default as Record<string, string>)
        : {},
    staleTime: Number.POSITIVE_INFINITY,
  });
  return useMemo(() => {
    const names = Object.keys(data ?? {}).sort((a, b) => b.length - a.length);
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = names.length
      ? new RegExp(`(?<![\\p{L}])(${names.map(escape).join("|")})(?![\\p{L}])`, "gu")
      : undefined;
    return {
      place: (text: string) => {
        const plain = text.replaceAll("’", "'");
        const named = pattern ? plain.replace(pattern, (name) => data![name] ?? name) : plain;
        return named.replace(/Only in (.+?):/g, (_, dlc: string) =>
          t("dlc.only", { dlc: dlc in DLC_NAMES ? t(DLC_NAMES[dlc]!) : dlc }),
        );
      },
      dlc: (name: string) => (name in DLC_NAMES ? t(DLC_NAMES[name]!) : name),
    };
  }, [data, t]);
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
