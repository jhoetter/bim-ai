import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  buildAcceptanceGateReport,
  buildCapabilityCoverage,
  buildVisualChecklist,
} from './lib/sketch-initiation.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI = path.join(__dirname, 'cli.mjs');

function runCli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI, ...args], {
      env: { ...process.env, ...env },
      cwd: path.resolve(__dirname, '../..'),
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

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function sha256File(filePath) {
  return createHash('sha256')
    .update(await fs.readFile(filePath))
    .digest('hex');
}

function currentGitHead() {
  return execSync('git rev-parse HEAD', {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8',
  }).trim();
}

function validIr() {
  return {
    schemaVersion: 'sketch-understanding-ir.v0',
    projectType: 'single_family_house',
    qualityTarget: 'project_initiation_bim',
    sourceInputs: {
      images: ['spec/target-house/target-house-1.png'],
      userInstruction: 'Create a BIM seed model from this sketch.',
    },
    visualRead: {
      primaryView: 'front-left axonometric',
      dominantVolumes: [
        {
          id: 'upper_wrapper',
          description: 'white folded upper shell',
          priority: 'critical',
        },
      ],
      nonNegotiables: ['embedded roof terrace'],
    },
    programme: [
      {
        name: 'Living',
        level: 'ground',
        programmeCode: 'living',
      },
    ],
    informationRequirements: {
      qualityTarget: 'project_initiation_bim',
      lodIntent: 'LOD 200 project initiation geometry with named BIM objects',
      loiIntent: 'LOI 200 with room, type, material, classification, and schedule placeholders',
      exchangeGoal: 'IFC-ready architectural seed for project initiation review',
      modelUses: ['spatial coordination', 'room schedule', 'IFC handoff'],
      disciplineScope: ['architecture', 'structure-lite', 'MEP-lite'],
      requiredChecks: [
        'rooms_spaces',
        'element_semantics',
        'material_layer_sets',
        'classification_placeholders',
        'schedule_export_readiness',
      ],
      rooms: [
        {
          name: 'Living',
          number: 'G-101',
          level: 'ground',
          targetAreaM2: 32,
          function: 'living',
          occupancyUse: 'residential living area',
          boundingStatus: 'target_bounded',
          access: { requiredDoors: 1, connectsTo: ['Entrance'] },
          schedule: { include: true, scheduleName: 'Room Schedule' },
          classification: {
            din277Use: 'NUF living',
            din277AreaType: 'NUF',
            ifcEntityIntent: 'IfcSpace',
          },
        },
      ],
      elementSemanticRequirements: [
        {
          category: 'exterior_wall',
          expectedBimCategory: 'wall',
          ifcEntityIntent: 'IfcWall',
          classification: { din276CostGroup: 'KG 330', ifcClassificationRef: 'planned' },
        },
        {
          category: 'interior_wall',
          expectedBimCategory: 'wall',
          ifcEntityIntent: 'IfcWall',
          classification: { din276CostGroup: 'KG 340', ifcClassificationRef: 'planned' },
        },
        {
          category: 'slab',
          expectedBimCategory: 'floor',
          ifcEntityIntent: 'IfcSlab',
          classification: { din276CostGroup: 'KG 320', ifcClassificationRef: 'planned' },
        },
        {
          category: 'roof',
          expectedBimCategory: 'roof',
          ifcEntityIntent: 'IfcRoof',
          classification: { din276CostGroup: 'KG 360', ifcClassificationRef: 'planned' },
        },
        {
          category: 'stair',
          expectedBimCategory: 'stair',
          ifcEntityIntent: 'IfcStair',
          classification: { din276CostGroup: 'KG 350', ifcClassificationRef: 'planned' },
        },
        {
          category: 'door',
          expectedBimCategory: 'door',
          ifcEntityIntent: 'IfcDoor',
          classification: { din276CostGroup: 'KG 334', ifcClassificationRef: 'planned' },
        },
        {
          category: 'window',
          expectedBimCategory: 'window',
          ifcEntityIntent: 'IfcWindow',
          classification: { din276CostGroup: 'KG 334', ifcClassificationRef: 'planned' },
        },
        {
          category: 'railing',
          expectedBimCategory: 'railing',
          ifcEntityIntent: 'IfcRailing',
          classification: { din276CostGroup: 'KG 336', ifcClassificationRef: 'planned' },
        },
        {
          category: 'room',
          expectedBimCategory: 'room',
          ifcEntityIntent: 'IfcSpace',
          classification: { din276CostGroup: 'DIN277', ifcClassificationRef: 'planned' },
        },
        {
          category: 'asset',
          expectedBimCategory: 'furniture',
          ifcEntityIntent: 'IfcFurnishingElement',
          classification: { din276CostGroup: 'KG 600', ifcClassificationRef: 'planned' },
        },
      ],
      materialLayerSetRequirements: [
        {
          id: 'mls-ext-wall',
          layerSetName: 'Exterior wall concept layers',
          appliesToCategories: ['wall'],
          totalThicknessMm: 360,
          layers: [
            { function: 'structure', materialKey: 'masonry_placeholder', thicknessMm: 240 },
            { function: 'insulation', materialKey: 'mineral_wool_placeholder', thicknessMm: 120 },
          ],
          performancePlaceholders: {
            thermal: 'U-value placeholder required',
            fire: 'fire rating placeholder required',
            acoustic: 'Rw placeholder required',
          },
        },
        {
          id: 'mls-slab',
          layerSetName: 'Slab concept layers',
          appliesToCategories: ['slab'],
          totalThicknessMm: 300,
          layers: [
            { function: 'structure', materialKey: 'concrete_placeholder', thicknessMm: 240 },
            { function: 'finish', materialKey: 'screed_placeholder', thicknessMm: 60 },
          ],
          performancePlaceholders: {
            thermal: 'edge insulation placeholder required',
            fire: 'REI placeholder required',
            acoustic: 'impact sound placeholder required',
          },
        },
        {
          id: 'mls-roof',
          layerSetName: 'Roof concept layers',
          appliesToCategories: ['roof'],
          totalThicknessMm: 420,
          layers: [
            { function: 'structure', materialKey: 'timber_roof_placeholder', thicknessMm: 240 },
            {
              function: 'insulation',
              materialKey: 'roof_insulation_placeholder',
              thicknessMm: 180,
            },
          ],
          performancePlaceholders: {
            thermal: 'roof U-value placeholder required',
            fire: 'roof fire placeholder required',
            acoustic: 'rain noise placeholder required',
          },
        },
      ],
      classificationRequirements: {
        roomSystem: 'DIN277',
        elementSystem: 'DIN276',
        ifcClassificationReferences: 'planned',
        requiredPlaceholders: [
          'DIN277 room use',
          'DIN276 cost group',
          'IFC classification reference',
        ],
      },
      structureLiteRequirements: {
        loadBearingFlags: [
          {
            category: 'exterior_wall',
            assumption: 'Exterior walls carry concept load-bearing intent.',
            confidence: 'medium',
          },
        ],
        primarySupportAssumptions: [
          'Perimeter walls and stair/core zone provide primary support placeholders.',
        ],
        supportElementPlaceholders: [
          {
            type: 'beam-lite',
            location: 'overhang edge',
            reason: 'Concept load transfer placeholder.',
          },
        ],
        openingCoordination: ['Stair and slab openings must align in plan.'],
        loadPathNotes: ['Trace roof and upper loads to perimeter walls/core before acceptance.'],
      },
      mepLiteRequirements: {
        wetRoomStacking: ['Keep wet rooms adjacent or stacked where the layout permits.'],
        verticalShaftsOrRisers: ['Reserve riser space near the stair/core zone.'],
        equipmentZones: ['Kitchen and wet-room equipment zones are schematic placeholders.'],
        routePlaceholders: ['Pipe/duct/cable routes must avoid stair and door clearances.'],
        serviceLevels: ['Ground service entry and upper distribution are placeholder assumptions.'],
        openingRequests: ['Track slab/wall penetrations needed by risers and drainage.'],
      },
      planningSiteRequirements: {
        orientationAssumption: 'Use sketch-up as project north until a survey is supplied.',
        basePointAssumption: 'Project base point at ground footprint origin, elevation 0.',
        surveyPointAssumption: 'Survey point unavailable; use local coordinates.',
        propertyLineSetbackAvailability: 'Property line and setback data unavailable.',
        sunAssumptions: 'Sun assumptions are placeholders until location and true north are known.',
        codeLocale: 'DE concept placeholders using DIN277/DIN276.',
      },
      schedules: [
        { id: 'room-schedule', name: 'Room Schedule', includes: ['rooms'] },
        {
          id: 'opening-schedule',
          name: 'Door and Window Schedule',
          includes: ['doors', 'windows'],
        },
      ],
      exportRequirements: {
        outputs: ['IFC', 'GLB', 'PDF', 'schedules', 'evidence-package', 'source-bundle'],
        ifcEntityIntentRequired: true,
      },
      sustainabilityMaterialPassportRequirements: {
        materials: [
          {
            materialKey: 'masonry_placeholder',
            epdSource: 'placeholder',
            sourceConfidence: 'low',
            embodiedCarbonPlaceholder: 'generic masonry carbon placeholder',
            reuseNotes: 'reuse not assessed',
            recyclabilityNotes: 'mineral recycling placeholder',
            quantitySource: 'wall layer quantity',
          },
          {
            materialKey: 'mineral_wool_placeholder',
            epdSource: 'placeholder',
            sourceConfidence: 'low',
            embodiedCarbonPlaceholder: 'generic insulation carbon placeholder',
            reuseNotes: 'reuse not assumed',
            recyclabilityNotes: 'manufacturer route to confirm',
            quantitySource: 'wall insulation quantity',
          },
          {
            materialKey: 'concrete_placeholder',
            epdSource: 'placeholder',
            sourceConfidence: 'low',
            embodiedCarbonPlaceholder: 'generic concrete carbon placeholder',
            reuseNotes: 'reuse unlikely',
            recyclabilityNotes: 'aggregate recycling placeholder',
            quantitySource: 'slab layer quantity',
          },
          {
            materialKey: 'screed_placeholder',
            epdSource: 'placeholder',
            sourceConfidence: 'low',
            embodiedCarbonPlaceholder: 'generic screed carbon placeholder',
            reuseNotes: 'reuse not assumed',
            recyclabilityNotes: 'mineral recycling placeholder',
            quantitySource: 'slab finish quantity',
          },
          {
            materialKey: 'timber_roof_placeholder',
            epdSource: 'placeholder',
            sourceConfidence: 'low',
            embodiedCarbonPlaceholder: 'generic timber carbon placeholder',
            reuseNotes: 'potential disassembly to review',
            recyclabilityNotes: 'end-of-life route placeholder',
            quantitySource: 'roof structural quantity',
          },
          {
            materialKey: 'roof_insulation_placeholder',
            epdSource: 'placeholder',
            sourceConfidence: 'low',
            embodiedCarbonPlaceholder: 'generic roof insulation carbon placeholder',
            reuseNotes: 'reuse not assumed',
            recyclabilityNotes: 'manufacturer route to confirm',
            quantitySource: 'roof insulation quantity',
          },
        ],
      },
      dataQualityChecks: [
        {
          id: 'bim-data-minimum',
          severity: 'error',
          checks: ['rooms', 'levels', 'types', 'classification'],
        },
      ],
    },
    features: [
      {
        id: 'roof_terrace',
        kind: 'roof_opening_with_occupied_terrace',
        visualPriority: 'critical',
        mustRenderInViews: ['main', 'roof'],
        capabilityNeeds: ['real roof void', 'guard rail', 'access door'],
      },
    ],
    requiredViews: [
      {
        id: 'main',
        kind: '3d',
        purpose: 'sketch match',
      },
      {
        id: 'roof',
        kind: '3d',
        purpose: 'prove roof cutout',
      },
      {
        id: 'plan',
        kind: 'diagnostic',
        purpose: 'prove room and stair topology',
      },
    ],
    assumptions: [
      {
        id: 'scale',
        statement: 'Scale estimated from image proportions.',
        confidence: 'medium',
        validation: 'compare screenshots',
      },
    ],
  };
}

function validMatrix() {
  return {
    schemaVersion: 'sketch-to-bim-capability-matrix.v0',
    capabilities: [
      {
        id: 'cap.roof_opening_occupied_terrace',
        title: 'Roof opening with occupied terrace',
        featureKinds: ['roof_opening_with_occupied_terrace'],
        status: 'supported',
        commandSurface: ['createRoofOpening'],
        rendererSurface: ['roof mesh subtraction'],
        advisorCoverage: ['opening host warnings'],
        knownFailureModes: ['metadata-only roof opening'],
        requiredEvidence: ['roof screenshot', 'advisor warning JSON'],
        fallback: 'Stop and file a renderer gap.',
      },
    ],
  };
}

test('initiation-check writes coverage and visual checklist for a valid IR', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-initiation-ok-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  await writeJson(irPath, validIr());
  await writeJson(matrixPath, validMatrix());

  const res = await runCli([
    'initiation-check',
    '--ir',
    irPath,
    '--capabilities',
    matrixPath,
    '--out',
    outDir,
  ]);

  assert.equal(res.code, 0, res.stderr);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.summary.errorCount, 0);

  const coverage = JSON.parse(
    await fs.readFile(path.join(outDir, 'capability-coverage.json'), 'utf8'),
  );
  assert.equal(coverage.features[0].readiness, 'ready');

  const checklist = JSON.parse(
    await fs.readFile(path.join(outDir, 'visual-checklist.json'), 'utf8'),
  );
  assert.ok(checklist.items.some((item) => item.id === 'roof:roof_terrace'));
  const bimDataQuality = JSON.parse(
    await fs.readFile(path.join(outDir, 'bim-data-quality.json'), 'utf8'),
  );
  assert.equal(bimDataQuality.ok, true);
  assert.equal(bimDataQuality.summary.errorCount, 0);
  assert.ok(bimDataQuality.checks.some((item) => item.id === 'room_requirements'));
  assert.ok(bimDataQuality.checks.some((item) => item.id === 'structure_lite_requirements'));
  assert.ok(bimDataQuality.checks.some((item) => item.id === 'mep_lite_requirements'));
  assert.ok(bimDataQuality.checks.some((item) => item.id === 'planning_site_requirements'));
  assert.ok(bimDataQuality.checks.some((item) => item.id === 'sustainability_material_passports'));

  const status = await fs.readFile(path.join(outDir, 'status.md'), 'utf8');
  assert.match(status, /Sketch-to-BIM Initiation Check/);
  assert.match(status, /BIM Data Quality/);
});

