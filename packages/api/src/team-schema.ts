// What a saved team may hold: same bounds as a shared team link (apps/web/src/lib/share.ts), plus the
// ids the browser gave the team and its members. Everything here comes from a browser: never trusted.
import { z } from "zod";

const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
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

const pokemon = z.object({
  id: z.string().min(1).max(64),
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

export const teamId = z.uuid();

export const teamData = z.object({
  name: z.string().min(1).max(80),
  mode: z.enum(["smogon", "vgc", "adventure"]),
  format: z.string().min(1).max(60),
  rules: z.record(z.string().max(40), z.boolean()).optional(),
  pokemon: z.array(pokemon).max(60),
});
export type TeamData = z.infer<typeof teamData>;
