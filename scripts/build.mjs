import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, "dist");
const esbuildBin = process.platform === "win32"
  ? resolve(root, "node_modules/@esbuild/win32-x64/esbuild.exe")
  : resolve(root, "node_modules/.bin/esbuild");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(resolve(distDir, "assets"), { recursive: true });

execFileSync(
  esbuildBin,
  [
    "src/main.tsx",
    "--bundle",
    "--format=esm",
    "--platform=browser",
    "--outfile=dist/assets/main.js",
    "--loader:.css=css",
    "--conditions=style",
  ],
  { stdio: "inherit" }
);

const html = readFileSync(resolve(root, "index.html"), "utf8").replace(
  '<script type="module" src="/src/main.tsx"></script>',
  '    <link rel="stylesheet" href="/assets/main.css" />\n    <script type="module" src="/assets/main.js"></script>'
);
writeFileSync(resolve(distDir, "index.html"), html, "utf8");

execFileSync(
  esbuildBin,
  [
    "server.ts",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--packages=external",
    "--sourcemap",
    "--outfile=dist/server.cjs",
  ],
  { stdio: "inherit" }
);
