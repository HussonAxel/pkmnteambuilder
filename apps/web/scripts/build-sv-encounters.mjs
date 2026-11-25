// Scarlet/Violet encounters, which PokeAPI lacks: PKHeX's datamined tables (GPL-3.0) for what appears where,
// plus Bulbapedia's version-exclusive list (CC BY-NC-SA), because PKHeX merges both versions' wild tables.
// Regenerate: node apps/web/scripts/build-sv-encounters.mjs (then build-games.mjs, which reads the output)
// Out: data/encounters/scarlet-violet.json
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Dex } from "@pkmn/dex";
import { FORM_ARTWORK_IDS } from "../src/data/form-artwork-ids.ts";

// Pinned so builds are reproducible (note de cadrage, section 5).
const PKHEX_REV = "a5311f9f55a84376fd2e2499b25d9fb9640d9f2d";
const PKHEX = `https://raw.githubusercontent.com/kwsch/PKHeX/${PKHEX_REV}/PKHeX.Core`;
const BULBAPEDIA_PAGE = "Version-exclusive_Pokémon";
const OUT = new URL("../data/encounters/scarlet-violet.json", import.meta.url);
const CACHE = new URL(`../.cache/pkhex/${PKHEX_REV}/`, import.meta.url);
const BOTH = ["scarlet", "violet"];

async function fetchCached(name, url) {
  const file = new URL(name, CACHE);
  if (existsSync(file)) return readFileSync(file);
  const res = await fetch(url, { headers: { "User-Agent": "pkmnteambuilder-data-script" } });
  assert.ok(res.ok, `${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, buf);
  return buf;
}
const pkl = (name) =>
  fetchCached(`${name}.pkl`, `${PKHEX}/Resources/legality/wild/Gen9/encounter_${name}.pkl`);

// Met location id -> English name: line N of PKHeX's location text is location N.
const locationNames = (
  await fetchCached(
    "locations_en.txt",
    `${PKHEX}/Resources/text/locations/gen9/text_sv_00000_en.txt`,
  )
)
  .toString("utf8")
  .split(/\r?\n/);
const locationName = (id) => (id > 0 && locationNames[id]?.trim()) || undefined;

// (species, game form index) -> PokeAPI pokemon id. Showdown's formeOrder follows the games' form indices.
const baseByNum = new Map(
  Dex.forGen(9)
    .species.all()
    .filter((s) => s.exists && !s.forme)
    .map((s) => [s.num, s]),
);
function dexName(species, form) {
  const base = baseByNum.get(species);
  assert.ok(base, `unknown species ${species}`);
  // Forms past the list are PKHeX's "random form" markers: count them as the base form.
  return base.formeOrder?.[form] ?? base.name;
}
const pokemonId = (name) => FORM_ARTWORK_IDS[name] ?? Dex.species.get(name).num;

// --- Version exclusives (Bulbapedia): {{Vexscvi|0246|Larvitar|yes|no}}, {{Vexscvi|0128|Tauros|yes|no|form=-Paldea Blaze}}
const wikitext = JSON.parse(
  await fetchCached(
    "version-exclusives.json",
    `https://bulbapedia.bulbagarden.net/w/api.php?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(BULBAPEDIA_PAGE)}`,
  ),
).parse.wikitext["*"];
const exclusives = new Map();
for (const [, num, name, scarlet, violet, form] of wikitext.matchAll(
  /\{\{Vexscvi\|(\d+)\|([^|}]+)\|(yes|no)\|(yes|no)(?:\|form=([^|}]+))?\}\}/g,
)) {
  const key = form ? `${name}${form}`.replaceAll(" ", "-") : name;
  assert.ok(
    Dex.species.get(key).exists,
    `Bulbapedia exclusive ${key} (${num}) is not a known species`,
  );
  exclusives.set(key, scarlet === "yes" ? ["scarlet"] : ["violet"]);
}
assert.ok(exclusives.size > 60, `only ${exclusives.size} version exclusives parsed`);
// A form-less row covers the whole species; a form row only that form.
const versionsOf = (name) =>
  exclusives.get(name) ?? exclusives.get(Dex.species.get(name).baseSpecies) ?? BOTH;

const encounters = new Map();
function add({ species, form = 0, method, location, level, versions }) {
  const name = dexName(species, form);
  const e = {
    v: versions ?? versionsOf(name),
    id: pokemonId(name),
    m: method,
    loc: locationName(location),
    lv: level,
  };
  // One row per (pokemon, method, place, versions), at its lowest level.
  const key = [e.id, e.m, e.loc, e.v.join("+")].join("|");
  const prev = encounters.get(key);
  if (!prev || e.lv < prev.lv) encounters.set(key, e);
}

// --- Wild slots: BinLinker "sv" archive; each area is [location, _, crossFrom, _] then 8-byte slots.
{
  const data = await pkl("wild_paldea");
  assert.equal(data.toString("ascii", 0, 2), "sv");
  const count = data.readUInt16LE(2);
  for (let i = 0; i < count; i++) {
    const start = data.readUInt32LE(4 + i * 4);
    const end = data.readUInt32LE(8 + i * 4);
    const area = data.subarray(start, end);
    for (let o = 4; o + 8 <= area.length; o += 8) {
      add({
        species: area.readUInt16LE(o),
        form: area[o + 2],
        level: area[o + 4],
        method: "walk",
        location: area[0],
      });
    }
  }
}

