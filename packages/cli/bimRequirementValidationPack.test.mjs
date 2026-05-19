import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION,
  BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION,
  buildBimRequirementValidationEvidence,
  compileBimRequirementValidationPack,
  validateCompiledBimRequirementValidationPack,
} from './lib/bim-requirement-validation-pack.mjs';
import { buildExchangeValidationReport } from './lib/sketch-initiation.mjs';

function sampleIr(overrides = {}) {
  return {
    qualityTarget: 'project_initiation_bim',
    informationRequirements: {
      qualityTarget: 'project_initiation_bim',
      exportRequirements: {
        outputs: ['IFC', 'GLB', 'room schedule', 'evidence-package'],
      },
      rooms: [
        {
          number: 'G-101',
          name: 'Living',
          level: 'ground',
          function: 'living',
          targetAreaM2: 20,
          boundingStatus: 'bounded',
        },
        {
          number: 'G-102',
          name: 'Kitchen',
          level: 'ground',
          function: 'cooking',
          targetAreaM2: 12,
          boundingStatus: 'bounded',
        },
      ],
      elementSemanticRequirements: [
        {
          category: 'room',
          expectedBimCategory: 'room',
          ifcEntityIntent: 'IfcSpace',
        },
        {
          category: 'roof',
          expectedBimCategory: 'roof',
          ifcEntityIntent: 'IfcRoof',
        },
      ],
      materialLayerSetRequirements: [
        {
          id: 'layer_roof_shell',
          layerSetName: 'ROOF-WHITE-FOLDED-SHELL-500',
          appliesToCategories: ['roof'],
        },
      ],
      schedules: [
        {
          id: 'room_schedule',
          requiredColumns: ['number', 'name', 'level', 'targetAreaM2', 'function'],
        },
      ],
      classificationRequirements: {
        roomSystem: 'DIN 277-like placeholder',
      },
      dataQualityChecks: ['rooms_spaces_bounded_accessible_schedulable'],
      ...overrides,
    },
  };
}

test('compiles BIM information requirements into deterministic validation checks', () => {
  const first = compileBimRequirementValidationPack(sampleIr(), { packId: 'target-house' });
  const second = compileBimRequirementValidationPack(sampleIr(), { packId: 'target-house' });

  assert.equal(first.schemaVersion, BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION);
  assert.equal(first.packId, 'target-house');
  assert.equal(first.sourceDigestSha256, second.sourceDigestSha256);
  assert.deepEqual(
    first.checks.map((check) => check.id),
    [...first.checks.map((check) => check.id)].sort((a, b) => a.localeCompare(b)),
  );
  assert.ok(first.checks.some((check) => check.id === 'bir_export_output_ifc'));
  assert.ok(first.checks.some((check) => check.id === 'bir_semantic_roof_ifcroof'));
  assert.ok(first.checks.some((check) => check.id === 'bir_schedule_room-schedule_columns'));
  assert.equal(first.summary.evidenceBlockerCount, first.summary.checkCount);
});

test('validates compiled requirements against exchange artifacts and model evidence', () => {
  const compiled = compileBimRequirementValidationPack(sampleIr());
  const report = validateCompiledBimRequirementValidationPack(compiled, {
    modelStats: {
      countsByKind: { room: 2, roof: 1 },
      rooms: [
        {
          number: 'G-101',
          name: 'Living',
          level: 'ground',
          function: 'living',
          targetAreaM2: 20,
          boundingStatus: 'bounded',
        },
        {
          number: 'G-102',
          name: 'Kitchen',
          level: 'ground',
          function: 'cooking',
          targetAreaM2: 12,
          boundingStatus: 'bounded',
        },
      ],
      materialLayerSets: [{ id: 'layer_roof_shell', layerSetName: 'ROOF-WHITE-FOLDED-SHELL-500' }],
    },
    ifcManifest: { ok: true, body: { countsByIfcKind: { IfcSpace: 2, IfcRoof: 1 } } },
    gltfManifest: { ok: true },
    evidencePackage: {
      dataQualityResults: [{ id: 'rooms_spaces_bounded_accessible_schedulable', status: 'pass' }],
    },
    schedules: [
      {
        id: 'room_schedule',
        columns: ['number', 'name', 'level', 'targetAreaM2', 'function'],
      },
    ],
  });

  assert.equal(report.schemaVersion, BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION);
  assert.equal(report.ok, true, JSON.stringify(report.blockers, null, 2));
  assert.equal(report.summary.errorCount, 0);
});

test('missing exchange evidence becomes deterministic blockers', () => {
  const { report } = buildBimRequirementValidationEvidence({
    ir: sampleIr(),
    modelStats: { countsByKind: { room: 1 } },
    artifacts: ['evidence-package.json'],
  });

  const blockerCodes = report.blockers.map((blocker) => blocker.code);
  assert.equal(report.ok, false);
  assert.ok(blockerCodes.includes('bir_export_output_ifc'));
  assert.ok(blockerCodes.includes('bir_export_output_glb'));
  assert.ok(blockerCodes.includes('bir_rooms_min_count'));
  assert.ok(blockerCodes.includes('bir_data_quality_rooms-spaces-bounded-accessible-schedulable'));
});

test('methodology exchange validation carries compiled BIR pack evidence', () => {
  const report = buildExchangeValidationReport({
    ir: sampleIr(),
    modelStats: { modelId: 'm1', revision: 3, countsByKind: { room: 2, roof: 1 } },
    ifcManifest: { ok: true, body: { countsByIfcKind: { IfcSpace: 2, IfcRoof: 1 } } },
    gltfManifest: { ok: true },
    evidencePackage: {
      dataQualityResults: [{ id: 'rooms_spaces_bounded_accessible_schedulable', status: 'pass' }],
    },
  });

  assert.equal(report.schemaVersion, 'sketch.exchange-validation.v1');
  assert.equal(
    report.birValidationPack.schemaVersion,
    BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION,
  );
  assert.equal(
    report.birValidationReport.schemaVersion,
    BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION,
  );
  assert.ok(report.birValidationReport.blockers.length > 0);
  assert.ok(
    report.birValidationReport.blockers.some(
      (blocker) => blocker.code === 'bir_export_output_room-schedule',
    ),
  );
});
