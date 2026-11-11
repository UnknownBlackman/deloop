// The ONE place NEAR strings become yoctoNEAR. Integers only (BigInt), never floats.
export const YOCTO_PER_NEAR = 10n ** 24n;
const DECIMALS = 24;

/** "10", "10.5", "1,250.000001" (NEAR) -> yoctoNEAR bigint. Throws on anything else. */
export function nearToYocto(input: string): bigint {
  const s = input.trim().replace(/,/g, "");
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`Not a NEAR amount: "${input}"`);
  const [, whole, frac = ""] = m;
  if (frac.length > DECIMALS) throw new Error(`Too many decimals: "${input}"`);
  return BigInt(whole) * YOCTO_PER_NEAR + BigInt(frac.padEnd(DECIMALS, "0"));
}

/** yoctoNEAR -> "10", "10.5" (trailing zeros trimmed). */
export function yoctoToNear(yocto: bigint | string): string {
  const y = BigInt(yocto);
  const sign = y < 0n ? "-" : "";
  const abs = y < 0n ? -y : y;
  const whole = abs / YOCTO_PER_NEAR;
  const frac = (abs % YOCTO_PER_NEAR).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return sign + whole.toString() + (frac ? "." + frac : "");
}
