// Run: node --test apps/web/src/lib/legality.test.mjs (Node strips the .ts types natively).
// Checks the generated legal lists (scripts/build-formats.mjs) against known bans.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FORMATS } from "../data/formats/index.ts";
import { tiersAmong } from "./legality.ts";

const legal = (id, name) =>
  JSON.parse(readFileSync(new URL(`../data/formats/${id}.json`, import.meta.url), "utf8")).includes(
    name,
  );

test("every catalogued format has a legal list, gens 4 to 9", () => {
  assert.deepEqual([...new Set(FORMATS.map((f) => f.gen))], [9, 8, 7, 6, 5, 4]);
  for (const f of FORMATS) assert.ok(legal(f.id, "Pikachu") || f.mode === "smogon", f.id);
});

test("Smogon: a format allows its tier and below, not above, per generation", () => {
  assert.equal(legal("gen9ou", "Great Tusk"), true);
  assert.equal(legal("gen9ou", "Pikachu"), true); // ZU is below OU
  assert.equal(legal("gen9ou", "Flutter Mane"), false); // Uber
  assert.equal(legal("gen9ubers", "Flutter Mane"), true);
  assert.equal(legal("gen6ou", "Garchomp"), true);
  assert.equal(legal("gen4ou", "Garchomp"), false); // Uber in gen 4
  assert.equal(legal("gen6ou", "Arceus"), false);
});

test("Smogon LC only allows first stages, at level 5", () => {
  assert.equal(legal("gen9lc", "Sprigatito"), true);
  assert.equal(legal("gen9lc", "Meowscarada"), false);
});

test("VGC: restricted legendaries only in the seasons that allow two", () => {
  assert.equal(legal("gen8vgc2022", "Zacian"), true);
  assert.equal(legal("gen8vgc2021", "Zacian"), false);
  assert.equal(legal("gen7vgc2019", "Mewtwo"), true);
  assert.equal(legal("gen7vgc2018", "Mewtwo"), false);
  assert.equal(legal("gen6vgc2016", "Kyogre"), true);
  assert.equal(legal("gen6vgc2015", "Kyogre"), false);
});

test("Gen 9 regulations ban by species tag", () => {
  assert.equal(legal("gen9vgc2026regf", "Flutter Mane"), true);
  assert.equal(legal("gen9vgc2026regf", "Koraidon"), false);
  assert.equal(legal("gen9vgc2025regg", "Koraidon"), true);
  assert.equal(legal("gen9vgc2025regg", "Mew"), false);
  assert.equal(legal("gen9vgc2025regh", "Flutter Mane"), false);
  assert.equal(legal("gen9vgc2025regh", "Chien-Pao"), false);
  assert.equal(legal("gen9vgc2025regh", "Incineroar"), true);
});

test("tier chips keep Smogon's order and only tiers present", () => {
  assert.deepEqual(tiersAmong(["NU", "OU", undefined, "LC", "OU"]), ["OU", "NU", "LC"]);
});
