```text
  - - - - - -   - - - - - -   -               - - - -       - - - -     - - - - - -
  -         -   -             -             -         -   -         -   -         -
  -         -   - - - -       -             -         -   -         -   - - - - - -
  -         -   -             -             -         -   -         -   -
  - - - - - -   - - - - - -   - - - - - -     - - - -       - - - -     -
```

<p align="center">
  <a href="web/public/deloop-logo.html">
    <img src="deloop-logo.svg" alt="Deloop Logo" width="600" />
  </a>
</p>

<p align="center">
  <a href="https://deloop-three.vercel.app/"><strong>Live App</strong></a> &nbsp;&bull;&nbsp;
  <a href="https://deloop-three.vercel.app/dashboard?mode=replay"><strong>Interactive Replay</strong></a> &nbsp;&bull;&nbsp;
  <a href="https://testnet.nearblocks.io/address/deloop.0xforge.testnet"><strong>NEAR Testnet Contract</strong></a> &nbsp;&bull;&nbsp;
  <a href="DELOOP-CASE.md"><strong>Economic Case</strong></a>
</p>


**Deloop finds where your debts cancel out.**

Imagine three small business owners on the same street:
* **Maya's Bakery** owes **Liam's Print Shop** 10 NEAR.
* **Liam's Print Shop** owes **Sarah's Courier Service** 10 NEAR.
* **Sarah's Courier Service** owes **Maya's Bakery** 10 NEAR.

Right now, all three are stuck in a cash-flow deadlock. Maya is waiting for Sarah to pay before she can afford to pay Liam. Liam is waiting for Maya. Sarah is waiting for Liam. Everyone's working capital sits frozen for weeks.

Yet if all three sat down together, they'd realize something simple: **nobody actually needs to move any money.** The debt loop completely cancels itself out.

*(In our testnet demo and contract records, we represent these businesses under the test accounts `alpha`, `bravo`, and `charlie`).*

This isn't purely theory - Deloop solves a **real problem, today**. Read the economic and empirical case for Deloop in [DELOOP-CASE.md](DELOOP-CASE.md).

**Deloop brings this coordination to the near blockchain.**
An AI agent reads invoices and double-checks them against each debtor's internal accounting books (so fraudulent or mistaken bills are caught immediately). Once both parties agree on-chain, Deloop detects circular debt rings and cancels them out in a single atomic transaction. Only whatever leftover balance remains after netting is ever paid with real funds.

Built for SMEs, trade networks, and supplier groups.



---

## Quickstart

You can test Deloop directly on the live web deployment, run the offline simulator locally in 10 seconds, or deploy and run the live agent on NEAR testnet.

### Option 1: Try the Live Web App (Zero Setup)

