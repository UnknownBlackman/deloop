// npm run replay:data - offline. Bakes what the dashboard's replay mode needs into web/src/replay-data.json:
// the agent's real results on samples/ (regex reader + reconciler) and the recorded testnet transactions
// from deployments/testnet.json. No network, no keys.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BUSINESSES, INVOICES_DIR, LEDGERS_DIR, ROOT } from "../agent/src/config.ts";
import { loadInvoiceTexts, parseInvoiceRegex } from "../agent/src/reader.ts";
import { loadLedgers, reconcile } from "../agent/src/reconciler.ts";

// Replay leaves INV-D1 out, so its walk-through ends with a single leftover payment (Liam pays Dara 5 NEAR).
// The sample files, the live demo and the recorded testnet run keep all six invoices.
const REPLAY_SKIP = new Set(["INV-D1"]);

const read = loadInvoiceTexts(INVOICES_DIR).map(({ file, text }) => parseInvoiceRegex(file, text));
const invoices = reconcile(
  read.flatMap((r) => (r.ok ? [r.invoice] : [])),
  loadLedgers(LEDGERS_DIR, [...BUSINESSES]),
).filter((r) => !REPLAY_SKIP.has(r.invoice.invoice_ref)).map((r) => ({
  file: r.invoice.file,
  ref: r.invoice.invoice_ref,
  debtor: r.invoice.debtor,
  creditor: r.invoice.creditor,
  amountYocto: r.invoice.amount.toString(),
  status: r.status,
  reason: r.status === "flagged" ? r.reason : undefined,
}));
const unreadable = read.flatMap((r) => (r.ok ? [] : [{ file: r.file, error: r.error }]));
const record = JSON.parse(readFileSync(path.join(ROOT, "deployments", "testnet.json"), "utf8"));

const out = path.join(ROOT, "web", "src", "replay-data.json");
writeFileSync(out, JSON.stringify({ invoices, unreadable, record }, null, 2) + "\n");
console.log(`wrote ${path.relative(ROOT, out)}: ${invoices.length} invoices, ${Object.keys(record).length} recorded transactions`);
