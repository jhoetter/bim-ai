import type {
  ArrayGeometryNode,
  FamilyParamDef,
  SketchLine,
  SweepGeometryNode,
} from '../families/types';
import type { AuthoredFamilyCategory } from './familyEditorPersistence';
import type { SymbolicLine, SymbolicLineSubcategory } from './FamilyEditorPropertiesPanels';
import type { FamilySketchRefPlane } from './familySketchGeometry';

export type RefPlane = FamilySketchRefPlane & {
  id: string;
  name: string;
  isVertical: boolean;
  offsetMm: number;
  isSymmetryRef: boolean;
  referenceType: 'strong_reference' | 'weak_reference' | 'not_reference';
  locked: boolean;
};

export type Param = {
  key: string;
  label: string;
  type: FamilyParamDef['type'];
  default: unknown;
  formula: string;
  instanceOverridable: boolean;
};

export type FamilyTypeRow = {
  id: string;
  name: string;
  values: Record<string, unknown>;
};

export type FamilyCategory = AuthoredFamilyCategory;

export type FamilyCategorySettings = {
  category: FamilyCategory;
  alwaysVertical: boolean;
  workPlaneBased: boolean;
  roomCalculationPoint: boolean;
  shared: boolean;
};

export type FamilyViewRange = {
  topOffsetMm: number;
  cutPlaneOffsetMm: number;
  bottomOffsetMm: number;
  viewDepthOffsetMm: number;
};

export type FamilyDimension = {
  id: string;
  refAId: string;
  refBId: string;
  lockedValueMm: number;
  paramKey: string;
  canvasOffsetMm: number;
};

export type EqConstraint = {
  id: string;
  orientation: 'vertical' | 'horizontal';
  refPlaneIds: string[];
  equalGapMm: number;
};

export type SweepDraft = {
  pathLines: SketchLine[];
  profile: SketchLine[];
  profilePlane: 'normal_to_path_start' | 'work_plane';
  parametricProfile?: SweepGeometryNode['parametricProfile'];
  copiedCircleProfiles?: Array<{
    profile: NonNullable<SweepGeometryNode['parametricProfile']>;
    lines: SketchLine[];
  }>;
  step: 'path' | 'profile';
};

export type MaterialAssignmentTarget =
  | { kind: 'param'; index: number }
  | { kind: 'sweep'; index: number };

export type ArrayDraft = {
  targetFamilyId: string;
  mode: 'linear' | 'radial';
  countParam: string;
  spacingMode: 'fixed_mm' | 'fit_total';
  fixedMm: number;
  totalLengthParam: string;
  axisStart: { xMm: number; yMm: number; zMm: number };
  axisEnd: { xMm: number; yMm: number; zMm: number };
};

export const DEFAULT_FAMILY_TYPE_ID = 'family-type-1';

export function resolveFamilyParamValue(
  param: Param,
  paramOverrides?: Record<string, unknown>,
): unknown {
  if (paramOverrides && param.key in paramOverrides) {
    const override = paramOverrides[param.key];
    if (override !== undefined && override !== '') {
      return override;
    }
  }
  return param.default;
}

export function initialFamilyTypeRows(): FamilyTypeRow[] {
  return [{ id: DEFAULT_FAMILY_TYPE_ID, name: 'Type 1', values: {} }];
}

export function applyEqConstraintToPlanes(
  planes: RefPlane[],
  constraint: EqConstraint,
): RefPlane[] {
  const indexed = constraint.refPlaneIds
    .map((id) => planes.find((plane) => plane.id === id))
    .filter((plane): plane is RefPlane => Boolean(plane))
    .sort((a, b) => a.offsetMm - b.offsetMm);
  if (indexed.length < 3) return planes;
  const first = indexed[0]!;
  const last = indexed[indexed.length - 1]!;
  const gap = (last.offsetMm - first.offsetMm) / (indexed.length - 1);
  const offsets = new Map(indexed.map((plane, i) => [plane.id, first.offsetMm + gap * i]));
  return planes.map((plane) =>
    offsets.has(plane.id) ? { ...plane, offsetMm: Math.round(offsets.get(plane.id)!) } : plane,
  );
}

