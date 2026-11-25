// How each species learns its moves, per generation (1 to 9): the set editor's move list and the Box
// details panel (level, evolution, TM, egg, tutor, event), plus who can pass on each egg move and which
// TM teaches what. Precomputed: the browser never loads @pkmn/dex's full learnsets (~3.2 MB).
// Regenerate: node apps/web/scripts/build-learn.mjs (after build-formats.mjs or a @pkmn/dex update)
// Out: src/data/learn/gen<N>.json, one per generation, loaded only for teams of that generation.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Dex, toID } from "@pkmn/dex";
import { FORMATS } from "../src/data/formats/index.ts";
import { loadCsv } from "./lib/pokeapi.mjs";

const OUT = new URL("../src/data/learn/", import.meta.url);
// The game whose TM list stands for each generation (TM numbers are shared within a generation).
const TM_GAME = {
  1: "yellow",
  2: "crystal",
  3: "emerald",
  4: "platinum",
  5: "black-2-white-2",
  6: "omega-ruby-alpha-sapphire",
  7: "ultra-sun-ultra-moon",
  8: "sword-shield",
  9: "scarlet-violet",
};

const [machines, versionGroups, pokeapiMoves, items] = await Promise.all(
  ["machines", "version_groups", "moves", "items"].map((n) => loadCsv(n)),
);
const moveById = new Map(pokeapiMoves.map((m) => [m.id, m.identifier]));
const itemById = new Map(items.map((i) => [i.id, i.identifier]));

