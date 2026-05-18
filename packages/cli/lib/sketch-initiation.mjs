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
    description:
      'Usable seed model with rooms, access, advisor feedback, screenshots, and evidence packet.',
    requireProgramme: true,
    requireDiagnosticView: true,
    failOnAdvisorWarning: true,
    minRequiredViews: 3,
  },
  documentation_ready: {
    label: 'Documentation ready',
    description:
      'Project-initiation BIM plus plans/sheets/schedules that can be handed off directly.',
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
const REQUIRED_EXPORT_OUTPUTS = [
  'IFC',
  'GLB',
  'PDF',
  'schedules',
  'evidence-package',
  'source-bundle',
];
const REQUIRED_STRUCTURE_LITE_SECTIONS = [
  'loadBearingFlags',
  'primarySupportAssumptions',
  'supportElementPlaceholders',
  'openingCoordination',
  'loadPathNotes',
];
const REQUIRED_MEP_LITE_SECTIONS = [
  'wetRoomStacking',
  'verticalShaftsOrRisers',
  'equipmentZones',
  'routePlaceholders',
  'serviceLevels',
  'openingRequests',
];
const REQUIRED_PLANNING_SITE_FIELDS = [
  'orientationAssumption',
  'basePointAssumption',
  'surveyPointAssumption',
  'propertyLineSetbackAvailability',
  'sunAssumptions',
  'codeLocale',
];
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
const OPEN_FINDING_DISPOSITIONS = new Set(['later-phase', 'tolerated', 'blocked']);
const BLOCKING_FINDING_DISPOSITIONS = new Set(['', 'unclassified', 'fix-now', 'fix-in-phase']);
const SEMANTIC_VISUAL_PASS_STATUSES = new Set(['pass', 'passed', 'ok', 'verified']);
const SEMANTIC_VISUAL_FAIL_STATUSES = new Set(['fail', 'failed', 'blocked']);
const SEMANTIC_VISUAL_REVIEW_STATUSES = new Set([
  '',
  'unchecked',
  'needs_review',
  'review',
  'pending',
]);

const SEMANTIC_VISUAL_FEATURE_TEMPLATES = [
  {
    match: /roof.*(opening|terrace|cutout)|terrace.*roof/i,
    checks: [
      ['roof_cutout_present', 'Roof opening is a visible cutout, not metadata-only roof intent.'],
      ['terrace_floor_visible', 'Occupied terrace floor is visible inside the roof void.'],
      [
        'roof_returns_and_guard_present',
        'Roof return faces, guard rail, and access opening are visible.',
      ],
    ],
  },
  {
    match: /(folded|wrapper|shell)/i,
    checks: [
      ['wrapper_shell_thickness_visible', 'Folded wrapper has visible shell/fascia thickness.'],
      ['wrapper_returns_visible', 'Wrapper return faces close the roof/wall edges.'],
      [
        'wrapper_not_mass_placeholder',
        'Wrapper reads as BIM envelope elements, not a final mass placeholder.',
      ],
    ],
  },
  {
    match: /loggia|recess/i,
    checks: [
      ['loggia_recess_present', 'Loggia facade is recessed behind the outer facade plane.'],
      ['loggia_side_returns_visible', 'Loggia side returns and balcony/occupied slab are visible.'],
      ['loggia_guard_and_access_present', 'Loggia guard and access openings are visible.'],
    ],
  },
  {
    match: /cladding|facade_bay|bay_rhythm|opening.*rhythm/i,
    checks: [
      [
        'cladding_or_bay_rhythm_present',
        'Facade/cladding or bay rhythm is visibly repeated as specified.',
      ],
      [
        'rhythm_respects_openings',
        'Facade rhythm respects openings and does not run through voids.',
      ],
    ],
  },
  {
    match: /room|programme|program|access|enclosure|floor_plan|topology/i,
    checks: [
      ['room_topology_present', 'Plan shows room topology matching the programme intent.'],
      [
        'rooms_bounded_and_accessible',
        'Rooms are bounded and have plausible door/access connections.',
      ],
      [
        'stair_and_slab_openings_coordinated',
        'Stair and slab openings align in plan/diagnostic evidence.',
      ],
    ],
  },
  {
    match: /diagnostic|documentation_views|evidence/i,
    checks: [
      [
        'diagnostic_evidence_present',
        'Diagnostic evidence exposes seams, room boundaries, and hidden overlaps.',
      ],
      [
        'diagnostic_no_hidden_overlaps',
        'Diagnostic view shows no hidden overlaps, z-fighting, or uncut seams.',
      ],
    ],
  },
];

const SEMANTIC_VISUAL_GLOBAL_TEMPLATES = {
  'global:silhouette': [
    ['sketch_silhouette_match', 'Required 3D views match the source sketch silhouette.'],
  ],
  'global:advisor': [
    [
      'advisor_findings_dispositioned',
      'Advisor warning/error findings are fixed or dispositioned.',
    ],
  ],
  'global:interior': [
    [
      'room_topology_present',
      'Interior plans show room topology, doors, stairs, and slab openings.',
    ],
  ],
  'global:artifacts': [
    [
      'diagnostic_no_hidden_overlaps',
      'No gaps, z-fighting, uncut walls, false masses, or material artifacts remain.',
    ],
  ],
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issue(severity, code, pathValue, message) {
  return { severity, code, path: pathValue, message };
}

function requireString(issues, obj, key, pathValue) {
  if (typeof obj?.[key] !== 'string' || obj[key].trim() === '') {
    issues.push(
      issue('error', 'missing_string', `${pathValue}.${key}`, `${key} must be a non-empty string.`),
    );
  }
}

function requireBoolean(issues, obj, key, pathValue) {
  if (typeof obj?.[key] !== 'boolean') {
    issues.push(
      issue('error', 'missing_boolean', `${pathValue}.${key}`, `${key} must be a boolean.`),
    );
  }
}

function requirePositiveNumber(issues, obj, key, pathValue) {
  if (!Number.isFinite(obj?.[key]) || obj[key] <= 0) {
    issues.push(
      issue(
        'error',
        'missing_positive_number',
        `${pathValue}.${key}`,
        `${key} must be a positive number.`,
      ),
    );
  }
}

function requireArray(issues, obj, key, pathValue, { min = 0 } = {}) {
  if (!Array.isArray(obj?.[key])) {
    issues.push(issue('error', 'missing_array', `${pathValue}.${key}`, `${key} must be an array.`));
    return [];
  }
  if (obj[key].length < min) {
    issues.push(
      issue(
        'error',
        'array_too_short',
        `${pathValue}.${key}`,
        `${key} must contain at least ${min} item(s).`,
      ),
    );
  }
  return obj[key];
}

function requireObjectSection(issues, obj, key, pathValue, severity = 'error') {
  if (!isObject(obj?.[key])) {
    issues.push(
      issue(severity, 'missing_object', `${pathValue}.${key}`, `${key} must be an object.`),
    );
    return null;
  }
  return obj[key];
}

function requireSectionArray(issues, obj, key, pathValue, severity = 'error') {
  if (!Array.isArray(obj?.[key]) || obj[key].length === 0) {
    issues.push(
      issue(
        severity,
        'readiness_section_missing',
        `${pathValue}.${key}`,
        `${key} must contain at least one project-initiation readiness item.`,
      ),
    );
    return [];
  }
  return obj[key];
}

function normalizeExportOutput(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function hasExportOutput(outputs, requiredOutput) {
  const normalized = new Set(outputs.map(normalizeExportOutput));
  const required = normalizeExportOutput(requiredOutput);
  if (required === 'glb') return normalized.has('glb') || normalized.has('gltf');
  if (required === 'pdf')
    return normalized.has('pdf') || normalized.has('pdf/sheets') || normalized.has('sheets');
  return normalized.has(required);
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
    issues.push(
      issue(
        severity,
        'bim_information_requirements_missing',
        '$.informationRequirements',
        `${mode?.label ?? target} requires informationRequirements with LOI/LOD, rooms, element semantics, material layer sets, classifications, schedules, and data checks.`,
      ),
    );
    return issues;
  }

  requireString(issues, requirements, 'qualityTarget', '$.informationRequirements');
  if (
    typeof requirements.qualityTarget === 'string' &&
    typeof target === 'string' &&
    requirements.qualityTarget !== target
  ) {
    issues.push(
      issue(
        severity,
        'bim_quality_target_mismatch',
        '$.informationRequirements.qualityTarget',
        'informationRequirements.qualityTarget must match the root qualityTarget.',
      ),
    );
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
      issues.push(
        issue('error', 'invalid_room_requirement', p, 'Room requirement must be an object.'),
      );
      return;
    }
    for (const key of ['name', 'number', 'level', 'function', 'occupancyUse', 'boundingStatus']) {
      requireString(issues, room, key, p);
    }
    requirePositiveNumber(issues, room, 'targetAreaM2', p);
    if (!isObject(room.access)) {
      issues.push(
        issue(
          'error',
          'missing_object',
          `${p}.access`,
          'Room access requirements must be an object.',
        ),
      );
    } else {
      const requiredDoors = Number.isFinite(room.access.requiredDoors)
        ? room.access.requiredDoors
        : 0;
      const doorRefs = Array.isArray(room.access.doorRefs) ? room.access.doorRefs : [];
      if (requiredDoors <= 0 && doorRefs.length === 0) {
        issues.push(
          issue(
            'error',
            'room_access_missing',
            `${p}.access`,
            'Room access must require at least one door or list explicit doorRefs.',
          ),
        );
      }
    }
    if (!isObject(room.schedule)) {
      issues.push(
        issue(
          'error',
          'missing_object',
          `${p}.schedule`,
          'Room schedule intent must be an object.',
        ),
      );
    } else {
      requireBoolean(issues, room.schedule, 'include', `${p}.schedule`);
      if (room.schedule.include !== true) {
        issues.push(
          issue(
            'error',
            'room_schedule_not_included',
            `${p}.schedule.include`,
            'Rooms must be included in a schedule for project initiation BIM.',
          ),
        );
      }
    }
    if (!isObject(room.classification)) {
      issues.push(
        issue(
          'error',
          'missing_object',
          `${p}.classification`,
          'Room classification placeholders must be an object.',
        ),
      );
    } else {
      for (const key of ['din277Use', 'din277AreaType', 'ifcEntityIntent']) {
        requireString(issues, room.classification, key, `${p}.classification`);
      }
      if (
        typeof room.classification.ifcEntityIntent === 'string' &&
        room.classification.ifcEntityIntent !== 'IfcSpace'
      ) {
        issues.push(
          issue(
            'error',
            'room_ifc_entity_intent',
            `${p}.classification.ifcEntityIntent`,
            'Rooms must declare IfcSpace entity intent.',
          ),
        );
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
      issues.push(
        issue(
          'error',
          'invalid_element_semantic_requirement',
          p,
          'Element semantic requirement must be an object.',
        ),
      );
      return;
    }
    for (const key of ['category', 'expectedBimCategory', 'ifcEntityIntent']) {
      requireString(issues, row, key, p);
    }
    if (typeof row.category === 'string') semanticCategories.add(row.category);
    if (typeof row.ifcEntityIntent === 'string' && !IFC_ENTITY_INTENT.has(row.ifcEntityIntent)) {
      issues.push(
        issue(
          'error',
          'unknown_ifc_entity_intent',
          `${p}.ifcEntityIntent`,
          `ifcEntityIntent should be one of ${[...IFC_ENTITY_INTENT].join(', ')}.`,
        ),
      );
    }
    if (!isObject(row.classification)) {
      issues.push(
        issue(
          'error',
          'missing_object',
          `${p}.classification`,
          'Element classification placeholders must be an object.',
        ),
      );
    } else {
      requireString(issues, row.classification, 'din276CostGroup', `${p}.classification`);
      requireString(issues, row.classification, 'ifcClassificationRef', `${p}.classification`);
    }
  });
  for (const category of REQUIRED_ELEMENT_SEMANTIC_CATEGORIES) {
    if (!semanticCategories.has(category)) {
      issues.push(
        issue(
          severity,
          'element_semantic_category_missing',
          '$.informationRequirements.elementSemanticRequirements',
          `Missing semantic requirement for ${category}.`,
        ),
      );
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
      issues.push(
        issue(
          'error',
          'invalid_material_layer_set_requirement',
          p,
          'Material layer-set requirement must be an object.',
        ),
      );
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
        issues.push(
          issue('error', 'invalid_material_layer', layerPath, 'Layer must be an object.'),
        );
        return;
      }
      for (const key of ['function', 'materialKey']) requireString(issues, layer, key, layerPath);
      requirePositiveNumber(issues, layer, 'thicknessMm', layerPath);
    });
    if (!isObject(row.performancePlaceholders)) {
      issues.push(
        issue(
          'error',
          'material_performance_placeholders_missing',
          `${p}.performancePlaceholders`,
          'Layer sets must include thermal/fire/acoustic placeholder intent.',
        ),
      );
    } else {
      for (const key of ['thermal', 'fire', 'acoustic']) {
        requireString(issues, row.performancePlaceholders, key, `${p}.performancePlaceholders`);
      }
    }
  });
  for (const category of REQUIRED_LAYER_SET_CATEGORIES) {
    if (!layerSetCategories.has(category)) {
      issues.push(
        issue(
          severity,
          'material_layer_set_category_missing',
          '$.informationRequirements.materialLayerSetRequirements',
          `Missing material/layer-set requirement for ${category}.`,
        ),
      );
    }
  }

  if (!isObject(requirements.classificationRequirements)) {
    issues.push(
      issue(
        severity,
        'classification_requirements_missing',
        '$.informationRequirements.classificationRequirements',
        'Classification requirements must include DIN277 room placeholders, DIN276 element placeholders, and planned IFC classification references.',
      ),
    );
  } else {
    const classificationPath = '$.informationRequirements.classificationRequirements';
    for (const key of ['roomSystem', 'elementSystem', 'ifcClassificationReferences']) {
      requireString(issues, requirements.classificationRequirements, key, classificationPath);
    }
    requireArray(
      issues,
      requirements.classificationRequirements,
      'requiredPlaceholders',
      classificationPath,
      { min: 1 },
    );
  }

  const structurePath = '$.informationRequirements.structureLiteRequirements';
  if (BIM_REQUIRED_TARGETS.has(target) || isObject(requirements.structureLiteRequirements)) {
    const structure = requireObjectSection(
      issues,
      requirements,
      'structureLiteRequirements',
      '$.informationRequirements',
      severity,
    );
    if (structure) {
      for (const key of REQUIRED_STRUCTURE_LITE_SECTIONS) {
        requireSectionArray(issues, structure, key, structurePath, severity);
      }
    }
  }

  const mepPath = '$.informationRequirements.mepLiteRequirements';
  if (BIM_REQUIRED_TARGETS.has(target) || isObject(requirements.mepLiteRequirements)) {
    const mep = requireObjectSection(
      issues,
      requirements,
      'mepLiteRequirements',
      '$.informationRequirements',
      severity,
    );
    if (mep) {
      for (const key of REQUIRED_MEP_LITE_SECTIONS) {
        requireSectionArray(issues, mep, key, mepPath, severity);
      }
    }
  }

  const sitePath = '$.informationRequirements.planningSiteRequirements';
  if (BIM_REQUIRED_TARGETS.has(target) || isObject(requirements.planningSiteRequirements)) {
    const site = requireObjectSection(
      issues,
      requirements,
      'planningSiteRequirements',
      '$.informationRequirements',
      severity,
    );
    if (site) {
      for (const key of REQUIRED_PLANNING_SITE_FIELDS) {
        requireString(issues, site, key, sitePath);
      }
    }
  }

  requireArray(issues, requirements, 'schedules', '$.informationRequirements', {
    min: BIM_REQUIRED_TARGETS.has(target) ? 1 : 0,
  });

  if (!isObject(requirements.exportRequirements)) {
    issues.push(
      issue(
        severity,
        'export_requirements_missing',
        '$.informationRequirements.exportRequirements',
        'Export requirements must declare IFC, GLB/glTF, PDF/sheets, schedules, evidence package, and source bundle outputs.',
      ),
    );
  } else {
    const exportOutputs = requireArray(
      issues,
      requirements.exportRequirements,
      'outputs',
      '$.informationRequirements.exportRequirements',
      {
        min: BIM_REQUIRED_TARGETS.has(target) ? 1 : 0,
      },
    );
    const missingOutputs = REQUIRED_EXPORT_OUTPUTS.filter(
      (output) => !hasExportOutput(exportOutputs, output),
    );
    if (missingOutputs.length) {
      issues.push(
        issue(
          severity,
          'export_outputs_missing',
          '$.informationRequirements.exportRequirements.outputs',
          `Missing required exchange output(s): ${missingOutputs.join(', ')}.`,
        ),
      );
    }
  }

  const passportPath = '$.informationRequirements.sustainabilityMaterialPassportRequirements';
  if (
    BIM_REQUIRED_TARGETS.has(target) ||
    isObject(requirements.sustainabilityMaterialPassportRequirements)
  ) {
    const passports = requireObjectSection(
      issues,
      requirements,
      'sustainabilityMaterialPassportRequirements',
      '$.informationRequirements',
      severity,
    );
    if (passports) {
      const passportMaterials = requireArray(issues, passports, 'materials', passportPath, {
        min: BIM_REQUIRED_TARGETS.has(target) ? 1 : 0,
      });
      const passportKeys = new Set();
      passportMaterials.forEach((entry, index) => {
        const p = `${passportPath}.materials[${index}]`;
        if (!isObject(entry)) {
          issues.push(
            issue(
              'error',
              'invalid_material_passport',
              p,
              'Material passport entry must be an object.',
            ),
          );
          return;
        }
        for (const key of [
          'materialKey',
          'epdSource',
          'sourceConfidence',
          'embodiedCarbonPlaceholder',
          'reuseNotes',
          'recyclabilityNotes',
          'quantitySource',
        ]) {
          requireString(issues, entry, key, p);
        }
        if (typeof entry.materialKey === 'string') passportKeys.add(entry.materialKey);
      });
      const layerMaterialKeys = uniqueStrings(
        layerSets.flatMap((row) =>
          Array.isArray(row?.layers) ? row.layers.map((layer) => layer?.materialKey) : [],
        ),
      );
      const missingPassports = layerMaterialKeys.filter(
        (materialKey) => !passportKeys.has(materialKey),
      );
      if (missingPassports.length) {
        issues.push(
          issue(
            severity,
            'material_passport_entries_missing',
            `${passportPath}.materials`,
            `Missing material passport starter data for materialKey(s): ${missingPassports.join(', ')}.`,
          ),
        );
      }
    }
  }

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
    issues.push(
      issue('error', 'schema_version', '$.schemaVersion', 'Expected sketch-understanding-ir.v0.'),
    );
  }
  requireString(issues, ir, 'projectType', '$');
  requireString(issues, ir, 'qualityTarget', '$');
  const mode = INITIATION_MODES[ir.qualityTarget];
  if (typeof ir.qualityTarget === 'string' && !mode) {
    issues.push(
      issue(
        'error',
        'invalid_quality_target',
        '$.qualityTarget',
        `qualityTarget must be one of ${Object.keys(INITIATION_MODES).join(', ')}.`,
      ),
    );
  }

  if (!isObject(ir.sourceInputs)) {
    issues.push(
      issue('error', 'missing_object', '$.sourceInputs', 'sourceInputs must be an object.'),
    );
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
      issues.push(
        issue(
          'error',
          'invalid_priority',
          `${p}.visualPriority`,
          'visualPriority must be critical, high, medium, or low.',
        ),
      );
    }
    requireArray(issues, feature, 'mustRenderInViews', p, { min: 1 });
    if (feature.visualPriority === 'critical') {
      const needs = Array.isArray(feature.capabilityNeeds) ? feature.capabilityNeeds : [];
      if (needs.length === 0) {
        issues.push(
          issue(
            'warning',
            'critical_feature_needs_missing',
            `${p}.capabilityNeeds`,
            'Critical features should list capabilityNeeds so the authoring route is explicit.',
          ),
        );
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
      issues.push(
        issue(
          'warning',
          'assumption_validation_missing',
          `${p}.validation`,
          'Assumption has no validation route.',
        ),
      );
    }
  });

  if (!Array.isArray(ir.programme) || ir.programme.length === 0) {
    issues.push(
      issue(
        mode?.requireProgramme ? 'error' : 'warning',
        'programme_missing',
        '$.programme',
        'No programme entries were supplied; room and usability checks will be weaker.',
      ),
    );
  }

  if (mode?.requireDiagnosticView && Array.isArray(ir.requiredViews)) {
    const hasDiagnostic = ir.requiredViews.some((view) =>
      ['diagnostic', 'plan', 'floor_plan', 'section'].includes(view?.kind),
    );
    if (!hasDiagnostic) {
      issues.push(
        issue(
          ir.qualityTarget === 'documentation_ready' ? 'error' : 'warning',
          'diagnostic_view_missing',
          '$.requiredViews',
          `${mode.label} should include a diagnostic/plan/section view so topology defects are visible.`,
        ),
      );
    }
  }

  issues.push(...validateBimInformationRequirements(ir, mode));

  return issues;
}

