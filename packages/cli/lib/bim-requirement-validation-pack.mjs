import crypto from 'node:crypto';

export const BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION = 'bim-requirement-validation-pack.v1';
export const BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION =
  'bim-requirement-validation-report.v1';

const IFC_ENTITY_TO_SNAPSHOT_KINDS = {
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

const OUTPUT_ALIASES = {
  ifc: ['ifc', 'ifc_manifest', 'ifc-export'],
  glb: ['glb', 'gltf', 'glb_manifest', 'gltf_manifest'],
  gltf: ['glb', 'gltf', 'glb_manifest', 'gltf_manifest'],
  pdf: ['pdf', 'sheet_pdf', 'sheets', 'pdf/sheets'],
  'pdf-sheets': ['pdf', 'sheet_pdf', 'sheets', 'pdf/sheets'],
  schedules: ['schedule', 'schedules'],
  'room-schedule': ['room_schedule', 'room schedule', 'schedule'],
  'door-window-schedule': ['door_window_schedule', 'door/window schedule', 'schedule'],
  'evidence-package': ['evidence_package', 'evidence-package'],
  'source-bundle': ['source_bundle', 'source-bundle', 'source command bundle'],
};

const REQUIRED_ROOM_FIELDS = [
  'name',
  'number',
  'level',
  'function',
  'targetAreaM2',
  'boundingStatus',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map(asTrimmedString).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function slug(value) {
  return (
    asTrimmedString(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = canonicalize(value[key]);
  }
  return out;
}

function digest(value) {
  return `sha256:${crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')}`;
}

function requirementsFrom(input) {
  if (isObject(input?.informationRequirements)) return input.informationRequirements;
  if (isObject(input?.requirements)) return input.requirements;
  if (isObject(input?.ir?.informationRequirements)) return input.ir.informationRequirements;
  return isObject(input) ? input : {};
}

function outputKey(value) {
  const raw = slug(value);
  if (raw === 'pdf-sheets') return raw;
  if (raw === 'room-schedule') return raw;
  if (raw === 'door-window-schedule') return raw;
  if (raw === 'evidence-package') return raw;
  if (raw === 'source-bundle' || raw === 'source-command-bundle') return 'source-bundle';
  if (raw === 'ifc' || raw === 'glb' || raw === 'gltf' || raw === 'pdf' || raw === 'schedules') {
    return raw;
  }
  return raw;
}

function compileCheck(id, title, predicate, extra = {}) {
  return {
    id,
    title,
    severity: extra.severity ?? 'error',
    layer: 'methodology-exchange',
    evidenceBlocker: extra.evidenceBlocker ?? true,
    deliveryTargets: normalizeStringArray(extra.deliveryTargets),
    sourcePath: extra.sourcePath ?? null,
    requirementRefs: normalizeStringArray(extra.requirementRefs),
    predicate,
  };
}

function compileOutputChecks(requirements) {
  const outputs = normalizeStringArray(requirements.exportRequirements?.outputs).map(outputKey);
  return outputs.map((output) =>
    compileCheck(
      `bir_export_output_${output}`,
      `Required delivery output: ${output}`,
      { type: 'artifact_present', output },
      {
        deliveryTargets: [output],
        sourcePath: 'informationRequirements.exportRequirements.outputs',
        requirementRefs: ['BIR-K07'],
      },
    ),
  );
}

function compileRoomChecks(requirements) {
  const rooms = Array.isArray(requirements.rooms) ? requirements.rooms : [];
  if (!rooms.length) return [];
  return [
    compileCheck(
      'bir_rooms_min_count',
      'Required rooms/spaces are represented',
      {
        type: 'min_kind_count',
        kinds: ['room', 'space'],
        min: rooms.length,
        ifcEntity: 'IfcSpace',
      },
      {
        sourcePath: 'informationRequirements.rooms',
        requirementRefs: ['BIR-K07', 'BIR-D06'],
      },
    ),
    compileCheck(
      'bir_rooms_required_fields',
      'Required room fields are present in schedule/evidence rows',
      { type: 'required_row_fields', rowSet: 'rooms', fields: REQUIRED_ROOM_FIELDS },
      {
        sourcePath: 'informationRequirements.rooms',
        requirementRefs: ['BIR-K07', 'BIR-D06'],
      },
    ),
  ];
}

function compileSemanticChecks(requirements) {
  const rows = Array.isArray(requirements.elementSemanticRequirements)
    ? requirements.elementSemanticRequirements
    : [];
  return rows
    .map((row, index) => {
      if (!isObject(row)) return null;
      const entity = asTrimmedString(row.ifcEntityIntent);
      const category = asTrimmedString(row.category) || `semantic-${index + 1}`;
      if (!entity) {
        return compileCheck(
          `bir_semantic_${slug(category)}_ifc_intent_missing`,
          `IFC intent declared for ${category}`,
          { type: 'require_compiled_value', field: 'ifcEntityIntent' },
          {
            severity: 'warning',
            sourcePath: `informationRequirements.elementSemanticRequirements.${index}`,
            requirementRefs: ['BIR-K04', 'BIR-K07'],
          },
        );
      }
      return compileCheck(
        `bir_semantic_${slug(category)}_${slug(entity)}`,
        `Required IFC/entity representation for ${category}`,
        {
          type: 'min_kind_count',
          kinds: IFC_ENTITY_TO_SNAPSHOT_KINDS[entity] ?? [asTrimmedString(row.expectedBimCategory)],
          min: Number(row.minCount) > 0 ? Number(row.minCount) : 1,
          ifcEntity: entity,
        },
        {
          deliveryTargets: ['ifc'],
          sourcePath: `informationRequirements.elementSemanticRequirements.${index}`,
          requirementRefs: ['BIR-K04', 'BIR-K07'],
        },
      );
    })
    .filter(Boolean);
}

function compileLayerSetChecks(requirements) {
  const rows = Array.isArray(requirements.materialLayerSetRequirements)
    ? requirements.materialLayerSetRequirements
    : [];
  return rows.map((row, index) => {
    const id =
      asTrimmedString(row?.id) || asTrimmedString(row?.layerSetName) || `layer-set-${index + 1}`;
    return compileCheck(
      `bir_layer_set_${slug(id)}`,
      `Material layer set is evidenced: ${id}`,
      {
        type: 'material_layer_set_present',
        id,
        layerSetName: asTrimmedString(row?.layerSetName),
        appliesToCategories: normalizeStringArray(row?.appliesToCategories),
      },
      {
        sourcePath: `informationRequirements.materialLayerSetRequirements.${index}`,
        requirementRefs: ['BIR-K04', 'BIR-K07'],
      },
    );
  });
}

function compileScheduleChecks(requirements) {
  const rows = Array.isArray(requirements.schedules)
    ? requirements.schedules
    : Array.isArray(requirements.scheduleRequirements)
      ? requirements.scheduleRequirements
      : [];
  return rows.map((row, index) => {
    const id = asTrimmedString(row?.id) || slug(row?.title) || `schedule-${index + 1}`;
    return compileCheck(
      `bir_schedule_${slug(id)}_columns`,
      `Required schedule columns are present: ${id}`,
      {
        type: 'schedule_columns_present',
        scheduleId: id,
        requiredColumns: normalizeStringArray(row?.requiredColumns),
      },
      {
        deliveryTargets: ['schedules'],
        sourcePath: `informationRequirements.schedules.${index}`,
        requirementRefs: ['BIR-K05', 'BIR-K07'],
      },
    );
  });
}

function compileClassificationChecks(requirements) {
  if (!isObject(requirements.classificationRequirements)) return [];
  return [
    compileCheck(
      'bir_classification_placeholders_present',
      'Classification placeholder system is documented',
      { type: 'object_present', path: 'classificationRequirements' },
      {
        deliveryTargets: ['ifc'],
        sourcePath: 'informationRequirements.classificationRequirements',
        requirementRefs: ['BIR-K04', 'BIR-K07'],
      },
    ),
  ];
}

function compileDataQualityChecks(requirements) {
  return normalizeStringArray(requirements.dataQualityChecks).map((checkId) =>
    compileCheck(
      `bir_data_quality_${slug(checkId)}`,
      `BIM data quality evidence is present: ${checkId}`,
      { type: 'data_quality_evidence_present', checkId },
      {
        sourcePath: 'informationRequirements.dataQualityChecks',
        requirementRefs: ['BIR-K07'],
      },
    ),
  );
}

export function compileBimRequirementValidationPack(input, options = {}) {
  const requirements = requirementsFrom(input);
  const qualityTarget = asTrimmedString(
    options.qualityTarget ?? input?.qualityTarget ?? requirements.qualityTarget,
  );
  const deliveryTargets = normalizeStringArray(
    options.deliveryTargets ?? requirements.exportRequirements?.outputs,
  ).map(outputKey);
  const checks = [
    ...compileOutputChecks(requirements),
    ...compileRoomChecks(requirements),
    ...compileSemanticChecks(requirements),
    ...compileLayerSetChecks(requirements),
    ...compileScheduleChecks(requirements),
    ...compileClassificationChecks(requirements),
    ...compileDataQualityChecks(requirements),
  ].sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION,
    packId: asTrimmedString(options.packId ?? input?.id ?? input?.packId) || 'bir-pack',
    qualityTarget: qualityTarget || null,
    deliveryTargets,
    sourceDigestSha256: digest(requirements),
    summary: {
      checkCount: checks.length,
      evidenceBlockerCount: checks.filter((check) => check.evidenceBlocker).length,
      deliveryTargetCount: deliveryTargets.length,
    },
    checks,
  };
}

function artifactNames(evidence) {
  const names = [];
  for (const value of normalizeStringArray(evidence?.artifacts)) names.push(value);
  const arrays = [evidence?.evidencePackage?.artifacts, evidence?.exports, evidence?.manifestPaths];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (typeof item === 'string') names.push(item);
      if (isObject(item)) {
        names.push(item.id, item.kind, item.type, item.output, item.path, item.basename);
      }
    }
  }
  return normalizeStringArray(names).map((name) => name.toLowerCase());
}

