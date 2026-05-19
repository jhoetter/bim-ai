import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const TARGET_HOUSE_ACCEPTANCE_SCHEMA_VERSION =
  'target-house-acceptance-required-features.v1';

export const DEFAULT_TARGET_HOUSE_ACCEPTANCE_SOURCES = {
  checklist: 'spec/target-house/target-house-1-acceptance-checklist.md',
  sketchIr: 'spec/target-house/target-house-1-sketch-ir.draft.json',
  bimRequirements: 'spec/target-house/target-house-1-bim-information-requirements.md',
  phasePlan: 'spec/target-house/target-house-1-phase-plan.md',
};

const VIEW_ALIASES = {
  main_front_left: ['main', 'front-left', 'front_left', 'main-front-left'],
  roof_high: ['roof-high', 'roof high', 'roof-court', 'roof_court', 'roof court'],
  front_elevation: ['front', 'front-elevation', 'front elevation'],
  front_loggia: ['loggia', 'front-loggia', 'front loggia', 'loggia detail'],
  rear_right_axon: ['rear/right', 'rear-right', 'rear right', 'rear_right'],
  ground_floor_plan: ['ground plan', 'ground-plan', 'ground_floor', 'ground floor plan'],
  first_floor_plan: [
    'first-floor plan',
    'first floor plan',
    'upper-plan',
    'upper plan',
    'first_floor',
  ],
  wire_diagnostic: ['wire diagnostic', 'wire diagnostics', 'wire', 'diagnostic'],
};

const CHECKLIST_VIEW_PHRASES = {
  main: 'main_front_left',
  'roof-high': 'roof_high',
  'roof high': 'roof_high',
  'roof-court': 'roof_high',
  'roof court': 'roof_high',
  front: 'front_elevation',
  loggia: 'front_loggia',
  'front-loggia': 'front_loggia',
  'front loggia': 'front_loggia',
  'loggia detail': 'front_loggia',
  'rear/right': 'rear_right_axon',
  'rear-right': 'rear_right_axon',
  'rear right': 'rear_right_axon',
  'ground plan': 'ground_floor_plan',
  'ground-plan': 'ground_floor_plan',
  'first-floor plan': 'first_floor_plan',
  'first floor plan': 'first_floor_plan',
  'upper-plan': 'first_floor_plan',
  'upper plan': 'first_floor_plan',
  'wire diagnostic': 'wire_diagnostic',
  'wire diagnostics': 'wire_diagnostic',
};

