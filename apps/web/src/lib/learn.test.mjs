// Run: node --test apps/web/src/lib/learn.test.mjs (Node strips the .ts types natively).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { howToLearn, learnedAs } from "./learn.ts";

const data = JSON.parse(readFileSync(new URL("../data/learn/gen9.json", import.meta.url), "utf8"));
const kinds = (species, move) => howToLearn(data, species, move)?.map((m) => m.kind);

test("level and TM, with the Scarlet/Violet TM item", () => {
  assert.ok(
    howToLearn(data, "Garchomp", "Earthquake").some(
      (m) => m.kind === "tm" && /^tm\d+$/.test(m.item),
    ),
  );
  assert.deepEqual(howToLearn(data, "Chansey", "Soft-Boiled"), [{ kind: "level", level: 44 }]);
});

test("moves learned on evolution give the evolution level, not level 0", () => {
  assert.deepEqual(howToLearn(data, "Incineroar", "Darkest Lariat"), [
    { kind: "evolution", level: 34 },
  ]);
  // Kingambit evolves with an item, not at a level.
  assert.deepEqual(howToLearn(data, "Kingambit", "Kowtow Cleave"), [
    { kind: "evolution", level: undefined },
  ]);
});

test("egg moves of a pre-evolution name it and list fathers sharing an egg group", () => {
  const [fakeOut] = howToLearn(data, "Incineroar", "Fake Out");
  assert.equal(fakeOut.kind, "egg");
  assert.equal(fakeOut.by, "Litten");
  assert.ok(fakeOut.fathers.includes("Meowth"));
  assert.ok(!fakeOut.fathers.includes("Incineroar"));
});

test("a TM-only move also shows the level a pre-evolution learns it at", () => {
  const methods = howToLearn(data, "Victreebel", "Knock Off");
  assert.ok(methods.some((m) => m.kind === "tm"));
  assert.ok(methods.some((m) => m.kind === "level" && m.by === "Bellsprout"));
});

test("a move learned naturally never mentions eggs or events", () => {
  // Any species whose raw codes mix a natural method with an egg one.
  const [species, entry] = Object.entries(data.learn)
    .flatMap(([s, l]) => l.split(";").map((e) => [s, e]))
    .find(([, e]) => /:(L\d+|M|T)\b.*\bE\b/.test(e));
  const methods = kinds(species, data.moves[Number(entry.split(":")[0])]);
  assert.ok(methods.length > 0);
  assert.ok(!methods.includes("egg") && !methods.includes("event"));
});

test("unknown or unlearnable moves give null", () => {
  assert.equal(howToLearn(data, "Chansey", "Surging Strikes"), null);
  assert.equal(howToLearn(data, "Chansey", "Not A Move"), null);
});

test("with no father in its egg groups, the shortest breeding chain, or none", () => {
  const [tickle] = howToLearn(data, "Clefairy", "Tickle");
  assert.equal(tickle.fathers.length, 0);
  assert.ok(tickle.chain.length >= 2);
  // Parting Shot: only Bombirdier (Flying) learns it; no Flying/Field relay hatches with it.
  const [partingShot] = howToLearn(data, "Incineroar", "Parting Shot");
  assert.equal(partingShot.chain, undefined);
});

test("a typed Hidden Power is learned as Hidden Power", () => {
  assert.equal(learnedAs("Hidden Power Fire"), "Hidden Power");
  assert.equal(learnedAs("Hidden Power"), "Hidden Power");
  assert.equal(learnedAs("Fire Blast"), "Fire Blast");
  const gen7 = JSON.parse(
    readFileSync(new URL("../data/learn/gen7.json", import.meta.url), "utf8"),
  );
  const species = Object.keys(gen7.learn).find((name) => howToLearn(gen7, name, "Hidden Power"));
  assert.deepEqual(
    howToLearn(gen7, species, "Hidden Power Ice"),
    howToLearn(gen7, species, "Hidden Power"),
  );
});
