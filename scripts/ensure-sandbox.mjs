// node scripts/ensure-sandbox.mjs <version> <dir>
// Installs nearcore's sandbox <version> into <dir> with near-sandbox's own installer, unless it is there.
// near-workspaces then finds it through NEAR_SANDBOX_BINARY_PATH=<dir> (see run-sandbox-tests.mjs).
// It must be installed first: when <dir> has no binary, near-sandbox falls back to its default folder,
// where npm install already put nearcore 2.6.2.
import os from "node:os";
import { Binary } from "near-sandbox";

const [version, dir] = process.argv.slice(2);
const plat = `${os.type()}-${os.arch() === "x64" ? "x86_64" : os.arch()}`;
const url = `https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/${plat}/${version}/near-sandbox.tar.gz`;

const bin = await Binary.create("near-sandbox", [url], dir);
if (await bin.exists()) {
  console.log(`sandbox: nearcore ${version} at ${bin.binPath}`);
} else {
  console.log(`sandbox: downloading nearcore ${version} (${plat}) to ${dir}`);
  await bin.install();
  if (!(await bin.exists())) throw new Error(`nearcore ${version} sandbox did not install into ${dir}`);
}
