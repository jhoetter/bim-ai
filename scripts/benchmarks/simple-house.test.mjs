import assert from 'node:assert/strict';
import http from 'node:http';
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