test('visual checklist requires semantic checks for sketch-critical features', () => {
  const ir = validIr();
  const coverage = buildCapabilityCoverage(ir, validMatrix());
  const checklist = buildVisualChecklist(ir, coverage);

  const roofItem = checklist.items.find((item) => item.id === 'roof:roof_terrace');
  assert.ok(roofItem);
  assert.ok(
    roofItem.semanticChecks.some((check) => check.id === 'roof_cutout_present'),
    'roof terrace checklist item should require semantic roof cutout confirmation',
  );
  assert.ok(
    checklist.items
      .find((item) => item.id === 'global:interior')
      .semanticChecks.some((check) => check.id === 'room_topology_present'),
    'global interior gate should require room topology confirmation',
  );
});

test('acceptance blocks missing or failed semantic visual checklist items', () => {
  const ir = validIr();
  const coverage = buildCapabilityCoverage(ir, validMatrix());
  const checklist = buildVisualChecklist(ir, coverage);
  checklist.items[0].semanticChecks = [];
  checklist.items[1].semanticChecks[0].status = 'fail';
  checklist.items[1].semanticChecks[0].notes = 'Roof cutout is not visible.';
  const screenshotManifest = {
    captures: ir.requiredViews.map((view) => ({
      viewId: view.id,
      viewKind: view.kind,
      screenshotPath: `/tmp/${view.id}.png`,
    })),
  };
  const visualGateReport = {
    summary: { failCount: 0, needsReviewCount: 0 },
    captures: screenshotManifest.captures.map((capture) => ({ ...capture, status: 'pass' })),
  };

  const acceptance = buildAcceptanceGateReport({
    ir,
    coverage,
    screenshotManifest,
    visualGateReport,
    visualChecklist: checklist,
  });

  assert.equal(acceptance.ok, false);
  const semanticBlocker = acceptance.blockers.find(
    (blocker) => blocker.code === 'semantic_visual_checklist_failures',
  );
  assert.ok(semanticBlocker);
  assert.equal(acceptance.summary.semanticVisualFailureCount > 0, true);
  assert.ok(semanticBlocker.failures.some((failure) => failure.status === 'missing'));
  assert.ok(semanticBlocker.failures.some((failure) => failure.status === 'fail'));
});

