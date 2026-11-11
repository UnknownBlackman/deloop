// Reconciler: check each invoice against the DEBTOR's own payables ledger.
// Match on invoice_ref. Same supplier + amount -> matched (will be proposed on-chain).
// Anything else -> flagged with a reason, never proposed.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { nearToYocto, yoctoToNear } from "./amount.ts";
import type { Invoice } from "./reader.ts";

export type LedgerRow = { invoice_ref: string; supplier: string; amount: bigint };
export type Reconciled =
  | { status: "matched"; invoice: Invoice }
  | { status: "flagged"; invoice: Invoice; reason: string };

/** CSV header: invoice_ref,supplier,amount_near */
export function parseLedgerCsv(csv: string): LedgerRow[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = header.split(",").map((c) => c.trim());
  const ix = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`ledger missing column ${name}`);
    return i;
  };
  const [r, s, a] = [ix("invoice_ref"), ix("supplier"), ix("amount_near")];
  return lines
    .filter((l) => l.trim())
    .map((l) => {
      const f = l.split(",").map((x) => x.trim());
      return { invoice_ref: f[r].toUpperCase(), supplier: f[s].toLowerCase(), amount: nearToYocto(f[a]) };
    });
}

export function loadLedgers(dir: string, businesses: string[]): Record<string, LedgerRow[]> {
  const out: Record<string, LedgerRow[]> = {};
  for (const b of businesses) {
    const p = path.join(dir, `${b}.csv`);
    if (existsSync(p)) out[b] = parseLedgerCsv(readFileSync(p, "utf8"));
  }
  return out;
}

export function reconcile(invoices: Invoice[], ledgers: Record<string, LedgerRow[]>): Reconciled[] {
  const seen = new Set<string>();
  return invoices.map((invoice): Reconciled => {
    const flag = (reason: string): Reconciled => ({ status: "flagged", invoice, reason });
    const { debtor, creditor, invoice_ref, amount } = invoice;
    if (seen.has(invoice_ref)) return flag(`duplicate invoice ${invoice_ref}`);
    seen.add(invoice_ref);
    const ledger = ledgers[debtor];
    if (!ledger) return flag(`no payables ledger for ${debtor}`);
    const row = ledger.find((x) => x.invoice_ref === invoice_ref);
    if (!row) return flag(`${invoice_ref} is not in ${debtor}'s payables ledger`);
    if (row.supplier !== creditor)
      return flag(`${debtor}'s ledger lists supplier ${row.supplier}, invoice says ${creditor}`);
    if (row.amount !== amount)
      return flag(`invoice says ${yoctoToNear(amount)} NEAR, ${debtor}'s ledger says ${yoctoToNear(row.amount)} NEAR`);
    return { status: "matched", invoice };
  });
}
