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
  | 'wall_opening'
  | 'room'
  | 'grid_line'
  | 'dimension'
  | 'viewpoint'
  | 'issue'
  | 'floor'
  | 'roof'
  | 'stair'
  | 'slab_opening'
  | 'roof_opening'
  | 'railing'
  | 'family_type'
  | 'room_separation'
  | 'plan_region'
  | 'tag_definition'
  | 'join_geometry'
  | 'section_cut'
  | 'elevation_view'
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
  | 'project_param'
  | 'reference_plane'
  | 'property_line'
  | 'selection_set'
  | 'clash_test'
  | 'text_3d'
  | 'project_base_point'
  | 'survey_point'
  | 'internal_origin'
  | 'link_model'
  | 'placed_tag'
  | 'detail_line'
  | 'detail_region'
  | 'text_note'
  | 'sweep'
  | 'dormer'
  | 'balcony'
  | 'area'
  | 'masking_region';

export type Text3dFontFamily = 'helvetiker' | 'optimer' | 'gentilis';

export type XY = { xMm: number; yMm: number };

/** KRN-07: a single straight flight in a multi-run stair. */
export type StairRun = {
  id: string;
  startMm: XY;
  endMm: XY;
  widthMm: number;
  riserCount: number;
};

/** KRN-07: a flat polygon landing between two runs. */
export type StairLanding = {
  id: string;
  boundaryMm: XY[];
};

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

export type DoorOperationType =
  | 'swing_single'
  | 'swing_double'
  | 'sliding_single'
  | 'sliding_double'
  | 'bi_fold'
  | 'pocket'
  | 'pivot'
  | 'automatic_double';

export type WindowOutlineKind =
  | 'rectangle'
  | 'arched_top'
  | 'gable_trapezoid'
  | 'circle'
  | 'octagon'
  | 'custom';

export type WallLocationLine =
  | 'wall-centerline'
  | 'finish-face-exterior'
  | 'finish-face-interior'
  | 'core-centerline'
  | 'core-face-exterior'
  | 'core-face-interior';

/**
 * KRN-09 — kind of substitution applied to a curtain-wall grid cell.
 *
 * - `empty`: leave the cell open (no glass, no solid panel; mullions stay).
 * - `system`: render the cell as a solid panel using a registered
 *   `materialKey`. Falls back to glass if no `materialKey` is supplied.
 * - `family_instance`: instantiate a custom family at this cell. Until
 *   FAM-01 lands the renderer paints a placeholder panel and emits a TODO.
 */
export type CurtainPanelOverrideKind = 'empty' | 'system' | 'family_instance';

export type CurtainPanelOverride = {
  kind: CurtainPanelOverrideKind;
  /** For `family_instance` overrides — id of the family type to instantiate. */
  familyTypeId?: string | null;
  /** For `system` overrides — `materialKey` resolved against the MAT-01 registry. */
  materialKey?: string | null;
};

/** Build the deterministic `gridCellId` used as the key in
 * `wall.curtainPanelOverrides`. */
export function curtainGridCellId(vIndex: number, hIndex: number): string {
  return `v${vIndex}h${hIndex}`;
}

export type SharedParamEntry = {
  guid: string;
  name: string;
  dataType: 'text' | 'number' | 'integer' | 'yesno' | 'length' | 'area' | 'volume';
};

export type SharedParamGroup = {
  groupName: string;
  parameters: SharedParamEntry[];
};

export type SelectionSetRule = {
  field: 'category' | 'level' | 'typeName';
  operator: 'equals' | 'contains';
  value: string;
};

export type ClashResult = {
  elementIdA: string;
  elementIdB: string;
  distanceMm: number;
};

