# The Case for Deloop: Autonomous Multilateral Debt Clearing on NEAR

**How graph theory, autonomous agents, and blockchain execution solve the real-world working capital crisis.**

---

## Executive Summary

Small and medium-sized enterprises (SMEs) do not typically fail because they lack viable business models or profitable orders. They fail because of **liquidity gridlock**: money owed to them arrives too late for them to pay their own suppliers.

Across modern supply chains, companies are trapped in circular payment loops:
* Company A waits for Company C to pay before it can pay Company B.
* Company B waits for Company A before it can pay Company C.
* Company C waits for Company B before it can pay Company A.

In financial terms, all three businesses may be fundamentally solvent, yet all three are operationally paralyzed. Working capital sits idle, credit lines get exhausted, and economic activity stalls.

**Deloop is designed to dissolve this gridlock.**
By combining graph-theoretic cycle detection, autonomous AI reconciliation agents, and atomic smart contract execution on the NEAR blockchain, Deloop clears circular debt loops without moving money.

This case study reviews the empirical evidence for multilateral debt clearing - from national-scale implementations in Slovenia to global trade credit research - and explains why combining the **agent economy** with the **NEAR blockchain** transforms a historically bureaucratic, periodic government process into a continuous, decentralized, and scalable financial primitive.

---

## 1. The Real-World Problem: The Trade Credit Trap

Trade credit (invoicing with deferred payment terms, such as Net-30 or Net-60) is the largest source of working capital in the global economy, exceeding total bank lending to non-financial corporations in many jurisdictions. However, the lack of coordination in trade credit settlement creates severe systemic friction.

### The Atradius Payment Practices Barometer
The **Atradius Payment Practices Barometer**, an authoritative annual survey of B2B payment behavior across European and global markets, repeatedly highlights the staggering scale of late payments:
* **Nearly 4 in 5 companies (77% to 80%)** across Western Europe report being paid late by their B2B buyers.
* Over **25% of all B2B invoices** are paid significantly past their due date.
* When surveyed about the primary cause of late payments, businesses consistently cite **customer cash flow constraints** (the domino effect: "My customer cannot pay me because their customer has not paid them").
* Approximately **25% of businesses** report unrecoverable bad debt losses of up to 5% of their total receivables due to these liquidity cascades.

When interest rates rise and bank credit contracts, large corporations preserve their own cash buffers by stretching payment terms to smaller suppliers. SMEs are forced to act as involuntary bankers for their customers, triggering a cascade of late payments down the entire supply chain.

---

## 2. Empirical Precedent: Multilateral Netting Works

The concept of canceling circular obligations is not merely an academic hypothesis; it is an empirically proven macroeconomic intervention.

### National-Scale Proof: Slovenia's Multilateral Clearing (AJPES)
The most prominent real-world example of nationwide debt clearing occurred in Slovenia:
* **The Context:** Following economic transitions and subsequent regional crises, Slovenian enterprises faced severe liquidity gridlock where inter-company debt spiraled out of control.
* **The Policy:** Slovenia enacted the *Act on Prevention of Late Payments* (*Zakon o preprečevanju zamud pri plačilih* - ZPrePO-1), introducing a statutory multilateral set-off system (*multilateralni pobot*, known as **e-Pobot**).
* **The Agency:** The state records agency, **AJPES** (*Agencija Republike Slovenije za javnopravne evidence in storitve*), was mandated to operate periodic national clearing rounds.
* **The Mechanism:** Slovenian businesses submitted their due, unpaid invoices into a centralized clearing registry. An algorithm mapped the directed graph of receivables and payables across the entire economy, discovered closed cycles of indebtedness, and canceled mutual obligations simultaneously.
* **The Result:** The system settled **hundreds of millions to billions of euros** in gridlocked obligations with **zero liquidity required**. Companies that had been waiting months for payments saw their accounts payable and accounts receivable shrink by equal amounts in an instant, instantly restoring their operational solvency.

