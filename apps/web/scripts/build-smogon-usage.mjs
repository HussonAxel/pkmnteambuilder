// Snapshots Smogon ladder stats for every competitive format the app offers (src/data/formats,
// gens 4-9), from pkmn's CORS mirror of the latest month. The browser used to download the full
// file (gen9ou: ~3 MB) just to sort by usage. Gen 9 VGC regulations come from build-vgc-usage.mjs.
// Per format id (gen9ou, gen6ou, gen8vgc2022…) this writes:
//   src/data/smogon/<id>.usage.json   usage % of every species + top teammates (sorting, suggestions)
//   src/data/smogon/<tier>.builds.json  most used options per species (set editor "most used")
//   src/data/smogon/<tier>.meta.json    per-species ladder facts for the editor's "Meta" tab: rank,
//                                       battles, lead %, viability ceiling, checks & counters, spreads
// Regenerate monthly: node apps/web/scripts/build-smogon-usage.mjs
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { FORMATS } from "../src/data/formats/index.ts";

const IDS = FORMATS.filter((f) => !(f.mode === "vgc" && f.gen === 9)).map((f) => f.id);
const OUT = new URL("../src/data/smogon/", import.meta.url);
// Same trims as the VGC snapshot (build-vgc-usage.mjs).
const MIN_TEAMMATE_USAGE = 0.001;
const TOP_TEAMMATES = 10;
const MIN_BUILD_USAGE = 0.005;
const TOP_OPTIONS = 6;
const TOP_SPREADS = 15;
const TOP_COUNTERS = 10;
const round = (n) => Math.round(n * 10000) / 10000;
// Smogon's checks & counters score (as in its moveset files): the share of encounters the threat
// KOed or forced out, minus 4 standard deviations so rare matchups don't rank high.
// Each entry is [encounters, KOed share, switched-out share].
function counters(entries = {}) {
  return Object.entries(entries)
    .map(([name, [n, ko, sw]]) => {
      const p = ko + sw;
      return { name, n, ko, sw, score: p - 4 * Math.sqrt((p * (1 - p)) / n) };
    })
    // Small tiers see few encounters per pair: 10 keeps the list meaningful without emptying it.
    .filter((c) => c.n >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_COUNTERS)
    .map((c) => [c.name, round(c.score), round(c.ko), round(c.sw)]);
}
const top = (shares = {}, n = TOP_OPTIONS) =>
  Object.fromEntries(
    Object.entries(shares)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => [k, round(v)]),
  );

mkdirSync(OUT, { recursive: true });
for (const tier of IDS) {
  const res = await fetch(`https://data.pkmn.cc/stats/${tier}.json`);
  // A few old formats have no published stats (gen4zu, gen6zu…): the app just shows no usage.
  if (!res.ok) {
    console.warn(`${tier}: HTTP ${res.status}, skipped`);
    continue;
  }
  const { pokemon, battles } = await res.json();
  const entries = Object.entries(pokemon);
  const usage = Object.fromEntries(entries.map(([name, p]) => [name, round(p.usage.weighted)]));
  const teammates = Object.fromEntries(
    entries
      .filter(([, p]) => p.usage.weighted >= MIN_TEAMMATE_USAGE)
      .map(([name, p]) => [name, top(p.teammates, TOP_TEAMMATES)]),
  );
  const builds = Object.fromEntries(
    entries
      .filter(([, p]) => p.usage.weighted >= MIN_BUILD_USAGE)
      .map(([name, p]) => [
        name,
        {
          abilities: top(p.abilities),
          items: top(p.items),
          moves: top(p.moves, 10),
          teraTypes: top(p.teraTypes),
          spreads: top(p.spreads),
        },
      ]),
  );
  const ranked = entries
    .map(([name, p]) => [name, p.usage.weighted])
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  const meta = {
    battles: Number(battles),
    species: Object.fromEntries(
      entries
        .filter(([, p]) => p.usage.weighted >= MIN_BUILD_USAGE)
        .map(([name, p]) => [
          name,
          {
            rank: ranked.indexOf(name) + 1,
            lead: round(p.lead?.weighted ?? 0),
            // [players, best GXE, 99th percentile GXE, 95th percentile GXE]
            viability: p.viability,
            counters: counters(p.counters),
            spreads: top(p.spreads, TOP_SPREADS),
          },
        ]),
    ),
  };
  // Spot check: a staple of every tier has its numbers.
  const first = meta.species[ranked[0]];
  assert.ok(first.rank === 1 && first.viability.length === 4, tier);
  assert.ok(entries.length > 50, `${tier}: only ${entries.length} species`);
  const key = tier;
  writeFileSync(new URL(`${key}.usage.json`, OUT), JSON.stringify({ usage, teammates }));
  writeFileSync(new URL(`${key}.builds.json`, OUT), JSON.stringify(builds));
  writeFileSync(new URL(`${key}.meta.json`, OUT), JSON.stringify(meta));
  console.log(`${tier}: ${entries.length} species, ${Object.keys(builds).length} builds`);
}
