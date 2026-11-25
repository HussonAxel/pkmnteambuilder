// Run: node --test apps/web/src/lib/suggest.test.mjs (Node strips the .ts types natively).
import assert from "node:assert/strict";
import { test } from "node:test";
import { Dex } from "@pkmn/dex";
import { coverageSuggestions } from "./suggest.ts";
import { chartOf } from "./type-chart.ts";

const { types, chart } = chartOf(Dex.forGen(4));

test("the brief's score: new coverage, fixed and added shared weaknesses", () => {
  const team = [{ types: ["Grass"] }, { types: ["Grass", "Poison"] }]; // both weak to Fire, Flying, Ice
  const [best] = coverageSuggestions(chart, types, team, [
    { name: "Empoleon", types: ["Water", "Steel"] },
    { name: "Snover", types: ["Grass", "Ice"] },
  ]);
  assert.equal(best.candidate.name, "Empoleon");
  assert.ok(best.fixes.includes("Ice")); // Steel resists Ice
  assert.ok(best.covers.includes("Fire") || best.covers.includes("Rock"));
  assert.equal(best.score, 2 * best.covers.length + 3 * best.fixes.length - 3 * best.adds.length);
});

test("candidates that only make things worse are left out", () => {
  const team = [{ types: ["Grass"] }, { types: ["Grass"] }];
  const list = coverageSuggestions(chart, types, team, [{ name: "Grass again", types: ["Grass"] }]);
  assert.equal(list.length, 0);
});
