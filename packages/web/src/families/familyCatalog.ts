import { type FamilyDefinition, type FamilyParamDef } from './types';

// ── shared param helpers ──────────────────────────────────────────────────────

function lengthParam(
  key: string,
  label: string,
  defaultMm: number,
  opts: { min?: number; max?: number; instanceOverridable: boolean },
): FamilyParamDef {
  return { key, label, type: 'length_mm', default: defaultMm, ...opts };
}

// ── door families ─────────────────────────────────────────────────────────────

const SINGLE_DOOR: FamilyDefinition = {
  id: 'builtin:door:single',
  name: 'Single Leaf Door',
  discipline: 'door',
  params: [
    lengthParam('leafWidthMm', 'Leaf Width', 900, {
      min: 600,
      max: 2400,
      instanceOverridable: true,
    }),
    lengthParam('leafHeightMm', 'Leaf Height', 2100, {
      min: 1800,
      max: 3000,
      instanceOverridable: false,
    }),
    lengthParam('frameSectMm', 'Frame Section', 70, { instanceOverridable: false }),
  ],
  defaultTypes: [
    {
      id: 'builtin:door:single:900x2100',
      name: 'Single 900×2100',
      familyId: 'builtin:door:single',
      discipline: 'door',
      parameters: { leafWidthMm: 900, leafHeightMm: 2100 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:door:single:1000x2100',
      name: 'Single 1000×2100',
      familyId: 'builtin:door:single',
      discipline: 'door',
      parameters: { leafWidthMm: 1000, leafHeightMm: 2100 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:door:single:800x2100',
      name: 'Single 800×2100',
      familyId: 'builtin:door:single',
      discipline: 'door',
      parameters: { leafWidthMm: 800, leafHeightMm: 2100 },
      isBuiltIn: true,
    },
  ],
};

const DOUBLE_DOOR: FamilyDefinition = {
  id: 'builtin:door:double',
  name: 'Double Leaf Door',
  discipline: 'door',
  params: [
    lengthParam('leafWidthMm', 'Leaf Width', 1800, {
      min: 1200,
      max: 4000,
      instanceOverridable: true,
    }),
    lengthParam('leafHeightMm', 'Leaf Height', 2100, {
      min: 1800,
      max: 3000,
      instanceOverridable: false,
    }),
  ],
  defaultTypes: [
    {
      id: 'builtin:door:double:1800x2100',
      name: 'Double 1800×2100',
      familyId: 'builtin:door:double',
      discipline: 'door',
      parameters: { leafWidthMm: 1800, leafHeightMm: 2100 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:door:double:2100x2100',
      name: 'Double 2100×2100',
      familyId: 'builtin:door:double',
      discipline: 'door',
      parameters: { leafWidthMm: 2100, leafHeightMm: 2100 },
      isBuiltIn: true,
    },
  ],
};

// §3.6.2 — expanded door presets

const SLIDING_DOOR: FamilyDefinition = {
  id: 'builtin:door:sliding',
  name: 'Sliding Door',
  discipline: 'door',
  params: [
    lengthParam('leafWidthMm', 'Leaf Width', 1800, {
      min: 900,
      max: 4000,
      instanceOverridable: true,
    }),
    lengthParam('leafHeightMm', 'Leaf Height', 2100, {
      min: 1800,
      max: 3000,
      instanceOverridable: false,
    }),
  ],
  defaultTypes: [
    {
      id: 'builtin:door:sliding:1800x2100',
      name: 'Sliding Door 1800×2100',
      familyId: 'builtin:door:sliding',
      discipline: 'door',
      parameters: { leafWidthMm: 1800, leafHeightMm: 2100 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:door:sliding:1200x2100',
      name: 'Sliding Door 1200×2100',
      familyId: 'builtin:door:sliding',
      discipline: 'door',
      parameters: { leafWidthMm: 1200, leafHeightMm: 2100 },
      isBuiltIn: true,
    },
  ],
};

const POCKET_DOOR: FamilyDefinition = {
  id: 'builtin:door:pocket',
  name: 'Pocket Door',
  discipline: 'door',
  params: [
    lengthParam('leafWidthMm', 'Leaf Width', 900, {
      min: 600,
      max: 1200,
      instanceOverridable: true,
    }),
    lengthParam('leafHeightMm', 'Leaf Height', 2100, {
      min: 1800,
      max: 3000,
      instanceOverridable: false,
    }),
  ],
  defaultTypes: [
    {
      id: 'builtin:door:pocket:900x2100',
      name: 'Pocket Door 900×2100',
      familyId: 'builtin:door:pocket',
      discipline: 'door',
      parameters: { leafWidthMm: 900, leafHeightMm: 2100 },
      isBuiltIn: true,
    },
  ],
};

// ── window families ───────────────────────────────────────────────────────────

const CASEMENT_WINDOW: FamilyDefinition = {
  id: 'builtin:window:casement',
  name: 'Casement Window',
  discipline: 'window',
  params: [
    lengthParam('widthMm', 'Width', 1200, { min: 400, max: 3000, instanceOverridable: true }),
    lengthParam('heightMm', 'Height', 1500, { min: 400, max: 2400, instanceOverridable: true }),
    lengthParam('sillMm', 'Sill Height', 900, { min: 200, max: 2000, instanceOverridable: true }),
    {
      key: 'glazingAlpha',
      label: 'Frosted Glazing',
      type: 'boolean',
      default: 0.35,
      instanceOverridable: false,
    },
  ],
  defaultTypes: [
    {
      id: 'builtin:window:casement:1200x1500',
      name: 'Casement 1200×1500',
      familyId: 'builtin:window:casement',
      discipline: 'window',
      parameters: { widthMm: 1200, heightMm: 1500, sillMm: 900 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:window:casement:600x1200',
      name: 'Casement 600×1200',
      familyId: 'builtin:window:casement',
      discipline: 'window',
      parameters: { widthMm: 600, heightMm: 1200, sillMm: 900 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:window:casement:2400x1500',
      name: 'Casement 2400×1500',
      familyId: 'builtin:window:casement',
      discipline: 'window',
      parameters: { widthMm: 2400, heightMm: 1500, sillMm: 900 },
      isBuiltIn: true,
    },
  ],
};

const FIXED_WINDOW: FamilyDefinition = {
  id: 'builtin:window:fixed',
  name: 'Fixed Glazing',
  discipline: 'window',
  params: [
    lengthParam('widthMm', 'Width', 1500, { min: 400, max: 6000, instanceOverridable: true }),
    lengthParam('heightMm', 'Height', 2000, { min: 400, max: 4000, instanceOverridable: true }),
    lengthParam('sillMm', 'Sill Height', 100, { min: 0, max: 1000, instanceOverridable: true }),
  ],
  defaultTypes: [
    {
      id: 'builtin:window:fixed:1500x2000',
      name: 'Fixed 1500×2000',
      familyId: 'builtin:window:fixed',
      discipline: 'window',
      parameters: { widthMm: 1500, heightMm: 2000, sillMm: 100 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:window:fixed:3000x2400',
      name: 'Fixed 3000×2400',
      familyId: 'builtin:window:fixed',
      discipline: 'window',
      parameters: { widthMm: 3000, heightMm: 2400, sillMm: 100 },
      isBuiltIn: true,
    },
  ],
};

// §3.6.2 — expanded window presets

const DOUBLE_HUNG_WINDOW: FamilyDefinition = {
  id: 'builtin:window:double_hung',
  name: 'Double Hung Window',
  discipline: 'window',
  params: [
    lengthParam('widthMm', 'Width', 900, { min: 400, max: 2400, instanceOverridable: true }),
    lengthParam('heightMm', 'Height', 1500, { min: 600, max: 2400, instanceOverridable: true }),
    lengthParam('sillMm', 'Sill Height', 800, { min: 200, max: 2000, instanceOverridable: true }),
  ],
  defaultTypes: [
    {
      id: 'builtin:window:double_hung:900x1500',
      name: 'Double Hung 900×1500',
      familyId: 'builtin:window:double_hung',
      discipline: 'window',
      parameters: { widthMm: 900, heightMm: 1500, sillMm: 800 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:window:double_hung:600x1200',
      name: 'Double Hung 600×1200',
      familyId: 'builtin:window:double_hung',
      discipline: 'window',
      parameters: { widthMm: 600, heightMm: 1200, sillMm: 800 },
      isBuiltIn: true,
    },
  ],
};

const AWNING_WINDOW: FamilyDefinition = {
  id: 'builtin:window:awning',
  name: 'Awning Window',
  discipline: 'window',
  params: [
    lengthParam('widthMm', 'Width', 1200, { min: 400, max: 2400, instanceOverridable: true }),
    lengthParam('heightMm', 'Height', 600, { min: 300, max: 1000, instanceOverridable: true }),
    lengthParam('sillMm', 'Sill Height', 1400, { min: 800, max: 2200, instanceOverridable: true }),
  ],
  defaultTypes: [
    {
      id: 'builtin:window:awning:1200x600',
      name: 'Awning 1200×600',
      familyId: 'builtin:window:awning',
      discipline: 'window',
      parameters: { widthMm: 1200, heightMm: 600, sillMm: 1400 },
      isBuiltIn: true,
    },
  ],
};

const SLIDING_WINDOW: FamilyDefinition = {
  id: 'builtin:window:sliding',
  name: 'Sliding Window',
  discipline: 'window',
  params: [
    lengthParam('widthMm', 'Width', 1600, { min: 800, max: 4000, instanceOverridable: true }),
    lengthParam('heightMm', 'Height', 2100, { min: 600, max: 3000, instanceOverridable: true }),
    lengthParam('sillMm', 'Sill Height', 0, { min: 0, max: 1200, instanceOverridable: true }),
  ],
  defaultTypes: [
    {
      id: 'builtin:window:sliding:1600x2100',
      name: 'Sliding 2-Panel 1600×2100',
      familyId: 'builtin:window:sliding',
      discipline: 'window',
      parameters: { widthMm: 1600, heightMm: 2100, sillMm: 0 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:window:sliding:2400x2100',
      name: 'Sliding 2-Panel 2400×2100',
      familyId: 'builtin:window:sliding',
      discipline: 'window',
      parameters: { widthMm: 2400, heightMm: 2100, sillMm: 0 },
      isBuiltIn: true,
    },
  ],
};

// ── stair families ────────────────────────────────────────────────────────────

const STRAIGHT_STAIR: FamilyDefinition = {
  id: 'builtin:stair:straight',
  name: 'Straight Stair',
  discipline: 'stair',
  params: [
    lengthParam('widthMm', 'Width', 1200, { min: 600, max: 3000, instanceOverridable: true }),
    lengthParam('riserMm', 'Riser Height', 175, { min: 100, max: 220, instanceOverridable: false }),
    lengthParam('treadMm', 'Tread Depth', 280, { min: 200, max: 400, instanceOverridable: false }),
  ],
  defaultTypes: [
    {
      id: 'builtin:stair:straight:1200',
      name: 'Straight 1200 wide',
      familyId: 'builtin:stair:straight',
      discipline: 'stair',
      parameters: { widthMm: 1200, riserMm: 175, treadMm: 280 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:stair:straight:900',
      name: 'Straight 900 wide',
      familyId: 'builtin:stair:straight',
      discipline: 'stair',
      parameters: { widthMm: 900, riserMm: 175, treadMm: 280 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:stair:straight:1500',
      name: 'Straight 1500 wide',
      familyId: 'builtin:stair:straight',
      discipline: 'stair',
      parameters: { widthMm: 1500, riserMm: 175, treadMm: 280 },
      isBuiltIn: true,
    },
  ],
};

// ── railing families ──────────────────────────────────────────────────────────

const POST_AND_RAIL: FamilyDefinition = {
  id: 'builtin:railing:post_and_rail',
  name: 'Post and Rail',
  discipline: 'railing',
  params: [
    lengthParam('guardHeightMm', 'Guard Height', 1050, {
      min: 900,
      max: 1200,
      instanceOverridable: true,
    }),
    lengthParam('postSectMm', 'Post Section', 50, { instanceOverridable: false }),
    lengthParam('balSpacingMm', 'Baluster Spacing', 115, { instanceOverridable: false }),
  ],
  defaultTypes: [
    {
      id: 'builtin:railing:post_and_rail:1050',
      name: 'Post and Rail 1050',
      familyId: 'builtin:railing:post_and_rail',
      discipline: 'railing',
      parameters: { guardHeightMm: 1050 },
      isBuiltIn: true,
    },
    {
      id: 'builtin:railing:post_and_rail:1100',
      name: 'Post and Rail 1100',
      familyId: 'builtin:railing:post_and_rail',
      discipline: 'railing',
      parameters: { guardHeightMm: 1100 },
      isBuiltIn: true,
    },
  ],
};

// ── exports ───────────────────────────────────────────────────────────────────

export const BUILT_IN_FAMILIES: FamilyDefinition[] = [
  SINGLE_DOOR,
  DOUBLE_DOOR,
  SLIDING_DOOR,
  POCKET_DOOR,
  CASEMENT_WINDOW,
  FIXED_WINDOW,
  DOUBLE_HUNG_WINDOW,
  AWNING_WINDOW,
  SLIDING_WINDOW,
  STRAIGHT_STAIR,
  POST_AND_RAIL,
];

export function getFamilyById(id: string): FamilyDefinition | undefined {
  return BUILT_IN_FAMILIES.find((f) => f.id === id);
}

export function getTypeById(id: string): FamilyDefinition['defaultTypes'][number] | undefined {
  for (const family of BUILT_IN_FAMILIES) {
    const found = family.defaultTypes.find((t) => t.id === id);
    if (found) return found;
  }
  return undefined;
}

export interface BuiltinFamilyTypeIntegrityRow {
  id: string;
  familyId: string;
  discipline: string;
  familySchemaVersion: 'family-content-v1';
  strictFamilySchema: true;
  parameters: Record<string, unknown>;
  parameterSchema: Array<Record<string, unknown>>;
  requiredDimensions: string[];
  hostSupport: string;
  materialSlots: string[];
  scheduleFields: string[];
  ifcMapping: Record<string, unknown>;
  gltfMapping: Record<string, unknown>;
  renderSupport: Record<string, unknown>;
  exportSupport: Record<string, unknown>;
  planSymbol: Record<string, unknown>;
  visualGeometry: Record<string, unknown>;
}

export function builtinFamilyTypeIntegrityRows(): BuiltinFamilyTypeIntegrityRow[] {
  return BUILT_IN_FAMILIES.flatMap((family) =>
    family.defaultTypes.map((type) => {
      const parameters = { ...type.parameters };
      const explicitSchema = family.params.map((param) => ({
        key: param.key,
        kind: integrityParamKind(param.type),
        min: param.min,
        max: param.max,
        options: param.options,
        required: true,
        instanceOverridable: param.instanceOverridable,
      }));
      const schemaKeys = new Set(explicitSchema.map((entry) => String(entry.key)));
      const inferredDimensions = Object.keys(parameters)
        .filter((key) => /Mm$/.test(key) && typeof parameters[key] === 'number')
        .sort();
      const inferredSchema = inferredDimensions
        .filter((key) => !schemaKeys.has(key))
        .map((key) => ({
          key,
          kind: 'mm',
          required: true,
          instanceOverridable: true,
        }));
      const parameterSchema = [...explicitSchema, ...inferredSchema].map((entry) =>
        Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined)),
      );
      const scheduleFields = [...new Set(parameterSchema.map((entry) => String(entry.key)))].sort();
      return {
        id: type.id,
        familyId: family.id,
        discipline: type.discipline,
        familySchemaVersion: 'family-content-v1',
        strictFamilySchema: true,
        parameters,
        parameterSchema,
        requiredDimensions: inferredDimensions,
        hostSupport: hostSupportForDiscipline(type.discipline),
        materialSlots: ['default'],
        scheduleFields,
        ifcMapping: { class: ifcClassForDiscipline(type.discipline) },
        gltfMapping: { nodeKind: 'family_instance' },
        renderSupport: { geometry: true, source: 'builtin_family_catalog' },
        exportSupport: { ifc: true, gltf: true },
        planSymbol: { kind: type.discipline },
        visualGeometry: { kind: 'builtin_family', familyId: family.id },
      };
    }),
  );
}

function integrityParamKind(type: FamilyParamDef['type']): string {
  if (type === 'length_mm') return 'mm';
  if (type === 'material_key') return 'material';
  if (type === 'boolean') return 'boolean';
  if (type === 'option') return 'option';
  return type;
}

function hostSupportForDiscipline(discipline: string): string {
  if (discipline === 'door' || discipline === 'window') return 'wall_hosted';
  if (discipline === 'stair' || discipline === 'railing') return 'level_hosted';
  return 'freestanding';
}

function ifcClassForDiscipline(discipline: string): string {
  if (discipline === 'door') return 'IfcDoor';
  if (discipline === 'window') return 'IfcWindow';
  if (discipline === 'stair') return 'IfcStair';
  if (discipline === 'railing') return 'IfcRailing';
  return 'IfcBuildingElementProxy';
}
