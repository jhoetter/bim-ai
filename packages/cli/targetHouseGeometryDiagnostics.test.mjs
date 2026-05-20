import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TARGET_HOUSE_GEOMETRY_DIAGNOSTIC_SCHEMA_VERSION,
  buildTargetHouseGeometryDiagnostic,
  readJson,
  renderTargetHouseGeometryDiagnosticMarkdown,
} from './lib/target-house-geometry-diagnostics.mjs';
import { resolveTargetHouseSnapshotInput } from './lib/target-house-package-inputs.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const targetHouseManifest = resolve(repoRoot, 'seed-artifacts/target-house-1/manifest.json');
const targetHouseSeedSkip = existsSync(targetHouseManifest)
  ? false
  : 'target-house-1 seed artifact not present';

function loadCurrentTargetHouseReport() {
  const snapshotInput = resolveTargetHouseSnapshotInput({ repoRoot, seed: 'target-house-1' });
  return buildTargetHouseGeometryDiagnostic({
    snapshot: snapshotInput.snapshot,
    requiredFeatures: readJson(
      resolve(repoRoot, 'spec/generated/target-house-1-required-features.json'),
    ),
    sourceDigests: snapshotInput.sourceDigests,
    snapshotSource: snapshotInput.snapshotSource,
  });
}

test(
  'target-house current diagnostic stays clean for geometry source-corrected seed',
  { skip: targetHouseSeedSkip },
  () => {
    const first = loadCurrentTargetHouseReport();
    const second = loadCurrentTargetHouseReport();

    assert.deepEqual(first, second);
    assert.equal(first.schemaVersion, TARGET_HOUSE_GEOMETRY_DIAGNOSTIC_SCHEMA_VERSION);
    assert.ok(
      ['fresh_live_snapshot', 'materialized_seed_bundle'].includes(
        first.generatedFrom.snapshotSource.kind,
      ),
    );
    assert.equal(first.summary.total, first.findings.length);
    assert.equal(first.summary.total, 0);
    assert.equal(first.summary.bySeverity.error, 0);
    assert.equal(first.summary.bySeverity.warning, 0);
    assert.deepEqual(first.summary.byCategory, {});
    assert.deepEqual(first.findings, []);
  },
);

test(
  'target-house authoritative bundle excludes corrected diagnostic root causes',
  { skip: targetHouseSeedSkip },
  () => {
    const snapshotInput = resolveTargetHouseSnapshotInput({
      repoRoot,
      seed: 'target-house-1',
      forceMaterialized: true,
    });
    const elements = Object.values(snapshotInput.snapshot.elements);
    const ids = new Set(elements.map((element) => element.id));

    assert.equal(snapshotInput.snapshotSource.kind, 'materialized_seed_bundle');
    assert.ok(elements.some((element) => element.kind === 'room_separation'));
    assert.equal(
      elements.some((element) => element.kind === 'roof_opening'),
      false,
    );
    assert.ok(elements.some((element) => element.kind === 'slab_opening'));
    assert.equal(
      elements.some((element) => /^access-(wall|door)-/.test(element.id)),
      false,
    );
    assert.equal(
      elements.some((element) => /^target-house-.*access-partition$/.test(element.id)),
      false,
    );
    assert.ok(elements.filter((element) => element.kind === 'window').length >= 4);
    for (const requiredRoomId of [
      'room_gf_bath_laundry',
      'room_gf_carport',
      'room_gf_entry',
      'room_gf_kitchen_dining',
      'room_gf_living',
      'room_gf_utility',
      'room_l1_bedroom_2',
      'room_l1_deep_loggia',
      'room_l1_ensuite',
      'room_l1_hall_landing',
      'room_l1_primary_bedroom',
      'room_l1_roof_court',
      'room_l1_walk_in_closet',
    ]) {
      assert.ok(ids.has(requiredRoomId), `${requiredRoomId} must be bound in the snapshot`);
    }
  },
);

