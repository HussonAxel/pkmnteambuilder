// Builds per-game availability data from PokeAPI CSVs + hand-written progression files.
// Regenerate: node apps/web/scripts/build-games.mjs
// Check one game without writing anything: node apps/web/scripts/build-games.mjs --check <version-group>
// In:  data/progression/<version-group>.json (optional, written by hand from walkthroughs).
//      "overrides" adds sources; "exclude" lists national dex numbers to drop entirely (event-only).
//      data/encounters/<version-group>.json for games PokeAPI has no encounters for (build-sv-encounters.mjs).
// Out: src/data/games/<version-group>.json + index.ts, src/data/names/<lang>.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { LANG, POKEAPI_REV, loadCsv } from "./lib/pokeapi.mjs";

const ROOT = new URL("../", import.meta.url);
const OUT_GAMES = new URL("src/data/games/", ROOT);
const OUT_NAMES = new URL("src/data/names/", ROOT);

// Mainline games with encounter data in PokeAPI, then those read from data/encounters/.
// DLC groups are folded into their base game.
const GAMES = [
  "red-blue", "yellow", "gold-silver", "crystal", "ruby-sapphire", "emerald",
  "firered-leafgreen", "diamond-pearl", "platinum", "heartgold-soulsilver",
  "black-white", "black-2-white-2", "x-y", "omega-ruby-alpha-sapphire",
  "sun-moon", "ultra-sun-ultra-moon", "lets-go-pikachu-lets-go-eevee", "sword-shield",
  "scarlet-violet",
];
const DLC = {
  "the-isle-of-armor": "sword-shield",
  "the-crown-tundra": "sword-shield",
};
const DLC_VERSION = (id) => id.replace(/^the-(isle-of-armor|crown-tundra)-/, "");

// Not obtainable from the cartridge alone (note de cadrage 2.1, "Hors du jeu seul").
const EXTERNAL_METHODS = new Set([
  "colosseum-bonus-disc-us", "colosseum-bonus-disc-jpn", "pokemon-channel-pal",
  "pokemon-ranger", "pokemon-battle-revolution", "new-york-pokecenter-wish-eggs",
  "snag", "snag-rematch", "pokespot",
]);
const EXTERNAL_CONDITIONS = [
  /^other-virtual-console$/, /^save-data-from-/, /^other-scan-qr-code$/,
  /^other-event-/, /^friend-safari-/,
];
const STATIC_METHODS = new Set(["static", "roaming-grass", "roaming-water"]);
const GIFT_METHODS = new Set(["gift", "gift-egg", "npc-trade"]);
const RARE_METHODS = new Set(["honey-tree", "feebas-tile-fishing"]);
const RARE_CONDITIONS = [
  /^swarm-yes$/, /^radar-on$/, /^slot2-(?!none)/, /^radio-(hoenn|sinnoh)$/,
  /^honey-tree-/, /^great-marsh-daily-slot-(?!none)/, /^headbutt-tree-(rare|secret)$/,
  /^johto-safari-blocks-(?!inactive)/,
];
const POSTGAME_CONDITIONS = new Set([
  "story-progress-national-dex", "story-progress-hall-of-fame",
  "story-progress-beat-elite-four-round-two", "story-progress-beat-red",
]);
// data/encounters/ methods: their flags, and the order sources are added in (the first one wins a tie).
const EXTRA_FLAGS = {
  fixed: ["static"], static: ["static"], gift: ["gift"], "npc-trade": ["gift"],
  outbreak: ["rare"], "tera-raid": ["rare"],
};
const EXTRA_ORDER = ["walk", "fixed", "static", "gift", "npc-trade", "outbreak", "tera-raid"];
// Total slot rate (%) at or under which an encounter counts as rare.
const RARE_RATE = 5;
// shortcut: these babies need a held incense to hatch; skipped from breeding until incense availability is modelled.
const INCENSE_BABIES = new Set([298, 360, 406, 433, 438, 439, 440, 446, 458]);
const NO_EGGS_GROUP = "15";
const REGIONAL_SUFFIX = /-(alola|galar|hisui|paldea)$/;