test('acceptance passes semantic visual checklist only when required checks have pass evidence', () => {
  const ir = validIr();
  const coverage = buildCapabilityCoverage(ir, validMatrix());
  const checklist = buildVisualChecklist(ir, coverage);
  for (const item of checklist.items) {
    for (const check of item.semanticChecks ?? []) {
      check.status = 'pass';
      check.notes = `Verified ${check.id}.`;
    }
  }
  const screenshotManifest = {
    captures: ir.requiredViews.map((view) => ({
      viewId: view.id,
      viewKind: view.kind,
      screenshotPath: `/tmp/${view.id}.png`,
    })),
  };
  const visualGateReport = {
    summary: { failCount: 0, needsReviewCount: 0 },
    captures: screenshotManifest.captures.map((capture) => ({ ...capture, status: 'pass' })),
  };

  const acceptance = buildAcceptanceGateReport({
    ir,
    coverage,
    screenshotManifest,
    visualGateReport,
    visualChecklist: checklist,
  });

  assert.equal(acceptance.ok, true);
  assert.equal(acceptance.summary.semanticVisualFailureCount, 0);
  assert.equal(acceptance.semanticVisual.summary.requiredCount > 0, true);
});

test('acceptance can resolve stale unchecked semantic visual rows from deterministic evidence', () => {
  const ir = validIr();
  const coverage = buildCapabilityCoverage(ir, validMatrix());
  const screenshotManifest = {
    captures: ir.requiredViews.map((view) => ({
      viewId: view.id,
      viewKind: view.kind,
      screenshotPath: `/tmp/${view.id}.png`,
    })),
  };
  const visualGateReport = {
    summary: { failCount: 0, needsReviewCount: 0 },
    captures: screenshotManifest.captures.map((capture) => ({ ...capture, status: 'pass' })),
  };

  const acceptance = buildAcceptanceGateReport({
    ir,
    coverage,
    screenshotManifest,
    visualGateReport,
    visualChecklist: { schemaVersion: 'sketch-to-bim-visual-checklist.v0', items: [] },
    evidenceRun: {
      targetHouseEvidenceAcceptance: {
        ok: true,
        visualRows: ir.requiredViews.map((view) => ({
          trackerRef: 'BIR-N05',
          viewId: view.id,
          kind: view.kind,
          status: 'pass',
          screenshot: { path: `/tmp/${view.id}.png`, valid: true },
        })),
        dataQualityRows: [{ trackerRef: 'BIR-N06', id: 'bim_data_quality_report', status: 'pass' }],
      },
      cleanPassGate: { ok: true },
      requiredFeatures: [
        {
          id: 'roof_terrace',
          phaseId: 'P3',
          requiredViewIds: ['main', 'roof'],
          requiredElementIds: ['roof-opening-1', 'roof-terrace-floor'],
          sourceRefs: ['spec/target-house/target-house-1-sketch-ir.draft.json#features'],
        },
      ],
    },
  });

  assert.equal(acceptance.ok, true);
  assert.equal(acceptance.summary.semanticVisualRequiredCount > 0, true);
  assert.equal(acceptance.summary.semanticVisualFailureCount, 0);
  assert.equal(acceptance.summary.semanticVisualGateBlockerCount, 0);
  assert.equal(
    acceptance.blockers.some((blocker) => blocker.code === 'semantic_visual_checklist_failures'),
    false,
  );
});

