import { useCallback, useEffect, useState } from "react";
import { flaggedSamples, live, liveAvailable, replay, type AgentRun, type Backend, type Cleared, type State } from "./backend";

/** The four demo businesses. On testnet they are alpha, bravo, charlie and delta under the master account. */
const BIZ: Record<string, { name: string; short: string; color: string; ink: string }> = {
  alpha: { name: "Maya's Bakery", short: "Maya", color: "#f97316", ink: "#fff" },
  bravo: { name: "Liam's Print Shop", short: "Liam", color: "#e11d48", ink: "#fff" },
  charlie: { name: "Sarah's Courier", short: "Sarah", color: "#eab308", ink: "#1e2433" },
  delta: { name: "Dara's Repairs", short: "Dara", color: "#7c3aed", ink: "#fff" },
};
const ORDER = ["alpha", "bravo", "charlie", "delta"];
const biz = (key: string) => BIZ[key] ?? { name: key, short: key, color: "#5b6474", ink: "#fff" };
/** The agent writes reasons with testnet account names ("charlie's ledger"); show the shops' names. */
const friendly = (text = "") => text.replace(/\b(alpha|bravo|charlie|delta)\b/g, (k) => biz(k).short);

/** Decimal NEAR strings as integers (24 decimals): no floats near amounts. */
const Y = 10n ** 24n;
const toY = (s: string) => {
  const [w, f = ""] = s.split(".");
  return BigInt(w) * Y + BigInt(f.padEnd(24, "0"));
};
const fmtY = (y: bigint) => {
  const f = (y % Y).toString().padStart(24, "0").replace(/0+$/, "");
  return (y / Y).toString() + (f ? "." + f : "");
};
const subNear = (a: string, b: string) => fmtY(toY(a) - toY(b));

/** target: the element the Next bar scrolls to before acting, so the player watches it happen there. */
type Next = { step: 1 | 2 | 3 | 4; text: string; target: string; label?: string; run?: () => void; done?: boolean };

