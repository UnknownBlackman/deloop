// Invoice reader: plain-text invoice -> { creditor, debtor, amount, invoice_ref }.
// Regex parser here; optional LLM parser lives in llm.ts.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { nearToYocto } from "./amount.ts";

export type Invoice = {
  file: string;
  invoice_ref: string;
  /** Business that issued the invoice and is owed. */
  creditor: string;
  /** Business that owes. */
  debtor: string;
  /** yoctoNEAR */
  amount: bigint;
  source: "regex" | "llm";
};
export type ReadResult = { ok: true; invoice: Invoice } | { ok: false; file: string; error: string };

const CREDITOR = /^\s*(?:from|issued by|seller|supplier|payee)\s*[:=]\s*(.+)$/im;
const DEBTOR = /^\s*(?:bill(?:ed)? to|to|customer|buyer|payer)\s*[:=]\s*(.+)$/im;
const REF = /\bINV-[A-Z0-9-]+\b/i;
const TOTAL_LINE = /\b(?:total|amount due|balance due)\b.*$/gim;
const AMOUNT = /([\d,]+(?:\.\d+)?)\s*NEAR\b|\bNEAR\s*([\d,]+(?:\.\d+)?)/i;

/** "Bravo Supplies (bravo)" -> "bravo"; "charlie" -> "charlie". */
function businessId(value: string): string | null {
  const paren = /\(([a-z0-9_-]+)\)/i.exec(value);
  const word = paren?.[1] ?? /[a-z0-9_-]+/i.exec(value)?.[0];
  return word ? word.toLowerCase() : null;
}

export function parseInvoiceRegex(file: string, text: string): ReadResult {
  const fail = (error: string): ReadResult => ({ ok: false, file, error });
  const ref = REF.exec(text)?.[0]?.toUpperCase();
  if (!ref) return fail("no invoice reference (INV-...) found");
  const creditor = businessId(CREDITOR.exec(text)?.[1] ?? "");
  if (!creditor) return fail("no issuer (From / Seller / Supplier / Payee) found");
  const debtor = businessId(DEBTOR.exec(text)?.[1] ?? "");
  if (!debtor) return fail("no recipient (To / Bill to / Customer / Payer) found");

  let amountStr: string | undefined;
  for (const line of text.match(TOTAL_LINE) ?? []) {
    const m = AMOUNT.exec(line);
    if (m) {
      amountStr = m[1] ?? m[2];
      break;
    }
  }
  if (!amountStr) return fail("no total amount in NEAR found");
  return { ok: true, invoice: { file, invoice_ref: ref, creditor, debtor, amount: nearToYocto(amountStr), source: "regex" } };
}

export function loadInvoiceTexts(dir: string): { file: string; text: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => ({ file: f, text: readFileSync(path.join(dir, f), "utf8") }));
}