export type Element =
  | {
      kind: 'project_settings';
      id: string;
      lengthUnit?: string;
      angularUnitDeg?: string;
      displayLocale?: string;
      name?: string;
      worksetId?: string | null;
      startingViewId?: string | null;
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
      worksetId?: string | null;
      monitorSourceId?: string | null;
      pinned?: boolean;
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
      /**
       * KRN-09 — per-cell panel overrides for curtain walls.
       *
       * Keys are deterministic grid-cell ids of the form `v<col>h<row>`
       * (zero-indexed; `v` = vertical column, `h` = horizontal row). Cells
       * without an override fall back to the default glass panel.
       */
      curtainPanelOverrides?: {
        [gridCellId: string]: CurtainPanelOverride;
      } | null;
      locationLine?: WallLocationLine;
      worksetId?: string | null;
      /** GAP-R5: opt out of the per-wall slab-edge expression strip on
       * elevated walls. When unset / null, the strip is emitted on any
       * single-thickness wall at level elevation > 0. */
      floorEdgeStripDisabled?: boolean | null;
      /**
       * KRN-16 — wall recess / setback zones along the wall's alongT axis.
       *
       * When set, the wall plane steps back by `setbackMm` (toward its
       * interior normal) over the alongT range `[alongTStart, alongTEnd]`.
       * Hosted openings whose alongT falls inside the zone are repositioned
       * onto the recessed surface. Use cases: loggias, deep entry porches,
       * bay windows.
       */
      recessZones?: {
        alongTStart: number;
        alongTEnd: number;
        setbackMm: number;
        sillHeightMm?: number;
        headHeightMm?: number;
        floorContinues?: boolean;
      }[];
      /** IFC-04: optional OmniClass / Uniclass / NSCC code emitted as
       *  IfcClassificationReference on the IFC product. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
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
      operationType?: DoorOperationType;
      slidingTrackSide?: 'wall_face' | 'in_pocket';
      overrideParams?: Record<string, unknown>;
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
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
      outlineKind?: WindowOutlineKind;
      outlineMm?: XY[];
      attachedRoofId?: string | null;
      overrideParams?: Record<string, unknown>;
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
    }
  | {
      kind: 'wall_opening';
      id: string;
      name?: string;
      hostWallId: string;
      alongTStart: number;
      alongTEnd: number;
      sillHeightMm: number;
      headHeightMm: number;
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
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
    }
  | {
      kind: 'grid_line';
      id: string;
      name: string;
      start: XY;
      end: XY;
      label: string;
      levelId?: string | null;
      worksetId?: string | null;
      monitorSourceId?: string | null;
      pinned?: boolean;
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
      /** PLN-01 — set by the Auto-Dimension tools so a re-run can clear them. */
      autoGenerated?: boolean;
      pinned?: boolean;
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
      hiddenElementIds?: string[];
      isolatedElementIds?: string[];
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
      worksetId?: string | null;
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
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
      roofGeometryMode?:
        | 'mass_box'
        | 'gable_pitched_rectangle'
        | 'asymmetric_gable'
        | 'gable_pitched_l_shape'
        | 'hip'
        | 'flat';
      ridgeOffsetTransverseMm?: number;
      eaveHeightLeftMm?: number;
      eaveHeightRightMm?: number;
      roofTypeId?: string | null;
      materialKey?: string | null;
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
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
      /** KRN-07: stair shape kind. Defaults to 'straight'; multi-run shapes carry runs+landings. */
      shape?: 'straight' | 'l_shape' | 'u_shape' | 'spiral' | 'sketch';
      /** KRN-07: ordered runs for multi-run stairs. Empty = legacy single-run from runStartMm/runEndMm. */
      runs?: StairRun[];
      /** KRN-07: landings between runs (one per gap). */
      landings?: StairLanding[];
      overrideParams?: Record<string, unknown>;
      pinned?: boolean;
    }
  | {
      kind: 'slab_opening';
      id: string;
      name: string;
      hostFloorId: string;
      boundaryMm: XY[];
      isShaft?: boolean;
      pinned?: boolean;
    }
  | {
      /** IFC-03: opening hosted on a roof (skylight / roof penetration). */
      kind: 'roof_opening';
      id: string;
      name: string;
      hostRoofId: string;
      boundaryMm: XY[];
      pinned?: boolean;
    }
  | {
      kind: 'railing';
      id: string;
      name: string;
      hostedStairId?: string | null;
      pathMm: XY[];
      guardHeightMm?: number;
      overrideParams?: Record<string, unknown>;
      pinned?: boolean;
    }
  | {
      kind: 'family_type';
      id: string;
      name: string;
      familyId: string;
      discipline: FamilyDiscipline;
      parameters: Record<string, unknown>;
      isBuiltIn?: boolean;
      /** FAM-08 — provenance when the type was loaded from an external catalog. */
      catalogSource?: { catalogId: string; familyId: string; version: string };
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
      pinned?: boolean;
    }
  | {
      kind: 'room_separation';
      id: string;
      name: string;
      levelId: string;
      start: XY;
      end: XY;
      pinned?: boolean;
    }
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
      pinned?: boolean;
    }
  | {
      /** VIE-03: first-class N/S/E/W elevation view (sibling to section_cut). */
      kind: 'elevation_view';
      id: string;
      name: string;
      direction: 'north' | 'south' | 'east' | 'west' | 'custom';
      customAngleDeg?: number | null;
      cropMinMm?: XY | null;
      cropMaxMm?: XY | null;
      scale?: number;
      planDetailLevel?: 'coarse' | 'medium' | 'fine' | null;
      pinned?: boolean;
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
      /** PLN-02 — when true, plan rendering clips elements outside crop bounds. */
      cropEnabled?: boolean | null;
      /** PLN-02 — when true, the dashed crop frame is drawn on the plan canvas
       * even when cropEnabled is false. */
      cropRegionVisible?: boolean | null;
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
      /** PLN-01 / ANN-01 — view-local placed tag (room / door / window).
       * `autoGenerated:true` marks tags emitted by the Auto-Tag tools so a
       * re-run can remove them before regenerating. */
      kind: 'placed_tag';
      id: string;
      hostElementId: string;
      hostViewId: string;
      positionMm: XY;
      tagDefinitionId?: string | null;
      textOverride?: string | null;
      autoGenerated?: boolean;
    }
  | {
      /** ANN-01 — view-local 2D polyline (annotation only; not visible in 3D). */
      kind: 'detail_line';
      id: string;
      hostViewId: string;
      pointsMm: XY[];
      strokeMm?: number;
      colour?: string;
      style?: 'solid' | 'dashed' | 'dotted';
    }
  | {
      /** ANN-01 — view-local 2D filled region (annotation only). */
      kind: 'detail_region';
      id: string;
      hostViewId: string;
      boundaryMm: XY[];
      fillColour?: string;
      fillPattern?: 'solid' | 'hatch_45' | 'hatch_90' | 'crosshatch' | 'dots';
      strokeMm?: number;
      strokeColour?: string;
    }
  | {
      /** ANN-01 — view-local text note (annotation only). */
      kind: 'text_note';
      id: string;
      hostViewId: string;
      positionMm: XY;
      text: string;
      fontSizeMm: number;
      anchor?: 'tl' | 'tc' | 'tr' | 'cl' | 'c' | 'cr' | 'bl' | 'bc' | 'br';
      rotationDeg?: number;
      colour?: string;
    }
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
    }
  | {
      kind: 'reference_plane';
      id: string;
      name: string;
      familyEditorId: string;
      isVertical: boolean;
      offsetMm: number;
      isSymmetryRef?: boolean;
    }
  | {
      /**
       * KRN-05 project-scope reference plane: a level-anchored sketch / work-plane
       * primitive distinct from the family-editor variant above. Discriminated by
       * presence of `levelId` (and absence of `familyEditorId`).
       */
      kind: 'reference_plane';
      id: string;
      name?: string;
      levelId: string;
      startMm: XY;
      endMm: XY;
      isWorkPlane?: boolean;
      pinned?: boolean;
    }
  | {
      /**
       * KRN-01: site / zoning property boundary line. Optional `setbackMm`
       * authors a parallel offset toward the property interior.
       */
      kind: 'property_line';
      id: string;
      name?: string;
      startMm: XY;
      endMm: XY;
      setbackMm?: number;
      classification?: 'street' | 'rear' | 'side' | 'other';
      pinned?: boolean;
    }
  | {
      kind: 'selection_set';
      id: string;
      name: string;
      filterRules: SelectionSetRule[];
    }
  | {
      kind: 'clash_test';
      id: string;
      name: string;
      setAIds: string[];
      setBIds: string[];
      toleranceMm: number;
      results?: ClashResult[];
    }
  | {
      kind: 'text_3d';
      id: string;
      text: string;
      fontFamily: Text3dFontFamily;
      fontSizeMm: number;
      depthMm: number;
      positionMm: XYZ;
      rotationDeg: number;
      materialKey?: string | null;
    }
  | {
      kind: 'project_base_point';
      id: string;
      positionMm: XYZ;
      angleToTrueNorthDeg: number;
    }
  | {
      kind: 'survey_point';
      id: string;
      positionMm: XYZ;
      sharedElevationMm: number;
    }
  | {
      kind: 'internal_origin';
      id: string;
    }
  | {
      /**
       * FED-01: a link to another bim-ai model in the same DB. The host treats
       * the source's elements as read-only renderable context. Snapshot
       * expansion (`?expandLinks=true`) inlines the source's elements with
       * provenance markers so renderers can ghost them.
       */
      kind: 'link_model';
      id: string;
      name: string;
      /** UUID of another bim-ai model in the same DB. */
      sourceModelId: string;
      /**
       * `null` (or omitted) follows the source's latest revision; an integer
       * pins the snapshot to that revision. Pin/unpin UI is deferred to a
       * follow-up WP.
       */
      sourceModelRevision?: number | null;
      positionMm: XYZ;
      /** Rotation around Z applied at the source origin (degrees). */
      rotationDeg: number;
      /**
       * Only `'origin_to_origin'` is implemented in the load-bearing slice;
       * `'project_origin'` and `'shared_coords'` are deferred.
       */
      originAlignmentMode: 'origin_to_origin';
      hidden?: boolean;
      pinned?: boolean;
    }
  | {
      /**
       * KRN-15 — project-level swept solid.
       *
       * Extrudes a closed 2D `profileMm` along an open or closed
       * `pathMm` polyline. Used for fascia, gutters, mullion bodies,
       * picture-frame outlines around recessed loggias, and any
       * linear architectural feature with a constant cross-section.
       */
      kind: 'sweep';
      id: string;
      name?: string;
      levelId: string;
      pathMm: { xMm: number; yMm: number; zMm?: number }[];
      profileMm: { uMm: number; vMm: number }[];
      profilePlane: 'normal_to_path_start' | 'work_plane';
      materialKey?: string | null;
      worksetId?: string | null;
      pinned?: boolean;
    }
  | {
      /**
       * KRN-14 — dormer load-bearing slice.
       *
       * Cuts the host roof and adds dormer walls + roof at the
       * `positionOnRoof` (local roof coords; alongRidgeMm is along
       * the ridge axis, acrossRidgeMm is the perpendicular distance
       * from ridge midpoint).
       */
      kind: 'dormer';
      id: string;
      name?: string;
      hostRoofId: string;
      positionOnRoof: { alongRidgeMm: number; acrossRidgeMm: number };
      widthMm: number;
      wallHeightMm: number;
      depthMm: number;
      dormerRoofKind: 'flat' | 'shed' | 'gable' | 'hipped';
      dormerRoofPitchDeg?: number;
      wallMaterialKey?: string | null;
      roofMaterialKey?: string | null;
      hasFloorOpening?: boolean;
      pinned?: boolean;
    }
  | {
      /**
       * KRN-08 — `area` element kind for legal/permit area calculations.
       *
       * Distinct from `room`: areas may include exterior porches and exclude
       * interior shafts based on `ruleSet`. Authored via SKT-01 sketch session.
       * `computedAreaSqMm` is recomputed by the engine after every command apply.
       */
      kind: 'area';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      ruleSet: 'gross' | 'net' | 'no_rules';
      computedAreaSqMm?: number;
      pinned?: boolean;
    }
  | {
      /**
       * KRN-10 — view-local 2D filled region that occludes underlying linework.
       * Renders on plan / section / elevation as an opaque polygon above element
       * linework but below text/dimension annotations. Not visible in 3D.
       */
      kind: 'masking_region';
      id: string;
      hostViewId: string;
      boundaryMm: XY[];
      fillColor?: string;
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
