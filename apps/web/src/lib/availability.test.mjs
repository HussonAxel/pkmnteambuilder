// Data tests on the generated files (note de cadrage, section 5 "Tests").
// Run: node --test apps/web/src/lib/availability.test.mjs (after scripts/build-games.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_RULES, affectedBy, availableIn, bestSource, ruleImpact } from "./availability.ts";

const load = (vg) => JSON.parse(readFileSync(new URL(`../data/games/${vg}.json`, import.meta.url), "utf8"));
const dp = load("diamond-pearl");
const ids = (game, version, rules) => new Set(availableIn(game, version, rules).map((a) => a.pokemon.id));
const stepOf = (game, version, id, rules) => availableIn(game, version, rules).find((a) => a.pokemon.id === id)?.step;

const MURKROW = 198, DIALGA = 483, PALKIA = 484, RIOLU = 447, LUCARIO = 448, CLEFAIRY = 35, PORYGON_Z = 474;

test("Murkrow is a Diamond exclusive: absent from Pearl unless exclusives are allowed", () => {
  assert.ok(ids(dp, "diamond").has(MURKROW));
  assert.ok(!ids(dp, "pearl").has(MURKROW));
  assert.ok(ids(dp, "pearl", { ...DEFAULT_RULES, exclusives: true }).has(MURKROW));
});

test("Version legendaries follow their version", () => {
  assert.ok(ids(dp, "diamond").has(DIALGA) && !ids(dp, "diamond").has(PALKIA));
  assert.ok(ids(dp, "pearl").has(PALKIA) && !ids(dp, "pearl").has(DIALGA));
});

test("Static encounters disappear when the player turns them off", () => {
  assert.ok(!ids(dp, "diamond", { ...DEFAULT_RULES, static: false }).has(DIALGA));
});

test("Riolu (egg gift) and Lucario (its evolution) depend on the gift rule", () => {
  assert.ok(ids(dp, "pearl").has(RIOLU) && ids(dp, "pearl").has(LUCARIO));
  const noGifts = ids(dp, "pearl", { ...DEFAULT_RULES, gift: false });
  assert.ok(!noGifts.has(LUCARIO));
});

test("Trade evolutions are hidden by default", () => {
  assert.ok(!ids(dp, "diamond").has(PORYGON_Z));
  assert.ok(ids(dp, "diamond", { ...DEFAULT_RULES, trade: true }).has(PORYGON_Z));
});

test("Era types: Clefairy is Normal before gen 6", () => {
  assert.deepEqual(dp.pokemon.find((p) => p.id === CLEFAIRY).types, ["normal"]);
  assert.ok(!dp.pokemon.some((p) => p.types.includes("fairy")));
});

test("Lucario is not available before its egg can be collected (needs the progression file)", { skip: !dp.progression }, () => {
  const riolu = stepOf(dp, "pearl", RIOLU);
  assert.ok(riolu > 0, "Riolu's egg is not a starting gift");
  assert.ok(stepOf(dp, "pearl", LUCARIO) >= riolu);
});

test("Rule counters: each switch reports how many Pokémon it decides", () => {
  const pearl = ruleImpact(dp, "pearl");
  for (const n of Object.values(pearl)) assert.ok(Number.isInteger(n) && n >= 0);
  assert.ok(pearl.exclusives > 0, "Pearl has Diamond exclusives (Murkrow…)");
  assert.ok(pearl.trade > 0, "Porygon-Z, Gengar… need a trade");
  assert.ok(pearl.static > 0, "Palkia is a static encounter");
});

test("bestSource gives the earliest allowed source, with its location and chance", () => {
  const murkrow = dp.pokemon.find((p) => p.id === MURKROW);
  assert.equal(bestSource(murkrow, "pearl", DEFAULT_RULES), undefined, "Murkrow is Diamond-only");
  const src = bestSource(murkrow, "diamond", DEFAULT_RULES);
  assert.ok(src && src.l, "has a location");
  assert.ok(src.r === undefined || (src.r > 0 && src.r <= 100), "chance is a percentage");
});

test("affectedBy lists exactly the Pokémon a rule decides", () => {
  const exclusives = affectedBy(dp, "pearl", "exclusives");
  assert.ok(exclusives.some((p) => p.id === MURKROW), "Murkrow is a Diamond exclusive");
  assert.equal(exclusives.length, ruleImpact(dp, "pearl").exclusives);
});

const swsh = load("sword-shield");
const MANECTRIC = 310;

test("Sword/Shield DLC sources (Max Lair, Isle of Armor, Crown Tundra) need the DLC rule", () => {
  // Without the DLC, Manectric comes from evolving Electrike (badge 2), not a Dynamax Adventure at the start.
  const base = bestSource(swsh.pokemon.find((p) => p.id === MANECTRIC), "sword");
  assert.ok(!base.f.includes("dlc") && base.s > 0);
  const dlc = bestSource(swsh.pokemon.find((p) => p.id === MANECTRIC), "sword", { ...DEFAULT_RULES, dlc: true });
  assert.equal(dlc.s, 0);
  assert.equal(dlc.m, "dynamax-adventure");
  // Teams saved before the rule existed have no `dlc` key: DLC sources stay hidden for them.
  const { dlc: _dlc, ...older } = DEFAULT_RULES;
  assert.equal(stepOf(swsh, "sword", MANECTRIC, older), base.s);
  assert.ok(ruleImpact(swsh, "sword").dlc > 0);
});

const sv = load("scarlet-violet");
const POLTCHAGEIST = 1012, ARTICUNO = 144, MAGBY = 240;

test("Scarlet/Violet DLC (Teal Mask, Indigo Disk) needs the DLC rule; Indigo Disk story content is post-game", () => {
  const withDlc = { ...DEFAULT_RULES, dlc: true };
  // Kitakami-only species: absent from the base game.
  assert.ok(!ids(sv, "scarlet").has(POLTCHAGEIST));
  assert.ok(ids(sv, "scarlet", withDlc).has(POLTCHAGEIST));
  // Snacksworth's Articuno: Indigo Disk, after the main story.
  assert.ok(!ids(sv, "scarlet").has(ARTICUNO));
  assert.equal(stepOf(sv, "scarlet", ARTICUNO, withDlc), sv.postgame);
  // League Club Room trades are Indigo Disk content: Magby isn't in the base game.
  assert.ok(!ids(sv, "scarlet").has(MAGBY));
});