test('acceptance blocks renderer, BIM integrity, and visual drift evidence', () => {
  const ir = validIr();
  const coverage = buildCapabilityCoverage(ir, validMatrix());
  const checklist = buildVisualChecklist(ir, coverage);
  for (const item of checklist.items) {
    for (const check of item.semanticChecks ?? []) {
      check.status = 'pass';
      check.notes = `Verified ${check.id}.`;
    }
  }
  const screenshotManifest = {
    captures: ir.requiredViews.map((view) => ({
      viewId: view.id,
      viewKind: view.kind,
      screenshotPath: `/tmp/${view.id}.png`,
    })),
  };
  const visualGateReport = {
    summary: { failCount: 0, needsReviewCount: 0 },
    captures: screenshotManifest.captures.map((capture) => ({ ...capture, status: 'pass' })),
  };

  const acceptance = buildAcceptanceGateReport({
    ir,
    coverage,
    screenshotManifest,
    visualGateReport,
    visualChecklist: checklist,
    evidenceRun: {
      requiredFeatures: [
        {
          id: 'roof_terrace',
          requiredElementIds: ['roof-opening-1', 'door-1'],
        },
      ],
      rendererDiagnosticsEvidence: {
        diagnostics: [
          {
            ruleId: 'renderer_unsupported_cut',
            code: 'renderer.roof_opening.unsupported',
            severity: 'error',
            issueClass: 'renderer-unsupported',
            feature: 'roof-opening',
            elementIds: ['roof-opening-1'],
            message: 'Roof opening did not cut in viewport evidence.',
          },
        ],
      },
      bimIntegrityEvidence: {
        diagnostics: [
          {
            ruleId: 'hosted_opening_not_embedded',
            code: 'model.hosted_opening.not_embedded',
            severity: 'error',
            priority: 'P0',
            elementIds: ['door-1'],
            message: 'Door is not embedded in its host wall.',
          },
        ],
      },
      visualDriftRows: [
        {
          id: 'front-loggia-drift',
          category: 'terrace_loggia',
          status: 'drift',
          current: 'rail detached in latest screenshot',
          previous: 'rail aligned in source sketch',
        },
      ],
    },
  });

  const codes = new Set(acceptance.blockers.map((blocker) => blocker.code));
  assert.equal(acceptance.ok, false);
  assert.equal(codes.has('renderer_diagnostics_blocking'), true);
  assert.equal(codes.has('bim_integrity_diagnostics_blocking'), true);
  assert.equal(codes.has('semantic_visual_gate_failures'), true);
  assert.equal(acceptance.summary.rendererDiagnosticsBlockingCount, 1);
  assert.equal(acceptance.summary.bimIntegrityBlockingCount, 1);
  assert.equal(acceptance.summary.semanticVisualGateBlockerCount, 1);
});

test('project initiation IR requires BIM information requirements', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-initiation-bim-ir-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  const ir = validIr();
  delete ir.informationRequirements;
  await writeJson(irPath, ir);
  await writeJson(matrixPath, validMatrix());

  const res = await runCli([
    'initiation-check',
    '--ir',
    irPath,
    '--capabilities',
    matrixPath,
    '--out',
    outDir,
  ]);

  assert.equal(res.code, 2);
  const coverage = JSON.parse(
    await fs.readFile(path.join(outDir, 'capability-coverage.json'), 'utf8'),
  );
  assert.ok(coverage.issues.some((item) => item.code === 'bim_information_requirements_missing'));
  const acceptance = JSON.parse(
    await fs.readFile(path.join(outDir, 'acceptance-gates.json'), 'utf8'),
  );
  assert.equal(acceptance.summary.bimDataQualityErrorCount > 0, true);
});

test('initiation-check blocks a critical feature with no capability route', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-initiation-blocked-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  const ir = validIr();
  ir.features[0].kind = 'unsupported_magic_roof';
  await writeJson(irPath, ir);
  await writeJson(matrixPath, validMatrix());

  const res = await runCli([
    'initiate-check',
    '--ir',
    irPath,
    '--capabilities',
    matrixPath,
    '--out',
    outDir,
  ]);

  assert.equal(res.code, 2);
  const coverage = JSON.parse(
    await fs.readFile(path.join(outDir, 'capability-coverage.json'), 'utf8'),
  );
  assert.equal(coverage.summary.errorCount, 1);
  assert.equal(coverage.features[0].readiness, 'blocked');
  assert.equal(coverage.issues[0].code, 'capability_missing');
  const gaps = JSON.parse(await fs.readFile(path.join(outDir, 'capability-gaps.json'), 'utf8'));
  assert.equal(gaps.taskCount, 1);
  assert.equal(gaps.tasks[0].featureKind, 'unsupported_magic_roof');
});

test('initiation-run captures live advisor and evidence artifacts without screenshots', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-initiation-run-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  await writeJson(irPath, validIr());
  await writeJson(matrixPath, validMatrix());
  const snapshotBody = {
    modelId: 'model-1',
    revision: 7,
    elements: {
      'vp-main': { kind: 'viewpoint', id: 'main' },
      'lvl-ground': { kind: 'level', id: 'lvl-ground', name: 'Ground', elevationMm: 0 },
      'room-living': { kind: 'room', id: 'room-living', name: 'Living', levelId: 'lvl-ground' },
      'wt-ext': { kind: 'wall_type', id: 'wt-ext', name: 'Exterior wall' },
      'ft-slab': { kind: 'floor_type', id: 'ft-slab', name: 'Slab' },
      'rt-roof': { kind: 'roof_type', id: 'rt-roof', name: 'Roof' },
      'wall-1': { kind: 'wall', id: 'wall-1' },
      'floor-1': { kind: 'floor', id: 'floor-1' },
      'roof-1': { kind: 'roof', id: 'roof-1' },
      'stair-1': { kind: 'stair', id: 'stair-1' },
      'door-1': { kind: 'door', id: 'door-1' },
      'window-1': { kind: 'window', id: 'window-1' },
      'rail-1': { kind: 'railing', id: 'rail-1' },
      'chair-1': { kind: 'furniture', id: 'chair-1' },
    },
    violations: [],
  };
  const { server, base } = await startStubServer((req) => {
    if (req.url?.endsWith('/snapshot')) return { body: snapshotBody };
    if (req.url?.endsWith('/validate')) {
      return {
        body: {
          modelId: 'model-1',
          revision: 7,
          violations: [],
          checks: { errorViolationCount: 0, blockingViolationCount: 0 },
        },
      };
    }
    if (req.url?.endsWith('/evidence-package')) {
      return {
        body: {
          format: 'evidencePackage_v1',
          modelId: 'model-1',
          revision: 7,
          elementCount: 2,
        },
      };
    }
    return { status: 404, body: { error: req.url } };
  });

  const res = await runCli(
    [
      'initiation-run',
      '--ir',
      irPath,
      '--capabilities',
      matrixPath,
      '--model',
      'model-1',
      '--out',
      outDir,
      '--no-screenshots',
    ],
    { BIM_AI_BASE_URL: base },
  );
  server.close();

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.liveArtifacts.snapshot.endsWith('live/snapshot.json'), true);

  const warning = JSON.parse(
    await fs.readFile(path.join(outDir, 'live', 'advisor-warning.json'), 'utf8'),
  );
  assert.equal(warning.total, 0);
  const stats = JSON.parse(
    await fs.readFile(path.join(outDir, 'live', 'model-stats.json'), 'utf8'),
  );
  assert.equal(stats.countsByKind.wall, 1);
  const toolRun = JSON.parse(await fs.readFile(path.join(outDir, 'tool-run-summary.json'), 'utf8'));
  assert.equal(toolRun.schemaVersion, 'sketch-to-bim.tool-run.v1');
  assert.equal(toolRun.modelRevision, 7);
  assert.equal(toolRun.gitHead, currentGitHead());
  assert.equal(toolRun.irSha256, await sha256File(irPath));
  assert.equal(toolRun.capabilitiesSha256, await sha256File(matrixPath));
  assert.equal(typeof toolRun.advisorRuleDigest, 'string');
  const freshness = JSON.parse(
    await fs.readFile(path.join(outDir, 'evidence-freshness.json'), 'utf8'),
  );
  assert.equal(freshness.ok, true);
  assert.equal(freshness.summary.passCount, 5);
  const acceptance = JSON.parse(
    await fs.readFile(path.join(outDir, 'acceptance-gates.json'), 'utf8'),
  );
  assert.equal(acceptance.summary.evidenceFreshnessOk, true);
  const status = await fs.readFile(path.join(outDir, 'status.md'), 'utf8');
  assert.match(status, /Live Artifacts/);
  assert.match(status, /advisorWarning/);
  assert.match(status, /Evidence Freshness/);
});

