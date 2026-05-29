#!/usr/bin/env node
/** BIM-ai package DAG and feature-boundary guard. */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');
const BOUNDARIES_PATH = join(REPO_ROOT, 'spec', 'governance', 'architecture-boundaries.json');

// ALLOWED maps each `@bim-ai/*` package to the set of sibling packages it may
// declare as a `dependencies` / `peerDependencies` entry in `package.json`.
//
// `@bim-ai/cli` is intentionally `new Set()` — the CLI is a delivery artifact
// (an executable binary, not a reusable library) and pulls in sibling code at
// runtime via direct relative or workspace imports without declaring them in
// its manifest. This is by design; documenting it here keeps `pnpm architecture`
// from flagging the missing-dep entry as drift (ARCH-CQ-03).
//
// ---
// Side-effect chain-imports at the bottom of a file are a FORBIDDEN pattern.
//
// Before PR #144, `cmdPalette/defaultCommands.ts` ended with a bare
// `import './defaultCommandsDisplayAndExtras';` whose sole purpose was to
// trigger registration side-effects. The extras file in turn imported helpers
// FROM `defaultCommands` — a cycle. Under Vite/Vitest's CommonJS interop the
// named imports resolved to `undefined` during the cycle, causing entries to
// register with `isAvailable: undefined` and breaking the cmdPalette test
// suite.
//
// The cure is structural: do NOT chain-import a sibling module just to
// trigger its registration side-effects. Either (a) re-export it from the
// importer's public surface so callers consume one symbol, or (b) make
// callers do an explicit side-effect import at the entry point where the
// registration is actually needed.
//
// The `web-workspace-no-index-self-import` rule in
// `spec/governance/architecture-boundaries.json` mechanises this for the
// workspace package: any file under `packages/web/src/workspace/**` is
// forbidden from importing `workspace/index.ts`. No such index file exists
// today, but adding one without this guard would re-enable the bug class.
const ALLOWED = {
  '@bim-ai/design-tokens': new Set(),
  '@bim-ai/icons': new Set(),
  '@bim-ai/core': new Set(),
  '@bim-ai/ui': new Set(['@bim-ai/design-tokens', '@bim-ai/icons']),
  // ARCH-CQ-05-a: `web-state` is the lowest layer of the planned 4-way split
  // of `packages/web` (state / viewport / plan / shell). It depends only on
  // `core` and reacts/zustand peer deps; it MUST NOT import anything from
  // packages/web (the `web-state-self-contained` rule in
  // architecture-boundaries.json mechanises this).
  '@bim-ai/web-state': new Set(['@bim-ai/core']),
  '@bim-ai/web': new Set([
    '@bim-ai/design-tokens',
    '@bim-ai/ui',
    '@bim-ai/core',
    '@bim-ai/icons',
    '@bim-ai/web-state',
  ]),
  // CLI is a delivery artifact; it may import any sibling package.
  '@bim-ai/cli': new Set(),
};

const REACT_BANNED_FOR = new Set(['@bim-ai/design-tokens']);

const failures = [];

function toRepoPath(absPath) {
  return relative(REPO_ROOT, absPath).split(sep).join('/');
}

function walkFiles(dir, predicate, out = []) {
  for (const entry of readdirSync(dir)) {
    const absPath = join(dir, entry);
    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.turbo' || entry === '__pycache__') continue;
      walkFiles(absPath, predicate, out);
    } else if (predicate(absPath)) {
      out.push(absPath);
    }
  }
  return out;
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesAny(repoPath, globs = []) {
  return globs.some((glob) => globToRegExp(glob).test(repoPath));
}