function outputArtifactPresent(output, evidence) {
  if (output === 'ifc' && evidence?.ifcManifest?.ok) return true;
  if ((output === 'glb' || output === 'gltf') && evidence?.gltfManifest?.ok) return true;
  if (output === 'evidence-package' && isObject(evidence?.evidencePackage)) return true;
  if (output.endsWith('-schedule') && scheduleColumns(output, evidence).length > 0) return true;
  if (
    output === 'schedules' &&
    ((Array.isArray(evidence?.schedules) && evidence.schedules.length > 0) ||
      (Array.isArray(evidence?.evidencePackage?.schedules) &&
        evidence.evidencePackage.schedules.length > 0))
  ) {
    return true;
  }
  const aliases = OUTPUT_ALIASES[output] ?? [output];
  const haystack = artifactNames(evidence);
  return aliases.some((alias) => {
    const needle = alias.toLowerCase();
    return haystack.some((name) => name === needle || name.includes(needle));
  });
}

function ifcCounts(evidence) {
  const body = evidence?.ifcManifest?.body ?? evidence?.ifcManifest ?? {};
  return (
    body.exportedIfcKindsInArtifact ??
    body.countsByIfcKind ??
    body.countsByKind ??
    body.extensions?.BIM_AI_exportManifest_v0?.countsByIfcKind ??
    {}
  );
}