test('sketch evidence collect writes non-browser evidence manifest and visual contract', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-evidence-collect-'));
  const irPath = path.join(dir, 'ir.json');
  const outDir = path.join(dir, 'evidence');
  await writeJson(irPath, validIr());
  const snapshotBody = {
    modelId: 'model-1',
    revision: 11,
    elements: {
      main: { kind: 'viewpoint', id: 'main' },
      'wall-1': { kind: 'wall', id: 'wall-1' },
      'room-1': { kind: 'room', id: 'room-1' },
      'floor-1': { kind: 'floor', id: 'floor-1' },
      'roof-1': { kind: 'roof', id: 'roof-1' },
      'stair-1': { kind: 'stair', id: 'stair-1' },
      'door-1': { kind: 'door', id: 'door-1' },
      'window-1': { kind: 'window', id: 'window-1' },
      'rail-1': { kind: 'railing', id: 'rail-1' },
      'chair-1': { kind: 'furniture', id: 'chair-1' },
      'wt-ext': { kind: 'wall_type', id: 'wt-ext' },
      'ft-slab': { kind: 'floor_type', id: 'ft-slab' },
      'rt-roof': { kind: 'roof_type', id: 'rt-roof' },
    },
    violations: [
      {
        severity: 'warning',
        advisoryClass: 'room_not_enclosed',
        elementIds: ['room-1'],
        message: 'Room is not fully enclosed.',
      },
      {
        severity: 'info',
        advisoryClass: 'material_placeholder',
        elementIds: ['wall-1'],
        message: 'Material intent is a placeholder.',
      },
    ],
  };
  const { server, base } = await startStubServer((req) => {
    if (req.url?.endsWith('/snapshot')) return { body: snapshotBody };
    if (req.url?.endsWith('/validate')) {
      return { body: { modelId: 'model-1', revision: 11, violations: snapshotBody.violations } };
    }
    if (req.url?.endsWith('/evidence-package')) {
      return { body: { format: 'evidencePackage_v1', modelId: 'model-1', revision: 11 } };
    }
    if (req.url?.startsWith('/api/models/model-1/constructability-report')) {
      return {
        body: {
          profile: 'project_initiation',
          summary: { severityCounts: { warning: 1, info: 0, error: 0 } },
          findings: [
            {
              severity: 'warning',
              code: 'stair_clearance_review',
              elementIds: ['room-1'],
              message: 'Review clearance around stair zone.',
            },
          ],
        },
      };
    }
    if (req.url?.endsWith('/exports/ifc-manifest')) {
      return {
        body: {
          format: 'ifc_manifest_v0',
          exportedIfcKindsInArtifact: {
            IfcSpace: 1,
            IfcWall: 1,
            IfcSlab: 1,
            IfcRoof: 1,
            IfcStair: 1,
            IfcDoor: 1,
            IfcWindow: 1,
            IfcRailing: 1,
            IfcFurnishingElement: 1,
          },
        },
      };
    }
    if (req.url?.endsWith('/exports/gltf-manifest')) {
      return {
        body: {
          format: 'gltf_manifest_v0',
          extensions: { BIM_AI_exportManifest_v0: { countsByKind: { wall: 1, room: 1 } } },
        },
      };
    }
    return { status: 404, body: { error: req.url } };
  });

  const res = await runCli(
    [
      'sketch',
      'evidence',
      'collect',
      '--model',
      'model-1',
      '--ir',
      irPath,
      '--out',
      outDir,
      '--phase',
      'shell',
      '--profile',
      'project_initiation',
    ],
    { BIM_AI_BASE_URL: base },
  );
  server.close();

  assert.equal(res.code, 0, res.stderr);
  const manifest = JSON.parse(res.stdout);
  assert.equal(manifest.schemaVersion, 'sketch.evidence.collection.v1');
  assert.equal(manifest.browserAutomationRequired, false);
  assert.equal(manifest.currentHead.gitHead, currentGitHead());
  assert.equal(manifest.currentHead.modelRevision, 11);
  assert.equal(manifest.currentHead.irSha256, await sha256File(irPath));
  assert.equal(typeof manifest.currentHead.advisorRuleDigest, 'string');
  assert.equal(manifest.summary.advisor.warning, 1);
  assert.equal(manifest.summary.advisor.info, 1);
  assert.equal(manifest.summary.constructability.profile, 'project_initiation');
  assert.equal(manifest.summary.unclassifiedBlockingFindingCount, 2);
  assert.equal(manifest.summary.toleranceLedger.blockingFindingCount, 2);
  assert.equal(manifest.summary.exchangeValidation.errorCount, 0);

  const visualContract = JSON.parse(
    await fs.readFile(path.join(outDir, 'visual-evidence-contract.json'), 'utf8'),
  );
  assert.equal(visualContract.browserAutomationRequired, false);
  assert.equal(visualContract.inputs.requiredViews.length, 3);
  assert.equal(visualContract.inputs.requiredViews[0].savedViewpointPresent, true);

  const dispositions = JSON.parse(
    await fs.readFile(path.join(outDir, 'finding-dispositions.json'), 'utf8'),
  );
  assert.equal(dispositions.schemaVersion, 'sketch.finding-dispositions.v1');
  assert.equal(dispositions.findings.filter((finding) => finding.severity === 'warning').length, 2);
  const toleranceLedger = JSON.parse(
    await fs.readFile(path.join(outDir, 'tolerance-ledger.json'), 'utf8'),
  );
  assert.equal(toleranceLedger.schemaVersion, 'sketch.tolerance-ledger.v1');
  assert.equal(toleranceLedger.ok, false);
  const exportValidation = JSON.parse(
    await fs.readFile(path.join(outDir, 'export-validation.json'), 'utf8'),
  );
  assert.equal(exportValidation.schemaVersion, 'sketch.exchange-validation.v1');
  assert.equal(exportValidation.ok, true);
});

