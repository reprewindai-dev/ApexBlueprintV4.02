import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "vite";

const root = process.cwd();
const distDir = resolve(root, "dist");
const esbuildBin = process.platform === "win32"
  ? resolve(root, "node_modules/@esbuild/win32-x64/esbuild.exe")
  : resolve(root, "node_modules/.bin/esbuild");

rmSync(distDir, { recursive: true, force: true });

// Build the client with Vite so the Tailwind plugin in vite.config.ts compiles
// utility classes; a raw esbuild bundle ships Tailwind's source CSS unprocessed.
await build({ build: { outDir: distDir, emptyOutDir: true } });

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
