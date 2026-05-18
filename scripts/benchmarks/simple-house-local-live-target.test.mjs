import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findMissingOpenApiPaths,
  normalizeBaseUrl,
  parseArgs,
  preflightBackendCapabilities,
} from './simple-house-local-live-target.mjs';

const REQUIRED_PATHS = [
  '/api/projects/{project_id}/models',
  '/api/models/{model_id}/bundles',
  '/api/models/{model_id}/validate',
  '/api/models/{model_id}/qa/advisor',
  '/api/models/{model_id}/evidence-package',
  '/api/models/{model_id}/exports/gltf-manifest',
  '/api/models/{model_id}/exports/ifc-manifest',
  '/api/models/{model_id}/exports/sheet-print-raster.png',
];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('local live target parser prepares a disposable project by default', () => {
  const args = parseArgs([], {
    BIM_AI_LOCAL_PROJECT_ID: '00000000-0000-4000-8000-000000000001',
  });
  assert.equal(args.baseUrl, 'http://127.0.0.1:8500');
  assert.equal(args.start, true);
  assert.equal(args.preflightOnly, false);
  assert.equal(args.runEvidence, false);
  assert.equal(args.projectId, '00000000-0000-4000-8000-000000000001');
  assert.equal(args.projectSlug, 'm2-wave5-00000000');
});

test('local live target parser supports no-mutation preflight mode', () => {
  const args = parseArgs(
    ['--no-start', '--preflight-only', '--base-url', 'http://127.0.0.1:9999/'],
    { BIM_AI_LOCAL_PROJECT_ID: '00000000-0000-4000-8000-000000000002' },
  );
  assert.equal(args.baseUrl, 'http://127.0.0.1:9999');
  assert.equal(args.start, false);
  assert.equal(args.preflightOnly, true);
});

test('local live target refuses base URLs with credentials before any request', () => {
  assert.throws(
    () => normalizeBaseUrl('http://user:pass@127.0.0.1:8500'),
    /must not contain credentials/,
  );
});

test('local live target OpenAPI check reports missing disposable backend capabilities', () => {
  const missing = findMissingOpenApiPaths({
    paths: {
      '/api/models/{model_id}/bundles': {},
    },
  });
  assert.ok(missing.includes('/api/projects/{project_id}/models'));
  assert.ok(missing.includes('/api/models/{model_id}/validate'));
});

test('local live target preflight passes without mutation when required routes exist', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/api/health')) return jsonResponse({ status: 'ok' });
    if (String(url).endsWith('/openapi.json')) {
      return jsonResponse({
        paths: Object.fromEntries(REQUIRED_PATHS.map((routePath) => [routePath, {}])),
      });
    }
    return jsonResponse({ error: 'unexpected' }, 500);
  };

  const result = await preflightBackendCapabilities('http://127.0.0.1:8500', { fetchImpl });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    'http://127.0.0.1:8500/api/health',
    'http://127.0.0.1:8500/openapi.json',
  ]);
});

test('local live target preflight fails before mutation when model creation route is absent', async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/api/health')) return jsonResponse({ status: 'ok' });
    return jsonResponse({ paths: { '/api/models/{model_id}/bundles': {} } });
  };

  await assert.rejects(
    () => preflightBackendCapabilities('http://127.0.0.1:8500', { fetchImpl }),
    /missing required live evidence API capabilities.*projects/,
  );
});