export function validateCapabilityMatrix(matrix) {
  const issues = [];
  if (!isObject(matrix)) {
    return [
      issue('error', 'invalid_capability_matrix', '$', 'Capability matrix must be a JSON object.'),
    ];
  }
  if (matrix.schemaVersion !== 'sketch-to-bim-capability-matrix.v0') {
    issues.push(
      issue(
        'error',
        'capability_schema_version',
        '$.schemaVersion',
        'Expected sketch-to-bim-capability-matrix.v0.',
      ),
    );
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
      issues.push(
        issue(
          'error',
          'invalid_capability_status',
          `${p}.status`,
          'Capability status must be supported, partial, or gap.',
        ),
      );
    }
    for (const key of [
      'commandSurface',
      'rendererSurface',
      'advisorCoverage',
      'knownFailureModes',
      'requiredEvidence',
    ]) {
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
  if (matches.length === 0)
    return feature.visualPriority === 'critical' ? 'blocked' : 'needs_attention';
  if (
    feature.visualPriority === 'critical' &&
    matches.every((capability) => capability.status === 'gap')
  ) {
    return 'blocked';
  }
  if (missingViews.length && feature.visualPriority === 'critical') return 'blocked';
  if (
    matches.some((capability) => capability.status === 'partial' || capability.status === 'gap')
  ) {
    return 'needs_attention';
  }
  if (missingViews.length) return 'needs_attention';
  return 'ready';
}

export function buildCapabilityCoverage(ir, matrix, options = {}) {
  const issues = [...validateSketchIr(ir), ...validateCapabilityMatrix(matrix)];
  const viewIds = new Set((ir.requiredViews ?? []).map((view) => view?.id).filter(Boolean));
  const features = Array.isArray(ir.features) ? ir.features : [];
  const index = capabilityIndex(matrix);
  const rows = [];

  for (const feature of features) {
    if (!isObject(feature)) continue;
    const matches = index.get(feature.kind) ?? [];
    const mustRenderInViews = Array.isArray(feature.mustRenderInViews)
      ? feature.mustRenderInViews
      : [];
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
    } else if (
      feature.visualPriority === 'critical' &&
      matches.every((capability) => capability.status === 'gap')
    ) {
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
    const gapIssues = (coverage.issues ?? []).filter(
      (item) =>
        ['capability_missing', 'critical_capability_gap', 'feature_view_missing'].includes(
          item.code,
        ) && String(item.path ?? '').includes(feature.featureId),
    );
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

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
}

function arrayStrings(value) {
  if (Array.isArray(value)) return uniqueStrings(value.map((item) => String(item)));
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
  return [];
}

export function buildToleranceLedgerFromDispositions(
  payload,
  { phaseId = null, evidenceDir = null } = {},
) {
  const findings = Array.isArray(payload?.findings) ? payload.findings : [];
  const rows = [];
  const blockingFindings = [];
  const incompleteTolerances = [];

  for (const [index, finding] of findings.entries()) {
    if (!isObject(finding)) continue;
    const severity = String(finding.severity ?? 'unknown');
    if (!['error', 'warning'].includes(severity)) continue;
    const disposition = String(finding.disposition ?? 'unclassified');
    if (BLOCKING_FINDING_DISPOSITIONS.has(disposition)) {
      blockingFindings.push({
        index,
        severity,
        code: finding.code ?? 'unknown',
        disposition,
        message:
          'Current-phase warning/error finding is not closed, deferred, tolerated, blocked, fixed, or reviewed.',
      });
      continue;
    }
    if (!OPEN_FINDING_DISPOSITIONS.has(disposition)) continue;

    const affectedFeatureIds = uniqueStrings([
      ...arrayStrings(finding.affectedFeatureIds),
      ...arrayStrings(finding.featureIds),
      ...arrayStrings(finding.featureId),
      ...arrayStrings(finding.affectedFeature),
    ]);
    const affectedElementIds = uniqueStrings([
      ...arrayStrings(finding.affectedElementIds),
      ...arrayStrings(finding.elementIds),
      ...arrayStrings(finding.elements),
    ]);
    const evidenceLinks = uniqueStrings([
      ...arrayStrings(finding.evidenceLinks),
      ...arrayStrings(finding.evidenceLink),
      ...arrayStrings(finding.toleranceEvidence),
    ]);
    const row = {
      id: firstString(
        finding.id,
        `${finding.source ?? 'finding'}:${finding.code ?? 'unknown'}:${index}`,
      ),
      source: finding.source ?? 'unknown',
      severity,
      code: finding.code ?? 'unknown',
      disposition,
      affectedFeatureIds,
      affectedElementIds,
      reason: firstString(finding.reason, finding.phaseRationale, finding.toleranceReason),
      owner: firstString(finding.owner),
      expiryCondition: firstString(finding.expiryCondition, finding.expiresWhen),
      evidenceLinks,
    };
    const missing = [];
    if (!row.severity) missing.push('severity');
    if (!row.affectedFeatureIds.length) missing.push('affectedFeatureIds');
    if (!row.reason) missing.push('reason');
    if (!row.owner) missing.push('owner');
    if (!row.expiryCondition) missing.push('expiryCondition');
    if (!row.evidenceLinks.length) missing.push('evidenceLinks');
    if (missing.length) {
      incompleteTolerances.push({
        id: row.id,
        severity,
        code: row.code,
        disposition,
        missing,
      });
    }
    rows.push(row);
  }

  return {
    schemaVersion: 'sketch.tolerance-ledger.v1',
    generatedAt: new Date().toISOString(),
    phaseId: phaseId ?? payload?.phaseId ?? null,
    modelId: payload?.modelId ?? null,
    revision: payload?.revision ?? null,
    evidenceDir,
    ok: blockingFindings.length === 0 && incompleteTolerances.length === 0,
    summary: {
      findingCount: findings.length,
      toleranceCount: rows.length,
      blockingFindingCount: blockingFindings.length,
      incompleteToleranceCount: incompleteTolerances.length,
    },
    requiredFields: [
      'severity',
      'affectedFeatureIds',
      'reason',
      'owner',
      'expiryCondition',
      'evidenceLinks',
    ],
    tolerances: rows,
    blockingFindings,
    incompleteTolerances,
  };
}

function countSnapshotKinds(modelStats, kinds) {
  return snapshotKindCount(modelStats, kinds);
}

function exchangeCheck(id, status, message, detail = {}) {
  return { id, status, message, ...detail };
}

function normalizedIfcKindCounts(ifcManifest, modelStats) {
  const body = ifcManifest?.body ?? ifcManifest ?? {};
  const raw =
    body.exportedIfcKindsInArtifact ??
    body.countsByIfcKind ??
    body.countsByKind ??
    body.extensions?.BIM_AI_exportManifest_v0?.countsByIfcKind ??
    {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    out[String(key)] = Number(value) || 0;
  }
  if (Object.keys(out).length > 0 || !modelStats) return out;
  const kindMap = {
    IfcSpace: ['room', 'space'],
    IfcWall: ['wall'],
    IfcWallStandardCase: ['wall'],
    IfcSlab: ['floor', 'slab'],
    IfcRoof: ['roof'],
    IfcStair: ['stair'],
    IfcDoor: ['door'],
    IfcWindow: ['window'],
    IfcRailing: ['railing'],
    IfcFurnishingElement: ['asset', 'furniture', 'family_instance', 'placed_asset'],
    IfcBuildingElementProxy: ['mass', 'proxy'],
  };
  for (const [ifcKind, kinds] of Object.entries(kindMap)) {
    const count = countSnapshotKinds(modelStats, kinds);
    if (count > 0) out[ifcKind] = count;
  }
  return out;
}

export function buildExchangeValidationReport({
  ir,
  modelStats = null,
  validate = null,
  evidencePackage = null,
  ifcManifest = null,
  gltfManifest = null,
} = {}) {
  const requirements = isObject(ir?.informationRequirements) ? ir.informationRequirements : {};
  const requirementsPresent = isObject(ir?.informationRequirements);
  const required = BIM_REQUIRED_TARGETS.has(ir?.qualityTarget);
  const exportOutputs = Array.isArray(requirements?.exportRequirements?.outputs)
    ? requirements.exportRequirements.outputs.map((item) => String(item).toLowerCase())
    : [];
  const ifcRequired = exportOutputs.includes('ifc');
  const checks = [];
  const ifcAvailable = Boolean(ifcManifest?.ok);
  const gltfAvailable = Boolean(gltfManifest?.ok);
  const ifcCounts = normalizedIfcKindCounts(ifcManifest, modelStats);
  const hasIfcGeometry = Object.values(ifcCounts).some((count) => Number(count) > 0);

  checks.push(
    exchangeCheck(
      'ifc_manifest_available',
      ifcAvailable ? 'pass' : ifcRequired ? 'warning' : 'planned',
      ifcAvailable
        ? 'IFC export manifest endpoint returned a manifest.'
        : ifcRequired
          ? 'IFC is required but no IFC export manifest was available; normalized snapshot checks were used.'
          : 'IFC export manifest is not required by this IR.',
      { status: ifcManifest?.status ?? null },
    ),
  );
  checks.push(
    exchangeCheck(
      'gltf_manifest_available',
      gltfAvailable
        ? 'pass'
        : exportOutputs.includes('glb') || exportOutputs.includes('gltf')
          ? 'warning'
          : 'planned',
      gltfAvailable
        ? 'glTF/GLB export manifest endpoint returned a manifest.'
        : 'glTF/GLB manifest was not available for this run.',
      { status: gltfManifest?.status ?? null },
    ),
  );
  checks.push(
    exchangeCheck(
      'project_hierarchy',
      modelStats?.modelId || ifcManifest?.body?.projectHierarchy || ifcManifest?.body?.ifcProject
        ? 'pass'
        : 'error',
      'Project/model hierarchy is represented in the normalized exchange manifest.',
      { modelId: modelStats?.modelId ?? null, revision: modelStats?.revision ?? null },
    ),
  );

  const semanticRows = Array.isArray(requirements?.elementSemanticRequirements)
    ? requirements.elementSemanticRequirements
    : [];
  const expectedEntities = uniqueStrings(
    semanticRows
      .map((row) => row?.ifcEntityIntent)
      .filter((entity) => IFC_ENTITY_INTENT.has(entity)),
  );
  const missingEntities = expectedEntities.filter((entity) => (ifcCounts[entity] ?? 0) <= 0);
  checks.push(
    exchangeCheck(
      'entity_classes',
      missingEntities.length ? 'error' : 'pass',
      missingEntities.length
        ? `Missing expected IFC entity class(es): ${missingEntities.join(', ')}.`
        : 'Expected IFC entity classes are present in the normalized exchange manifest.',
      {
        expectedEntities,
        countsByIfcEntity: ifcCounts,
        source: hasIfcGeometry ? 'ifc_manifest' : 'snapshot_normalized',
      },
    ),
  );

  const roomRequirements = Array.isArray(requirements?.rooms) ? requirements.rooms : [];
  const spaceCount = (ifcCounts.IfcSpace ?? 0) + countSnapshotKinds(modelStats, ['room', 'space']);
  checks.push(
    exchangeCheck(
      'spaces',
      spaceCount >= roomRequirements.length ? 'pass' : 'error',
      `Normalized exchange manifest has ${spaceCount} space/room representation(s); IR requires ${roomRequirements.length}.`,
      { actual: spaceCount, expected: roomRequirements.length },
    ),
  );

  const layerSets = Array.isArray(requirements?.materialLayerSetRequirements)
    ? requirements.materialLayerSetRequirements
    : [];
  const typeCount = countSnapshotKinds(modelStats, ['wall_type', 'floor_type', 'roof_type']);
  checks.push(
    exchangeCheck(
      'material_layers',
      layerSets.length > 0 && (typeCount > 0 || ifcAvailable)
        ? 'pass'
        : requirementsPresent
          ? required
            ? 'error'
            : 'warning'
          : 'planned',
      layerSets.length > 0
        ? 'Material layer-set intent is present for normalized exchange validation.'
        : 'No material layer-set requirements are available for exchange validation.',
      { requiredLayerSetCount: layerSets.length, modelTypeCount: typeCount },
    ),
  );

  const classifications = requirements?.classificationRequirements;
  checks.push(
    exchangeCheck(
      'classifications',
      isObject(classifications) ? 'pass' : requirementsPresent && required ? 'error' : 'planned',
      isObject(classifications)
        ? 'Classification placeholder requirements are present for IFC classification references.'
        : 'Classification requirements are missing.',
    ),
  );
  checks.push(
    exchangeCheck(
      'psets',
      Array.isArray(requirements?.dataQualityChecks) && requirements.dataQualityChecks.length > 0
        ? 'planned'
        : 'warning',
      'Property-set validation is tracked as a normalized manifest requirement until the IFC backend exposes concrete Pset rows.',
      { requiredChecks: requirements?.dataQualityChecks ?? [] },
    ),
  );
  checks.push(
    exchangeCheck(
      'quantities',
      evidencePackage || validate ? 'planned' : 'warning',
      'Quantity validation is planned from evidence-package/validate output until explicit IFC quantity rows are exposed.',
      { evidencePackageFormat: evidencePackage?.format ?? evidencePackage?.body?.format ?? null },
    ),
  );

  const summary = {
    passCount: checks.filter((check) => check.status === 'pass').length,
    warningCount: checks.filter((check) => check.status === 'warning').length,
    errorCount: checks.filter((check) => check.status === 'error').length,
    plannedCount: checks.filter((check) => check.status === 'planned').length,
  };
  return {
    schemaVersion: 'sketch.exchange-validation.v1',
    generatedAt: new Date().toISOString(),
    qualityTarget: ir?.qualityTarget ?? null,
    source: hasIfcGeometry ? 'ifc_manifest' : 'snapshot_normalized',
    ok: summary.errorCount === 0,
    summary,
    requiredOutputs: exportOutputs,
    checks,
  };
}

export function buildVisualChecklist(ir, coverage) {
  const viewMap = new Map((ir.requiredViews ?? []).map((view) => [view.id, view]));
  const items = [];

  const semanticChecksForFeature = (feature, viewId) => {
    const view = viewMap.get(viewId);
    const haystack = [
      feature.featureId,
      feature.kind,
      view?.kind,
      view?.purpose,
      ...(feature.capabilityMatches ?? []).flatMap((capability) => [
        capability.title,
        ...(capability.requiredEvidence ?? []),
        ...(capability.knownFailureModes ?? []),
      ]),
    ]
      .filter(Boolean)
      .join(' ');
    const checks = [];
    for (const template of SEMANTIC_VISUAL_FEATURE_TEMPLATES) {
      if (!template.match.test(haystack)) continue;
      for (const [id, prompt] of template.checks) {
        checks.push({ id, prompt });
      }
    }
    if (checks.length === 0) {
      checks.push({
        id: 'feature_visible_correct',
        prompt: 'Feature is visibly present and semantically matches its sketch intent.',
      });
    }
    const seen = new Set();
    return checks
      .filter((check) => {
        if (seen.has(check.id)) return false;
        seen.add(check.id);
        return true;
      })
      .map((check) => ({
        id: check.id,
        status: 'unchecked',
        required: true,
        prompt: check.prompt,
        evidence: [],
        notes: '',
      }));
  };

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
        semanticChecks: semanticChecksForFeature(feature, viewId),
        knownFailureModes,
        requiredEvidence,
        notes: '',
      });
    }
  }

  const globalChecks = [
    [
      'global:silhouette',
      'All required 3D views read as the sketch silhouette, not a generic building.',
    ],
    [
      'global:advisor',
      'Advisor warning/error findings are fixed or explicitly tolerated with elementIds.',
    ],
    [
      'global:interior',
      'Rooms, doors, stairs, and slab openings are plausible in plan and wire diagnostics.',
    ],
    [
      'global:artifacts',
      'No visible gaps, z-fighting, uncut walls, false masses, or distracting material artifacts remain.',
    ],
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
      semanticChecks: (SEMANTIC_VISUAL_GLOBAL_TEMPLATES[id] ?? []).map(
        ([checkId, checkPrompt]) => ({
          id: checkId,
          status: 'unchecked',
          required: true,
          prompt: checkPrompt,
          evidence: [],
          notes: '',
        }),
      ),
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
    contract: {
      semanticVisualChecklistRequired: BIM_REQUIRED_TARGETS.has(ir?.qualityTarget),
      passStatuses: [...SEMANTIC_VISUAL_PASS_STATUSES],
      failStatuses: [...SEMANTIC_VISUAL_FAIL_STATUSES],
      note: 'Final acceptance requires each required semanticChecks[] item to be agent-filled as pass with notes/evidence, or fail/unchecked will block acceptance.',
    },
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
        notes:
          item.notes ||
          (capture.fallbackFit
            ? 'Screenshot captured with fit fallback because no saved viewpoint id matched this required view.'
            : ''),
      };
    }),
  };
}

