import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { auditSeedArtifacts } from '../../scripts/audit-seed-artifacts.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const AUDIT = path.join(ROOT, 'scripts/audit-seed-artifacts.mjs');

async function makeTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-seed-artifacts-'));
}

async function writeJson(file, payload) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function makeSeedArtifact(root, name = 'target-house-1') {
  const artifactDir = path.join(root, name);
  await fs.mkdir(path.join(artifactDir, 'source'), { recursive: true });
  await fs.mkdir(path.join(artifactDir, 'evidence'), { recursive: true });
  await writeJson(path.join(artifactDir, 'bundle.json'), {
    schemaVersion: 'cmd-v3.0',
    commands: [],
  });
  await fs.writeFile(path.join(artifactDir, 'source', 'target-house-seed.md'), '# Seed\n', 'utf8');
  await fs.writeFile(path.join(artifactDir, 'evidence', 'README.md'), '# Evidence\n', 'utf8');
  await writeJson(path.join(artifactDir, 'manifest.json'), {
    schemaVersion: 'bim-ai.seed-artifact.v1',
    name,
    slug: name,
    title: 'Target House 1',
    bundle: 'bundle.json',
    sourceRoot: 'source',
    evidenceRoot: 'evidence',
    acceptance: {
      status: 'accepted',
    },
  });
  return artifactDir;
}

function runAudit(args) {
  return new Promise((resolve) => {
    const child = spawn('node', [AUDIT, ...args], { cwd: ROOT, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

test('seed artifact cleanliness audit accepts a clean packaged library', async () => {
  const root = await makeTempRoot();
  await makeSeedArtifact(root);

  const result = await auditSeedArtifacts({ root });

  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 0);
  assert.equal(result.approved.length, 1);
  assert.equal(result.approved[0].name, 'target-house-1');
});

test('seed artifact cleanliness audit rejects disposable wave artifacts in check mode', async () => {
  const root = await makeTempRoot();
  await makeSeedArtifact(root);
  await writeJson(path.join(root, 'target-house-1', 'evidence', 'wave3-worker-e.json'), {
    disposable: true,
    wave: 'wave3',
  });

  const res = await runAudit(['--root', root, '--check', '--json']);
  const payload = JSON.parse(res.stdout);

  assert.equal(res.code, 1);
  assert.equal(payload.ok, false);
  assert.ok(payload.findings.some((finding) => finding.code === 'disposable_artifact'));
  assert.ok(payload.findings.some((finding) => finding.path.endsWith('wave3-worker-e.json')));
});

test('seed artifact cleanliness audit reports missing and invalid metadata', async () => {
  const root = await makeTempRoot();
  await fs.mkdir(path.join(root, 'local-scratch'), { recursive: true });
  await fs.mkdir(path.join(root, 'invalid-artifact'), { recursive: true });
  await fs.writeFile(path.join(root, 'invalid-artifact', 'manifest.json'), '{not json', 'utf8');

  const result = await auditSeedArtifacts({ root });
  const codes = result.findings.map((finding) => finding.code);

  assert.equal(result.ok, false);
  assert.ok(codes.includes('artifact_metadata_missing'));
  assert.ok(codes.includes('artifact_metadata_invalid'));
  assert.ok(
    result.findings.some(
      (finding) =>
        finding.code === 'artifact_metadata_missing' &&
        finding.classification === 'disposable/local/wave filename',
    ),
  );
});

test('seed artifact cleanliness audit honors explicit allowlist paths', async () => {
  const root = await makeTempRoot();
  await makeSeedArtifact(root);
  await fs.mkdir(path.join(root, 'wave3-worker-e'), { recursive: true });
  await fs.writeFile(path.join(root, 'wave3-worker-e', 'notes.md'), 'local notes\n', 'utf8');

  const blocked = await auditSeedArtifacts({ root });
  const allowed = await auditSeedArtifacts({ root, allow: ['wave3-worker-e'] });

  assert.equal(blocked.ok, false);
  assert.equal(allowed.ok, true);
  assert.equal(allowed.findings.length, 0);
  assert.equal(allowed.allowed.length, 1);
  assert.equal(allowed.allowed[0].path.endsWith('wave3-worker-e'), true);
});
