/** @typedef {Record<string, unknown>} BimCommand */

/** Closed CCW footing outline (aligned to wall spine grid from the canonical one-family footprint). */
const EG_OUTLINE_MM = [
  { xMm: 5000, yMm: 4000 },
  { xMm: 17000, yMm: 4000 },
  { xMm: 17000, yMm: 12400 },
  { xMm: 5000, yMm: 12400 },
];

/** Stair shaft through EG + OG slabs (aligned to main hall run east–west). */
const STAIR_SHAFT_MM = [
  { xMm: 10280, yMm: 7800 },
  { xMm: 14920, yMm: 7800 },
  { xMm: 14920, yMm: 8900 },
  { xMm: 10280, yMm: 8900 },
];

/**
 * Canonical one-family footprint + two-storey “golden” scaffolding used by CLI `plan-house`,
 * `scripts/apply-one-family-home.mjs`, and agent regressions.
 * Geometry follows the original single-storey sleeper + spine junction (T-aligned).
 * Adds Upper level slab, EG/OG floors, slab openings, stair, roof slice, façade duplicate on Upper,
 * documentation scaffolding (templates, schedules, sections, sheets), sample family/type assignments,
 * and extra viewpoints suitable for Evidence / screenshot baselines.
 * @returns {BimCommand[]}
 */