export function equalGapForPlanes(planes: RefPlane[], ids: string[]): number {
  const selected = ids
    .map((id) => planes.find((plane) => plane.id === id))
    .filter((plane): plane is RefPlane => Boolean(plane))
    .sort((a, b) => a.offsetMm - b.offsetMm);
  if (selected.length < 2) return 0;
  return Math.round(
    Math.abs(selected[selected.length - 1]!.offsetMm - selected[0]!.offsetMm) /
      (selected.length - 1),
  );
}

export const DEFAULT_CATEGORY_SETTINGS: FamilyCategorySettings = {
  category: 'generic_model',
  alwaysVertical: false,
  workPlaneBased: false,
  roomCalculationPoint: false,
  shared: false,
};

export const DEFAULT_FAMILY_VIEW_RANGE: FamilyViewRange = {
  topOffsetMm: 2300,
  cutPlaneOffsetMm: 1200,
  bottomOffsetMm: 0,
  viewDepthOffsetMm: -1200,
};

export function circularProfileLines(
  centerXMm: number,
  centerYMm: number,
  radiusMm: number,
  segments = 16,
): SketchLine[] {
  return Array.from({ length: segments }, (_value, index) => {
    const a = (index / segments) * Math.PI * 2;
    const b = ((index + 1) / segments) * Math.PI * 2;
    return {
      startMm: {
        xMm: Math.round(centerXMm + Math.cos(a) * radiusMm),
        yMm: Math.round(centerYMm + Math.sin(a) * radiusMm),
      },
      endMm: {
        xMm: Math.round(centerXMm + Math.cos(b) * radiusMm),
        yMm: Math.round(centerYMm + Math.sin(b) * radiusMm),
      },
    };
  });
}

export const FURNITURE_REF_PLANES: RefPlane[] = [
  {
    id: 'furniture-center-left-right',
    name: 'Center Left/Right',
    isVertical: true,
    offsetMm: 0,
    isSymmetryRef: true,
    referenceType: 'strong_reference',
    locked: true,
  },
  {
    id: 'furniture-center-front-back',
    name: 'Center Front/Back',
    isVertical: false,
    offsetMm: 0,
    isSymmetryRef: true,
    referenceType: 'strong_reference',
    locked: true,
  },
  {
    id: 'furniture-backrest-depth',
    name: 'Backrest Depth',
    isVertical: false,
    offsetMm: 180,
    isSymmetryRef: false,
    referenceType: 'weak_reference',
    locked: false,
  },
  {
    id: 'furniture-leg-offset-x',
    name: 'Leg Offset X',
    isVertical: true,
    offsetMm: 90,
    isSymmetryRef: false,
    referenceType: 'weak_reference',
    locked: false,
  },
  {
    id: 'furniture-leg-offset-y',
    name: 'Leg Offset Y',
    isVertical: false,
    offsetMm: 90,
    isSymmetryRef: false,
    referenceType: 'weak_reference',
    locked: false,
  },
];

export const FURNITURE_PARAMS: Param[] = [
  {
    key: 'Width',
    label: 'Width',
    type: 'length_mm',
    default: 600,
    formula: '',
    instanceOverridable: false,
  },
  {
    key: 'Depth',
    label: 'Depth',
    type: 'length_mm',
    default: 600,
    formula: '',
    instanceOverridable: false,
  },
  {
    key: 'Seat_Height',
    label: 'Seat Height',
    type: 'length_mm',
    default: 450,
    formula: '',
    instanceOverridable: true,
  },
  {
    key: 'Seat_Thickness',
    label: 'Seat Thickness',
    type: 'length_mm',
    default: 80,
    formula: '',
    instanceOverridable: false,
  },
  {
    key: 'Backrest_Depth',
    label: 'Backrest Depth',
    type: 'length_mm',
    default: 180,
    formula: '',
    instanceOverridable: true,
  },
  {
    key: 'Backrest_Height',
    label: 'Backrest Height',
    type: 'length_mm',
    default: 900,
    formula: '',
    instanceOverridable: false,
  },
  {
    key: 'Leg_Radius',
    label: 'Leg Radius',
    type: 'length_mm',
    default: 25,
    formula: '',
    instanceOverridable: false,
  },
  {
    key: 'Leg_Offset',
    label: 'Leg Offset',
    type: 'length_mm',
    default: 90,
    formula: '',
    instanceOverridable: true,
  },
  {
    key: 'Show_2D_Elements',
    label: 'Show 2D Elements',
    type: 'boolean',
    default: true,
    formula: '',
    instanceOverridable: true,
  },
];

