import { test } from "node:test";
import assert from "node:assert/strict";
import { planClearings, simpleCycles, type DebtEdge } from "../src/cycles.ts";
import { nearToYocto as N, yoctoToNear } from "../src/amount.ts";

const e = (id: number, debtor: string, creditor: string, near: string): DebtEdge => ({
  id,
  debtor,
  creditor,
  outstanding: N(near),
});

const SEED = [
  e(0, "alpha", "bravo", "10"),
  e(1, "bravo", "charlie", "10"),
  e(2, "charlie", "alpha", "10"),
  e(3, "delta", "alpha", "5"),
  e(4, "bravo", "delta", "5"),
];

test("seed: clears alpha->bravo->charlie by 10, leaves 10 NEAR in 2 debts", () => {
  const { clearings, remaining } = planClearings(SEED);
  assert.equal(clearings.length, 1);
  assert.deepEqual(clearings[0], { debtIds: [0, 1, 2], amount: N("10"), ring: ["alpha", "bravo", "charlie"] });
  assert.deepEqual(remaining.map((d) => d.id), [3, 4]);
  assert.equal(yoctoToNear(remaining.reduce((s, d) => s + d.outstanding, 0n)), "10");
});

test("seed has two simple cycles; the higher-value one wins", () => {
  const ids = simpleCycles(SEED).map((c) => c.map((x) => x.id).sort());
  assert.deepEqual(ids.sort(), [[0, 1, 2], [0, 3, 4]].sort());
});

test("no cycle -> nothing cleared, input untouched", () => {
  const chain = [e(1, "a", "b", "3"), e(2, "b", "c", "3")];
  const { clearings, remaining } = planClearings(chain);
  assert.deepEqual(clearings, []);
  assert.deepEqual(remaining, chain);
  assert.notEqual(remaining[0], chain[0]);
});

test("2-cycle clears the smaller side", () => {
  const { clearings, remaining } = planClearings([e(7, "a", "b", "4"), e(8, "b", "a", "1.5")]);
  assert.deepEqual(clearings, [{ debtIds: [7, 8], amount: N("1.5"), ring: ["a", "b"] }]);
  assert.deepEqual(remaining, [e(7, "a", "b", "2.5")]);
});

test("tie on value -> smaller sorted id list wins", () => {
  // Two disjoint 2-cycles, both clear 2 x 1 = 2 NEAR.
  const debts = [e(5, "c", "d", "1"), e(6, "d", "c", "1"), e(1, "a", "b", "1"), e(9, "b", "a", "1")];
  const { clearings } = planClearings(debts);
  assert.deepEqual(clearings.map((c) => c.debtIds), [[1, 9], [5, 6]]);
});

test("longer cycle beats a shorter one with equal min (value = min x length)", () => {
  const debts = [e(1, "a", "b", "5"), e(2, "b", "a", "5"), e(3, "b", "c", "5"), e(4, "c", "a", "5")];
  const { clearings } = planClearings(debts);
  assert.deepEqual(clearings[0].debtIds, [1, 3, 4]);
});

test("parallel debts between the same pair are separate cycles", () => {
  const debts = [e(1, "a", "b", "2"), e(2, "a", "b", "3"), e(3, "b", "a", "10")];
  const { clearings, remaining } = planClearings(debts);
  assert.deepEqual(clearings.map((c) => [c.debtIds, yoctoToNear(c.amount)]), [
    [[2, 3], "3"],
    [[1, 3], "2"],
  ]);
  assert.deepEqual(remaining, [e(3, "b", "a", "5")]);
});

test("deterministic regardless of input order", () => {
  const shuffled = [SEED[3], SEED[1], SEED[4], SEED[0], SEED[2]];
  assert.deepEqual(planClearings(shuffled), planClearings(SEED));
});

test("zero-outstanding debts are ignored", () => {
  const { clearings } = planClearings([e(1, "a", "b", "0"), e(2, "b", "a", "1")]);
  assert.deepEqual(clearings, []);
});
