// Run: node --test apps/web/src/lib/starters.test.mjs (Node strips the .ts types natively).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { blockedStarters, familyRoot } from "./starters.ts";

const dp = JSON.parse(
  readFileSync(new URL("../data/games/diamond-pearl.json", import.meta.url), "utf8"),
);

test("evolutions climb back to their first stage", () => {
  assert.equal(familyRoot(dp, 389), 387); // Torterra -> Turtwig
  assert.equal(familyRoot(dp, 387), 387);
});

test("owning one starter family blocks the other two, whole families included", () => {
  assert.equal(blockedStarters(dp, [25]).size, 0); // no starter owned yet
  const blocked = blockedStarters(dp, [388]); // Grotle
  assert.ok(blocked.has(390) && blocked.has(392)); // Chimchar, Infernape
  assert.ok(blocked.has(393) && blocked.has(395)); // Piplup, Empoleon
  assert.ok(!blocked.has(387) && !blocked.has(389)); // its own family stays
});
