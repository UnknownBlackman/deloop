import { test } from "node:test";
import assert from "node:assert/strict";
import { nearToYocto, yoctoToNear, YOCTO_PER_NEAR } from "../src/amount.ts";

test("nearToYocto parses integers, decimals and thousands separators", () => {
  assert.equal(nearToYocto("10"), 10n * YOCTO_PER_NEAR);
  assert.equal(nearToYocto("10.00"), 10n * YOCTO_PER_NEAR);
  assert.equal(nearToYocto("0.000000000000000000000001"), 1n);
  assert.equal(nearToYocto(" 1,250.5 "), 1250n * YOCTO_PER_NEAR + YOCTO_PER_NEAR / 2n);
});

test("nearToYocto rejects garbage, negatives and > 24 decimals", () => {
  for (const bad of ["", "abc", "-1", "1e3", "1.0000000000000000000000001", "1.2.3"]) {
    assert.throws(() => nearToYocto(bad), bad);
  }
});

test("yoctoToNear round-trips", () => {
  for (const s of ["0", "10", "7.5", "0.000000000000000000000001"]) assert.equal(yoctoToNear(nearToYocto(s)), s);
});
