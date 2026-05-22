#!/usr/bin/env node
/** BIM-ai package DAG and feature-boundary guard. */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');
const BOUNDARIES_PATH = join(REPO_ROOT, 'spec', 'governance', 'architecture-boundaries.json');

const ALLOWED = {
  '@bim-ai/design-tokens': new Set(),
  '@bim-ai/icons': new Set(),
  '@bim-ai/core': new Set(),
  '@bim-ai/ui': new Set(['@bim-ai/design-tokens', '@bim-ai/icons']),
  '@bim-ai/hofos-ui': new Set(['@bim-ai/design-tokens', '@bim-ai/ui']),
  '@bim-ai/web': new Set(['@bim-ai/design-tokens', '@bim-ai/ui', '@bim-ai/core', '@bim-ai/icons']),
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
  const files = [
    ...walkFiles(join(REPO_ROOT, 'packages', 'web', 'src'), (file) =>
      /\.(ts|tsx|js|jsx|mjs)$/.test(file),
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
