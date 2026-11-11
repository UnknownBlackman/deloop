// npm run status — read-only: master balance, business accounts, contract totals.
import { accountExists, balanceOf, businessId, contractId, getTotals, masterId } from "../agent/src/near.ts";
import { BUSINESSES } from "../agent/src/config.ts";
import { yoctoToNear } from "../agent/src/amount.ts";

for (const id of [masterId(), ...BUSINESSES.map(businessId), contractId()]) {
  const ok = await accountExists(id);
  console.log(`${id.padEnd(32)} ${ok ? yoctoToNear(await balanceOf(id)) + " NEAR available" : "missing"}`);
}
if (await accountExists(contractId())) {
  try {
    const t = await getTotals();
    console.log(`\ncontract: ${yoctoToNear(t.outstanding_sum)} NEAR outstanding, ${t.count} confirmed debts`);
  } catch (e) {
    console.log(`\ncontract has no deloop code yet (${(e as Error).message.slice(0, 80)})`);
  }
}
