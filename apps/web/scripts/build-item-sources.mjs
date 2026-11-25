// Where to get each held item, per generation (4 to 9), from Bulbapedia's item pages (CC BY-NC-SA 2.5:
// attribution kept in the output). PokeAPI has no item locations. The team page's "How to get" tab shows
// the rows of the team's generation.
// Regenerate: node apps/web/scripts/build-item-sources.mjs (pages are cached in .cache/bulbapedia/items/)
// Out: src/data/item-sources/gen<N>.json  { "<item>": [{ games, found?, other? }] }
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { Dex } from "@pkmn/dex";
import { eachLimited, gamesOf, OTHER_GAMES, plain, wikitext } from "./lib/bulbapedia.mjs";

const GENS = [4, 5, 6, 7, 8, 9];
const OUT = new URL("../src/data/item-sources/", import.meta.url);

// The Acquisition table: rows of "| {{gameabbrevN|SV}}{{gameabbrevN|ID}}", "| found", "| other".
function acquisition(text) {
  const start = text.search(/==\s*Acquisition\s*==/);
  if (start === -1) return [];
  const section = text.slice(start, text.indexOf("\n|}", start) + 1 || undefined);
  const rows = [];
  for (const row of section.split(/\n\|-/).slice(1)) {
    const cells = row
      .split(/\n\|(?!\})/)
      .slice(1)
      .map((c) => c.trim());
    const where = gamesOf(cells[0] ?? "");
    if (!where) continue; // side games (gameabbrevss) and others
    const found = plain(cells[1] ?? "");
    const other = plain(cells[2] ?? "");
    if (!found && !other) continue;
    rows.push({ ...where, found, other });
  }
  return rows;
}

const items = new Set();
for (const gen of GENS)
  for (const item of Dex.forGen(gen).items.all())
    if (item.exists && !item.isNonstandard) items.add(item.name);

const byGen = Object.fromEntries(GENS.map((g) => [g, {}]));
const names = [...items];
let missing = 0;
await eachLimited(names, 4, async (name) => {
  // Some pages are disambiguated: "Metronome (item)", "Protector (item)".
  let rows = acquisition((await wikitext(name, "items")) ?? "");
  if (!rows.length) rows = acquisition((await wikitext(`${name} (item)`, "items")) ?? "");
  if (!rows.length) missing++;
  for (const { gen, ...row } of rows) {
    if (!byGen[gen] || OTHER_GAMES[gen]?.test(row.games)) continue;
    const entry = Object.fromEntries(Object.entries(row).filter(([, v]) => v));
    (byGen[gen][name] ??= []).push(entry);
  }
});

mkdirSync(OUT, { recursive: true });
for (const gen of GENS) {
  writeFileSync(
    new URL(`gen${gen}.json`, OUT),
    JSON.stringify({
      source: "Bulbapedia (CC BY-NC-SA 2.5), item pages' Acquisition tables",
      items: byGen[gen],
    }),
  );
  console.log(`gen ${gen}: ${Object.keys(byGen[gen]).length} items`);
}
console.log(`${names.length} items looked up, ${missing} without an acquisition table`);
assert.match(JSON.stringify(byGen[9]["Choice Specs"]), /Delibird Presents/);
assert.match(JSON.stringify(byGen[8]["Safety Goggles"]), /Route 7/);
