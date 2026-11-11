// npm run demo          fresh deloop deployment + agent seeds the sample invoices (debts left Proposed,
//                       so the web UI walks through confirm -> clear -> pay).
// npm run demo -- --full   also confirms, clears the cycle and pays the leftovers from this script,
//                          logging every tx hash to deployments/testnet.json.
import { business, businessId, call, getDebts, getTotals, logTx, masterId, nameOf } from "../agent/src/near.ts";
import { ensureBusinesses, freshDeploy, proposeMatched, runAgent, runClearing } from "../agent/src/flow.ts";
import { yoctoToNear } from "../agent/src/amount.ts";

const full = process.argv.includes("--full");
const log = (s: string) => console.log("  " + s);
const totals = async (label: string) => {
  const t = await getTotals();
  console.log(`\n>>> ${label}: ${yoctoToNear(t.outstanding_sum)} NEAR outstanding across ${t.count} confirmed debts`);
};

console.log("\n1. Fresh deployment");
await freshDeploy(log);
await ensureBusinesses(log);

console.log("\n2. Agent reads invoices and reconciles against payables ledgers");
const run = await runAgent();
for (const r of run.results) {
  const i = r.invoice;
  log(`${i.invoice_ref}  ${i.debtor} owes ${i.creditor} ${yoctoToNear(i.amount)} NEAR  ${r.status === "matched" ? "matched" : "FLAGGED: " + r.reason}`);
}
for (const u of run.unreadable) log(`${u.file} UNREADABLE: ${u.error}`);

console.log("\n3. Creditors propose matched debts on-chain");
for (const p of await proposeMatched(run.results)) log(`#${p.id} ${p.ref}  ${p.tx.url}`);

if (!full) {
  console.log("\nSeeded. Debts are Proposed; run `npm run dev` and confirm them in the UI.\n");
  process.exit(0);
}

console.log("\n4. Debtors confirm");
for (const d of await getDebts()) {
  const tx = await call(business(nameOf(d.debtor)), "confirm_debt", { id: d.id });
  log(`#${d.id} confirmed by ${nameOf(d.debtor)}  ${tx.url}`);
  if (d.id === 0) logTx("confirm", tx.hash, { debt: 0, by: d.debtor });
}
await totals("Before clearing");

console.log("\n5. Clearing runner");
for (const c of await runClearing(businessId("alpha"))) {
  log(`${[...c.ring, c.ring[0]].join(" -> ")}  ${c.amount} NEAR each  debts [${c.debtIds}]  ${c.tx.url}`);
  logTx("clear_cycle", c.tx.hash, { ring: c.ring, amount_near: c.amount, debt_ids: c.debtIds });
}
await totals("After clearing");

console.log("\n6. Leftovers paid in NEAR");
for (const d of (await getDebts()).filter((d) => d.status === "Confirmed")) {
  const tx = await call(business(nameOf(d.debtor)), "pay_debt", { id: d.id }, BigInt(d.outstanding));
  log(`${nameOf(d.debtor)} paid ${nameOf(d.creditor)} ${yoctoToNear(d.outstanding)} NEAR  ${tx.url}`);
  logTx(`pay_debt_${d.id}`, tx.hash, { from: d.debtor, to: d.creditor, amount_near: yoctoToNear(d.outstanding) });
}
await totals("After payments");
console.log(`\nAll tx hashes saved to deployments/testnet.json (master ${masterId()}).\n`);
