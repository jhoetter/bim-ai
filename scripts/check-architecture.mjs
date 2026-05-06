#!/usr/bin/env node
/** BIM-ai package DAG guard (sibling repos pattern). */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PACKAGES_DIR = join(REPO_ROOT, "packages");

const ALLOWED = {
  "@bim-ai/design-tokens": new Set(),
  "@bim-ai/icons": new Set(),
  "@bim-ai/core": new Set(),
  "@bim-ai/ui": new Set(["@bim-ai/design-tokens", "@bim-ai/icons"]),
  "@bim-ai/hofos-ui": new Set(["@bim-ai/design-tokens", "@bim-ai/ui"]),
  "@bim-ai/web": new Set(["@bim-ai/design-tokens", "@bim-ai/ui", "@bim-ai/core", "@bim-ai/icons"]),
  "@bim-ai/cli": new Set(),
};

const REACT_BANNED_FOR = new Set(["@bim-ai/design-tokens"]);

const failures = [];

for (const entry of readdirSync(PACKAGES_DIR)) {
  const pkgPath = join(PACKAGES_DIR, entry);
  if (!statSync(pkgPath).isDirectory()) continue;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(pkgPath, "package.json"), "utf8"));
  } catch {
    continue;
  }
  const name = manifest.name;
  if (!name?.startsWith("@bim-ai/")) continue;

  const allowed = ALLOWED[name];
  if (!allowed) {
    failures.push(`Unknown package "${name}" — add to ALLOWED in scripts/check-architecture.mjs`);
    continue;
  }

  const deps = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.peerDependencies ?? {}),
  };

  for (const dep of Object.keys(deps)) {
    if (dep.startsWith("@bim-ai/") && !allowed.has(dep)) {
      failures.push(
        `${name} depends on ${dep} (not allowed). Allowed: ${[...allowed].join(", ") || "(none)"}`,
      );
    }
    if (REACT_BANNED_FOR.has(name) && (dep === "react" || dep === "react-dom")) {
      failures.push(`${name} must remain headless (no react / react-dom).`);
    }
  }
}

if (failures.length > 0) {
  console.error("Architecture check failed:");
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("Architecture check OK");