test('initiation-compare scores identical PNGs as passing', async () => {
  const fixture = path.resolve(
    __dirname,
    '../web/e2e/__screenshots__/ui-redesign-baselines.spec.ts/darwin/top-bar.png',
  );
  const res = await runCli([
    'initiation-compare',
    '--actual',
    fixture,
    '--target',
    fixture,
    '--threshold',
    '0.99',
  ]);

  assert.equal(res.code, 0, res.stderr);
  const report = JSON.parse(res.stdout);
  assert.equal(report.thresholdPassed, true);
  assert.ok(report.visualSimilarity >= 0.999);
});

test('seed-dsl compile writes a deterministic command bundle', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-seed-dsl-'));
  const outPath = path.join(dir, 'bundle.json');
  const recipePath = path.resolve(
    __dirname,
    '../../spec/examples/seed-dsl-modern-house.example.json',
  );

  const res = await runCli(['seed-dsl', 'compile', '--recipe', recipePath, '--out', outPath]);

  assert.equal(res.code, 0, res.stderr);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.ok, true);
  const bundle = JSON.parse(await fs.readFile(outPath, 'utf8'));
  assert.equal(bundle.schemaVersion, 'cmd-v3.0');
  assert.ok(bundle.commands.some((command) => command.type === 'createRoofOpening'));
  assert.ok(bundle.commands.some((command) => command.type === 'saveViewpoint'));
  assert.ok(bundle.commands.some((command) => command.type === 'IndexAsset'));
  assert.ok(bundle.commands.some((command) => command.type === 'PlaceAsset'));
  assert.ok(bundle.commands.some((command) => command.type === 'createRailing'));
  assert.ok(bundle.commands.some((command) => command.id === 'upper-terrace-loggia-floor'));
  assert.ok(bundle.commands.some((command) => command.id === 'roof-terrace-floor'));
  assert.ok(bundle.commands.some((command) => command.type === 'createRoomPoly'));
  assert.ok(bundle.commands.some((command) => command.type === 'createStair'));
  assert.ok(bundle.commands.some((command) => command.type === 'createSlabOpening'));
  assert.ok(bundle.commands.some((command) => command.type === 'insertDoorOnWall'));
  assert.ok(bundle.commands.some((command) => command.type === 'createWallOpening'));
  assert.ok(bundle.commands.some((command) => command.type === 'attachWallTopToRoof'));
  assert.ok(bundle.commands.some((command) => command.type === 'createSweep'));
  assert.ok(
    bundle.commands.some(
      (command) =>
        command.type === 'saveViewpoint' &&
        command.evidenceRole === 'roof_terrace_cutout' &&
        command.featureIds.includes('roof-terrace'),
    ),
  );
  assert.ok(
    bundle.commands.some(
      (command) =>
        command.type === 'updateElementProperty' &&
        command.key === 'materialKey' &&
        command.elementId === 'ground-base-floor',
    ),
  );
  assert.ok(Array.isArray(bundle.meta.materialIntent));
});

test('sketch ir validate aliases initiation-check packet creation', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-sketch-ir-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  await writeJson(irPath, validIr());
  await writeJson(matrixPath, validMatrix());

  const res = await runCli([
    'sketch',
    'ir',
    'validate',
    '--ir',
    irPath,
    '--capabilities',
    matrixPath,
    '--out',
    outDir,
  ]);

  assert.equal(res.code, 0, res.stderr);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.ok, true);
  const acceptance = JSON.parse(
    await fs.readFile(path.join(outDir, 'acceptance-gates.json'), 'utf8'),
  );
  assert.equal(acceptance.schemaVersion, 'sketch-to-bim-acceptance-gates.v0');
});

test('sketch seed compile aliases seed-dsl compile', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-sketch-seed-'));
  const outPath = path.join(dir, 'bundle.json');
  const recipePath = path.resolve(
    __dirname,
    '../../spec/examples/seed-dsl-modern-house.example.json',
  );

  const res = await runCli(['sketch', 'seed', 'compile', '--recipe', recipePath, '--out', outPath]);

  assert.equal(res.code, 0, res.stderr);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.ok, true);
  const bundle = JSON.parse(await fs.readFile(outPath, 'utf8'));
  assert.equal(bundle.schemaVersion, 'cmd-v3.0');
});

test('sketch phase apply submits bundle through transaction route', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-sketch-phase-'));
  const bundlePath = path.join(dir, 'bundle.json');
  const outPath = path.join(dir, 'apply-result.json');
  await writeJson(bundlePath, {
    schemaVersion: 'cmd-v3.0',
    commands: [{ type: 'createLevel', id: 'lvl-0', name: 'Ground', elevationMm: 0 }],
    assumptions: [],
  });
  const requests = [];
  const { server, base } = await startStubServer((req, body) => {
    requests.push({ url: req.url, body });
    return { body: { ok: true, revision: 8 } };
  });

  const res = await runCli(
    [
      'sketch',
      'phase',
      'apply',
      '--model',
      'model-1',
      '--bundle',
      bundlePath,
      '--base',
      '7',
      '--dry-run',
      '--phase',
      'seed-shell',
      '--features',
      'roof_terrace,wrapper',
      '--out',
      outPath,
    ],
    { BIM_AI_BASE_URL: base, BIM_AI_USER_ID: 'agent-1' },
  );
  server.close();

  assert.equal(res.code, 0, res.stderr);
  assert.equal(requests[0].url, '/api/models/model-1/bundles');
  assert.equal(requests[0].body.mode, 'dry_run');
  assert.equal(requests[0].body.bundle.parentRevision, 7);
  const payload = JSON.parse(await fs.readFile(outPath, 'utf8'));
  assert.deepEqual(payload.featureIds, ['roof_terrace', 'wrapper']);
});

