import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TARGET_HOUSE_GEOMETRY_DIAGNOSTIC_SCHEMA_VERSION,
  buildTargetHouseGeometryDiagnostic,
  readJson,
  renderTargetHouseGeometryDiagnosticMarkdown,
} from './lib/target-house-geometry-diagnostics.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function loadCurrentTargetHouseReport() {
  return buildTargetHouseGeometryDiagnostic({
    snapshot: readJson(
      resolve(repoRoot, 'seed-artifacts/target-house-1/evidence/live-run-current/snapshot.json'),
    ),
    requiredFeatures: readJson(resolve(repoRoot, 'spec/generated/target-house-1-required-features.json')),
  });
}

test('target-house current diagnostic reports every requested finding bucket deterministically', () => {
  const first = loadCurrentTargetHouseReport();
  const second = loadCurrentTargetHouseReport();

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, TARGET_HOUSE_GEOMETRY_DIAGNOSTIC_SCHEMA_VERSION);
  assert.deepEqual(first.summary.byCategory, {
    detached_or_flying: 33,
    helper_leakage: 78,
    out_of_envelope: 20,
    sketch_critical_mismatch: 16,
    unsupported_renderer_feature: 8,
  });
  assert.equal(first.summary.total, 155);

  const codes = new Set(first.findings.map((finding) => finding.code));
  assert.ok(codes.has('helper.room_separation.visible_in_snapshot'));
  assert.ok(codes.has('geometry.hosted_opening_on_access_stub'));
  assert.ok(codes.has('geometry.element_outside_source_envelope'));
  assert.ok(codes.has('renderer.roof_opening.asymmetric_gable_unproven'));
  assert.ok(codes.has('renderer.wall_cut.overlapping_hosted_cuts'));
  assert.ok(codes.has('sketch.scale_basis_not_met'));
  assert.ok(codes.has('sketch.required_room_id_missing'));
});

test('target-house markdown report includes bounds, findings, and rule catalog', () => {
  const markdown = renderTargetHouseGeometryDiagnosticMarkdown(loadCurrentTargetHouseReport());

  assert.match(markdown, /^# Target House 1 Current Geometry Diagnostic/);
  assert.match(markdown, /Total findings: 155/);
  assert.match(markdown, /`unsupported_renderer_feature`/);
  assert.match(markdown, /renderer\.roof_opening\.asymmetric_gable_unproven/);
  assert.match(markdown, /## Rule Catalog/);
});

test('minimal diagnostic catches helper leakage and overlapping hosted cuts', () => {
  const snapshot = {
    modelId: 'mini',
    revision: 1,
    elements: {
      'lvl-1': { id: 'lvl-1', kind: 'level', elevationMm: 0 },
      floor: {
        id: 'floor',
        kind: 'floor',
        levelId: 'lvl-1',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 5000, yMm: 0 },
          { xMm: 5000, yMm: 5000 },
          { xMm: 0, yMm: 5000 },
        ],
      },
      wall: {
        id: 'wall',
        kind: 'wall',
        levelId: 'lvl-1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 5000, yMm: 0 },
      },
      door: { id: 'door', kind: 'door', wallId: 'wall', alongT: 0.5, widthMm: 1000 },
      opening: {
        id: 'opening',
        kind: 'wall_opening',
        hostWallId: 'wall',
        alongTStart: 0.4,
        alongTEnd: 0.6,
        sillHeightMm: 0,
        headHeightMm: 2200,
      },
      sep: {
        id: 'sep',
        kind: 'room_separation',
        levelId: 'lvl-1',
        start: { xMm: 100, yMm: 100 },
        end: { xMm: 200, yMm: 100 },
      },
    },
  };
  const report = buildTargetHouseGeometryDiagnostic({
    snapshot,
    requiredFeatures: { scaleBasis: { overallWidthMm: 5000, overallDepthMm: 5000 } },
  });

  const codes = report.findings.map((finding) => finding.code);
  assert.ok(codes.includes('helper.room_separation.visible_in_snapshot'));
  assert.ok(codes.includes('renderer.wall_cut.overlapping_hosted_cuts'));
});
