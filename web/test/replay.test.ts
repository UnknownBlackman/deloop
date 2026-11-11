import { test } from "node:test";
import assert from "node:assert/strict";
import { replay } from "../src/backend.ts";
import data from "../src/replay-data.json" with { type: "json" };

test("replay: 35 owed, one loop clears 30, one leftover payment of 5", async () => {
  replay.reset!();
  const run = await replay.runAgent();
  assert.deepEqual(run.invoices.filter((i) => i.status === "flagged").map((i) => i.ref), ["INV-C2"]);

  let s = await replay.state();
  assert.deepEqual(s.debts.map((d) => [d.id, d.invoice_ref, d.status]), [
    [0, "INV-A1", "Proposed"], [1, "INV-B1", "Proposed"], [2, "INV-B2", "Proposed"], [3, "INV-C1", "Proposed"],
  ]);

  // only the debtor may confirm, with the contract's own message
  await assert.rejects(replay.confirm("bravo", 0), /Only the debtor can confirm/);
  const first = await replay.confirm("alpha", 0);
  assert.equal(first.url, data.record.confirm.url);
  for (const d of s.debts.slice(1)) await replay.confirm(d.debtorName, d.id);

  s = await replay.state();
  assert.equal(s.totals.outstandingNear, "35");
  assert.equal(s.afterClearing.totalNear, "5");
  assert.equal(s.afterClearing.paymentsNeeded, 1);

  const [loop] = await replay.clear("alpha");
  assert.deepEqual(loop.debtIds, [0, 1, 3]);
  assert.equal(loop.url, data.record.clear_cycle.url);

  await assert.rejects(replay.pay("alpha", 2), /Only the debtor can pay/);
  assert.equal((await replay.pay("bravo", 2)).url, data.record.pay_debt_2.url);

  s = await replay.state();
  assert.equal(s.totals.outstandingNear, "0");
  assert.ok(s.debts.every((d) => d.status === "Settled"));
});

test("replay start over empties the ledger", async () => {
  replay.reset!();
  assert.deepEqual((await replay.state()).debts, []);
});
