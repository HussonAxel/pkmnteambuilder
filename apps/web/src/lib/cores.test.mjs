// Run: node --test apps/web/src/lib/cores.test.mjs (Node strips the .ts types natively).
import assert from "node:assert/strict";
import { test } from "node:test";
import { likelyTrios, movers, topDuos } from "./cores.ts";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-4, `${a} ≠ ${b}`);

const stats = {
  usage: { Tusk: 0.4, Gholdengo: 0.3, Kingambit: 0.2, Clodsire: 0.1 },
  teammates: {
    Tusk: { Gholdengo: 0.5, Kingambit: 0.3 },
    Gholdengo: { Tusk: 0.6667, Kingambit: 0.4 },
    Kingambit: { Tusk: 0.6, Gholdengo: 0.6 },
    // Clodsire's list was cut before Tusk: Tusk's side still has nothing either, so no pair.
    Clodsire: { Kingambit: 0.5 },
  },
};

test("duos: share of all teams, each pair once, most used member first", () => {
  const duos = topDuos(stats);
  assert.deepEqual(duos[0].members, ["Tusk", "Gholdengo"]);
  close(duos[0].share, 0.2);
  assert.equal(
    new Set(duos.map((d) => [...d.members].sort().join("+"))).size,
    duos.length,
    "no duplicate pairs",
  );
  assert.deepEqual(
    duos.map((d) => d.members.join("+")),
    ["Tusk+Gholdengo", "Tusk+Kingambit", "Gholdengo+Kingambit", "Kingambit+Clodsire"],
  );
});

test("duos: the side that kept the pair wins over a truncated one", () => {
  const cut = { usage: { A: 0.5, B: 0.2 }, teammates: { A: {}, B: { A: 0.5 } } };
  close(topDuos(cut)[0].share, 0.1);
});

test("trios: only thirds paired with both, sorted by estimate", () => {
  const trios = likelyTrios(stats);
  assert.deepEqual(trios[0].members, ["Tusk", "Gholdengo", "Kingambit"]);
  assert.ok(trios.every((t) => t.members.length === 3 && new Set(t.members).size === 3));
  assert.ok(!trios.some((t) => t.members.includes("Clodsire")));
  assert.equal(trios.length, 1, "the same trio from different duos is listed once");
});

test("movers: rising and falling, small species ignored, missing reads as 0", () => {
  const now = { A: 0.3, B: 0.05, C: 0.002, D: 0.08 };
  const before = { A: 0.2, B: 0.1, C: 0.0001, E: 0.04 };
  const { rising, falling } = movers(now, before);
  assert.deepEqual(
    rising.map((m) => m.name),
    ["A", "D"],
  );
  assert.deepEqual(
    falling.map((m) => m.name),
    ["B", "E"],
  );
  close(falling[1].change, -0.04);
});
