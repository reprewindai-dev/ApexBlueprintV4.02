import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const tempDir = resolve(root, ".tmp-tests");
const esbuildBin = process.platform === "win32"
  ? resolve(root, "node_modules/@esbuild/win32-x64/esbuild.exe")
  : resolve(root, "node_modules/.bin/esbuild");

const tests = [
  ["src/tests/trust-spine.test.ts", "trust-spine.test.mjs"],
  ["src/tests/security-hardening.test.ts", "security-hardening.test.mjs"],
  ["src/tests/veklom-integration.test.ts", "veklom-integration.test.mjs"],
];

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

for (const [input, output] of tests) {
  execFileSync(
    esbuildBin,
    [input, "--bundle", "--platform=node", "--format=esm", "--packages=external", `--outfile=${resolve(tempDir, output)}`],
    { stdio: "inherit" }
  );
}

const nodeArgs = ["--test", "--test-isolation=none", ...tests.map(([, output]) => resolve(tempDir, output))];
const result = spawnSync(process.execPath, nodeArgs, { stdio: "inherit" });
process.exit(result.status ?? 1);
