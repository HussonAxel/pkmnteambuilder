// Run: node --test apps/web/src/lib/meta-team.test.mjs (Node strips the .ts types natively).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Dex } from "@pkmn/dex";
import { matchup, teamThreats, trend, trickRoomHint } from "./meta-team.ts";
import { chartOf } from "./type-chart.ts";

const meta = JSON.parse(
  readFileSync(new URL("../data/smogon/gen9ou.meta.json", import.meta.url), "utf8"),
);
const usage = JSON.parse(
  readFileSync(new URL("../data/smogon/gen9ou.usage.json", import.meta.url), "utf8"),
).usage;
const counters = Object.fromEntries(Object.entries(meta.species).map(([n, s]) => [n, s.counters]));
const { chart } = chartOf(Dex.forGen(9));

test("threats are the opponents countering the most members, never a member itself", () => {
  const team = ["Great Tusk", "Kingambit", "Gholdengo"];
  const threats = teamThreats(team, counters, usage);
  assert.ok(threats.length > 0);
  assert.ok(threats.every((t) => !team.includes(t.name)));
  for (let i = 1; i < threats.length; i++)
    assert.ok(threats[i - 1].members.length >= threats[i].members.length);
  assert.ok(threats[0].ko >= 0 && threats[0].ko <= 1);
});

test("matchup counts super effective hitters and members weak to the opponent's types", () => {
  const fire = { types: ["Fire"], attacks: ["Fire"] };
  const grass = { types: ["Grass"], attacks: ["Grass"] };
  // Against a Grass/Steel Pokémon: Fire hits ×4, Grass ×0.25; Grass is weak to neither Grass nor Steel.
  assert.deepEqual(matchup(chart, [fire, grass], ["Grass", "Steel"]), {
    hitters: 1,
    best: 4,
    threatened: 0,
  });
  // A Water Pokémon threatens the Fire member.
  assert.equal(matchup(chart, [fire, grass], ["Water"]).threatened, 1);
});

test("trend and Trick Room hint", () => {
  assert.ok(Math.abs(trend(0.3, 0.25) - 0.05) < 1e-9);
  assert.equal(trend(0.3, undefined), undefined);
  assert.equal(trickRoomHint([40, 50, 60], [100, 110, 30]), true);
  assert.equal(trickRoomHint([120, 130, 140], [100, 110, 30]), false);
});
