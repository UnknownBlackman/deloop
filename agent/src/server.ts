// Local API for the web page. Listens on 127.0.0.1 only: it signs with the demo keys in .keys/.
// TESTNET DEMO CONVENIENCE: in production each business signs with its own wallet.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { BUSINESSES } from "./config.ts";
import { yoctoToNear } from "./amount.ts";
import { planClearings } from "./cycles.ts";
import { llmEnabled } from "./llm.ts";
import { proposeMatched, runAgent, runClearing } from "./flow.ts";
import { accountUrl, business, businessId, call, contractId, getDebts, getTotals, nameOf, txUrl } from "./near.ts";

const PORT = Number(process.env.API_PORT ?? 8787);

async function state() {
  const debts = await getDebts();
  const totals = await getTotals();
  const confirmed = debts
    .filter((d) => d.status === "Confirmed" && BigInt(d.outstanding) > 0n)
    .map((d) => ({ id: d.id, debtor: d.debtor, creditor: d.creditor, outstanding: BigInt(d.outstanding) }));
  const { clearings, remaining } = planClearings(confirmed);
  return {
    contractId: contractId(),
    contractUrl: accountUrl(contractId()),
    reader: llmEnabled() ? "llm" : "regex",
    businesses: BUSINESSES.map((b) => ({ name: b, id: businessId(b) })),
    totals: { outstandingNear: yoctoToNear(totals.outstanding_sum), count: totals.count },
    afterClearing: {
      paymentsNeeded: remaining.length,
      totalNear: yoctoToNear(remaining.reduce((s, d) => s + d.outstanding, 0n)),
      cycles: clearings.map((c) => ({ ring: c.ring.map(nameOf), amountNear: yoctoToNear(c.amount), debtIds: c.debtIds })),
    },
    debts: debts.map((d) => ({
      ...d,
      debtorName: nameOf(d.debtor),
      creditorName: nameOf(d.creditor),
      amountNear: yoctoToNear(d.amount),
      outstandingNear: yoctoToNear(d.outstanding),
    })),
  };
}

function actingAs(body: Record<string, unknown>): string {
  const as = String(body.as ?? "");
  if (!(BUSINESSES as readonly string[]).includes(as)) throw new Error(`unknown business "${as}"`);
  return as;
}

const routes: Record<string, (body: Record<string, unknown>) => Promise<unknown>> = {
  "GET /api/state": () => state(),

  // Read invoices, reconcile against payables ledgers, propose matched ones (signed by each creditor).
  "POST /api/agent/run": async () => {
    const run = await runAgent();
    const proposed = await proposeMatched(run.results);
    return {
      reader: run.reader,
      unreadable: run.unreadable,
      proposed: proposed.map((p) => ({ ref: p.ref, id: p.id, url: p.tx.url })),
      invoices: run.results.map((r) => ({
        file: r.invoice.file,
        ref: r.invoice.invoice_ref,
        debtor: r.invoice.debtor,
        creditor: r.invoice.creditor,
        amountNear: yoctoToNear(r.invoice.amount),
        status: r.status,
        reason: r.status === "flagged" ? r.reason : undefined,
      })),
    };
  },

  "POST /api/confirm": async (b) => call(business(actingAs(b)), "confirm_debt", { id: Number(b.id) }),

  "POST /api/clear": async (b) => {
    const done = await runClearing(businessId(actingAs(b)));
    return done.map((c) => ({ ring: c.ring, amountNear: c.amount, debtIds: c.debtIds, hash: c.tx.hash, url: c.tx.url }));
  },

  // Pay the full outstanding of a debt in NEAR (pay_debt with attached deposit).
  "POST /api/pay": async (b) => {
    const as = actingAs(b);
    const debt = (await getDebts()).find((d) => d.id === Number(b.id));
    if (!debt) throw new Error("unknown debt");
    return call(business(as), "pay_debt", { id: debt.id }, BigInt(debt.outstanding));
  },
};

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

/** Pull the contract's panic message out of a NEAR failure for the UI. */
function cleanError(e: unknown): string {
  const msg = (e as Error).message ?? String(e);
  if (/does not exist/.test(msg)) return `${msg}. Run: npm run setup && npm run demo`;
  return /Smart contract panicked: ([^"\\]+)/.exec(msg)?.[1] ?? msg;
}

createServer(async (req, res) => {
  const handler = routes[`${req.method} ${req.url?.split("?")[0]}`];
  if (!handler) return send(res, 404, { error: "not found" });
  try {
    send(res, 200, await handler(await readBody(req)));
  } catch (e) {
    console.error(e);
    send(res, 400, { error: cleanError(e) });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Deloop API on http://127.0.0.1:${PORT}  contract ${contractId()}  explorer ${txUrl("")}`);
});
