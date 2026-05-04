export type ElemKind =
  | 'project_settings'
  | 'wall_type'
  | 'level'
  | 'wall'
  | 'door'
  | 'window'
  | 'room'
  | 'grid_line'
  | 'dimension'
  | 'viewpoint'
  | 'issue'
  | 'floor'
  | 'roof'
  | 'stair'
  | 'slab_opening'
  | 'railing'
  | 'family_type'
  | 'room_separation'
  | 'plan_region'
  | 'tag_definition'
  | 'join_geometry'
  | 'section_cut'
  | 'plan_view'
  | 'view_template'
  | 'sheet'
  | 'schedule'
  | 'callout'
  | 'bcf'
  | 'validation_rule';

export type XY = { xMm: number; yMm: number };

/** Floor-plan graphic detail preset (view template + optional plan_view override). */
export type PlanDetailLevelPlan = 'coarse' | 'medium' | 'fine';

export type XYZ = { xMm: number; yMm: number; zMm: number };

export type WallLayerFunction = 'structure' | 'insulation' | 'finish';

export type WallTypeLayer = {
  thicknessMm: number;
  function: WallLayerFunction;
  materialKey?: string | null;
};

export type Element =
  | {
      kind: 'project_settings';
      id: string;
      lengthUnit?: string;
      angularUnitDeg?: string;
      displayLocale?: string;
      name?: string;
    }
  | {
      kind: 'wall_type';
      id: string;
      name: string;
      layers: WallTypeLayer[];
      basisLine?: 'center' | 'face_interior' | 'face_exterior';
    }
  | {
      kind: 'level';
      id: string;
      name: string;
      elevationMm: number;
      datumKind?: string | null;
      parentLevelId?: string | null;
      offsetFromParentMm?: number;
    }
  | {
      kind: 'wall';
      id: string;
      name: string;
      levelId: string;
      start: XY;
      end: XY;
      thicknessMm: number;
      heightMm: number;
      wallTypeId?: string | null;
      baseConstraintLevelId?: string | null;
      topConstraintLevelId?: string | null;
      baseConstraintOffsetMm?: number;
      topConstraintOffsetMm?: number;
      roofAttachmentId?: string | null;
      insulationExtensionMm?: number;
    }
  | {
      kind: 'door';
      id: string;
      name: string;
      wallId: string;
      alongT: number;
      widthMm: number;
      familyTypeId?: string | null;
      materialKey?: string | null;
      hostCutDepthMm?: number | null;
      revealInteriorMm?: number | null;
      interlockGrade?: string | null;
      lodPlan?: 'simple' | 'detailed' | null;
    }
  | {
      kind: 'window';
      id: string;
      name: string;
      wallId: string;
      alongT: number;
      widthMm: number;
      sillHeightMm: number;
      heightMm: number;
      familyTypeId?: string | null;
      materialKey?: string | null;
      hostCutDepthMm?: number | null;
      revealInteriorMm?: number | null;
      interlockGrade?: string | null;
      sealRebateMm?: number | null;
      lodPlan?: 'simple' | 'detailed' | null;
    }
  | {
      kind: 'room';
      id: string;
      name: string;
      levelId: string;
      outlineMm: XY[];
      upperLimitLevelId?: string | null;
      volumeCeilingOffsetMm?: number | null;
      programmeCode?: string | null;
      department?: string | null;
      functionLabel?: string | null;
      finishSet?: string | null;
    }
  | {
      kind: 'grid_line';
      id: string;
      name: string;
      start: XY;
      end: XY;
      label: string;
      levelId?: string | null;
    }
  | {
      kind: 'dimension';
      id: string;
      name: string;
      levelId: string;
      aMm: XY;
      bMm: XY;
      offsetMm: XY;
      refElementIdA?: string | null;
      refElementIdB?: string | null;
      tagDefinitionId?: string | null;
    }
  | {
      kind: 'viewpoint';
      id: string;
      name: string;
      camera: { position: XYZ; target: XYZ; up: XYZ };
      mode: 'plan_2d' | 'orbit_3d' | 'plan_canvas';
      viewerClipCapElevMm?: number | null;
      viewerClipFloorElevMm?: number | null;
      hiddenSemanticKinds3d?: string[];
    }
  | {
      kind: 'issue';
      id: string;
      title: string;
      status: 'open' | 'in_progress' | 'done';
      elementIds?: string[];
      viewpointId?: string | null;
    }
  | {
      kind: 'floor';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      thicknessMm: number;
      structureThicknessMm?: number;
      finishThicknessMm?: number;
      insulationExtensionMm?: number;
      roomBounded?: boolean;
    }
  | {
      kind: 'roof';
      id: string;
      name: string;
      referenceLevelId: string;
      footprintMm: XY[];
      overhangMm?: number;
      slopeDeg?: number | null;
      edgeSlopeFlags?: Record<string, boolean>;
    }
  | {
      kind: 'stair';
      id: string;
      name: string;
      baseLevelId: string;
      topLevelId: string;
      runStartMm: XY;
      runEndMm: XY;
      widthMm: number;
      riserMm: number;
      treadMm: number;
    }
  | {
      kind: 'slab_opening';
      id: string;
      name: string;
      hostFloorId: string;
      boundaryMm: XY[];
      isShaft?: boolean;
    }
  | {
      kind: 'railing';
      id: string;
      name: string;
      hostedStairId?: string | null;
      pathMm: XY[];
      guardHeightMm?: number;
    }
  | {
      kind: 'family_type';
      id: string;
      discipline: 'door' | 'window' | 'generic';
      parameters: Record<string, unknown>;
    }
  | { kind: 'room_separation'; id: string; name: string; levelId: string; start: XY; end: XY }
  | {
      kind: 'plan_region';
      id: string;
      name: string;
      levelId: string;
      outlineMm: XY[];
      cutPlaneOffsetMm?: number;
    }
  | {
      kind: 'tag_definition';
      id: string;
      name: string;
      tagKind: 'room' | 'sill' | 'slab_finish' | 'custom';
      discipline?: string;
    }
  | { kind: 'join_geometry'; id: string; joinedElementIds: string[]; notes?: string }
  | {
      kind: 'section_cut';
      id: string;
      name: string;
      lineStartMm: XY;
      lineEndMm: XY;
      cropDepthMm?: number;
      segmentedPathMm?: XY[];
    }
  | {
      kind: 'plan_view';
      id: string;
      name: string;
      levelId: string;
      viewTemplateId?: string | null;
      planPresentation?: 'default' | 'opening_focus' | 'room_scheme';
      underlayLevelId?: string | null;
      discipline?: string;
      phaseId?: string | null;
      cropMinMm?: XY | null;
      cropMaxMm?: XY | null;
      viewRangeBottomMm?: number | null;
      viewRangeTopMm?: number | null;
      cutPlaneOffsetMm?: number | null;
      categoriesHidden?: string[];
      planDetailLevel?: PlanDetailLevelPlan | null;
      planRoomFillOpacityScale?: number | null;
    }
  | {
      kind: 'view_template';
      id: string;
      name: string;
      scale: 'scale_50' | 'scale_100' | 'scale_200';
      disciplinesVisible?: string[];
      hiddenCategories?: string[];
      planDetailLevel?: PlanDetailLevelPlan | null;
      planRoomFillOpacityScale?: number;
    }
  | {
      kind: 'sheet';
      id: string;
      name: string;
      titleBlock?: string | null;
      viewportsMm?: unknown[];
      paperWidthMm?: number;
      paperHeightMm?: number;
      titleblockParameters?: Record<string, string>;
    }
  | {
      kind: 'schedule';
      id: string;
      name: string;
      sheetId?: string | null;
      filters?: Record<string, unknown>;
      grouping?: Record<string, unknown>;
    }
  | { kind: 'callout'; id: string; name: string; parentSheetId: string; outlineMm: XY[] }
  | { kind: 'bcf'; id: string; title: string; viewpointRef?: string | null; status?: string }
  | { kind: 'validation_rule'; id: string; name: string; ruleJson: Record<string, unknown> };

export type Violation = {
  ruleId: string;

  severity: 'info' | 'warning' | 'error';

  message: string;

  elementIds?: string[];

  blocking?: boolean;

  quickFixCommand?: Record<string, unknown> | null;

  /** When set (by constraints), Advisor can filter rows by discipline perspective */
  discipline?: string | null;
};

export type Snapshot = {
  modelId: string;

  revision: number;

  elements: Record<string, unknown>;

  violations: Violation[];
};

/** Server delta payload (camelCase aliases). */
export type ModelDelta = {
  revision: number;

  removedIds: string[];

  elements: Record<string, unknown>;

  violations: Violation[];

  clientOpId?: string;
};

export type Command = Record<string, unknown> & {
  type: string;
};

export type { PerspectiveId, WorkspaceLayoutPreset } from './workbench';
