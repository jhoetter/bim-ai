import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  TARGET_HOUSE_ACCEPTANCE_SCHEMA_VERSION,
  compileTargetHouseAcceptancePack,
  stableStringifyTargetHouseAcceptancePack,
  validateTargetHouseAcceptancePack,
} from './lib/target-house-acceptance-compiler.mjs';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

test('compiles target-house sources into a stable required-feature pack', async () => {
  const first = await compileTargetHouseAcceptancePack({ rootDir: ROOT_DIR });
  const second = await compileTargetHouseAcceptancePack({ rootDir: ROOT_DIR });

  assert.deepEqual(second, first);
  assert.equal(
    stableStringifyTargetHouseAcceptancePack(first),
    stableStringifyTargetHouseAcceptancePack(second),
  );
  assert.equal(first.schemaVersion, TARGET_HOUSE_ACCEPTANCE_SCHEMA_VERSION);
  assert.equal(first.kind, 'target_house_required_feature_pack');
  assert.equal(first.targetId, 'target-house-1');
  assert.equal(first.requiredFeatures.length, 10);
  assert.equal(first.requiredRooms.length, 13);
  assert.ok(
    Object.keys(first.sourceDigests).every((sourcePath) =>
      sourcePath.startsWith('spec/target-house/'),
    ),
  );

  const validation = validateTargetHouseAcceptancePack(first);
  assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));
});

test('extracts required views with acceptance aliases', async () => {
  const pack = await compileTargetHouseAcceptancePack({ rootDir: ROOT_DIR });
  const viewIds = pack.requiredViews.map((view) => view.id);

  assert.deepEqual(viewIds, [
    'main_front_left',
    'roof_high',
    'front_elevation',
    'front_loggia',
    'rear_right_axon',
    'ground_floor_plan',
    'first_floor_plan',
    'wire_diagnostic',
  ]);

  const roofView = pack.requiredViews.find((view) => view.id === 'roof_high');
  const loggiaView = pack.requiredViews.find((view) => view.id === 'front_loggia');
  const upperPlan = pack.requiredViews.find((view) => view.id === 'first_floor_plan');
  const wireView = pack.requiredViews.find((view) => view.id === 'wire_diagnostic');

  assert.ok(roofView.aliases.includes('roof-court'));
  assert.ok(loggiaView.aliases.includes('loggia'));
  assert.ok(upperPlan.aliases.includes('upper-plan'));
  assert.equal(wireView.evidenceType, 'diagnostic_screenshot');
});

test('maps feature ids, semantic selectors, evidence, and phases', async () => {
  const pack = await compileTargetHouseAcceptancePack({ rootDir: ROOT_DIR });
  const features = new Map(pack.requiredFeatures.map((feature) => [feature.id, feature]));

  assert.deepEqual(
    [...features.keys()],
    [
      'primary_massing_envelope',
      'folded_white_wrapper_shell',
      'roof_terrace_cutout',
      'front_deep_loggia',
      'asymmetric_gable_envelope',
      'vertical_cladding_zones',
      'opening_and_glazing_rhythm',
      'room_access_and_enclosure',
      'site_orientation_and_plinth',
      'documentation_evidence_set',
    ],
  );

  const roofCourt = features.get('roof_terrace_cutout');
  assert.equal(roofCourt.phaseId, 'P3');
  assert.deepEqual(roofCourt.requiredViewIds, ['main_front_left', 'roof_high', 'rear_right_axon']);
  assert.ok(roofCourt.semanticSelectors.includes('room:room_l1_roof_court'));
  assert.ok(roofCourt.evidenceTypes.includes('constructability_report'));

  const loggia = features.get('front_deep_loggia');
  assert.equal(loggia.phaseId, 'P4');
  assert.ok(loggia.requiredViewIds.includes('front_loggia'));
  assert.ok(loggia.semanticSelectors.includes('room:room_l1_deep_loggia'));

  const rooms = features.get('room_access_and_enclosure');
  assert.equal(rooms.phaseId, 'P5');
  assert.ok(rooms.semanticSelectors.includes('room:room_gf_kitchen_dining'));
  assert.ok(rooms.evidenceTypes.includes('schedule'));

  const documentation = features.get('documentation_evidence_set');
  assert.equal(documentation.phaseId, 'P7');
  assert.ok(documentation.evidenceTypes.includes('export_manifest'));
  assert.ok(documentation.evidenceTypes.includes('tolerance_ledger'));
});

test('carries evidence requirements and tolerance inputs for later acceptance', async () => {
  const pack = await compileTargetHouseAcceptancePack({ rootDir: ROOT_DIR });

  assert.ok(pack.evidenceRequirements.screenshots.includes('main_front_left'));
  assert.ok(pack.evidenceRequirements.screenshots.includes('front_loggia'));
  assert.ok(pack.evidenceRequirements.screenshots.includes('wire_diagnostic'));
  assert.ok(pack.evidenceRequirements.advisor.includes('construction_readiness_profile'));
  assert.ok(pack.evidenceRequirements.schedules.includes('room_schedule'));
  assert.ok(pack.evidenceRequirements.exports.includes('IFC'));
  assert.ok(pack.evidenceRequirements.manifests.includes('tolerance_ledger'));
  assert.ok(pack.tolerances.some((tolerance) => tolerance.id === 'tolerance_scale_basis'));
  assert.ok(
    pack.tolerances.some((tolerance) => tolerance.id === 'tolerance_site_georeference_unavailable'),
  );
});

test('fails on empty or malformed sources', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'target-house-acceptance-'));
  await fs.mkdir(path.join(dir, 'spec/target-house'), { recursive: true });

  const sources = {
    checklist: 'spec/target-house/checklist.md',
    sketchIr: 'spec/target-house/sketch-ir.json',
    bimRequirements: 'spec/target-house/bir.md',
    phasePlan: 'spec/target-house/phase-plan.md',
  };

  await fs.writeFile(path.join(dir, sources.checklist), '# Checklist\n');
  await fs.writeFile(path.join(dir, sources.sketchIr), '{bad json');
  await fs.writeFile(path.join(dir, sources.bimRequirements), '# BIR\n');
  await fs.writeFile(path.join(dir, sources.phasePlan), '# Phase Plan\n');

  await assert.rejects(
    () => compileTargetHouseAcceptancePack({ rootDir: dir, sources }),
    /Malformed sketch IR JSON/,
  );

  await fs.writeFile(
    path.join(dir, sources.sketchIr),
    JSON.stringify({
      schemaVersion: 'sketch-understanding-ir.v0',
      features: [],
      requiredViews: [],
    }),
  );
  await assert.rejects(
    () => compileTargetHouseAcceptancePack({ rootDir: dir, sources }),
    /features must be a non-empty array/,
  );

  await fs.writeFile(path.join(dir, sources.sketchIr), '{}');
  await fs.writeFile(path.join(dir, sources.checklist), '');
  await assert.rejects(
    () => compileTargetHouseAcceptancePack({ rootDir: dir, sources }),
    /source is empty/,
  );
});
