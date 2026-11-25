// Usage per ladder cutoff (all players, 1500, 1630/1695, 1760/1825) for the latest month, plus the
// previous month at the default cutoff for trends. From Smogon's monthly text tables (smogon.com/stats),
// which publish every cutoff; the main snapshots (build-smogon-usage.mjs) keep one.
// Regenerate monthly: node apps/web/scripts/build-usage-history.mjs (downloads cached in .cache/smogon-stats/)
// Out: src/data/usage-history/<formatId>.json
//   { month, cutoff, cutoffs: { "<cutoff>": { species: share } }, previous?: { month, usage } }
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { FORMATS } from "../src/data/formats/index.ts";
import { eachLimited } from "./lib/bulbapedia.mjs";

const STATS = "https://www.smogon.com/stats/";
const OUT = new URL("../src/data/usage-history/", import.meta.url);
const CACHE = new URL("../.cache/smogon-stats/", import.meta.url);
// Species under 0.05% are dropped (read as 0): they don't move a list sorted by usage.
const MIN_SHARE = 0.0005;

async function text(path) {
  const file = new URL(path.replaceAll("/", "_") || "index.html", CACHE);
  if (existsSync(file)) return readFileSync(file, "utf8");
  const res = await fetch(STATS + path);
  if (!res.ok) return null;
  const body = await res.text();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, body);
  return body;
}

// " | 1    | Great Tusk         | 32.81685% | ..." -> { "Great Tusk": 0.3282 }
function usageTable(body) {
  const out = {};
  for (const [, name, pct] of body.matchAll(/^\s*\|\s*\d+\s*\|\s*(.+?)\s*\|\s*([\d.]+)%/gm)) {
    const share = Math.round(Number(pct) * 100) / 1e4;
    if (share >= MIN_SHARE) out[name] = share;
  }
  return out;
}

// Smogon's months, newest first. Little-played formats aren't published every month: each format takes
// its latest month that has it, and the month before that for the trend (up to 24 months back).
const months = [...(await text("")).matchAll(/href="(\d{4}-\d{2})\/"/g)]
  .map((m) => m[1])
  .sort()
  .reverse()
  .slice(0, 24);
const listing = (month) => text(`${month}/`).then((body) => body ?? "");
const cutoffsOf = (files, id) =>
  [...files.matchAll(new RegExp(`>${id}-(\\d+)\\.txt<`, "g"))]
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);

// Gen 9 regulations are retired: their usage is a fixed snapshot (build-vgc-usage.mjs), no history.
const ids = FORMATS.filter((f) => !(f.mode === "vgc" && f.gen === 9)).map((f) => f.id);
mkdirSync(OUT, { recursive: true });
let written = 0;
await eachLimited(ids, 4, async (id) => {
  const found = [];
  for (const month of months) {
    const cutoffs = cutoffsOf(await listing(month), id);
    if (cutoffs.length) found.push({ month, cutoffs });
    if (found.length === 2) break;
  }
  const [latest, previous] = found;
  if (!latest) return console.log(`${id}: no stats in the last ${months.length} months, skipped`);
  // The default is the second-highest cutoff (1695 in OU, 1630 elsewhere), as data.pkmn.cc's "weighted".
  const cutoff = latest.cutoffs.length > 1 ? latest.cutoffs.at(-2) : latest.cutoffs[0];
  const tables = {};
  for (const c of latest.cutoffs)
    tables[c] = usageTable((await text(`${latest.month}/${id}-${c}.txt`)) ?? "");
  const out = { month: latest.month, cutoff, cutoffs: tables };
  if (previous?.cutoffs.includes(cutoff)) {
    const usage = usageTable((await text(`${previous.month}/${id}-${cutoff}.txt`)) ?? "");
    if (Object.keys(usage).length) out.previous = { month: previous.month, usage };
  }
  writeFileSync(new URL(`${id}.json`, OUT), JSON.stringify(out));
  written++;
});
console.log(`${written} formats`);

const ou = JSON.parse(readFileSync(new URL("gen9ou.json", OUT), "utf8"));
assert.deepEqual(Object.keys(ou.cutoffs), ["0", "1500", "1695", "1825"]);
assert.equal(ou.cutoff, 1695);
assert.ok(ou.cutoffs[1695]["Great Tusk"] > 0.1);
