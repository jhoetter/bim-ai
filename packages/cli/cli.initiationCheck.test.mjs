import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI = path.join(__dirname, 'cli.mjs');

function runCli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI, ...args], {
      env: { ...process.env, ...env },
      cwd: path.resolve(__dirname, '../..'),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c.toString();
    });
    child.stderr.on('data', (c) => {
      stderr += c.toString();
    });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function validIr() {
  return {
    schemaVersion: 'sketch-understanding-ir.v0',
    projectType: 'single_family_house',
    qualityTarget: 'project_initiation_bim',
    sourceInputs: {
      images: ['spec/target-house.jpeg'],
      userInstruction: 'Create a BIM seed model from this sketch.',
    },
    visualRead: {
      primaryView: 'front-left axonometric',
      dominantVolumes: [
        {
          id: 'upper_wrapper',
          description: 'white folded upper shell',
          priority: 'critical',
        },
      ],
      nonNegotiables: ['embedded roof terrace'],
    },
    programme: [
      {
        name: 'Living',
        level: 'ground',
        programmeCode: 'living',
      },
    ],
    features: [
      {
        id: 'roof_terrace',
        kind: 'roof_opening_with_occupied_terrace',
        visualPriority: 'critical',
        mustRenderInViews: ['main', 'roof'],
        capabilityNeeds: ['real roof void', 'guard rail', 'access door'],
      },
    ],
    requiredViews: [
      {
        id: 'main',
        kind: '3d',
        purpose: 'sketch match',
      },
      {
        id: 'roof',
        kind: '3d',
        purpose: 'prove roof cutout',
      },
    ],
    assumptions: [
      {
        id: 'scale',
        statement: 'Scale estimated from image proportions.',
        confidence: 'medium',
        validation: 'compare screenshots',
      },
    ],
  };
}

function validMatrix() {
  return {
    schemaVersion: 'sketch-to-bim-capability-matrix.v0',
    capabilities: [
      {
        id: 'cap.roof_opening_occupied_terrace',
        title: 'Roof opening with occupied terrace',
        featureKinds: ['roof_opening_with_occupied_terrace'],
        status: 'supported',
        commandSurface: ['createRoofOpening'],
        rendererSurface: ['roof mesh subtraction'],
        advisorCoverage: ['opening host warnings'],
        knownFailureModes: ['metadata-only roof opening'],
        requiredEvidence: ['roof screenshot', 'advisor warning JSON'],
        fallback: 'Stop and file a renderer gap.',
      },
    ],
  };
}

test('initiation-check writes coverage and visual checklist for a valid IR', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-initiation-ok-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  await writeJson(irPath, validIr());
  await writeJson(matrixPath, validMatrix());

  const res = await runCli([
    'initiation-check',
    '--ir',
    irPath,
    '--capabilities',
    matrixPath,
    '--out',
    outDir,
  ]);

  assert.equal(res.code, 0, res.stderr);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.summary.errorCount, 0);

  const coverage = JSON.parse(await fs.readFile(path.join(outDir, 'capability-coverage.json'), 'utf8'));
  assert.equal(coverage.features[0].readiness, 'ready');

  const checklist = JSON.parse(await fs.readFile(path.join(outDir, 'visual-checklist.json'), 'utf8'));
  assert.ok(checklist.items.some((item) => item.id === 'roof:roof_terrace'));

  const status = await fs.readFile(path.join(outDir, 'status.md'), 'utf8');
  assert.match(status, /Sketch-to-BIM Initiation Check/);
});

test('initiation-check blocks a critical feature with no capability route', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-initiation-blocked-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  const ir = validIr();
  ir.features[0].kind = 'unsupported_magic_roof';
  await writeJson(irPath, ir);
  await writeJson(matrixPath, validMatrix());

  const res = await runCli([
    'initiate-check',
    '--ir',
    irPath,
    '--capabilities',
    matrixPath,
    '--out',
    outDir,
  ]);

  assert.equal(res.code, 2);
  const coverage = JSON.parse(await fs.readFile(path.join(outDir, 'capability-coverage.json'), 'utf8'));
  assert.equal(coverage.summary.errorCount, 1);
  assert.equal(coverage.features[0].readiness, 'blocked');
  assert.equal(coverage.issues[0].code, 'capability_missing');
});
