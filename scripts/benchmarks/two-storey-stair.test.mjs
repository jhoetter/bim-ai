import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

import { runBenchmark } from './two-storey-stair.mjs';

const TWO_STOREY_COUNTS_BY_KIND = {
  wall: 12,
  floor: 2,
  stair: 1,
  railing: 1,
  slab_opening: 1,
  roof: 1,
  door: 6,
  window: 8,
  room: 6,
};

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
      raw[offset] = 220;
      raw[offset + 1] = x % 2 === 0 ? 240 : 226;
      raw[offset + 2] = y % 2 === 0 ? 255 : 230;
    }
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function twoStoreySnapshotElements() {
  const entries = [
    ['tsh-lvl-ground', 'level'],
    ['tsh-lvl-upper', 'level'],
    ['tsh-wall-g-south', 'wall'],
    ['tsh-wall-g-east', 'wall'],
    ['tsh-wall-g-north', 'wall'],
    ['tsh-wall-g-west', 'wall'],
    ['tsh-wall-g-hall', 'wall'],
    ['tsh-wall-g-service', 'wall'],
    ['tsh-wall-u-south', 'wall'],
    ['tsh-wall-u-east', 'wall'],
    ['tsh-wall-u-north', 'wall'],
    ['tsh-wall-u-west', 'wall'],
    ['tsh-wall-u-corridor', 'wall'],
    ['tsh-wall-u-bedrooms', 'wall'],
    ['tsh-floor-ground', 'floor'],
    ['tsh-floor-upper', 'floor'],
    ['tsh-stair-main', 'stair'],
    ['tsh-railing-stair', 'railing'],
    ['tsh-roof-main', 'roof'],
    ['tsh-room-g-living', 'room'],
    ['tsh-room-g-kitchen', 'room'],
    ['tsh-room-g-service', 'room'],
    ['tsh-room-u-primary', 'room'],
    ['tsh-room-u-bedroom-2', 'room'],
    ['tsh-room-u-bath-hall', 'room'],
    ['tsh-view-ground-plan', 'plan_view'],
    ['tsh-view-upper-plan', 'plan_view'],
    ['tsh-section-stair', 'section_view'],
    ['tsh-view-3d', 'viewpoint'],
    ['tsh-sheet-a201', 'sheet'],
    ['tsh-schedule-vertical-circulation', 'schedule'],
  ];
  return Object.fromEntries(entries.map(([id, kind]) => [id, { id, kind }]));
}

