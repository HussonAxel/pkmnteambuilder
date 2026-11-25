// Run: node --test apps/web/src/lib/sets.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calcStat,
  checkDraft,
  EV_TOTAL,
  importSet,
  missingParts,
  evTotal,
  fromAnalysis,
  fromUsage,
  parseSpread,
  pasteContext,
  rankSuggestions,
  setEv,
  toShowdown,
  coverage,
} from "./sets.ts";

test("fromAnalysis takes the first option of each slot, nested ones included", () => {
  const { draft } = fromAnalysis(
    "Offensive Utility",
    {
      moves: ["Headlong Rush", "Ice Spinner", "Rapid Spin", ["Close Combat", "Stealth Rock"]],
      item: ["Heavy-Duty Boots", "Rocky Helmet"],
      nature: "Jolly",
      evs: { atk: 252, def: 4, spe: 252 },
      teratypes: ["Steel", "Fighting"],
    },
    "Protosynthesis",
  );
  assert.deepEqual(draft.moves, ["Headlong Rush", "Ice Spinner", "Rapid Spin", "Close Combat"]);
  assert.equal(draft.item, "Heavy-Duty Boots");
  assert.equal(draft.ability, "Protosynthesis", "falls back to the species ability");
  assert.equal(draft.teraType, "Steel");
  assert.deepEqual(draft.evs, { hp: 0, atk: 252, def: 4, spa: 0, spd: 0, spe: 252 });
});

test("parseSpread reads Smogon spreads", () => {
  assert.deepEqual(parseSpread("Jolly:0/252/4/0/0/252"), {
    nature: "Jolly",
    evs: { hp: 0, atk: 252, def: 4, spa: 0, spd: 0, spe: 252 },
  });
});

test("fromUsage picks the most used option of each slot and skips 'Nothing'", () => {
  const { draft } = fromUsage(
    {
      abilities: { Intimidate: 0.99, Blaze: 0.01 },
      items: { Nothing: 0.5, "Safety Goggles": 0.3, "Sitrus Berry": 0.2 },
      moves: {
        "Fake Out": 0.98,
        "Parting Shot": 0.9,
        "Flare Blitz": 0.8,
        "Knock Off": 0.7,
        Protect: 0.1,
      },
      teraTypes: { Ghost: 0.6, Grass: 0.4 },
      spreads: { "Careful:252/4/0/0/252/0": 0.2, "Adamant:252/252/4/0/0/0": 0.1 },
    },
    "Blaze",
  );
  assert.equal(draft.item, "Safety Goggles");
  assert.equal(draft.ability, "Intimidate");
  assert.equal(draft.teraType, "Ghost");
  assert.deepEqual(draft.moves, ["Fake Out", "Parting Shot", "Flare Blitz", "Knock Off"]);
  assert.equal(draft.nature, "Careful");
});

test("setEv keeps each stat within 252 and the total within 510", () => {
  let evs = { hp: 252, atk: 252, def: 0, spa: 0, spd: 0, spe: 0 };
  evs = setEv(evs, "spe", 252);
  assert.equal(evs.spe, 6, "only 6 EVs left");
  assert.equal(evTotal(evs), EV_TOTAL);
  assert.equal(setEv(evs, "hp", 400).hp, 252);
  assert.equal(setEv(evs, "def", -5).def, 0);
});

test("calcStat matches in-game stats", () => {
  // Garchomp, Jolly 252 Atk / 252 Spe, 31 IVs: 359 Atk, 333 Spe at level 100; 182 Atk at 50.
  const jolly = { plus: "spe", minus: "spa" };
  assert.equal(calcStat("atk", 130, 31, 252, 100, jolly), 359);
  assert.equal(calcStat("spe", 102, 31, 252, 100, jolly), 333);
  assert.equal(calcStat("spa", 80, 31, 0, 100, jolly), 176);
  assert.equal(calcStat("hp", 108, 31, 4, 100), 358);
  assert.equal(calcStat("atk", 130, 31, 252, 50, jolly), 182);
  assert.equal(calcStat("hp", 1, 31, 252, 100), 1, "Shedinja");
});

const legal = {
  species: "Clefable",
  abilities: ["Cute Charm", "Magic Guard", "Unaware"],
  moves: ["Moonblast", "Calm Mind", "Moonlight", "Flamethrower", "U-turn"],
  items: ["Leftovers", "Life Orb"],
  natures: ["Bold", "Calm", "Serious"],
  teraTypes: ["Fairy", "Steel"],
};

test("importSet reads a Showdown paste", () => {
  const { draft, problems } = importSet(
    `Fée (Clefable) (F) @ Leftovers
Ability: Magic Guard
Level: 50
Tera Type: Steel
EVs: 252 HP / 4 Def / 252 SpD
Calm Nature
IVs: 0 Atk
- Moonblast
- calm mind
- Moonlight`,
    legal,
  );
  assert.equal(problems, undefined);
  assert.equal(draft.item, "Leftovers");
  assert.equal(draft.ability, "Magic Guard");
  assert.equal(draft.teraType, "Steel");
  assert.equal(draft.nature, "Calm");
  assert.deepEqual(draft.evs, { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 });
  assert.equal(draft.ivs.atk, 0);
  assert.equal(draft.ivs.spe, 31);
  assert.deepEqual(draft.moves, ["Moonblast", "Calm Mind", "Moonlight", ""], "canonical spelling");
});

