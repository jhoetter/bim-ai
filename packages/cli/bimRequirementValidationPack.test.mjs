import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION,
  BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION,
  buildBimRequirementValidationEvidence,
  compileBimRequirementValidationPack,
  importBuildingSmartIdsXml,
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

function sampleIdsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ids:ids xmlns:ids="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <ids:info>
    <ids:title>Wall Handover IDS</ids:title>
  </ids:info>
  <ids:specifications>
    <ids:specification name="Wall fire handover" ifcVersion="IFC4" minOccurs="1">
      <ids:applicability>
        <ids:entity>
          <ids:name><ids:simpleValue>IfcWall</ids:simpleValue></ids:name>
        </ids:entity>
      </ids:applicability>
      <ids:requirements>
        <ids:attribute>
          <ids:name><ids:simpleValue>Name</ids:simpleValue></ids:name>
        </ids:attribute>
        <ids:classification>
          <ids:system><ids:simpleValue>Uniclass</ids:simpleValue></ids:system>
          <ids:value><ids:simpleValue>Ss_25_10_30</ids:simpleValue></ids:value>
        </ids:classification>
        <ids:property dataType="IFCLABEL">
          <ids:propertySet><ids:simpleValue>Pset_WallCommon</ids:simpleValue></ids:propertySet>
          <ids:baseName><ids:simpleValue>FireRating</ids:simpleValue></ids:baseName>
          <ids:value>
            <xs:restriction base="xs:string">
              <xs:enumeration value="REI30"/>
              <xs:enumeration value="REI60"/>
            </xs:restriction>
          </ids:value>
        </ids:property>
        <ids:material>
          <ids:value><ids:simpleValue>Concrete</ids:simpleValue></ids:value>
        </ids:material>
        <ids:partOf>
          <ids:entity>
            <ids:name><ids:simpleValue>IfcBuildingStorey</ids:simpleValue></ids:name>
          </ids:entity>
          <ids:relation><ids:simpleValue>IFCRELCONTAINEDINSPATIALSTRUCTURE</ids:simpleValue></ids:relation>
        </ids:partOf>
      </ids:requirements>
    </ids:specification>
  </ids:specifications>
</ids:ids>`;
}

function idsEvidenceRow(overrides = {}) {
  return {
    id: 'wall-1',
    ifcEntity: 'IfcWall',
    attributes: { Name: 'Rated wall' },
    properties: { Pset_WallCommon: { FireRating: 'REI60' } },
    classifications: [{ system: 'Uniclass', value: 'Ss_25_10_30' }],
    materials: ['Concrete'],
    partOf: [
      {
        entity: 'IfcBuildingStorey',
        relation: 'IFCRELCONTAINEDINSPATIALSTRUCTURE',
        name: 'Level 1',
      },
    ],
    ...overrides,
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

test('imports buildingSMART IDS XML into the full deterministic facet matrix', () => {
  const imported = importBuildingSmartIdsXml(sampleIdsXml());
  const pack = compileBimRequirementValidationPack({ idsXml: sampleIdsXml() });

  assert.equal(imported.schemaVersion, 'buildingSMART-IDS-1.0');
  assert.equal(pack.sourceFormat, 'buildingSMART_IDS_XML');
  assert.equal(pack.packId, 'Wall Handover IDS');
  assert.deepEqual(pack.summary.idsFacetTypes, [
    'attribute',
    'classification',
    'entity',
    'material',
    'partOf',
    'property',
  ]);
  assert.ok(pack.checks.some((check) => check.predicate.facet?.type === 'property'));
  assert.ok(pack.checks.some((check) => check.predicate.facet?.type === 'partOf'));
});

test('validates positive and negative buildingSMART IDS facet evidence deterministically', () => {
  const pack = compileBimRequirementValidationPack({ idsXml: sampleIdsXml() });
  const passing = validateCompiledBimRequirementValidationPack(pack, {
    idsFacetRows: [idsEvidenceRow()],
  });
  const failing = validateCompiledBimRequirementValidationPack(pack, {
    idsFacetRows: [idsEvidenceRow({ properties: { Pset_WallCommon: { FireRating: 'EI15' } } })],
  });

  assert.equal(passing.ok, true, JSON.stringify(passing.blockers, null, 2));
  assert.equal(failing.ok, false);
  assert.ok(
    failing.blockers.some((blocker) =>
      blocker.code.startsWith('ids_wall-fire-handover_property_'),
    ),
  );
});