mkdirSync(OUT, { recursive: true });
for (const g of Object.keys(TM_GAME).map(Number)) {
  const gen = Dex.forGen(g);
  // Every species some format of this generation allows (scripts/build-formats.mjs). Gens 1 to 3 have no
  // format here (only the Pokémon page and adventure teams use them): every species of that generation.
  const names =
    g <= 3
      ? gen.species
          .all()
          .filter((s) => s.exists && s.num > 0 && !s.isNonstandard)
          .map((s) => s.name)
      : FORMATS.filter((f) => f.gen === g).flatMap((f) =>
          JSON.parse(
            readFileSync(new URL(`../src/data/formats/${f.id}.json`, import.meta.url), "utf8"),
          ),
        );
  const species = [...new Set(names)].map((name) => gen.species.get(name)).filter((s) => s.exists);

  // Formes without a learnset of their own use their base species'.
  // Gens 1 and 2 keep their learnsets apart (tradebacks, Crystal tutors): read them from that generation.
  const learnsets = g <= 2 ? gen.learnsets : Dex.learnsets;
  async function learnsetOf(sp) {
    const own = (await learnsets.get(sp.id))?.learnset;
    if (own || !(sp.changesFrom || sp.baseSpecies !== sp.name)) return own ?? {};
    return (await learnsets.get(toID(sp.changesFrom || sp.baseSpecies)))?.learnset ?? {};
  }

  // This generation's sources ("9L20", "9M", "9E", "9T", "9S0") -> ["L20", "M", "E", "T", "S"], lowest level only.
  // Showdown's level 0 means "learned on evolution": "V34" (evolves at 34) or "V" (no level, e.g. an item).
  function codes(sources, sp) {
    const own = sources.filter((s) => s.startsWith(String(g))).map((s) => s.slice(1));
    const levels = own.filter((s) => s[0] === "L").map((s) => Number(s.slice(1)));
    const real = levels.filter((n) => n > 0);
    const kinds = new Set(own.map((s) => s[0]));
    return [
      ...(real.length ? [`L${Math.min(...real)}`] : []),
      ...(levels.includes(0) ? [sp.evoLevel ? `V${sp.evoLevel}` : "V"] : []),
      ...[..."METS"].filter((k) => kinds.has(k)),
    ];
  }
  const natural = (code) => "LVMT".includes(code[0]);

  const moveNames = [];
  const moveIndex = new Map();
  const moveId = (id) => {
    if (!moveIndex.has(id)) moveIndex.set(id, moveNames.push(gen.moves.get(id).name) - 1);
    return moveIndex.get(id);
  };
  const speciesIndex = new Map(species.map((s, i) => [s.name, i]));

  // learn[species] = "move:codes;…". A code learned by a pre-evolution names it: "E@Litten", "L36@Gible".
  // Kept: the nearest learner in the line (the species itself first), plus the earliest level-up elsewhere
  // in the line when that learner has none (Garchomp: TM only, Gible: level 36).
  const learn = {};
  const directLearners = new Map(); // move id -> species learning it themselves by level, TM or tutor
  const eggMoves = new Set();
  const eggLearners = new Map(); // move id -> species that hatch with it as an egg move
  for (const s of species) {
    const line = {}; // move index -> [{ codes, by }], nearest first
    let sp = s;
    while (sp?.exists) {
      for (const [move, sources] of Object.entries(await learnsetOf(sp))) {
        const c = codes(sources, sp);
        if (!c.length) continue;
        if (c.includes("E")) eggMoves.add(move);
        if (sp === s && c.includes("E")) {
          if (!eggLearners.has(move)) eggLearners.set(move, []);
          eggLearners.get(move).push(s.name);
        }
        if (sp === s && c.some(natural)) {
          if (!directLearners.has(move)) directLearners.set(move, []);
          directLearners.get(move).push(s.name);
        }
        (line[moveId(move)] ??= []).push({ codes: c, by: sp === s ? "" : sp.name });
      }
      sp = sp.prevo ? gen.species.get(sp.prevo) : undefined;
    }
    const tag = (code, by) => (by ? `${code}@${by}` : code);
    learn[s.name] = Object.entries(line)
      .map(([i, [first, ...rest]]) => {
        const out = first.codes.map((c) => tag(c, first.by));
        if (!first.codes.some((c) => c[0] === "L")) {
          const earliest = rest
            .flatMap((f) =>
              f.codes.filter((c) => c[0] === "L").map((c) => ({ n: Number(c.slice(1)), by: f.by })),
            )
            .sort((a, b) => a.n - b.n)[0];
          if (earliest) out.push(tag(`L${earliest.n}`, earliest.by));
        }
        return `${i}:${out.join(",")}`;
      })
      .join(";");
  }

  // fathers[move] = species that can pass an egg move on directly: they learn it themselves, can be male,
  // and can breed. The panel keeps those sharing an egg group with the Pokémon.
  const canFather = (name) => {
    const sp = gen.species.get(name);
    return sp.gender !== "F" && sp.gender !== "N" && !sp.eggGroups.includes("Undiscovered");
  };
  const fathers = {};
  // carriers[move] = species that can relay it in a breeding chain: they hatch with it, then father the next.
  const carriers = {};
  const fatherIndices = (names) => (names ?? []).filter(canFather).map((n) => speciesIndex.get(n));
  for (const move of eggMoves) {
    const direct = fatherIndices(directLearners.get(move));
    if (direct.length) fathers[moveId(move)] = direct;
    const relay = fatherIndices(eggLearners.get(move));
    if (relay.length) carriers[moveId(move)] = relay;
  }

  // Species table: [name, national dex number, egg groups]. A baby (Undiscovered) breeds as its evolution.
  const breedGroups = (sp) =>
    sp.eggGroups.includes("Undiscovered") && sp.evos.length
      ? gen.species.get(sp.evos[0]).eggGroups
      : sp.eggGroups;
  const table = species.map((s) => [s.name, s.num, breedGroups(s).join("/")]);

  // TMs, from PokeAPI: move -> TM item identifier ("tm036", "tr12"), localised by the names files.
  const game = versionGroups.find((v) => v.identifier === TM_GAME[g]).id;
  const tm = {};
  for (const m of machines.filter((m) => m.version_group_id === game)) {
    const id = toID(moveById.get(m.move_id));
    if (moveIndex.has(id)) tm[moveIndex.get(id)] = itemById.get(m.item_id);
  }

  // Spot checks.
  const learnOf = (name, move) =>
    learn[name]
      ?.split(";")
      .find((e) => moveNames[Number(e.split(":")[0])] === move)
      ?.split(":")[1];
  if (g === 9) {
    assert.equal(learnOf("Chansey", "Soft-Boiled"), "L44");
    assert.equal(learnOf("Incineroar", "Darkest Lariat"), "V34");
    assert.equal(learnOf("Incineroar", "Parting Shot"), "E@Litten");
    assert.match(learnOf("Garchomp", "Dragon Tail"), /M/);
  }
  if (g === 1) {
    // Gen 1: one Special stat, no breeding; Gengar's Thunderbolt is TM24.
    assert.match(learnOf("Gengar", "Thunderbolt") ?? "", /M/);
    assert.equal(learnOf("Pikachu", "Thunder Wave"), "L8,M"); // Yellow: level 8, and TM45
  }
  const [probe, quake] = g <= 3 ? ["Golem", "Earthquake"] : ["Garchomp", "Earthquake"];
  assert.match(learnOf(probe, quake) ?? "", /M/, `gen ${g}: ${probe} should get ${quake} by TM`);
  // 50 TMs (+ HMs) up to gen 3, 92 or more since.
  const minTms = g <= 3 ? 50 : 80;
  assert.ok(Object.keys(tm).length > minTms, `gen ${g}: only ${Object.keys(tm).length} TMs mapped`);
  // No breeding in gen 1; gen 2 introduced it with fewer egg moves.
  const minFathers = g === 1 ? 0 : g <= 3 ? 50 : 100;
  assert.ok(Object.keys(fathers).length >= minFathers, `gen ${g}: only ${Object.keys(fathers).length} egg moves with fathers`);

  writeFileSync(
    new URL(`gen${g}.json`, OUT),
    JSON.stringify({ moves: moveNames, species: table, learn, fathers, carriers, tm }),
  );
  console.log(
    `gen ${g}: ${species.length} species, ${moveNames.length} moves, ${Object.keys(fathers).length} egg moves with fathers, ${Object.keys(tm).length} TMs`,
  );
}
