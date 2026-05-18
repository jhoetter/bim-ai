import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runBenchmark } from './simple-house.mjs';

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

test('simple-house benchmark remains deterministic in offline fixture mode', async () => {
  const { result } = await runBenchmark(['--mode', 'offline']);

  assert.equal(result.ok, true);
  assert.equal(result.executionEvidence.mode, 'offline-fixture');
  assert.equal(result.summary.walls.total, 6);
  assert.equal(result.summary.openings.hosted, 6);
  assert.deepEqual(result.semanticDiff, []);
  assert.ok(result.executionEvidence.bundleDigest);
  assert.ok(result.uiEquivalentTodos.some((item) => item.path === 'UI/Cmd+K'));
});

test('simple-house live mode posts cmd-v3 dry-run evidence to public bundle API', async () => {
  let captured = null;
  const server = http.createServer(async (request, response) => {
    captured = {
      method: request.method,
      url: request.url,
      body: JSON.parse(await readBody(request)),
    };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        ok: true,
        reason: 'ok',
        wouldRevision: 2,
        violations: [],
        replayDiagnostics: { commandCount: captured.body.bundle.commands.length },
        agentGeneratedBundleQaChecklist_v1: { status: 'mocked' },
      }),
    );
  });

  const address = await listen(server);
  try {
    const baseUrl = `http://${address.address}:${address.port}`;
    const { result } = await runBenchmark([
      '--mode',
      'live',
      '--base-url',
      baseUrl,
      '--model-id',
      'model-1',
      '--parent-revision',
      '1',
      '--user-id',
      'agent-test',
    ]);

    assert.equal(result.ok, true);
    assert.equal(result.executionEvidence.mode, 'live-dry-run');
    assert.equal(result.executionEvidence.publicSurface.kind, 'cmd-v3-api');
    assert.equal(result.executionEvidence.response.wouldRevision, 2);
    assert.equal(captured.method, 'POST');
    assert.equal(captured.url, '/api/models/model-1/bundles');
    assert.equal(captured.body.mode, 'dry_run');
    assert.equal(captured.body.userId, 'agent-test');
    assert.equal(captured.body.submitter, 'benchmark-agent');
    assert.equal(captured.body.bundle.schemaVersion, 'cmd-v3.0');
    assert.equal(captured.body.bundle.parentRevision, 1);
    assert.equal(captured.body.bundle.commands.length, result.summary.commandCount);
  } finally {
    await close(server);
  }
});

