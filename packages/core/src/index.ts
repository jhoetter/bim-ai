export type ElemKind =
  | 'project_settings'
  | 'room_color_scheme'
  | 'wall_type'
  | 'floor_type'
  | 'roof_type'
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
  | 'plan_tag_style'
  | 'plan_view'
  | 'view_template'
  | 'sheet'
  | 'schedule'
  | 'site'
  | 'callout'
  | 'bcf'
  | 'agent_assumption'
  | 'agent_deviation'
  | 'validation_rule'
  | 'column'
  | 'beam'
  | 'ceiling'
  | 'color_fill_legend'
  | 'shared_param_file'
  | 'project_param';

export type XY = { xMm: number; yMm: number };

export type SiteContextType = 'tree' | 'shrub' | 'neighbor_proxy' | 'entourage';

export type SiteContextObjectRow = {
  id: string;
  contextType: SiteContextType;
  label?: string;
  positionMm: XY;
  scale?: number;
  category?: string;
};

/** Floor-plan graphic detail preset (view template + optional plan_view override). */
export type PlanDetailLevelPlan = 'coarse' | 'medium' | 'fine';

export type PlanCategoryGraphicCategoryKey =
  | 'wall'
  | 'floor'
  | 'roof'
  | 'room'
  | 'door'
  | 'window'
  | 'stair'
  | 'grid_line'
  | 'room_separation'
  | 'dimension';

export type PlanLinePatternToken = 'solid' | 'dash_short' | 'dash_long' | 'dot';

export type PlanCategoryGraphicRow = {
  categoryKey: PlanCategoryGraphicCategoryKey;
  lineWeightFactor?: number | null;
  linePatternToken?: PlanLinePatternToken | null;
};

export type PlanTagTarget = 'opening' | 'room';

export type PlanTagBadgeStyle = 'none' | 'rounded' | 'flag';

export type XYZ = { xMm: number; yMm: number; zMm: number };

export type RoomColorSchemeRow = {
  programmeCode?: string | null;
  department?: string | null;
  schemeColorHex: string;
};

export type WallLayerFunction = 'structure' | 'insulation' | 'finish';

export type WallTypeLayer = {
  thicknessMm: number;
  function: WallLayerFunction;
  materialKey?: string | null;
};

export type EvidenceRefKind =
  | 'sheet'
  | 'viewpoint'
  | 'plan_view'
  | 'section_cut'
  | 'deterministic_png';

export type EvidenceRef = {
  kind: EvidenceRefKind;
  sheetId?: string | null;
  viewpointId?: string | null;
  planViewId?: string | null;
  sectionCutId?: string | null;
  pngBasename?: string | null;
};

export type FamilyDiscipline =
  | 'door'
  | 'window'
  | 'stair'
  | 'railing'
  | 'wall_type'
  | 'floor_type'
  | 'roof_type'
  | 'column'
  | 'beam'
  | 'generic';

export type WallLocationLine =
  | 'wall-centerline'
  | 'finish-face-exterior'
  | 'finish-face-interior'
  | 'core-centerline'
  | 'core-face-exterior'
  | 'core-face-interior';

export type SharedParamEntry = {
  guid: string;
  name: string;
  dataType: 'text' | 'number' | 'integer' | 'yesno' | 'length' | 'area' | 'volume';
};

