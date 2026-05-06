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
  id:         'builtin:door:single',
  name:       'Single Leaf Door',
  discipline: 'door',
  params: [
    lengthParam('leafWidthMm',  'Leaf Width',   900,  { min: 600,  max: 2400, instanceOverridable: true }),
    lengthParam('leafHeightMm', 'Leaf Height',  2100, { min: 1800, max: 3000, instanceOverridable: false }),
    lengthParam('frameSectMm',  'Frame Section', 70,  { instanceOverridable: false }),
  ],
  defaultTypes: [
    {
      id:         'builtin:door:single:900x2100',
      name:       'Single 900×2100',
      familyId:   'builtin:door:single',
      discipline: 'door',
      parameters: { leafWidthMm: 900, leafHeightMm: 2100 },
      isBuiltIn:  true,
    },
    {
      id:         'builtin:door:single:1000x2100',
      name:       'Single 1000×2100',
      familyId:   'builtin:door:single',
      discipline: 'door',
      parameters: { leafWidthMm: 1000, leafHeightMm: 2100 },
      isBuiltIn:  true,
    },
    {
      id:         'builtin:door:single:800x2100',
      name:       'Single 800×2100',
      familyId:   'builtin:door:single',
      discipline: 'door',
      parameters: { leafWidthMm: 800, leafHeightMm: 2100 },
      isBuiltIn:  true,
    },
  ],
};

const DOUBLE_DOOR: FamilyDefinition = {
  id:         'builtin:door:double',
  name:       'Double Leaf Door',
  discipline: 'door',
  params: [
    lengthParam('leafWidthMm',  'Leaf Width',  1800, { min: 1200, max: 4000, instanceOverridable: true }),
    lengthParam('leafHeightMm', 'Leaf Height', 2100, { min: 1800, max: 3000, instanceOverridable: false }),
  ],
  defaultTypes: [
    {
      id:         'builtin:door:double:1800x2100',
      name:       'Double 1800×2100',
      familyId:   'builtin:door:double',
      discipline: 'door',
      parameters: { leafWidthMm: 1800, leafHeightMm: 2100 },
      isBuiltIn:  true,
    },
    {
      id:         'builtin:door:double:2100x2100',
      name:       'Double 2100×2100',
      familyId:   'builtin:door:double',
      discipline: 'door',
      parameters: { leafWidthMm: 2100, leafHeightMm: 2100 },
      isBuiltIn:  true,
    },
  ],
};

// ── window families ───────────────────────────────────────────────────────────

const CASEMENT_WINDOW: FamilyDefinition = {
  id:         'builtin:window:casement',
  name:       'Casement Window',
  discipline: 'window',
  params: [
    lengthParam('widthMm',  'Width',       1200, { min: 400,  max: 3000, instanceOverridable: true }),
    lengthParam('heightMm', 'Height',      1500, { min: 400,  max: 2400, instanceOverridable: true }),
    lengthParam('sillMm',   'Sill Height',  900, { min: 200,  max: 2000, instanceOverridable: true }),
    {
      key:                 'glazingAlpha',
      label:               'Frosted Glazing',
      type:                'boolean',
      default:             0.35,
      instanceOverridable: false,
    },
  ],
  defaultTypes: [
    {
      id:         'builtin:window:casement:1200x1500',
      name:       'Casement 1200×1500',
      familyId:   'builtin:window:casement',
      discipline: 'window',
      parameters: { widthMm: 1200, heightMm: 1500, sillMm: 900 },
      isBuiltIn:  true,
    },
    {
      id:         'builtin:window:casement:600x1200',
      name:       'Casement 600×1200',
      familyId:   'builtin:window:casement',
      discipline: 'window',
      parameters: { widthMm: 600, heightMm: 1200, sillMm: 900 },
      isBuiltIn:  true,
    },
    {
      id:         'builtin:window:casement:2400x1500',
      name:       'Casement 2400×1500',
      familyId:   'builtin:window:casement',
      discipline: 'window',
      parameters: { widthMm: 2400, heightMm: 1500, sillMm: 900 },
      isBuiltIn:  true,
    },
  ],
};

