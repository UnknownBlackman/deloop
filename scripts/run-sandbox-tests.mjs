// Runs tests/contract.sandbox.test.ts against a local NEAR sandbox (near-workspaces).
// near-sandbox ships Linux/macOS binaries only. GitHub Actions (ubuntu) runs it natively;
// on Windows it runs inside a node:20 Linux container if Docker is running.
//
// The sandbox runs the same nearcore as NEAR testnet. near-workspaces 5 pulls near-sandbox 0.1.x, which
// downloads nearcore 2.6.2: too old for near-sdk 5.2x contracts (they import global-contract host functions
// and use wasm encodings 2.6.2 cannot parse: "PrepareError: Deserialization"). near-sandbox's own installer
// installs SANDBOX_VERSION into .sandbox/<version>/ (gitignored) via scripts/ensure-sandbox.mjs.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const SANDBOX_VERSION = "2.14.1"; // NEAR testnet's nearcore (RPC status) when this was set
const WASM = "contract/res/deloop.wasm";
if (!existsSync(WASM)) {
  console.error(`${WASM} missing. Run: npm run build:contract`);
  process.exit(1);
}

/** The env that makes near-workspaces start nearcore SANDBOX_VERSION from binDir. */
function sandboxEnv(binDir, platform = os.type(), arch = os.arch()) {
  const plat = `${platform}-${arch === "x64" ? "x86_64" : arch}`;
  return {
    SANDBOX_ARTIFACT_URL: `https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/${plat}/${SANDBOX_VERSION}/near-sandbox.tar.gz`,
    NEAR_SANDBOX_BIN_PATH: binDir, // set, so near-sandbox keeps NEAR_SANDBOX_BINARY_PATH below
    NEAR_SANDBOX_BINARY_PATH: binDir,
  };
}

const forceDocker = process.argv.includes("--docker");
const useDocker = forceDocker || process.platform === "win32";
const run = (cmd, args, env) => spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } }).status ?? 1;

if (!useDocker) {
  const env = sandboxEnv(path.resolve(".sandbox", SANDBOX_VERSION));
  if (run(process.execPath, ["scripts/ensure-sandbox.mjs", SANDBOX_VERSION, env.NEAR_SANDBOX_BINARY_PATH]) !== 0) process.exit(1);
  process.exit(run(process.execPath, ["--import", "tsx", "--test", "tests/contract.sandbox.test.ts"], env));
}

if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) {
  const msg =
    "Sandbox tests need Linux/macOS: near-sandbox has no Windows binary, and Docker is not running.\n" +
    "They run in GitHub Actions (.github/workflows/test.yml), or here once Docker Desktop is running.";
  if (process.env.CI || forceDocker) {
    console.error(`\n${msg}\n`);
    process.exit(1);
  }
  console.warn(`\nSKIPPED sandbox tests. ${msg}\n`);
  process.exit(0);
}

const env = sandboxEnv(`/work/.sandbox/${SANDBOX_VERSION}`, "Linux", "x64");
const script = [
  "set -e",
  "mkdir -p /work/contract",
  "cp /src/package.json /src/package-lock.json /work/",
  "cp -r /src/tests /work/tests",
  "cp -r /src/contract/res /work/contract/res",
  "mkdir -p /work/scripts && cp /src/scripts/ensure-sandbox.mjs /work/scripts/",
  "cd /work",
  "npm ci --no-audit --no-fund --loglevel=error",
  `node scripts/ensure-sandbox.mjs ${SANDBOX_VERSION} /work/.sandbox/${SANDBOX_VERSION}`,
  "node --import tsx --test tests/contract.sandbox.test.ts",
].join(" && ");

process.exit(
  run("docker", [
    "run", "--rm",
    ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
    "-v", `${process.cwd()}:/src:ro`,
    "-v", "deloop-sandbox-node-modules:/work/node_modules",
    "node:20-bookworm", "bash", "-c", script,
  ]),
);
