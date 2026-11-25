// Small WebP thumbnails of PokeAPI's official artwork, served from public/artwork/<id>.webp.
// The originals are 475px PNGs of ~100-130 KB shown at 48-96px; the thumbnails are a few KB and
// get a long cache from our own server instead of GitHub's 5-minute one.
// Covers every id the app can show: national dex numbers, competitive formes (FORM_ARTWORK_IDS)
// and the forms in the Adventure game files. Already generated files are skipped.
// Regenerate: node apps/web/scripts/build-artwork.mjs (after data:games)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const COMMIT = "c0542f7c51215d9672439012838c99f520596cbd"; // same pin as artwork() in the app
const SIZE = 192; // 96px tiles on 2x screens; 48px avatars downscale cleanly
const OUT = new URL("../public/artwork/", import.meta.url);
const DATA = new URL("../src/data/", import.meta.url);
const LAST_DEX = 1025;

const ids = new Set(Array.from({ length: LAST_DEX }, (_, i) => i + 1));
const forms = readFileSync(new URL("form-artwork-ids.ts", DATA), "utf8");
for (const [, id] of forms.matchAll(/:\s*(\d+)/g)) ids.add(Number(id));
for (const file of readdirSync(new URL("games/", DATA)).filter((f) => f.endsWith(".json")))
  for (const p of JSON.parse(readFileSync(new URL(`games/${file}`, DATA), "utf8")).pokemon)
    ids.add(p.id);

mkdirSync(OUT, { recursive: true });
const todo = [...ids].filter((id) => !existsSync(new URL(`${id}.webp`, OUT)));
const missing = [];
let done = 0;
async function worker() {
  for (let id = todo.pop(); id !== undefined; id = todo.pop()) {
    const res = await fetch(
      `https://raw.githubusercontent.com/PokeAPI/sprites/${COMMIT}/sprites/pokemon/other/official-artwork/${id}.png`,
    );
    if (!res.ok) {
      missing.push(id);
      continue;
    }
    const webp = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80, alphaQuality: 90 })
      .toBuffer();
    writeFileSync(new URL(`${id}.webp`, OUT), webp);
    if (++done % 100 === 0) console.log(`${done} done`);
  }
}
await Promise.all(Array.from({ length: 16 }, worker));
console.log(`${done} generated, ${ids.size - done - missing.length} already there`);
// Ids PokeAPI has no artwork for: the app falls back to the remote PNG (and then hides the image).
if (missing.length) console.log(`no artwork for: ${missing.sort((a, b) => a - b).join(", ")}`);
