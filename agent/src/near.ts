// Testnet access. TESTNET ONLY: refuses anything that isn't a .testnet account.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Account, KeyPair, type KeyPairString } from "near-api-js";
import { BUSINESSES, KEYS_DIR, ROOT, type Business } from "./config.ts";

try {
  if (existsSync(path.join(ROOT, ".env"))) process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  /* optional */
}

export const RPC_URL = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
export const EXPLORER = "https://testnet.nearblocks.io";
export const txUrl = (hash: string) => `${EXPLORER}/txns/${hash}`;
export const accountUrl = (id: string) => `${EXPLORER}/address/${id}`;
export const GAS = 100_000_000_000_000n; // 100 Tgas

export function masterId(): string {
  const id = process.env.NEAR_ACCOUNT_ID?.trim();
  if (!id) throw new Error("Set NEAR_ACCOUNT_ID (a funded .testnet account) in .env");
  if (!id.endsWith(".testnet")) throw new Error(`NEAR_ACCOUNT_ID must be a .testnet account, got ${id}`);
  return id;
}
export const businessId = (b: Business | string) => `${b}.${masterId()}`;
export const contractId = () => process.env.DELOOP_CONTRACT_ID ?? `deloop.${masterId()}`;
export const nameOf = (accountId: string) => accountId.split(".")[0];

// ---- keys (.keys/ is gitignored) -------------------------------------------
type KeyFile = { account_id: string; public_key: string; private_key: KeyPairString };
const keyPath = (accountId: string) => path.join(KEYS_DIR, `${accountId}.json`);

export function newKey(accountId: string): KeyPair {
  mkdirSync(KEYS_DIR, { recursive: true });
  const kp = KeyPair.fromRandom("ed25519");
  const file: KeyFile = { account_id: accountId, public_key: kp.getPublicKey().toString(), private_key: kp.toString() };
  writeFileSync(keyPath(accountId), JSON.stringify(file, null, 2), { mode: 0o600 });
  return kp;
}

export function loadKey(accountId: string): KeyPairString | null {
  if (!existsSync(keyPath(accountId))) return null;
  return (JSON.parse(readFileSync(keyPath(accountId), "utf8")) as KeyFile).private_key;
}

function masterKey(): KeyPairString {
  const env = process.env.NEAR_PRIVATE_KEY?.trim().replace(/^"|"$/g, "") as KeyPairString | undefined;
  if (env) return env;
  const legacy = path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".near-credentials", "testnet", `${masterId()}.json`);
  if (existsSync(legacy)) return JSON.parse(readFileSync(legacy, "utf8")).private_key;
  throw new Error(`No key for ${masterId()}: set NEAR_PRIVATE_KEY in .env (ed25519:...)`);
}

// ---- accounts ---------------------------------------------------------------
export const master = () => new Account(masterId(), RPC_URL, masterKey());
export const viewer = () => new Account(masterId(), RPC_URL);

export function signerFor(accountId: string): Account {
  if (accountId === masterId()) return master();
  const key = loadKey(accountId);
  if (!key) throw new Error(`No key for ${accountId} in .keys/. Run: npm run setup`);
  return new Account(accountId, RPC_URL, key);
}
export const business = (b: Business | string) => signerFor(businessId(b));
export const allBusinesses = () => BUSINESSES.map((b) => ({ name: b, id: businessId(b) }));

export async function accountExists(id: string): Promise<boolean> {
  try {
    await new Account(id, RPC_URL).getState();
    return true;
  } catch {
    return false;
  }
}

export async function balanceOf(id: string): Promise<bigint> {
  return (await new Account(id, RPC_URL).getState()).balance.available;
}

// ---- contract ---------------------------------------------------------------
export type ChainDebt = {
  id: number;
  debtor: string;
  creditor: string;
  amount: string;
  outstanding: string;
  invoice_ref: string;
  status: "Proposed" | "Confirmed" | "Settled";
};
export type Totals = { outstanding_sum: string; count: number };

export async function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await viewer().provider.callFunction({ contractId: contractId(), method, args })) as T;
}
export const getDebts = () => view<ChainDebt[]>("get_debts");
export const getTotals = () => view<Totals>("get_totals");

export type TxResult = { hash: string; url: string; value?: unknown };

/** Signed call. Throws with the contract's panic message on failure. */
export async function call(
  signer: Account,
  method: string,
  args: Record<string, unknown>,
  deposit: bigint = 0n,
): Promise<TxResult> {
  const res = await signer.callFunctionRaw({ contractId: contractId(), methodName: method, args, deposit, gas: GAS });
  const hash = res.transaction.hash;
  const status = res.status as { SuccessValue?: string; Failure?: unknown };
  if (status.Failure !== undefined) {
    throw new Error(`${method} failed: ${JSON.stringify(status.Failure)} (tx ${hash})`);
  }
  let value: unknown;
  if (status.SuccessValue) {
    try {
      value = JSON.parse(Buffer.from(status.SuccessValue, "base64").toString());
    } catch {
      /* non-JSON return */
    }
  }
  return { hash, url: txUrl(hash), value };
}

// ---- deployment log (public tx hashes for the README; no secrets) -----------
const DEPLOY_LOG = path.join(ROOT, "deployments", "testnet.json");
export function logTx(label: string, hash: string, extra: Record<string, unknown> = {}) {
  mkdirSync(path.dirname(DEPLOY_LOG), { recursive: true });
  const log = existsSync(DEPLOY_LOG) ? JSON.parse(readFileSync(DEPLOY_LOG, "utf8")) : {};
  log[label] = { hash, url: txUrl(hash), at: new Date().toISOString(), ...extra };
  writeFileSync(DEPLOY_LOG, JSON.stringify(log, null, 2) + "\n");
}

/** The last clear_cycle recorded for the current deployment, or null. The contract keeps no history of
 *  loops, so the dashboard reads it here to show a cleared loop after a reload. Only a clearing logged
 *  after this contract's own deploy counts, so an older run never shows against a newer deployment. */
export function lastClearing(contract: string): { ring: string[]; amountNear: string; debtIds: number[]; hash: string; url: string } | null {
  if (!existsSync(DEPLOY_LOG)) return null;
  const log = JSON.parse(readFileSync(DEPLOY_LOG, "utf8"));
  const dep = log.deploy, c = log.clear_cycle;
  if (!dep || !c || dep.contract !== contract || !(c.at >= dep.at)) return null;
  return { ring: (c.ring ?? []).map(nameOf), amountNear: String(c.amount_near), debtIds: c.debt_ids ?? [], hash: c.hash, url: c.url };
}