### Academic Foundations: Fleischman, Dini, and Littera
The macroeconomic mechanics of trade credit netting have been extensively analyzed in peer-reviewed financial literature:
* In **"Liquidity-Saving through Obligation-Clearing and Mutual Credit: An Effective Monetary Innovation for SMEs in Times of Crisis"** (*Journal of Risk and Financial Management*, 2020), authors Tomaž Fleischman, Paolo Dini, and Giuseppe Littera demonstrated how obligation-clearing networks structurally resolve SME cash crunches without requiring debt monetization or bank bailouts.
* In **"Mathematical Foundations for Balancing the Payment System in the Trade Credit Market"** (*JRFM*, 2021), Fleischman and Dini formalized the network models of Trade Credit Networks (TCN), proving mathematically that a large fraction of outstanding trade credit in any dense economic cluster forms closed loops that can be netted out algebraically.

### The Cycles Protocol (Fleischman & Buchman)
Building on the lessons of Slovenia and financial network theory, **Ethan Buchman** (co-founder of Cosmos) and **Tomaž Fleischman** introduced the **Cycles Protocol** (*"Deepening the Secondary Market: Integrating Trade Credit into Market Clearing with the Cycles Protocol"*, 2024-2026).
* The paper outlines a decentralized, peer-to-peer framework for **Multilateral Trade Credit Set-off (MTCS)** using directed graphs.
* Critically, the paper proves that multilateral set-off can be executed **without novation**. In traditional clearinghouses (like DTCC or LCH), the central counterparty steps between buyers and sellers, becoming the legal debtor to every creditor and assuming massive systemic risk. The Cycles paper demonstrates that circular graph clearing can operate as a pure netting compression layer that preserves existing commercial contracts and relationships.

---

## 3. Why Previous Implementations Stalled: The Centralization Paradox

If multilateral debt clearing is mathematically sound and empirically proven, why isn't every economy doing it every day?

Historically, centralized systems like Slovenia's AJPES suffered from four fatal structural bottlenecks:

1. **Compulsion and Legal Bureaucracy:**
   Because there was no bottom-up coordination mechanism, Slovenia had to make participation mandatory by law. Enforcing government reporting across thousands of private companies created enormous regulatory overhead, auditing friction, and administrative resentment.
2. **The Privacy Paradox:**
   Commercial businesses are intensely secretive about their customer lists, supplier terms, and accounts payable. Handing complete, unredacted corporate ledgers to a central government agency or private intermediary created severe data leakage and competitive exposure risks.
3. **Rigid Batch Processing:**
   Centralized clearinghouses operated on fixed monthly or quarterly batch intervals. An invoice due on the 2nd of the month might sit in limbo until the next clearing run 28 days later. Business liquidity, however, is a continuous, real-time necessity.
4. **Data Fragmentation and Invoicing Chaos:**
   In real commerce, every ERP system (SAP, QuickBooks, Xero, NetSuite) outputs invoices differently: PDFs, text files, emails, and CSVs. In a centralized clearinghouse, matching these records required painful manual reconciliation and produced constant dispute bottlenecks.

---

## 4. How Deloop Solves the Puzzle

Deloop takes the proven economic mechanics of multilateral debt set-off and reconstructs them using two modern primitives: **the autonomous AI agent economy** and **the NEAR blockchain**.

```
    [ Invoices: PDF / TXT / CSV ]
                 │
                 ▼
       ┌───────────────────┐
       │   AI Agent Node   │ ◄── Reads unstructured invoices (LLM + schema / regex)
       └─────────┬─────────┘
                 │
                 ▼
       ┌───────────────────┐
       │ 2-Way Reconciler  │ ◄── Cross-checks debtor's internal AP ledger
       └─────────┬─────────┘     (Blocks hallucinations, rogue bills & discrepancies)
                 │
        Matched Invoices Only
                 ▼
       ┌───────────────────┐
       │   NEAR Contract   │ ◄── propose_debt (Creditor) ──► confirm_debt (Debtor)
       └─────────┬─────────┘     (Non-custodial, bilateral on-chain agreement)
                 │
                 ▼
       ┌───────────────────┐
       │   Cycle Finder    │ ◄── DFS graph search maximizes cleared capital
       └─────────┬─────────┘     (min bottleneck × cycle length)
                 │
                 ▼
       ┌───────────────────┐
       │   clear_cycle     │ ◄── 1 Atomic Transaction on NEAR (NO tokens move)
       └─────────┬─────────┘     (NEP-297 event logged, balances netted instantly)
                 │
                 ▼
       ┌───────────────────┐
       │   NEAR Intents    │ ◄── Solvers settle un-netted leftover balances
       └───────────────────┘     across currencies (USDC, USDT) and cross-chain
```

