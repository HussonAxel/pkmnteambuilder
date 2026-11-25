// Run: node --test apps/web/src/lib/share.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeTeam, encodeTeam } from "./share.ts";

const team = {
  name: "Reg F Goodstuffs",
  mode: "vgc",
  format: "gen9vgc2026regf",
  pokemon: [
    {
      pokeapiId: 727,
      name: "Incineroar",
      item: "Safety Goggles",
      ability: "Intimidate",
      types: ["Fire", "Dark"],
      teraType: "Ghost",
      moves: ["Fake Out", "Knock Off", "Flare Blitz", "Parting Shot"],
      nature: "Careful",
      evs: { hp: 252, atk: 4, def: 0, spa: 0, spd: 252, spe: 0 },
      inTeam: true,
    },
  ],
};

test("a team survives the round trip through a link", async () => {
  const code = await encodeTeam(team);
  assert.match(code, /^[\w-]+$/, "URL-safe");
  assert.deepEqual(await decodeTeam(code), { v: 1, ...team });
});

test("decodeTeam rejects damaged or forged links", async () => {
  await assert.rejects(decodeTeam("not-a-team"));
  const forged = await encodeTeam({ ...team, mode: "hacked" });
  await assert.rejects(decodeTeam(forged), "unknown mode");
  const bigEvs = await encodeTeam({
    ...team,
    pokemon: [{ ...team.pokemon[0], evs: { ...team.pokemon[0].evs, hp: 999 } }],
  });
  await assert.rejects(decodeTeam(bigEvs), "EVs out of range");
});
