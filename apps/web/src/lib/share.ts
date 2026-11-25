// Sharing a team: the whole team travels in the link itself (deflate + base64url in the URL hash),
// so it works without a server while teams aren't stored yet. Opening a link imports a copy.
// The payload comes from outside: decodeTeam validates it with Zod before anything uses it.
// Tested in share.test.mjs.
import { z } from "zod";

import { STATS } from "./sets.ts";

const statRecord = (max: number) =>
  z.object(
    Object.fromEntries(STATS.map((s) => [s, z.int().min(0).max(max)])) as Record<
      (typeof STATS)[number],
      z.ZodInt
    >,
  );

const TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
] as const;

const sharedPokemon = z.object({
  pokeapiId: z.int().positive().max(20000),
  name: z.string().min(1).max(60),
  item: z.string().max(60),
  ability: z.string().max(60),
  types: z.array(z.enum(TYPES)).min(1).max(2),
  teraType: z.enum([...TYPES, "Stellar"]).optional(),
  moves: z.array(z.string().max(60)).max(4),
  nature: z.string().max(20).optional(),
  evs: statRecord(252).optional(),
  ivs: statRecord(31).optional(),
  inTeam: z.boolean(),
});

export const sharedTeamSchema = z.object({
  v: z.literal(1),
  name: z.string().min(1).max(80),
  mode: z.enum(["smogon", "vgc", "adventure"]),
  format: z.string().min(1).max(60),
  rules: z.record(z.string().max(40), z.boolean()).optional(),
  // A party of 6 and a Box: generous, but bounded so a crafted link can't flood the page.
  pokemon: z.array(sharedPokemon).max(60),
});
export type SharedTeam = z.infer<typeof sharedTeamSchema>;

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeTeam(team: Omit<SharedTeam, "v">): Promise<string> {
  const json = JSON.stringify({ v: 1, ...team });
  return toBase64Url(
    await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw")),
  );
}

// Throws on anything that isn't a valid team link.
export async function decodeTeam(code: string): Promise<SharedTeam> {
  // Compressed links stay far below this; a longer one is not ours.
  if (code.length > 20000) throw new Error("Team link too long");
  const bytes = await pipe(fromBase64Url(code), new DecompressionStream("deflate-raw"));
  return sharedTeamSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
}

export const SHARE_PREFIX = "#team=";