// --- Fixed symbols (always in the same spot): 0x14 bytes, up to 4 locations at 0x10.
{
  const data = await pkl("fixed_paldea");
  for (let o = 0; o + 0x14 <= data.length; o += 0x14) {
    for (const location of data.subarray(o + 0x10, o + 0x14)) {
      if (location)
        add({
          species: data.readUInt16LE(o),
          form: data[o + 2],
          level: data[o + 3],
          method: "fixed",
          location,
        });
    }
  }
}

// --- Mass outbreaks: 0x1C bytes; location = base (0x0C) + index of each set bit in the 120 flag bits after it.
{
  const data = await pkl("outbreak_paldea");
  for (let o = 0; o + 0x1c <= data.length; o += 0x1c) {
    const base = data[o + 0x0c];
    let flags = 0n;
    for (let b = 0x1b; b > 0x0c; b--) flags = (flags << 8n) | BigInt(data[o + b]);
    for (let bit = 0; flags >> BigInt(bit); bit++) {
      if ((flags >> BigInt(bit)) & 1n)
        add({
          species: data.readUInt16LE(o),
          form: data[o + 2],
          level: data[o + 4],
          method: "outbreak",
          location: base + bit,
        });
    }
  }
}

// --- Tera raids from crystals (offline): 0x18 bytes; per-version rate floors at 0x14/0x16 are -1 when absent.
// Distribution and 7★ "might" raids are online events: left out (note de cadrage 2.1, "Hors du jeu seul").
for (const map of ["gem_paldea", "gem_kitakami", "gem_blueberry"]) {
  const data = await pkl(map);
  for (let o = 0; o + 0x18 <= data.length; o += 0x18) {
    const versions = [
      data.readInt16LE(o + 0x14) !== -1 && "scarlet",
      data.readInt16LE(o + 0x16) !== -1 && "violet",
    ].filter(Boolean);
    if (versions.length)
      add({
        species: data.readUInt16LE(o),
        form: data[o + 2],
        level: data[o + 7],
        method: "tera-raid",
        versions,
      });
  }
}

// --- Gifts, legendaries and in-game trades are C# literals in Encounters9.cs.
{
  const source = (
    await fetchCached("Encounters9.cs", `${PKHEX}/Legality/Encounters/Data/Gen9/Encounters9.cs`)
  ).toString("utf8");
  const statics = source.slice(source.indexOf("Encounter_SV ="), source.indexOf("TradeNames ="));
  const VERSION = { SV: undefined, SL: ["scarlet"], VL: ["violet"] };
  const field = (body, name) => body.match(new RegExp(`\\b${name} = (\\d+)`))?.[1];
  let n = 0;
  for (const [, version, body] of statics.matchAll(/new\((SV|SL|VL)\) \{([^}]*)\}/g)) {
    add({
      species: Number(field(body, "Species")),
      form: Number(field(body, "Form") ?? 0),
      level: Number(field(body, "Level")),
      // A fixed Poké Ball means the game hands it over (starters, Koraidon/Miraidon, eggs).
      method: /FixedBall = Ball\.Poke\b/.test(body) ? "gift" : "static",
      location: Number(field(body, "Location") ?? 0),
      versions: VERSION[version],
    });
    n++;
  }
  assert.ok(n > 50, `only ${n} static encounters parsed`);
  const trades = source.slice(source.indexOf("TradeGift_SV ="));
  for (const [, version, species, level, rest] of trades.matchAll(
    /new\(TradeNames, \d+, (SV|SL|VL), (\d+), (\d+)\) \{([^}]*)\}/g,
  )) {
    add({
      species: Number(species),
      form: Number(field(rest, "Form") ?? 0),
      level: Number(level),
      method: "npc-trade",
      versions: VERSION[version],
    });
  }
}

const rows = [...encounters.values()].sort(
  (a, b) => a.id - b.id || a.lv - b.lv || a.m.localeCompare(b.m),
);
mkdirSync(new URL(".", OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      source: `PKHeX ${PKHEX_REV} (GPL-3.0); version exclusives: Bulbapedia "${BULBAPEDIA_PAGE}" (CC BY-NC-SA 2.5)`,
      encounters: rows,
    },
    null,
    0,
  ).replaceAll('},{"v"', '},\n{"v"')}\n`,
);
const byMethod = Object.groupBy(rows, (r) => r.m);
console.log(
  `${rows.length} encounters, ${new Set(rows.map((r) => r.id)).size} pokemon: ` +
    Object.entries(byMethod)
      .map(([m, r]) => `${m} ${r.length}`)
      .join(", "),
);
const unnamed = rows.filter(
  (r) => r.loc === undefined && !["tera-raid", "npc-trade"].includes(r.m),
);
if (unnamed.length)
  console.log(
    `no location name: ${unnamed.length} rows (e.g. ${unnamed
      .slice(0, 3)
      .map((r) => `${r.id}/${r.m}`)
      .join(", ")})`,
  );