export type SharedParamGroup = {
  groupName: string;
  parameters: SharedParamEntry[];
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
      kind: 'room_color_scheme';
      id: string;
      schemeRows: RoomColorSchemeRow[];
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
      kind: 'floor_type';
      id: string;
      name: string;
      layers: WallTypeLayer[];
    }
  | {
      kind: 'roof_type';
      id: string;
      name: string;
      layers: WallTypeLayer[];
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
      materialKey?: string | null;
      wallTypeId?: string | null;
      baseConstraintLevelId?: string | null;
      topConstraintLevelId?: string | null;
      baseConstraintOffsetMm?: number;
      topConstraintOffsetMm?: number;
      roofAttachmentId?: string | null;
      insulationExtensionMm?: number;
      isCurtainWall?: boolean;
      curtainWallVCount?: number | null;
      curtainWallHCount?: number | null;
      locationLine?: WallLocationLine;
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
      overrideParams?: Record<string, unknown>;
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
      overrideParams?: Record<string, unknown>;
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
      targetAreaM2?: number | null;
      volumeM3?: number | null;
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
      cutawayStyle?: 'none' | 'cap' | 'floor' | 'box' | null;
      sectionBoxEnabled?: boolean | null;
      sectionBoxMinMm?: { xMm: number; yMm: number; zMm: number } | null;
      sectionBoxMaxMm?: { xMm: number; yMm: number; zMm: number } | null;
    }
  | {
      kind: 'issue';
      id: string;
      title: string;
      status: 'open' | 'in_progress' | 'done';
      elementIds?: string[];
      viewpointId?: string | null;
      evidenceRefs?: EvidenceRef[];
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
      floorTypeId?: string | null;
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
      ridgeAxis?: 'x' | 'z' | null;
      roofGeometryMode?: 'mass_box' | 'gable_pitched_rectangle' | 'hip' | 'flat';
      roofTypeId?: string | null;
      materialKey?: string | null;
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
      overrideParams?: Record<string, unknown>;
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
      overrideParams?: Record<string, unknown>;
    }
  | {
      kind: 'family_type';
      id: string;
      name: string;
      familyId: string;
      discipline: FamilyDiscipline;
      parameters: Record<string, unknown>;
      isBuiltIn?: boolean;
    }
  | {
      kind: 'balcony';
      id: string;
      name: string;
      wallId: string;
      elevationMm: number;
      projectionMm?: number;
      slabThicknessMm?: number;
      balustradeHeightMm?: number;
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
      kind: 'plan_tag_style';
      id: string;
      name: string;
      tagTarget: PlanTagTarget;
      labelFields: string[];
      textSizePt: number;
      leaderVisible: boolean;
      badgeStyle: PlanTagBadgeStyle;
      colorToken: string;
      sortKey: number;
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
      planShowOpeningTags?: boolean;
      planShowRoomLabels?: boolean;
      planOpeningTagStyleId?: string | null;
      planRoomTagStyleId?: string | null;
      planCategoryGraphics?: PlanCategoryGraphicRow[];
      categoryOverrides?: Record<string, unknown>;
      viewFilters?: unknown[];
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
      planShowOpeningTags?: boolean;
      planShowRoomLabels?: boolean;
      defaultPlanOpeningTagStyleId?: string | null;
      defaultPlanRoomTagStyleId?: string | null;
      planCategoryGraphics?: PlanCategoryGraphicRow[];
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
  | {
      kind: 'site';
      id: string;
      name: string;
      referenceLevelId: string;
      boundaryMm: XY[];
      padThicknessMm?: number;
      baseOffsetMm?: number;
      northDegCwFromPlanX?: number | null;
      uniformSetbackMm?: number | null;
      contextObjects?: SiteContextObjectRow[];
    }
  | { kind: 'callout'; id: string; name: string; parentSheetId: string; outlineMm: XY[] }
  | {
      kind: 'bcf';
      id: string;
      title: string;
      viewpointRef?: string | null;
      status?: string;
      elementIds?: string[];
      planViewId?: string | null;
      sectionCutId?: string | null;
      evidenceRefs?: EvidenceRef[];
    }
  | {
      kind: 'agent_assumption';
      id: string;
      statement: string;
      source?: 'manual' | 'bundle_dry_run' | 'evidence_summary';
      closureStatus?: 'open' | 'resolved' | 'accepted' | 'deferred';
      relatedElementIds?: string[];
      relatedTopicId?: string | null;
    }
  | {
      kind: 'agent_deviation';
      id: string;
      statement: string;
      severity?: 'info' | 'warning' | 'error';
      acknowledged?: boolean;
      relatedAssumptionId?: string | null;
      relatedElementIds?: string[];
    }
  | { kind: 'validation_rule'; id: string; name: string; ruleJson: Record<string, unknown> }
  | {
      kind: 'column';
      id: string;
      name: string;
      levelId: string;
      positionMm: XY;
      bMm: number;
      hMm: number;
      heightMm: number;
      rotationDeg?: number;
      materialKey?: string | null;
      baseConstraintOffsetMm?: number;
      topConstraintLevelId?: string | null;
      topConstraintOffsetMm?: number;
    }
  | {
      kind: 'beam';
      id: string;
      name: string;
      levelId: string;
      startMm: XY;
      endMm: XY;
      widthMm: number;
      heightMm: number;
      materialKey?: string | null;
      startColumnId?: string | null;
      endColumnId?: string | null;
    }
  | {
      kind: 'ceiling';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      heightOffsetMm: number;
      thicknessMm: number;
      ceilingTypeId?: string | null;
    }
  | {
      kind: 'color_fill_legend';
      id: string;
      name: string;
      planViewId: string;
      positionMm: XY;
      schemeField: string;
    }
  | {
      kind: 'shared_param_file';
      id: string;
      name: string;
      groups: SharedParamGroup[];
    }
  | {
      kind: 'project_param';
      id: string;
      name: string;
      sharedParamGuid: string;
      categories: string[];
      instanceOrType: 'instance' | 'type';
    };

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

/** Evidence-package subtree: deterministic PNG inventory + digest hygiene (WP-F02/F03). */
export type CorrelationDigestConsistencyV1 = {
  format: 'correlationDigestConsistency_v1';

  staleRowsRelativeToPackageDigest: Record<string, unknown>[];

  rowsMissingCorrelationDigest: { kind: string; id: string }[];

  isFullyConsistent: boolean;
};

export type EvidencePixelDiffExpectationV1 = {
  format: 'pixelDiffExpectation_v1';

  status: string;

  baselineRole?: string;

  diffArtifactBasenameSuffix?: string;

  metricsPlaceholder?: Record<string, number | null>;

  thresholdPolicy_v1?: {
    format: 'pixelDiffThresholdPolicy_v1';
    enforcement?: string;
    mismatchPixelRatioFailAbove?: number;
    maxChannelDeltaFailAbove?: number;
    notes?: string;
  };

  notes?: string;
};

export type EvidenceClosureReviewV1 = {
  format: 'evidenceClosureReview_v1';

  packageSemanticDigestSha256: string;

  expectedDeterministicPngBasenames: string[];

  primaryScreenshotArtifactCount: number;

  correlationDigestConsistency: CorrelationDigestConsistencyV1;

  pixelDiffExpectation: EvidencePixelDiffExpectationV1;
};

export type { PerspectiveId, WorkspaceLayoutPreset } from './workbench';