const t = Object.fromEntries(
  await Promise.all(
    [
      "versions", "version_groups", "version_names", "pokedexes", "pokedex_version_groups",
      "pokemon_dex_numbers", "encounters", "encounter_slots", "encounter_methods",
      "encounter_condition_values", "encounter_condition_value_map", "location_areas",
      "locations", "location_names", "pokemon", "pokemon_species", "pokemon_species_names",
      "pokemon_forms", "pokemon_form_names", "pokemon_evolution", "evolution_triggers",
      "pokemon_types", "pokemon_types_past", "types", "type_names", "pokemon_egg_groups",
      "items", "item_names", "abilities", "ability_names",
    ].map(async (n) => [n, await loadCsv(n)]),
  ),
);

const byId = (rows, key = "id") => new Map(rows.map((r) => [r[key], r]));
const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    const k = r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};

const versions = byId(t.versions);
const versionGroups = byId(t.version_groups);
const slots = byId(t.encounter_slots);
const methods = byId(t.encounter_methods);
const conditionValues = byId(t.encounter_condition_values);
const conditionsByEncounter = groupBy(t.encounter_condition_value_map, "encounter_id");
const areas = byId(t.location_areas);
const locations = byId(t.locations);
const pokemon = byId(t.pokemon);
const species = byId(t.pokemon_species);
const triggers = byId(t.evolution_triggers);
const items = byId(t.items);
const typeIds = byId(t.types);
const eggGroups = groupBy(t.pokemon_egg_groups, "species_id");
const pokemonBySpecies = groupBy(t.pokemon, "species_id");
const evolutionsBySpecies = groupBy(t.pokemon_evolution, "evolved_species_id");
const typesByPokemon = groupBy(t.pokemon_types, "pokemon_id");
const pastTypesByPokemon = groupBy(t.pokemon_types_past, "pokemon_id");
// PKHeX writes typographic apostrophes ("Oni’s Maw"), PokeAPI straight ones.
const placeKey = (name) => name.replaceAll("’", "'");
// English location name -> id. Names repeat across regions ("Pokémon League"): the newest location wins,
// which is the right one for the only games using this (Scarlet/Violet).
const locationByName = new Map(
  t.location_names
    .filter((r) => r.local_language_id === String(LANG.en))
    .sort((a, b) => a.location_id - b.location_id)
    .map((r) => [placeKey(r.name), r.location_id]),
);

const defaultPokemon = (speciesId) =>
  pokemonBySpecies.get(speciesId)?.find((p) => p.is_default === "1");

// Alolan Sandshrew evolves into Alolan Sandslash: keep the regional suffix across evolution and breeding.
function relatedPokemon(fromPokemonId, toSpeciesId) {
  const suffix = pokemon.get(fromPokemonId)?.identifier.match(REGIONAL_SUFFIX)?.[0];
  const candidates = pokemonBySpecies.get(toSpeciesId) ?? [];
  return (
    (suffix && candidates.find((p) => p.identifier.endsWith(suffix))) ||
    defaultPokemon(toSpeciesId)
  );
}

// Types as of a generation: pokemon_types_past rows hold the types up to (and including) their generation.
function eraTypes(pokemonId, gen) {
  const past = (pastTypesByPokemon.get(pokemonId) ?? []).filter((r) => Number(r.generation_id) >= gen);
  const rows = past.length
    ? past.filter((r) => r.generation_id === past.map((p) => p.generation_id).sort((a, b) => a - b)[0])
    : typesByPokemon.get(pokemonId) ?? [];
  return rows
    .sort((a, b) => a.slot - b.slot)
    .map((r) => typeIds.get(r.type_id).identifier);
}

