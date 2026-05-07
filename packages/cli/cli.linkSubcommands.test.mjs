/**
 * FED-01 polish — CLI link / unlink / links subcommand tests.
 *
 * Runs the cli.mjs entry point as a child process with a stub HTTP server so
 * we can assert the wire payloads it sends.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI = path.join(__dirname, 'cli.mjs');

function startStubServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      let parsed;
      try {
        parsed = body ? JSON.parse(body) : null;
      } catch {
        parsed = body;
      }
      const out = handler(req, parsed);
      res.statusCode = out?.status ?? 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(out?.body ?? { ok: true }));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, base: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function runCli(args, env) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI, ...args], {
      env: { ...process.env, ...env },
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

test('bim-ai link posts createLinkModel with align mode + position', async () => {
  const requests = [];
  const { server, base } = await startStubServer((req, body) => {
    requests.push({ method: req.method, url: req.url, body });
    return { status: 200, body: { ok: true, revision: 2 } };
  });
  const res = await runCli(
    [
      'link',
      '--source',
      '11111111-1111-1111-1111-111111111111',
      '--pos',
      '1000,2000,0',
      '--align',
      'project_origin',
      '--name',
      'Structure',
    ],
    { BIM_AI_BASE_URL: base, BIM_AI_MODEL_ID: 'host-uuid' },
  );
  server.close();
  assert.equal(res.code, 0, res.stderr);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'POST');
  assert.match(requests[0].url, /\/api\/models\/host-uuid\/commands$/);
  assert.deepEqual(requests[0].body.command, {
    type: 'createLinkModel',
    sourceModelId: '11111111-1111-1111-1111-111111111111',
    positionMm: { xMm: 1000, yMm: 2000, zMm: 0 },
    rotationDeg: 0,
    originAlignmentMode: 'project_origin',
    visibilityMode: 'host_view',
    name: 'Structure',
  });
});

test('bim-ai link rejects an invalid --align value', async () => {
  const res = await runCli(
    ['link', '--source', '11111111-1111-1111-1111-111111111111', '--pos', '0,0,0', '--align', 'bad'],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'host-uuid' },
  );
  assert.notEqual(res.code, 0);
  assert.match(res.stderr, /Unknown --align/);
});

test('bim-ai unlink posts deleteLinkModel with the link id', async () => {
  const requests = [];
  const { server, base } = await startStubServer((req, body) => {
    requests.push({ method: req.method, url: req.url, body });
    return { status: 200, body: { ok: true } };
  });
  const res = await runCli(['unlink', 'link-1'], {
    BIM_AI_BASE_URL: base,
    BIM_AI_MODEL_ID: 'host-uuid',
  });
  server.close();
  assert.equal(res.code, 0, res.stderr);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].body.command, { type: 'deleteLinkModel', linkId: 'link-1' });
});

test('bim-ai links lists every link_model with pin/drift status', async () => {
  const snapshotBody = {
    modelId: 'host-uuid',
    revision: 12,
    elements: {
      'link-1': {
        kind: 'link_model',
        id: 'link-1',
        name: 'Structure',
        sourceModelId: '11111111-1111-1111-1111-111111111111',
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        rotationDeg: 0,
        originAlignmentMode: 'origin_to_origin',
        visibilityMode: 'host_view',
        sourceModelRevision: 5,
      },
      'wall-1': { kind: 'wall', id: 'wall-1' },
    },
    violations: [],
    linkSourceRevisions: { '11111111-1111-1111-1111-111111111111': 9 },
  };
  const { server, base } = await startStubServer(() => ({
    status: 200,
    body: snapshotBody,
  }));
  const res = await runCli(['links'], { BIM_AI_BASE_URL: base, BIM_AI_MODEL_ID: 'host-uuid' });
  server.close();
  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.modelId, 'host-uuid');
  assert.equal(out.links.length, 1);
  assert.equal(out.links[0].linkId, 'link-1');
  assert.equal(out.links[0].pinned, true);
  assert.equal(out.links[0].pinnedRevision, 5);
  assert.equal(out.links[0].currentSourceRevision, 9);
  assert.equal(out.links[0].driftCount, 4);
});
