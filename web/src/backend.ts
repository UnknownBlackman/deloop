// Two backends with one interface:
//  - live:   the local API (agent/src/server.ts), which signs real transactions on NEAR testnet;
//  - replay: an in-browser copy of the contract's rules, seeded with the agent's real results on the
//            sample invoices, for anyone without the API, keys or testnet funds. Nothing is sent anywhere;
//            a step that matches the recorded 9 November run links to that real transaction.
import { planClearings, type DebtEdge } from "../../agent/src/cycles.ts";
import { yoctoToNear } from "../../agent/src/amount.ts";
import data from "./replay-data.json";

export type Status = "Proposed" | "Confirmed" | "Settled";
export type Debt = {
  id: number;
  debtorName: string;
  creditorName: string;
  amountNear: string;
  outstandingNear: string;
  invoice_ref: string;
  status: Status;
};
export type Cycle = { ring: string[]; amountNear: string; debtIds: number[] };
export type State = {
  contractId: string;
  contractUrl: string;
  reader: string;
  totals: { outstandingNear: string; count: number };
  afterClearing: { paymentsNeeded: number; totalNear: string; cycles: Cycle[] };
  debts: Debt[];
  /** live only: the last loop cleared on this deployment, from deployments/testnet.json */
  lastClear?: (Cycle & { hash?: string; url?: string }) | null;
};
export type InvoiceRow = { file: string; ref: string; debtor: string; creditor: string; amountNear: string; status: "matched" | "flagged"; reason?: string };
export type AgentRun = { reader: string; invoices: InvoiceRow[]; unreadable: { file: string; error: string }[] };
/** url is set when there is a transaction to show: a live one, or the recorded one this step matches. */
export type Tx = { url?: string; hash?: string };
export type Cleared = Cycle & Tx;

export interface Backend {
  mode: "live" | "replay";
  /** reads a deployment but cannot sign (the recorded live run, without the local API) */
  readOnly?: boolean;
  state(): Promise<State>;
  runAgent(): Promise<AgentRun>;
  confirm(as: string, id: number): Promise<Tx>;
  pay(as: string, id: number): Promise<Tx>;
  clear(as: string): Promise<Cleared[]>;
  reset?(): void;
}

// ---------------------------------------------------------------- live
async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error ?? res.statusText);
  return out as T;
}

export const live: Backend = {
  mode: "live",
  state: () => api<State>("/api/state"),
  runAgent: () => api<AgentRun>("/api/agent/run", {}),
  confirm: (as, id) => api<Tx>("/api/confirm", { as, id }),
  pay: (as, id) => api<Tx>("/api/pay", { as, id }),
  clear: (as) => api<Cleared[]>("/api/clear", { as }),
};

// ---------------------------------------------------------------- chain (read-only)
// Live testnet without the local API: the recorded run's contract, read straight from NEAR testnet's public RPC
// (view calls need no account or key). It is the real on-chain record; nothing can be signed from here.
const RPC_URL = "https://test.rpc.fastnear.com";
const EXPLORER = "https://testnet.nearblocks.io";
const nameOf = (accountId: string) => accountId.split(".")[0];

async function chainView<T>(contract: string, method: string): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "deloop", method: "query", params: { request_type: "call_function", finality: "final", account_id: contract, method_name: method, args_base64: btoa("{}") } }),
  });
  const out = await res.json();
  if (out.error || out.result?.error) throw new Error(`Could not read ${contract} from NEAR testnet`);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(out.result.result))) as T;
}

const readOnly = () => Promise.reject(new Error("This is the recorded live run, read from NEAR testnet: there is nothing to sign here. Run Deloop locally to sign your own."));

export const chain: Backend = {
  mode: "live",
  readOnly: true,
  async state() {
    type ChainDebt = { id: number; debtor: string; creditor: string; amount: string; outstanding: string; invoice_ref: string; status: Status };
    const [debts, totals] = await Promise.all([
      chainView<ChainDebt[]>(contractId, "get_debts"),
      chainView<{ outstanding_sum: string; count: number }>(contractId, "get_totals"),
    ]);
    // the same reading the local API gives (agent/src/server.ts)
    const { clearings, remaining } = planClearings(
      debts.filter((d) => d.status === "Confirmed" && BigInt(d.outstanding) > 0n).map((d) => ({ id: d.id, debtor: d.debtor, creditor: d.creditor, outstanding: BigInt(d.outstanding) })),
    );
    const c = rec.clear_cycle as { ring?: string[]; amount_near?: string; debt_ids?: number[]; hash: string; url: string } | undefined;
    return {
      contractId,
      contractUrl: `${EXPLORER}/address/${contractId}`,
      reader: "regex",
      totals: { outstandingNear: yoctoToNear(BigInt(totals.outstanding_sum)), count: totals.count },
      afterClearing: {
        paymentsNeeded: remaining.length,
        totalNear: yoctoToNear(remaining.reduce((s, d) => s + d.outstanding, 0n)),
        cycles: clearings.map((k) => ({ ring: k.ring.map(nameOf), amountNear: yoctoToNear(k.amount), debtIds: k.debtIds })),
      },
      lastClear: c ? { ring: (c.ring ?? []).map(nameOf), amountNear: String(c.amount_near), debtIds: c.debt_ids ?? [], hash: c.hash, url: c.url } : null,
      debts: debts.map((d) => ({
        ...d,
        debtorName: nameOf(d.debtor),
        creditorName: nameOf(d.creditor),
        amountNear: yoctoToNear(BigInt(d.amount)),
        outstandingNear: yoctoToNear(BigInt(d.outstanding)),
      })),
    };
  },
  runAgent: readOnly,
  confirm: readOnly,
  pay: readOnly,
  clear: readOnly,
};