### Pillar A: Why the AI Agent Economy?

Autonomous agents transform debt clearing from a cumbersome government mandate into an automated, bottom-up coordination network.

1. **Continuous Asynchronous Discovery (No More Batches):**
   Instead of waiting for a monthly government clearing run, Deloop agents run 24/7 in the background. As soon as invoices are approved, agents discover and settle cycles in near real-time.
2. **Effortless Ingestion Across Any Format:**
   Real-world SMEs cannot agree on a unified electronic invoicing standard. Deloop’s agent pipeline uses LLMs with strict structured JSON schemas (falling back to deterministic regex) to parse invoices from raw text, emails, or ERP exports.
3. **The Two-Way Safety Check (Ledger Reconciliation):**
   The primary danger of applying AI to finance is hallucination or unverified billing. Deloop introduces a strict zero-trust boundary in `reconciler.ts`:
   * The agent *never* takes a supplier's invoice at face value.
   * Every invoice is cross-checked against the **debtor's own accounts payable ledger**.
   * The invoice reference, debtor, creditor, and amount must match down to the exact yoctoNEAR.
   * Discrepancies (such as sample invoice `INV-C2`, where a supplier billed 7 NEAR but the company ledger only approved 5 NEAR) are immediately flagged and barred from ever touching the blockchain.
4. **Agent Representation Without Custody:**
   In Deloop, agents propose transactions and search for cycles, but they never hold private keys or custody corporate funds. Each business maintains absolute control through its own wallet or multisig.

### Pillar B: Why the NEAR Blockchain?

Graph-theoretic netting requires a settlement rail that is fast, cheap, auditable, and atomic. NEAR provides the ideal infrastructure:

1. **Atomic Multilateral Settlement (`clear_cycle`):**
   In a 3-way, 4-way, or 10-way debt loop, clearing cannot be done through a sequence of bilateral steps. If Company A forgives Company B, but Company B defaults before forgiving Company C, the entire settlement breaks down.
   On NEAR, `clear_cycle` is **fully atomic**. The smart contract verifies that the closed ring is valid, checks that all debts are debtor-confirmed, and reduces all balances simultaneously in a single transaction. Either the entire ring clears together, or the transaction reverts. There is zero settlement or counterparty risk.
2. **Zero-Token Clearing Economics:**
   During a loop cancellation, **no NEAR tokens move**. The contract simply updates the state balances of the confirmed debts. Because NEAR boasts sub-cent transaction fees, a ring clearing tens of thousands of dollars of debt costs less than a penny in gas, making micro-clearings economically viable.
3. **NEP-297 Event Auditability:**
   Every clearing emits standard `cycle_cleared` NEP-297 events. This provides an immutable, cryptographically verifiable audit trail that corporate accountants, tax authorities, and auditors can independently verify.
4. **The Road to Mainnet: Multi-Token & NEAR Intents:**
   In real commerce, companies invoice in fiat, USDC, or USDT, and cycles will rarely net out to exactly zero. Deloop’s design bridges testnet prototype to enterprise reality:
   * **Multi-Token Netting:** Separate independent clearing rings per asset (USDC, USDT, EURC, NEP-141).
   * **Leftover Balances via NEAR Intents:** When a 40 USDC debt loop leaves a 5 USDC remainder, the debtor does not need to bridge funds or buy crypto. Using **NEAR Intents**, the debtor expresses an intent (*"Pay Supplier X 5 USDC"*), and decentralized solvers execute the settlement across chains using whatever treasury assets the debtor holds (on Ethereum, Arbitrum, Solana, or Bitcoin).

---

## 5. Value Creation Walkthrough: The Deloop Testnet Run