export const FURNITURE_TYPE_ROWS: FamilyTypeRow[] = [
  {
    id: DEFAULT_FAMILY_TYPE_ID,
    name: '600 x 600 Chair',
    values: {
      Width: 600,
      Depth: 600,
      Backrest_Depth: 180,
      Backrest_Height: 900,
      Leg_Offset: 90,
      Leg_Radius: 25,
    },
  },
  {
    id: 'family-type-2',
    name: '750 x 750 Lounge',
    values: {
      Width: 750,
      Depth: 750,
      Backrest_Depth: 220,
      Backrest_Height: 950,
      Leg_Offset: 110,
      Leg_Radius: 30,
    },
  },
];

export const FURNITURE_SYMBOLIC_LINES: SymbolicLine[] = [
  {
    startMm: { xMm: -300, yMm: -300 },
    endMm: { xMm: 300, yMm: -300 },
    subcategory: 'symbolic',
    visibilityBinding: { paramName: 'Show_2D_Elements', whenTrue: true },
    visibilityByDetailLevel: { medium: false, fine: false },
  },
  {
    startMm: { xMm: 300, yMm: -300 },
    endMm: { xMm: 300, yMm: 300 },
    subcategory: 'symbolic',
    visibilityBinding: { paramName: 'Show_2D_Elements', whenTrue: true },
    visibilityByDetailLevel: { medium: false, fine: false },
  },
  {
    startMm: { xMm: 300, yMm: 300 },
    endMm: { xMm: -300, yMm: 300 },
    subcategory: 'symbolic',
    visibilityBinding: { paramName: 'Show_2D_Elements', whenTrue: true },
    visibilityByDetailLevel: { medium: false, fine: false },
  },
  {
    startMm: { xMm: -300, yMm: 300 },
    endMm: { xMm: -300, yMm: -300 },
    subcategory: 'symbolic',
    visibilityBinding: { paramName: 'Show_2D_Elements', whenTrue: true },
    visibilityByDetailLevel: { medium: false, fine: false },
  },
  {
    startMm: { xMm: -300, yMm: 120 },
    endMm: { xMm: 300, yMm: 300 },
    subcategory: 'symbolic',
    visibilityBinding: { paramName: 'Show_2D_Elements', whenTrue: true },
    visibilityByDetailLevel: { medium: false, fine: false },
  },
];