const FIXED_WINDOW: FamilyDefinition = {
  id:         'builtin:window:fixed',
  name:       'Fixed Glazing',
  discipline: 'window',
  params: [
    lengthParam('widthMm',  'Width',       1500, { min: 400, max: 6000, instanceOverridable: true }),
    lengthParam('heightMm', 'Height',      2000, { min: 400, max: 4000, instanceOverridable: true }),
    lengthParam('sillMm',   'Sill Height',  100, { min: 0,   max: 1000, instanceOverridable: true }),
  ],
  defaultTypes: [
    {
      id:         'builtin:window:fixed:1500x2000',
      name:       'Fixed 1500×2000',
      familyId:   'builtin:window:fixed',
      discipline: 'window',
      parameters: { widthMm: 1500, heightMm: 2000, sillMm: 100 },
      isBuiltIn:  true,
    },
    {
      id:         'builtin:window:fixed:3000x2400',
      name:       'Fixed 3000×2400',
      familyId:   'builtin:window:fixed',
      discipline: 'window',
      parameters: { widthMm: 3000, heightMm: 2400, sillMm: 100 },
      isBuiltIn:  true,
    },
  ],
};

// ── stair families ────────────────────────────────────────────────────────────

const STRAIGHT_STAIR: FamilyDefinition = {
  id:         'builtin:stair:straight',
  name:       'Straight Stair',
  discipline: 'stair',
  params: [
    lengthParam('widthMm',  'Width',       1200, { min: 600, max: 3000, instanceOverridable: true }),
    lengthParam('riserMm',  'Riser Height',  175, { min: 100, max: 220,  instanceOverridable: false }),
    lengthParam('treadMm',  'Tread Depth',   280, { min: 200, max: 400,  instanceOverridable: false }),
  ],
  defaultTypes: [
    {
      id:         'builtin:stair:straight:1200',
      name:       'Straight 1200 wide',
      familyId:   'builtin:stair:straight',
      discipline: 'stair',
      parameters: { widthMm: 1200, riserMm: 175, treadMm: 280 },
      isBuiltIn:  true,
    },
    {
      id:         'builtin:stair:straight:900',
      name:       'Straight 900 wide',
      familyId:   'builtin:stair:straight',
      discipline: 'stair',
      parameters: { widthMm: 900, riserMm: 175, treadMm: 280 },
      isBuiltIn:  true,
    },
    {
      id:         'builtin:stair:straight:1500',
      name:       'Straight 1500 wide',
      familyId:   'builtin:stair:straight',
      discipline: 'stair',
      parameters: { widthMm: 1500, riserMm: 175, treadMm: 280 },
      isBuiltIn:  true,
    },
  ],
};

// ── railing families ──────────────────────────────────────────────────────────

const POST_AND_RAIL: FamilyDefinition = {
  id:         'builtin:railing:post_and_rail',
  name:       'Post and Rail',
  discipline: 'railing',
  params: [
    lengthParam('guardHeightMm', 'Guard Height',   1050, { min: 900, max: 1200, instanceOverridable: true }),
    lengthParam('postSectMm',    'Post Section',     50, { instanceOverridable: false }),
    lengthParam('balSpacingMm',  'Baluster Spacing', 115, { instanceOverridable: false }),
  ],
  defaultTypes: [
    {
      id:         'builtin:railing:post_and_rail:1050',
      name:       'Post and Rail 1050',
      familyId:   'builtin:railing:post_and_rail',
      discipline: 'railing',
      parameters: { guardHeightMm: 1050 },
      isBuiltIn:  true,
    },
    {
      id:         'builtin:railing:post_and_rail:1100',
      name:       'Post and Rail 1100',
      familyId:   'builtin:railing:post_and_rail',
      discipline: 'railing',
      parameters: { guardHeightMm: 1100 },
      isBuiltIn:  true,
    },
  ],
};

// ── exports ───────────────────────────────────────────────────────────────────

export const BUILT_IN_FAMILIES: FamilyDefinition[] = [
  SINGLE_DOOR,
  DOUBLE_DOOR,
  CASEMENT_WINDOW,
  FIXED_WINDOW,
  STRAIGHT_STAIR,
  POST_AND_RAIL,
];

export function getFamilyById(id: string): FamilyDefinition | undefined {
  return BUILT_IN_FAMILIES.find(f => f.id === id);
}

export function getTypeById(id: string): FamilyDefinition['defaultTypes'][number] | undefined {
  for (const family of BUILT_IN_FAMILIES) {
    const found = family.defaultTypes.find(t => t.id === id);
    if (found) return found;
  }
  return undefined;
}
