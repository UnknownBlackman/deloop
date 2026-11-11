// Cycle finder: pure, deterministic, no I/O.
//
// Graph: one edge per confirmed debt, debtor -> creditor, weight = outstanding.
// Rule: enumerate simple cycles by DFS; pick the one clearing the most total value
// (min outstanding x length); tie-break on the sorted list of debt ids (smaller first).
// Clear it, repeat until no cycle remains.

export type DebtEdge = { id: number; debtor: string; creditor: string; outstanding: bigint };
export type Clearing = {
  /** Debt ids in ring order: creditor(debt[i]) == debtor(debt[i+1]). */
  debtIds: number[];
  /** Amount subtracted from every debt in the cycle (yoctoNEAR). */
  amount: bigint;
  /** Businesses in ring order, ring[i] owes ring[i+1]. */
  ring: string[];
};

type Cycle = { edges: DebtEdge[]; amount: bigint; value: bigint; sortedIds: number[] };

function compareIds(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

function better(a: Cycle, b: Cycle): boolean {
  if (a.value !== b.value) return a.value > b.value;
  return compareIds(a.sortedIds, b.sortedIds) < 0;
}

/** All simple cycles, each found once: it starts at its smallest node name. */
export function simpleCycles(edges: DebtEdge[]): DebtEdge[][] {
  const out = new Map<string, DebtEdge[]>();
  for (const e of [...edges].sort((x, y) => x.id - y.id)) {
    if (e.outstanding <= 0n || e.debtor === e.creditor) continue;
    if (!out.has(e.debtor)) out.set(e.debtor, []);
    out.get(e.debtor)!.push(e);
  }
  const nodes = [...out.keys()].sort();
  const cycles: DebtEdge[][] = [];

  for (const start of nodes) {
    const onPath = new Set<string>([start]);
    const path: DebtEdge[] = [];
    const dfs = (node: string) => {
      for (const e of out.get(node) ?? []) {
        if (e.creditor === start) {
          cycles.push([...path, e]);
        } else if (e.creditor > start && !onPath.has(e.creditor)) {
          onPath.add(e.creditor);
          path.push(e);
          dfs(e.creditor);
          path.pop();
          onPath.delete(e.creditor);
        }
      }
    };
    dfs(start);
  }
  return cycles;
}

function bestCycle(edges: DebtEdge[]): Cycle | null {
  let best: Cycle | null = null;
  for (const cyc of simpleCycles(edges)) {
    const amount = cyc.reduce((m, e) => (e.outstanding < m ? e.outstanding : m), cyc[0].outstanding);
    const c: Cycle = {
      edges: cyc,
      amount,
      value: amount * BigInt(cyc.length),
      sortedIds: cyc.map((e) => e.id).sort((x, y) => x - y),
    };
    if (!best || better(c, best)) best = c;
  }
  return best;
}

/** Greedy clearing plan. Input is not mutated. */
export function planClearings(debts: DebtEdge[]): { clearings: Clearing[]; remaining: DebtEdge[] } {
  let live = debts.filter((d) => d.outstanding > 0n).map((d) => ({ ...d }));
  const clearings: Clearing[] = [];
  for (;;) {
    const best = bestCycle(live);
    if (!best) break;
    clearings.push({
      debtIds: best.edges.map((e) => e.id),
      amount: best.amount,
      ring: best.edges.map((e) => e.debtor),
    });
    const hit = new Set(best.edges.map((e) => e.id));
    live = live
      .map((d) => (hit.has(d.id) ? { ...d, outstanding: d.outstanding - best.amount } : d))
      .filter((d) => d.outstanding > 0n);
  }
  return { clearings, remaining: live };
}