The principles described above were validated on the NEAR testnet on **2026-11-09** (verifiable in `deployments/testnet.json` and on NearBlocks):

| Metric | Before Clearing | After `clear_cycle` | After Leftover Payments |
|---|---|---|---|
| **Active Confirmed Debts** | 5 debts | 2 debts | 0 debts |
| **Gross Network Debt** | **40 NEAR** | **10 NEAR** | **0 NEAR** |
| **Capital Required to Settle** | 40 NEAR | 10 NEAR | 0 NEAR |
| **Cash Moved During Clearing** | **0 NEAR** | **0 NEAR** | 10 NEAR (2 payments) |

### The Economic Takeaway:
* **75% of the total network debt (30 out of 40 NEAR) was permanently settled without moving a single token.**
* Instead of 4 companies scrambling to secure 40 NEAR in cash, the entire network required only **10 NEAR** in total liquidity to achieve 100% balance sheet settlement.
* The mismatched invoice (`INV-C2`) was automatically caught by the agent reconciler and never went on-chain.

---

## 6. Comparison Matrix: Historical Clearing vs. Deloop

| Feature | Centralized Clearing (e.g. Slovenia AJPES) | Bilateral Commercial Trade | Deloop (Agentic + NEAR) |
|---|---|---|---|
| **Coordination** | Top-down government mandate | Disconnected bilateral negotiations | Autonomous agent discovery |
| **Settlement Frequency** | Monthly / Quarterly batches | Random / Chronic delays | Continuous, real-time |
| **Counterparty Risk** | Centralized in clearinghouse | High (domino defaults) | Zero (atomic smart contract) |
| **Capital Required** | High administrative overhead | 100% gross invoice value | Only net un-looped leftovers |
| **Data Privacy** | Full ledgers shared with government | Bilateral only | Ledger stays local; only confirmed claims on-chain |
| **Dispute Prevention** | Post-clearing legal arbitration | Bilateral dispute delays | Pre-clearing two-way reconciliation |
| **Asset Agility** | Single national currency (EUR) | Inflexible bank transfers | Multi-token + NEAR Intents solvers |

---

## 7. Conclusion

The evidence from historical macroeconomic crises and peer-reviewed network science is unambiguous: **multilateral debt clearing works.** It frees trapped capital, prevents cascading insolvencies, and reduces the economy's reliance on expensive debt.

What was missing was an infrastructure that eliminated the friction, privacy loss, and bureaucracy of centralized clearinghouses.

By uniting:
1. **The Graph Science of Cycles:** Netting obligations without novation,
2. **Autonomous AI Agents:** Continuously extracting, reconciling, and discovering loops, and
3. **The NEAR Blockchain:** Delivering atomic, low-cost, intent-driven settlement,

**Deloop turns debt canceling from a rare emergency intervention into a routine, autonomous financial reality.**

---

## References

1. **Atradius** (2023-2025). *Payment Practices Barometer: International B2B Payment Practices*. Atradius N.V.
2. **Fleischman, T., Dini, P., & Littera, G.** (2020). *"Liquidity-Saving through Obligation-Clearing and Mutual Credit: An Effective Monetary Innovation for SMEs in Times of Crisis."* *Journal of Risk and Financial Management*, 13(12), 295.
3. **Fleischman, T., & Dini, P.** (2021). *"Mathematical Foundations for Balancing the Payment System in the Trade Credit Market."* *Journal of Risk and Financial Management*, 14(9), 425.
4. **Fleischman, T., & Buchman, E.** (2024-2026). *"Deepening the Secondary Market: Integrating Trade Credit into Market Clearing with the Cycles Protocol."* ArXiv / World Federation of Exchanges (*WFEClear*).
5. **Republic of Slovenia** (2011). *Act on Prevention of Late Payments (ZPrePO-1)*. Official Gazette of the Republic of Slovenia.
6. **AJPES** (2011-2024). *Večstranski pobot (e-Pobot): Multilateral obligation set-off system documentation*. Agencija Republike Slovenije za javnopravne evidence in storitve.
7. **NEAR Protocol** (2024-2026). *NEAR Intents Specification & Chain Abstraction Architecture*. NEAR Documentation.