test("importSet rejects structure and legality problems", () => {
  const keys = (text) => importSet(text, legal).problems?.map((p) => p.key);
  assert.deepEqual(keys("Clefable\nEVs: 252 HP / 252 Def / 252 SpD\n- Moonblast"), [
    "import.evTotal",
  ]);
  assert.deepEqual(keys("Clefable\nEVs: 300 HP\n- Moonblast"), ["import.evMax"]);
  assert.deepEqual(keys("Clefable"), ["import.noMoves"]);
  assert.deepEqual(keys("Clefable @ Choice Specs\nAbility: Levitate\n- Moonblast\n- Earthquake"), [
    "import.badAbility",
    "import.badItem",
    "import.badMove",
  ]);
  assert.deepEqual(keys("Pikachu\n- Moonblast"), ["import.wrongSpecies"]);
});

test("pasteContext knows which field the caret is in", () => {
  const ctx = (text) => {
    const c = pasteContext(text, text.length);
    return c && [c.field, c.query];
  };
  assert.deepEqual(ctx("Mew"), ["species", "Mew"]);
  assert.deepEqual(ctx("Fée (Clef"), ["species", "Clef"]);
  assert.deepEqual(ctx("Clefable @ Left"), ["item", "Left"]);
  assert.deepEqual(ctx("Clefable\nAbility: Mag"), ["ability", "Mag"]);
  assert.deepEqual(ctx("Clefable\nTera Type: St"), ["tera", "St"]);
  assert.deepEqual(ctx("Clefable\n- Moon"), ["move", "Moon"]);
  assert.deepEqual(ctx("Clefable\nEVs: 252 HP / 4 D"), ["stat", "D"]);
  assert.equal(ctx("Clefable\nEVs: 25"), null, "a number is being typed");
  assert.deepEqual(ctx("Clefable\nCal"), ["line", "Cal"]);
  assert.equal(ctx("Clefable\nLevel: 5"), null);
  // Caret in the middle: only the text before it counts.
  assert.equal(pasteContext("Clefable @ Leftovers\nAbility: Magic", 13).field, "item");
});

test("rankSuggestions puts prefix matches first", () => {
  assert.deepEqual(rankSuggestions(["Mew", "Mewtwo", "Smeargle"], "Mew"), ["Mewtwo"]);
  assert.deepEqual(rankSuggestions(["Leftovers", "Life Orb", "Choice Specs"], "orb"), ["Life Orb"]);
  assert.deepEqual(rankSuggestions(["Calm Mind", "Mind Blown", "Psychic"], "mind"), [
    "Mind Blown",
    "Calm Mind",
  ]);
});

test("toShowdown round-trips through importSet", () => {
  const text = toShowdown("Clefable", {
    item: "Leftovers",
    ability: "Magic Guard",
    teraType: "Steel",
    nature: "Calm",
    evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
    ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ["Moonblast", "Calm Mind", "", ""],
  });
  assert.match(
    text,
    /^Clefable @ Leftovers\nAbility: Magic Guard\nTera Type: Steel\nEVs: 252 HP \/ 4 Def \/ 252 SpD\nCalm Nature\nIVs: 0 Atk\n- Moonblast\n- Calm Mind$/,
  );
  assert.equal(importSet(text, legal).draft.ivs.atk, 0);
});

test("checkDraft flags unknown values and fixes their spelling", () => {
  const draft = {
    item: "leftovers",
    ability: "magic guard",
    teraType: undefined,
    nature: "calm",
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ["moonblast", "Toxi", "", ""],
  };
  const { draft: fixed, problems } = checkDraft(draft, legal);
  assert.deepEqual(problems, [{ key: "import.badMove", value: "Toxi", field: "move-1" }]);
  assert.equal(fixed.item, "Leftovers");
  assert.equal(fixed.ability, "Magic Guard");
  assert.equal(fixed.moves[0], "Moonblast");
  assert.equal(fixed.moves[1], "Toxi", "unknown values are kept for the player to fix");
  assert.deepEqual(checkDraft({ ...draft, moves: ["Moonblast", "", "", ""] }, legal).problems, []);
});

test("missingParts lists what a set still lacks", () => {
  const evs = { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 };
  const full = { item: "Leftovers", moves: ["A", "B", "C", "D"], nature: "Calm", evs };
  assert.deepEqual(missingParts(full), []);
  assert.deepEqual(missingParts({ item: "", moves: ["A", ""], evs: undefined }), [
    "incomplete.item",
    "incomplete.moves",
    "incomplete.evs",
    "incomplete.nature",
  ]);
  assert.deepEqual(missingParts({ ...full, evs: { ...evs, hp: 0, def: 0, spd: 0 } }), [
    "incomplete.evs",
  ]);
});

test("coverage is the mean usage of a set's moves and item, 0 outside the top options", () => {
  const build = { moves: { Moonblast: 0.97, Moonlight: 0.83 }, items: { Leftovers: 0.47 } };
  const { score, parts } = coverage(
    { moves: ["Moonblast", "Moonlight", "Calm Mind", ""], item: "Leftovers" },
    build,
  );
  assert.equal(parts.length, 4);
  assert.equal(parts.find((p) => p.name === "Calm Mind").share, 0);
  assert.ok(Math.abs(score - (0.97 + 0.83 + 0 + 0.47) / 4) < 1e-9);
  assert.equal(coverage({ moves: [], item: "" }, build).score, 0);
});