export const FURNITURE_SWEEPS: SweepGeometryNode[] = [
  {
    kind: 'sweep',
    pathLines: [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 0, yMm: 80 } }],
    profile: [
      { startMm: { xMm: -300, yMm: -300 }, endMm: { xMm: 300, yMm: -300 } },
      { startMm: { xMm: 300, yMm: -300 }, endMm: { xMm: 300, yMm: 300 } },
      { startMm: { xMm: 300, yMm: 300 }, endMm: { xMm: -300, yMm: 300 } },
      { startMm: { xMm: -300, yMm: 300 }, endMm: { xMm: -300, yMm: -300 } },
    ],
    profilePlane: 'work_plane',
    pathLengthParam: 'Seat_Thickness',
    pathStartOffsetParam: 'Seat_Height',
    parametricProfile: {
      kind: 'rectangle',
      minX: { kind: 'formula', expression: '-Width / 2', fallbackMm: -300 },
      maxX: { kind: 'formula', expression: 'Width / 2', fallbackMm: 300 },
      minY: { kind: 'formula', expression: '-Depth / 2', fallbackMm: -300 },
      maxY: { kind: 'formula', expression: 'Depth / 2', fallbackMm: 300 },
    },
    visibilityBinding: { paramName: 'Show_2D_Elements', whenTrue: false },
    visibilityByDetailLevel: { coarse: false },
  },
  {
    kind: 'sweep',
    pathLines: [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 0, yMm: 450 } }],
    profile: [
      { startMm: { xMm: -300, yMm: 120 }, endMm: { xMm: 300, yMm: 120 } },
      { startMm: { xMm: 300, yMm: 120 }, endMm: { xMm: 300, yMm: 300 } },
      { startMm: { xMm: 300, yMm: 300 }, endMm: { xMm: -300, yMm: 300 } },
      { startMm: { xMm: -300, yMm: 300 }, endMm: { xMm: -300, yMm: 120 } },
    ],
    profilePlane: 'work_plane',
    pathStartOffsetParam: 'Seat_Height',
    pathEndOffsetParam: 'Backrest_Height',
    parametricProfile: {
      kind: 'rectangle',
      minX: { kind: 'formula', expression: '-Width / 2', fallbackMm: -300 },
      maxX: { kind: 'formula', expression: 'Width / 2', fallbackMm: 300 },
      minY: { kind: 'formula', expression: 'Depth / 2 - Backrest_Depth', fallbackMm: 120 },
      maxY: { kind: 'formula', expression: 'Depth / 2', fallbackMm: 300 },
    },
    visibilityBinding: { paramName: 'Show_2D_Elements', whenTrue: false },
    visibilityByDetailLevel: { coarse: false },
  },
  ...[
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(
    ([xSign, ySign]): SweepGeometryNode => ({
      kind: 'sweep',
      pathLines: [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 0, yMm: 450 } }],
      profile: circularProfileLines(xSign * 210, ySign * 210, 25),
      profilePlane: 'work_plane',
      pathEndOffsetParam: 'Seat_Height',
      parametricProfile: {
        kind: 'circle',
        centerX: {
          kind: 'formula',
          expression: xSign < 0 ? '-(Width / 2 - Leg_Offset)' : 'Width / 2 - Leg_Offset',
          fallbackMm: xSign * 210,
        },
        centerY: {
          kind: 'formula',
          expression: ySign < 0 ? '-(Depth / 2 - Leg_Offset)' : 'Depth / 2 - Leg_Offset',
          fallbackMm: ySign * 210,
        },
        radiusParam: 'Leg_Radius',
        fallbackRadiusMm: 25,
        segments: 24,
        editablePrimitive: 'circle',
      },
      visibilityBinding: { paramName: 'Show_2D_Elements', whenTrue: false },
      visibilityByDetailLevel: { coarse: false },
    }),
  ),
];

export const EMPTY_SYMBOLIC_LINE_DRAFT = {
  sx: 0,
  sy: 0,
  ex: 500,
  ey: 0,
  subcategory: 'symbolic' as SymbolicLineSubcategory,
};

export const EMPTY_SYMBOLIC_ALIGN_DRAFT = {
  lineIndex: 0,
  refPlaneId: '',
  locked: true,
};

export const EMPTY_SWEEP_DRAFT: SweepDraft = {
  pathLines: [],
  profile: [],
  profilePlane: 'normal_to_path_start',
  step: 'path',
};

export const EMPTY_MIRROR_DRAFT = {
  active: false,
  copy: true,
  axisStart: null as { xMm: number; yMm: number } | null,
};

export const EMPTY_CANVAS_ALIGN_DRAFT = {
  active: false,
  locked: true,
  refPlaneId: '',
};

export const EMPTY_ARRAY_DRAFT: ArrayDraft = {
  targetFamilyId: '',
  mode: 'linear',
  countParam: '',
  spacingMode: 'fixed_mm',
  fixedMm: 400,
  totalLengthParam: '',
  axisStart: { xMm: 0, yMm: 0, zMm: 0 },
  axisEnd: { xMm: 1000, yMm: 0, zMm: 0 },
};

export function arrayDraftToNode(draft: ArrayDraft): ArrayGeometryNode {
  return {
    kind: 'array',
    target: {
      kind: 'family_instance_ref',
      familyId: draft.targetFamilyId,
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      rotationDeg: 0,
      parameterBindings: {},
    },
    mode: draft.mode,
    countParam: draft.countParam,
    spacing:
      draft.spacingMode === 'fixed_mm'
        ? { kind: 'fixed_mm', mm: draft.fixedMm }
        : { kind: 'fit_total', totalLengthParam: draft.totalLengthParam },
    axisStart: draft.axisStart,
    axisEnd: draft.axisEnd,
  };
}