Visit [deloop-three.vercel.app](https://deloop-three.vercel.app/) to explore the live application.
* **Interactive Replay Mode:** Open [deloop-three.vercel.app/dashboard?mode=replay](https://deloop-three.vercel.app/dashboard?mode=replay) to walk through all four stages (invoice reconciliation, non-custodial debt confirmation, circular ring clearing, and leftover settlement) directly in your browser without needing a wallet, private keys, or testnet NEAR.

---

### Option 2: Try it in 10 seconds (Offline Simulator)

No wallet, no testnet keys, and no LLM API key required - just Node.js ≥ 20:

```bash
npm install && npm run sim
```

**What you will see:**
The simulator reads 6 sample invoices and reconciles them against each business's accounts payable ledger:
1. **Discrepancy caught:** Invoice `INV-C2` is immediately **flagged** and blocked because the invoice claims 7 NEAR, but Charlie's internal ledger records 5 NEAR.
2. **Before clearing:** 5 legitimate debts exist, totaling **40 NEAR** of debt across the network.
3. **The loop detected:** Deloop spots the 3-way circular loop (`alpha` → `bravo` → `charlie` → `alpha`) and clears 10 NEAR for each business.
4. **After clearing:** 30 NEAR of debt evaporates without moving any tokens. That leaves only **10 NEAR across 2 leftover payments**: Bravo pays Delta 5 NEAR, and Delta pays Alpha 5 NEAR.

---

### Option 3: Run it live on NEAR Testnet (UI & Agent)

Want to see real transactions hit the blockchain and click through the web dashboard?

#### 1. Set up your environment
Copy the example environment file and add your NEAR testnet credentials:
```bash
cp .env.example .env
```
Open `.env` and fill in `NEAR_ACCOUNT_ID` and `NEAR_PRIVATE_KEY`.

#### 2. Provision test accounts and deploy the contract
```bash
npm run setup
```
This automatically creates four testnet accounts (`alpha`, `bravo`, `charlie`, and `delta` under your testnet account, e.g., `alpha.<you>.testnet`) and deploys the Deloop contract to `deloop.<you>.testnet`.
* **Funding requirements:** Your master account needs about **25 testnet NEAR**. (If it has less, setup stops and prints a clear error message).
* **Where the funds go:** Setup allocates 21 NEAR total: `bravo` and `delta` receive 7 NEAR each (giving them enough to pay the 5 NEAR leftovers), `alpha` and `charlie` receive 2 NEAR each for gas, and the contract receives 3 NEAR for storage.
* **Auto-rebalancing:** If you re-run `npm run demo`, it automatically rebalances balances: any surplus is refunded to your master account, and underfunded accounts are topped back up.

#### 3. Seed debts or run the full pipeline
* **To walk through the UI yourself:**
  ```bash
  npm run demo
  ```
  Deploys a fresh contract, runs the agent to read and reconcile invoices, and posts the 5 matched debts on-chain in the *Proposed* state.
* **Or run the entire end-to-end lifecycle via script:**
  ```bash
  npm run demo -- --full
  ```
  Executes every step directly on testnet: proposing, confirming, clearing the loop, and paying the remaining balances. Every transaction hash is logged to [deployments/testnet.json](deployments/testnet.json).

#### 4. Launch the web interface
```bash
npm run dev
```
The landing page opens at [http://127.0.0.1:5173](http://127.0.0.1:5173) (or live at [deloop-three.vercel.app](https://deloop-three.vercel.app/)). Its **Open the dashboard** button (or [http://127.0.0.1:5173/dashboard](http://127.0.0.1:5173/dashboard) / [deloop-three.vercel.app/dashboard](https://deloop-three.vercel.app/dashboard)) leads to the dashboard, where you run the agent, sign as each business, clear the loop and pay the leftovers.

**No keys or testnet NEAR? Use replay mode.** When the local API is not running (or with [`/dashboard?mode=replay`](https://deloop-three.vercel.app/dashboard?mode=replay)), the dashboard replays the four steps in the browser. It uses the agent's real results on the sample invoices and the contract's own rules: only the debtor confirms or pays, and the loop worth the most clears first. No transaction is sent. Each step that matches the recorded 9 November testnet run links to that real transaction, and **Start over** resets it. `npm run replay:data` rebuilds the replay data from `samples/` and `deployments/testnet.json`.

> **How demo keys are handled:**
> `npm run setup` generates keys for the four demo businesses into the local `.keys/` directory (which is gitignored). Our local dev server (listening strictly on `127.0.0.1`) signs transactions on behalf of whichever business you select in the web UI. This makes testing and reviewing the demo seamless. In production, each business connects and signs with its own NEAR wallet - the Deloop agent never holds private keys.

---

### UI Walk-through (After `npm run demo`)

Once the web page is open:
1. **Run agent on sample invoices:** Click the button to parse the invoices. You'll see 5 matched and 1 flagged invoice, and the 5 matched debts appear as *Proposed*.
2. **Confirm the debts:** Use the "Acting as" selector to switch between businesses and click **Confirm** for debts where that business is the debtor. (Only the debtor's confirm button is enabled - you cannot confirm someone else's debt). The network total reaches **40 NEAR**, with a notice: *"payments needed after clearing: 2"*.
3. **Run clearing:** Click **Run clearing**. The dashboard highlights the ring (`alpha` → `bravo` → `charlie`) clearing 10 NEAR each, along with a link to the transaction on the NEAR block explorer. The total network debt immediately drops to **10 NEAR**.
4. **Pay the leftovers:** Switch to `delta` and click **Pay leftover** (5 NEAR to Alpha), then switch to `bravo` and click **Pay leftover** (5 NEAR to Delta). The network debt drops to **0**.

---

### Running the Tests

* **Unit tests:**
  ```bash
  npm run test:unit
  ```
  Runs **16 tests** in milliseconds, testing the cycle finder algorithm, NEAR/yocto conversions, invoice reading, and ledger reconciliation.
* **Contract integration tests (NEAR Sandbox):**
  ```bash
  npm test
  ```
  Runs the 16 unit tests above plus **5 contract integration tests** against a local NEAR sandbox (`near-workspaces`). The sandbox runs natively on Linux and macOS, or via Docker on Windows. Our GitHub Actions workflow runs the entire suite on every commit: [.github/workflows/test.yml](.github/workflows/test.yml).
* **Rust unit tests:**
  ```bash
  cd contract && cargo test
  ```
  Runs the **11 Rust unit tests** inside the smart contract, mirroring the sandbox scenarios.

---

## How It Works

```
samples/invoices/*.txt ──► reader (regex, or LLM with a strict JSON schema)
                                 │
samples/ledgers/<debtor>.csv ──► reconciler ── flagged (shown with reason, never proposed)
                                 │ matched
                                 ▼
             deloop contract:  propose_debt (creditor) ──► confirm_debt (debtor)
                                 │ confirmed debts
                                 ▼
                     cycle finder (pure) ──► clear_cycle (one tx per loop, no NEAR moves)
                                 │ leftovers
                                 ▼
                              pay_debt (debtor attaches NEAR → creditor)
```

### The Smart Contract (`deloop`)
Located at [contract/src/lib.rs](contract/src/lib.rs) (built with `near-sdk` 5).

In business, nobody can unilaterally pull money out of your account. That’s why debts on Deloop follow a strict lifecycle:
1. `Proposed`: The creditor registers an invoice obligation on-chain.
2. `Confirmed`: The debtor explicitly reviews and confirms the debt on-chain. Only confirmed debts can be netted in loops.
3. `Settled`: Once a debt's balance reaches 0 (either through cycle clearing or payment), it is marked settled.

Each debt record stores `{ id, debtor, creditor, amount, outstanding, invoice_ref, status }`. Amounts are stored in `U128` yoctoNEAR (1 NEAR = $10^{24}$ yoctoNEAR) to prevent any precision loss.

| Method | Who calls it | What it does |
|---|---|---|
| `propose_debt(debtor, amount, invoice_ref) -> id` | Creditor | Creates a proposed debt referencing an invoice. |
| `confirm_debt(id)` | Debtor | The debtor verifies the debt against their records and confirms it on-chain (`Proposed` → `Confirmed`). |
| `clear_cycle(debt_ids, amount)` | Anyone (or agent) | Clears an entire circular loop in one go. The contract verifies that every debt is `Confirmed` with `outstanding >= amount`, that debtors and creditors form a continuous closed ring (`creditor(d[i]) == debtor(d[i+1])` and `creditor(last) == debtor(first)`), and that no debt ID repeats. It subtracts `amount` from each debt's balance, marking any that hit 0 as `Settled`. **No NEAR tokens move.** Emits the standard NEP-297 event `cycle_cleared`. |
| `pay_debt(id)` *(payable)* | Debtor | For any leftover debt that wasn't part of a loop. The debtor attaches real NEAR (`0 < deposit <= outstanding`). The contract transfers the deposit to the creditor via a NEAR Promise and reduces `outstanding`. Emits `debt_paid`. |
| `get_debts()`, `get_debt(id)`, `get_totals()` | Anyone | Read-only view methods. `get_totals()` returns `{ outstanding_sum, count }` across all confirmed debts. |

---

### The Cycle Finder Algorithm
Located at [agent/src/cycles.ts](agent/src/cycles.ts) (pure TypeScript, deterministic).

How does Deloop find circular debt loops?
1. **Build the network:** It models confirmed debts with `outstanding > 0` as a directed graph, where arrows point from debtor to creditor.
2. **Find the loops:** It uses Depth-First Search (DFS) to enumerate all simple cycles in the graph.
3. **Maximize cleared capital:** If several loops exist, Deloop prioritizes the cycle that clears the most total value, calculated as **minimum bottleneck amount × loop length**.
4. **Tie-breaking:** Any ties are broken deterministically by picking the lexicographically smaller sorted list of debt IDs.
5. **Iterate:** The chosen loop is cleared, balances are updated, and the finder repeats until no more cycles remain.

Because this algorithm is pure and deterministic, anyone running it on the same set of confirmed debts will discover the exact same clearing schedule.

---

### The AI Agent Pipeline
Located in [agent/src](agent/src):

* **Reading Invoices** ([reader.ts](agent/src/reader.ts), [llm.ts](agent/src/llm.ts)): Real-world invoices come in varied formats. When `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` are set, the reader calls an OpenAI-compatible model (such as NEAR AI Cloud) with a strict JSON schema to extract invoice details. If those variables are unset or if the API call fails, it automatically falls back to a deterministic regex parser.
* **Two-Way Reconciliation** ([reconciler.ts](agent/src/reconciler.ts)): AI should never be trusted blindly with company liabilities. Before an invoice is ever proposed on-chain, the reconciler cross-checks it against the **debtor's own accounts payable ledger**. The `invoice_ref`, supplier, and amount must match down to the cent. If anything looks off (like `INV-C2`, where the supplier billed 7 NEAR but the company ledger only approved 5 NEAR), the invoice is flagged with an explanation and prevented from going on-chain.
* **Exact Math** ([amount.ts](agent/src/amount.ts)): All currency conversions between NEAR and yoctoNEAR are handled with JavaScript `BigInt` arithmetic - never floating-point numbers - to eliminate rounding errors.
* **Execution & Local Server** ([flow.ts](agent/src/flow.ts), [server.ts](agent/src/server.ts)): Manages the clearing workflow, broadcasts `clear_cycle` transactions to NEAR, tracks transaction receipts, and powers the local UI.

---

## Live Testnet Run

These links and transaction hashes come from a real testnet run executed on **2026-11-09** via `npm run setup && npm run demo -- --full`. You can verify every step directly on the NEAR block explorer (and in [deployments/testnet.json](deployments/testnet.json)):

| Step | Account / Transaction | Link |
|---|---|---|
| Live Web App | Production Vercel deployment | [deloop-three.vercel.app](https://deloop-three.vercel.app/) |
| Interactive Replay | Zero-setup 4-step walk-through | [deloop-three.vercel.app/dashboard?mode=replay](https://deloop-three.vercel.app/dashboard?mode=replay) |
| Contract | `deloop.0xforge.testnet` | [View on NearBlocks](https://testnet.nearblocks.io/address/deloop.0xforge.testnet) |
| Businesses | `alpha`, `bravo`, `charlie`, `delta` `.0xforge.testnet` | [`alpha`](https://testnet.nearblocks.io/address/alpha.0xforge.testnet) · [`bravo`](https://testnet.nearblocks.io/address/bravo.0xforge.testnet) · [`charlie`](https://testnet.nearblocks.io/address/charlie.0xforge.testnet) · [`delta`](https://testnet.nearblocks.io/address/delta.0xforge.testnet) |
| Deploy contract | `AADott2aPwUS5JCea3fYSXqabKdQXpdLM5RCvcZLajHE` | [View transaction](https://testnet.nearblocks.io/txns/AADott2aPwUS5JCea3fYSXqabKdQXpdLM5RCvcZLajHE) |
| Confirm debt (`confirm_debt` #0, by alpha) | `3dP973c7UEyXebzKwpthQcnWkhsnYT2GChABju6Yoeqy` | [View transaction](https://testnet.nearblocks.io/txns/3dP973c7UEyXebzKwpthQcnWkhsnYT2GChABju6Yoeqy) |
| **Clear cycle (`clear_cycle`)** <br>*(alpha → bravo → charlie → alpha, 10 NEAR each, debts [0,1,3])* | **`7WpxxuPaRzSvQnumJdgirN79pasAR4L4YwCQ3DmheKFX`** | [**View transaction**](https://testnet.nearblocks.io/txns/7WpxxuPaRzSvQnumJdgirN79pasAR4L4YwCQ3DmheKFX) |
| Leftover payment 1 (`pay_debt` #2: bravo pays delta 5 NEAR) | `AfbLCscQ1VJrhA4AoHGBZ1wUUQTLUWpiraUtrTfQeGvU` | [View transaction](https://testnet.nearblocks.io/txns/AfbLCscQ1VJrhA4AoHGBZ1wUUQTLUWpiraUtrTfQeGvU) |
| Leftover payment 2 (`pay_debt` #4: delta pays alpha 5 NEAR) | `HVACGhPqSCdAUMHR2MGyRLvFUfzLdomxNFrYZma1rn2E` | [View transaction](https://testnet.nearblocks.io/txns/HVACGhPqSCdAUMHR2MGyRLvFUfzLdomxNFrYZma1rn2E) |

**What this run proved:**
* The network started with **40 NEAR** of debt across 5 confirmed debts.
* After a single `clear_cycle` transaction, the total dropped to **10 NEAR**. That means **30 of the 40 NEAR was settled without moving any money**.
* The remaining two non-loop debts were paid off in full, bringing the balance to 0.
* Meanwhile, mismatched invoice `INV-C2` was caught by the reconciler and never reached the blockchain.

> *Note: If you run `npm run demo` locally, it creates a fresh contract deployment for your own test, so the historical debt records above will exist in the explorer transactions linked above.*

---

## The Road to Mainnet

Deloop's mathematical clearing logic works regardless of what asset is being cleared. While this hackathon prototype runs on testnet with native NEAR, a production deployment would look like this:

* **Real Currencies & Stablecoins (USDC, USDT, NEP-141):** In the real world, businesses invoice in USD or stablecoins. On mainnet, Deloop can maintain independent netting pools for USDC, USDT, or any NEP-141 token, allowing companies to clear debts without holding volatile crypto.
* **Frictionless Leftovers via NEAR Intents:** When an unbalanced remainder is left after clearing, debtors shouldn't need to juggle multiple tokens or bridge manually. With NEAR Intents, a debtor can issue a settlement intent: *"Pay creditor X $5 in USDC"*. Market solvers fill the payment across chains using whatever asset the debtor already holds in their treasury (even on Ethereum, Arbitrum, or Bitcoin).
* **Enterprise Security & Non-Custodial Wallets:** Each business signs directly using their corporate NEAR wallet (such as FastAuth, Ledger, or a DAO multisig like Trezu). The Deloop agent simply coordinates - it reads, reconciles, and proposes clearing transactions, but never touches company private keys or funds.


---

## License
[MIT](LICENSE)
Also built by this team - [INPay](vercel-link-tba) [repo link](https://github.com/UnknownBlackman/inpay)