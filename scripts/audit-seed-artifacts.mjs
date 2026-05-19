#!/usr/bin/env node
/**
 * Audit committed seed-artifact packages for disposable local output.
 *
 * This gate is intentionally non-mutating. It classifies valid packaged seed
 * artifacts as approved, reports unapproved paths with suggested actions, and
 * lets callers allowlist known exceptions explicitly.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_ROOT = path.join(REPO_ROOT, 'seed-artifacts');
const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const MANIFEST_SCHEMA = 'bim-ai.seed-artifact.v1';
const SUSPICIOUS_NAME_RE =
  /(^|[._/-])(disposable|scratch|tmp|temp|local|wave\d*|worker-[a-z0-9]+|nightshift)([._/-]|$)/i;

function usage() {
  console.error(`Usage:
  node scripts/audit-seed-artifacts.mjs [--root seed-artifacts] [--check]
    [--allow <relative-path>]... [--json] [--out spec/generated/seed-artifact-cleanliness.md]

Audits seed artifact packages without deleting files. In --check mode, exits
nonzero when unapproved artifacts or invalid metadata are present.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    root: DEFAULT_ROOT,
    check: false,
    json: false,
    out: null,
    allow: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--root' && argv[i + 1]) args.root = argv[++i];
    else if (arg === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (arg === '--allow' && argv[i + 1]) args.allow.push(argv[++i]);
    else usage();
  }
  return args;
}

async function exists(file) {
  return fs
    .stat(file)
    .then(() => true)
    .catch(() => false);
}

async function readJsonFinding(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return { value: parsed, error: null };
  } catch (error) {
    return { value: null, error };
  }
}

function normalizeRel(rawPath) {
  return rawPath.split(path.sep).join('/');
}

function portable(absPath, base = REPO_ROOT) {
  const rel = path.relative(base, absPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
    ? normalizeRel(rel)
    : normalizeRel(absPath);
}

function rootRelative(absPath, root) {
  return normalizeRel(path.relative(root, absPath));
}

function pathIsInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function isAllowed(absPath, root, allowSet) {
  if (!allowSet.size) return false;
  const rel = rootRelative(absPath, root);
  for (const allowed of allowSet) {
    if (rel === allowed || rel.startsWith(`${allowed}/`)) return true;
  }
  return false;
}

function addFinding(result, severity, code, message, absPath, details = {}) {
  result.findings.push({
    severity,
    code,
    message,
    path: portable(absPath),
    suggestion: suggestAction(code, absPath),
    ...details,
  });
}

function addApproved(result, kind, absPath, details = {}) {
  result.approved.push({ kind, path: portable(absPath), ...details });
}

function addAllowed(result, code, message, absPath, details = {}) {
  result.allowed.push({ code, message, path: portable(absPath), ...details });
}

function suggestAction(code, absPath) {
  const rel = portable(absPath);
  if (code === 'artifact_metadata_missing') {
    return `Package ${rel} with scripts/create-seed-artifact.mjs or move it outside seed-artifacts/.`;
  }
  if (code === 'artifact_metadata_invalid') {
    return `Fix ${rel}/manifest.json metadata or remove the incomplete artifact folder.`;
  }
  if (code === 'disposable_artifact') {
    return `Move ${rel} to tmp/, spec/generated/, or an explicit allowlist entry if it is intentionally committed.`;
  }
  return `Move ${rel} outside seed-artifacts/ or add an explicit --allow entry with a reason in review.`;
}

async function walkFilesAndDirs(root) {
  const entries = [];
  async function visit(current) {
    const stat = await fs.lstat(current);
    entries.push({ path: current, stat });
    if (!stat.isDirectory()) return;
    const children = await fs.readdir(current, { withFileTypes: true });
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      await visit(path.join(current, child.name));
    }
  }
  if (await exists(root)) await visit(root);
  return entries;
}

function metadataSignalsDisposable(value) {
  if (!value || typeof value !== 'object') return null;
  const fields = [
    value.kind,
    value.type,
    value.source,
    value.agent,
    value.worker,
    value.wave,
    value.evidenceType,
    value.generatedBy?.agent,
    value.generatedBy?.worker,
  ]
    .filter((field) => typeof field === 'string' || typeof field === 'number')
    .map(String);
  if (value.disposable === true || value.localOnly === true || value.temporary === true) {
    return 'metadata marks this file as disposable/local/temporary';
  }
  const matched = fields.find((field) => SUSPICIOUS_NAME_RE.test(field));
  return matched ? `metadata contains disposable marker ${JSON.stringify(matched)}` : null;
}

function validateManifest(manifest, manifestPath, artifactDir) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('manifest.json must contain a JSON object');
    return errors;
  }
  if (manifest.schemaVersion !== MANIFEST_SCHEMA) {
    errors.push(`schemaVersion must be ${MANIFEST_SCHEMA}`);
  }
  const name = String(manifest.name ?? path.basename(artifactDir)).trim();
  const slug = String(manifest.slug ?? name).trim();
  if (!NAME_RE.test(name)) errors.push('name must be a lowercase seed artifact slug');
  if (!NAME_RE.test(slug)) errors.push('slug must be a lowercase seed artifact slug');
  for (const [field, fallback] of [
    ['bundle', 'bundle.json'],
    ['sourceRoot', 'source'],
    ['evidenceRoot', 'evidence'],
  ]) {
    const rawValue = String(manifest[field] ?? fallback);
    const resolved = path.resolve(artifactDir, rawValue);
    if (!pathIsInside(resolved, artifactDir)) {
      errors.push(`${field} must stay inside the artifact directory`);
    }
  }
  return errors;
}

async function classifyArtifactDir(result, artifactDir, root, allowSet) {
  const manifestPath = path.join(artifactDir, 'manifest.json');
  if (!(await exists(manifestPath))) {
    const suspiciousName = SUSPICIOUS_NAME_RE.test(portable(artifactDir));
    if (isAllowed(artifactDir, root, allowSet)) {
      addAllowed(
        result,
        'artifact_metadata_missing',
        'Allowed artifact directory without seed metadata.',
        artifactDir,
        {
          classification: suspiciousName ? 'disposable/local/wave filename' : 'unpackaged',
        },
      );
    } else {
      addFinding(
        result,
        'error',
        'artifact_metadata_missing',
        'Seed artifact directory is not an approved package because manifest.json is missing.',
        artifactDir,
        {
          classification: suspiciousName ? 'disposable/local/wave filename' : 'unpackaged',
        },
      );
    }
    return null;
  }

  const { value: manifest, error } = await readJsonFinding(manifestPath);
  const manifestErrors = error
    ? [`invalid JSON: ${error.message}`]
    : validateManifest(manifest, manifestPath, artifactDir);
  if (manifestErrors.length) {
    if (isAllowed(artifactDir, root, allowSet) || isAllowed(manifestPath, root, allowSet)) {
      addAllowed(
        result,
        'artifact_metadata_invalid',
        'Allowed artifact directory with invalid metadata.',
        manifestPath,
        {
          metadataErrors: manifestErrors,
        },
      );
    } else {
      addFinding(
        result,
        'error',
        'artifact_metadata_invalid',
        'Seed artifact directory has invalid manifest metadata.',
        manifestPath,
        { metadataErrors: manifestErrors },
      );
    }
    return null;
  }

  const bundleRel = String(manifest.bundle ?? 'bundle.json');
  const sourceRel = String(manifest.sourceRoot ?? 'source');
  const evidenceRel = String(manifest.evidenceRoot ?? 'evidence');
  const approvedRoots = [
    manifestPath,
    path.resolve(artifactDir, bundleRel),
    path.resolve(artifactDir, sourceRel),
    path.resolve(artifactDir, evidenceRel),
  ];

  for (const approvedPath of approvedRoots) {
    if (!(await exists(approvedPath))) {
      addFinding(
        result,
        'error',
        'approved_artifact_path_missing',
        'Approved seed artifact metadata points to a missing path.',
        approvedPath,
        {
          artifact: portable(artifactDir),
        },
      );
    }
  }

  addApproved(result, 'seed-artifact', artifactDir, {
    name: manifest.name,
    slug: manifest.slug ?? manifest.name,
    title: manifest.title ?? manifest.name,
    acceptanceStatus: manifest.acceptance?.status ?? null,
  });

  const entries = await walkFilesAndDirs(artifactDir);
  for (const entry of entries) {
    if (entry.path === artifactDir || entry.path === manifestPath) continue;
    const approved = approvedRoots.some((approvedPath) => pathIsInside(entry.path, approvedPath));
    const suspicious = SUSPICIOUS_NAME_RE.test(rootRelative(entry.path, root));
    let metadataSignal = null;
    if (entry.stat.isFile() && entry.path.endsWith('.json')) {
      const { value } = await readJsonFinding(entry.path);
      metadataSignal = metadataSignalsDisposable(value);
    }
    if (approved && !suspicious && !metadataSignal) continue;
    if (isAllowed(entry.path, root, allowSet)) {
      addAllowed(
        result,
        approved ? 'allowed_disposable_artifact' : 'allowed_unapproved_artifact_path',
        approved
          ? 'Allowed disposable-looking path inside an approved seed artifact.'
          : 'Allowed path outside approved seed artifact layout.',
        entry.path,
        { metadataSignal },
      );
      continue;
    }
    if (!approved) {
      addFinding(
        result,
        'error',
        'unapproved_artifact_path',
        'Path is outside manifest.json, bundle, sourceRoot, and evidenceRoot.',
        entry.path,
      );
    } else if (suspicious || metadataSignal) {
      addFinding(
        result,
        'error',
        'disposable_artifact',
        'Path inside an approved seed artifact looks disposable/local/wave-scoped.',
        entry.path,
        { metadataSignal },
      );
    }
  }
  return manifest;
}

export async function auditSeedArtifacts(options = {}) {
  const root = path.resolve(options.root ?? DEFAULT_ROOT);
  const allowSet = new Set(
    (options.allow ?? []).map((entry) => normalizeRel(path.normalize(entry))),
  );
  const result = {
    ok: true,
    root: portable(root),
    approved: [],
    allowed: [],
    findings: [],
  };

  if (!(await exists(root))) {
    return result;
  }

  const children = await fs.readdir(root, { withFileTypes: true });
  for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
    const childPath = path.join(root, child.name);
    if (child.isDirectory()) {
      await classifyArtifactDir(result, childPath, root, allowSet);
      continue;
    }
    const { value } = child.name.endsWith('.json')
      ? await readJsonFinding(childPath)
      : { value: null };
    const metadataSignal = metadataSignalsDisposable(value);
    const code =
      SUSPICIOUS_NAME_RE.test(child.name) || metadataSignal
        ? 'disposable_artifact'
        : 'unapproved_artifact_path';
    if (isAllowed(childPath, root, allowSet)) {
      addAllowed(result, code, 'Allowed root-level file in seed-artifacts.', childPath, {
        metadataSignal,
      });
    } else {
      addFinding(
        result,
        'error',
        code,
        'Root-level files are not approved seed artifacts.',
        childPath,
        {
          metadataSignal,
        },
      );
    }
  }

  result.ok = result.findings.length === 0;
  return result;
}

function renderText(result) {
  const lines = [
    `Seed artifact cleanliness audit: ${result.ok ? 'OK' : 'FAILED'}`,
    `Root: ${result.root}`,
    `Approved artifacts: ${result.approved.length}`,
    `Allowed exceptions: ${result.allowed.length}`,
    `Findings: ${result.findings.length}`,
    '',
  ];
  if (result.approved.length) {
    lines.push('Approved:');
    for (const item of result.approved) {
      lines.push(
        `- ${item.path} (${item.kind}; name=${item.name}; acceptance=${item.acceptanceStatus ?? 'n/a'})`,
      );
    }
    lines.push('');
  }
  if (result.allowed.length) {
    lines.push('Allowed exceptions:');
    for (const item of result.allowed) {
      lines.push(`- ${item.path}: ${item.message}`);
    }
    lines.push('');
  }
  if (result.findings.length) {
    lines.push('Unapproved artifacts:');
    for (const finding of result.findings) {
      const detail = finding.metadataSignal ? ` ${finding.metadataSignal}.` : '';
      lines.push(`- [${finding.code}] ${finding.path}: ${finding.message}${detail}`);
      lines.push(`  Suggested action: ${finding.suggestion}`);
    }
  } else {
    lines.push('No unapproved disposable/local/wave artifacts found.');
  }
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(result) {
  const lines = [
    '# Seed Artifact Cleanliness',
    '',
    `- Status: ${result.ok ? 'OK' : 'FAILED'}`,
    `- Root: \`${result.root}\``,
    `- Approved artifacts: ${result.approved.length}`,
    `- Allowed exceptions: ${result.allowed.length}`,
    `- Findings: ${result.findings.length}`,
    '',
    '## Approved',
    '',
  ];
  if (result.approved.length) {
    for (const item of result.approved) {
      lines.push(
        `- \`${item.path}\` (${item.kind}; name=\`${item.name}\`; acceptance=\`${item.acceptanceStatus ?? 'n/a'}\`)`,
      );
    }
  } else {
    lines.push('- None');
  }
  lines.push('', '## Findings', '');
  if (result.findings.length) {
    for (const finding of result.findings) {
      lines.push(`- \`${finding.path}\` [${finding.code}]: ${finding.message}`);
      lines.push(`  Suggested action: ${finding.suggestion}`);
    }
  } else {
    lines.push('- No unapproved disposable/local/wave artifacts found.');
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await auditSeedArtifacts(args);
  if (args.out) {
    const outPath = path.resolve(args.out);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, renderMarkdown(result), 'utf8');
  }
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : renderText(result));
  if (args.check && !result.ok) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(2);
  });
}