export function buildOneFamilyHomeCommands() {
  return [
    { type: 'createLevel', id: 'hf-lvl-1', name: 'Ground', elevationMm: 0 },

    {
      type: 'createWall',
      id: 'hf-w-so',
      name: 'South facade',
      levelId: 'hf-lvl-1',
      start: { xMm: 5000, yMm: 4000 },
      end: { xMm: 17000, yMm: 4000 },
      thicknessMm: 200,
      heightMm: 2800,
    },
    {
      type: 'createWall',
      id: 'hf-w-ea',
      name: 'East facade',
      levelId: 'hf-lvl-1',
      start: { xMm: 17000, yMm: 4000 },
      end: { xMm: 17000, yMm: 12400 },
      thicknessMm: 200,
      heightMm: 2800,
    },
    {
      type: 'createWall',
      id: 'hf-w-no',
      name: 'North facade',
      levelId: 'hf-lvl-1',
      start: { xMm: 17000, yMm: 12400 },
      end: { xMm: 5000, yMm: 12400 },
      thicknessMm: 200,
      heightMm: 2800,
    },
    {
      type: 'createWall',
      id: 'hf-w-we',
      name: 'West facade',
      levelId: 'hf-lvl-1',
      start: { xMm: 5000, yMm: 12400 },
      end: { xMm: 5000, yMm: 4000 },
      thicknessMm: 200,
      heightMm: 2800,
    },

    {
      type: 'createWall',
      id: 'hf-w-spine',
      name: 'Main spine hall',
      levelId: 'hf-lvl-1',
      start: { xMm: 11000, yMm: 4180 },
      end: { xMm: 11000, yMm: 12220 },
      thicknessMm: 200,
      heightMm: 2800,
    },

    {
      type: 'createWall',
      id: 'hf-w-split-w',
      name: 'West sleeper',
      levelId: 'hf-lvl-1',
      start: { xMm: 5220, yMm: 8150 },
      end: { xMm: 10900, yMm: 8150 },
      thicknessMm: 200,
      heightMm: 2800,
    },
    {
      type: 'createWall',
      id: 'hf-w-split-e',
      name: 'East sleeper',
      levelId: 'hf-lvl-1',
      start: { xMm: 11100, yMm: 8150 },
      end: { xMm: 16780, yMm: 8150 },
      thicknessMm: 200,
      heightMm: 2800,
    },

    {
      type: 'createWall',
      id: 'hf-w-bath-ns',
      name: 'Bath partition',
      levelId: 'hf-lvl-1',
      start: { xMm: 7400, yMm: 4180 },
      end: { xMm: 7400, yMm: 8040 },
      thicknessMm: 150,
      heightMm: 2800,
    },
    {
      type: 'createWall',
      id: 'hf-w-bath-ew',
      name: 'Bath head wall',
      levelId: 'hf-lvl-1',
      start: { xMm: 5280, yMm: 8040 },
      end: { xMm: 7260, yMm: 8040 },
      thicknessMm: 150,
      heightMm: 2800,
    },

    {
      type: 'createWall',
      id: 'hf-w-bed2-ns',
      name: 'NE bedroom split',
      levelId: 'hf-lvl-1',
      start: { xMm: 14200, yMm: 8360 },
      end: { xMm: 14200, yMm: 12180 },
      thicknessMm: 200,
      heightMm: 2800,
    },

    /** Upper datum for second-storey slab — 2800 storey height typical for residential demos. */
    { type: 'createLevel', id: 'hf-lvl-2', name: 'Upper', elevationMm: 2800 },

    {
      type: 'createFloor',
      id: 'hf-fl-eg',
      name: 'EG structural slab',
      levelId: 'hf-lvl-1',
      boundaryMm: EG_OUTLINE_MM,
      thicknessMm: 220,
      structureThicknessMm: 160,
      finishThicknessMm: 40,
      roomBounded: false,
    },

    {
      type: 'createSlabOpening',
      id: 'hf-opening-stair-eg',
      name: 'Stair shaft (EG slab)',
      hostFloorId: 'hf-fl-eg',
      boundaryMm: STAIR_SHAFT_MM,
      isShaft: true,
    },

    /** Upper shell uses the same façade lines (stacked construction). Open hall + loft/studio programmatic rooms. */
    {
      type: 'createWall',
      id: 'hf-u-w-so',
      name: 'Upper south facade',
      levelId: 'hf-lvl-2',
      start: { xMm: 5000, yMm: 4000 },
      end: { xMm: 17000, yMm: 4000 },
      thicknessMm: 200,
      heightMm: 2600,
    },
    {
      type: 'createWall',
      id: 'hf-u-w-ea',
      name: 'Upper east facade',
      levelId: 'hf-lvl-2',
      start: { xMm: 17000, yMm: 4000 },
      end: { xMm: 17000, yMm: 12400 },
      thicknessMm: 200,
      heightMm: 2600,
    },
    {
      type: 'createWall',
      id: 'hf-u-w-no',
      name: 'Upper north facade',
      levelId: 'hf-lvl-2',
      start: { xMm: 17000, yMm: 12400 },
      end: { xMm: 5000, yMm: 12400 },
      thicknessMm: 200,
      heightMm: 2600,
    },
    {
      type: 'createWall',
      id: 'hf-u-w-we',
      name: 'Upper west facade',
      levelId: 'hf-lvl-2',
      start: { xMm: 5000, yMm: 12400 },
      end: { xMm: 5000, yMm: 4000 },
      thicknessMm: 200,
      heightMm: 2600,
    },

    /** Light partition zoning on Upper near previous NE split line. */
    {
      type: 'createWall',
      id: 'hf-u-w-split-ns',
      name: 'Upper studio split',
      levelId: 'hf-lvl-2',
      start: { xMm: 13800, yMm: 8600 },
      end: { xMm: 13800, yMm: 12080 },
      thicknessMm: 150,
      heightMm: 2600,
    },

    {
      type: 'createFloor',
      id: 'hf-fl-og',
      name: 'OG structural slab',
      levelId: 'hf-lvl-2',
      boundaryMm: EG_OUTLINE_MM,
      thicknessMm: 220,
      structureThicknessMm: 160,
      finishThicknessMm: 40,
      roomBounded: false,
    },

    {
      type: 'createSlabOpening',
      id: 'hf-opening-stair-og',
      name: 'Stair shaft (OG slab)',
      hostFloorId: 'hf-fl-og',
      boundaryMm: STAIR_SHAFT_MM,
      isShaft: true,
    },

    /** Run horizontally across corridor with ~15×275 mm treads for 2800 mm vertical rise ×175 mm risers. */
    {
      type: 'createStair',
      id: 'hf-stair-main',
      name: 'Hall stair',
      baseLevelId: 'hf-lvl-1',
      topLevelId: 'hf-lvl-2',
      runStartMm: { xMm: 10400, yMm: 8350 },
      runEndMm: { xMm: 14700, yMm: 8350 },
      widthMm: 1050,
      riserMm: 175,
      treadMm: 275,
    },

    {
      type: 'createRailing',
      id: 'hf-rail-stair-s',
      name: 'Stair guardrail south',
      hostedStairId: 'hf-stair-main',
      pathMm: [
        { xMm: 10350, yMm: 7830 },
        { xMm: 14870, yMm: 7830 },
      ],
    },

    /** Reference roof modeled as simple footprint prism on Upper datum (production roof solver out of MVP scope). */
    {
      type: 'createRoof',
      id: 'hf-roof-main',
      name: 'Hip roof prism (demo)',
      referenceLevelId: 'hf-lvl-2',
      footprintMm: EG_OUTLINE_MM,
      overhangMm: 450,
      slopeDeg: 32,
    },

    {
      type: 'createRoomOutline',
      id: 'hf-room-bath',
      name: 'Bath',
      levelId: 'hf-lvl-1',
      outlineMm: [
        { xMm: 5320, yMm: 4320 },
        { xMm: 7180, yMm: 4320 },
        { xMm: 7180, yMm: 7860 },
        { xMm: 5320, yMm: 7860 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-kitchen',
      name: 'Kitchen / dining',
      levelId: 'hf-lvl-1',
      outlineMm: [
        { xMm: 7560, yMm: 4320 },
        { xMm: 10680, yMm: 4320 },
        { xMm: 10680, yMm: 7920 },
        { xMm: 7560, yMm: 7920 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bed3',
      name: 'Bedroom west',
      levelId: 'hf-lvl-1',
      outlineMm: [
        { xMm: 5280, yMm: 8420 },
        { xMm: 10680, yMm: 8420 },
        { xMm: 10680, yMm: 12200 },
        { xMm: 5280, yMm: 12200 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-master',
      name: 'Master bedroom',
      levelId: 'hf-lvl-1',
      outlineMm: [
        { xMm: 11320, yMm: 4320 },
        { xMm: 16680, yMm: 4320 },
        { xMm: 16680, yMm: 7920 },
        { xMm: 11320, yMm: 7920 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-living',
      name: 'Living',
      levelId: 'hf-lvl-1',
      outlineMm: [
        { xMm: 11320, yMm: 8480 },
        { xMm: 14040, yMm: 8480 },
        { xMm: 14040, yMm: 12120 },
        { xMm: 11320, yMm: 12120 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bed2',
      name: 'Bedroom NE',
      levelId: 'hf-lvl-1',
      outlineMm: [
        { xMm: 14480, yMm: 8560 },
        { xMm: 16680, yMm: 8560 },
        { xMm: 16680, yMm: 12120 },
        { xMm: 14480, yMm: 12120 },
      ],
    },

    /** Upper storey rooms (“loft” zoning). */
    {
      type: 'createRoomOutline',
      id: 'hf-room-u-loft',
      name: 'Loft west',
      levelId: 'hf-lvl-2',
      outlineMm: [
        { xMm: 5380, yMm: 8680 },
        { xMm: 10680, yMm: 8680 },
        { xMm: 10680, yMm: 12080 },
        { xMm: 5380, yMm: 12080 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-u-studio',
      name: 'Studio east',
      levelId: 'hf-lvl-2',
      outlineMm: [
        { xMm: 11200, yMm: 8680 },
        { xMm: 16680, yMm: 8680 },
        { xMm: 16680, yMm: 12080 },
        { xMm: 11200, yMm: 12080 },
      ],
    },

    {
      type: 'updateElementProperty',
      elementId: 'hf-room-kitchen',
      key: 'programmeCode',
      value: 'KIT-BUNDLE',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-room-bath',
      key: 'programmeCode',
      value: 'WET-BUNDLE',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-room-master',
      key: 'programmeCode',
      value: 'BED-BUNDLE',
    },

    {
      type: 'upsertRoomVolume',
      roomId: 'hf-room-bath',
      upperLimitLevelId: 'hf-lvl-2',
      volumeCeilingOffsetMm: -120,
    },

    /** Sample reusable family/catalog entries tied to openings (cleanroom-lite metadata optional). */
    {
      type: 'upsertFamilyType',
      id: 'hf-ft-door-entry',
      name: 'ENT-001',
      discipline: 'door',
      parameters: { manufacturer: 'GoldenFixture', thermalZone: 'exterior', fireRating: 'EI30' },
    },
    {
      type: 'upsertFamilyType',
      id: 'hf-ft-window-ribbon',
      name: 'WIN-RIB-A',
      discipline: 'window',
      parameters: { glazingLayers: 'double', uw: '1.1' },
    },

    /** View templates scaffold for future plan-style toggles / AI agent narration. */
    {
      type: 'upsertViewTemplate',
      id: 'hf-vt-plan-eg-opening',
      name: 'Plan — openings focus',
      scale: 'scale_100',
      hiddenCategories: ['dimension'],
    },
    {
      type: 'upsertViewTemplate',
      id: 'hf-vt-plan-og-rooms',
      name: 'Plan — room fills',
      scale: 'scale_100',
    },

    {
      type: 'upsertPlanView',
      id: 'hf-plan-eg-openings',
      name: 'EG — openings focus',
      levelId: 'hf-lvl-1',
      viewTemplateId: 'hf-vt-plan-eg-opening',
      planPresentation: 'opening_focus',
      categoriesHidden: ['room'],
    },
    {
      type: 'upsertPlanView',
      id: 'hf-plan-og-rooms',
      name: 'OG — room fills',
      levelId: 'hf-lvl-2',
      viewTemplateId: 'hf-vt-plan-og-rooms',
      planPresentation: 'room_scheme',
    },

    /** Longitudinal demo section across the corridor + stair shaft. */
    {
      type: 'createSectionCut',
      id: 'hf-sec-longitudinal',
      name: 'Hall + stair longitudinal',
      lineStartMm: { xMm: 11200, yMm: 6000 },
      lineEndMm: { xMm: 11200, yMm: 11800 },
      cropDepthMm: 14000,
    },

    /** Sheet + schedule authoring placeholders (coordinates are mm on paper metaphor). */
    {
      type: 'upsertSheet',
      id: 'hf-sheet-ga01',
      name: 'GA-01 — Golden evidence',
      titleBlock: 'A1‑Golden',
      paperWidthMm: 42000,
      paperHeightMm: 29700,
      titleblockParameters: {
        projectName: 'One‑family golden',
        sheetNumber: 'GA‑01',
        revision: '3',
        drawnBy: 'bundle',
      },
    },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-room',
      name: 'Room schedule — golden',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-room',
      filters: { category: 'room', discipline: 'architecture' },
    },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-window',
      name: 'Window schedule — golden',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-window',
      filters: {
        category: 'window',
        groupingHint: ['levelId', 'familyTypeMark'],
      },
    },

    {
      type: 'upsertSchedule',
      id: 'hf-sch-door',
      name: 'Door schedule — golden',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-door',
      filters: { category: 'door', discipline: 'architecture' },
    },

    {
      type: 'upsertSchedule',
      id: 'hf-sch-floor',
      name: 'Floor schedule — golden',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-floor',
      filters: { category: 'floor' },
    },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-roof',
      name: 'Roof schedule — golden',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-roof',
      filters: { category: 'roof' },
    },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-stair',
      name: 'Stair schedule — golden',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-stair',
      filters: { category: 'stair' },
    },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-sheet',
      name: 'Sheet index — golden',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-sheet',
      filters: { category: 'sheet' },
    },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-plan-view',
      name: 'Plan views — golden',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-plan-view',
      filters: { category: 'plan_view' },
    },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-section',
      name: 'Section cuts — golden',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-section',
      filters: { category: 'section_cut' },
    },

    {
      type: 'upsertSheetViewports',
      sheetId: 'hf-sheet-ga01',
      viewportsMm: [
        {
          viewportId: 'vp-plan-eg',
          label: 'EG plan (named view)',
          viewRef: 'plan:hf-plan-eg-openings',
          xMm: 1200,
          yMm: 1800,
          widthMm: 9000,
          heightMm: 9000,
        },
        {
          viewportId: 'vp-sec-demo',
          label: 'Section scaffold',
          viewRef: 'section:hf-sec-longitudinal',
          xMm: 10800,
          yMm: 1800,
          widthMm: 4200,
          heightMm: 9000,
        },
        {
          viewportId: 'vp-sch-windows',
          label: 'Window schedule',
          viewRef: 'schedule:hf-sch-window',
          xMm: 1200,
          yMm: 11200,
          widthMm: 13800,
          heightMm: 3200,
        },
      ],
    },

    {
      type: 'createDimension',
      id: 'hf-dim-span',
      name: 'House width check',
      levelId: 'hf-lvl-1',
      aMm: { xMm: 5000, yMm: 3200 },
      bMm: { xMm: 17000, yMm: 3200 },
      offsetMm: { xMm: 0, yMm: 600 },
    },

    {
      type: 'insertDoorOnWall',
      id: 'hf-door-entry',
      name: 'Front entry',
      wallId: 'hf-w-so',
      alongT: 0.5,
      widthMm: 980,
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-bath',
      name: 'Bath door',
      wallId: 'hf-w-bath-ns',
      alongT: 0.42,
      widthMm: 820,
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-kitchen-hall',
      name: 'Kitchen to hall',
      wallId: 'hf-w-spine',
      alongT: 0.2,
      widthMm: 900,
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-bed3',
      name: 'Hall to west bedroom',
      wallId: 'hf-w-spine',
      alongT: 0.66,
      widthMm: 860,
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-master',
      name: 'Hall to master',
      wallId: 'hf-w-split-e',
      alongT: 0.45,
      widthMm: 920,
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-bed2',
      name: 'Hall to NE bedroom',
      wallId: 'hf-w-bed2-ns',
      alongT: 0.45,
      widthMm: 860,
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-u-door-bridge',
      name: 'Upper hall door (demo)',
      wallId: 'hf-u-w-split-ns',
      alongT: 0.5,
      widthMm: 900,
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-living',
      name: 'Living ribbon',
      wallId: 'hf-w-ea',
      alongT: 0.65,
      widthMm: 2200,
      sillHeightMm: 900,
      heightMm: 1500,
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-kitchen',
      name: 'Kitchen window',
      wallId: 'hf-w-so',
      alongT: 0.24,
      widthMm: 1600,
      sillHeightMm: 1000,
      heightMm: 1200,
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-bed-west',
      name: 'West bedroom',
      wallId: 'hf-w-we',
      alongT: 0.45,
      widthMm: 1800,
      sillHeightMm: 900,
      heightMm: 1500,
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-master',
      name: 'Master window',
      wallId: 'hf-w-ea',
      alongT: 0.28,
      widthMm: 2000,
      sillHeightMm: 900,
      heightMm: 1500,
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-u-win-living-stack',
      name: 'Living stack (Upper)',
      wallId: 'hf-u-w-ea',
      alongT: 0.62,
      widthMm: 2000,
      sillHeightMm: 900,
      heightMm: 1500,
    },

    {
      type: 'assignOpeningFamily',
      openingId: 'hf-door-entry',
      familyTypeId: 'hf-ft-door-entry',
      cutDepthMm: 260,
      revealInteriorMm: 15,
    },
    {
      type: 'assignOpeningFamily',
      openingId: 'hf-win-living',
      familyTypeId: 'hf-ft-window-ribbon',
      cutDepthMm: 260,
      revealInteriorMm: 40,
    },

    {
      type: 'saveViewpoint',
      id: 'hf-vp-orbit',
      name: 'CLI exterior orbit',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 21000, yMm: -12000, zMm: 14000 },
        target: { xMm: 11000, yMm: 8200, zMm: 0 },
        up: { xMm: 0, yMm: 0, zMm: 1000 },
      },
    },

    /** Interior cut-away camera for evidence regressions vs Revit screenshots. */
    {
      type: 'saveViewpoint',
      id: 'hf-vp-cutaway-core',
      name: '3D cut corridor',
      mode: 'orbit_3d',
      viewerClipCapElevMm: 5600,
      viewerClipFloorElevMm: 0,
      hiddenSemanticKinds3d: ['roof'],
      camera: {
        position: { xMm: 9800, yMm: 14800, zMm: 4200 },
        target: { xMm: 12000, yMm: 8800, zMm: 1400 },
        up: { xMm: 0, yMm: 0, zMm: 1000 },
      },
    },

    /** Plan-aligned seed (browser may still derive camera from tooling). */
    {
      type: 'saveViewpoint',
      id: 'hf-vp-plan-eg-demo',
      name: 'Seed plan EG',
      mode: 'plan_canvas',
      camera: {
        position: { xMm: 11000, yMm: 25000, zMm: 8200 },
        target: { xMm: 11000, yMm: 8200, zMm: 0 },
        up: { xMm: 0, yMm: 0, zMm: 1000 },
      },
    },
  ];
}
