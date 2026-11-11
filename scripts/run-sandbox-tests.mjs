// Runs tests/contract.sandbox.test.ts against a local NEAR sandbox (near-workspaces).
// near-sandbox ships Linux/macOS binaries only. GitHub Actions (ubuntu) runs it natively;
// on Windows it runs inside a node:20 Linux container if Docker is running.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const WASM = "contract/res/deloop.wasm";
if (!existsSync(WASM)) {
  console.error(`${WASM} missing. Run: npm run build:contract`);
  process.exit(1);
}

const forceDocker = process.argv.includes("--docker");
const useDocker = forceDocker || process.platform === "win32";
const run = (cmd, args) => spawnSync(cmd, args, { stdio: "inherit" }).status ?? 1;

if (!useDocker) {
  process.exit(run(process.execPath, ["--import", "tsx", "--test", "tests/contract.sandbox.test.ts"]));
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

const script = [
  "set -e",
  "mkdir -p /work/contract",
  "cp /src/package.json /src/package-lock.json /work/",
  "cp -r /src/tests /work/tests",
  "cp -r /src/contract/res /work/contract/res",
  "cd /work",
  "npm ci --no-audit --no-fund --loglevel=error",
  "node --import tsx --test tests/contract.sandbox.test.ts",
].join(" && ");

process.exit(
  run("docker", [
    "run", "--rm",
    "-v", `${process.cwd()}:/src:ro`,
    "-v", "deloop-sandbox-node-modules:/work/node_modules",
    "node:20-bookworm", "bash", "-c", script,
  ]),
);
