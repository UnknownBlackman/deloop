// npm run setup — testnet only. Creates alpha/bravo/charlie/delta under NEAR_ACCOUNT_ID,
// funds them (bravo/delta 7 NEAR, alpha/charlie 2 NEAR), and deploys the deloop contract to deloop.<NEAR_ACCOUNT_ID>.
import { accountExists, accountUrl, balanceOf, businessId, contractId, masterId } from "../agent/src/near.ts";
import { ensureBusinesses, freshDeploy, SETUP_NEEDS } from "../agent/src/flow.ts";
import { BUSINESSES } from "../agent/src/config.ts";
import { yoctoToNear } from "../agent/src/amount.ts";

const log = (s: string) => console.log("  " + s);
const id = masterId();
if (!(await accountExists(id))) {
  console.error(`\n${id} does not exist on testnet. Create it at https://testnet.mynearwallet.com or with near-cli, then fund it from the faucet.\n`);
  process.exit(1);
}
const bal = await balanceOf(id);
const firstRun = !(await Promise.all(BUSINESSES.map((b) => accountExists(businessId(b))))).every(Boolean);
console.log(`\nMaster ${id}: ${yoctoToNear(bal)} NEAR available`);
if (firstRun && bal < SETUP_NEEDS) {
  console.error(
    `\nNot enough testnet NEAR: ${id} has ${yoctoToNear(bal)} NEAR, setup needs about ${yoctoToNear(SETUP_NEEDS)} NEAR\n` +
      `(bravo + delta 7 NEAR each, alpha + charlie 2 NEAR each, 3 NEAR contract storage = 21 NEAR, plus margin for fees).\n` +
      `Get testnet NEAR from the faucet: https://near-faucet.io  (testnet only, never mainnet)\n`,
  );
  process.exit(1);
}

console.log("\nBusinesses");
await ensureBusinesses(log);
console.log("\nContract");
if (await accountExists(contractId())) log(`${contractId()} already deployed (npm run demo redeploys fresh)`);
else await freshDeploy(log);

console.log(`\nDone. Contract: ${accountUrl(contractId())}\nKeys are in .keys/ (gitignored). Next: npm run demo\n`);