function loadExtraEncounters(vg) {
  const file = new URL(`data/encounters/${vg}.json`, ROOT);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).encounters : [];
}

function loadProgression(vg) {
  const file = new URL(`data/progression/${vg}.json`, ROOT);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

function buildGame(vgIdentifier) {
  const vgIds = [...versionGroups.values()]
    .filter((g) => g.identifier === vgIdentifier || DLC[g.identifier] === vgIdentifier)
    .map((g) => g.id);
  const base = [...versionGroups.values()].find((g) => g.identifier === vgIdentifier);
  const gen = Number(base.generation_id);
  const gameVersions = [...versions.values()]
    .filter((v) => v.version_group_id === base.id)
    .map((v) => v.identifier);
  const progression = loadProgression(vgIdentifier);
  const lastStep = progression ? progression.steps.length - 1 : 0;
  const postgame = progression?.postgame ?? lastStep;
  const warnings = new Set();

  const stepOf = (table, key, what) => {
    if (!progression) return 0;
    const step = progression[table]?.[key];
    if (step !== undefined) return step;
    warnings.add(`${what} ${key}`);
    return postgame; // unknown: conservative, never shown as available too early
  };
  const locationStep = (locationId, areaIdentifier) => {
    const loc = locations.get(locationId).identifier;
    const key = areaIdentifier ? `${loc}/${areaIdentifier}` : loc;
    if (progression?.areas?.[key] !== undefined) return progression.areas[key];
    return stepOf("locations", loc, "location");
  };

  // First step whose level cap reaches `level` (battle levels rise with each badge).
  const levelStep = (level) => {
    if (!progression?.levelCap) return 0;
    const i = progression.levelCap.findIndex((cap) => cap >= level);
    return i === -1 ? postgame : i;
  };

  // pokemonId -> Map(sourceKey -> source)
  const sources = new Map();
  const addSource = (pokemonId, src) => {
    if (!sources.has(pokemonId)) sources.set(pokemonId, new Map());
    const key = `${src.v.join("+")}|${[...src.f].sort().join("+")}|${src.from ?? ""}`;
    const prev = sources.get(pokemonId).get(key);
    if (!prev || src.s < prev.s) sources.get(pokemonId).set(key, src);
  };

  // 1. Encounters, grouped per (version, area, method, pokemon, conditions) to sum slot rates.
  const groups = new Map();
  for (const e of t.encounters) {
    const version = versions.get(e.version_id);
    if (!vgIds.includes(version.version_group_id)) continue;
    const slot = slots.get(e.encounter_slot_id);
    const method = methods.get(slot.encounter_method_id).identifier;
    if (EXTERNAL_METHODS.has(method)) continue;
    const conds = (conditionsByEncounter.get(e.id) ?? [])
      .map((c) => conditionValues.get(c.encounter_condition_value_id))
      .filter((c) => c.is_default !== "1")
      .map((c) => c.identifier)
      .sort();
    if (conds.some((c) => EXTERNAL_CONDITIONS.some((re) => re.test(c)))) continue;
    const key = [version.identifier, e.location_area_id, method, e.pokemon_id, conds.join("+")].join("|");
    const g = groups.get(key) ?? { e, version: DLC_VERSION(version.identifier), method, conds, rate: 0 };
    g.rate += Number(slot.rarity || 0);
    groups.set(key, g);
  }

  for (const { e, version, method, conds, rate } of groups.values()) {
    const area = areas.get(e.location_area_id);
    const f = new Set();
    if (STATIC_METHODS.has(method)) f.add("static");
    if (GIFT_METHODS.has(method)) f.add("gift");
    const rateKnown = !STATIC_METHODS.has(method) && !GIFT_METHODS.has(method);
    if (
      RARE_METHODS.has(method) ||
      conds.some((c) => RARE_CONDITIONS.some((re) => re.test(c))) ||
      (rateKnown && rate > 0 && rate <= RARE_RATE)
    )
      f.add("rare");
    if (conds.some((c) => POSTGAME_CONDITIONS.has(c))) f.add("postgame");
    const step = Math.max(
      locationStep(area.location_id, area.identifier),
      progression?.methods?.[method] ?? 0,
      ...conds
        .filter((c) => !/^(time|weather|season|weekday)-/.test(c) && !RARE_CONDITIONS.some((re) => re.test(c)))
        .map((c) => (POSTGAME_CONDITIONS.has(c) ? postgame : stepOf("conditions", c, "condition"))),
    );
    // r: chance (%) of this encounter slot, when the method has one (gifts and statics do not).
    addSource(e.pokemon_id, {
      v: [version],
      f,
      s: step,
      l: Number(area.location_id),
      m: method,
      r: rateKnown ? rate : undefined,
    });
  }

  // 1b. Encounters PokeAPI lacks (Scarlet/Violet), from data/encounters/. No slot rates there.
  // Open world: an encounter's step comes from its level, not its place.
  const extra = loadExtraEncounters(vgIdentifier).toSorted(
    (a, b) => EXTRA_ORDER.indexOf(a.m) - EXTRA_ORDER.indexOf(b.m),
  );
  for (const e of extra) {
    const l = e.loc && locationByName.get(placeKey(e.loc));
    // No PokeAPI location yet (Area Zero Underdepths, Terarium…): the source just has no place name.
    if (e.loc && !l) warnings.add(`location name ${e.loc}`);
    addSource(String(e.id), {
      v: e.v,
      f: new Set(EXTRA_FLAGS[e.m] ?? []),
      s: levelStep(e.lv),
      l: l ? Number(l) : undefined,
      m: e.m,
    });
  }

  // 2. Manual corrections (note de cadrage 4: "overrides").
  for (const o of progression?.overrides ?? []) {
    const p = defaultPokemon(String(o.species));
    addSource(p.id, { v: o.versions ?? gameVersions, f: new Set(o.flags ?? []), s: o.step, note: o.note });
  }

  // Event-only species PokeAPI lists as normal encounters (note de cadrage 2.1, "Hors du jeu seul").
  const excluded = new Set((progression?.exclude ?? []).map(String));
  const isExcluded = (pokemonId) => excluded.has(pokemon.get(String(pokemonId))?.species_id);
  // Deleting the current key while iterating a Map is safe.
  for (const pokemonId of sources.keys()) if (isExcluded(pokemonId)) sources.delete(pokemonId);

  // 3. Evolutions and breeding, propagated until nothing changes (chains are at most 3 long).
  const gameRegions = new Set([...groups.values()].map((g) => locations.get(areas.get(g.e.location_area_id).location_id).region_id));
  for (const e of extra) {
    const l = e.loc && locationByName.get(placeKey(e.loc));
    if (l) gameRegions.add(locations.get(l).region_id);
  }
  for (let pass = 0; pass < 4; pass++) {
    // Snapshot: addSource grows `sources` while we iterate; new entries are handled next pass.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const [pokemonId, srcs] of [...sources]) {
      const p = pokemon.get(pokemonId);
      const sp = species.get(p.species_id);
      // Evolutions of this species.
      for (const [childSpeciesId, rows] of evolutionsBySpecies) {
        const child = species.get(childSpeciesId);
        if (child.evolves_from_species_id !== sp.id || Number(child.generation_id) > gen) continue;
        for (const row of rows) {
          const rowGen = Number(versionGroups.get(row.version_group_id)?.generation_id ?? 0);
          if (rowGen > gen) continue;
          if (row.location_id && !gameRegions.has(locations.get(row.location_id)?.region_id)) continue;
          const trigger = triggers.get(row.evolution_trigger_id).identifier;
          const item = row.trigger_item_id || row.held_item_id;
          // A progression file maps an item to null when it doesn't exist in that game.
          if (item && progression?.items?.[items.get(item).identifier] === null) continue;
          const needs = Math.max(
            row.minimum_level ? levelStep(Number(row.minimum_level)) : 0,
            item ? stepOf("items", items.get(item).identifier, "item") : 0,
            row.location_id ? locationStep(row.location_id, "") : 0,
          );
          const childPokemon = relatedPokemon(pokemonId, childSpeciesId);
          if (!childPokemon) continue;
          for (const src of srcs.values()) {
            const f = new Set(src.f);
            if (trigger === "trade") f.add("trade");
            // c: the condition behind the evolution, for the "why this step" tooltip.
            const c = {
              lv: row.minimum_level ? Number(row.minimum_level) : undefined,
              item: item ? items.get(item).identifier : undefined,
              trigger,
            };
            addSource(childPokemon.id, {
              v: src.v,
              f,
              s: Math.max(src.s, needs),
              from: Number(pokemonId),
              c,
            });
          }
        }
      }
      // Breeding gives the pre-evolution.
      const daycare = progression ? progression.daycare : 0;
      const canBreed = gen >= 2 && daycare !== undefined && !(eggGroups.get(sp.id) ?? []).some((g) => g.egg_group_id === NO_EGGS_GROUP);
      const parentSpeciesId = sp.evolves_from_species_id;
      if (canBreed && parentSpeciesId && !INCENSE_BABIES.has(Number(parentSpeciesId))) {
        const baby = relatedPokemon(pokemonId, parentSpeciesId);
        for (const src of srcs.values()) {
          addSource(baby.id, { v: src.v, f: new Set(src.f), s: Math.max(src.s, daycare), from: Number(pokemonId), m: "breed" });
        }
      }
    }
  }

  // 4. Regional dex number, for sorting.
  const dexIds = t.pokedex_version_groups.filter((d) => d.version_group_id === base.id).map((d) => d.pokedex_id);
  const dexNumber = new Map(
    t.pokemon_dex_numbers
      .filter((d) => d.pokedex_id === dexIds[0])
      .map((d) => [d.species_id, Number(d.pokedex_number)]),
  );

  const entries = [...sources]
    .filter(([pokemonId]) => !isExcluded(pokemonId))
    .map(([pokemonId, srcs]) => {
      const p = pokemon.get(pokemonId);
      return {
        id: Number(pokemonId),
        species: Number(p.species_id),
        dex: dexNumber.get(p.species_id) ?? null,
        types: eraTypes(pokemonId, gen),
        sources: [...srcs.values()]
          .map((s) => {
            const f = [...s.f];
            if (progression && s.s >= postgame && !f.includes("postgame")) f.push("postgame");
            return { ...s, f: f.sort() };
          })
          .sort((a, b) => a.s - b.s),
      };
    })
    .sort((a, b) => (a.dex ?? 9999) - (b.dex ?? 9999) || a.species - b.species || a.id - b.id);

  // For --check: which locations have several areas, and which methods appear.
  const areasByLocation = {};
  for (const g of groups.values()) {
    const area = areas.get(g.e.location_area_id);
    const loc = locations.get(area.location_id).identifier;
    (areasByLocation[loc] ??= new Set()).add(area.identifier || "(whole location)");
  }
  const usedMethods = [...new Set([...groups.values()].map((g) => g.method))].sort();

  return {
    areasByLocation,
    usedMethods,
    game: {
      versionGroup: vgIdentifier,
      generation: gen,
      versions: gameVersions,
      progression: !!progression,
      steps: progression?.steps ?? [{ en: "Any time", fr: "À tout moment" }],
      postgame,
      starters: progression?.starters ?? [],
      pokemon: entries,
    },
    warnings: [...warnings].sort(),
  };
}