test('sketch phase run defaults to dry-run and writes evidence plus acceptance packet', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-sketch-phase-run-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const bundlePath = path.join(dir, 'bundle.json');
  const outDir = path.join(dir, 'phase-loop');
  await writeJson(irPath, validIr());
  await writeJson(matrixPath, validMatrix());
  await writeJson(bundlePath, {
    schemaVersion: 'cmd-v3.0',
    commands: [{ type: 'createLevel', id: 'lvl-0', name: 'Ground', elevationMm: 0 }],
    assumptions: [],
  });
  const requests = [];
  const snapshotBody = {
    modelId: 'model-1',
    revision: 7,
    elements: {},
    violations: [],
  };
  const { server, base } = await startStubServer((req, body) => {
    requests.push({ url: req.url, body });
    if (req.url === '/api/models/model-1/bundles') {
      return { body: { ok: true, revision: 7, dryRun: true } };
    }
    if (req.url === '/api/models/model-1/snapshot') return { body: snapshotBody };
    if (req.url === '/api/models/model-1/validate') {
      return { body: { ok: true, violations: [], summary: { error: 0, warning: 0 } } };
    }
    if (req.url === '/api/models/model-1/evidence-package') {
      return { body: { ok: true, checklist: [], manifests: [] } };
    }
    if (req.url?.startsWith('/api/models/model-1/constructability-report')) {
      return { body: { ok: true, profile: 'construction_readiness', findings: [] } };
    }
    if (req.url === '/api/models/model-1/exports/gltf-manifest') {
      return { body: { ok: true, countsByKind: {} } };
    }
    if (req.url === '/api/models/model-1/exports/ifc-manifest') {
      return { body: { ok: true, countsByIfcEntity: {} } };
    }
    return { status: 404, body: { error: req.url } };
  });

  const res = await runCli(
    [
      'sketch',
      'phase',
      'run',
      '--model',
      'model-1',
      '--ir',
      irPath,
      '--capabilities',
      matrixPath,
      '--phase',
      'shell',
      '--bundle',
      bundlePath,
      '--base',
      '7',
      '--out',
      outDir,
      '--features',
      'wrapper,roof_terrace',
    ],
    { BIM_AI_BASE_URL: base, BIM_AI_USER_ID: 'agent-1' },
  );
  server.close();

  assert.equal(res.code, 0, res.stderr);
  const bundleRequest = requests.find((request) => request.url === '/api/models/model-1/bundles');
  assert.equal(bundleRequest.body.mode, 'dry_run');
  assert.equal(bundleRequest.body.bundle.parentRevision, 7);
  const payload = JSON.parse(res.stdout);
  assert.equal(payload.schemaVersion, 'sketch.phase.run.result.v0');
  assert.equal(payload.applyMode, 'dry_run');
  assert.deepEqual(payload.featureIds, ['wrapper', 'roof_terrace']);
  assert.equal(payload.apply.transaction.mode, 'dry_run');
  assert.equal(payload.evidence.schemaVersion, 'sketch.evidence.collection.v1');
  assert.equal(payload.acceptance.schemaVersion, 'sketch.phase.accept.cli-result.v0');
  await fs.access(path.join(outDir, 'phase-dry-run.json'));
  await fs.access(path.join(outDir, 'evidence', 'evidence-manifest.json'));
  await fs.access(path.join(outDir, 'evidence', 'tool-run-summary.json'));
  await fs.access(path.join(outDir, 'acceptance', 'acceptance-gates.json'));
  await fs.access(path.join(outDir, 'phase-run.json'));
});

test('sketch phase accept records warning info and error dispositions', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-sketch-phase-accept-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  const evidenceDir = path.join(dir, 'evidence');
  await writeJson(irPath, validIr());
  await writeJson(matrixPath, validMatrix());
  await fs.mkdir(evidenceDir, { recursive: true });
  await writeJson(path.join(evidenceDir, 'finding-dispositions.json'), {
    schemaVersion: 'sketch.finding-dispositions.v1',
    modelId: 'model-1',
    revision: 9,
    phaseId: 'shell',
    findings: [
      {
        source: 'advisor',
        severity: 'warning',
        code: 'room_not_enclosed',
        disposition: 'later-phase',
        affectedFeatureIds: ['room_programme'],
        phaseRationale: 'Rooms are accepted in the room programme phase.',
        owner: 'architecture-agent',
        expiryCondition: 'Before room programme phase acceptance.',
        evidenceLinks: ['evidence/advisor-warning.json'],
        elementIds: ['room-1'],
      },
      {
        source: 'advisor',
        severity: 'info',
        code: 'material_placeholder',
        disposition: 'reviewed',
        elementIds: ['wall-1'],
      },
      {
        source: 'advisor',
        severity: 'error',
        code: 'stale_host',
        disposition: 'fixed',
        elementIds: ['opening-1'],
      },
    ],
  });

  const res = await runCli([
    'sketch',
    'phase',
    'accept',
    '--ir',
    irPath,
    '--capabilities',
    matrixPath,
    '--out',
    outDir,
    '--phase',
    'shell',
    '--evidence-dir',
    evidenceDir,
  ]);

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.findingDispositions.findingCount, 3);
  assert.equal(out.findingDispositions.countsBySeverity.warning, 1);
  assert.equal(out.findingDispositions.countsBySeverity.info, 1);
  assert.equal(out.findingDispositions.countsBySeverity.error, 1);
  const summary = JSON.parse(
    await fs.readFile(path.join(outDir, 'phase-finding-dispositions.json'), 'utf8'),
  );
  assert.equal(summary.countsByDisposition['later-phase'], 1);
  assert.equal(summary.countsByDisposition.reviewed, 1);
  assert.equal(summary.countsByDisposition.fixed, 1);
  const toleranceLedger = JSON.parse(
    await fs.readFile(path.join(outDir, 'phase-tolerance-ledger.json'), 'utf8'),
  );
  assert.equal(toleranceLedger.ok, true);
  assert.equal(toleranceLedger.tolerances[0].affectedFeatureIds[0], 'room_programme');
});

test('sketch phase accept fails acceptance for stale current-head evidence', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-sketch-phase-stale-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  const evidenceDir = path.join(dir, 'evidence');
  await writeJson(irPath, validIr());
  await writeJson(matrixPath, validMatrix());
  await fs.mkdir(evidenceDir, { recursive: true });
  await writeJson(path.join(evidenceDir, 'finding-dispositions.json'), {
    schemaVersion: 'sketch.finding-dispositions.v1',
    modelId: 'model-1',
    revision: 8,
    phaseId: 'shell',
    findings: [],
  });
  await writeJson(path.join(evidenceDir, 'tool-run-summary.json'), {
    schemaVersion: 'sketch-to-bim.tool-run.v1',
    modelId: 'model-1',
    modelRevision: 8,
    gitHead: 'stale-git-head',
    irPath,
    irSha256: 'stale-ir-hash',
    capabilitiesPath: matrixPath,
    capabilitiesSha256: 'stale-capability-hash',
    advisorRuleDigest: 'stale-advisor-digest',
    advisorRuleFiles: [],
  });

  const { server, base } = await startStubServer((req) => {
    if (req.url?.endsWith('/snapshot')) {
      return { body: { modelId: 'model-1', revision: 9, elements: {}, violations: [] } };
    }
    return { status: 404, body: { error: req.url } };
  });

  const res = await runCli(
    [
      'sketch',
      'phase',
      'accept',
      '--ir',
      irPath,
      '--capabilities',
      matrixPath,
      '--out',
      outDir,
      '--phase',
      'shell',
      '--model',
      'model-1',
      '--evidence-dir',
      evidenceDir,
      '--fail-on-acceptance',
    ],
    { BIM_AI_BASE_URL: base },
  );
  server.close();

  assert.equal(res.code, 5, res.stderr);
  const out = JSON.parse(res.stdout);
  const codes = new Set(out.acceptance.blockers.map((blocker) => blocker.code));
  assert.equal(codes.has('stale_git_head'), true);
  assert.equal(codes.has('stale_model_revision'), true);
  assert.equal(codes.has('stale_advisor_rule_digest'), true);
  assert.equal(codes.has('stale_ir_sha256'), true);
  assert.equal(codes.has('stale_capabilities_sha256'), true);
  const freshness = JSON.parse(
    await fs.readFile(path.join(outDir, 'evidence-freshness.json'), 'utf8'),
  );
  assert.equal(freshness.ok, false);
  assert.equal(freshness.summary.staleCount, 5);
});