function mergeVisualChecklistContract(generatedChecklist, providedChecklist) {
  if (!isObject(providedChecklist) || !Array.isArray(providedChecklist.items)) {
    return generatedChecklist;
  }
  const providedItems = new Map(
    providedChecklist.items
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => [item.id, item]),
  );
  return {
    ...generatedChecklist,
    filledChecklistSource: providedChecklist.sourcePath ?? providedChecklist.path ?? null,
    items: (generatedChecklist.items ?? []).map((generatedItem) => {
      const providedItem = providedItems.get(generatedItem.id);
      if (!providedItem) return generatedItem;
      const providedChecks = new Map(
        (providedItem.semanticChecks ?? [])
          .filter((check) => check && typeof check.id === 'string')
          .map((check) => [check.id, check]),
      );
      return {
        ...generatedItem,
        ...providedItem,
        semanticChecks: (generatedItem.semanticChecks ?? []).map((generatedCheck) => ({
          ...generatedCheck,
          ...(providedChecks.get(generatedCheck.id) ?? {}),
        })),
      };
    }),
  };
}

function hasSemanticPassEvidence(check) {
  if (typeof check.notes === 'string' && check.notes.trim()) return true;
  if (Array.isArray(check.evidence) && check.evidence.some((entry) => String(entry ?? '').trim())) {
    return true;
  }
  if (typeof check.evidencePath === 'string' && check.evidencePath.trim()) return true;
  return false;
}