function snapshotKindCount(modelStats, kinds) {
  if (!isObject(modelStats)) return 0;
  const counts =
    modelStats.kindCounts ??
    modelStats.countsByKind ??
    modelStats.elementKindCounts ??
    modelStats.elementsByKind ??
    {};
  let total = 0;
  for (const kind of kinds) total += Number(counts?.[kind] ?? counts?.[slug(kind)] ?? 0) || 0;
  if (total > 0 || !Array.isArray(modelStats.elements)) return total;
  const normalizedKinds = new Set(kinds.map((kind) => asTrimmedString(kind).toLowerCase()));
  return modelStats.elements.filter((element) =>
    normalizedKinds.has(asTrimmedString(element?.kind).toLowerCase()),
  ).length;
}

function rowSetRows(rowSet, evidence) {
  if (rowSet === 'rooms') {
    if (Array.isArray(evidence?.rooms)) return evidence.rooms;
    if (Array.isArray(evidence?.evidencePackage?.rooms)) return evidence.evidencePackage.rooms;
    if (Array.isArray(evidence?.evidencePackage?.roomScheduleRows)) {
      return evidence.evidencePackage.roomScheduleRows;
    }
    if (Array.isArray(evidence?.modelStats?.rooms)) return evidence.modelStats.rooms;
  }
  return [];
}