test('simple-house live commit requires explicit flag and writes committed evidence artifacts', async () => {
  const requests = [];
  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fea73581e40000000049454e44ae426082',
    'hex',
  );
  const pdfBytes = Buffer.from('%PDF-1.4\n% simple-house stub\n', 'utf8');
  const server = http.createServer(async (request, response) => {
    const body = request.method === 'POST' ? JSON.parse(await readBody(request)) : null;
    requests.push({ method: request.method, url: request.url, body });
    if (request.method === 'POST' && request.url === '/api/models/model-commit/bundles') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          schemaVersion: 'cmd-v3.0',
          applied: body.mode === 'commit',
          newRevision: body.mode === 'commit' ? 3 : null,
          wouldRevision: body.mode === 'dry_run' ? 3 : null,
          changedIds: ['ssh-wall-north', 'ssh-door-entry'],
          checkpointSnapshotId: 'checkpoint-3',
          violations: [],
        }),
      );
      return;
    }
    if (request.method === 'POST' && request.url === '/api/models/model-commit/qa/advisor') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, findings: [], summary: { status: 'pass' } }));
      return;
    }
    if (
      request.method === 'GET' &&
      request.url === '/api/models/model-commit/command-log?limit=5'
    ) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          modelId: 'model-commit',
          entries: [
            {
              id: 10,
              userId: 'agent-test',
              revisionAfter: 3,
              createdAt: '2026-05-18T00:00:00.000Z',
              appliedCommands: [{ type: 'createLevel' }, { type: 'createWallChain' }],
            },
          ],
        }),
      );
      return;
    }
    if (request.method === 'GET' && request.url === '/api/models/model-commit/snapshot') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          modelId: 'model-commit',
          revision: 3,
          elements: {
            'ssh-wall-north': { id: 'ssh-wall-north', kind: 'wall' },
            'ssh-door-entry': { id: 'ssh-door-entry', kind: 'opening' },
          },
        }),
      );
      return;
    }
    if (request.method === 'GET' && request.url === '/api/models/model-commit/summary') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ modelId: 'model-commit', revision: 3, summary: { walls: 1 } }));
      return;
    }
    if (request.method === 'GET' && request.url === '/api/models/model-commit/validate') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          modelId: 'model-commit',
          revision: 3,
          violations: [],
          checks: { errorViolationCount: 0, blockingViolationCount: 0 },
        }),
      );
      return;
    }
    if (request.method === 'GET' && request.url === '/api/models/model-commit/evidence-package') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          format: 'evidencePackage_v1',
          modelId: 'model-commit',
          revision: 3,
          deterministicPlanViewEvidence: [{ planViewId: 'ssh-view-ground-plan' }],
          deterministic3dViewEvidence: [{ viewId: 'ssh-view-3d' }],
          deterministicSheetEvidence: [{ sheetId: 'ssh-sheet-a101' }],
          recommendedPngEvidenceBackend: 'playwright_ci',
          svgRasterBackendAvailable: true,
        }),
      );
      return;
    }
    if (
      request.method === 'GET' &&
      request.url === '/api/models/model-commit/exports/gltf-manifest'
    ) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ extensions: { BIM_AI_exportManifest_v0: { countsByKind: { wall: 1 } } } }),
      );
      return;
    }
    if (
      request.method === 'GET' &&
      request.url === '/api/models/model-commit/exports/ifc-manifest'
    ) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ format: 'ifc_manifest_v0', exportedIfcKindsInArtifact: { IfcWall: 1 } }),
      );
      return;
    }
    if (
      request.method === 'GET' &&
      request.url ===
        '/api/models/model-commit/exports/sheet-print-raster.png?sheetId=ssh-sheet-a101'
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
      request.url === '/api/models/model-commit/exports/sheet-preview.pdf?sheetId=ssh-sheet-a101'
    ) {
      response.writeHead(200, { 'content-type': 'application/pdf' });
      response.end(pdfBytes);
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not found' }));
  });

  const address = await listen(server);
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simple-house-live-commit-'));
  try {
    const baseUrl = `http://${address.address}:${address.port}`;
    const { result } = await runBenchmark([
      '--mode',
      'live',
      '--base-url',
      baseUrl,
      '--model-id',
      'model-commit',
      '--parent-revision',
      '2',
      '--user-id',
      'agent-test',
      '--commit-live',
      '--out-dir',
      outDir,
    ]);

    assert.equal(result.ok, true);
    assert.equal(result.executionEvidence.mode, 'live-dry-run-and-commit');
    assert.equal(result.executionEvidence.liveDryRun.mode, 'live-dry-run');
    assert.equal(result.executionEvidence.liveCommit.mode, 'live-commit');
    assert.equal(result.committedEvidence.mode, 'post-commit-live');
    assert.equal(result.committedEvidence.ok, true);
    assert.equal(result.committedEvidence.visual.sheetPrintRaster.nonblankProof.ok, true);
    assert.equal(result.committedEvidence.exports.artifacts.sheetPdf.status, 'artifact-returned');
    assert.equal(result.executionEvidence.liveCommit.response.newRevision, 3);
    assert.deepEqual(result.executionEvidence.liveCommit.response.changedIds, [
      'ssh-door-entry',
      'ssh-wall-north',
    ]);
    assert.equal(
      result.executionEvidence.liveCommit.postCommit.commandLog.summary.latest[0]
        .appliedCommandCount,
      2,
    );
    assert.equal(result.executionEvidence.liveCommit.postCommit.snapshot.summary.elementCount, 2);
    assert.deepEqual(
      requests
        .filter((request) => request.method === 'POST' && request.url.endsWith('/bundles'))
        .map((request) => request.body.mode),
      ['dry_run', 'commit'],
    );

    const artifactNames = (await fs.readdir(outDir)).sort();
    assert.deepEqual(artifactNames, [
      'advisor-validation.json',
      'benchmark-result.json',
      'command-log-summary.json',
      'committed-evidence.json',
      'execution-evidence.json',
      'export-evidence.json',
      'live-commit-evidence.json',
      'live-dry-run-evidence.json',
      'semantic-diff.json',
      'semantic-summary.json',
      'snapshot-summary.json',
      'visual-evidence.json',
    ]);
    const snapshotSummary = JSON.parse(
      await fs.readFile(path.join(outDir, 'snapshot-summary.json'), 'utf8'),
    );
    assert.equal(snapshotSummary.countsByKind.opening, 1);
    assert.equal(snapshotSummary.countsByKind.wall, 1);
  } finally {
    await close(server);
    await fs.rm(outDir, { recursive: true, force: true });
  }
});