function extractImports(sourceText, kind) {
  const imports = [];
  if (kind === 'py') {
    const fromRe = /^\s*from\s+([A-Za-z0-9_\\.]+)\s+import\s+/gm;
    const importRe = /^\s*import\s+([A-Za-z0-9_\\.]+)/gm;
    for (const match of sourceText.matchAll(fromRe)) imports.push(match[1]);
    for (const match of sourceText.matchAll(importRe)) imports.push(match[1]);
    return imports;
  }
  const importRe =
    /(?:import|export)\s+(?:type\s+)?(?:[^'"`]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of sourceText.matchAll(importRe)) imports.push(match[1] ?? match[2]);
  return imports.filter(Boolean);
}

function resolveTsImport(sourceRepoPath, specifier) {
  if (!specifier.startsWith('.')) return null;
  const baseDir = dirname(sourceRepoPath);
  const normalized = normalize(join(baseDir, specifier)).split(sep).join('/');
  const candidates = extname(normalized)
    ? [normalized]
    : [
        `${normalized}.ts`,
        `${normalized}.tsx`,
        `${normalized}.js`,
        `${normalized}.jsx`,
        `${normalized}.mjs`,
        `${normalized}/index.ts`,
        `${normalized}/index.tsx`,
      ];
  return candidates.find((candidate) => {
    try {
      return statSync(join(REPO_ROOT, candidate)).isFile();
    } catch {
      return false;
    }
  }) ?? normalized;
}

function resolvePyImport(specifier) {
  if (!specifier.startsWith('app.bim_ai.')) return null;
  const modulePath = specifier.replaceAll('.', '/');
  const filePath = `${modulePath}.py`;
  try {
    if (statSync(join(REPO_ROOT, filePath)).isFile()) return filePath;
  } catch {
    // Fall through to package path.
  }
  return `${modulePath}/__init__.py`;
}

function checkFeatureBoundaries() {
  let config;
  try {
    config = JSON.parse(readFileSync(BOUNDARIES_PATH, 'utf8'));
  } catch (error) {
    failures.push(`Could not read architecture boundary config: ${error.message}`);
    return;
  }
  const rules = Array.isArray(config.rules) ? config.rules : [];
  // Boundary rules apply to production source. JS/TS test files (`.test.*`, `.spec.*`)
  // are excluded because they routinely seed stores, mock workspace shell internals,
  // and exercise cross-layer behaviour by design — that's the test's job.
  const isJsTestFile = (file) => /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(file);
  const files = [
    ...walkFiles(
      join(REPO_ROOT, 'packages', 'web', 'src'),
      (file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file) && !isJsTestFile(file),
    ),
    // ARCH-CQ-05-a: include extracted layer packages so their boundary
    // rules (e.g. `web-state-self-contained`) are evaluated. Sibling
    // ARCH-CQ-05-b/-c/-d will add `web-viewport`, `web-plan`, `web-shell`
    // here when those packages land.
    ...walkFiles(
      join(REPO_ROOT, 'packages', 'web-state', 'src'),
      (file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file) && !isJsTestFile(file),
    ),
    ...walkFiles(join(REPO_ROOT, 'app', 'bim_ai'), (file) => /\.py$/.test(file)),
  ];

  for (const absPath of files) {
    const sourceRepoPath = toRepoPath(absPath);
    const relevantRules = rules.filter((rule) => matchesAny(sourceRepoPath, rule.source ?? []));
    if (!relevantRules.length) continue;
    const kind = sourceRepoPath.endsWith('.py') ? 'py' : 'ts';
    const sourceText = readFileSync(absPath, 'utf8');
    for (const specifier of extractImports(sourceText, kind)) {
      const targetRepoPath =
        kind === 'py' ? resolvePyImport(specifier) : resolveTsImport(sourceRepoPath, specifier);
      if (!targetRepoPath) continue;
      for (const rule of relevantRules) {
        const disallowed = matchesAny(targetRepoPath, rule.disallow ?? []);
        const allowed = matchesAny(targetRepoPath, rule.allow ?? []);
        if (disallowed && !allowed) {
          failures.push(
            `${sourceRepoPath} imports ${targetRepoPath}, violating ${rule.id}: ${rule.reason}`,
          );
        }
      }
    }
  }
}

for (const entry of readdirSync(PACKAGES_DIR)) {
  const pkgPath = join(PACKAGES_DIR, entry);
  if (!statSync(pkgPath).isDirectory()) continue;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(pkgPath, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  const name = manifest.name;
  if (!name?.startsWith('@bim-ai/')) continue;

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
    if (dep.startsWith('@bim-ai/') && !allowed.has(dep)) {
      failures.push(
        `${name} depends on ${dep} (not allowed). Allowed: ${[...allowed].join(', ') || '(none)'}`,
      );
    }
    if (REACT_BANNED_FOR.has(name) && (dep === 'react' || dep === 'react-dom')) {
      failures.push(`${name} must remain headless (no react / react-dom).`);
    }
  }
}

checkFeatureBoundaries();

if (failures.length > 0) {
  console.error('Architecture check failed:');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('Architecture check OK');