function scheduleColumns(scheduleId, evidence) {
  const scheduleRows = [
    ...(Array.isArray(evidence?.schedules) ? evidence.schedules : []),
    ...(Array.isArray(evidence?.evidencePackage?.schedules)
      ? evidence.evidencePackage.schedules
      : []),
  ];
  const wanted = slug(scheduleId);
  const row = scheduleRows.find(
    (entry) => slug(entry?.id) === wanted || slug(entry?.title) === wanted,
  );
  return normalizeStringArray(row?.columns ?? row?.requiredColumns ?? row?.fields);
}

function materialLayerSetPresent(predicate, evidence) {
  const rows = [
    ...(Array.isArray(evidence?.materialLayerSets) ? evidence.materialLayerSets : []),
    ...(Array.isArray(evidence?.evidencePackage?.materialLayerSets)
      ? evidence.evidencePackage.materialLayerSets
      : []),
    ...(Array.isArray(evidence?.modelStats?.materialLayerSets)
      ? evidence.modelStats.materialLayerSets
      : []),
  ];
  const ids = new Set([
    slug(predicate.id),
    slug(predicate.layerSetName),
    ...normalizeStringArray(predicate.appliesToCategories).map(slug),
  ]);
  return rows.some((row) =>
    [row?.id, row?.layerSetName, row?.name, row?.category, row?.appliesToCategory]
      .map(slug)
      .some((value) => ids.has(value)),
  );
}

function dataQualityEvidencePresent(checkId, evidence) {
  const rows = [
    ...(Array.isArray(evidence?.dataQualityResults) ? evidence.dataQualityResults : []),
    ...(Array.isArray(evidence?.validate?.dataQualityResults)
      ? evidence.validate.dataQualityResults
      : []),
    ...(Array.isArray(evidence?.evidencePackage?.dataQualityResults)
      ? evidence.evidencePackage.dataQualityResults
      : []),
  ];
  const wanted = slug(checkId);
  return rows.some((row) => {
    if (![slug(row?.id), slug(row?.checkId), slug(row?.code)].includes(wanted)) return false;
    const status = asTrimmedString(row?.status ?? row?.result).toLowerCase();
    return status === '' || ['pass', 'passed', 'ok', 'present'].includes(status);
  });
}

function evaluateCheck(check, evidence = {}) {
  const predicate = isObject(check?.predicate) ? check.predicate : {};
  if (predicate.type === 'artifact_present') {
    const output = outputKey(predicate.output);
    return {
      passed: outputArtifactPresent(output, evidence),
      actual: outputArtifactPresent(output, evidence) ? 1 : 0,
      expected: 1,
      message: `Required ${output} exchange artifact must be present.`,
    };
  }
  if (predicate.type === 'min_kind_count') {
    const ifcEntity = asTrimmedString(predicate.ifcEntity);
    const fromIfc = Number(ifcCounts(evidence)?.[ifcEntity] ?? 0) || 0;
    const fromSnapshot = snapshotKindCount(
      evidence.modelStats,
      normalizeStringArray(predicate.kinds),
    );
    const actual = Math.max(fromIfc, fromSnapshot);
    const expected = Number(predicate.min) || 1;
    return {
      passed: actual >= expected,
      actual,
      expected,
      message: `Expected at least ${expected} ${ifcEntity || 'model'} representation(s); found ${actual}.`,
    };
  }
  if (predicate.type === 'required_row_fields') {
    const rows = rowSetRows(predicate.rowSet, evidence);
    const fields = normalizeStringArray(predicate.fields);
    const missingRows = rows
      .map((row, index) => ({
        index,
        missingFields: fields.filter((field) => row?.[field] == null || row?.[field] === ''),
      }))
      .filter((row) => row.missingFields.length);
    return {
      passed: rows.length > 0 && missingRows.length === 0,
      actual: rows.length - missingRows.length,
      expected: rows.length || 1,
      missingRows,
      message: rows.length
        ? `${missingRows.length} row(s) are missing required fields.`
        : `No ${predicate.rowSet} rows were available for field validation.`,
    };
  }
  if (predicate.type === 'schedule_columns_present') {
    const actualColumns = scheduleColumns(predicate.scheduleId, evidence);
    const requiredColumns = normalizeStringArray(predicate.requiredColumns);
    const missingColumns = requiredColumns.filter((column) => !actualColumns.includes(column));
    return {
      passed: requiredColumns.length > 0 && missingColumns.length === 0,
      actual: actualColumns.length,
      expected: requiredColumns.length,
      missingColumns,
      message: missingColumns.length
        ? `Schedule ${predicate.scheduleId} is missing column(s): ${missingColumns.join(', ')}.`
        : `Schedule ${predicate.scheduleId} has required columns.`,
    };
  }
  if (predicate.type === 'material_layer_set_present') {
    const passed = materialLayerSetPresent(predicate, evidence);
    return {
      passed,
      actual: passed ? 1 : 0,
      expected: 1,
      message: `Material layer-set evidence is required for ${predicate.id}.`,
    };
  }
  if (predicate.type === 'object_present') {
    return { passed: true, actual: 1, expected: 1, message: 'Requirement object compiled.' };
  }
  if (predicate.type === 'data_quality_evidence_present') {
    const passed = dataQualityEvidencePresent(predicate.checkId, evidence);
    return {
      passed,
      actual: passed ? 1 : 0,
      expected: 1,
      message: `Data quality evidence is required for ${predicate.checkId}.`,
    };
  }
  if (predicate.type === 'require_compiled_value') {
    return {
      passed: false,
      actual: 0,
      expected: 1,
      message: 'Compiled requirement is incomplete.',
    };
  }
  return { passed: false, actual: 0, expected: 1, message: 'Unknown validation predicate.' };
}

