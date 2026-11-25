// Run: node --test apps/web/src/lib/type-chart.test.mjs (Node strips the .ts types natively).
import assert from "node:assert/strict";
import { test } from "node:test";
import { Dex } from "@pkmn/dex";
import { alerts, chartOf, defense, offense } from "./type-chart.ts";

const gen9 = chartOf(Dex.forGen(9));
const gen4 = chartOf(Dex.forGen(4));

test("the chart follows the generation: no Fairy before gen 6, no Stellar ever", () => {
  assert.equal(gen9.types.length, 18);
  assert.ok(!gen9.types.includes("Stellar"));
  assert.equal(gen4.types.length, 17);
  assert.ok(!gen4.types.includes("Fairy"));
  // Steel resisted Ghost and Dark until gen 5.
  assert.equal(defense(gen4.chart, ["Steel"], "Ghost"), 0.5);
  assert.equal(defense(gen9.chart, ["Steel"], "Ghost"), 1);
});

test("dual types multiply, immunities included", () => {
  assert.equal(defense(gen9.chart, ["Grass", "Bug"], "Fire"), 4); // ×4
  assert.equal(defense(gen9.chart, ["Steel", "Fairy"], "Dragon"), 0); // Fairy immunity
  assert.equal(defense(gen9.chart, ["Water", "Ground"], "Electric"), 0);
  assert.equal(defense(gen9.chart, ["Fire", "Steel"], "Bug"), 0.25);
});

test("offense keeps the best attacking type against each defending type", () => {
  assert.equal(offense(gen9.chart, ["Fire", "Water"], "Grass"), 2);
  assert.equal(offense(gen9.chart, ["Normal"], "Ghost"), 0);
  assert.equal(offense(gen9.chart, [], "Fire"), 0);
});

test("alerts: three weak, two weak and unresisted, and uncovered types", () => {
  const grass = { types: ["Grass"], attacks: ["Grass"] };
  const list = alerts(gen9.chart, gen9.types, [grass, grass, grass]);
  assert.ok(list.some((a) => a.kind === "stacked" && a.type === "Fire" && a.weak === 3));
  assert.ok(list.some((a) => a.kind === "uncovered" && a.type === "Fire"));
  const two = alerts(gen9.chart, gen9.types, [
    grass,
    grass,
    { types: ["Water"], attacks: ["Water"] },
  ]);
  // Grass is weak to Poison and Water doesn't resist it (Water does resist Ice, so Ice isn't flagged).
  assert.ok(two.some((a) => a.kind === "unresisted" && a.type === "Poison"));
  assert.ok(!two.some((a) => a.kind === "unresisted" && a.type === "Ice"));
  assert.ok(!two.some((a) => a.type === "Fire" && a.kind !== "uncovered")); // Water resists Fire
});
