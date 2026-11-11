// Agent flow shared by the API server and scripts.
import { readFileSync } from "node:fs";
import { BUSINESSES, INVOICES_DIR, LEDGERS_DIR, WASM_PATH, type Business } from "./config.ts";
import { loadInvoiceTexts, parseInvoiceRegex, type ReadResult } from "./reader.ts";
import { loadLedgers, reconcile, type Reconciled } from "./reconciler.ts";
import { planClearings, type Clearing } from "./cycles.ts";
import { nearToYocto, yoctoToNear } from "./amount.ts";
import { readInvoice } from "./llm.ts";
import {
  accountExists, balanceOf, business, businessId, call, contractId, getDebts, logTx, master,
  nameOf, newKey, signerFor, type TxResult,
} from "./near.ts";

// ---- 1+2: read invoices and reconcile ----------------------------------------
export type AgentRun = { unreadable: { file: string; error: string }[]; results: Reconciled[]; reader: string };

export async function runAgent(): Promise<AgentRun> {
  const texts = loadInvoiceTexts(INVOICES_DIR);
  const read: ReadResult[] = [];
  for (const { file, text } of texts) read.push(await readInvoice(file, text));
  const ok = read.flatMap((r) => (r.ok ? [r.invoice] : []));
  const unreadable = read.flatMap((r) => (r.ok ? [] : [{ file: r.file, error: r.error }]));
  const results = reconcile(ok, loadLedgers(LEDGERS_DIR, [...BUSINESSES]));
  return { unreadable, results, reader: ok[0]?.source ?? "regex" };
}

/** Propose every matched invoice not already on-chain. Signed by the creditor. */
export async function proposeMatched(results: Reconciled[]): Promise<{ ref: string; id: number; tx: TxResult }[]> {
  const onChain = new Set((await getDebts()).map((d) => d.invoice_ref));
  const out = [];
  for (const r of results) {
    if (r.status !== "matched" || onChain.has(r.invoice.invoice_ref)) continue;
    const { creditor, debtor, amount, invoice_ref } = r.invoice;
    const tx = await call(business(creditor), "propose_debt", {
      debtor: businessId(debtor),
      amount: amount.toString(),
      invoice_ref,
    });
    out.push({ ref: invoice_ref, id: tx.value as number, tx });
  }
  return out;
}

// ---- 3+4: find cycles and clear them -----------------------------------------
export async function plan(): Promise<Clearing[]> {
  const debts = (await getDebts())
    .filter((d) => d.status === "Confirmed" && BigInt(d.outstanding) > 0n)
    .map((d) => ({ id: d.id, debtor: d.debtor, creditor: d.creditor, outstanding: BigInt(d.outstanding) }));
  return planClearings(debts).clearings;
}

export type ClearingDone = { ring: string[]; amount: string; debtIds: number[]; tx: TxResult };

/** Clearing runner: one clear_cycle tx per chosen cycle. Anyone may call; signs as `signerAccountId`. */
export async function runClearing(signerAccountId: string): Promise<ClearingDone[]> {
  const done: ClearingDone[] = [];
  // Re-plan after each tx so we always act on fresh chain state.
  for (;;) {
    const [next] = await plan();
    if (!next) break;
    const tx = await call(signerFor(signerAccountId), "clear_cycle", {
      debt_ids: next.debtIds,
      amount: next.amount.toString(),
    });
    done.push({ ring: next.ring.map(nameOf), amount: yoctoToNear(next.amount), debtIds: next.debtIds, tx });
  }
  return done;
}

// ---- testnet deployment --------------------------------------------------------
// Budget: 21 NEAR total, so a 25 NEAR master account covers setup with margin.
// bravo and delta pay the 5 NEAR leftovers in the seed demo; alpha and charlie only pay gas.
export const FUNDING: Record<Business, bigint> = {
  alpha: nearToYocto("2"),
  bravo: nearToYocto("7"),
  charlie: nearToYocto("2"),
  delta: nearToYocto("7"),
};
const FUND_CONTRACT = nearToYocto("3"); // 265 KB wasm ~ 2.66 NEAR storage + state headroom
export const SETUP_NEEDS = nearToYocto("25");
/** Surplus above target + this slack is returned to master, so repeat demos stay funded. */
const RETURN_SLACK = nearToYocto("1");
/** Ignore tiny shortfalls (account storage, gas) when topping up. */
const TOPUP_SLACK = nearToYocto("0.1");

async function createWithKey(accountId: string, amount: bigint, log: (s: string) => void) {
  const kp = newKey(accountId);
  const prefix = accountId.slice(0, accountId.length - master().accountId.length - 1);
  const res = await master().createSubAccount({
    accountOrPrefix: prefix,
    publicKey: kp.getPublicKey(),
    nearToTransfer: amount,
  });
  log(`created ${accountId} with ${yoctoToNear(amount)} NEAR  tx ${res.transaction.hash}`);
}

/** Create missing businesses; rebalance existing ones to their funding target. */
export async function ensureBusinesses(log: (s: string) => void) {
  for (const b of BUSINESSES) {
    const id = businessId(b);
    const target = FUNDING[b];
    if (!(await accountExists(id))) {
      await createWithKey(id, target, log);
      continue;
    }
    const bal = await balanceOf(id);
    log(`${id} exists (${yoctoToNear(bal)} NEAR available, target ${yoctoToNear(target)})`);
    if (bal + TOPUP_SLACK < target) {
      const top = target - bal;
      await master().transfer({ receiverId: id, amount: top });
      log(`  topped up ${yoctoToNear(top)} NEAR from master`);
    } else if (bal > target + RETURN_SLACK) {
      const back = bal - target;
      await business(b).transfer({ receiverId: master().accountId, amount: back });
      log(`  returned ${yoctoToNear(back)} NEAR surplus to master`);
    }
  }
}

/** Fresh contract account: delete the old one (funds return to master), recreate, deploy. */
export async function freshDeploy(log: (s: string) => void): Promise<string> {
  const id = contractId();
  if (await accountExists(id)) {
    const res = await signerFor(id).deleteAccount(master().accountId);
    log(`deleted old ${id} (balance returned to ${master().accountId})  tx ${res.transaction.hash}`);
  }
  await createWithKey(id, FUND_CONTRACT, log);
  const res = await signerFor(id).deployContract(new Uint8Array(readFileSync(WASM_PATH)));
  log(`deployed ${WASM_PATH.split(/[\\/]/).pop()} to ${id}  tx ${res.transaction.hash}`);
  logTx("deploy", res.transaction.hash, { contract: id });
  return res.transaction.hash;
}
