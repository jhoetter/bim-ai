import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runLiveEvidence } from './simple-house-live-evidence.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function writeJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function createEvidenceServer() {
  const requests = [];
  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fea73581e40000000049454e44ae426082',
    'hex',
  );
  const pdfBytes = Buffer.from('%PDF-1.4\n% simple-house live runner stub\n', 'utf8');
  const server = http.createServer(async (request, response) => {
    const body = request.method === 'POST' ? JSON.parse(await readBody(request)) : null;
    requests.push({ method: request.method, url: request.url, body });

    if (request.method === 'POST' && request.url === '/api/projects/project-1/models') {
      writeJson(response, 201, {
        id: 'model-disposable',
        projectId: 'project-1',
        slug: body.slug,
        revision: 1,
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/models/model-disposable/bundles') {
      writeJson(response, 200, {
        ok: true,
        applied: body.mode === 'commit',
        wouldRevision: body.mode === 'dry_run' ? 2 : null,
        newRevision: body.mode === 'commit' ? 2 : null,
        changedIds: body.mode === 'commit' ? ['ssh-wall-north'] : [],
        checkpointSnapshotId: body.mode === 'commit' ? 'checkpoint-2' : null,
        violations: [],
        replayDiagnostics: { commandCount: body.bundle.commands.length },
      });
      return;
    }

    if (
      request.method === 'GET' &&
      request.url === '/api/models/model-disposable/command-log?limit=5'
    ) {
      writeJson(response, 200, {
        modelId: 'model-disposable',
        entries: [
          {
            id: 1,
            userId: 'm2-p-live-evidence-runner',
            revisionAfter: 2,
            appliedCommands: [{ type: 'createLevel' }],
          },
        ],
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-disposable/snapshot') {
      writeJson(response, 200, {
        modelId: 'model-disposable',
        revision: 2,
        elements: { 'ssh-wall-north': { id: 'ssh-wall-north', kind: 'wall' } },
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-disposable/summary') {
      writeJson(response, 200, { modelId: 'model-disposable', revision: 2, summary: { walls: 1 } });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-disposable/validate') {
      writeJson(response, 200, {
        modelId: 'model-disposable',
        revision: 2,
        violations: [],
        checks: { errorViolationCount: 0, blockingViolationCount: 0 },
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/models/model-disposable/qa/advisor') {
      writeJson(response, 200, { ok: true, findings: [], summary: { status: 'pass' } });
      return;
    }

    if (
      request.method === 'GET' &&
      request.url === '/api/models/model-disposable/evidence-package'
    ) {
      writeJson(response, 200, {
        format: 'evidencePackage_v1',
        modelId: 'model-disposable',
        revision: 2,
        deterministicPlanViewEvidence: [{ planViewId: 'ssh-view-ground-plan' }],
        deterministic3dViewEvidence: [{ viewId: 'ssh-view-3d' }],
        deterministicSheetEvidence: [{ sheetId: 'ssh-sheet-a101' }],
        recommendedPngEvidenceBackend: 'playwright_ci',
        svgRasterBackendAvailable: true,
      });
      return;
    }

    if (
      request.method === 'GET' &&
      request.url === '/api/models/model-disposable/exports/gltf-manifest'
    ) {
      writeJson(response, 200, {
        extensions: { BIM_AI_exportManifest_v0: { countsByKind: { wall: 1 } } },
      });
      return;
    }

    if (
      request.method === 'GET' &&
      request.url === '/api/models/model-disposable/exports/ifc-manifest'
    ) {
      writeJson(response, 200, {
        format: 'ifc_manifest_v0',
        exportedIfcKindsInArtifact: { IfcWall: 1 },
      });
      return;
    }

    if (
      request.method === 'GET' &&
      request.url ===
        '/api/models/model-disposable/exports/sheet-print-raster.png?sheetId=ssh-sheet-a101'
    ) {
      response.writeHead(200, {
        'content-type': 'image/png',
        'x-bim-ai-sheet-print-raster-contract': 'stub-raster-v1',
        'x-bim-ai-sheet-print-raster-full-raster-status': 'full-raster-unavailable',
        'x-bim-ai-sheet-print-raster-width': '128',
        'x-bim-ai-sheet-print-raster-height': '112',
      });
      response.end(pngBytes);
      return;
    }

    if (
      request.method === 'GET' &&
      request.url ===
        '/api/models/model-disposable/exports/sheet-preview.pdf?sheetId=ssh-sheet-a101'
    ) {
      response.writeHead(200, { 'content-type': 'application/pdf' });
      response.end(pdfBytes);
      return;
    }

    writeJson(response, 404, { error: 'not found' });
  });
  return { server, requests };
}

async function withTempDir(prefix, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('live evidence runner creates a disposable target and stays dry-run-only by default', async () => {
  const { server, requests } = createEvidenceServer();
  const address = await listen(server);
  try {
    await withTempDir('simple-house-live-runner-dry-', async (outDir) => {
      const result = await runLiveEvidence([
        '--base-url',
        `http://${address.address}:${address.port}`,
        '--project-id',
        'project-1',
        '--out-dir',
        outDir,
        '--json',
      ]);

      assert.equal(result.ok, true);
      assert.equal(result.target.mode, 'created-disposable-model');
      assert.equal(result.mode, 'live-dry-run');
      assert.deepEqual(
        requests
          .filter((request) => request.method === 'POST' && request.url.endsWith('/bundles'))
          .map((request) => request.body.mode),
        ['dry_run'],
      );
      const names = (await fs.readdir(outDir)).sort();
      assert.ok(names.includes('benchmark-result.json'));
      assert.ok(names.includes('execution-evidence.json'));
      assert.ok(names.includes('live-dry-run-evidence.json'));
      assert.ok(names.includes('command-log-summary.json'));
      assert.ok(names.includes('snapshot-summary.json'));
      const liveCommit = JSON.parse(
        await fs.readFile(path.join(outDir, 'live-commit-evidence.json'), 'utf8'),
      );
      assert.equal(liveCommit.mode, 'not-requested');
    });
  } finally {
    await close(server);
  }
});

test('live evidence runner commits only with explicit opt-in against disposable model', async () => {
  const { server, requests } = createEvidenceServer();
  const address = await listen(server);
  try {
    await withTempDir('simple-house-live-runner-commit-', async (outDir) => {
      const result = await runLiveEvidence([
        '--base-url',
        `http://${address.address}:${address.port}`,
        '--project-id',
        'project-1',
        '--out-dir',
        outDir,
        '--commit-live',
      ]);

      assert.equal(result.ok, true);
      assert.equal(result.mode, 'live-dry-run-and-commit');
      assert.deepEqual(
        requests
          .filter((request) => request.method === 'POST' && request.url.endsWith('/bundles'))
          .map((request) => request.body.mode),
        ['dry_run', 'commit'],
      );
      const liveCommit = JSON.parse(
        await fs.readFile(path.join(outDir, 'live-commit-evidence.json'), 'utf8'),
      );
      const commandLog = JSON.parse(
        await fs.readFile(path.join(outDir, 'command-log-summary.json'), 'utf8'),
      );
      const snapshot = JSON.parse(
        await fs.readFile(path.join(outDir, 'snapshot-summary.json'), 'utf8'),
      );
      assert.equal(liveCommit.mode, 'live-commit');
      assert.equal(commandLog.latest[0].appliedCommandCount, 1);
      assert.equal(snapshot.countsByKind.wall, 1);
    });
  } finally {
    await close(server);
  }
});

test('live evidence runner refuses non-empty artifact directory unless explicitly allowed', async () => {
  await withTempDir('simple-house-live-runner-outdir-', async (outDir) => {
    await fs.writeFile(path.join(outDir, 'existing.txt'), 'keep this\n', 'utf8');
    await assert.rejects(
      () =>
        runLiveEvidence([
          '--base-url',
          'http://127.0.0.1:1',
          '--project-id',
          'project-1',
          '--out-dir',
          outDir,
        ]),
      /Evidence directory is not empty/,
    );
  });
});

test('live evidence runner fails closed when no live target is specified', async () => {
  await withTempDir('simple-house-live-runner-missing-target-', async (outDir) => {
    await assert.rejects(
      () => runLiveEvidence(['--base-url', 'http://127.0.0.1:1', '--out-dir', outDir]),
      /Missing live target/,
    );
  });
});

test('live evidence runner reports missing disposable model capability before bundle execution', async () => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const body = request.method === 'POST' ? JSON.parse(await readBody(request)) : null;
    requests.push({ method: request.method, url: request.url, body });
    writeJson(response, 404, { error: 'Project not found' });
  });
  const address = await listen(server);
  try {
    await withTempDir('simple-house-live-runner-create-failure-', async (outDir) => {
      await assert.rejects(
        () =>
          runLiveEvidence([
            '--base-url',
            `http://${address.address}:${address.port}`,
            '--project-id',
            'project-1',
            '--out-dir',
            outDir,
          ]),
        /Disposable model creation failed/,
      );
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, '/api/projects/project-1/models');
    });
  } finally {
    await close(server);
  }
});

test('live evidence runner refuses underspecified existing-model commit', async () => {
  await withTempDir('simple-house-live-runner-existing-commit-', async (outDir) => {
    await assert.rejects(
      () =>
        runLiveEvidence([
          '--base-url',
          'http://127.0.0.1:1',
          '--model-id',
          'existing-model',
          '--out-dir',
          outDir,
          '--commit-live',
        ]),
      /allow-existing-model-commit/,
    );
  });
});
