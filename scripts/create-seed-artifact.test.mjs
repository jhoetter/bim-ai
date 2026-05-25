import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'create-seed-artifact.mjs');

async function writeJson(file, payload) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reverse-bim-seed-guard-'));
  const source = path.join(root, 'source');
  const out = path.join(root, 'out');
  const bundle = path.join(root, 'bundle.json');
  await fs.mkdir(source, { recursive: true });
  await fs.writeFile(path.join(source, 'README.md'), 'source fixture\n', 'utf8');
  await writeJson(bundle, {
    schemaVersion: 'cmd-v3.0',
    commands: [{ type: 'createLevel', id: 'lvl-eg', name: 'EG', elevationMm: 0 }],
  });
  return { root, source, out, bundle };
}

async function runCreateSeed(args) {
  try {
    const result = await execFileAsync('node', [SCRIPT, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return { status: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      status: error.code ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

function acceptedFinalAcceptance(modelId = 'model-accepted') {
  return {
    format: 'reverseBimFinalAcceptance_v1',
    policyVersion: 'reverseBimFinalAcceptancePolicy_v2',
    modelId,
    accepted: true,
    summary: {
      gateCount: 2,
      passedGateCount: 2,
      blockingGateCount: 0,
      blockingGateIds: [],
    },
    gates: [
      { id: 'advisor_clean', passed: true, blockingReasons: [], summary: {} },
      { id: 'ui_evidence', passed: true, blockingReasons: [], summary: {} },
    ],
  };
}

test('seed packaging rejects failed reverse-BIM final acceptance reports', async () => {
  const { root, source, out, bundle } = await fixture();
  const finalAcceptance = path.join(root, 'failed-final-acceptance.json');
  await writeJson(finalAcceptance, {
    ...acceptedFinalAcceptance('model-failed'),
    accepted: false,
    summary: {
      gateCount: 2,
      passedGateCount: 1,
      blockingGateCount: 1,
      blockingGateIds: ['advisor_clean'],
    },
    gates: [
      { id: 'advisor_clean', passed: false, blockingReasons: ['warning remains'], summary: {} },
      { id: 'ui_evidence', passed: true, blockingReasons: [], summary: {} },
    ],
  });

  const result = await runCreateSeed([
    '--name',
    'sample-house-4',
    '--source',
    source,
    '--bundle',
    bundle,
    '--final-acceptance',
    finalAcceptance,
    '--out',
    out,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is not accepted/);
});

test('seed packaging records accepted reverse-BIM final acceptance provenance', async () => {
  const { root, source, out, bundle } = await fixture();
  const finalAcceptance = path.join(root, 'final-acceptance.json');
  await writeJson(finalAcceptance, acceptedFinalAcceptance('model-ok'));

  const result = await runCreateSeed([
    '--name',
    'sample-house-4',
    '--source',
    source,
    '--bundle',
    bundle,
    '--final-acceptance',
    finalAcceptance,
    '--out',
    out,
  ]);

  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(
    await fs.readFile(path.join(out, 'sample-house-4', 'manifest.json'), 'utf8'),
  );
  assert.equal(manifest.acceptance.status, 'accepted');
  assert.equal(manifest.acceptance.layer, 'reverse-bim');
  assert.equal(manifest.acceptance.finalAcceptance, 'evidence/final-acceptance.json');
  assert.equal(manifest.acceptance.modelId, 'model-ok');
  await fs.access(path.join(out, 'sample-house-4', 'evidence', 'final-acceptance.json'));
});