// --check: report one game's unmapped keys and exit, so several people (or agents) can work in parallel.
const checkIndex = process.argv.indexOf("--check");
if (checkIndex !== -1) {
  const vg = process.argv[checkIndex + 1];
  if (!GAMES.includes(vg)) throw new Error(`--check expects one of: ${GAMES.join(", ")}`);
  const { game, warnings, areasByLocation, usedMethods } = buildGame(vg);
  console.log(`methods: ${usedMethods.join(" ")}`);
  console.log("locations with several areas (map them under \"areas\" as location/area when they unlock at different steps):");
  for (const [loc, set] of Object.entries(areasByLocation)) {
    if (set.size > 1) console.log(`  ${loc}: ${[...set].join(" | ")}`);
  }
  console.log(
    `${vg}: ${game.pokemon.length} pokemon, ` +
      (game.progression ? `${warnings.length} unmapped` : "no progression file yet"),
  );
  if (warnings.length) console.log(`unmapped (shown at post-game):\n  ${warnings.join("\n  ")}`);
  process.exit(0);
}

mkdirSync(OUT_GAMES, { recursive: true });
mkdirSync(OUT_NAMES, { recursive: true });
const usedLocations = new Set();
const index = [];
for (const vg of GAMES) {
  const { game, warnings } = buildGame(vg);
  index.push({ versionGroup: vg, generation: game.generation, versions: game.versions, progression: game.progression });
  for (const p of game.pokemon) for (const s of p.sources) if (s.l) usedLocations.add(String(s.l));
  writeFileSync(new URL(`${vg}.json`, OUT_GAMES), JSON.stringify(game));
  console.log(
    `${vg.padEnd(32)} ${String(game.pokemon.length).padStart(4)} pokemon` +
      (game.progression ? `, ${warnings.length} unmapped` : ", no progression file yet"),
  );
  if (warnings.length) console.log(`  unmapped (shown at post-game): ${warnings.join(", ")}`);
}

