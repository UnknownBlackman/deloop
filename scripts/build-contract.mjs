// Builds the contract with the toolchain pinned in contract/rust-toolchain.toml
// and copies the wasm to contract/res/deloop.wasm (committed, so no Rust needed to deploy).
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";

execFileSync("cargo", ["build", "--target", "wasm32-unknown-unknown", "--release"], { cwd: "contract", stdio: "inherit" });
mkdirSync("contract/res", { recursive: true });
copyFileSync("contract/target/wasm32-unknown-unknown/release/deloop.wasm", "contract/res/deloop.wasm");
console.log("wrote contract/res/deloop.wasm");
