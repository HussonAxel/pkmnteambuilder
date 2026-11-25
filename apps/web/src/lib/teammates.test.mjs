// Run: node --test apps/web/src/lib/teammates.test.mjs (Node strips the .ts types natively).
import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestTeammates } from "./teammates.ts";

const teammates = {
  Chansey: { Gholdengo: 0.5, "Great Tusk": 0.38, Corviknight: 0.12 },
  Gholdengo: { "Great Tusk": 0.4, Chansey: 0.1, Kingambit: 0.3 },
};

test("one member: its teammates, best first, with Smogon's shares", () => {
  assert.deepEqual(suggestTeammates(teammates, ["Chansey"]), [
    { name: "Gholdengo", share: 0.5 },
    { name: "Great Tusk", share: 0.38 },
    { name: "Corviknight", share: 0.12 },
  ]);
});

test("members are never suggested", () => {
  const names = suggestTeammates(teammates, ["Chansey", "Gholdengo"]).map((s) => s.name);
  assert.ok(!names.includes("Chansey") && !names.includes("Gholdengo"));
  assert.ok(names.includes("Great Tusk"));
});

test("several members: sorted by share", () => {
  const shares = suggestTeammates(teammates, ["Chansey", "Gholdengo"]).map((s) => s.share);
  assert.deepEqual(
    shares,
    [...shares].sort((a, b) => b - a),
  );
});

test("members without stats give no suggestions", () => {
  assert.deepEqual(suggestTeammates(teammates, ["Unown"]), []);
  assert.deepEqual(suggestTeammates(teammates, []), []);
});
