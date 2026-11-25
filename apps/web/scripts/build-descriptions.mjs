// French descriptions of moves, abilities and items, for the info popovers (DexTip, AbilityTip).
// @pkmn/dex only has English texts; PokeAPI's in-game flavor texts have French ones.
// Regenerate: node apps/web/scripts/build-descriptions.mjs
// Out: src/data/descriptions/fr.json, keyed by PokeAPI identifier (see toIdentifier in src/lib/i18n.tsx),
// and src/data/places/fr.json: English place name -> French, for the Bulbapedia texts of where to find
// items and TMs (src/data/item-sources, tm-sources: build them first).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { LANG, POKEAPI_REV, loadCsv } from "./lib/pokeapi.mjs";

const OUT = new URL("../src/data/descriptions/", import.meta.url);
const OUT_PLACES = new URL("../src/data/places/", import.meta.url);
const SOURCES = ["item-sources", "tm-sources"].map(
  (d) => new URL(`../src/data/${d}/`, import.meta.url),
);

// Placeholders: moves cut from Scarlet/Violet ("can't be used, forget it"), unused items.
const PLACEHOLDER = /ne peut pas être utilisée|\[VAR\]|^N\/A$/;

// The newest game's real text for each entry, on one line (the games wrap and hyphenate it).
function latest(rows, idKey, identifiers) {
  const best = new Map();
  for (const r of rows) {
    if (r.language_id !== String(LANG.fr) || PLACEHOLDER.test(r.flavor_text)) continue;
    const vg = Number(r.version_group_id);
    if ((best.get(r[idKey])?.vg ?? -1) < vg) best.set(r[idKey], { vg, text: r.flavor_text });
  }
  const clean = (text) =>
    text.replaceAll("\u00ad", "").replace(/-\n/g, "").replace(/\s+/g, " ").trim();
  // A text shared by many entries (TM materials, Wishing Pieces, candies…) says nothing specific: dropped.
  const uses = new Map();
  for (const { text } of best.values()) uses.set(clean(text), (uses.get(clean(text)) ?? 0) + 1);
  const out = {};
  for (const [id, { text }] of best) {
    const key = identifiers.get(id);
    if (key && uses.get(clean(text)) <= 3) out[key] = clean(text);
  }
  return out;
}

const [moves, moveTexts, abilities, abilityTexts, items, itemTexts, locationNames] =
  await Promise.all(
    [
      "moves",
      "move_flavor_text",
      "abilities",
      "ability_flavor_text",
      "items",
      "item_flavor_text",
      "location_names",
    ].map(loadCsv),
  );
const ids = (rows) => new Map(rows.map((r) => [r.id, r.identifier]));
const out = {
  moves: latest(moveTexts, "move_id", ids(moves)),
  abilities: latest(abilityTexts, "ability_id", ids(abilities)),
  items: latest(itemTexts, "item_id", ids(items)),
};
mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("fr.json", OUT), JSON.stringify(out));
console.log(
  `descriptions written (PokeAPI ${POKEAPI_REV.slice(0, 7)}):`,
  Object.entries(out)
    .map(([k, v]) => `${Object.keys(v).length} ${k}`)
    .join(", "),
);

// Place names: every PokeAPI location whose English name appears in the item / TM source texts.
const sourceText = SOURCES.flatMap((dir) =>
  readdirSync(dir).map((f) => readFileSync(new URL(f, dir), "utf8")),
)
  .join("\n")
  .replaceAll("’", "'");
const byLang = (lang) =>
  new Map(
    locationNames
      .filter((r) => r.local_language_id === String(LANG[lang]))
      .map((r) => [r.location_id, r.name.replaceAll("’", "'")]),
  );
const [en, fr] = [byLang("en"), byLang("fr")];
const places = {};
for (const [id, name] of en) {
  const french = fr.get(id);
  if (name.length >= 4 && french && french !== name && sourceText.includes(name))
    places[name] = french;
}
mkdirSync(OUT_PLACES, { recursive: true });
writeFileSync(new URL("fr.json", OUT_PLACES), JSON.stringify(places));
console.log(`places written: ${Object.keys(places).length}`);
