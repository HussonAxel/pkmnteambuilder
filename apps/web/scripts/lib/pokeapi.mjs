// Shared PokeAPI CSV loader for the data scripts: pinned revision, local cache, quote-aware parser.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Pinned so builds are reproducible (note de cadrage, section 5).
export const POKEAPI_REV = "de6760be38b60a3024f1d9054330ff265f0dc619";
export const LANG = { fr: 5, en: 9 };

const CACHE = new URL(`../../.cache/pokeapi/${POKEAPI_REV}/`, import.meta.url);

// RFC 4180: quoted fields may hold commas, newlines and doubled quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows;
  return data
    .filter((r) => r.length > 1 || r[0] !== "")
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export async function loadCsv(name) {
  mkdirSync(CACHE, { recursive: true });
  const file = new URL(`${name}.csv`, CACHE);
  if (!existsSync(file)) {
    const url = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_REV}/data/v2/csv/${name}.csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return parseCsv(readFileSync(file, "utf8"));
}
