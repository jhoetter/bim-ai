import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
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

  const loggia = report.visualRows.find((row) => row.viewId === 'front_loggia');
  assert.equal(loggia.status, 'pass');
  assert.equal(loggia.savedViewpointPresent, true);
  assert.equal(loggia.screenshot.path, `${EVIDENCE_DIR}/screenshots/front_loggia.png`);
  assert.equal(loggia.screenshot.width, 776);
  assert.equal(loggia.screenshot.height, 563);
  assert.match(loggia.screenshot.sha256, /^sha256:[a-f0-9]{64}$/);
  assert.equal(report.summary.visualPassCount, 8);
  assert.equal(report.summary.visualFailCount, 0);
  assert.equal(report.summary.visualOk, true);
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

test('rejects screenshot manifest rows that do not declare evidence-local artifacts', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'target-house-evidence-acceptance-'));
  const pack = {
    targetId: 'target-house-1',
    requiredViews: [{ id: 'front_loggia', kind: '3d' }],
    requiredRooms: [],
    evidenceRequirements: { schedules: [] },
  };
  await fs.writeFile(
    path.join(dir, 'visual-evidence-contract.json'),
    JSON.stringify(
      {
        inputs: {
          requiredViews: [
            { id: 'front_loggia', viewpointId: 'front_loggia', savedViewpointPresent: true },
          ],
        },
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(dir, 'screenshot-manifest.json'),
    JSON.stringify(
      {
        captures: [
          {
            viewId: 'front_loggia',
            screenshotPath: path.join(
              ROOT_DIR,
              EVIDENCE_DIR,
              'screenshots',
              'front_loggia.png',
            ),
          },
        ],
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(dir, 'snapshot.json'),
    JSON.stringify({ elements: { front_loggia: { id: 'front_loggia', kind: 'viewpoint' } } }),
  );

  const report = await buildTargetHouseEvidenceAcceptanceReport({
    rootDir: ROOT_DIR,
    evidenceDir: dir,
    pack,
  });

  const loggia = report.visualRows.find((row) => row.viewId === 'front_loggia');
  assert.equal(loggia.status, 'fail');
  assert.deepEqual(loggia.issues, ['absolute_screenshot_path']);
  assert.equal(loggia.screenshot, null);
});
