import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

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

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function makePng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rowLength = 1 + width * 3;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowLength;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + 1 + x * 3;
      raw[offset] = 240;
      raw[offset + 1] = x % 2 === 0 ? 248 : 232;
      raw[offset + 2] = y % 2 === 0 ? 255 : 224;
    }
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createEvidenceServer() {
  const requests = [];
  const pngBytes = makePng(128, 112);
  const pngSha256 = createHash('sha256').update(pngBytes).digest('hex');
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
        'x-bim-ai-sheet-print-raster-contract': 'sheetPrintRasterPrintSurrogate_v2',
        'x-bim-ai-sheet-print-raster-full-raster-status': 'print-surrogate',
        'x-bim-ai-sheet-print-raster-png-sha256': pngSha256,
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

      assert.equal(result.ok, true, JSON.stringify(result.remainingExitCriteria));
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
      assert.ok(names.includes('export-evidence.json'));
      assert.ok(names.includes('live-dry-run-evidence.json'));
      assert.ok(names.includes('visual-evidence.json'));
      assert.ok(names.includes('command-log-summary.json'));
      assert.ok(names.includes('snapshot-summary.json'));
      const liveCommit = JSON.parse(
        await fs.readFile(path.join(outDir, 'live-commit-evidence.json'), 'utf8'),
      );
      const liveDryRun = JSON.parse(
        await fs.readFile(path.join(outDir, 'live-dry-run-evidence.json'), 'utf8'),
      );
      const execution = JSON.parse(
        await fs.readFile(path.join(outDir, 'execution-evidence.json'), 'utf8'),
      );
      const manifest = JSON.parse(
        await fs.readFile(path.join(outDir, 'live-runner-manifest.json'), 'utf8'),
      );
      const visual = JSON.parse(
        await fs.readFile(path.join(outDir, 'visual-evidence.json'), 'utf8'),
      );
      const exports = JSON.parse(
        await fs.readFile(path.join(outDir, 'export-evidence.json'), 'utf8'),
      );
      assert.equal(liveDryRun.clean, true);
      assert.equal(liveDryRun.pass, true);
      assert.equal(liveDryRun.status, 'live-dry-run-clean');
      assert.equal(liveDryRun.fixtureEvidence, false);
      assert.equal(liveDryRun.sourceTarget.targetMode, 'created-disposable-model');
      assert.equal(liveDryRun.sourceTarget.projectId, 'project-1');
      assert.equal(liveDryRun.sourceTarget.modelId, 'model-disposable');
      assert.equal(liveDryRun.sourceTarget.baseUrl.credentials, false);
      assert.equal(liveDryRun.revision.parentRevision, 1);
      assert.equal(liveDryRun.revision.wouldRevision, 2);
      assert.deepEqual(liveDryRun.changedIds, []);
      assert.equal(liveDryRun.secrets.containsSecrets, false);
      assert.equal(execution.clean, true);
      assert.equal(execution.pass, true);
      assert.equal(manifest.clean, true);
      assert.equal(manifest.artifacts['visual-evidence.json'], 'written');
      assert.equal(manifest.artifacts['export-evidence.json'], 'written');
      assert.equal(visual.status, 'unavailable');
      assert.equal(visual.pass, false);
      assert.equal(exports.status, 'unavailable');
      assert.equal(exports.pass, false);
      assert.equal(liveCommit.mode, 'not-requested');
      assert.equal(liveCommit.clean, false);
      assert.equal(liveCommit.pass, false);
      assert.equal(liveCommit.auditClassification, 'not-requested');
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

      assert.equal(result.ok, true, JSON.stringify(result.remainingExitCriteria));
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
      const liveDryRun = JSON.parse(
        await fs.readFile(path.join(outDir, 'live-dry-run-evidence.json'), 'utf8'),
      );
      const execution = JSON.parse(
        await fs.readFile(path.join(outDir, 'execution-evidence.json'), 'utf8'),
      );
      const commandLog = JSON.parse(
        await fs.readFile(path.join(outDir, 'command-log-summary.json'), 'utf8'),
      );
      const snapshot = JSON.parse(
        await fs.readFile(path.join(outDir, 'snapshot-summary.json'), 'utf8'),
      );
      const visual = JSON.parse(
        await fs.readFile(path.join(outDir, 'visual-evidence.json'), 'utf8'),
      );
      const exports = JSON.parse(
        await fs.readFile(path.join(outDir, 'export-evidence.json'), 'utf8'),
      );
      assert.equal(liveDryRun.clean, true);
      assert.equal(liveDryRun.pass, true);
      assert.equal(liveCommit.mode, 'live-commit');
      assert.equal(liveCommit.clean, true);
      assert.equal(liveCommit.pass, true);
      assert.equal(liveCommit.status, 'live-commit-clean');
      assert.equal(liveCommit.sourceTarget.targetMode, 'created-disposable-model');
      assert.equal(liveCommit.revision.parentRevision, 1);
      assert.equal(liveCommit.revision.newRevision, 2);
      assert.equal(liveCommit.revision.commandLogRevisionAfter, 2);
      assert.deepEqual(liveCommit.changedIds, ['ssh-wall-north']);
      assert.equal(liveCommit.secrets.containsSecrets, false);
      assert.equal(execution.clean, true);
      assert.equal(execution.pass, true);
      assert.equal(execution.liveCommit.status, 'live-commit-clean');
      assert.equal(commandLog.latest[0].appliedCommandCount, 1);
      assert.equal(snapshot.countsByKind.wall, 1);
      assert.equal(visual.pass, true);
      assert.equal(visual.sheetPrintRaster.widthPx, 128);
      assert.equal(visual.sheetPrintRaster.heightPx, 112);
      assert.equal(exports.pass, true);
      assert.equal(exports.manifests.ifc.summary.exportedKindCount, 1);
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
      /one of --project-id\/BIM_AI_PROJECT_ID or --model-id\/BIM_AI_MODEL_ID/,
    );
  });
});

test('live evidence runner reports all missing live configuration without writing artifacts', async () => {
  await withTempDir('simple-house-live-runner-missing-config-', async (outDir) => {
    await assert.rejects(
      () => runLiveEvidence(['--out-dir', outDir]),
      /--base-url or BIM_AI_BASE_URL.*one of --project-id\/BIM_AI_PROJECT_ID or --model-id\/BIM_AI_MODEL_ID/,
    );
    assert.deepEqual(await fs.readdir(outDir), []);
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

test('live evidence runner refuses existing-model commit without parent revision after allow flag', async () => {
  await withTempDir('simple-house-live-runner-existing-commit-rev-', async (outDir) => {
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
          '--allow-existing-model-commit',
        ]),
      /requires --parent-revision/,
    );
  });
});
