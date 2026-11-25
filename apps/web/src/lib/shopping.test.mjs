// Run: node --test apps/web/src/lib/shopping.test.mjs (Node strips the .ts types natively).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { materialSpecies, needsTm, shoppingList, splitPlaces, tmCost } from "./shopping.ts";

const sv = JSON.parse(
  readFileSync(new URL("../data/tm-sources/gen9.json", import.meta.url), "utf8"),
).moves;

test("a Scarlet/Violet TM row gives its price, LP and materials", () => {
  const cost = tmCost(sv["Iron Head"].rows[0]);
  assert.equal(cost.price, 8000);
  assert.equal(cost.lp, 8000);
  assert.deepEqual(cost.materials, [
    { name: "Cufant Tarnish", species: "Cufant", count: 5 },
    { name: "Pawniard Blade", species: "Pawniard", count: 3 },
    { name: "Rookidee Feather", species: "Rookidee", count: 3 },
  ]);
});

test("the Blueberry store's BP price is read too", () => {
  assert.equal(tmCost(sv.Protect.rows[0]).bp, 10);
});

test("materials name the Pokémon that drops them", () => {
  assert.equal(materialSpecies("Cufant Tarnish"), "Cufant");
  assert.equal(materialSpecies("Mr. Mime Dust"), "Mr. Mime");
});

test("the list counts items, buys each TM once and sums materials and costs", () => {
  const list = shoppingList(
    ["Leftovers", "Leftovers", "Focus Sash", ""],
    ["Iron Head", "Iron Head", "Protect", "Not A TM Move"],
    sv,
  );
  assert.deepEqual(list.items, [
    { name: "Leftovers", count: 2 },
    { name: "Focus Sash", count: 1 },
  ]);
  assert.deepEqual(
    list.tms.map((t) => t.move),
    ["Iron Head", "Protect"],
  );
  assert.equal(list.total.lp, 8000 + 400);
  assert.equal(list.materials.find((m) => m.name === "Cufant Tarnish").count, 5);
});

test("a TM is only needed when no level-up or evolution teaches the move", () => {
  assert.equal(needsTm([{ kind: "tm" }]), true);
  assert.equal(needsTm([{ kind: "level" }, { kind: "tm" }]), false);
  assert.equal(needsTm([{ kind: "evolution" }, { kind: "tm" }]), false);
  assert.equal(needsTm([{ kind: "egg" }]), false);
  assert.equal(needsTm(null), false);
});

test("found cells split into base-game and DLC places, without the TM Machine", () => {
  assert.deepEqual(splitPlaces(sv["Iron Head"].rows[0].found), {
    base: ["Levincia", "Casseroya Lake", "West Province (Area One)"],
    dlc: [
      { name: "The Teal Mask", places: ["Timeless Woods"] },
      { name: "The Indigo Disk", places: ["Savanna Biome"] },
    ],
  });
  assert.deepEqual(splitPlaces("Porto Marinada"), { base: ["Porto Marinada"], dlc: [] });
});