test('seed-dsl compile emits toposolids, subdivisions, and graded regions in host order', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-seed-dsl-site-'));
  const recipePath = path.join(dir, 'recipe.json');
  const outPath = path.join(dir, 'bundle.json');
  await writeJson(recipePath, {
    schemaVersion: 'seed-dsl.v0',
    id: 'site-seed',
    levels: [{ id: 'eg', name: 'Erdgeschoss', elevationMm: 0 }],
    toposolids: [
      {
        id: 'site-existing',
        name: 'Existing sloped site',
        boundaryMm: [
          { xMm: -5000, yMm: -5000 },
          { xMm: 5000, yMm: -5000 },
          { xMm: 5000, yMm: 5000 },
          { xMm: -5000, yMm: 5000 },
        ],
        heightSamples: [
          { xMm: -5000, yMm: -5000, zMm: -600 },
          { xMm: 5000, yMm: -5000, zMm: -300 },
          { xMm: 5000, yMm: 5000, zMm: 400 },
          { xMm: -5000, yMm: 5000, zMm: 100 },
        ],
        thicknessMm: 1800,
        baseElevationMm: -2200,
        defaultMaterialKey: 'site_grass',
        subdivisions: [
          {
            id: 'entry-paving',
            boundaryMm: [
              { xMm: -1200, yMm: -5000 },
              { xMm: 1200, yMm: -5000 },
              { xMm: 1200, yMm: -2600 },
              { xMm: -1200, yMm: -2600 },
            ],
            finishCategory: 'paving',
            materialKey: 'paving_concrete',
          },
        ],
      },
    ],
    gradedRegions: [
      {
        id: 'building-platform',
        hostToposolidId: 'site-existing',
        boundaryMm: [
          { xMm: -2600, yMm: -2200 },
          { xMm: 2600, yMm: -2200 },
          { xMm: 2600, yMm: 2200 },
          { xMm: -2600, yMm: 2200 },
        ],
        targetMode: 'slope',
        slopeAxisDeg: 90,
        slopeDegPercent: 4,
      },
    ],
    volumes: [
      {
        id: 'site-house',
        levelId: 'eg',
        createWalls: false,
        footprintMm: [
          { xMm: -1200, yMm: -1200 },
          { xMm: 1200, yMm: -1200 },
          { xMm: 1200, yMm: 1200 },
          { xMm: -1200, yMm: 1200 },
        ],
      },
    ],
    toposolidExcavations: [
      {
        id: 'site-house-excavation',
        hostToposolidId: 'site-existing',
        cutterElementId: 'site-house-floor',
        cutMode: 'to_bottom_of_cutter',
        offsetMm: 100,
      },
    ],
    commands: [{ type: 'saveViewpoint', id: 'raw-after-site', name: 'Raw after site' }],
  });

  const res = await runCli(['seed-dsl', 'compile', '--recipe', recipePath, '--out', outPath]);

  assert.equal(res.code, 0, res.stderr);
  const bundle = JSON.parse(await fs.readFile(outPath, 'utf8'));
  const commands = bundle.commands;
  const topIndex = commands.findIndex((command) => command.type === 'CreateToposolid');
  const subdivisionIndex = commands.findIndex(
    (command) => command.type === 'create_toposolid_subdivision',
  );
  const gradedIndex = commands.findIndex((command) => command.type === 'CreateGradedRegion');
  const floorIndex = commands.findIndex((command) => command.id === 'site-house-floor');
  const excavationIndex = commands.findIndex(
    (command) => command.type === 'CreateToposolidExcavation',
  );
  const rawIndex = commands.findIndex((command) => command.id === 'raw-after-site');
  assert.ok(topIndex > -1);
  assert.ok(subdivisionIndex > topIndex);
  assert.ok(gradedIndex > topIndex);
  assert.ok(floorIndex > gradedIndex);
  assert.ok(excavationIndex > floorIndex);
  assert.ok(rawIndex > excavationIndex);
  assert.deepEqual(commands[topIndex].heightSamples[0], {
    xMm: -5000,
    yMm: -5000,
    zMm: -600,
  });
  assert.equal(commands[subdivisionIndex].hostToposolidId, 'site-existing');
  assert.equal(commands[gradedIndex].targetMode, 'slope');
  assert.equal(commands[gradedIndex].slopeDegPercent, 4);
  assert.equal(commands[excavationIndex].hostToposolidId, 'site-existing');
  assert.equal(commands[excavationIndex].cutterElementId, 'site-house-floor');
});

test('seed-dsl compile rejects invalid site grading definitions', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-seed-dsl-site-invalid-'));
  const recipePath = path.join(dir, 'recipe.json');
  const outPath = path.join(dir, 'bundle.json');
  await writeJson(recipePath, {
    schemaVersion: 'seed-dsl.v0',
    toposolids: [
      {
        id: 'site-existing',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 1000, yMm: 0 },
          { xMm: 0, yMm: 1000 },
        ],
        heightSamples: [{ xMm: 0, yMm: 0, zMm: 0 }],
        heightmapGridMm: { stepMm: 1000, rows: 1, cols: 1, values: [0] },
      },
    ],
    gradedRegions: [
      {
        id: 'bad-flat-platform',
        hostToposolidId: 'site-existing',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 500, yMm: 0 },
          { xMm: 0, yMm: 500 },
        ],
        targetMode: 'flat',
      },
    ],
  });

  const res = await runCli(['seed-dsl', 'compile', '--recipe', recipePath, '--out', outPath]);

  assert.equal(res.code, 1);
  assert.match(res.stderr, /must not define both heightSamples and heightmapGridMm/);
});

test('initiation-golden runs the preflight golden suite', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-golden-'));
  const manifestPath = path.resolve(__dirname, '../../spec/sketch-to-bim-golden-seeds.json');

  const res = await runCli(['initiation-golden', '--manifest', manifestPath, '--out', dir]);

  assert.equal(res.code, 0, res.stderr);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.caseCount, 3);
  assert.equal(summary.failCount, 0);
  assert.equal(summary.liveGoldenPlanCount, 3);
  const written = JSON.parse(await fs.readFile(path.join(dir, 'golden-summary.json'), 'utf8'));
  assert.equal(written.passCount, 3);
  const plan = JSON.parse(
    await fs.readFile(
      path.join(dir, 'target-house-project-initiation', 'live-golden-plan.json'),
      'utf8',
    ),
  );
  assert.equal(plan.schemaVersion, 'sketch-to-bim-live-golden-plan.v1');
  assert.equal(plan.noSeedArtifactCreated, true);
  assert.ok(plan.requiredArtifacts.includes('export-validation.json'));
  assert.equal(plan.acceptance.requireToleranceLedger, true);
});
