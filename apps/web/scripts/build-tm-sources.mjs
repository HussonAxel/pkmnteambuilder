// Where to get each TM / TR, per generation (4 to 9), from Bulbapedia's TM pages (CC BY-NC-SA 2.5).
// Keyed by the move it teaches in that generation's competitive game: a TM number can teach another
// move in a sibling game (TM99: Breaking Swipe in Sword/Shield, Waterfall in BDSP), so rows are kept only
// when the table's move matches. In Scarlet/Violet, "craft" is the TM Machine recipe (LP and materials).
// Regenerate: node apps/web/scripts/build-tm-sources.mjs (after build-learn.mjs; pages are cached)
// Out: src/data/tm-sources/gen<N>.json  { "<move>": { tm, rows: [{ games, found?, craft?, price? }] } }
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { toID } from "@pkmn/dex";
import { calls, eachLimited, gamesOf, OTHER_GAMES, plain, wikitext } from "./lib/bulbapedia.mjs";

const GENS = [4, 5, 6, 7, 8, 9];
const OUT = new URL("../src/data/tm-sources/", import.meta.url);
const learn = (gen) =>
  JSON.parse(readFileSync(new URL(`../src/data/learn/gen${gen}.json`, import.meta.url), "utf8"));

// Every TM / TR page a generation needs ("tm99" -> "TM99", redirected to "TM099" by Bulbapedia).
const pages = new Set();
for (const gen of GENS)
  for (const item of Object.values(learn(gen).tm)) pages.add(item.toUpperCase());

// page -> [{ move, gen, games, found, craft, price }]: each row under the table header naming its move.
const rowsByPage = new Map();
await eachLimited([...pages], 4, async (page) => {
  const text = (await wikitext(page, "tms")) ?? "";
  const headers = calls(text, "TMtable/header").map((h) => ({
    index: h.index,
    move: plain(h.params[0]),
  }));
  const rows = [];
  for (const { index, params } of calls(text, "TMtable/row")) {
    const where = gamesOf(params[0] ?? "");
    if (!where || OTHER_GAMES[where.gen]?.test(where.games)) continue;
    const move = headers.filter((h) => h.index < index).at(-1)?.move;
    const row = {
      move,
      gen: where.gen,
      games: where.games,
      found: plain(params[1] ?? ""),
      craft: plain(params[2] ?? ""),
      price: plain(params[3] ?? ""),
    };
    rows.push(row);
  }
  rowsByPage.set(page, rows);
});

mkdirSync(OUT, { recursive: true });
for (const gen of GENS) {
  const { moves, tm } = learn(gen);
  const out = {};
  let unmatched = 0;
  for (const [index, item] of Object.entries(tm)) {
    const move = moves[Number(index)];
    const rows = (rowsByPage.get(item.toUpperCase()) ?? [])
      // Compared as ids: older tables keep old spellings ("SolarBeam" for Solar Beam).
      .filter((r) => r.gen === gen && toID(r.move ?? "") === toID(move))
      .map(({ move: _m, gen: _g, ...r }) =>
        Object.fromEntries(Object.entries(r).filter(([, v]) => v)),
      );
    if (rows.length) out[move] = { tm: item, rows };
    else unmatched++;
  }
  writeFileSync(
    new URL(`gen${gen}.json`, OUT),
    JSON.stringify({ source: "Bulbapedia (CC BY-NC-SA 2.5), TM pages", moves: out }),
  );
  console.log(
    `gen ${gen}: ${Object.keys(out).length} TMs located, ${unmatched} without a matching row`,
  );
}

const sv = JSON.parse(readFileSync(new URL("gen9.json", OUT), "utf8")).moves;
assert.match(JSON.stringify(sv["Iron Head"]), /TM Machine/);
assert.match(JSON.stringify(sv["Iron Head"]), /Cufant Tarnish/);