export function validateCompiledBimRequirementValidationPack(compiledPack, evidence = {}) {
  const checks = Array.isArray(compiledPack?.checks) ? compiledPack.checks : [];
  const results = checks.map((check) => {
    const evaluation = evaluateCheck(check, evidence);
    const status = evaluation.passed ? 'pass' : check.severity === 'error' ? 'error' : 'warning';
    return {
      id: check.id,
      title: check.title,
      status,
      severity: check.severity,
      evidenceBlocker: Boolean(check.evidenceBlocker),
      deliveryTargets: check.deliveryTargets ?? [],
      sourcePath: check.sourcePath ?? null,
      requirementRefs: check.requirementRefs ?? [],
      actual: evaluation.actual,
      expected: evaluation.expected,
      message: evaluation.message,
      details: Object.fromEntries(
        Object.entries(evaluation).filter(
          ([key]) => !['passed', 'actual', 'expected', 'message'].includes(key),
        ),
      ),
    };
  });
  const blockers = results
    .filter((result) => result.evidenceBlocker && result.status === 'error')
    .map((result) => ({
      code: result.id,
      severity: result.severity,
      message: result.message,
      sourcePath: result.sourcePath,
      requirementRefs: result.requirementRefs,
      deliveryTargets: result.deliveryTargets,
    }));
  const summary = {
    passCount: results.filter((result) => result.status === 'pass').length,
    warningCount: results.filter((result) => result.status === 'warning').length,
    errorCount: results.filter((result) => result.status === 'error').length,
    blockerCount: blockers.length,
  };
  return {
    schemaVersion: BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION,
    packId: compiledPack?.packId ?? 'bir-pack',
    qualityTarget: compiledPack?.qualityTarget ?? null,
    sourceDigestSha256: compiledPack?.sourceDigestSha256 ?? null,
    ok: blockers.length === 0,
    summary,
    checks: results,
    blockers,
  };
}

export function buildBimRequirementValidationEvidence({
  ir = null,
  pack = null,
  modelStats = null,
  validate = null,
  evidencePackage = null,
  ifcManifest = null,
  gltfManifest = null,
  artifacts = [],
  schedules = [],
  exports = [],
  materialLayerSets = [],
  dataQualityResults = [],
} = {}) {
  const compiledPack = compileBimRequirementValidationPack(pack ?? ir ?? {}, {
    packId: pack?.packId ?? ir?.id ?? 'methodology-bir-pack',
  });
  const report = validateCompiledBimRequirementValidationPack(compiledPack, {
    modelStats,
    validate,
    evidencePackage,
    ifcManifest,
    gltfManifest,
    artifacts,
    schedules,
    exports,
    materialLayerSets,
    dataQualityResults,
  });
  return {
    compiledPack,
    report,
  };
}
