import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { compileTargetHouseAcceptancePack } from './lib/target-house-acceptance-compiler.mjs';
import {
  TARGET_HOUSE_EVIDENCE_ACCEPTANCE_SCHEMA_VERSION,
  buildTargetHouseEvidenceAcceptanceReport,
} from './lib/target-house-evidence-acceptance.mjs';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const EVIDENCE_DIR = 'seed-artifacts/target-house-1/evidence/live-run-current';

test('validates target-house visual evidence views deterministically', async () => {
  const pack = await compileTargetHouseAcceptancePack({ rootDir: ROOT_DIR });
  const report = await buildTargetHouseEvidenceAcceptanceReport({
    rootDir: ROOT_DIR,
    evidenceDir: EVIDENCE_DIR,
    pack,
  });

  assert.equal(report.schemaVersion, TARGET_HOUSE_EVIDENCE_ACCEPTANCE_SCHEMA_VERSION);
  assert.equal(report.targetId, 'target-house-1');
  assert.equal(report.summary.requiredViewCount, 8);

  const main = report.visualRows.find((row) => row.viewId === 'main_front_left');
  assert.equal(main.status, 'pass');
  assert.equal(main.savedViewpointPresent, true);
  assert.equal(main.screenshot.width, 776);
  assert.equal(main.screenshot.height, 563);
  assert.match(main.screenshot.sha256, /^sha256:[a-f0-9]{64}$/);

  const missingLoggia = report.visualRows.find((row) => row.viewId === 'front_loggia');
  assert.equal(missingLoggia.status, 'fail');
  assert.deepEqual(missingLoggia.issues, [
    'missing_visual_contract_view',
    'missing_snapshot_view',
    'missing_screenshot_manifest_capture',
  ]);
  assert.equal(report.summary.visualOk, false);
});

test('validates current target-house BIM data quality as passing structured evidence', async () => {
  const pack = await compileTargetHouseAcceptancePack({ rootDir: ROOT_DIR });
  const report = await buildTargetHouseEvidenceAcceptanceReport({
    rootDir: ROOT_DIR,
    evidenceDir: EVIDENCE_DIR,
    pack,
  });

  assert.equal(report.summary.dataQualityOk, true);
  assert.equal(report.summary.dataQualityFailCount, 0);

  const rooms = report.dataQualityRows.find((row) => row.id === 'rooms_spaces');
  assert.equal(rooms.status, 'pass');
  assert.equal(rooms.actual, 13);
  assert.equal(rooms.expected, 13);

  const schedules = report.dataQualityRows.find((row) => row.id === 'schedules');
  assert.equal(schedules.status, 'pass');
  assert.equal(schedules.actual, 3);

  const exports = report.dataQualityRows.find((row) => row.id === 'export_manifests');
  assert.equal(exports.status, 'pass');
  assert.deepEqual(
    exports.requiredChecks.map((check) => [check.id, check.status]),
    [
      ['ifc_manifest_available', 200],
      ['gltf_manifest_available', 200],
      ['project_hierarchy', 'pass'],
      ['entity_classes', 'pass'],
      ['spaces', 'pass'],
      ['material_layers', 'pass'],
      ['classifications', 'pass'],
    ],
  );
});
