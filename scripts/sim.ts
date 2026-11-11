// npm run sim — fully offline: reader -> reconciler -> cycle finder on samples/.
// No network, no keys, no LLM.
import { BUSINESSES, INVOICES_DIR, LEDGERS_DIR } from "../agent/src/config.ts";
import { loadInvoiceTexts, parseInvoiceRegex, type Invoice } from "../agent/src/reader.ts";
import { loadLedgers, reconcile } from "../agent/src/reconciler.ts";
import { planClearings, type DebtEdge } from "../agent/src/cycles.ts";
import { yoctoToNear } from "../agent/src/amount.ts";

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const sum = (xs: { outstanding: bigint }[]) => yoctoToNear(xs.reduce((s, d) => s + d.outstanding, 0n));

console.log("\nDeloop simulation (offline)\n");

// 1. Read
const read = loadInvoiceTexts(INVOICES_DIR).map(({ file, text }) => parseInvoiceRegex(file, text));
const invoices: Invoice[] = [];
console.log("1. Invoices read");
for (const r of read) {
  if (r.ok) {
    const i = r.invoice;
    invoices.push(i);
    console.log(`   ${pad(r.invoice.file, 12)} ${pad(i.invoice_ref, 8)} ${pad(i.debtor, 8)} owes ${pad(i.creditor, 8)} ${yoctoToNear(i.amount)} NEAR`);
  } else console.log(`   ${pad(r.file, 12)} UNREADABLE: ${r.error}`);
}

// 2. Reconcile against each debtor's own payables ledger
const results = reconcile(invoices, loadLedgers(LEDGERS_DIR, [...BUSINESSES]));
console.log("\n2. Reconciled against the debtor's payables ledger");
for (const r of results) {
  const tag = r.status === "matched" ? "matched" : `FLAGGED  ${r.reason}`;
  console.log(`   ${pad(r.invoice.invoice_ref, 8)} ${tag}`);
}

// 3. Matched invoices become debts (simulating propose + confirm on-chain).
const debts: DebtEdge[] = results
  .filter((r) => r.status === "matched")
  .map((r, id) => ({ id, debtor: r.invoice.debtor, creditor: r.invoice.creditor, outstanding: r.invoice.amount }));
const refOf = new Map(results.filter((r) => r.status === "matched").map((r, id) => [id, r.invoice.invoice_ref]));

const table = (title: string, rows: DebtEdge[]) => {
  console.log(`\n${title}`);
  console.log(`   ${pad("id", 4)}${pad("ref", 9)}${pad("debtor", 9)}${pad("creditor", 10)}outstanding`);
  for (const d of debts) {
    const live = rows.find((x) => x.id === d.id);
    const out = live ? yoctoToNear(live.outstanding) + " NEAR" : "0 (Settled)";
    console.log(`   ${pad(d.id, 4)}${pad(refOf.get(d.id)!, 9)}${pad(d.debtor, 9)}${pad(d.creditor, 10)}${out}`);
  }
  console.log(`   Total outstanding: ${sum(rows)} NEAR across ${rows.length} debts`);
};

table("3. Confirmed debts BEFORE clearing", debts);

// 4. Find and clear cycles
const { clearings, remaining } = planClearings(debts);
console.log("\n4. Cycles cleared (no NEAR moves)");
if (!clearings.length) console.log("   none");
for (const c of clearings) {
  console.log(`   ${[...c.ring, c.ring[0]].join(" -> ")}   ${yoctoToNear(c.amount)} NEAR each   debts [${c.debtIds.join(", ")}]`);
}

table("5. AFTER clearing", remaining);
console.log(`\n   Payments needed: ${remaining.length}, totalling ${sum(remaining)} NEAR`);
for (const d of remaining) console.log(`     ${d.debtor} pays ${d.creditor} ${yoctoToNear(d.outstanding)} NEAR`);
console.log();
