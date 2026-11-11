import { test } from "node:test";
import assert from "node:assert/strict";
import { BUSINESSES, INVOICES_DIR, LEDGERS_DIR } from "../src/config.ts";
import { loadInvoiceTexts, parseInvoiceRegex, type Invoice } from "../src/reader.ts";
import { loadLedgers, reconcile } from "../src/reconciler.ts";
import { nearToYocto as N } from "../src/amount.ts";

const parsed = loadInvoiceTexts(INVOICES_DIR).map(({ file, text }) => parseInvoiceRegex(file, text));
const invoices = parsed.map((r) => (r.ok ? r.invoice : assert.fail(`${r.file}: ${r.error}`))) as Invoice[];

test("regex reader extracts all six sample invoices", () => {
  const got = invoices.map((i) => [i.invoice_ref, i.debtor, i.creditor, i.amount]);
  assert.deepEqual(got, [
    ["INV-A1", "alpha", "bravo", N("10")],
    ["INV-B1", "bravo", "charlie", N("10")],
    ["INV-B2", "bravo", "delta", N("5")],
    ["INV-C1", "charlie", "alpha", N("10")],
    ["INV-C2", "charlie", "delta", N("7")],
    ["INV-D1", "delta", "alpha", N("5")],
  ]);
});

test("regex reader reports what is missing", () => {
  const r = parseInvoiceRegex("x.txt", "INVOICE INV-9\nFrom: a\nTo: b\nnothing to pay");
  assert.deepEqual(r, { ok: false, file: "x.txt", error: "no total amount in NEAR found" });
});

test("reconciler flags only INV-C2, with the reason", () => {
  const res = reconcile(invoices, loadLedgers(LEDGERS_DIR, [...BUSINESSES]));
  const flagged = res.filter((r) => r.status === "flagged");
  assert.equal(res.length - flagged.length, 5);
  assert.deepEqual(
    flagged.map((r) => [r.invoice.invoice_ref, r.status === "flagged" && r.reason]),
    [["INV-C2", "invoice says 7 NEAR, charlie's ledger says 5 NEAR"]],
  );
});

test("reconciler flags missing ledger rows and wrong suppliers", () => {
  const inv = (ref: string, creditor: string): Invoice => ({
    file: "f", invoice_ref: ref, creditor, debtor: "alpha", amount: N("10"), source: "regex",
  });
  const ledgers = { alpha: [{ invoice_ref: "INV-A1", supplier: "bravo", amount: N("10") }] };
  const res = reconcile([inv("INV-ZZ", "bravo"), inv("INV-A1", "mallory")], ledgers);
  assert.deepEqual(res.map((r) => r.status === "flagged" && r.reason), [
    "INV-ZZ is not in alpha's payables ledger",
    "alpha's ledger lists supplier bravo, invoice says mallory",
  ]);
});
