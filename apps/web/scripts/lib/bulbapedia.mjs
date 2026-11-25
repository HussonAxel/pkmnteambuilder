// Shared Bulbapedia helpers for the data scripts: cached wikitext fetch and wikitext -> plain text.
// Bulbapedia content is CC BY-NC-SA 2.5: generated files credit it.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const API =
  "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&format=json&prop=wikitext&redirects=1&page=";
const CACHE = new URL("../../.cache/bulbapedia/", import.meta.url);

// A page's wikitext (redirects followed: "TM99" -> "TM099"), or null when it doesn't exist.
export async function wikitext(page, dir = "pages") {
  const folder = new URL(`${dir}/`, CACHE);
  const file = new URL(`${encodeURIComponent(page)}.json`, folder);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const res = await fetch(API + encodeURIComponent(page), {
    headers: { "User-Agent": "pkmnteambuilder-data-script" },
  });
  assert.ok(res.ok, `${page}: HTTP ${res.status}`);
  const text = (await res.json()).parse?.wikitext?.["*"] ?? null;
  mkdirSync(folder, { recursive: true });
  writeFileSync(file, JSON.stringify(text));
  return text;
}

// Runs `task` over `items`, `limit` at a time: be gentle with Bulbapedia.
export async function eachLimited(items, limit, task) {
  for (let i = 0; i < items.length; i += limit)
    await Promise.all(items.slice(i, i + limit).map(task));
}

// Wikitext -> plain text. Templates: {{rt|12|Kalos}} -> Route 12, {{DL|page|text}} -> text, footnote
// marks ({{sup/…}}) dropped, anything else ({{wild|X}}, {{si|X}}, {{p|X}}, {{tt|X|hint}}…) -> X.
export function plain(cell) {
  let s = cell.replace(/\[\[File:[^\]]*\]\]/g, "");
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\{\{([^{}|]+)((?:\|[^{}]*)?)\}\}/g, (_, name, rest) => {
      const n = name.trim();
      const args = rest
        .split("|")
        .slice(1)
        .filter((a) => !/^\w+=/.test(a));
      if (/^sup\//i.test(n) || /^(sup|color|-)$/i.test(n)) return "";
      if (/^rt$/i.test(n)) return `Route ${args[0]}`;
      if (/^dl$/i.test(n)) return args.at(-1) ?? "";
      if (/^p?dollar$/i.test(n)) return "₽";
      return args[0] ?? "";
    });
  }
  return s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<hr\s*\/?>/gi, " / ")
    .replace(/<br\s*\/?>/gi, "; ")
    .replace(/<[^>]+>/g, "")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*;\s*$/, "")
    .replace(/^N\/A$/, "")
    .trim();
}

// Every call of a template in the text, with its parameters split on top-level "|" only (links and
// nested templates keep theirs): calls(text, "TMtable/row") -> [{ index, params: [...] }].
export function calls(text, name) {
  const out = [];
  const open = `{{${name}|`;
  for (let at = text.indexOf(open); at !== -1; at = text.indexOf(open, at + 1)) {
    const params = [];
    let depth = 0;
    let field = "";
    let i = at + open.length;
    for (; i < text.length; i++) {
      const two = text.slice(i, i + 2);
      if (two === "{{" || two === "[[") {
        depth++;
        field += two;
        i++;
      } else if ((two === "}}" || two === "]]") && depth > 0) {
        depth--;
        field += two;
        i++;
      } else if (two === "}}") break;
      else if (text[i] === "|" && depth === 0) {
        params.push(field);
        field = "";
      } else field += text[i];
    }
    params.push(field);
    out.push({ index: at, params });
  }
  return out;
}

// "{{gameabbrev9|SV}}{{gameabbrev9|ID}}" -> { gen: 9, games: "SV · ID" }; side games (gameabbrevss) -> null.
export function gamesOf(cell) {
  const games = [...cell.matchAll(/\{\{gameabbrev(\d)\|([^}|]+)\}\}/g)];
  return games.length
    ? { gen: Number(games[0][1]), games: games.map((g) => g[2]).join(" · ") }
    : null;
}

// Games of a generation that aren't where its competitive formats are played (gen 9 = Scarlet/Violet,
// gen 8 = Sword/Shield, gen 7 = Sun/Moon and Ultra): Legends Z-A, BDSP, Legends Arceus, Let's Go.
export const OTHER_GAMES = { 7: /^PE\b/, 8: /^(BDSP|BD|SP|LA)\b/, 9: /^ZA\b/ };