function createEvidenceServer() {
  const requests = [];
  const pngBytes = makePng(128, 112);
  const pngSha256 = createHash('sha256').update(pngBytes).digest('hex');
  const pdfBytes = Buffer.from('%PDF-1.4\n% two-storey stair runner evidence\n', 'utf8');
  const server = http.createServer(async (request, response) => {
    const body = request.method === 'POST' ? JSON.parse(await readBody(request)) : null;
    requests.push({ method: request.method, url: request.url, body });

    if (request.method === 'POST' && request.url === '/api/models/model-1/bundles') {
      writeJson(response, 200, {
        ok: true,
        applied: body.mode === 'commit',
        wouldRevision: body.mode === 'dry_run' ? 2 : null,
        newRevision: body.mode === 'commit' ? 2 : null,
        changedIds:
          body.mode === 'commit'
            ? ['tsh-wall-g-south', 'tsh-floor-upper', 'tsh-stair-main', 'tsh-railing-stair']
            : [],
        checkpointSnapshotId: body.mode === 'commit' ? 'checkpoint-2' : null,
        violations: [],
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-1/command-log?limit=5') {
      writeJson(response, 200, {
        modelId: 'model-1',
        entries: [
          {
            id: 1,
            userId: 'benchmark-agent',
            revisionAfter: 2,
            appliedCommands: [{ type: 'createStair' }],
          },
        ],
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-1/snapshot') {
      writeJson(response, 200, {
        modelId: 'model-1',
        revision: 2,
        elements: twoStoreySnapshotElements(),
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-1/summary') {
      writeJson(response, 200, {
        modelId: 'model-1',
        revision: 2,
        summary: {
          walls: { total: 12 },
          floors: { count: 2 },
          roofs: { count: 1 },
          rooms: { count: 6 },
          openings: { doors: 6, windows: 8 },
          stairs: { count: 1 },
          railings: { count: 1 },
        },
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-1/validate') {
      writeJson(response, 200, {
        modelId: 'model-1',
        revision: 2,
        violations: [],
        checks: { errorViolationCount: 0, blockingViolationCount: 0 },
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/models/model-1/qa/advisor') {
      writeJson(response, 200, { ok: true, findings: [], summary: { status: 'pass' } });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-1/evidence-package') {
      writeJson(response, 200, {
        deterministicPlanViewEvidence: [
          { planViewId: 'tsh-view-ground-plan' },
          { planViewId: 'tsh-view-upper-plan' },
        ],
        deterministicSectionViewEvidence: [{ sectionViewId: 'tsh-section-stair' }],
        deterministic3dViewEvidence: [{ viewId: 'tsh-view-3d' }],
        deterministicSheetEvidence: [
          {
            sheetId: 'tsh-sheet-a201',
            viewRefs: [
              'plan:tsh-view-ground-plan',
              'plan:tsh-view-upper-plan',
              'section:tsh-section-stair',
              'viewpoint:tsh-view-3d',
            ],
          },
        ],
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-1/exports/gltf-manifest') {
      writeJson(response, 200, {
        extensions: { BIM_AI_exportManifest_v0: { countsByKind: TWO_STOREY_COUNTS_BY_KIND } },
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/models/model-1/exports/ifc-manifest') {
      writeJson(response, 200, {
        format: 'ifc_manifest_v0',
        exportedIfcKindsInArtifact: TWO_STOREY_COUNTS_BY_KIND,
      });
      return;
    }

    if (
      request.method === 'GET' &&
      request.url === '/api/models/model-1/exports/sheet-print-raster.png?sheetId=tsh-sheet-a201'
    ) {
      response.writeHead(200, {
        'content-type': 'image/png',
        'x-bim-ai-sheet-print-raster-contract': 'sheetPrintRasterPrintSurrogate_v2',
        'x-bim-ai-sheet-print-raster-png-sha256': pngSha256,
        'x-bim-ai-sheet-print-raster-width': '128',
        'x-bim-ai-sheet-print-raster-height': '112',
      });
      response.end(pngBytes);
      return;
    }

    if (
      request.method === 'GET' &&
      request.url === '/api/models/model-1/exports/sheet-preview.pdf?sheetId=tsh-sheet-a201'
    ) {
      response.writeHead(200, { 'content-type': 'application/pdf' });
      response.end(pdfBytes);
      return;
    }

    writeJson(response, 404, { error: 'not found' });
  });
  return { server, requests };
}

test('two-storey stair benchmark validates offline semantic fixture', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'two-storey-stair-'));
  const exitCode = await runBenchmark(['--mode', 'offline', '--out-dir', outDir]);
  assert.equal(exitCode, 0);

  const result = JSON.parse(await fs.readFile(path.join(outDir, 'benchmark-result.json'), 'utf8'));
  assert.equal(result.ok, true);
  assert.equal(result.semanticDiff.ok, true);
  assert.deepEqual(result.semanticDiff.diff, []);
  assert.equal(result.semanticSummary.levels.count, 2);
  assert.equal(result.semanticSummary.walls.total, 12);
  assert.equal(result.semanticSummary.stairs.count, 1);
  assert.equal(result.semanticSummary.openings.slabOpenings, 1);
  assert.equal(result.semanticSummary.openings.shaftOpenings, 1);
  assert.equal(result.semanticSummary.railings.hostedOnStairs, 1);
  assert.equal(result.semanticSummary.views.plan, 2);
  assert.equal(result.semanticSummary.views.section, 1);
  assert.deepEqual(result.executionEvidence.rawBundleOnlyCapabilities, [
    'createStair',
    'createSlabOpening',
    'createRailing',
  ]);
});

test('two-storey stair benchmark writes accepted advisor visual export route evidence', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'two-storey-stair-hooks-'));
  await runBenchmark(['--mode', 'offline', '--out-dir', outDir]);

  const advisor = JSON.parse(
    await fs.readFile(path.join(outDir, 'advisor-validation.json'), 'utf8'),
  );
  const visual = JSON.parse(await fs.readFile(path.join(outDir, 'visual-evidence.json'), 'utf8'));
  const exportEvidence = JSON.parse(
    await fs.readFile(path.join(outDir, 'export-evidence.json'), 'utf8'),
  );

  assert.equal(advisor.ok, true);
  assert.equal(advisor.validationPass, true);
  assert.equal(advisor.advisorPass, true);
  assert.equal(visual.status, 'server-side-substitute');
  assert.equal(visual.pass, true);
  assert.equal(exportEvidence.status, 'artifact-or-manifest-returned');
  assert.equal(exportEvidence.pass, true);
  assert.ok(visual.requiredViewIds.includes('tsh-section-stair'));
  assert.equal(exportEvidence.manifests.gltf.summary.geometryProof.counts.stair, 1);
  assert.equal(exportEvidence.manifests.gltf.summary.geometryProof.counts.railing, 1);
  assert.equal(exportEvidence.manifests.gltf.summary.geometryProof.counts.slab_opening, 1);
});

test('two-storey stair benchmark collects live advisor visual and export route evidence', async () => {
  const { server, requests } = createEvidenceServer();
  const address = await listen(server);
  try {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'two-storey-stair-live-'));
    const exitCode = await runBenchmark([
      '--mode',
      'live',
      '--base-url',
      `http://${address.address}:${address.port}`,
      '--model-id',
      'model-1',
      '--parent-revision',
      '1',
      '--out-dir',
      outDir,
      '--commit-live',
    ]);
    assert.equal(exitCode, 0);
    assert.deepEqual(
      requests
        .filter((request) => request.method === 'POST' && request.url.endsWith('/bundles'))
        .map((request) => request.body.mode),
      ['dry_run', 'commit'],
    );
    const visual = JSON.parse(await fs.readFile(path.join(outDir, 'visual-evidence.json'), 'utf8'));
    const exports = JSON.parse(
      await fs.readFile(path.join(outDir, 'export-evidence.json'), 'utf8'),
    );
    const commit = JSON.parse(
      await fs.readFile(path.join(outDir, 'live-commit-evidence.json'), 'utf8'),
    );
    assert.equal(commit.response.newRevision, 2);
    assert.ok(commit.response.changedIds.includes('tsh-stair-main'));
    assert.equal(visual.pass, true);
    assert.equal(visual.sheetPrintRaster.widthPx, 128);
    assert.equal(exports.pass, true);
    assert.equal(exports.manifests.ifc.summary.geometryProof.counts.stair, 1);
  } finally {
    await close(server);
  }
});
