// Contract integration tests on a local NEAR sandbox (near-workspaces).
// Run: npm run test:sandbox  (Linux/macOS)  or  npm run test:sandbox:docker  (Windows)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Worker, NearAccount } from "near-workspaces";

const WASM = path.resolve("contract/res/deloop.wasm");
const NEAR = 10n ** 24n;
const y = (near: number) => BigInt(near) * NEAR; // bigint, for near-workspaces options
const n = (near: number) => y(near).toString(); // U128 JSON string, for contract args

let worker: Worker;
let root: NearAccount;
let a: NearAccount, b: NearAccount, c: NearAccount, stranger: NearAccount;

before(async () => {
  worker = await Worker.init();
  root = worker.rootAccount;
  a = await root.createSubAccount("alpha", { initialBalance: y(50) });
  b = await root.createSubAccount("bravo", { initialBalance: y(50) });
  c = await root.createSubAccount("charlie", { initialBalance: y(50) });
  stranger = await root.createSubAccount("stranger", { initialBalance: y(10) });
});

after(async () => {
  await worker?.tearDown();
});

type Debt = { id: number; debtor: string; creditor: string; amount: string; outstanding: string; status: string };

const fresh = () => root.devDeploy(WASM);

/** creditor proposes, debtor optionally confirms. Returns the id. */
async function debt(contract: NearAccount, debtor: NearAccount, creditor: NearAccount, near: number, ref: string, confirm = true) {
  const id = (await creditor.call(contract, "propose_debt", { debtor: debtor.accountId, amount: n(near), invoice_ref: ref })) as number;
  if (confirm) await debtor.call(contract, "confirm_debt", { id });
  return id;
}
const get = (contract: NearAccount, id: number) => contract.view("get_debt", { id }) as Promise<Debt>;

test("1. only the debtor can confirm", async () => {
  const k = await fresh();
  const id = await debt(k, a, b, 10, "INV-1", false);
  await assert.rejects(b.call(k, "confirm_debt", { id }), /Only the debtor can confirm/);
  await assert.rejects(stranger.call(k, "confirm_debt", { id }), /Only the debtor can confirm/);
  assert.equal((await get(k, id)).status, "Proposed");
  await a.call(k, "confirm_debt", { id });
  assert.equal((await get(k, id)).status, "Confirmed");
});

test("2. clear_cycle rejects a non-cycle, an unconfirmed debt, and amount > outstanding", async () => {
  const k = await fresh();
  const ab = await debt(k, a, b, 10, "AB");
  const bc = await debt(k, b, c, 10, "BC");
  await assert.rejects(stranger.call(k, "clear_cycle", { debt_ids: [ab, bc], amount: n(1) }), /do not form a cycle/);

  const caUnconfirmed = await debt(k, c, a, 10, "CA", false);
  await assert.rejects(
    stranger.call(k, "clear_cycle", { debt_ids: [ab, bc, caUnconfirmed], amount: n(1) }),
    /must be Confirmed/,
  );

  await c.call(k, "confirm_debt", { id: caUnconfirmed });
  await assert.rejects(
    stranger.call(k, "clear_cycle", { debt_ids: [ab, bc, caUnconfirmed], amount: n(11) }),
    /exceeds outstanding/,
  );
  await assert.rejects(
    stranger.call(k, "clear_cycle", { debt_ids: [ab, bc, caUnconfirmed, ab], amount: n(1) }),
    /repeated/,
  );
  for (const id of [ab, bc, caUnconfirmed]) assert.equal((await get(k, id)).outstanding, n(10));
});

test("3. a 3-debt cycle clears and each outstanding drops by the amount", async () => {
  const k = await fresh();
  const ids = [await debt(k, a, b, 10, "AB"), await debt(k, b, c, 12, "BC"), await debt(k, c, a, 15, "CA")];
  const res = await stranger.callRaw(k, "clear_cycle", { debt_ids: ids, amount: n(10) });
  assert.ok(res.succeeded);
  assert.ok(res.logs.some((l: string) => l.startsWith("EVENT_JSON:") && l.includes('"cycle_cleared"')));
  const after = await Promise.all(ids.map((id) => get(k, id)));
  assert.deepEqual(after.map((d) => d.outstanding), [n(0), n(2), n(5)]);
  assert.deepEqual(after.map((d) => d.status), ["Settled", "Confirmed", "Confirmed"]);
  const totals = (await k.view("get_totals")) as { outstanding_sum: string; count: number };
  assert.deepEqual(totals, { outstanding_sum: n(7), count: 2 });
});

test("4. pay_debt reduces outstanding and the creditor's balance goes up", async () => {
  const k = await fresh();
  const id = await debt(k, a, b, 10, "AB");
  const before = BigInt((await b.balance()).total.toString());
  const res = await a.callRaw(k, "pay_debt", { id }, { attachedDeposit: y(4), gas: 100_000_000_000_000n });
  assert.ok(res.succeeded);
  assert.ok(res.logs.some((l: string) => l.includes('"debt_paid"')));
  const after = BigInt((await b.balance()).total.toString());
  assert.equal(after - before, 4n * NEAR);
  assert.equal((await get(k, id)).outstanding, n(6));
});

test("5. pay_debt rejects overpayment and a caller who isn't the debtor", async () => {
  const k = await fresh();
  const id = await debt(k, a, b, 10, "AB");
  await assert.rejects(a.call(k, "pay_debt", { id }, { attachedDeposit: y(11) }), /exceeds outstanding/);
  await assert.rejects(stranger.call(k, "pay_debt", { id }, { attachedDeposit: y(1) }), /Only the debtor can pay/);
  assert.equal((await get(k, id)).outstanding, n(10));
});