// Small index the "New team" dialog imports statically; the per-game files are loaded on demand.
writeFileSync(
  new URL("index.ts", OUT_GAMES),
  `// Generated by scripts/build-games.mjs. Do not edit.\n` +
    `export const GAMES = ${JSON.stringify(index, null, 2)} as const;\n`,
);

// Localised names, keyed by PokeAPI identifier (pokemon by id).
for (const [lang, langId] of Object.entries(LANG)) {
  const pick = (rows, key, nameKey = "name") =>
    new Map(rows.filter((r) => r.local_language_id === String(langId)).map((r) => [r[key], r[nameKey]]));
  const speciesNames = pick(t.pokemon_species_names, "pokemon_species_id");
  const formNames = pick(t.pokemon_form_names, "pokemon_form_id", "pokemon_name");
  const formOf = new Map(t.pokemon_forms.filter((f) => f.is_default === "1").map((f) => [f.pokemon_id, f.id]));
  const named = (rows, nameRows, key) => {
    const names = pick(nameRows, key);
    return Object.fromEntries(rows.map((r) => [r.identifier, names.get(r.id) ?? r.identifier]));
  };
  const locationNames = pick(t.location_names, "location_id");
  const out = {
    pokemon: Object.fromEntries(
      t.pokemon.map((p) => [p.id, formNames.get(formOf.get(p.id)) || speciesNames.get(p.species_id) || p.identifier]),
    ),
    types: named(t.types, t.type_names, "type_id"),
    versions: named(t.versions, t.version_names, "version_id"),
    locations: Object.fromEntries(
      [...usedLocations].map((id) => [id, locationNames.get(id) ?? locations.get(id).identifier]),
    ),
    abilities: named(t.abilities, t.ability_names, "ability_id"),
    items: named(t.items, t.item_names, "item_id"),
  };
  writeFileSync(new URL(`${lang}.json`, OUT_NAMES), JSON.stringify(out));
}
console.log(`names written (PokeAPI ${POKEAPI_REV.slice(0, 7)})`);
