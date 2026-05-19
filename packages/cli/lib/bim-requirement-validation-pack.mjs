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

const IDS_XML_SCHEMA_VERSION = 'buildingSMART-IDS-1.0';
const IDS_FACET_TYPES = ['entity', 'attribute', 'classification', 'property', 'material', 'partOf'];
const IDS_NAMESPACE = 'http://standards.buildingsmart.org/IDS';

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

function decodeXml(value) {
  return asTrimmedString(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseXmlAttributes(raw) {
  const attrs = {};
  const attrRe = /([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
  for (const match of raw.matchAll(attrRe)) {
    attrs[match[1]] = decodeXml(match[2].slice(1, -1));
  }
  return attrs;
}

function localXmlName(name) {
  return asTrimmedString(name).split(':').pop();
}

function parseXmlDocument(xml) {
  const root = { name: '#document', localName: '#document', attrs: {}, children: [], text: '' };
  const stack = [root];
  const cleaned = asTrimmedString(xml)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  const tokenRe = /<!\[CDATA\[([\s\S]*?)\]\]>|<([^>]+)>|([^<]+)/g;
  for (const match of cleaned.matchAll(tokenRe)) {
    if (match[1] != null || match[3] != null) {
      const text = decodeXml(match[1] ?? match[3]);
      if (text) stack.at(-1).text = `${stack.at(-1).text}${text}`;
      continue;
    }
    const tag = asTrimmedString(match[2]);
    if (!tag || tag.startsWith('!')) continue;
    if (tag.startsWith('/')) {
      const closeName = localXmlName(tag.slice(1));
      while (stack.length > 1 && stack.at(-1).localName !== closeName) stack.pop();
      if (stack.length > 1) stack.pop();
      continue;
    }
    const selfClosing = tag.endsWith('/');
    const body = selfClosing ? tag.slice(0, -1).trim() : tag;
    const name = body.split(/\s+/, 1)[0];
    const node = {
      name,
      localName: localXmlName(name),
      attrs: parseXmlAttributes(body.slice(name.length)),
      children: [],
      text: '',
    };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root.children.find((child) => child.localName === 'ids') ?? root.children[0] ?? null;
}

function childElements(node, localName = null) {
  if (!node) return [];
  return node.children.filter((child) => localName == null || child.localName === localName);
}

function firstChild(node, localName) {
  return childElements(node, localName)[0] ?? null;
}

function nodeText(node) {
  return asTrimmedString(node?.text);
}

function valueSpecFromNode(node) {
  if (!node) return null;
  const simple = nodeText(firstChild(node, 'simpleValue'));
  if (simple) return { simple };
  const restriction = firstChild(node, 'restriction');
  if (restriction) {
    const spec = {};
    const base = asTrimmedString(restriction.attrs.base);
    if (base) spec.base = base;
    const enumerations = childElements(restriction, 'enumeration')
      .map((child) => asTrimmedString(child.attrs.value))
      .filter(Boolean);
    if (enumerations.length) spec.enumeration = enumerations;
    const pattern = asTrimmedString(firstChild(restriction, 'pattern')?.attrs.value);
    if (pattern) spec.pattern = pattern;
    for (const key of ['minInclusive', 'maxInclusive', 'minExclusive', 'maxExclusive']) {
      const value = asTrimmedString(firstChild(restriction, key)?.attrs.value);
      if (value) spec[key] = value;
    }
    return Object.keys(spec).length ? spec : null;
  }
  const text = nodeText(node);
  return text ? { simple: text } : null;
}

function valueSpecLabel(spec) {
  if (!isObject(spec)) return 'present';
  if (spec.simple != null) return asTrimmedString(spec.simple);
  if (Array.isArray(spec.enumeration)) return spec.enumeration.join('|');
  if (spec.pattern) return `pattern:${spec.pattern}`;
  return Object.entries(spec)
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
}

function parseIdsFacet(facetNode) {
  if (!facetNode || !IDS_FACET_TYPES.includes(facetNode.localName)) return null;
  const facet = {
    type: facetNode.localName,
    cardinality: asTrimmedString(facetNode.attrs.cardinality) || null,
    instructions: asTrimmedString(facetNode.attrs.instructions) || null,
  };
  if (facet.type === 'entity') {
    const name = valueSpecFromNode(firstChild(facetNode, 'name'));
    const predefinedType = valueSpecFromNode(firstChild(facetNode, 'predefinedType'));
    if (name) facet.name = name;
    if (predefinedType) facet.predefinedType = predefinedType;
  } else if (facet.type === 'attribute') {
    const name = valueSpecFromNode(firstChild(facetNode, 'name'));
    const value = valueSpecFromNode(firstChild(facetNode, 'value'));
    if (name) facet.name = name;
    if (value) facet.value = value;
  } else if (facet.type === 'classification') {
    const system = valueSpecFromNode(firstChild(facetNode, 'system'));
    const value = valueSpecFromNode(firstChild(facetNode, 'value'));
    const uri = valueSpecFromNode(firstChild(facetNode, 'uri'));
    if (system) facet.system = system;
    if (value) facet.value = value;
    if (uri) facet.uri = uri;
  } else if (facet.type === 'property') {
    const propertySet = valueSpecFromNode(firstChild(facetNode, 'propertySet'));
    const baseName = valueSpecFromNode(firstChild(facetNode, 'baseName'));
    const value = valueSpecFromNode(firstChild(facetNode, 'value'));
    if (propertySet) facet.propertySet = propertySet;
    if (baseName) facet.baseName = baseName;
    if (value) facet.value = value;
    if (facetNode.attrs.dataType) facet.dataType = facetNode.attrs.dataType;
  } else if (facet.type === 'material') {
    const value = valueSpecFromNode(firstChild(facetNode, 'value'));
    if (value) facet.value = value;
  } else if (facet.type === 'partOf') {
    const relation = valueSpecFromNode(firstChild(facetNode, 'relation'));
    const entity = parseIdsFacet(firstChild(facetNode, 'entity'));
    if (relation) facet.relation = relation;
    if (entity) facet.entity = entity;
  }
  return facet;
}

function parseCardinality(value, fallback = null) {
  const raw = asTrimmedString(value);
  if (!raw) return fallback;
  if (raw === 'unbounded') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBuildingSmartIdsXml(xml) {
  const root = parseXmlDocument(xml);
  if (!root || root.localName !== 'ids') {
    throw new Error('Expected buildingSMART IDS XML root element <ids:ids>.');
  }
  const xmlns = asTrimmedString(root.attrs.xmlns ?? root.attrs['xmlns:ids']);
  const info = firstChild(root, 'info');
  const title = nodeText(firstChild(info, 'title')) || 'buildingSMART IDS';
  const specificationsNode = firstChild(root, 'specifications');
  const specifications = childElements(specificationsNode, 'specification').map((specNode, index) => {
    const applicability = childElements(firstChild(specNode, 'applicability'))
      .map(parseIdsFacet)
      .filter(Boolean);
    const requirements = childElements(firstChild(specNode, 'requirements'))
      .map(parseIdsFacet)
      .filter(Boolean);
    return {
      id: asTrimmedString(specNode.attrs.identifier) || slug(specNode.attrs.name) || `spec-${index + 1}`,
      name: asTrimmedString(specNode.attrs.name) || `Specification ${index + 1}`,
      ifcVersion: normalizeStringArray(specNode.attrs.ifcVersion),
      minOccurs: parseCardinality(specNode.attrs.minOccurs, 0),
      maxOccurs: parseCardinality(specNode.attrs.maxOccurs, null),
      applicability,
      requirements,
    };
  });
  const facetTypes = normalizeStringArray(
    specifications.flatMap((spec) => [
      ...spec.applicability.map((facet) => facet.type),
      ...spec.requirements.map((facet) => facet.type),
    ]),
  );
  return {
    schemaVersion: IDS_XML_SCHEMA_VERSION,
    namespace: xmlns || IDS_NAMESPACE,
    title,
    specificationCount: specifications.length,
    facetTypes,
    specifications,
  };
}

export function importBuildingSmartIdsXml(input) {
  const xml =
    typeof input === 'string'
      ? input
      : asTrimmedString(input?.idsXml ?? input?.xml ?? input?.buildingSmartIdsXml);
  if (!xml) return null;
  return parseBuildingSmartIdsXml(xml);
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

function idsFacetCheckTitle(spec, facet, cardinality) {
  const requirement = cardinality === 'prohibited' ? 'prohibits' : 'requires';
  if (facet.type === 'property') {
    return `IDS ${spec.name} ${requirement} property ${valueSpecLabel(facet.propertySet)}.${valueSpecLabel(facet.baseName)}`;
  }
  if (facet.type === 'attribute') {
    return `IDS ${spec.name} ${requirement} attribute ${valueSpecLabel(facet.name)}`;
  }
  if (facet.type === 'classification') {
    return `IDS ${spec.name} ${requirement} classification ${valueSpecLabel(facet.system)}:${valueSpecLabel(facet.value)}`;
  }
  if (facet.type === 'material') {
    return `IDS ${spec.name} ${requirement} material ${valueSpecLabel(facet.value)}`;
  }
  if (facet.type === 'partOf') {
    return `IDS ${spec.name} ${requirement} partOf relationship`;
  }
  return `IDS ${spec.name} ${requirement} entity ${valueSpecLabel(facet.name)}`;
}

function compileIdsSpecificationChecks(idsImport) {
  if (!idsImport) return [];
  const checks = [];
  idsImport.specifications.forEach((spec, specIndex) => {
    checks.push(
      compileCheck(
        `ids_${slug(spec.id)}_applicability`,
        `IDS applicability cardinality: ${spec.name}`,
        {
          type: 'ids_applicability_cardinality',
          specId: spec.id,
          applicability: spec.applicability,
          minOccurs: spec.minOccurs,
          maxOccurs: spec.maxOccurs,
        },
        {
          deliveryTargets: ['ifc'],
          sourcePath: `ids.specifications.${specIndex}.applicability`,
          requirementRefs: ['BIR-K07'],
        },
      ),
    );
    spec.requirements.forEach((facet, facetIndex) => {
      const cardinality = facet.cardinality || 'required';
      checks.push(
        compileCheck(
          `ids_${slug(spec.id)}_${slug(facet.type)}_${facetIndex + 1}_${slug(valueSpecLabel(facet.name ?? facet.baseName ?? facet.value ?? facet.system ?? facet.relation))}`,
          idsFacetCheckTitle(spec, facet, cardinality),
          {
            type: 'ids_requirement_facet',
            specId: spec.id,
            facet,
            cardinality,
            applicability: spec.applicability,
          },
          {
            deliveryTargets: ['ifc'],
            sourcePath: `ids.specifications.${specIndex}.requirements.${facetIndex}`,
            requirementRefs: ['BIR-K07'],
          },
        ),
      );
    });
  });
  return checks;
}

export function compileBimRequirementValidationPack(input, options = {}) {
  const idsImport = importBuildingSmartIdsXml(input);
  const requirements = requirementsFrom(input);
  const qualityTarget = asTrimmedString(
    options.qualityTarget ?? input?.qualityTarget ?? requirements.qualityTarget,
  );
  const deliveryTargets = normalizeStringArray(
    options.deliveryTargets ?? (idsImport ? ['ifc'] : requirements.exportRequirements?.outputs),
  ).map(outputKey);
  const checks = [
    ...compileOutputChecks(requirements),
    ...compileRoomChecks(requirements),
    ...compileSemanticChecks(requirements),
    ...compileLayerSetChecks(requirements),
    ...compileScheduleChecks(requirements),
    ...compileClassificationChecks(requirements),
    ...compileDataQualityChecks(requirements),
    ...compileIdsSpecificationChecks(idsImport),
  ].sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION,
    packId:
      asTrimmedString(options.packId ?? input?.id ?? input?.packId ?? idsImport?.title) || 'bir-pack',
    qualityTarget: qualityTarget || null,
    deliveryTargets,
    sourceDigestSha256: digest(idsImport ?? requirements),
    ...(idsImport
      ? {
          sourceFormat: 'buildingSMART_IDS_XML',
          idsImport: {
            schemaVersion: idsImport.schemaVersion,
            namespace: idsImport.namespace,
            title: idsImport.title,
            specificationCount: idsImport.specificationCount,
            facetTypes: idsImport.facetTypes,
          },
        }
      : {}),
    summary: {
      checkCount: checks.length,
      evidenceBlockerCount: checks.filter((check) => check.evidenceBlocker).length,
      deliveryTargetCount: deliveryTargets.length,
      ...(idsImport
        ? {
            idsSpecificationCount: idsImport.specificationCount,
            idsFacetTypes: idsImport.facetTypes,
          }
        : {}),
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

function idsEvidenceRows(evidence) {
  const rows = [
    ...(Array.isArray(evidence?.idsFacetRows) ? evidence.idsFacetRows : []),
    ...(Array.isArray(evidence?.ifcManifest?.idsFacetRows) ? evidence.ifcManifest.idsFacetRows : []),
    ...(Array.isArray(evidence?.evidencePackage?.idsFacetRows)
      ? evidence.evidencePackage.idsFacetRows
      : []),
    ...(Array.isArray(evidence?.modelStats?.elements) ? evidence.modelStats.elements : []),
  ];
  return rows.filter(isObject).map((row) => ({
    ...row,
    ifcEntity: asTrimmedString(row.ifcEntity ?? row.entity ?? row.ifcKind ?? row.type),
    attributes: isObject(row.attributes) ? row.attributes : {},
    properties: isObject(row.properties) ? row.properties : {},
    classifications: Array.isArray(row.classifications) ? row.classifications : [],
    materials: Array.isArray(row.materials)
      ? row.materials
      : normalizeStringArray(row.material ?? row.materialName),
    partOf: Array.isArray(row.partOf) ? row.partOf : [],
  }));
}

function equalsFold(actual, expected) {
  return asTrimmedString(actual).toLowerCase() === asTrimmedString(expected).toLowerCase();
}

function valueMatchesSpec(actual, spec) {
  if (!isObject(spec)) return actual != null && asTrimmedString(actual) !== '';
  const actualText = asTrimmedString(actual);
  if (spec.simple != null) return equalsFold(actualText, spec.simple);
  if (Array.isArray(spec.enumeration) && !spec.enumeration.some((value) => equalsFold(actualText, value))) {
    return false;
  }
  if (spec.pattern) {
    try {
      if (!new RegExp(spec.pattern).test(actualText)) return false;
    } catch {
      return false;
    }
  }
  const actualNumber = Number(actualText);
  const numericRules = ['minInclusive', 'maxInclusive', 'minExclusive', 'maxExclusive'];
  if (numericRules.some((key) => spec[key] != null)) {
    if (!Number.isFinite(actualNumber)) return false;
    if (spec.minInclusive != null && actualNumber < Number(spec.minInclusive)) return false;
    if (spec.maxInclusive != null && actualNumber > Number(spec.maxInclusive)) return false;
    if (spec.minExclusive != null && actualNumber <= Number(spec.minExclusive)) return false;
    if (spec.maxExclusive != null && actualNumber >= Number(spec.maxExclusive)) return false;
  }
  return true;
}

function attributeValue(row, nameSpec) {
  const wanted = asTrimmedString(nameSpec?.simple);
  if (!wanted) return undefined;
  const direct = row.attributes[wanted] ?? row.attributes[wanted.toLowerCase()];
  if (direct != null) return direct;
  const key = Object.keys(row.attributes).find((candidate) => equalsFold(candidate, wanted));
  return key ? row.attributes[key] : row[wanted] ?? row[wanted.toLowerCase()];
}

function propertyValue(row, propertySetSpec, baseNameSpec) {
  const psetName = asTrimmedString(propertySetSpec?.simple);
  const baseName = asTrimmedString(baseNameSpec?.simple);
  if (!baseName) return undefined;
  const candidates = [];
  if (psetName && isObject(row.properties?.[psetName])) candidates.push(row.properties[psetName]);
  if (psetName) {
    const psetKey = Object.keys(row.properties).find((candidate) => equalsFold(candidate, psetName));
    if (psetKey && isObject(row.properties[psetKey])) candidates.push(row.properties[psetKey]);
  }
  candidates.push(row.properties);
  for (const candidate of candidates) {
    const key = Object.keys(candidate).find((name) => equalsFold(name, baseName));
    if (key) return candidate[key];
  }
  return undefined;
}

function rowMatchesIdsFacet(row, facet) {
  if (!isObject(facet)) return true;
  if (facet.type === 'entity') {
    if (facet.name && !valueMatchesSpec(row.ifcEntity, facet.name)) return false;
    const predefined = attributeValue(row, { simple: 'PredefinedType' }) ?? row.predefinedType;
    if (facet.predefinedType && !valueMatchesSpec(predefined, facet.predefinedType)) return false;
    return true;
  }
  if (facet.type === 'attribute') {
    return valueMatchesSpec(attributeValue(row, facet.name), facet.value ?? null);
  }
  if (facet.type === 'property') {
    const value = propertyValue(row, facet.propertySet, facet.baseName);
    return valueMatchesSpec(value, facet.value ?? null);
  }
  if (facet.type === 'classification') {
    return row.classifications.some((classification) => {
      if (typeof classification === 'string') return valueMatchesSpec(classification, facet.value ?? facet.system);
      return (
        (!facet.system || valueMatchesSpec(classification.system, facet.system)) &&
        (!facet.value ||
          valueMatchesSpec(
            classification.value ?? classification.code ?? classification.identification,
            facet.value,
          )) &&
        (!facet.uri || valueMatchesSpec(classification.uri ?? classification.location, facet.uri))
      );
    });
  }
  if (facet.type === 'material') {
    return normalizeStringArray(row.materials).some((material) => valueMatchesSpec(material, facet.value));
  }
  if (facet.type === 'partOf') {
    return row.partOf.some((part) => {
      if (!isObject(part)) return false;
      const relationOk = !facet.relation || valueMatchesSpec(part.relation ?? part.type, facet.relation);
      const entityOk =
        !facet.entity ||
        rowMatchesIdsFacet(
          {
            ifcEntity: part.ifcEntity ?? part.entity,
            attributes: {
              Name: part.name,
              PredefinedType: part.predefinedType,
            },
            properties: {},
            classifications: [],
            materials: [],
            partOf: [],
          },
          facet.entity,
        );
      return relationOk && entityOk;
    });
  }
  return false;
}

function applicableIdsRows(predicate, evidence) {
  const rows = idsEvidenceRows(evidence);
  const applicability = Array.isArray(predicate.applicability) ? predicate.applicability : [];
  return rows.filter((row) => applicability.every((facet) => rowMatchesIdsFacet(row, facet)));
}

function evaluateIdsApplicability(predicate, evidence) {
  const rows = applicableIdsRows(predicate, evidence);
  const minOccurs = Number(predicate.minOccurs ?? 0);
  const maxOccurs = predicate.maxOccurs == null ? null : Number(predicate.maxOccurs);
  const actual = rows.length;
  const minOk = actual >= minOccurs;
  const maxOk = maxOccurs == null || actual <= maxOccurs;
  return {
    passed: minOk && maxOk,
    actual,
    expected: maxOccurs === 0 ? 0 : minOccurs,
    message:
      maxOccurs === 0
        ? `IDS applicability for ${predicate.specId} must match no IFC rows; found ${actual}.`
        : `IDS applicability for ${predicate.specId} expected at least ${minOccurs} IFC row(s); found ${actual}.`,
  };
}

function evaluateIdsRequirementFacet(predicate, evidence) {
  const rows = applicableIdsRows(predicate, evidence);
  const matchingRows = rows.filter((row) => rowMatchesIdsFacet(row, predicate.facet));
  const cardinality = predicate.cardinality || 'required';
  const passed =
    cardinality === 'optional'
      ? true
      : cardinality === 'prohibited'
        ? matchingRows.length === 0
        : rows.length > 0 && matchingRows.length === rows.length;
  return {
    passed,
    actual: matchingRows.length,
    expected: cardinality === 'prohibited' ? 0 : rows.length || 1,
    message:
      cardinality === 'prohibited'
        ? `IDS ${predicate.specId} prohibits ${predicate.facet?.type} facet matches; found ${matchingRows.length}.`
        : `IDS ${predicate.specId} requires ${predicate.facet?.type} facet on ${rows.length} applicable row(s); ${matchingRows.length} matched.`,
  };
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
  if (predicate.type === 'ids_applicability_cardinality') {
    return evaluateIdsApplicability(predicate, evidence);
  }
  if (predicate.type === 'ids_requirement_facet') {
    return evaluateIdsRequirementFacet(predicate, evidence);
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
  idsFacetRows = [],
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
    idsFacetRows,
  });
  return {
    compiledPack,
    report,
  };
}
