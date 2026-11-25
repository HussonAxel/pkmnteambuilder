// Run: node --test apps/web/src/lib/meta.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { ranked, roleShares, spreadRole, statDistribution } from "./meta.ts";

test("spreadRole reads what a spread is built for", () => {
  assert.equal(spreadRole("Jolly:0/252/4/0/0/252"), "fastPhysical");
  assert.equal(spreadRole("Timid:0/0/4/252/0/252"), "fastSpecial");
  assert.equal(spreadRole("Brave:252/252/4/0/0/0"), "trickRoom", "slow nature, no Speed");
  assert.equal(spreadRole("Adamant:252/252/4/0/0/0"), "bulkyPhysical");
  assert.equal(spreadRole("Bold:252/0/252/4/0/0"), "physicalWall");
  assert.equal(spreadRole("Calm:252/0/4/0/252/0"), "specialWall");
  assert.equal(spreadRole("Jolly:252/4/4/0/12/236"), "fastBulky");
  assert.equal(spreadRole("Careful:252/4/140/0/76/36"), "bulky");
  assert.equal(spreadRole("Serious:84/84/84/84/84/84"), "other");
});

test("roleShares normalises and sorts", () => {
  const shares = roleShares({
    "Jolly:0/252/4/0/0/252": 0.3,
    "Adamant:0/252/4/0/0/252": 0.1,
    "Bold:252/0/252/4/0/0": 0.1,
  });
  assert.equal(shares[0][0], "fastPhysical");
  assert.equal(Math.round(shares[0][1] * 100), 80);
  assert.equal(Math.round(shares[1][1] * 100), 20);
});

test("statDistribution weights EVs by share", () => {
  const evs = statDistribution({ "Jolly:0/252/4/0/0/252": 0.75, "Bold:252/0/252/4/0/0": 0.25 });
  assert.equal(evs.atk, 189);
  assert.equal(evs.hp, 63);
  assert.equal(evs.spe, 189);
});

test("ranked drops 'Nothing' and sorts", () => {
  assert.deepEqual(ranked({ Nothing: 0.5, Leftovers: 0.3, "Life Orb": 0.4 }), [
    ["Life Orb", 0.4],
    ["Leftovers", 0.3],
  ]);
});
