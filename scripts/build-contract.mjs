// Builds the contract with the toolchain pinned in contract/rust-toolchain.toml and copies the wasm to
// contract/res/deloop.wasm (committed, so no Rust is needed to deploy). contract/.cargo/config.toml adds
// --cfg near for the wasm target, which near-sdk needs to compile its NEAR host bindings (cargo-near does
// the same); without it, panics trap with no message and hashing falls back to in-wasm code.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";

const BUILT = "contract/target/wasm32-unknown-unknown/release/deloop.wasm";
const OUT = "contract/res/deloop.wasm";

execFileSync("cargo", ["build", "--target", "wasm32-unknown-unknown", "--release"], { cwd: "contract", stdio: "inherit" });
mkdirSync("contract/res", { recursive: true });
copyFileSync(BUILT, OUT);
console.log(`wrote ${OUT}: ${statSync(OUT).size} bytes`);