/** The live backend is usable when the API answers and its contract exists. */
export async function liveAvailable(): Promise<boolean> {
  try {
    await Promise.race([live.state(), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 6000))]);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- replay
type RDebt = { id: number; debtor: string; creditor: string; ref: string; amount: bigint; outstanding: bigint; status: Status };
const rec = data.record as Record<string, { url: string; hash: string; debt?: number; debt_ids?: number[]; amount_near?: string }>;
const contractId = (rec.deploy as unknown as { contract?: string })?.contract ?? "deloop.0xforge.testnet";
const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));

function makeReplay(): Backend {
  let debts: RDebt[] = [];
  const fail = (msg: string): never => {
    throw new Error(msg);
  };
  const recorded = (key: string): Tx => (rec[key] ? { url: rec[key].url, hash: rec[key].hash } : {});

  const view = (): State => {
    const live = debts.filter((d) => d.status === "Confirmed" && d.outstanding > 0n);
    const edges: DebtEdge[] = live.map((d) => ({ id: d.id, debtor: d.debtor, creditor: d.creditor, outstanding: d.outstanding }));
    const { clearings, remaining } = planClearings(edges);
    return {
      contractId,
      contractUrl: `https://testnet.nearblocks.io/address/${contractId}`,
      reader: "regex",
      totals: { outstandingNear: yoctoToNear(live.reduce((s, d) => s + d.outstanding, 0n)), count: live.length },
      afterClearing: {
        paymentsNeeded: remaining.length,
        totalNear: yoctoToNear(remaining.reduce((s, d) => s + d.outstanding, 0n)),
        cycles: clearings.map((c) => ({ ring: c.ring, amountNear: yoctoToNear(c.amount), debtIds: c.debtIds })),
      },
      debts: debts.map((d) => ({
        id: d.id,
        debtorName: d.debtor,
        creditorName: d.creditor,
        amountNear: yoctoToNear(d.amount),
        outstandingNear: yoctoToNear(d.outstanding),
        invoice_ref: d.ref,
        status: d.status,
      })),
    };
  };
  const debt = (id: number) => debts.find((d) => d.id === id) ?? fail("Unknown debt id");

  return {
    mode: "replay",
    async state() {
      return view();
    },
    async runAgent() {
      await wait(700);
      // matched invoices are proposed by their creditor, in file order, once each (as proposeMatched does)
      const known = new Set(debts.map((d) => d.ref));
      for (const i of data.invoices) {
        if (i.status !== "matched" || known.has(i.ref)) continue;
        const amount = BigInt(i.amountYocto);
        debts.push({ id: debts.length, debtor: i.debtor, creditor: i.creditor, ref: i.ref, amount, outstanding: amount, status: "Proposed" });
      }
      return {
        reader: "regex",
        unreadable: data.unreadable,
        invoices: data.invoices.map((i) => ({ ...i, amountNear: yoctoToNear(BigInt(i.amountYocto)), status: i.status as "matched" | "flagged" })),
      };
    },
    // the same checks, in the same words, as contract/src/lib.rs
    async confirm(as, id) {
      await wait();
      const d = debt(id);
      if (d.debtor !== as) fail("Only the debtor can confirm");
      if (d.status !== "Proposed") fail("Debt is not Proposed");
      d.status = "Confirmed";
      return id === rec.confirm?.debt ? recorded("confirm") : {};
    },
    async pay(as, id) {
      await wait();
      const d = debt(id);
      if (d.debtor !== as) fail("Only the debtor can pay");
      if (d.status !== "Confirmed") fail("Debt is not Confirmed");
      if (d.outstanding <= 0n) fail("Attach a deposit > 0");
      const paid = d.outstanding;
      d.outstanding = 0n;
      d.status = "Settled";
      const r = rec[`pay_debt_${id}`];
      return r && r.amount_near === yoctoToNear(paid) ? recorded(`pay_debt_${id}`) : {};
    },
    async clear() {
      await wait(900);
      const { clearings } = planClearings(
        debts.filter((d) => d.status === "Confirmed" && d.outstanding > 0n).map((d) => ({ id: d.id, debtor: d.debtor, creditor: d.creditor, outstanding: d.outstanding })),
      );
      if (!clearings.length) fail("No loop among the confirmed debts");
      return clearings.map((c) => {
        for (const id of c.debtIds) {
          const d = debt(id);
          d.outstanding -= c.amount;
          if (d.outstanding === 0n) d.status = "Settled";
        }
        const r = rec.clear_cycle;
        const same = r && JSON.stringify(r.debt_ids) === JSON.stringify(c.debtIds) && r.amount_near === yoctoToNear(c.amount);
        return { ring: c.ring, amountNear: yoctoToNear(c.amount), debtIds: c.debtIds, ...(same ? recorded("clear_cycle") : {}) };
      });
    },
    reset() {
      debts = [];
    },
  };
}

export const replay = makeReplay();

/** The invoices the reconciler flagged on the samples (the same files the live agent reads). Used to show
 *  them as held in step 02 after a reload, when the agent's run is no longer in memory. */
export function flaggedSamples(): InvoiceRow[] {
  return data.invoices
    .filter((i) => i.status === "flagged")
    .map((i) => ({ ...i, amountNear: yoctoToNear(BigInt(i.amountYocto)), status: "flagged" as const }));
}