export function App() {
  const [as, setAs] = useState("alpha");
  const [state, setState] = useState<State | null>(null);
  const [agent, setAgent] = useState<AgentRun | null>(null);
  const [cleared, setCleared] = useState<Cleared[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<{ label: string; url?: string } | null>(null);
  const [be, setBe] = useState<Backend | null>(null);
  const [liveOk, setLiveOk] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  // Replay is the default view; Live testnet is one click away when the local API answers (or ?mode=live).
  useEffect(() => {
    const wantLive = new URLSearchParams(location.search).get("mode") === "live";
    setBe(replay);
    liveAvailable().then((ok) => {
      setLiveOk(ok);
      if (ok && wantLive) setBe(live);
    });
  }, []);
  const refresh = useCallback(() => (be ? be.state().then(setState).catch((e) => setError(e.message)) : Promise.resolve()), [be]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  function switchTo(next: Backend) {
    if (next === be) return;
    setAgent(null); setCleared(null); setError(null); setLastTx(null); setState(null);
    setBe(next);
  }
  function startOver() {
    replay.reset?.();
    setAgent(null); setCleared(null); setError(null); setLastTx(null);
    refresh();
  }

  async function act<T>(label: string, fn: () => Promise<T>, after?: (r: T) => void) {
    setBusy(label);
    setError(null);
    setLastTx(null);
    try {
      const r = await fn();
      after?.(r);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const s = state;
  const me = biz(as);
  const outstanding = s?.totals.outstandingNear ?? "0";
  const after = s?.afterClearing.totalNear ?? "0";
  const clearable = s ? subNear(outstanding, after) : "0";
  const loops = cleared ?? s?.afterClearing.cycles ?? [];
  // The flow is one job per step, the same live and in replay:
  //   02 every proposed debt is confirmed -> 03 the loop clears (only then) -> 04 the leftover is paid (only then).
  // Clearing waits for every answer so the loop is chosen over the whole ledger, not a part of it.
  const proposed = s?.debts.filter((d) => d.status === "Proposed") ?? [];
  const proposedLeft = proposed.length;
  const cyclesReady = cleared ? [] : s?.afterClearing.cycles ?? [];
  const canClear = !!s && proposedLeft === 0 && cyclesReady.length > 0;
  const inLoop = new Set(cyclesReady.flatMap((c) => c.debtIds));
  const payOpen = !!s && s.debts.length > 0 && proposedLeft === 0 && cyclesReady.length === 0;
  const leftovers = payOpen ? s!.debts.filter((d) => d.status === "Confirmed") : [];
  const allSettled = !!s && s.debts.length > 0 && s.debts.every((d) => d.status === "Settled");
  // invoices the reconciler flagged never become debts; show them in step 02 so players see why
  const held = (agent?.invoices ?? (s?.debts.length ? flaggedSamples() : [])).filter((i) => i.status === "flagged");
  const loopEmpty = !s || s.debts.length === 0
    ? "Run the agent in step 01, then confirm the debts in step 02. The loop shows here."
    : proposedLeft > 0
      ? `${proposedLeft} debt${proposedLeft > 1 ? "s are" : " is"} still waiting to be confirmed in step 02. The loop shows here once every debt is answered.`
      : "No loop left to clear. What remains is paid in step 04.";
  const totalNear = s ? fmtY(s.debts.reduce((t, d) => t + toY(d.amountNear), 0n)) : "0";
  const clearedNear = cleared ? fmtY(cleared.reduce((t, c) => t + toY(c.amountNear) * BigInt(c.debtIds.length), 0n)) : null;

  // the actions, shared by the step buttons and the Next bar; each signs as the business that must act
  const runAgent = () => act("Running the agent", () => be!.runAgent(), setAgent);
  const confirm = (who: string, id: number) => {
    setAs(who);
    return act(`Confirming debt ${id}`, () => be!.confirm(who, id), (r) => setLastTx({ label: `${biz(who).short} confirmed debt ${id}`, url: r.url }));
  };
  const clear = () => act("Clearing the loop", () => be!.clear(as), setCleared);
  const pay = (who: string, id: number, amountNear: string, to: string) => {
    setAs(who);
    return act(`Paying debt ${id}`, () => be!.pay(who, id), (r) => setLastTx({ label: `${biz(who).short} paid ${biz(to).short} ${amountNear} NEAR`, url: r.url }));
  };

  // what happens next, and who does it (the current business first when it has something to do)
  const mineFirst = <T extends { debtorName: string }>(xs: T[]) => xs.find((d) => d.debtorName === as) ?? xs[0];
  const p = mineFirst(proposed), l = mineFirst(leftovers);
  const next: Next | null = !s
    ? null
    : s.debts.length === 0
      ? { step: 1, target: "s1", text: "run the agent on the sample invoices", label: "Run the agent", run: runAgent }
      : p
        ? { step: 2, target: `debt-${p.id}`, text: `${biz(p.debtorName).short} confirms ${p.invoice_ref}, ${p.amountNear} NEAR owed to ${biz(p.creditorName).short}`, label: `Confirm as ${biz(p.debtorName).short}`, run: () => confirm(p.debtorName, p.id) }
        : canClear
          ? { step: 3, target: "s3", text: `clear the loop ${cyclesReady[0].ring.map((k) => biz(k).short).join(" → ")} → ${biz(cyclesReady[0].ring[0]).short}`, label: "Run clearing", run: clear }
          : l
            ? { step: 4, target: `pay-${l.id}`, text: `${biz(l.debtorName).short} pays ${biz(l.creditorName).short} the ${l.outstandingNear} NEAR left over`, label: `Pay as ${biz(l.debtorName).short}`, run: () => pay(l.debtorName, l.id, l.outstandingNear, l.creditorName) }
            : allSettled
              ? { step: 4, target: "s4", text: "every debt is settled", done: true }
              : null;

  // The Next bar's button: scroll to where the action happens, mark it, then act there.
  function goAndRun(n: Next) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = document.getElementById(n.target);
    if (el) {
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: n.target.startsWith("s") ? "start" : "center" });
      setFlash(n.target);
      window.setTimeout(() => setFlash((f) => (f === n.target ? null : f)), 2000);
    }
    setGoing(true);
    window.setTimeout(() => {
      setGoing(false);
      n.run?.();
    }, reduce || !el ? 0 : 500);
  }

  return (
    <>
      <header className="top">
        <div className="wrap top__bar">
          <a className="top__logo" href="/" aria-label="Deloop home">
            <img src="/deloop-logo.svg" alt="Deloop" width="128" height="29" />
          </a>
          <div className="mode" role="group" aria-label="Mode">
            <button type="button" aria-pressed={be?.mode === "replay"} onClick={() => switchTo(replay)}>Replay</button>
            <button type="button" aria-pressed={be?.mode === "live"} disabled={!liveOk} title={liveOk ? "Sign real transactions on NEAR testnet" : "Live mode needs the local API (npm run dev) and a deployed contract"} onClick={() => switchTo(live)}><i aria-hidden="true" />Live testnet</button>
          </div>
          <nav className="acting" aria-label="Acting as">
            <span className="acting__label">Acting as</span>
            {ORDER.map((k) => (
              <button key={k} type="button" className="acting__who" aria-pressed={as === k} onClick={() => setAs(k)}
                style={{ "--c": biz(k).color } as React.CSSProperties}>
                <span className="av" style={{ background: biz(k).color, color: biz(k).ink }}>{biz(k).short[0]}</span>
                {biz(k).short}
              </button>
            ))}
          </nav>
          <a className="top__home" href="/">Back to the site</a>
        </div>
      </header>

      <main>
        {/* the ledger at a glance: what is owed, what a loop can clear, what is left to pay */}
        <section className="glance">
          <div className="wrap glance__grid">
            <div>
              <p className="note">{be?.mode === "replay" ? "Playing as" : "Signed in as"} {me.name} <span className="mono">({as} on testnet)</span></p>
              <h1>The <span className="pen">ledger</span></h1>
              <p className="glance__lead">
                {s ? <>
                  {next?.done ? <>Every debt is settled. </> : next ? <>Next in step {String(next.step).padStart(2, "0")}: <b>{next.text}</b>. </> : null}
                  Each business signs only its own debts; switch businesses at the top, or use the Next bar below.
                </> : "Reading the ledger."}
              </p>
            </div>
            <dl className="tally" aria-label="Totals">
              <div><dt>Outstanding, confirmed</dt><dd>{s ? outstanding : "…"}</dd></div>
              <div><dt>Cleared by loops, no transfer</dt><dd>{s ? `− ${clearable}` : "…"}</dd></div>
              <div className="tally__total"><dt>Left to pay</dt><dd>{s ? `${after} NEAR` : "…"}</dd></div>
              <p className="tally__foot">{s ? `${s.totals.count} confirmed debts · ${s.afterClearing.paymentsNeeded} payments after clearing` : ""}</p>
            </dl>
          </div>
        </section>

        {be?.mode === "replay" && (
          <div className="wrap">
            <div className="replay-bar">
              <span className="stamp stamp--ink">Replay</span>
              <p>No transaction is sent and no wallet is needed. Each step runs the contract’s own checks in your browser, and where a step matches the recorded 9 November testnet run, it links to that real transaction.</p>
              <button type="button" className="btn btn--ink btn--sm" onClick={startOver} disabled={!!busy}>Start over</button>
            </div>
          </div>
        )}

        {(busy || error || lastTx) && (
          <div className="wrap">
            <div className={`slip ${error ? "slip--err" : busy ? "slip--busy" : "slip--ok"}`} role="status">
              {busy && <><span className="spin" aria-hidden="true" />{busy}… {be?.mode === "live" ? "waiting for NEAR testnet" : "replaying the contract’s checks"}</>}
              {!busy && error && <><span className="stamp stamp--rose">Refused</span>{error}</>}
              {!busy && !error && lastTx && <><span className="stamp">{be?.mode === "live" ? "Signed" : "Replayed"}</span>{lastTx.label}.{" "}{lastTx.url ? <a href={lastTx.url} target="_blank" rel="noreferrer">{be?.mode === "live" ? "See the transaction" : "See the same step in the recorded testnet run"}</a> : be?.mode === "replay" ? <span className="wait">This step was not logged in the recorded run.</span> : null}</>}
            </div>
          </div>
        )}

        {/* 01 invoices */}
        <section className="step" aria-labelledby="s1">
          <div className="wrap">
            <div className="step__head">
              <div>
                <h2 id="s1"><span className="num">01</span>Invoices, <span className="pen">checked</span></h2>
                <p className="hint">The agent reads the sample invoices with the {s?.reader === "llm" ? "LLM" : "regex"} reader and checks each against the payer's own ledger. Matched ones are proposed on-chain by the shop that is owed.</p>
              </div>
              <button type="button" className="btn btn--primary" disabled={!!busy || !be || !!s?.debts.length}
                title={s?.debts.length ? "The agent has already proposed these debts. Start over to run it again." : undefined}
                onClick={runAgent}>
                Run the agent
              </button>
            </div>
            <div className="sheet">
              {!agent && <p className="empty">Run the agent to read <span className="mono">samples/invoices</span>.</p>}
              {agent && (
                <table>
                  <thead><tr><th>Invoice</th><th>Owes</th><th>To</th><th className="r">Amount</th><th>Result</th></tr></thead>
                  <tbody>
                    {agent.invoices.map((i) => (
                      <tr key={i.ref} className={i.status === "flagged" ? "is-flagged" : ""}>
                        <td className="mono">{i.ref}</td>
                        <td><Who k={i.debtor} /></td>
                        <td><Who k={i.creditor} quiet /></td>
                        <td className="r mono">{i.amountNear} NEAR</td>
                        <td>{i.status === "matched"
                          ? <span className="pill pill--ok">Matched</span>
                          : <><span className="stamp stamp--rose">Flagged</span><span className="why">{friendly(i.reason)}</span></>}</td>
                      </tr>
                    ))}
                    {agent.unreadable.map((u) => (
                      <tr key={u.file} className="is-flagged"><td className="mono" colSpan={4}>{u.file}</td><td><span className="stamp stamp--rose">Unreadable</span><span className="why">{u.error}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {agent && held.length > 0 && (
              <p className="note held-note">
                {held.map((i) => i.ref).join(", ")} never reaches step 02. The payer's own ledger disagrees with the invoice, so the agent proposes no debt for it.
              </p>
            )}
          </div>
        </section>

        {/* 02 debts */}
        <section className="step" aria-labelledby="s2">
          <div className="wrap">
            <div className="step__head">
              <div>
                <h2 id="s2"><span className="num">02</span>Debts, <span className="pen">signed twice</span></h2>
                <p className="hint">Only the business that owes can confirm or pay. Contract <a href={s?.contractUrl} target="_blank" rel="noreferrer" className="mono">{s?.contractId}</a></p>
              </div>
            </div>
            <div className="sheet">
              <table>
                <thead><tr><th>#</th><th>Invoice</th><th>Owes</th><th>To</th><th className="r">Amount</th><th className="r">Outstanding</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {s?.debts.length === 0 && <tr><td colSpan={8} className="empty">No debts yet. Run the agent first.</td></tr>}
                  {s?.debts.map((d) => {
                    const mine = d.debtorName === as;
                    const who = biz(d.debtorName).short;
                    return (
                      <tr key={d.id} id={`debt-${d.id}`} className={`${mine ? "is-mine" : ""} ${flash === `debt-${d.id}` ? "is-flash" : ""}`}>
                        <td className="mono">{d.id}</td>
                        <td className="mono">{d.invoice_ref}</td>
                        <td><Who k={d.debtorName} /></td>
                        <td><Who k={d.creditorName} quiet /></td>
                        <td className="r mono">{d.amountNear}</td>
                        <td className={`r mono ${d.status === "Settled" ? "is-zero" : ""}`}>{d.outstandingNear}</td>
                        <td><span className={`pill pill--${d.status.toLowerCase()}`}>{d.status}</span></td>
                        <td className="act">
                          {d.status === "Proposed" && (mine
                            ? <button type="button" className="btn btn--ink btn--sm" disabled={!!busy || !be} onClick={() => confirm(as, d.id)}>Confirm</button>
                            : <button type="button" className="btn btn--ghost btn--sm" disabled={!!busy} onClick={() => setAs(d.debtorName)}
                                title={`Only ${biz(d.debtorName).name} can confirm this debt`}>Switch to {who}</button>)}
                          {d.status === "Confirmed" && <span className="wait">{payOpen ? "Pays in step 04" : inLoop.has(d.id) ? "Clears in step 03" : "Waits for step 03"}</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {held.map((i) => (
                    <tr key={`held-${i.ref}`} className="is-flagged">
                      <td className="mono is-zero">–</td>
                      <td className="mono">{i.ref}</td>
                      <td><Who k={i.debtor} /></td>
                      <td><Who k={i.creditor} quiet /></td>
                      <td className="r mono">{i.amountNear}</td>
                      <td className="r mono is-zero">–</td>
                      <td><span className="stamp stamp--rose stamp--sm">Held</span></td>
                      <td className="act"><span className="why">Flagged in step 01, never proposed</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {held.length > 0 && (
              <p className="note held-note">
                {held.map((i) => i.ref).join(", ")} stays off-chain: {friendly(held[0].reason)}. Until the two shops agree, there is no debt to confirm, clear or pay.
              </p>
            )}
          </div>
        </section>

        {/* 03 clearing */}
        <section className="step step--band" aria-labelledby="s3">
          <div className="wrap">
            <div className="step__head">
              <div>
                <h2 id="s3"><span className="num">03</span>Loops, <span className="pen">cleared</span></h2>
                <p className="hint">Once every debt is answered, Deloop clears the loop worth the most, in one transaction. No NEAR moves.</p>
              </div>
              <button type="button" className="btn btn--light" disabled={!!busy || !canClear} onClick={clear}
                title={!canClear && proposedLeft > 0 ? "Every proposed debt must be confirmed first" : undefined}>
                Run clearing
              </button>
            </div>
            <div className="loops">
              {loops.length === 0 && <p className="empty empty--band">{loopEmpty}</p>}
              {loops.map((c, i) => (
                <div key={i} className="loop">
                  <Ring keys={c.ring} amount={c.amountNear} phase={cleared ? "done" : busy === "Clearing the loop" ? "running" : "ready"} />
                  <div className="loop__text">
                    <p className="loop__names">{c.ring.map((k) => biz(k).short).join(" → ")} → {biz(c.ring[0]).short}</p>
                    <p><span className="mono">{c.amountNear} NEAR</span> off each of {c.debtIds.length} debts <span className="mono">[{c.debtIds.join(", ")}]</span></p>
                    {cleared
                      ? <p><span className="stamp stamp--light">Cleared</span> {(c as Cleared).url && <a href={(c as Cleared).url} target="_blank" rel="noreferrer" className="mono">{be?.mode === "live" ? "tx" : "recorded tx"} {(c as Cleared).hash?.slice(0, 10)}…</a>}</p>
                      : <p className="note note--light">{canClear ? "Ready to clear" : `Waits for ${proposedLeft} more confirmation${proposedLeft > 1 ? "s" : ""} in step 02`}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 04 leftovers */}
        <section className="step" aria-labelledby="s4">
          <div className="wrap">
            <div className="step__head">
              <div>
                <h2 id="s4"><span className="num">04</span>What is <span className="pen">left</span></h2>
                <p className="hint">After clearing, only what no loop could cancel is paid, in NEAR, by the business that owes it.</p>
              </div>
            </div>
            {allSettled ? (
              <div className="settled">
                <span className="stamp">Settled</span>
                <p>
                  All {s!.debts.length} debts are settled.{" "}
                  {clearedNear && <><b className="mono">{totalNear} NEAR</b> of debt, <b className="mono">{clearedNear} NEAR</b> of it cleared by the loop, so only <b className="mono">{subNear(totalNear, clearedNear)} NEAR</b> ever moved.</>}
                </p>
                {be?.mode === "replay" && <button type="button" className="btn btn--ink btn--sm" onClick={startOver} disabled={!!busy}>Play again</button>}
              </div>
            ) : leftovers.length > 0 ? (
              <div className="pays">
                {leftovers.map((d) => (
                  <div key={d.id} id={`pay-${d.id}`} className={`pay ${flash === `pay-${d.id}` ? "is-flash" : ""}`}>
                    <p className="pay__who"><Who k={d.debtorName} /> <span className="pay__arrow" aria-hidden="true">→</span> <Who k={d.creditorName} quiet /></p>
                    <p className="pay__amt mono">{d.outstandingNear} NEAR <span className="wait">debt {d.id} · {d.invoice_ref}</span></p>
                    <button type="button" className="btn btn--primary btn--sm" disabled={!!busy || !be}
                      onClick={() => pay(d.debtorName, d.id, d.outstandingNear, d.creditorName)}>
                      {d.debtorName === as ? `Pay ${d.outstandingNear} NEAR` : `Pay as ${biz(d.debtorName).short}`}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sheet">
                <p className="empty">
                  {!s || s.debts.length === 0 ? "The leftover shows here after steps 02 and 03."
                    : proposedLeft > 0 ? "Confirm every debt in step 02 first."
                    : `Clear the loop in step 03 first. After that, ${after} NEAR is left to pay.`}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* the Next bar: who acts next, and one button that does it as that business (the same actions as the steps) */}
      {next && (
        <aside className={`nextbar ${next.done ? "nextbar--done" : ""}`} aria-label="Next step">
          <div className="wrap nextbar__row">
            <span className="num">{String(next.step).padStart(2, "0")}</span>
            <p><span className="pen">{next.done ? "Done" : "Next"}</span> {next.text.charAt(0).toUpperCase() + next.text.slice(1)}.</p>
            <a className="nextbar__jump" href={`#s${next.step}`}>Show step</a>
            {next.run
              ? <button type="button" className="btn btn--primary btn--sm" disabled={!!busy || !be || going} onClick={() => goAndRun(next)}>{busy || going ? "Working…" : next.label}</button>
              : be?.mode === "replay" && <button type="button" className="btn btn--ink btn--sm" disabled={!!busy} onClick={startOver}>Play again</button>}
          </div>
        </aside>
      )}

      <footer className="foot">
        <div className="wrap foot__row">
          <img src="/deloop-logo.svg" alt="" width="96" height="22" />
          <p>Testnet demo. The local API signs as the business you pick; in production each business signs with its own wallet.</p>
        </div>
      </footer>
    </>
  );
}

function Who({ k, quiet }: { k: string; quiet?: boolean }) {
  const b = biz(k);
  return (
    <span className={`who ${quiet ? "who--quiet" : ""}`} title={`${k} on testnet`}>
      <span className="av" style={{ background: b.color, color: b.ink }}>{b.short[0]}</span>
      {b.name}
    </span>
  );
}

/** The loop. ready: the debts as arrows. running: a pulse travels the ring while the transaction runs.
 *  done: the pulse closes the ring, the debts fade, each shop settles in turn, the centre reads cleared. */
function Ring({ keys, amount, phase }: { keys: string[]; amount: string; phase: "ready" | "running" | "done" }) {
  const R = 82, C = 120, n = keys.length;
  const pts = keys.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [C + R * Math.cos(a), C + R * Math.sin(a)];
  });
  return (
    <svg className={`ring ring--${phase}`} viewBox="0 0 240 240" role="img"
      aria-label={`${keys.map((k) => biz(k).name).join(" owes ")} owes ${biz(keys[0]).name}: ${amount} NEAR each${phase === "done" ? ", cleared" : ""}`}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#fff" />
        </marker>
      </defs>
      <circle className="ring__track" cx={C} cy={C} r={R} />
      <circle className="ring__sweep" cx={C} cy={C} r={R} pathLength={1} transform={`rotate(-90 ${C} ${C})`} />
      <g className="ring__edges">
        {pts.map(([x1, y1], i) => {
          const [x2, y2] = pts[(i + 1) % n];
          const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), k = 32 / len;
          return <line key={i} x1={x1 + dx * k} y1={y1 + dy * k} x2={x2 - dx * k} y2={y2 - dy * k} markerEnd="url(#arr)" />;
        })}
      </g>
      {pts.map(([x, y], i) => {
        const b = biz(keys[i]);
        return (
          <g key={keys[i]} className="ring__node" style={{ "--c": b.color, "--t": b.ink, "--i": i } as React.CSSProperties}>
            <circle cx={x} cy={y} r="27" />
            <text x={x} y={y + 4} textAnchor="middle" className="ring__name">{b.short}</text>
          </g>
        );
      })}
      <g className="ring__mid ring__mid--before">
        <text x={C} y={C + 2} textAnchor="middle" className="ring__amt">{amount} NEAR</text>
        <text x={C} y={C + 20} textAnchor="middle" className="ring__sub">each</text>
      </g>
      <g className="ring__mid ring__mid--after">
        <text x={C} y={C + 4} textAnchor="middle" className="ring__done">Cleared</text>
        <text x={C} y={C + 22} textAnchor="middle" className="ring__sub">0 NEAR moved</text>
      </g>
    </svg>
  );
}