test(
  'target-house markdown report includes bounds, findings, and rule catalog',
  { skip: targetHouseSeedSkip },
  () => {
    const markdown = renderTargetHouseGeometryDiagnosticMarkdown(loadCurrentTargetHouseReport());

    assert.match(markdown, /^# Target House 1 Current Geometry Diagnostic/);
    assert.match(markdown, /Total findings: 0/);
    assert.match(markdown, /unsupported_renderer_feature/);
    assert.match(markdown, /## Rule Catalog/);
  },
);

test(
  'target-house snapshot resolver can materialize authoritative seed bundle instead of live snapshot',
  { skip: targetHouseSeedSkip },
  () => {
    const liveInput = resolveTargetHouseSnapshotInput({ repoRoot, seed: 'target-house-1' });

    assert.ok(
      ['fresh_live_snapshot', 'materialized_seed_bundle'].includes(liveInput.snapshotSource.kind),
    );
    const materializedInput = resolveTargetHouseSnapshotInput({
      repoRoot,
      seed: 'target-house-1',
      forceMaterialized: true,
    });
    assert.equal(materializedInput.snapshotSource.kind, 'materialized_seed_bundle');
    assert.equal(materializedInput.snapshotSource.regenerated, true);
    assert.ok(Object.keys(materializedInput.snapshot.elements).length > 0);
  },
);

test('minimal diagnostic allows analytical room separators and catches overlapping hosted cuts', () => {
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
  assert.ok(!codes.includes('helper.room_separation.visible_in_snapshot'));
  assert.ok(codes.includes('renderer.wall_cut.overlapping_hosted_cuts'));
});

test('minimal diagnostic catches detached access stubs and unsupported target-house cuts', () => {
  const snapshot = {
    modelId: 'mini-regression',
    revision: 1,
    elements: {
      'lvl-1': { id: 'lvl-1', kind: 'level', elevationMm: 0 },
      floor: {
        id: 'floor',
        kind: 'floor',
        levelId: 'lvl-1',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 6000, yMm: 0 },
          { xMm: 6000, yMm: 6000 },
          { xMm: 0, yMm: 6000 },
        ],
      },
      roof: {
        id: 'roof',
        kind: 'roof',
        referenceLevelId: 'lvl-1',
        roofGeometryMode: 'asymmetric_gable',
        footprintMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 6000, yMm: 0 },
          { xMm: 6000, yMm: 6000 },
          { xMm: 0, yMm: 6000 },
        ],
      },
      'access-wall-test': {
        id: 'access-wall-test',
        kind: 'wall',
        levelId: 'lvl-1',
        start: { xMm: 1000, yMm: 1000 },
        end: { xMm: 2000, yMm: 1000 },
      },
      'access-door-test': {
        id: 'access-door-test',
        kind: 'door',
        wallId: 'access-wall-test',
        alongT: 0.5,
        widthMm: 800,
      },
      'roof-cut': {
        id: 'roof-cut',
        kind: 'roof_opening',
        hostRoofId: 'roof',
        boundaryMm: [
          { xMm: 2500, yMm: 2500 },
          { xMm: 3500, yMm: 2500 },
          { xMm: 3500, yMm: 3500 },
          { xMm: 2500, yMm: 3500 },
        ],
      },
      'stair-cut': {
        id: 'stair-cut',
        kind: 'slab_opening',
        hostFloorId: 'floor',
        boundaryMm: [
          { xMm: 500, yMm: 500 },
          { xMm: 1500, yMm: 500 },
          { xMm: 1500, yMm: 1500 },
          { xMm: 500, yMm: 1500 },
        ],
      },
    },
  };
  const report = buildTargetHouseGeometryDiagnostic({
    snapshot,
    requiredFeatures: { scaleBasis: { overallWidthMm: 6000, overallDepthMm: 6000 } },
  });

  const codes = report.findings.map((finding) => finding.code);
  assert.ok(codes.includes('helper.wall.access_stub_visible_in_snapshot'));
  assert.ok(codes.includes('helper.door.access_stub_visible_in_snapshot'));
  assert.ok(codes.includes('geometry.hosted_opening_on_access_stub'));
  assert.ok(codes.includes('renderer.roof_opening.asymmetric_gable_unproven'));
  assert.ok(!codes.includes('renderer.slab_opening.stair_penetration_unproven'));
});

test('minimal diagnostic catches building and toposolid footprints partially off site terrain', () => {
  const snapshot = {
    modelId: 'mini-site-regression',
    revision: 1,
    elements: {
      site: {
        id: 'site',
        kind: 'site',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 10000, yMm: 0 },
          { xMm: 10000, yMm: 10000 },
          { xMm: 0, yMm: 10000 },
        ],
      },
      topo: {
        id: 'topo',
        kind: 'toposolid',
        boundaryMm: [
          { xMm: -100, yMm: 0 },
          { xMm: 9000, yMm: 0 },
          { xMm: 9000, yMm: 9000 },
          { xMm: 0, yMm: 9000 },
        ],
      },
      floor: {
        id: 'floor',
        kind: 'floor',
        hostToposolidId: 'topo',
        boundaryMm: [
          { xMm: 1000, yMm: 1000 },
          { xMm: 9500, yMm: 1000 },
          { xMm: 9500, yMm: 5000 },
          { xMm: 1000, yMm: 5000 },
        ],
      },
    },
  };
  const report = buildTargetHouseGeometryDiagnostic({
    snapshot,
    requiredFeatures: { scaleBasis: { overallWidthMm: 10000, overallDepthMm: 10000 } },
  });

  const codes = report.findings.map((finding) => finding.code);
  assert.ok(codes.includes('site.toposolid_partially_outside_site'));
  assert.ok(codes.includes('site.building_partially_outside_host_toposolid'));
  assert.ok(
    report.findings
      .filter((finding) => finding.code.startsWith('site.'))
      .every((finding) => finding.trackerItems.includes('BIR-S05')),
  );
});