function evaluateSemanticVisualChecklist({ ir, coverage, checklist }) {
  const expected = buildVisualChecklist(ir, coverage);
  const actualItems = new Map(
    (checklist?.items ?? [])
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => [item.id, item]),
  );
  const failures = [];
  let requiredCount = 0;
  let passCount = 0;

  for (const expectedItem of expected.items ?? []) {
    const expectedChecks = (expectedItem.semanticChecks ?? []).filter(
      (check) => check?.required !== false,
    );
    if (expectedChecks.length === 0) continue;
    const actualItem = actualItems.get(expectedItem.id);
    if (!actualItem) {
      requiredCount += expectedChecks.length;
      failures.push({
        itemId: expectedItem.id,
        viewId: expectedItem.viewId ?? null,
        featureId: expectedItem.featureId ?? null,
        checkIds: expectedChecks.map((check) => check.id),
        status: 'missing',
        message: 'Required semantic visual checklist item is missing.',
      });
      continue;
    }
    const actualChecks = new Map(
      (actualItem.semanticChecks ?? [])
        .filter((check) => check && typeof check.id === 'string')
        .map((check) => [check.id, check]),
    );
    for (const expectedCheck of expectedChecks) {
      requiredCount += 1;
      const actualCheck = actualChecks.get(expectedCheck.id);
      const status = String(actualCheck?.status ?? '')
        .trim()
        .toLowerCase();
      if (!actualCheck) {
        failures.push({
          itemId: expectedItem.id,
          viewId: expectedItem.viewId ?? null,
          featureId: expectedItem.featureId ?? null,
          checkId: expectedCheck.id,
          status: 'missing',
          message: expectedCheck.prompt,
        });
      } else if (SEMANTIC_VISUAL_PASS_STATUSES.has(status)) {
        if (hasSemanticPassEvidence(actualCheck)) {
          passCount += 1;
        } else {
          failures.push({
            itemId: expectedItem.id,
            viewId: expectedItem.viewId ?? null,
            featureId: expectedItem.featureId ?? null,
            checkId: expectedCheck.id,
            status: 'pass_evidence_missing',
            message: `${expectedCheck.prompt} Pass status requires notes or evidence.`,
          });
        }
      } else if (SEMANTIC_VISUAL_FAIL_STATUSES.has(status)) {
        failures.push({
          itemId: expectedItem.id,
          viewId: expectedItem.viewId ?? null,
          featureId: expectedItem.featureId ?? null,
          checkId: expectedCheck.id,
          status: status || 'fail',
          message: actualCheck.notes || expectedCheck.prompt,
        });
      } else if (SEMANTIC_VISUAL_REVIEW_STATUSES.has(status)) {
        failures.push({
          itemId: expectedItem.id,
          viewId: expectedItem.viewId ?? null,
          featureId: expectedItem.featureId ?? null,
          checkId: expectedCheck.id,
          status: status || 'unchecked',
          message: expectedCheck.prompt,
        });
      } else {
        failures.push({
          itemId: expectedItem.id,
          viewId: expectedItem.viewId ?? null,
          featureId: expectedItem.featureId ?? null,
          checkId: expectedCheck.id,
          status,
          message: `Unknown semantic visual checklist status "${status}".`,
        });
      }
    }
  }

  return {
    schemaVersion: 'sketch.semantic-visual-checklist-evaluation.v1',
    generatedAt: new Date().toISOString(),
    required: BIM_REQUIRED_TARGETS.has(ir?.qualityTarget),
    ok: failures.length === 0,
    summary: {
      requiredCount,
      passCount,
      failureCount: failures.length,
      missingCount: failures.filter((failure) => failure.status === 'missing').length,
      failedCount: failures.filter((failure) => SEMANTIC_VISUAL_FAIL_STATUSES.has(failure.status))
        .length,
      unverifiedCount: failures.filter(
        (failure) =>
          SEMANTIC_VISUAL_REVIEW_STATUSES.has(failure.status) ||
          failure.status === 'pass_evidence_missing',
      ).length,
    },
    failures,
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
    checks.push(
      qualityCheck(
        'information_requirements_present',
        required ? 'error' : 'warning',
        'No BIM informationRequirements were supplied.',
      ),
    );
  } else {
    checks.push(
      qualityCheck(
        'information_requirements_present',
        'pass',
        'BIM informationRequirements are present.',
      ),
    );
  }

  const rooms = Array.isArray(requirements?.rooms) ? requirements.rooms : [];
  const levels = uniqueStrings(rooms.map((room) => room?.level));
  if (rooms.length > 0) {
    checks.push(
      qualityCheck(
        'room_requirements',
        'pass',
        `${rooms.length} room/space requirement(s) declare IfcSpace intent, access, classification, and schedule inclusion.`,
        { requiredRooms: rooms.length, requiredLevels: levels },
      ),
    );
  } else {
    checks.push(
      qualityCheck(
        'room_requirements',
        required ? 'error' : 'warning',
        'No room/space requirements were declared.',
      ),
    );
  }

  if (modelStats) {
    const roomCount = snapshotKindCount(modelStats, ['room', 'space']);
    checks.push(
      qualityCheck(
        'model_room_count',
        roomCount >= rooms.length ? 'pass' : 'error',
        `Live model has ${roomCount} room/space element(s); IR requires ${rooms.length}.`,
        { actual: roomCount, expected: rooms.length },
      ),
    );
    const levelCount = snapshotKindCount(modelStats, ['level']);
    checks.push(
      qualityCheck(
        'model_level_count',
        levelCount >= levels.length ? 'pass' : 'error',
        `Live model has ${levelCount} level element(s); IR references ${levels.length} level label(s).`,
        { actual: levelCount, expected: levels.length },
      ),
    );
  } else if (required) {
    checks.push(
      qualityCheck(
        'live_room_level_check',
        'planned',
        'Live room and level counts will be checked by initiation-run evidence.',
        { expectedRooms: rooms.length, expectedLevelLabels: levels.length },
      ),
    );
  }

  const semanticRows = Array.isArray(requirements?.elementSemanticRequirements)
    ? requirements.elementSemanticRequirements
    : [];
  const semanticCategories = new Set(semanticRows.map((row) => row?.category).filter(Boolean));
  const missingSemanticCategories = REQUIRED_ELEMENT_SEMANTIC_CATEGORIES.filter(
    (category) => !semanticCategories.has(category),
  );
  checks.push(
    qualityCheck(
      'element_semantic_requirements',
      missingSemanticCategories.length ? (required ? 'error' : 'warning') : 'pass',
      missingSemanticCategories.length
        ? `Missing semantic requirement(s): ${missingSemanticCategories.join(', ')}.`
        : 'Required element categories declare BIM category and IFC entity intent.',
      { missing: missingSemanticCategories },
    ),
  );

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
      checks.push(
        qualityCheck(
          `model_category_${category}`,
          actual > 0 ? 'pass' : 'error',
          `Live model has ${actual} element(s) for required category ${category}.`,
          { actual, expectedKinds: kinds },
        ),
      );
    }
  }

  const layerSets = Array.isArray(requirements?.materialLayerSetRequirements)
    ? requirements.materialLayerSetRequirements
    : [];
  const layerSetCategories = new Set(
    layerSets.flatMap((row) =>
      Array.isArray(row?.appliesToCategories) ? row.appliesToCategories : [],
    ),
  );
  const missingLayerSets = REQUIRED_LAYER_SET_CATEGORIES.filter(
    (category) => !layerSetCategories.has(category),
  );
  checks.push(
    qualityCheck(
      'material_layer_set_requirements',
      missingLayerSets.length ? (required ? 'error' : 'warning') : 'pass',
      missingLayerSets.length
        ? `Missing material/layer-set requirement(s): ${missingLayerSets.join(', ')}.`
        : 'Wall, slab, and roof layer-set requirements include material layers and performance placeholders.',
      { missing: missingLayerSets },
    ),
  );
  if (modelStats) {
    const typeCount = snapshotKindCount(modelStats, ['wall_type', 'floor_type', 'roof_type']);
    checks.push(
      qualityCheck(
        'model_type_layer_set_count',
        typeCount >= REQUIRED_LAYER_SET_CATEGORIES.length ? 'pass' : 'error',
        `Live model has ${typeCount} wall/floor/roof type element(s); layer-set intent requires at least ${REQUIRED_LAYER_SET_CATEGORIES.length}.`,
        { actual: typeCount, expected: REQUIRED_LAYER_SET_CATEGORIES.length },
      ),
    );
  }

  const classifications = requirements?.classificationRequirements;
  checks.push(
    qualityCheck(
      'classification_placeholders',
      isObject(classifications) ? 'pass' : required ? 'error' : 'warning',
      isObject(classifications)
        ? 'DIN277 room, DIN276 element, and planned IFC classification placeholders are declared.'
        : 'Classification placeholders are missing.',
    ),
  );

  const structure = requirements?.structureLiteRequirements;
  const missingStructure = REQUIRED_STRUCTURE_LITE_SECTIONS.filter(
    (key) => !Array.isArray(structure?.[key]) || structure[key].length === 0,
  );
  checks.push(
    qualityCheck(
      'structure_lite_requirements',
      missingStructure.length ? (required ? 'error' : 'warning') : 'pass',
      missingStructure.length
        ? `Missing structure-lite section(s): ${missingStructure.join(', ')}.`
        : 'Structure-lite load-bearing, support, opening coordination, and load-path assumptions are declared.',
      { missing: missingStructure },
    ),
  );

  const mep = requirements?.mepLiteRequirements;
  const missingMep = REQUIRED_MEP_LITE_SECTIONS.filter(
    (key) => !Array.isArray(mep?.[key]) || mep[key].length === 0,
  );
  checks.push(
    qualityCheck(
      'mep_lite_requirements',
      missingMep.length ? (required ? 'error' : 'warning') : 'pass',
      missingMep.length
        ? `Missing MEP-lite section(s): ${missingMep.join(', ')}.`
        : 'MEP-lite wet-room, riser, equipment, route, service-level, and opening request placeholders are declared.',
      { missing: missingMep },
    ),
  );

  const site = requirements?.planningSiteRequirements;
  const missingSite = REQUIRED_PLANNING_SITE_FIELDS.filter(
    (key) => typeof site?.[key] !== 'string' || site[key].trim() === '',
  );
  checks.push(
    qualityCheck(
      'planning_site_requirements',
      missingSite.length ? (required ? 'error' : 'warning') : 'pass',
      missingSite.length
        ? `Missing planning/site field(s): ${missingSite.join(', ')}.`
        : 'Planning/site orientation, base/survey point, setback, sun, and code-locale assumptions are declared.',
      { missing: missingSite },
    ),
  );

  const schedules = Array.isArray(requirements?.schedules) ? requirements.schedules : [];
  checks.push(
    qualityCheck(
      'schedule_requirements',
      schedules.length > 0 ? 'pass' : required ? 'error' : 'warning',
      schedules.length > 0
        ? `${schedules.length} schedule requirement(s) declared.`
        : 'No schedule requirements were declared.',
      { count: schedules.length },
    ),
  );

  const exportRequirements = requirements?.exportRequirements;
  const exportOutputs = Array.isArray(exportRequirements?.outputs)
    ? exportRequirements.outputs
    : [];
  const missingExportOutputs = REQUIRED_EXPORT_OUTPUTS.filter(
    (output) => !hasExportOutput(exportOutputs, output),
  );
  checks.push(
    qualityCheck(
      'export_readiness_requirements',
      missingExportOutputs.length === 0 ? 'pass' : required ? 'error' : 'warning',
      missingExportOutputs.length === 0
        ? `Export readiness outputs declared: ${exportOutputs.join(', ')}.`
        : `Missing export readiness output(s): ${missingExportOutputs.join(', ')}.`,
      { outputs: exportOutputs, missing: missingExportOutputs },
    ),
  );

  const passportMaterials = Array.isArray(
    requirements?.sustainabilityMaterialPassportRequirements?.materials,
  )
    ? requirements.sustainabilityMaterialPassportRequirements.materials
    : [];
  const passportKeys = new Set(
    passportMaterials.map((entry) => entry?.materialKey).filter(Boolean),
  );
  const missingPassports = uniqueStrings(
    layerSets.flatMap((row) =>
      Array.isArray(row?.layers) ? row.layers.map((layer) => layer?.materialKey) : [],
    ),
  ).filter((materialKey) => !passportKeys.has(materialKey));
  checks.push(
    qualityCheck(
      'sustainability_material_passports',
      passportMaterials.length > 0 && missingPassports.length === 0
        ? 'pass'
        : required
          ? 'error'
          : 'warning',
      passportMaterials.length > 0 && missingPassports.length === 0
        ? `${passportMaterials.length} material passport starter entr${passportMaterials.length === 1 ? 'y' : 'ies'} declare EPD/source confidence, carbon placeholder, reuse/recyclability notes, and quantity source.`
        : `Missing material passport starter data${missingPassports.length ? ` for ${missingPassports.join(', ')}` : ''}.`,
      { count: passportMaterials.length, missing: missingPassports },
    ),
  );

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
  visualChecklist = null,
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
      .filter((view) =>
        ['3d', 'elevation', 'diagnostic', 'plan', 'floor_plan', 'section'].includes(view?.kind),
      )
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

  const semanticVisual = evaluateSemanticVisualChecklist({
    ir,
    coverage,
    checklist: visualChecklist ?? evidenceRun?.visualChecklist ?? null,
  });
  if (BIM_REQUIRED_TARGETS.has(ir?.qualityTarget) && !semanticVisual.ok) {
    blockers.push({
      code: 'semantic_visual_checklist_failures',
      severity: 'error',
      message: `${semanticVisual.summary.failureCount} required semantic visual checklist item(s) are missing, failed, or unverified.`,
      failures: semanticVisual.failures.map((failure) => ({
        itemId: failure.itemId,
        viewId: failure.viewId,
        featureId: failure.featureId,
        checkId: failure.checkId ?? null,
        status: failure.status,
        message: failure.message,
      })),
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

  const exchangeValidation = evidenceRun?.exchangeValidationReport ?? null;
  if (
    BIM_REQUIRED_TARGETS.has(ir?.qualityTarget) &&
    exchangeValidation &&
    (exchangeValidation.summary?.errorCount ?? 0) > 0
  ) {
    blockers.push({
      code: 'exchange_validation_failures',
      severity: 'error',
      message: `${exchangeValidation.summary.errorCount} IFC/exchange validation check(s) failed.`,
      checks: (exchangeValidation.checks ?? [])
        .filter((check) => check.status === 'error')
        .map((check) => ({ id: check.id, message: check.message })),
    });
  }
  if ((exchangeValidation?.summary?.warningCount ?? 0) > 0) {
    tolerances.push({
      code: 'exchange_validation_warnings',
      message: `${exchangeValidation.summary.warningCount} IFC/exchange validation warning(s) require review.`,
    });
  }

  const evidenceFreshness = evidenceRun?.evidenceFreshness ?? null;
  if (!preflightOnly && evidenceRun?.liveArtifacts && !evidenceFreshness) {
    blockers.push({
      code: 'evidence_freshness_missing',
      severity: 'error',
      message: 'Live evidence was provided without current-head freshness metadata.',
    });
  }
  if (evidenceFreshness?.ok === false) {
    for (const blocker of evidenceFreshness.blockers ?? []) {
      blockers.push({
        code: blocker.code ?? 'stale_evidence',
        severity: blocker.severity ?? 'error',
        message: blocker.message ?? 'Evidence freshness check failed.',
        recorded: blocker.recorded,
        current: blocker.current,
        sourcePath: blocker.sourcePath ?? evidenceFreshness.sourcePath ?? null,
      });
    }
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
      semanticVisualRequiredCount: semanticVisual.summary.requiredCount,
      semanticVisualFailureCount: semanticVisual.summary.failureCount,
      bimDataQualityErrorCount: bimQuality?.summary?.errorCount ?? 0,
      bimDataQualityPlannedCount: bimQuality?.summary?.plannedCount ?? 0,
      exchangeValidationErrorCount: exchangeValidation?.summary?.errorCount ?? 0,
      exchangeValidationWarningCount: exchangeValidation?.summary?.warningCount ?? 0,
      evidenceFreshnessOk: evidenceFreshness?.ok ?? null,
      staleEvidenceCount: evidenceFreshness?.summary?.staleCount ?? 0,
      missingEvidenceFreshnessCount: evidenceFreshness?.summary?.missingCount ?? 0,
    },
    semanticVisual,
    bimDataQuality: bimQuality,
    exchangeValidation,
    evidenceFreshness,
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
  if (coverage.capabilityMatrixPath)
    lines.push(`Capability matrix: ${coverage.capabilityMatrixPath}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(
    `- Features: ${coverage.summary.featureCount} (${coverage.summary.criticalFeatureCount} critical)`,
  );
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
  lines.push(
    markdownTable(
      errors.map((item) => `- \`${item.code}\` at \`${item.path}\`: ${item.message}`),
    ).trimEnd(),
  );
  lines.push('');
  lines.push('## Warnings');
  lines.push('');
  lines.push(
    markdownTable(
      warnings.map((item) => `- \`${item.code}\` at \`${item.path}\`: ${item.message}`),
    ).trimEnd(),
  );
  lines.push('');

  lines.push('## Feature Coverage');
  lines.push('');
  lines.push('| Feature | Kind | Priority | Readiness | Capability status |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const feature of coverage.features) {
    const capabilityStatus = feature.capabilityMatches.length
      ? feature.capabilityMatches
          .map((capability) => `${capability.id}:${capability.status}`)
          .join('<br>')
      : 'missing';
    lines.push(
      `| ${feature.featureId} | ${feature.kind} | ${feature.visualPriority} | ${feature.readiness} | ${capabilityStatus} |`,
    );
  }
  lines.push('');
  lines.push('## Visual Checklist');
  lines.push('');
  lines.push(`Checklist items: ${checklist.items.length}`);
  lines.push(
    'Every item starts as `unchecked`; acceptance requires screenshot evidence and semantic pass/fail notes.',
  );
  const semanticTotal = (checklist.items ?? []).reduce(
    (sum, item) => sum + (item.semanticChecks ?? []).length,
    0,
  );
  lines.push(`Semantic checklist items: ${semanticTotal}`);
  lines.push('');
  lines.push('## Live Advisor');
  lines.push('');
  if (!liveAdvisor) {
    lines.push('Not captured. Run with `--live --model <id>` after the model exists.');
  } else {
    for (const severity of ['warning', 'info']) {
      const summary = liveAdvisor[severity];
      if (!summary) continue;
      lines.push(
        `- ${severity}: ${summary.total ?? 0} finding(s) across ${(summary.groups ?? []).length} group(s).`,
      );
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
  lines.push('## Evidence Freshness');
  lines.push('');
  if (!evidenceRun?.evidenceFreshness) {
    lines.push('No current-head evidence freshness report was attached.');
  } else {
    const freshness = evidenceRun.evidenceFreshness;
    lines.push(`Freshness: ${freshness.ok ? 'pass' : 'fail'}`);
    for (const check of freshness.checks ?? []) {
      lines.push(`- ${check.id}: ${check.status}`);
    }
    for (const blocker of freshness.blockers ?? []) {
      lines.push(`- blocker \`${blocker.code}\`: ${blocker.message}`);
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
  lines.push('## Exchange Validation');
  lines.push('');
  if (!evidenceRun?.exchangeValidationReport) {
    lines.push('Not evaluated by this packet.');
  } else {
    const report = evidenceRun.exchangeValidationReport;
    lines.push(
      `Result: ${report.ok ? 'pass' : 'blocked'} (${report.summary.errorCount} error(s), ${report.summary.warningCount} warning(s), ${report.summary.plannedCount} planned check(s)).`,
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
    lines.push(
      `Result: ${report.ok ? 'pass' : 'blocked'} (${report.summary.blockerCount} blocker(s), ${report.summary.toleranceCount} tolerance(s)).`,
    );
    if (report.semanticVisual) {
      lines.push(
        `Semantic visual: ${report.semanticVisual.ok ? 'pass' : 'blocked'} (${report.semanticVisual.summary.failureCount} failure(s) / ${report.semanticVisual.summary.requiredCount} required).`,
      );
    }
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
  const generatedScreenshotChecklist = screenshotManifest
    ? applyScreenshotManifestToChecklist(buildVisualChecklist(ir, coverage), screenshotManifest)
    : buildVisualChecklist(ir, coverage);
  const generatedChecklist = visualGateReport
    ? applyVisualGateToChecklist(generatedScreenshotChecklist, visualGateReport)
    : generatedScreenshotChecklist;
  const checklist = mergeVisualChecklistContract(
    generatedChecklist,
    evidenceRun?.visualChecklist ?? null,
  );
  const bimDataQualityReport = buildBimDataQualityReport({ ir, evidenceRun });
  const acceptanceGateReport = buildAcceptanceGateReport({
    ir,
    coverage,
    liveAdvisor,
    screenshotManifest,
    visualGateReport,
    visualChecklist: checklist,
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
  await fs.writeFile(
    files.bimDataQuality,
    `${JSON.stringify(bimDataQualityReport, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    files.status,
    formatStatusMarkdown(coverage, checklist, liveAdvisor, {
      ...(evidenceRun ?? {}),
      capabilityGaps,
      visualGateReport,
      acceptanceGateReport,
      bimDataQualityReport,
    }),
    'utf8',
  );
  if (liveAdvisor) {
    files.liveAdvisor = path.join(outDir, 'live-advisor.json');
    await fs.writeFile(files.liveAdvisor, `${JSON.stringify(liveAdvisor, null, 2)}\n`, 'utf8');
  }
  if (screenshotManifest) {
    files.screenshotManifest = path.join(outDir, 'screenshot-manifest.json');
    await fs.writeFile(
      files.screenshotManifest,
      `${JSON.stringify(screenshotManifest, null, 2)}\n`,
      'utf8',
    );
  }
  if (visualGateReport) {
    files.visualGate = path.join(outDir, 'visual-gate.json');
    await fs.writeFile(files.visualGate, `${JSON.stringify(visualGateReport, null, 2)}\n`, 'utf8');
  }
  if (evidenceRun?.evidenceFreshness) {
    files.evidenceFreshness = path.join(outDir, 'evidence-freshness.json');
    await fs.writeFile(
      files.evidenceFreshness,
      `${JSON.stringify(evidenceRun.evidenceFreshness, null, 2)}\n`,
      'utf8',
    );
  }
  files.acceptanceGates = path.join(outDir, 'acceptance-gates.json');
  await fs.writeFile(
    files.acceptanceGates,
    `${JSON.stringify(acceptanceGateReport, null, 2)}\n`,
    'utf8',
  );
  if (capabilityGaps.taskCount > 0) {
    files.capabilityGaps = path.join(outDir, 'capability-gaps.json');
    await fs.writeFile(
      files.capabilityGaps,
      `${JSON.stringify(capabilityGaps, null, 2)}\n`,
      'utf8',
    );
  }

  return {
    ok: coverage.summary.errorCount === 0,
    outDir,
    files,
    summary: coverage.summary,
    acceptance: acceptanceGateReport,
  };
}
