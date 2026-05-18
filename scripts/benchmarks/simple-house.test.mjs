import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

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

function sendJson(response, body, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function valueOrFactory(value, context) {
  return typeof value === 'function' ? value(context) : value;
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
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
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
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createCommittedEvidenceServer({
  modelId = 'model-commit',
  rasterContract = 'sheetPrintRasterPrintSurrogate_v2',
  rasterFullStatus = 'print-surrogate',
  rasterBytes = makePng(128, 112),
  rasterDeclaredWidth = '128',
  rasterDeclaredHeight = '112',
  rasterStatus = 200,
  gltfManifestBody = {
    extensions: { BIM_AI_exportManifest_v0: { countsByKind: { wall: 1 } } },
  },
  gltfManifestStatus = 200,
  ifcManifestBody = { format: 'ifc_manifest_v0', exportedIfcKindsInArtifact: { IfcWall: 1 } },
  ifcManifestStatus = 200,
  sheetPdfBytes = Buffer.from('%PDF-1.4\n% simple-house stub\n', 'utf8'),
  sheetPdfStatus = 200,
  validationBody = ({ modelId: id }) => ({
    modelId: id,
    revision: 3,
    violations: [],
    checks: { errorViolationCount: 0, blockingViolationCount: 0 },
  }),
  advisorBody = () => ({
    ok: true,
    data: {
      format: 'qaAdvisor_v1',
      findings: [],
      summary: { findingCount: 0, returnedCount: 0, severityCounts: {} },
    },
    warnings: [],
  }),
} = {}) {
  const requests = [];
  const modelPath = `/api/models/${modelId}`;
  const pngSha256 = createHash('sha256').update(rasterBytes).digest('hex');
  const server = http.createServer(async (request, response) => {
    const body = request.method === 'POST' ? JSON.parse(await readBody(request)) : null;
    requests.push({ method: request.method, url: request.url, body });
    if (request.method === 'POST' && request.url === `${modelPath}/bundles`) {
      sendJson(response, {
        schemaVersion: 'cmd-v3.0',
        applied: body.mode === 'commit',
        newRevision: body.mode === 'commit' ? 3 : null,
        wouldRevision: body.mode === 'dry_run' ? 3 : null,
        changedIds: ['ssh-wall-north', 'ssh-door-entry'],
        checkpointSnapshotId: 'checkpoint-3',
        violations: [],
      });
      return;
    }
    if (request.method === 'POST' && request.url === `${modelPath}/qa/advisor`) {
      sendJson(response, valueOrFactory(advisorBody, { modelId, body }));
      return;
    }
    if (request.method === 'GET' && request.url === `${modelPath}/command-log?limit=5`) {
      sendJson(response, {
        modelId,
        entries: [
          {
            id: 10,
            userId: 'agent-test',
            revisionAfter: 3,
            createdAt: '2026-05-18T00:00:00.000Z',
            appliedCommands: [{ type: 'createLevel' }, { type: 'createWallChain' }],
          },
        ],
      });
      return;
    }
    if (request.method === 'GET' && request.url === `${modelPath}/snapshot`) {
      sendJson(response, {
        modelId,
        revision: 3,
        elements: {
          'ssh-wall-north': { id: 'ssh-wall-north', kind: 'wall' },
          'ssh-door-entry': { id: 'ssh-door-entry', kind: 'opening' },
        },
      });
      return;
    }
    if (request.method === 'GET' && request.url === `${modelPath}/summary`) {
      sendJson(response, { modelId, revision: 3, summary: { walls: 1 } });
      return;
    }
    if (request.method === 'GET' && request.url === `${modelPath}/validate`) {
      sendJson(response, valueOrFactory(validationBody, { modelId }));
      return;
    }
    if (request.method === 'GET' && request.url === `${modelPath}/evidence-package`) {
      sendJson(response, {
        format: 'evidencePackage_v1',
        modelId,
        revision: 3,
        deterministicPlanViewEvidence: [{ planViewId: 'ssh-view-ground-plan' }],
        deterministic3dViewEvidence: [{ viewId: 'ssh-view-3d' }],
        deterministicSheetEvidence: [{ sheetId: 'ssh-sheet-a101' }],
        recommendedPngEvidenceBackend: 'playwright_ci',
        svgRasterBackendAvailable: true,
      });
      return;
    }
    if (request.method === 'GET' && request.url === `${modelPath}/exports/gltf-manifest`) {
      if (gltfManifestStatus !== 200) {
        sendJson(response, { error: 'gltf manifest unavailable' }, gltfManifestStatus);
        return;
      }
      sendJson(response, gltfManifestBody);
      return;
    }
    if (request.method === 'GET' && request.url === `${modelPath}/exports/ifc-manifest`) {
      if (ifcManifestStatus !== 200) {
        sendJson(response, { error: 'ifc manifest unavailable' }, ifcManifestStatus);
        return;
      }
      sendJson(response, ifcManifestBody);
      return;
    }
    if (
      request.method === 'GET' &&
      request.url === `${modelPath}/exports/sheet-print-raster.png?sheetId=ssh-sheet-a101`
    ) {
      if (rasterStatus !== 200) {
        sendJson(response, { error: 'sheet raster unavailable' }, rasterStatus);
        return;
      }
      response.writeHead(200, {
        'content-type': 'image/png',
        'x-bim-ai-sheet-print-raster-contract': rasterContract,
        'x-bim-ai-sheet-print-raster-full-raster-status': rasterFullStatus,
        'x-bim-ai-sheet-print-raster-png-sha256': pngSha256,
        'x-bim-ai-sheet-print-raster-width': rasterDeclaredWidth,
        'x-bim-ai-sheet-print-raster-height': rasterDeclaredHeight,
      });
      response.end(rasterBytes);
      return;
    }
    if (
      request.method === 'GET' &&
      request.url === `${modelPath}/exports/sheet-preview.pdf?sheetId=ssh-sheet-a101`
    ) {
      if (sheetPdfStatus !== 200) {
        sendJson(response, { error: 'sheet pdf unavailable' }, sheetPdfStatus);
        return;
      }
      response.writeHead(200, { 'content-type': 'application/pdf' });
      response.end(sheetPdfBytes);
      return;
    }
    sendJson(response, { error: 'not found' }, 404);
  });
  return { requests, server };
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

test('simple-house collect committed evidence writes clean advisor-validation artifact', async () => {
  const { server } = createCommittedEvidenceServer({
    modelId: 'model-clean',
  });

  const address = await listen(server);
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simple-house-clean-'));
  try {
    const baseUrl = `http://${address.address}:${address.port}`;
    const { result } = await runBenchmark([
      '--mode',
      'live',
      '--base-url',
      baseUrl,
      '--model-id',
      'model-clean',
      '--parent-revision',
      '2',
      '--user-id',
      'agent-test',
      '--collect-committed-evidence',
      '--out-dir',
      outDir,
    ]);

    assert.equal(result.ok, true);
    assert.equal(result.committedEvidence.evidenceKind, 'committed-live-artifact');
    assert.equal(result.committedEvidence.collectionStatus, 'captured');
    assert.equal(result.committedEvidence.validationPass, true);
    assert.equal(result.committedEvidence.advisorPass, true);
    assert.deepEqual(result.committedEvidence.blockingErrorCounts, {
      validation: 0,
      advisor: 0,
    });
    assert.deepEqual(result.committedEvidence.warningCounts, { validation: 0, advisor: 0 });
    assert.equal(result.committedEvidence.source.modelId, 'model-clean');
    assert.equal(result.committedEvidence.source.revision, 3);

    const committedEvidence = JSON.parse(
      await fs.readFile(path.join(outDir, 'committed-evidence.json'), 'utf8'),
    );
    assert.equal(committedEvidence.source.modelId, 'model-clean');
    assert.equal(committedEvidence.source.revision, 3);

    const advisorValidation = JSON.parse(
      await fs.readFile(path.join(outDir, 'advisor-validation.json'), 'utf8'),
    );
    assert.equal(advisorValidation.evidenceKind, 'committed-advisor-validation');
    assert.equal(advisorValidation.ok, true);
    assert.equal(advisorValidation.validationPass, true);
    assert.equal(advisorValidation.advisorPass, true);
    assert.deepEqual(advisorValidation.blockingErrorCounts, { validation: 0, advisor: 0 });
    assert.deepEqual(advisorValidation.warningCounts, { validation: 0, advisor: 0 });
    assert.equal(advisorValidation.modelId, 'model-clean');
    assert.equal(advisorValidation.revision, 3);
    assert.equal(advisorValidation.source.modelIdMatchesRequest, true);
    assert.equal(advisorValidation.preflight.liveAdvisorValidationCaptured, true);
  } finally {
    await close(server);
    await fs.rm(outDir, { recursive: true, force: true });
  }
});

test('simple-house committed visual/export evidence rejects placeholders and empty manifests', async () => {
  const { server } = createCommittedEvidenceServer({
    modelId: 'model-placeholder-evidence',
    rasterContract: 'sheetPrintRasterPlaceholder_v1',
    rasterBytes: makePng(1, 1),
    rasterDeclaredWidth: '128',
    rasterDeclaredHeight: '112',
    gltfManifestBody: { extensions: { BIM_AI_exportManifest_v0: { countsByKind: {} } } },
    ifcManifestBody: { format: 'ifc_manifest_v0', exportedIfcKindsInArtifact: {} },
    sheetPdfBytes: Buffer.alloc(0),
  });

  const address = await listen(server);
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simple-house-placeholder-'));
  try {
    const baseUrl = `http://${address.address}:${address.port}`;
    const { result } = await runBenchmark([
      '--mode',
      'live',
      '--base-url',
      baseUrl,
      '--model-id',
      'model-placeholder-evidence',
      '--parent-revision',
      '2',
      '--collect-committed-evidence',
      '--out-dir',
      outDir,
    ]);

    assert.equal(result.ok, false);
    assert.equal(result.committedEvidence.validationPass, true);
    assert.equal(result.committedEvidence.advisorPass, true);
    assert.equal(result.committedEvidence.visual.status, 'invalid');
    assert.equal(result.committedEvidence.visual.pass, false);
    assert.equal(
      result.committedEvidence.visual.sheetPrintRaster.rejectedContract,
      'sheetPrintRasterPlaceholder_v1',
    );
    assert.equal(result.committedEvidence.exports.status, 'invalid');
    assert.equal(result.committedEvidence.exports.pass, false);
    assert.equal(result.committedEvidence.exports.manifests.gltf.status, 'invalid-manifest');
    assert.equal(result.committedEvidence.exports.artifacts.sheetPdf.status, 'blank-artifact');

    const visual = JSON.parse(await fs.readFile(path.join(outDir, 'visual-evidence.json'), 'utf8'));
    const exports = JSON.parse(
      await fs.readFile(path.join(outDir, 'export-evidence.json'), 'utf8'),
    );
    assert.equal(visual.pass, false);
    assert.equal(exports.pass, false);
  } finally {
    await close(server);
    await fs.rm(outDir, { recursive: true, force: true });
  }
});

test('simple-house committed visual/export evidence reports unavailable contracts precisely', async () => {
  const { server } = createCommittedEvidenceServer({
    modelId: 'model-unavailable-evidence',
    rasterStatus: 404,
    gltfManifestStatus: 404,
    ifcManifestStatus: 404,
    sheetPdfStatus: 404,
  });

  const address = await listen(server);
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simple-house-unavailable-'));
  try {
    const baseUrl = `http://${address.address}:${address.port}`;
    const { result } = await runBenchmark([
      '--mode',
      'live',
      '--base-url',
      baseUrl,
      '--model-id',
      'model-unavailable-evidence',
      '--parent-revision',
      '2',
      '--collect-committed-evidence',
      '--out-dir',
      outDir,
    ]);

    assert.equal(result.ok, false);
    assert.equal(result.committedEvidence.visual.status, 'unavailable');
    assert.equal(result.committedEvidence.visual.pass, false);
    assert.equal(result.committedEvidence.exports.status, 'unavailable');
    assert.equal(result.committedEvidence.exports.pass, false);

    const visual = JSON.parse(await fs.readFile(path.join(outDir, 'visual-evidence.json'), 'utf8'));
    const exports = JSON.parse(
      await fs.readFile(path.join(outDir, 'export-evidence.json'), 'utf8'),
    );
    assert.equal(visual.sheetPrintRaster.httpStatus, 404);
    assert.equal(exports.manifests.gltf.httpStatus, 404);
    assert.equal(exports.artifacts.sheetPdf.httpStatus, 404);
  } finally {
    await close(server);
    await fs.rm(outDir, { recursive: true, force: true });
  }
});

test('simple-house live commit requires explicit flag and writes committed evidence artifacts', async () => {
  const { requests, server } = createCommittedEvidenceServer({
    validationBody: ({ modelId }) => ({
      modelId,
      revision: 3,
      violations: [{ severity: 'warning', code: 'minor-clearance' }],
      checks: { errorViolationCount: 0, blockingViolationCount: 0 },
    }),
    advisorBody: ({ modelId }) => ({
      ok: true,
      modelId,
      revision: 3,
      data: {
        format: 'qaAdvisor_v1',
        findings: [
          { severity: 'warning', ruleId: 'constructability_proxy_unsupported' },
          { severity: 'info', ruleId: 'documentation_hint' },
        ],
        summary: {
          findingCount: 2,
          returnedCount: 2,
          severityCounts: { info: 1, warning: 1 },
        },
      },
      warnings: [],
    }),
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
    assert.equal(result.committedEvidence.evidenceKind, 'committed-live-artifact');
    assert.equal(result.committedEvidence.collectionStatus, 'captured');
    assert.equal(result.committedEvidence.ok, true);
    assert.equal(result.committedEvidence.validationPass, true);
    assert.equal(result.committedEvidence.advisorPass, true);
    assert.equal(result.committedEvidence.validationResult.warningCount, 1);
    assert.equal(result.committedEvidence.advisorResult.warningCount, 1);
    assert.equal(result.committedEvidence.advisorResult.infoCount, 1);
    assert.equal(result.committedEvidence.blockingErrorCounts.validation, 0);
    assert.equal(result.committedEvidence.blockingErrorCounts.advisor, 0);
    assert.deepEqual(result.committedEvidence.warningCounts, { validation: 1, advisor: 1 });
    assert.deepEqual(result.committedEvidence.infoCounts, { validation: 0, advisor: 1 });
    assert.equal(result.committedEvidence.source.modelId, 'model-commit');
    assert.equal(result.committedEvidence.source.revision, 3);
    assert.equal(result.committedEvidence.visual.pass, true);
    assert.equal(result.committedEvidence.visual.sheetPrintRaster.widthPx, 128);
    assert.equal(result.committedEvidence.visual.sheetPrintRaster.heightPx, 112);
    assert.ok(result.committedEvidence.visual.sheetPrintRaster.byteLength > 256);
    assert.match(result.committedEvidence.visual.sheetPrintRaster.sha256, /^[a-f0-9]{64}$/);
    assert.equal(result.committedEvidence.visual.sheetPrintRaster.nonblankProof.ok, true);
    assert.equal(result.committedEvidence.exports.pass, true);
    assert.equal(result.committedEvidence.exports.manifests.gltf.pass, true);
    assert.equal(result.committedEvidence.exports.manifests.gltf.summary.exportedKindCount, 1);
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
    const advisorValidation = JSON.parse(
      await fs.readFile(path.join(outDir, 'advisor-validation.json'), 'utf8'),
    );
    assert.equal(advisorValidation.ok, true);
    assert.equal(advisorValidation.validationStatus, 'pass');
    assert.equal(advisorValidation.advisorStatus, 'pass');
    assert.deepEqual(advisorValidation.warningCounts, { validation: 1, advisor: 1 });
    assert.equal(advisorValidation.source.modelId, 'model-commit');
    assert.equal(advisorValidation.source.revision, 3);
    assert.equal(advisorValidation.validationResult.warningCount, 1);
    assert.equal(advisorValidation.advisorResult.infoCount, 1);
  } finally {
    await close(server);
    await fs.rm(outDir, { recursive: true, force: true });
  }
});

test('simple-house advisor-validation artifact is explicit when committed capture is missing', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simple-house-missing-'));
  try {
    const { result } = await runBenchmark(['--mode', 'offline', '--out-dir', outDir]);

    assert.equal(result.ok, true);
    assert.equal(result.committedEvidence.evidenceKind, 'missing-committed-live-artifact');
    assert.equal(result.committedEvidence.validationPass, false);
    assert.equal(result.committedEvidence.advisorPass, false);

    const advisorValidation = JSON.parse(
      await fs.readFile(path.join(outDir, 'advisor-validation.json'), 'utf8'),
    );
    assert.equal(advisorValidation.evidenceKind, 'missing-committed-live-artifact');
    assert.equal(advisorValidation.collectionStatus, 'not-requested');
    assert.equal(advisorValidation.ok, false);
    assert.equal(advisorValidation.validationStatus, 'not-captured');
    assert.equal(advisorValidation.validationPass, false);
    assert.equal(advisorValidation.advisorStatus, 'not-captured');
    assert.equal(advisorValidation.advisorPass, false);
    assert.deepEqual(advisorValidation.blockingErrorCounts, {
      validation: null,
      advisor: null,
    });
    assert.equal(advisorValidation.validation, null);
    assert.equal(advisorValidation.advisor, null);
    assert.match(
      advisorValidation.preflight.reason,
      /Committed evidence collection was not requested/,
    );
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
});

test('simple-house committed evidence fails on blocking validation errors', async () => {
  const { server } = createCommittedEvidenceServer({
    modelId: 'model-validation-fail',
    validationBody: ({ modelId }) => ({
      modelId,
      revision: 3,
      violations: [
        {
          severity: 'error',
          blocking: true,
          code: 'overlapping-hosted-opening',
          elementIds: ['ssh-door-entry'],
        },
        { severity: 'warning', code: 'minor-clearance' },
      ],
      checks: { errorViolationCount: 1, blockingViolationCount: 1 },
    }),
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
      'model-validation-fail',
      '--parent-revision',
      '2',
      '--user-id',
      'agent-test',
      '--collect-committed-evidence',
    ]);

    assert.equal(result.ok, false);
    assert.equal(result.committedEvidence.ok, false);
    assert.equal(result.committedEvidence.validationStatus, 'fail');
    assert.equal(result.committedEvidence.validationPass, false);
    assert.equal(result.committedEvidence.validationResult.blockingErrorCount, 1);
    assert.equal(result.committedEvidence.validationResult.warningCount, 1);
    assert.equal(result.committedEvidence.advisorPass, true);
  } finally {
    await close(server);
  }
});

test('simple-house committed evidence fails on blocking advisor errors', async () => {
  const { server } = createCommittedEvidenceServer({
    modelId: 'model-advisor-fail',
    advisorBody: ({ modelId }) => ({
      ok: true,
      modelId,
      revision: 3,
      data: {
        format: 'qaAdvisor_v1',
        findings: [
          {
            severity: 'error',
            blocking: true,
            ruleId: 'constructability_metadata_requirement_missing',
            elementIds: ['ssh-roof-main'],
          },
          { severity: 'warning', ruleId: 'documentation_hint' },
        ],
        summary: {
          findingCount: 2,
          returnedCount: 2,
          severityCounts: { error: 1, warning: 1 },
        },
      },
      warnings: [],
    }),
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
      'model-advisor-fail',
      '--parent-revision',
      '2',
      '--user-id',
      'agent-test',
      '--collect-committed-evidence',
    ]);

    assert.equal(result.ok, false);
    assert.equal(result.committedEvidence.ok, false);
    assert.equal(result.committedEvidence.validationPass, true);
    assert.equal(result.committedEvidence.advisorStatus, 'fail');
    assert.equal(result.committedEvidence.advisorPass, false);
    assert.equal(result.committedEvidence.advisorResult.blockingErrorCount, 1);
    assert.equal(result.committedEvidence.advisorResult.warningCount, 1);
  } finally {
    await close(server);
  }
});