const FEATURE_CATEGORY_SELECTORS = {
  primary_massing_envelope: ['wall:exterior', 'floor:plinth', 'volume:upper-wrapper'],
  folded_white_wrapper_shell: ['wall:upper-white-shell', 'roof:white-folded-shell'],
  roof_terrace_cutout: [
    'roof:opening',
    'floor:terrace',
    'railing:roof-court-guard',
    'door:terrace-access',
    'window:roof-court-glazing',
    'room:room_l1_roof_court',
  ],
  front_deep_loggia: [
    'room:room_l1_deep_loggia',
    'floor:loggia-slab',
    'railing:front-loggia-guard',
    'window:three-bay-loggia-glazing',
    'door:loggia-access',
  ],
  asymmetric_gable_envelope: ['wall:gable-profile', 'roof:asymmetric-envelope'],
  vertical_cladding_zones: ['wall:ground-clad-base', 'cladding:vertical-board-batten'],
  opening_and_glazing_rhythm: ['door:*', 'window:*', 'opening:hosted-facade-bay'],
  room_access_and_enclosure: ['room:*', 'door:room-access', 'stair:*', 'opening:slab-stair'],
  site_orientation_and_plinth: ['site:project-north-assumption', 'floor:plinth'],
  documentation_evidence_set: ['view:*', 'schedule:*', 'export:*', 'evidence:*'],
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256(text) {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

function asString(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim();
}

function uniqueInOrder(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const trimmed = asString(value);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function titleFromId(id) {
  return id
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeSourcePath(rootDir, sourcePath) {
  return path.relative(rootDir, path.resolve(rootDir, sourcePath)).split(path.sep).join('/');
}

function sortBySourceOrder(values, sourceOrder) {
  const index = new Map(sourceOrder.map((value, order) => [value, order]));
  return uniqueInOrder(values).sort((left, right) => {
    const leftIndex = index.has(left) ? index.get(left) : Number.MAX_SAFE_INTEGER;
    const rightIndex = index.has(right) ? index.get(right) : Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.localeCompare(right);
  });
}

async function readSource(rootDir, sourcePath) {
  const absolutePath = path.resolve(rootDir, sourcePath);
  const text = await fs.readFile(absolutePath, 'utf8');
  return {
    path: normalizeSourcePath(rootDir, absolutePath),
    text,
    sha256: sha256(text),
  };
}

function parseSketchIr(source) {
  let sketchIr;
  try {
    sketchIr = JSON.parse(source.text);
  } catch (error) {
    throw new Error(`Malformed sketch IR JSON in ${source.path}: ${error.message}`);
  }

  if (!isObject(sketchIr))
    throw new Error(`Malformed sketch IR in ${source.path}: root must be an object.`);
  if (sketchIr.schemaVersion !== 'sketch-understanding-ir.v0') {
    throw new Error(
      `Malformed sketch IR in ${source.path}: expected schemaVersion sketch-understanding-ir.v0.`,
    );
  }
  if (!Array.isArray(sketchIr.features) || sketchIr.features.length === 0) {
    throw new Error(`Malformed sketch IR in ${source.path}: features must be a non-empty array.`);
  }
  if (!Array.isArray(sketchIr.requiredViews) || sketchIr.requiredViews.length === 0) {
    throw new Error(
      `Malformed sketch IR in ${source.path}: requiredViews must be a non-empty array.`,
    );
  }
  return sketchIr;
}

function splitMarkdownTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function stripInlineCode(value) {
  return asString(value).replace(/`([^`]+)`/g, '$1');
}

function splitFeatureIds(value) {
  const clean = stripInlineCode(value);
  if (!clean || /^all\b/i.test(clean)) return [];
  return uniqueInOrder(clean.split(',').map((entry) => entry.trim()));
}

function parsePhasePlan(markdown) {
  const phases = [];
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const cells = splitMarkdownTableRow(line);
    if (!cells || cells.length < 5) continue;
    if (cells[0] === 'Phase' || /^-+$/.test(cells[0].replace(/\s/g, ''))) continue;

    const match = cells[0].match(/^(P\d+)\s+(.+)$/);
    if (!match) continue;
    const id = match[1];
    phases.push({
      id,
      title: match[2],
      scope: stripInlineCode(cells[1]),
      criticalFeatureIds: splitFeatureIds(cells[2]),
      entryCriteria: stripInlineCode(cells[3]),
      exitEvidence: stripInlineCode(cells[4]),
    });
  }
  if (phases.length === 0) throw new Error('Malformed phase plan: no phase table rows found.');
  return phases;
}

function extractChecklistItems(markdown, heading) {
  const items = [];
  let inSection = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      inSection = line.replace(/^##\s+/, '').trim() === heading;
      continue;
    }
    if (!inSection) continue;
    const match = line.match(/^- \[[ xX]\]\s+(.+)$/);
    if (match) items.push(match[1].trim().replace(/\s+/g, ' '));
  }
  return items;
}

function extractChecklistRequiredViews(checklistMarkdown) {
  const lower = checklistMarkdown.toLowerCase();
  const viewIds = [];
  for (const [phrase, viewId] of Object.entries(CHECKLIST_VIEW_PHRASES)) {
    if (lower.includes(phrase)) viewIds.push(viewId);
  }
  return uniqueInOrder(viewIds);
}

function buildRequiredViews(sketchIr, checklistMarkdown) {
  const checklistViewIds = extractChecklistRequiredViews(checklistMarkdown);
  const sourceViews = sketchIr.requiredViews.map((view) => view.id);
  const allViewIds = sortBySourceOrder([...sourceViews, ...checklistViewIds], sourceViews);
  const byId = new Map(sketchIr.requiredViews.map((view) => [view.id, view]));

  return allViewIds.map((viewId) => {
    const source = byId.get(viewId) ?? { id: viewId, kind: 'unknown', purpose: '' };
    return {
      id: viewId,
      aliases: VIEW_ALIASES[viewId] ?? [],
      kind: asString(source.kind) || 'unknown',
      purpose: asString(source.purpose),
      evidenceType: viewId === 'wire_diagnostic' ? 'diagnostic_screenshot' : 'screenshot',
      sourceRefs: ['spec/target-house/target-house-1-sketch-ir.draft.json#requiredViews'],
    };
  });
}

function phaseMapByFeature(phases, featureIds) {
  const mapping = new Map();
  for (const phase of phases) {
    for (const featureId of phase.criticalFeatureIds) {
      mapping.set(featureId, phase.id);
    }
  }
  for (const featureId of featureIds) {
    if (mapping.has(featureId)) continue;
    if (featureId === 'documentation_evidence_set') mapping.set(featureId, 'P7');
    else if (featureId === 'room_access_and_enclosure') mapping.set(featureId, 'P5');
    else if (featureId === 'site_orientation_and_plinth') mapping.set(featureId, 'P0');
    else mapping.set(featureId, 'P6');
  }
  return mapping;
}

function evidenceTypesForFeature(feature, phaseId) {
  const needs = feature.capabilityNeeds.join(' ').toLowerCase();
  const types = ['screenshot', 'advisor_payload'];
  if (feature.mustRenderInViews.includes('wire_diagnostic')) types.push('wire_diagnostic');
  if (needs.includes('schedule') || feature.id === 'documentation_evidence_set') {
    types.push('schedule');
  }
  if (
    needs.includes('door') ||
    needs.includes('stair') ||
    needs.includes('opening') ||
    phaseId === 'P6'
  ) {
    types.push('constructability_report');
  }
  if (phaseId === 'P7' || feature.id === 'documentation_evidence_set') {
    types.push('export_manifest', 'provenance_manifest', 'tolerance_ledger');
  }
  return uniqueInOrder(types);
}

function buildFeatureSelectors(feature, rooms) {
  const selectors = [
    `feature:${feature.id}`,
    `kind:${feature.kind}`,
    ...(FEATURE_CATEGORY_SELECTORS[feature.id] ?? []),
  ];
  if (feature.id === 'room_access_and_enclosure') {
    selectors.push(...rooms.map((room) => `room:${room.id}`));
  }
  return uniqueInOrder(selectors);
}

function buildRequiredFeatures(sketchIr, phases, requiredViews) {
  const viewOrder = requiredViews.map((view) => view.id);
  const featureIds = sketchIr.features.map((feature) => feature.id);
  const featurePhase = phaseMapByFeature(phases, featureIds);
  const rooms = Array.isArray(sketchIr.programme) ? sketchIr.programme : [];

  return sketchIr.features.map((feature) => {
    const phaseId = featurePhase.get(feature.id);
    const requiredViewIds = sortBySourceOrder(feature.mustRenderInViews ?? [], viewOrder);
    return {
      id: feature.id,
      title: titleFromId(feature.id),
      kind: asString(feature.kind),
      priority: asString(feature.visualPriority) || 'unspecified',
      phaseId,
      requiredViewIds,
      requiredElementIds: [],
      semanticSelectors: buildFeatureSelectors(feature, rooms),
      capabilityNeeds: uniqueInOrder(feature.capabilityNeeds ?? []),
      evidenceTypes: evidenceTypesForFeature(
        {
          ...feature,
          capabilityNeeds: feature.capabilityNeeds ?? [],
          mustRenderInViews: requiredViewIds,
        },
        phaseId,
      ),
      sourceRefs: ['spec/target-house/target-house-1-sketch-ir.draft.json#features'],
    };
  });
}

function buildRequiredRooms(sketchIr) {
  const rooms = Array.isArray(sketchIr.programme) ? sketchIr.programme : [];
  return rooms.map((room) => ({
    id: asString(room.id),
    name: asString(room.name),
    level: asString(room.level),
    targetAreaM2: room.targetAreaM2,
    function: asString(room.functionLabel),
    programmeCode: asString(room.programmeCode),
    requiredMetadata: [
      'level',
      'name',
      'id',
      'targetAreaM2',
      'function',
      'boundedStatus',
      'schedule.include',
    ],
    scheduleRequired: room.schedule === true,
    semanticSelector: `room:${room.id}`,
  }));
}

function buildToleranceRequirements(sketchIr) {
  const assumptions = Array.isArray(sketchIr.assumptions) ? sketchIr.assumptions : [];
  const tolerances = assumptions.map((assumption) => ({
    id: asString(assumption.id).replace(/^assumption_/, 'tolerance_'),
    sourceAssumptionId: asString(assumption.id),
    statement: asString(assumption.statement),
    confidence: asString(assumption.confidence),
    requiredEvidence: asString(assumption.validation),
    expiryCondition: asString(assumption.validation),
  }));

  tolerances.push(
    {
      id: 'tolerance_site_georeference_unavailable',
      statement:
        'Survey point, property lines, setbacks, B-plan constraints, and georeference are unavailable.',
      confidence: 'low',
      requiredEvidence: 'Carry explicit site assumptions in the model and final tolerance ledger.',
      expiryCondition:
        'Expires when survey, north arrow, property, and setback inputs are supplied.',
    },
    {
      id: 'tolerance_structure_lite_unverified',
      statement:
        'Cantilever reactions, roof-court edge support, and shell-wall junctions are concept placeholders.',
      confidence: 'medium',
      requiredEvidence: 'Load-path notes, support placeholders, and constructability evidence.',
      expiryCondition: 'Expires when structural design verifies the load path.',
    },
  );

  return tolerances;
}

function buildEvidenceRequirements(sketchIr, checklistMarkdown) {
  const checklistEvidenceItems = extractChecklistItems(
    checklistMarkdown,
    'Advisor, Evidence, And Export Acceptance',
  );
  const exportOutputs = sketchIr.informationRequirements?.exportRequirements?.outputs ?? [];
  return {
    screenshots: [
      'main_front_left',
      'roof_high',
      'front_elevation',
      'front_loggia',
      'rear_right_axon',
      'ground_floor_plan',
      'first_floor_plan',
      'wire_diagnostic',
    ],
    advisor: ['phase_warning_info_payloads', 'construction_readiness_profile'],
    schedules: ['room_schedule', 'door_window_schedule', 'type_material_schedule'],
    exports: uniqueInOrder(exportOutputs),
    manifests: ['evidence_package', 'source_bundle', 'tolerance_ledger', 'provenance_manifest'],
    checklistItems: checklistEvidenceItems,
  };
}

export function validateTargetHouseAcceptancePack(pack) {
  const issues = [];
  const add = (code, pathValue, message) => issues.push({ code, path: pathValue, message });

  if (!isObject(pack)) {
    return {
      valid: false,
      issues: [{ code: 'pack_not_object', path: '$', message: 'Pack must be an object.' }],
    };
  }
  if (pack.schemaVersion !== TARGET_HOUSE_ACCEPTANCE_SCHEMA_VERSION) {
    add(
      'invalid_schema_version',
      'schemaVersion',
      `Expected ${TARGET_HOUSE_ACCEPTANCE_SCHEMA_VERSION}.`,
    );
  }
  if (!Array.isArray(pack.requiredFeatures) || pack.requiredFeatures.length === 0) {
    add(
      'missing_required_features',
      'requiredFeatures',
      'At least one required feature is required.',
    );
  }
  if (!Array.isArray(pack.requiredViews) || pack.requiredViews.length === 0) {
    add('missing_required_views', 'requiredViews', 'At least one required view is required.');
  }
  if (!Array.isArray(pack.phases) || pack.phases.length === 0) {
    add('missing_phases', 'phases', 'At least one phase mapping is required.');
  }

  const viewIds = new Set((pack.requiredViews ?? []).map((view) => view.id));
  for (const requiredViewId of [
    'main_front_left',
    'front_elevation',
    'front_loggia',
    'rear_right_axon',
    'roof_high',
    'ground_floor_plan',
    'first_floor_plan',
    'wire_diagnostic',
  ]) {
    if (!viewIds.has(requiredViewId)) {
      add('missing_required_view_id', 'requiredViews', `Missing required view ${requiredViewId}.`);
    }
  }

  const phaseIds = new Set((pack.phases ?? []).map((phase) => phase.id));
  for (const [index, feature] of (pack.requiredFeatures ?? []).entries()) {
    if (!asString(feature.id))
      add('missing_feature_id', `requiredFeatures[${index}].id`, 'Feature id is required.');
    if (!phaseIds.has(feature.phaseId)) {
      add(
        'unknown_feature_phase',
        `requiredFeatures[${index}].phaseId`,
        `Unknown phase ${feature.phaseId}.`,
      );
    }
    if (
      (!Array.isArray(feature.requiredElementIds) || feature.requiredElementIds.length === 0) &&
      (!Array.isArray(feature.semanticSelectors) || feature.semanticSelectors.length === 0)
    ) {
      add(
        'feature_without_targets',
        `requiredFeatures[${index}]`,
        'Feature must include requiredElementIds or semanticSelectors.',
      );
    }
    for (const viewId of feature.requiredViewIds ?? []) {
      if (!viewIds.has(viewId)) {
        add(
          'feature_unknown_view',
          `requiredFeatures[${index}].requiredViewIds`,
          `Unknown view ${viewId}.`,
        );
      }
    }
    if (!Array.isArray(feature.evidenceTypes) || feature.evidenceTypes.length === 0) {
      add(
        'feature_without_evidence',
        `requiredFeatures[${index}].evidenceTypes`,
        'Evidence types are required.',
      );
    }
  }

  return { valid: issues.length === 0, issues };
}

export async function compileTargetHouseAcceptancePack({
  rootDir = process.cwd(),
  sources = DEFAULT_TARGET_HOUSE_ACCEPTANCE_SOURCES,
} = {}) {
  const [checklist, sketchIrSource, bimRequirements, phasePlan] = await Promise.all([
    readSource(rootDir, sources.checklist),
    readSource(rootDir, sources.sketchIr),
    readSource(rootDir, sources.bimRequirements),
    readSource(rootDir, sources.phasePlan),
  ]);

  if (!checklist.text.trim())
    throw new Error(`Malformed checklist in ${checklist.path}: source is empty.`);
  if (!bimRequirements.text.trim()) {
    throw new Error(`Malformed BIM requirements in ${bimRequirements.path}: source is empty.`);
  }
  if (!phasePlan.text.trim())
    throw new Error(`Malformed phase plan in ${phasePlan.path}: source is empty.`);

  const sketchIr = parseSketchIr(sketchIrSource);
  const phases = parsePhasePlan(phasePlan.text);
  const requiredViews = buildRequiredViews(sketchIr, checklist.text);
  const requiredFeatures = buildRequiredFeatures(sketchIr, phases, requiredViews);

  const pack = {
    schemaVersion: TARGET_HOUSE_ACCEPTANCE_SCHEMA_VERSION,
    kind: 'target_house_required_feature_pack',
    targetId: 'target-house-1',
    qualityTarget: asString(sketchIr.qualityTarget),
    sourceDigests: {
      [checklist.path]: checklist.sha256,
      [sketchIrSource.path]: sketchIrSource.sha256,
      [bimRequirements.path]: bimRequirements.sha256,
      [phasePlan.path]: phasePlan.sha256,
    },
    scaleBasis: {
      overallWidthMm: sketchIr.dimensions?.overallWidthMm,
      overallDepthMm: sketchIr.dimensions?.overallDepthMm,
      confidence: asString(sketchIr.dimensions?.confidence),
    },
    requiredViews,
    requiredFeatures,
    requiredRooms: buildRequiredRooms(sketchIr),
    requiredElementSemantics: sketchIr.informationRequirements?.elementSemanticRequirements ?? [],
    requiredLayerSets: sketchIr.informationRequirements?.materialLayerSetRequirements ?? [],
    requiredChecks: sketchIr.informationRequirements?.requiredChecks ?? [],
    dataQualityChecks: sketchIr.informationRequirements?.dataQualityChecks ?? [],
    tolerances: buildToleranceRequirements(sketchIr),
    evidenceRequirements: buildEvidenceRequirements(sketchIr, checklist.text),
    phases,
  };

  const validation = validateTargetHouseAcceptancePack(pack);
  if (!validation.valid) {
    const details = validation.issues.map((entry) => `${entry.code} at ${entry.path}`).join(', ');
    throw new Error(`Compiled target-house acceptance pack is invalid: ${details}`);
  }

  return pack;
}

export function stableStringifyTargetHouseAcceptancePack(pack) {
  return `${JSON.stringify(pack, null, 2)}\n`;
}

export async function writeTargetHouseAcceptancePack({
  rootDir = process.cwd(),
  outputPath = 'spec/generated/target-house-1-required-features.json',
  sources = DEFAULT_TARGET_HOUSE_ACCEPTANCE_SOURCES,
} = {}) {
  const pack = await compileTargetHouseAcceptancePack({ rootDir, sources });
  const absoluteOutputPath = path.resolve(rootDir, outputPath);
  await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await fs.writeFile(absoluteOutputPath, stableStringifyTargetHouseAcceptancePack(pack));
  return { pack, outputPath: normalizeSourcePath(rootDir, absoluteOutputPath) };
}
