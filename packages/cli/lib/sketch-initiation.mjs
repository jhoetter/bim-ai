import fs from 'node:fs/promises';
import path from 'node:path';

import { applyVisualGateToChecklist } from './png-visual-gate.mjs';

export const DEFAULT_CAPABILITY_MATRIX_PATH = 'spec/sketch-to-bim-capability-matrix.json';
export const INITIATION_MODES = {
  massing_only: {
    label: 'Massing only',
    description: 'Envelope/silhouette study. Rooms and documentation are optional.',
    requireProgramme: false,
    requireDiagnosticView: false,
    failOnAdvisorWarning: false,
    minRequiredViews: 1,
  },
  concept_bim: {
    label: 'Concept BIM',
    description: 'Architectural concept with primary BIM objects and basic usability evidence.',
    requireProgramme: false,
    requireDiagnosticView: true,
    failOnAdvisorWarning: false,
    minRequiredViews: 2,
  },
  project_initiation_bim: {
    label: 'Project-initiation BIM',
    description: 'Usable seed model with rooms, access, advisor feedback, screenshots, and evidence packet.',
    requireProgramme: true,
    requireDiagnosticView: true,
    failOnAdvisorWarning: true,
    minRequiredViews: 3,
  },
  documentation_ready: {
    label: 'Documentation ready',
    description: 'Project-initiation BIM plus plans/sheets/schedules that can be handed off directly.',
    requireProgramme: true,
    requireDiagnosticView: true,
    failOnAdvisorWarning: true,
    minRequiredViews: 4,
  },
};

const PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const CAPABILITY_STATUSES = new Set(['supported', 'partial', 'gap']);
const BIM_REQUIRED_TARGETS = new Set(['project_initiation_bim', 'documentation_ready']);
const BIM_ADVISORY_TARGETS = new Set(['concept_bim']);
const REQUIRED_ELEMENT_SEMANTIC_CATEGORIES = [
  'exterior_wall',
  'interior_wall',
  'slab',
  'roof',
  'stair',
  'door',
  'window',
  'railing',
  'room',
  'asset',
];
const REQUIRED_LAYER_SET_CATEGORIES = ['wall', 'slab', 'roof'];
const IFC_ENTITY_INTENT = new Set([
  'IfcSpace',
  'IfcWall',
  'IfcWallStandardCase',
  'IfcSlab',
  'IfcRoof',
  'IfcStair',
  'IfcDoor',
  'IfcWindow',
  'IfcRailing',
  'IfcFurnishingElement',
  'IfcBuildingElementProxy',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issue(severity, code, pathValue, message) {
  return { severity, code, path: pathValue, message };
}

function requireString(issues, obj, key, pathValue) {
  if (typeof obj?.[key] !== 'string' || obj[key].trim() === '') {
    issues.push(issue('error', 'missing_string', `${pathValue}.${key}`, `${key} must be a non-empty string.`));
  }
}

function requireBoolean(issues, obj, key, pathValue) {
  if (typeof obj?.[key] !== 'boolean') {
    issues.push(issue('error', 'missing_boolean', `${pathValue}.${key}`, `${key} must be a boolean.`));
  }
}

function requirePositiveNumber(issues, obj, key, pathValue) {
  if (!Number.isFinite(obj?.[key]) || obj[key] <= 0) {
    issues.push(issue('error', 'missing_positive_number', `${pathValue}.${key}`, `${key} must be a positive number.`));
  }
}

function requireArray(issues, obj, key, pathValue, { min = 0 } = {}) {
  if (!Array.isArray(obj?.[key])) {
    issues.push(issue('error', 'missing_array', `${pathValue}.${key}`, `${key} must be an array.`));
    return [];
  }
  if (obj[key].length < min) {
    issues.push(issue('error', 'array_too_short', `${pathValue}.${key}`, `${key} must contain at least ${min} item(s).`));
  }
  return obj[key];
}

export async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${filePath}: ${detail}`);
  }
}

function validateBimInformationRequirements(ir, mode) {
  const issues = [];
  const target = ir?.qualityTarget;
  const severity = BIM_REQUIRED_TARGETS.has(target) ? 'error' : 'warning';
  const shouldValidate =
    BIM_REQUIRED_TARGETS.has(target) ||
    BIM_ADVISORY_TARGETS.has(target) ||
    isObject(ir?.informationRequirements);

  if (!shouldValidate) return issues;

  const requirements = ir.informationRequirements;
  if (!isObject(requirements)) {
    issues.push(issue(
      severity,
      'bim_information_requirements_missing',
      '$.informationRequirements',
      `${mode?.label ?? target} requires informationRequirements with LOI/LOD, rooms, element semantics, material layer sets, classifications, schedules, and data checks.`,
    ));
    return issues;
  }

  requireString(issues, requirements, 'qualityTarget', '$.informationRequirements');
  if (
    typeof requirements.qualityTarget === 'string' &&
    typeof target === 'string' &&
    requirements.qualityTarget !== target
  ) {
    issues.push(issue(
      severity,
      'bim_quality_target_mismatch',
      '$.informationRequirements.qualityTarget',
      'informationRequirements.qualityTarget must match the root qualityTarget.',
    ));
  }
  for (const key of ['lodIntent', 'loiIntent', 'exchangeGoal']) {
    requireString(issues, requirements, key, '$.informationRequirements');
  }
  requireArray(issues, requirements, 'modelUses', '$.informationRequirements', { min: 1 });
  requireArray(issues, requirements, 'disciplineScope', '$.informationRequirements', { min: 1 });
  requireArray(issues, requirements, 'requiredChecks', '$.informationRequirements', { min: 1 });

  const rooms = requireArray(issues, requirements, 'rooms', '$.informationRequirements', {
    min: BIM_REQUIRED_TARGETS.has(target) ? 1 : 0,
  });
  rooms.forEach((room, index) => {
    const p = `$.informationRequirements.rooms[${index}]`;
    if (!isObject(room)) {
      issues.push(issue('error', 'invalid_room_requirement', p, 'Room requirement must be an object.'));
      return;
    }
    for (const key of ['name', 'number', 'level', 'function', 'occupancyUse', 'boundingStatus']) {
      requireString(issues, room, key, p);
    }
    requirePositiveNumber(issues, room, 'targetAreaM2', p);
    if (!isObject(room.access)) {
      issues.push(issue('error', 'missing_object', `${p}.access`, 'Room access requirements must be an object.'));
    } else {
      const requiredDoors = Number.isFinite(room.access.requiredDoors) ? room.access.requiredDoors : 0;
      const doorRefs = Array.isArray(room.access.doorRefs) ? room.access.doorRefs : [];
      if (requiredDoors <= 0 && doorRefs.length === 0) {
        issues.push(issue(
          'error',
          'room_access_missing',
          `${p}.access`,
          'Room access must require at least one door or list explicit doorRefs.',
        ));
      }
    }
    if (!isObject(room.schedule)) {
      issues.push(issue('error', 'missing_object', `${p}.schedule`, 'Room schedule intent must be an object.'));
    } else {
      requireBoolean(issues, room.schedule, 'include', `${p}.schedule`);
      if (room.schedule.include !== true) {
        issues.push(issue('error', 'room_schedule_not_included', `${p}.schedule.include`, 'Rooms must be included in a schedule for project initiation BIM.'));
      }
    }
    if (!isObject(room.classification)) {
      issues.push(issue('error', 'missing_object', `${p}.classification`, 'Room classification placeholders must be an object.'));
    } else {
      for (const key of ['din277Use', 'din277AreaType', 'ifcEntityIntent']) {
        requireString(issues, room.classification, key, `${p}.classification`);
      }
      if (
        typeof room.classification.ifcEntityIntent === 'string' &&
        room.classification.ifcEntityIntent !== 'IfcSpace'
      ) {
        issues.push(issue('error', 'room_ifc_entity_intent', `${p}.classification.ifcEntityIntent`, 'Rooms must declare IfcSpace entity intent.'));
      }
    }
  });

  const semanticRows = requireArray(
    issues,
    requirements,
    'elementSemanticRequirements',
    '$.informationRequirements',
    { min: BIM_REQUIRED_TARGETS.has(target) ? REQUIRED_ELEMENT_SEMANTIC_CATEGORIES.length : 0 },
  );
  const semanticCategories = new Set();
  semanticRows.forEach((row, index) => {
    const p = `$.informationRequirements.elementSemanticRequirements[${index}]`;
    if (!isObject(row)) {
      issues.push(issue('error', 'invalid_element_semantic_requirement', p, 'Element semantic requirement must be an object.'));
      return;
    }
    for (const key of ['category', 'expectedBimCategory', 'ifcEntityIntent']) {
      requireString(issues, row, key, p);
    }
    if (typeof row.category === 'string') semanticCategories.add(row.category);
    if (typeof row.ifcEntityIntent === 'string' && !IFC_ENTITY_INTENT.has(row.ifcEntityIntent)) {
      issues.push(issue(
        'error',
        'unknown_ifc_entity_intent',
        `${p}.ifcEntityIntent`,
        `ifcEntityIntent should be one of ${[...IFC_ENTITY_INTENT].join(', ')}.`,
      ));
    }
    if (!isObject(row.classification)) {
      issues.push(issue('error', 'missing_object', `${p}.classification`, 'Element classification placeholders must be an object.'));
    } else {
      requireString(issues, row.classification, 'din276CostGroup', `${p}.classification`);
      requireString(issues, row.classification, 'ifcClassificationRef', `${p}.classification`);
    }
  });
  for (const category of REQUIRED_ELEMENT_SEMANTIC_CATEGORIES) {
    if (!semanticCategories.has(category)) {
      issues.push(issue(
        severity,
        'element_semantic_category_missing',
        '$.informationRequirements.elementSemanticRequirements',
        `Missing semantic requirement for ${category}.`,
      ));
    }
  }

  const layerSets = requireArray(
    issues,
    requirements,
    'materialLayerSetRequirements',
    '$.informationRequirements',
    { min: BIM_REQUIRED_TARGETS.has(target) ? REQUIRED_LAYER_SET_CATEGORIES.length : 0 },
  );
  const layerSetCategories = new Set();
  layerSets.forEach((row, index) => {
    const p = `$.informationRequirements.materialLayerSetRequirements[${index}]`;
    if (!isObject(row)) {
      issues.push(issue('error', 'invalid_material_layer_set_requirement', p, 'Material layer-set requirement must be an object.'));
      return;
    }
    for (const key of ['id', 'layerSetName']) requireString(issues, row, key, p);
    requirePositiveNumber(issues, row, 'totalThicknessMm', p);
    const appliesTo = requireArray(issues, row, 'appliesToCategories', p, { min: 1 });
    appliesTo.forEach((category) => {
      if (typeof category === 'string') layerSetCategories.add(category);
    });
    const layers = requireArray(issues, row, 'layers', p, { min: 1 });
    layers.forEach((layer, layerIndex) => {
      const layerPath = `${p}.layers[${layerIndex}]`;
      if (!isObject(layer)) {
        issues.push(issue('error', 'invalid_material_layer', layerPath, 'Layer must be an object.'));
        return;
      }
      for (const key of ['function', 'materialKey']) requireString(issues, layer, key, layerPath);
      requirePositiveNumber(issues, layer, 'thicknessMm', layerPath);
    });
    if (!isObject(row.performancePlaceholders)) {
      issues.push(issue(
        'error',
        'material_performance_placeholders_missing',
        `${p}.performancePlaceholders`,
        'Layer sets must include thermal/fire/acoustic placeholder intent.',
      ));
    } else {
      for (const key of ['thermal', 'fire', 'acoustic']) {
        requireString(issues, row.performancePlaceholders, key, `${p}.performancePlaceholders`);
      }
    }
  });
  for (const category of REQUIRED_LAYER_SET_CATEGORIES) {
    if (!layerSetCategories.has(category)) {
      issues.push(issue(
        severity,
        'material_layer_set_category_missing',
        '$.informationRequirements.materialLayerSetRequirements',
        `Missing material/layer-set requirement for ${category}.`,
      ));
    }
  }

  if (!isObject(requirements.classificationRequirements)) {
    issues.push(issue(
      severity,
      'classification_requirements_missing',
      '$.informationRequirements.classificationRequirements',
      'Classification requirements must include DIN277 room placeholders, DIN276 element placeholders, and planned IFC classification references.',
    ));
  } else {
    const classificationPath = '$.informationRequirements.classificationRequirements';
    for (const key of ['roomSystem', 'elementSystem', 'ifcClassificationReferences']) {
      requireString(issues, requirements.classificationRequirements, key, classificationPath);
    }
    requireArray(issues, requirements.classificationRequirements, 'requiredPlaceholders', classificationPath, { min: 1 });
  }

  requireArray(issues, requirements, 'schedules', '$.informationRequirements', {
    min: BIM_REQUIRED_TARGETS.has(target) ? 1 : 0,
  });
  requireArray(issues, requirements, 'dataQualityChecks', '$.informationRequirements', {
    min: BIM_REQUIRED_TARGETS.has(target) ? 1 : 0,
  });

  return issues;
}

export function validateSketchIr(ir) {
  const issues = [];
  if (!isObject(ir)) {
    return [issue('error', 'invalid_ir', '$', 'Sketch Understanding IR must be a JSON object.')];
  }
  if (ir.schemaVersion !== 'sketch-understanding-ir.v0') {
    issues.push(issue('error', 'schema_version', '$.schemaVersion', 'Expected sketch-understanding-ir.v0.'));
  }
  requireString(issues, ir, 'projectType', '$');
  requireString(issues, ir, 'qualityTarget', '$');
  const mode = INITIATION_MODES[ir.qualityTarget];
  if (typeof ir.qualityTarget === 'string' && !mode) {
    issues.push(issue(
      'error',
      'invalid_quality_target',
      '$.qualityTarget',
      `qualityTarget must be one of ${Object.keys(INITIATION_MODES).join(', ')}.`,
    ));
  }

  if (!isObject(ir.sourceInputs)) {
    issues.push(issue('error', 'missing_object', '$.sourceInputs', 'sourceInputs must be an object.'));
  } else {
    requireArray(issues, ir.sourceInputs, 'images', '$.sourceInputs', { min: 1 });
  }

  if (!isObject(ir.visualRead)) {
    issues.push(issue('error', 'missing_object', '$.visualRead', 'visualRead must be an object.'));
  } else {
    requireString(issues, ir.visualRead, 'primaryView', '$.visualRead');
    requireArray(issues, ir.visualRead, 'dominantVolumes', '$.visualRead', { min: 1 });
    requireArray(issues, ir.visualRead, 'nonNegotiables', '$.visualRead', { min: 1 });
  }

  const features = requireArray(issues, ir, 'features', '$', { min: 1 });
  features.forEach((feature, index) => {
    const p = `$.features[${index}]`;
    if (!isObject(feature)) {
      issues.push(issue('error', 'invalid_feature', p, 'Feature must be an object.'));
      return;
    }
    requireString(issues, feature, 'id', p);
    requireString(issues, feature, 'kind', p);
    if (!PRIORITIES.has(feature.visualPriority)) {
      issues.push(issue('error', 'invalid_priority', `${p}.visualPriority`, 'visualPriority must be critical, high, medium, or low.'));
    }
    requireArray(issues, feature, 'mustRenderInViews', p, { min: 1 });
    if (feature.visualPriority === 'critical') {
      const needs = Array.isArray(feature.capabilityNeeds) ? feature.capabilityNeeds : [];
      if (needs.length === 0) {
        issues.push(issue('warning', 'critical_feature_needs_missing', `${p}.capabilityNeeds`, 'Critical features should list capabilityNeeds so the authoring route is explicit.'));
      }
    }
  });

  const requiredViews = requireArray(issues, ir, 'requiredViews', '$', {
    min: mode?.minRequiredViews ?? 1,
  });
  requiredViews.forEach((view, index) => {
    const p = `$.requiredViews[${index}]`;
    if (!isObject(view)) {
      issues.push(issue('error', 'invalid_view', p, 'Required view must be an object.'));
      return;
    }
    requireString(issues, view, 'id', p);
    requireString(issues, view, 'kind', p);
    requireString(issues, view, 'purpose', p);
  });

  const assumptions = requireArray(issues, ir, 'assumptions', '$');
  assumptions.forEach((assumption, index) => {
    const p = `$.assumptions[${index}]`;
    if (!isObject(assumption)) {
      issues.push(issue('error', 'invalid_assumption', p, 'Assumption must be an object.'));
      return;
    }
    requireString(issues, assumption, 'id', p);
    requireString(issues, assumption, 'statement', p);
    requireString(issues, assumption, 'confidence', p);
    if (!assumption.validation) {
      issues.push(issue('warning', 'assumption_validation_missing', `${p}.validation`, 'Assumption has no validation route.'));
    }
  });

  if (!Array.isArray(ir.programme) || ir.programme.length === 0) {
    issues.push(issue(
      mode?.requireProgramme ? 'error' : 'warning',
      'programme_missing',
      '$.programme',
      'No programme entries were supplied; room and usability checks will be weaker.',
    ));
  }

  if (mode?.requireDiagnosticView && Array.isArray(ir.requiredViews)) {
    const hasDiagnostic = ir.requiredViews.some((view) => (
      ['diagnostic', 'plan', 'floor_plan', 'section'].includes(view?.kind)
    ));
    if (!hasDiagnostic) {
      issues.push(issue(
        ir.qualityTarget === 'documentation_ready' ? 'error' : 'warning',
        'diagnostic_view_missing',
        '$.requiredViews',
        `${mode.label} should include a diagnostic/plan/section view so topology defects are visible.`,
      ));
    }
  }

  issues.push(...validateBimInformationRequirements(ir, mode));

  return issues;
}

export function validateCapabilityMatrix(matrix) {
  const issues = [];
  if (!isObject(matrix)) {
    return [issue('error', 'invalid_capability_matrix', '$', 'Capability matrix must be a JSON object.')];
  }
  if (matrix.schemaVersion !== 'sketch-to-bim-capability-matrix.v0') {
    issues.push(issue('error', 'capability_schema_version', '$.schemaVersion', 'Expected sketch-to-bim-capability-matrix.v0.'));
  }
  const capabilities = requireArray(issues, matrix, 'capabilities', '$', { min: 1 });
  capabilities.forEach((capability, index) => {
    const p = `$.capabilities[${index}]`;
    if (!isObject(capability)) {
      issues.push(issue('error', 'invalid_capability', p, 'Capability must be an object.'));
      return;
    }
    requireString(issues, capability, 'id', p);
    requireString(issues, capability, 'title', p);
    requireArray(issues, capability, 'featureKinds', p, { min: 1 });
    if (!CAPABILITY_STATUSES.has(capability.status)) {
      issues.push(issue('error', 'invalid_capability_status', `${p}.status`, 'Capability status must be supported, partial, or gap.'));
    }
    for (const key of ['commandSurface', 'rendererSurface', 'advisorCoverage', 'knownFailureModes', 'requiredEvidence']) {
      requireArray(issues, capability, key, p, { min: 1 });
    }
    requireString(issues, capability, 'fallback', p);
  });
  return issues;
}

function capabilityIndex(matrix) {
  const index = new Map();
  for (const capability of matrix.capabilities ?? []) {
    if (!isObject(capability) || !Array.isArray(capability.featureKinds)) continue;
    for (const kind of capability.featureKinds) {
      const key = String(kind);
      const list = index.get(key) ?? [];
      list.push(capability);
      index.set(key, list);
    }
  }
  return index;
}

function featureReadiness(feature, matches, missingViews) {
  if (matches.length === 0) return feature.visualPriority === 'critical' ? 'blocked' : 'needs_attention';
  if (feature.visualPriority === 'critical' && matches.every((capability) => capability.status === 'gap')) {
    return 'blocked';
  }
  if (missingViews.length && feature.visualPriority === 'critical') return 'blocked';
  if (matches.some((capability) => capability.status === 'partial' || capability.status === 'gap')) {
    return 'needs_attention';
  }
  if (missingViews.length) return 'needs_attention';
  return 'ready';
}

export function buildCapabilityCoverage(ir, matrix, options = {}) {
  const issues = [
    ...validateSketchIr(ir),
    ...validateCapabilityMatrix(matrix),
  ];
  const viewIds = new Set((ir.requiredViews ?? []).map((view) => view?.id).filter(Boolean));
  const features = Array.isArray(ir.features) ? ir.features : [];
  const index = capabilityIndex(matrix);
  const rows = [];

  for (const feature of features) {
    if (!isObject(feature)) continue;
    const matches = index.get(feature.kind) ?? [];
    const mustRenderInViews = Array.isArray(feature.mustRenderInViews) ? feature.mustRenderInViews : [];
    const missingViews = mustRenderInViews.filter((viewId) => !viewIds.has(viewId));
    for (const viewId of missingViews) {
      issues.push(
        issue(
          feature.visualPriority === 'critical' ? 'error' : 'warning',
          'feature_view_missing',
          `$.features[${feature.id}].mustRenderInViews`,
          `Feature ${feature.id} requires missing view ${viewId}.`,
        ),
      );
    }
    if (matches.length === 0) {
      issues.push(
        issue(
          feature.visualPriority === 'critical' ? 'error' : 'warning',
          'capability_missing',
          `$.features[${feature.id}].kind`,
          `No capability maps feature kind ${feature.kind}.`,
        ),
      );
    } else if (feature.visualPriority === 'critical' && matches.every((capability) => capability.status === 'gap')) {
      issues.push(
        issue(
          'error',
          'critical_capability_gap',
          `$.features[${feature.id}].kind`,
          `Critical feature ${feature.id} only maps to gap capabilities.`,
        ),
      );
    } else if (matches.some((capability) => capability.status === 'partial')) {
      issues.push(
        issue(
          'warning',
          'partial_capability',
          `$.features[${feature.id}].kind`,
          `Feature ${feature.id} has partial capability support; screenshot/advisor proof is mandatory.`,
        ),
      );
    }

    rows.push({
      featureId: feature.id,
      kind: feature.kind,
      visualPriority: feature.visualPriority,
      mustRenderInViews,
      missingViews,
      readiness: featureReadiness(feature, matches, missingViews),
      capabilityMatches: matches.map((capability) => ({
        id: capability.id,
        title: capability.title,
        status: capability.status,
        commandSurface: capability.commandSurface ?? [],
        rendererSurface: capability.rendererSurface ?? [],
        advisorCoverage: capability.advisorCoverage ?? [],
        knownFailureModes: capability.knownFailureModes ?? [],
        requiredEvidence: capability.requiredEvidence ?? [],
        fallback: capability.fallback ?? null,
      })),
    });
  }

  const errorCount = issues.filter((item) => item.severity === 'error').length;
  const warningCount = issues.filter((item) => item.severity === 'warning').length;
  const blockedCount = rows.filter((row) => row.readiness === 'blocked').length;
  const needsAttentionCount = rows.filter((row) => row.readiness === 'needs_attention').length;

  return {
    schemaVersion: 'sketch-to-bim-initiation-coverage.v0',
    generatedAt: new Date().toISOString(),
    irPath: options.irPath ?? null,
    capabilityMatrixPath: options.capabilityMatrixPath ?? null,
    modelId: options.modelId ?? null,
    summary: {
      featureCount: rows.length,
      criticalFeatureCount: rows.filter((row) => row.visualPriority === 'critical').length,
      readyCount: rows.filter((row) => row.readiness === 'ready').length,
      needsAttentionCount,
      blockedCount,
      errorCount,
      warningCount,
    },
    issues,
    features: rows,
  };
}

export function buildCapabilityGapTasks(coverage) {
  const tasks = [];
  for (const feature of coverage.features ?? []) {
    const gapIssues = (coverage.issues ?? []).filter((item) => (
      ['capability_missing', 'critical_capability_gap', 'feature_view_missing'].includes(item.code) &&
      String(item.path ?? '').includes(feature.featureId)
    ));
    if (feature.readiness !== 'blocked' && gapIssues.length === 0) continue;
    const matchedGaps = (feature.capabilityMatches ?? []).filter(
      (capability) => capability.status === 'gap',
    );
    tasks.push({
      id: `skb-gap-${feature.featureId}`,
      featureId: feature.featureId,
      featureKind: feature.kind,
      visualPriority: feature.visualPriority,
      readiness: feature.readiness,
      reason: gapIssues.length
        ? gapIssues.map((item) => item.message)
        : ['Feature is blocked by capability coverage.'],
      capabilityMatches: feature.capabilityMatches ?? [],
      missingViews: feature.missingViews ?? [],
      requiredAction: matchedGaps.length
        ? 'Implement or repair the listed command/render/advisor capability before modelling this feature.'
        : 'Add a capability-matrix entry or required saved view before authoring this feature.',
      fallbackPolicy:
        'Do not fake this feature with decorative masses, hidden categories, or metadata-only geometry.',
    });
  }
  return {
    schemaVersion: 'sketch-to-bim-capability-gaps.v0',
    generatedAt: new Date().toISOString(),
    taskCount: tasks.length,
    tasks,
  };
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim() !== ''))];
}

export function buildVisualChecklist(ir, coverage) {
  const viewMap = new Map((ir.requiredViews ?? []).map((view) => [view.id, view]));
  const items = [];

  for (const feature of coverage.features ?? []) {
    const knownFailureModes = uniqueStrings(
      feature.capabilityMatches.flatMap((capability) => capability.knownFailureModes ?? []),
    );
    const requiredEvidence = uniqueStrings(
      feature.capabilityMatches.flatMap((capability) => capability.requiredEvidence ?? []),
    );
    for (const viewId of feature.mustRenderInViews ?? []) {
      items.push({
        id: `${viewId}:${feature.featureId}`,
        viewId,
        viewKind: viewMap.get(viewId)?.kind ?? null,
        featureId: feature.featureId,
        featureKind: feature.kind,
        visualPriority: feature.visualPriority,
        status: 'unchecked',
        screenshotPath: null,
        prompt: `Confirm ${feature.featureId} (${feature.kind}) is visibly correct in ${viewId}.`,
        knownFailureModes,
        requiredEvidence,
        notes: '',
      });
    }
  }

  const globalChecks = [
    ['global:silhouette', 'All required 3D views read as the sketch silhouette, not a generic building.'],
    ['global:advisor', 'Advisor warning/error findings are fixed or explicitly tolerated with elementIds.'],
    ['global:interior', 'Rooms, doors, stairs, and slab openings are plausible in plan and wire diagnostics.'],
    ['global:artifacts', 'No visible gaps, z-fighting, uncut walls, false masses, or distracting material artifacts remain.'],
  ];
  for (const [id, prompt] of globalChecks) {
    items.push({
      id,
      viewId: null,
      viewKind: null,
      featureId: null,
      featureKind: 'global_acceptance_gate',
      visualPriority: 'critical',
      status: 'unchecked',
      screenshotPath: null,
      prompt,
      knownFailureModes: [],
      requiredEvidence: [],
      notes: '',
    });
  }

  return {
    schemaVersion: 'sketch-to-bim-visual-checklist.v0',
    generatedAt: new Date().toISOString(),
    sourceInputs: ir.sourceInputs ?? {},
    requiredViews: ir.requiredViews ?? [],
    items,
  };
}

export function applyScreenshotManifestToChecklist(checklist, screenshotManifest) {
  const captures = new Map(
    (screenshotManifest?.captures ?? [])
      .filter((capture) => capture && typeof capture.viewId === 'string')
      .map((capture) => [capture.viewId, capture]),
  );
  return {
    ...checklist,
    items: (checklist.items ?? []).map((item) => {
      const capture = item.viewId ? captures.get(item.viewId) : null;
      if (!capture?.screenshotPath) return item;
      return {
        ...item,
        status: item.status === 'unchecked' ? 'needs_review' : item.status,
        screenshotPath: capture.screenshotPath,
        notes: item.notes || (capture.fallbackFit
          ? 'Screenshot captured with fit fallback because no saved viewpoint id matched this required view.'
          : ''),
      };
    }),
  };
}

function snapshotKindCount(modelStats, kinds) {
  const counts = modelStats?.countsByKind ?? {};
  return kinds.reduce((sum, kind) => sum + (counts[kind] ?? 0), 0);
}

function qualityCheck(id, status, message, detail = {}) {
  return { id, status, message, ...detail };
}

export function buildBimDataQualityReport({ ir, evidenceRun = null } = {}) {
  const requirements = isObject(ir?.informationRequirements) ? ir.informationRequirements : null;
  const required = BIM_REQUIRED_TARGETS.has(ir?.qualityTarget);
  const modelStats = evidenceRun?.modelStats ?? null;
  const checks = [];

  if (!required && !requirements) {
    return {
      schemaVersion: 'sketch-to-bim-data-quality.v0',
      generatedAt: new Date().toISOString(),
      qualityTarget: ir?.qualityTarget ?? null,
      liveModelChecked: Boolean(modelStats),
      ok: true,
      summary: { passCount: 0, warningCount: 0, errorCount: 0, plannedCount: 0 },
      checks,
    };
  }

  if (!requirements) {
    checks.push(qualityCheck(
      'information_requirements_present',
      required ? 'error' : 'warning',
      'No BIM informationRequirements were supplied.',
    ));
  } else {
    checks.push(qualityCheck(
      'information_requirements_present',
      'pass',
      'BIM informationRequirements are present.',
    ));
  }

  const rooms = Array.isArray(requirements?.rooms) ? requirements.rooms : [];
  const levels = uniqueStrings(rooms.map((room) => room?.level));
  if (rooms.length > 0) {
    checks.push(qualityCheck(
      'room_requirements',
      'pass',
      `${rooms.length} room/space requirement(s) declare IfcSpace intent, access, classification, and schedule inclusion.`,
      { requiredRooms: rooms.length, requiredLevels: levels },
    ));
  } else {
    checks.push(qualityCheck(
      'room_requirements',
      required ? 'error' : 'warning',
      'No room/space requirements were declared.',
    ));
  }

  if (modelStats) {
    const roomCount = snapshotKindCount(modelStats, ['room', 'space']);
    checks.push(qualityCheck(
      'model_room_count',
      roomCount >= rooms.length ? 'pass' : 'error',
      `Live model has ${roomCount} room/space element(s); IR requires ${rooms.length}.`,
      { actual: roomCount, expected: rooms.length },
    ));
    const levelCount = snapshotKindCount(modelStats, ['level']);
    checks.push(qualityCheck(
      'model_level_count',
      levelCount >= levels.length ? 'pass' : 'error',
      `Live model has ${levelCount} level element(s); IR references ${levels.length} level label(s).`,
      { actual: levelCount, expected: levels.length },
    ));
  } else if (required) {
    checks.push(qualityCheck(
      'live_room_level_check',
      'planned',
      'Live room and level counts will be checked by initiation-run evidence.',
      { expectedRooms: rooms.length, expectedLevelLabels: levels.length },
    ));
  }

  const semanticRows = Array.isArray(requirements?.elementSemanticRequirements)
    ? requirements.elementSemanticRequirements
    : [];
  const semanticCategories = new Set(semanticRows.map((row) => row?.category).filter(Boolean));
  const missingSemanticCategories = REQUIRED_ELEMENT_SEMANTIC_CATEGORIES.filter(
    (category) => !semanticCategories.has(category),
  );
  checks.push(qualityCheck(
    'element_semantic_requirements',
    missingSemanticCategories.length ? (required ? 'error' : 'warning') : 'pass',
    missingSemanticCategories.length
      ? `Missing semantic requirement(s): ${missingSemanticCategories.join(', ')}.`
      : 'Required element categories declare BIM category and IFC entity intent.',
    { missing: missingSemanticCategories },
  ));

  if (modelStats) {
    const categoryKindMap = {
      exterior_wall: ['wall'],
      interior_wall: ['wall'],
      slab: ['floor'],
      roof: ['roof'],
      stair: ['stair'],
      door: ['door'],
      window: ['window'],
      railing: ['railing'],
      room: ['room', 'space'],
      asset: ['asset', 'furniture', 'family_instance'],
    };
    for (const category of REQUIRED_ELEMENT_SEMANTIC_CATEGORIES) {
      if (!semanticCategories.has(category)) continue;
      const kinds = categoryKindMap[category] ?? [category];
      const actual = snapshotKindCount(modelStats, kinds);
      checks.push(qualityCheck(
        `model_category_${category}`,
        actual > 0 ? 'pass' : 'error',
        `Live model has ${actual} element(s) for required category ${category}.`,
        { actual, expectedKinds: kinds },
      ));
    }
  }

  const layerSets = Array.isArray(requirements?.materialLayerSetRequirements)
    ? requirements.materialLayerSetRequirements
    : [];
  const layerSetCategories = new Set(
    layerSets.flatMap((row) => (Array.isArray(row?.appliesToCategories) ? row.appliesToCategories : [])),
  );
  const missingLayerSets = REQUIRED_LAYER_SET_CATEGORIES.filter(
    (category) => !layerSetCategories.has(category),
  );
  checks.push(qualityCheck(
    'material_layer_set_requirements',
    missingLayerSets.length ? (required ? 'error' : 'warning') : 'pass',
    missingLayerSets.length
      ? `Missing material/layer-set requirement(s): ${missingLayerSets.join(', ')}.`
      : 'Wall, slab, and roof layer-set requirements include material layers and performance placeholders.',
    { missing: missingLayerSets },
  ));
  if (modelStats) {
    const typeCount = snapshotKindCount(modelStats, ['wall_type', 'floor_type', 'roof_type']);
    checks.push(qualityCheck(
      'model_type_layer_set_count',
      typeCount >= REQUIRED_LAYER_SET_CATEGORIES.length ? 'pass' : 'error',
      `Live model has ${typeCount} wall/floor/roof type element(s); layer-set intent requires at least ${REQUIRED_LAYER_SET_CATEGORIES.length}.`,
      { actual: typeCount, expected: REQUIRED_LAYER_SET_CATEGORIES.length },
    ));
  }

  const classifications = requirements?.classificationRequirements;
  checks.push(qualityCheck(
    'classification_placeholders',
    isObject(classifications) ? 'pass' : (required ? 'error' : 'warning'),
    isObject(classifications)
      ? 'DIN277 room, DIN276 element, and planned IFC classification placeholders are declared.'
      : 'Classification placeholders are missing.',
  ));

  const schedules = Array.isArray(requirements?.schedules) ? requirements.schedules : [];
  checks.push(qualityCheck(
    'schedule_requirements',
    schedules.length > 0 ? 'pass' : (required ? 'error' : 'warning'),
    schedules.length > 0
      ? `${schedules.length} schedule requirement(s) declared.`
      : 'No schedule requirements were declared.',
    { count: schedules.length },
  ));

  const exportRequirements = requirements?.exportRequirements;
  const exportOutputs = Array.isArray(exportRequirements?.outputs) ? exportRequirements.outputs : [];
  checks.push(qualityCheck(
    'export_readiness_requirements',
    exportOutputs.length > 0 ? 'pass' : (required ? 'error' : 'warning'),
    exportOutputs.length > 0
      ? `Export readiness outputs declared: ${exportOutputs.join(', ')}.`
      : 'No export readiness outputs were declared.',
    { outputs: exportOutputs },
  ));

  const summary = {
    passCount: checks.filter((check) => check.status === 'pass').length,
    warningCount: checks.filter((check) => check.status === 'warning').length,
    errorCount: checks.filter((check) => check.status === 'error').length,
    plannedCount: checks.filter((check) => check.status === 'planned').length,
  };

  return {
    schemaVersion: 'sketch-to-bim-data-quality.v0',
    generatedAt: new Date().toISOString(),
    qualityTarget: ir?.qualityTarget ?? null,
    liveModelChecked: Boolean(modelStats),
    ok: summary.errorCount === 0,
    summary,
    checks,
  };
}

export function buildAcceptanceGateReport({
  ir,
  coverage,
  liveAdvisor = null,
  screenshotManifest = null,
  visualGateReport = null,
  evidenceRun = null,
  bimDataQualityReport = null,
} = {}) {
  const mode = INITIATION_MODES[ir?.qualityTarget] ?? INITIATION_MODES.project_initiation_bim;
  const preflightOnly = evidenceRun?.acceptanceScope === 'preflight';
  const blockers = [];
  const tolerances = [];

  if ((coverage?.summary?.errorCount ?? 0) > 0) {
    blockers.push({
      code: 'coverage_errors',
      severity: 'error',
      message: `${coverage.summary.errorCount} IR/capability coverage error(s) remain.`,
    });
  }
  if ((coverage?.summary?.blockedCount ?? 0) > 0) {
    blockers.push({
      code: 'blocked_features',
      severity: 'error',
      message: `${coverage.summary.blockedCount} feature(s) are blocked by missing capability coverage.`,
    });
  }

  const warningCount = liveAdvisor?.warning?.total ?? 0;
  if (mode.failOnAdvisorWarning && warningCount > 0) {
    blockers.push({
      code: 'advisor_warning_findings',
      severity: 'warning',
      message: `${warningCount} live advisor warning finding(s) remain.`,
      groups: liveAdvisor.warning.groups ?? [],
    });
  } else if (warningCount > 0) {
    tolerances.push({
      code: 'advisor_warning_findings',
      message: `${warningCount} live advisor warning finding(s) require explicit review for this mode.`,
    });
  }

  if (!preflightOnly && mode.minRequiredViews > 0 && !screenshotManifest) {
    blockers.push({
      code: 'screenshots_missing',
      severity: 'error',
      message: 'No screenshot manifest was captured for the initiation packet.',
    });
  }
  if (!preflightOnly && screenshotManifest && Array.isArray(ir?.requiredViews)) {
    const captured = new Set((screenshotManifest.captures ?? []).map((capture) => capture.viewId));
    const missing = ir.requiredViews
      .filter((view) => ['3d', 'elevation', 'diagnostic', 'plan', 'floor_plan', 'section'].includes(view?.kind))
      .map((view) => view.id)
      .filter((viewId) => !captured.has(viewId));
    if (missing.length) {
      blockers.push({
        code: 'required_screenshots_missing',
        severity: 'error',
        message: `Required screenshot view(s) were not captured: ${missing.join(', ')}.`,
      });
    }
  }

  const modelStats = evidenceRun?.modelStats ?? null;
  const massCount = modelStats?.countsByKind?.mass ?? 0;
  if (ir?.qualityTarget !== 'massing_only' && massCount > 0) {
    blockers.push({
      code: 'final_mass_placeholder',
      severity: 'error',
      message: `${massCount} mass placeholder element(s) remain in a final BIM initiation model.`,
    });
  }

  if ((visualGateReport?.summary?.failCount ?? 0) > 0) {
    blockers.push({
      code: 'visual_gate_failures',
      severity: 'error',
      message: `${visualGateReport.summary.failCount} screenshot view(s) failed visual-gate scoring.`,
      captures: (visualGateReport.captures ?? [])
        .filter((capture) => capture.status === 'fail')
        .map((capture) => ({
          viewId: capture.viewId,
          blockers: capture.blockers ?? [],
          screenshotPath: capture.screenshotPath ?? null,
        })),
    });
  }
  if ((visualGateReport?.summary?.needsReviewCount ?? 0) > 0) {
    tolerances.push({
      code: 'visual_gate_needs_human_review',
      message: `${visualGateReport.summary.needsReviewCount} screenshot view(s) have no target comparison and need human review.`,
    });
  }

  const bimQuality = bimDataQualityReport ?? buildBimDataQualityReport({ ir, evidenceRun });
  if (BIM_REQUIRED_TARGETS.has(ir?.qualityTarget) && (bimQuality?.summary?.errorCount ?? 0) > 0) {
    blockers.push({
      code: 'bim_data_quality_failures',
      severity: 'error',
      message: `${bimQuality.summary.errorCount} BIM data quality check(s) failed.`,
      checks: (bimQuality.checks ?? [])
        .filter((check) => check.status === 'error')
        .map((check) => ({ id: check.id, message: check.message })),
    });
  }
  if ((bimQuality?.summary?.plannedCount ?? 0) > 0) {
    tolerances.push({
      code: 'bim_data_quality_live_checks_pending',
      message: `${bimQuality.summary.plannedCount} BIM data quality check(s) require live initiation-run evidence.`,
    });
  }

  return {
    schemaVersion: 'sketch-to-bim-acceptance-gates.v0',
    generatedAt: new Date().toISOString(),
    qualityTarget: ir?.qualityTarget ?? null,
    ok: blockers.length === 0,
    summary: {
      blockerCount: blockers.length,
      toleranceCount: tolerances.length,
      advisorWarningCount: warningCount,
      visualFailCount: visualGateReport?.summary?.failCount ?? 0,
      visualNeedsReviewCount: visualGateReport?.summary?.needsReviewCount ?? 0,
      bimDataQualityErrorCount: bimQuality?.summary?.errorCount ?? 0,
      bimDataQualityPlannedCount: bimQuality?.summary?.plannedCount ?? 0,
    },
    bimDataQuality: bimQuality,
    blockers,
    tolerances,
  };
}

function markdownTable(rows) {
  if (!rows.length) return '_None._\n';
  return rows.join('\n') + '\n';
}

export function formatStatusMarkdown(coverage, checklist, liveAdvisor = null, evidenceRun = null) {
  const lines = [];
  lines.push('# Sketch-to-BIM Initiation Check');
  lines.push('');
  lines.push(`Generated: ${coverage.generatedAt}`);
  if (coverage.modelId) lines.push(`Model: ${coverage.modelId}`);
  if (coverage.irPath) lines.push(`IR: ${coverage.irPath}`);
  if (coverage.capabilityMatrixPath) lines.push(`Capability matrix: ${coverage.capabilityMatrixPath}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Features: ${coverage.summary.featureCount} (${coverage.summary.criticalFeatureCount} critical)`);
  lines.push(`- Ready: ${coverage.summary.readyCount}`);
  lines.push(`- Needs attention: ${coverage.summary.needsAttentionCount}`);
  lines.push(`- Blocked: ${coverage.summary.blockedCount}`);
  lines.push(`- Errors: ${coverage.summary.errorCount}`);
  lines.push(`- Warnings: ${coverage.summary.warningCount}`);
  lines.push('');

  const errors = coverage.issues.filter((item) => item.severity === 'error');
  const warnings = coverage.issues.filter((item) => item.severity === 'warning');
  lines.push('## Blocking Issues');
  lines.push('');
  lines.push(markdownTable(errors.map((item) => `- \`${item.code}\` at \`${item.path}\`: ${item.message}`)).trimEnd());
  lines.push('');
  lines.push('## Warnings');
  lines.push('');
  lines.push(markdownTable(warnings.map((item) => `- \`${item.code}\` at \`${item.path}\`: ${item.message}`)).trimEnd());
  lines.push('');

  lines.push('## Feature Coverage');
  lines.push('');
  lines.push('| Feature | Kind | Priority | Readiness | Capability status |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const feature of coverage.features) {
    const capabilityStatus = feature.capabilityMatches.length
      ? feature.capabilityMatches.map((capability) => `${capability.id}:${capability.status}`).join('<br>')
      : 'missing';
    lines.push(`| ${feature.featureId} | ${feature.kind} | ${feature.visualPriority} | ${feature.readiness} | ${capabilityStatus} |`);
  }
  lines.push('');
  lines.push('## Visual Checklist');
  lines.push('');
  lines.push(`Checklist items: ${checklist.items.length}`);
  lines.push('Every item starts as `unchecked`; acceptance requires screenshot evidence and pass/fail notes.');
  lines.push('');
  lines.push('## Live Advisor');
  lines.push('');
  if (!liveAdvisor) {
    lines.push('Not captured. Run with `--live --model <id>` after the model exists.');
  } else {
    for (const severity of ['warning', 'info']) {
      const summary = liveAdvisor[severity];
      if (!summary) continue;
      lines.push(`- ${severity}: ${summary.total ?? 0} finding(s) across ${(summary.groups ?? []).length} group(s).`);
    }
  }
  lines.push('');
  lines.push('## Live Artifacts');
  lines.push('');
  if (!evidenceRun?.liveArtifacts) {
    lines.push('Not captured by this packet.');
  } else {
    for (const [label, filePath] of Object.entries(evidenceRun.liveArtifacts)) {
      lines.push(`- ${label}: \`${filePath}\``);
    }
  }
  lines.push('');
  lines.push('## Screenshots');
  lines.push('');
  if (!evidenceRun?.screenshotManifest) {
    lines.push('Not captured by this packet.');
  } else {
    const captures = evidenceRun.screenshotManifest.captures ?? [];
    lines.push(`Captured ${captures.length} screenshot(s).`);
    for (const capture of captures) {
      const fallback = capture.fallbackFit ? ' (fit fallback)' : '';
      lines.push(`- ${capture.viewId}: \`${capture.screenshotPath}\`${fallback}`);
    }
  }
  lines.push('');
  lines.push('## Visual Gate');
  lines.push('');
  if (!evidenceRun?.visualGateReport) {
    lines.push('Not scored by this packet.');
  } else {
    const summary = evidenceRun.visualGateReport.summary ?? {};
    lines.push(
      `Captured views scored: ${summary.captureCount ?? 0}; pass=${summary.passCount ?? 0}; needs_review=${summary.needsReviewCount ?? 0}; fail=${summary.failCount ?? 0}.`,
    );
    for (const capture of evidenceRun.visualGateReport.captures ?? []) {
      const similarity = capture.comparison
        ? ` similarity=${capture.comparison.visualSimilarity.toFixed(3)}`
        : '';
      const blockers = capture.blockers?.length ? ` blockers=${capture.blockers.join(',')}` : '';
      lines.push(`- ${capture.viewId}: ${capture.status}${similarity}${blockers}`);
    }
  }
  lines.push('');
  lines.push('## Capability Gaps');
  lines.push('');
  if (!evidenceRun?.capabilityGaps || evidenceRun.capabilityGaps.taskCount === 0) {
    lines.push('No blocked critical capability gaps were generated.');
  } else {
    lines.push(`Generated ${evidenceRun.capabilityGaps.taskCount} capability-gap task(s).`);
    for (const task of evidenceRun.capabilityGaps.tasks) {
      lines.push(`- ${task.id}: ${task.featureKind} (${task.readiness})`);
    }
  }
  lines.push('');
  lines.push('## BIM Data Quality');
  lines.push('');
  if (!evidenceRun?.bimDataQualityReport) {
    lines.push('Not evaluated by this packet.');
  } else {
    const report = evidenceRun.bimDataQualityReport;
    lines.push(
      `Result: ${report.ok ? 'pass' : 'blocked'} (${report.summary.errorCount} error(s), ${report.summary.warningCount} warning(s), ${report.summary.plannedCount} planned live check(s)).`,
    );
    for (const check of report.checks ?? []) {
      if (!['error', 'warning', 'planned'].includes(check.status)) continue;
      lines.push(`- \`${check.status}\` \`${check.id}\`: ${check.message}`);
    }
  }
  lines.push('');
  lines.push('## Acceptance Gates');
  lines.push('');
  if (!evidenceRun?.acceptanceGateReport) {
    lines.push('Not evaluated by this packet.');
  } else {
    const report = evidenceRun.acceptanceGateReport;
    lines.push(`Result: ${report.ok ? 'pass' : 'blocked'} (${report.summary.blockerCount} blocker(s), ${report.summary.toleranceCount} tolerance(s)).`);
    for (const blocker of report.blockers ?? []) {
      lines.push(`- \`${blocker.code}\`: ${blocker.message}`);
    }
    for (const tolerance of report.tolerances ?? []) {
      lines.push(`- tolerance \`${tolerance.code}\`: ${tolerance.message}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export async function writeInitiationPacket({
  ir,
  matrix,
  outDir,
  irPath = null,
  capabilityMatrixPath = null,
  modelId = null,
  liveAdvisor = null,
  screenshotManifest = null,
  visualGateReport = null,
  evidenceRun = null,
}) {
  const coverage = buildCapabilityCoverage(ir, matrix, { irPath, capabilityMatrixPath, modelId });
  const capabilityGaps = buildCapabilityGapTasks(coverage);
  const screenshotChecklist = screenshotManifest
    ? applyScreenshotManifestToChecklist(buildVisualChecklist(ir, coverage), screenshotManifest)
    : buildVisualChecklist(ir, coverage);
  const checklist = visualGateReport
    ? applyVisualGateToChecklist(screenshotChecklist, visualGateReport)
    : screenshotChecklist;
  const bimDataQualityReport = buildBimDataQualityReport({ ir, evidenceRun });
  const acceptanceGateReport = buildAcceptanceGateReport({
    ir,
    coverage,
    liveAdvisor,
    screenshotManifest,
    visualGateReport,
    evidenceRun,
    bimDataQualityReport,
  });
  await fs.mkdir(outDir, { recursive: true });

  const files = {
    ir: path.join(outDir, 'sketch-ir.json'),
    coverage: path.join(outDir, 'capability-coverage.json'),
    checklist: path.join(outDir, 'visual-checklist.json'),
    bimDataQuality: path.join(outDir, 'bim-data-quality.json'),
    status: path.join(outDir, 'status.md'),
  };
  await fs.writeFile(files.ir, `${JSON.stringify(ir, null, 2)}\n`, 'utf8');
  await fs.writeFile(files.coverage, `${JSON.stringify(coverage, null, 2)}\n`, 'utf8');
  await fs.writeFile(files.checklist, `${JSON.stringify(checklist, null, 2)}\n`, 'utf8');
  await fs.writeFile(files.bimDataQuality, `${JSON.stringify(bimDataQualityReport, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    files.status,
    formatStatusMarkdown(
      coverage,
      checklist,
      liveAdvisor,
      { ...(evidenceRun ?? {}), capabilityGaps, visualGateReport, acceptanceGateReport, bimDataQualityReport },
    ),
    'utf8',
  );
  if (liveAdvisor) {
    files.liveAdvisor = path.join(outDir, 'live-advisor.json');
    await fs.writeFile(files.liveAdvisor, `${JSON.stringify(liveAdvisor, null, 2)}\n`, 'utf8');
  }
  if (screenshotManifest) {
    files.screenshotManifest = path.join(outDir, 'screenshot-manifest.json');
    await fs.writeFile(files.screenshotManifest, `${JSON.stringify(screenshotManifest, null, 2)}\n`, 'utf8');
  }
  if (visualGateReport) {
    files.visualGate = path.join(outDir, 'visual-gate.json');
    await fs.writeFile(files.visualGate, `${JSON.stringify(visualGateReport, null, 2)}\n`, 'utf8');
  }
  files.acceptanceGates = path.join(outDir, 'acceptance-gates.json');
  await fs.writeFile(files.acceptanceGates, `${JSON.stringify(acceptanceGateReport, null, 2)}\n`, 'utf8');
  if (capabilityGaps.taskCount > 0) {
    files.capabilityGaps = path.join(outDir, 'capability-gaps.json');
    await fs.writeFile(files.capabilityGaps, `${JSON.stringify(capabilityGaps, null, 2)}\n`, 'utf8');
  }

  return {
    ok: coverage.summary.errorCount === 0,
    outDir,
    files,
    summary: coverage.summary,
    acceptance: acceptanceGateReport,
  };
}
