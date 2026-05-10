/** @typedef {Record<string, unknown>} BimCommand */

/*
 * Canonical seed: image-locked target house from spec/target-house-seed.md.
 *
 * This bundle is authored as a project-initiation model, not a decorative
 * preview. Rooms are enclosed by real walls/partitions. The mandatory roof
 * terrace is both a roof opening and visible occupied geometry.
 *
 * Coordinate convention:
 *   +xMm = east/right, +yMm = north/back. South/front facade is y <= 0.
 */

const F2F = 3000;
const GF_H = 3000;
const UPPER_W = 8000;
const GF_X0 = 1200;
const GF_X1 = 6800;
const GF_Y0 = 0;
const GF_Y1 = 8200;
const ROOF_Y0 = -450;
const D = 8200;
const WALL_T = 250;
const INT_T = 120;
const GLASS_T = 80;
const LOGGIA_Y = 1100;
const CUT_X0 = 5400;
const CUT_X1 = UPPER_W;
const CUT_Y0 = 3300;
const CUT_Y1 = 6500;
const EAVE_L = 2500;
const EAVE_R = 2350;
const RIDGE_OFF = 450;
const SLOPE_DEG = 23;
const RIDGE_X = UPPER_W / 2 + RIDGE_OFF;
const RIDGE_H_ABS =
  F2F + EAVE_L + Math.round(RIDGE_X * Math.tan((SLOPE_DEG * Math.PI) / 180));

function pt(xMm, yMm) {
  return { xMm, yMm };
}

function rect(x0, y0, x1, y1) {
  return [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
}

function areaM2(x0, y0, x1, y1) {
  return Number((((x1 - x0) * (y1 - y0)) / 1_000_000).toFixed(2));
}

function wallTypeFor(materialKey, thicknessMm) {
  if (materialKey === 'glass_clear') return 'hf-wt-glass';
  if (materialKey === 'cladding_warm_wood') return 'hf-wt-cladding';
  if (thicknessMm <= 140) return 'hf-wt-internal';
  return 'hf-wt-white-render';
}

function wall(id, name, levelId, x0, y0, x1, y1, heightMm, materialKey = null, thicknessMm = WALL_T) {
  return {
    type: 'createWall',
    id,
    name,
    levelId,
    start: pt(x0, y0),
    end: pt(x1, y1),
    thicknessMm,
    heightMm,
    wallTypeId: wallTypeFor(materialKey, thicknessMm),
    materialKey,
    isCurtainWall: materialKey === 'glass_clear',
  };
}

function profileRect(widthMm, depthMm) {
  const w = widthMm / 2;
  const d = depthMm / 2;
  return [
    { uMm: -w, vMm: -d },
    { uMm: w, vMm: -d },
    { uMm: w, vMm: d },
    { uMm: -w, vMm: d },
  ];
}

function sweep(id, name, pathMm, materialKey, widthMm = 45, depthMm = 45) {
  return {
    type: 'createSweep',
    id,
    name,
    levelId: 'hf-lvl-ground',
    pathMm,
    profileMm: profileRect(widthMm, depthMm),
    profilePlane: 'work_plane',
    materialKey,
  };
}

function room(id, name, levelId, x0, y0, x1, y1, programmeCode, functionLabel, finishSet) {
  return {
    type: 'createRoomOutline',
    id,
    name,
    levelId,
    outlineMm: rect(x0, y0, x1, y1),
    programmeCode,
    functionLabel,
    finishSet,
    targetAreaM2: areaM2(x0, y0, x1, y1),
  };
}

function asset(id, name, category, width, height, tags = []) {
  return {
    type: 'IndexAsset',
    id,
    name,
    category,
    tags: [...tags, 'seed'],
    thumbnailWidthMm: width,
    thumbnailHeightMm: height,
  };
}

function place(id, assetId, name, levelId, xMm, yMm, rotationDeg = 0) {
  return {
    type: 'PlaceAsset',
    id,
    assetId,
    name,
    levelId,
    positionMm: pt(xMm, yMm),
    rotationDeg,
  };
}

/**
 * @returns {BimCommand[]}
 */
export function buildOneFamilyHomeCommands() {
  return [
    // === PHASE 0: PROJECT SPINE ===
    {
      type: 'createProjectBasePoint',
      id: 'hf-pbp',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      angleToTrueNorthDeg: 0,
    },
    { type: 'createLevel', id: 'hf-lvl-ground', name: 'Ground Floor', elevationMm: 0 },
    { type: 'createLevel', id: 'hf-lvl-upper', name: 'First Floor', elevationMm: F2F },
    {
      type: 'upsertWallType',
      id: 'hf-wt-white-render',
      name: 'Matte white wrapper wall',
      layers: [
        { thicknessMm: 170, function: 'structure', materialKey: 'concrete' },
        { thicknessMm: 80, function: 'finish', materialKey: 'white_render' },
      ],
      basisLine: 'center',
    },
    {
      type: 'upsertWallType',
      id: 'hf-wt-cladding',
      name: 'Vertical board clad wall',
      layers: [
        { thicknessMm: 170, function: 'structure', materialKey: 'concrete' },
        { thicknessMm: 80, function: 'finish', materialKey: 'cladding_warm_wood' },
      ],
      basisLine: 'center',
    },
    {
      type: 'upsertWallType',
      id: 'hf-wt-internal',
      name: 'Internal partition 120',
      layers: [{ thicknessMm: 120, function: 'structure', materialKey: 'gypsum_board' }],
      basisLine: 'center',
    },
    {
      type: 'upsertWallType',
      id: 'hf-wt-glass',
      name: 'Clear structural glass',
      layers: [{ thicknessMm: 80, function: 'finish', materialKey: 'glass_clear' }],
      basisLine: 'center',
    },
    {
      type: 'upsertFamilyType',
      id: 'hf-ft-door-ext',
      discipline: 'door',
      parameters: { widthMm: 900, heightMm: 2100, typeMark: 'D-EXT' },
    },
    {
      type: 'upsertFamilyType',
      id: 'hf-ft-door-int',
      discipline: 'door',
      parameters: { widthMm: 850, heightMm: 2100, typeMark: 'D-INT' },
    },
    {
      type: 'upsertFamilyType',
      id: 'hf-ft-door-slider',
      discipline: 'door',
      parameters: { widthMm: 2200, heightMm: 2300, operationType: 'sliding_double', typeMark: 'D-SLD' },
    },
    {
      type: 'upsertFamilyType',
      id: 'hf-ft-window-portrait',
      discipline: 'window',
      parameters: { widthMm: 620, heightMm: 1850, typeMark: 'W-POR' },
    },
    {
      type: 'upsertFamilyType',
      id: 'hf-ft-window-trapezoid',
      discipline: 'window',
      parameters: { widthMm: 1700, heightMm: 1700, outlineKind: 'gable_trapezoid', typeMark: 'W-TRAP' },
    },

    // === PHASE 2: SKELETON ===
    wall('hf-w-gf-s', 'GF south cladded wall', 'hf-lvl-ground', GF_X0, GF_Y0, GF_X1, GF_Y0, GF_H, 'cladding_warm_wood'),
    wall('hf-w-gf-e', 'GF east cladded wall', 'hf-lvl-ground', GF_X1, GF_Y0, GF_X1, GF_Y1, GF_H, 'cladding_warm_wood'),
    wall('hf-w-gf-n', 'GF north cladded wall', 'hf-lvl-ground', GF_X1, GF_Y1, GF_X0, GF_Y1, GF_H, 'cladding_warm_wood'),
    wall('hf-w-gf-w', 'GF west cladded wall', 'hf-lvl-ground', GF_X0, GF_Y1, GF_X0, GF_Y0, GF_H, 'cladding_warm_wood'),

    wall('hf-w-uf-w', 'Upper west white wrapper wall', 'hf-lvl-upper', 0, D, 0, ROOF_Y0, 3300, 'white_render'),
    wall('hf-w-uf-e', 'Upper east white wrapper wall', 'hf-lvl-upper', UPPER_W, ROOF_Y0, UPPER_W, D, 3300, 'white_render'),
    wall('hf-w-uf-n', 'Upper north white wrapper wall', 'hf-lvl-upper', UPPER_W, D, 0, D, 3300, 'white_render'),
    wall('hf-w-uf-front-left', 'Recessed upper loggia left bay wall', 'hf-lvl-upper', 0, LOGGIA_Y, 3200, LOGGIA_Y, 3000, 'white_render'),
    wall('hf-w-uf-front-pier', 'Recessed upper loggia cladded centre pier', 'hf-lvl-upper', 3200, LOGGIA_Y, 4400, LOGGIA_Y, 3000, 'cladding_warm_wood'),
    wall('hf-w-uf-front-right', 'Recessed upper loggia right glass bay host', 'hf-lvl-upper', 4400, LOGGIA_Y, 7450, LOGGIA_Y, 3000, 'white_render'),

    {
      type: 'createFloor',
      id: 'hf-flr-ground-plinth',
      name: 'Low projecting white plinth slab',
      levelId: 'hf-lvl-ground',
      boundaryMm: rect(GF_X0 - 450, -450, GF_X1 + 450, GF_Y1 + 450),
      materialKey: 'white_render',
    },
    {
      type: 'createFloor',
      id: 'hf-flr-upper',
      name: 'Upper floor plate excluding roof terrace cutout',
      levelId: 'hf-lvl-upper',
      boundaryMm: [
        pt(0, ROOF_Y0),
        pt(UPPER_W, ROOF_Y0),
        pt(UPPER_W, CUT_Y0),
        pt(CUT_X0, CUT_Y0),
        pt(CUT_X0, CUT_Y1),
        pt(UPPER_W, CUT_Y1),
        pt(UPPER_W, D),
        pt(0, D),
      ],
      materialKey: 'white_render',
    },
    {
      type: 'createFloor',
      id: 'hf-flr-roof-terrace',
      name: 'Light grey occupied roof terrace floor',
      levelId: 'hf-lvl-upper',
      boundaryMm: rect(CUT_X0, CUT_Y0, CUT_X1, CUT_Y1),
      materialKey: 'render_light_grey',
    },

    // === PHASE 3: ENVELOPE ===
    {
      type: 'createRoof',
      id: 'hf-roof-main',
      name: 'White asymmetric folded roof shell with real terrace cutout',
      referenceLevelId: 'hf-lvl-upper',
      footprintMm: rect(0, ROOF_Y0, UPPER_W, D),
      roofGeometryMode: 'asymmetric_gable',
      ridgeOffsetTransverseMm: RIDGE_OFF,
      eaveHeightLeftMm: EAVE_L,
      eaveHeightRightMm: EAVE_R,
      slopeDeg: SLOPE_DEG,
      overhangMm: 0,
      materialKey: 'white_render',
    },
    {
      type: 'createRoofOpening',
      id: 'hf-roof-terrace-cutout',
      name: 'Large right roof terrace cutout',
      hostRoofId: 'hf-roof-main',
      boundaryMm: rect(CUT_X0, CUT_Y0, CUT_X1, CUT_Y1),
    },
    ...[
      'hf-w-uf-w',
      'hf-w-uf-e',
      'hf-w-uf-n',
      'hf-w-uf-front-left',
      'hf-w-uf-front-pier',
      'hf-w-uf-front-right',
    ].map((wallId) => ({ type: 'attachWallTopToRoof', wallId, roofId: 'hf-roof-main' })),

    wall('hf-w-roof-terrace-west-return', 'Roof terrace west white return wall', 'hf-lvl-upper', CUT_X0, CUT_Y0, CUT_X0, CUT_Y1, 1500, 'white_render'),
    wall('hf-w-roof-terrace-back-glass', 'Roof terrace recessed back glass wall', 'hf-lvl-upper', CUT_X0, CUT_Y1, CUT_X1, CUT_Y1, 2300, 'glass_clear', GLASS_T),
    wall('hf-w-roof-terrace-front-guard', 'Roof terrace front glass guard', 'hf-lvl-upper', CUT_X0, CUT_Y0, CUT_X1, CUT_Y0, 1150, 'glass_clear', GLASS_T),
    wall('hf-w-roof-terrace-east-guard', 'Roof terrace east glass guard', 'hf-lvl-upper', CUT_X1, CUT_Y0, CUT_X1, CUT_Y1, 1150, 'glass_clear', GLASS_T),

    sweep(
      'hf-sw-front-wrapper-frame',
      'Crisp white front folded-shell outline',
      [
        { xMm: 0, yMm: ROOF_Y0 - 20, zMm: F2F },
        { xMm: UPPER_W, yMm: ROOF_Y0 - 20, zMm: F2F },
        { xMm: UPPER_W, yMm: ROOF_Y0 - 20, zMm: F2F + EAVE_R },
        { xMm: RIDGE_X, yMm: ROOF_Y0 - 20, zMm: RIDGE_H_ABS },
        { xMm: 0, yMm: ROOF_Y0 - 20, zMm: F2F + EAVE_L },
        { xMm: 0, yMm: ROOF_Y0 - 20, zMm: F2F },
      ],
      'white_render',
      120,
      120,
    ),
    ...[910, 1080, 1250].map((z, i) =>
      sweep(
        `hf-sw-loggia-rail-${i + 1}`,
        `Thin black loggia rail ${i + 1}`,
        [
          { xMm: 430, yMm: ROOF_Y0 - 55, zMm: F2F + z },
          { xMm: UPPER_W - 430, yMm: ROOF_Y0 - 55, zMm: F2F + z },
        ],
        'aluminium_black',
        24,
        24,
      ),
    ),
    // === PHASE 4: OPENINGS ===
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-front-left',
      name: 'GF narrow portrait window',
      wallId: 'hf-w-gf-s',
      alongT: 0.28,
      widthMm: 620,
      heightMm: 1850,
      sillHeightMm: 280,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-stair',
      name: 'GF portrait stair window with visible treads',
      wallId: 'hf-w-gf-s',
      alongT: 0.72,
      widthMm: 620,
      heightMm: 1850,
      sillHeightMm: 280,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-front',
      name: 'Far-right recessed front door',
      wallId: 'hf-w-gf-s',
      alongT: 0.9,
      widthMm: 900,
      familyTypeId: 'hf-ft-door-ext',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-living-west',
      name: 'Living west side window',
      wallId: 'hf-w-gf-w',
      alongT: 0.67,
      widthMm: 900,
      heightMm: 1500,
      sillHeightMm: 750,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-kitchen-north',
      name: 'Kitchen north window',
      wallId: 'hf-w-gf-n',
      alongT: 0.22,
      widthMm: 1200,
      heightMm: 1250,
      sillHeightMm: 900,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-loggia-left',
      name: 'Upper loggia left sloped-top window',
      wallId: 'hf-w-uf-front-left',
      alongT: 0.48,
      widthMm: 1700,
      heightMm: 1700,
      sillHeightMm: 260,
      familyTypeId: 'hf-ft-window-trapezoid',
    },
    { type: 'updateElementProperty', elementId: 'hf-win-loggia-left', key: 'outlineKind', value: 'gable_trapezoid' },
    { type: 'updateElementProperty', elementId: 'hf-win-loggia-left', key: 'attachedRoofId', value: 'hf-roof-main' },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-loggia-glass',
      name: 'Upper loggia full-height sliding glass bay',
      wallId: 'hf-w-uf-front-right',
      alongT: 0.52,
      widthMm: 2200,
      familyTypeId: 'hf-ft-door-slider',
    },
    { type: 'updateElementProperty', elementId: 'hf-door-loggia-glass', key: 'operationType', value: 'sliding_double' },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-bed2-west',
      name: 'Secondary bedroom west window',
      wallId: 'hf-w-uf-w',
      alongT: 0.72,
      widthMm: 900,
      heightMm: 1350,
      sillHeightMm: 850,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-bath-north',
      name: 'Bathroom north clerestory',
      wallId: 'hf-w-uf-n',
      alongT: 0.45,
      widthMm: 800,
      heightMm: 700,
      sillHeightMm: 1650,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-roof-terrace',
      name: 'Recessed glass door to embedded roof terrace',
      wallId: 'hf-w-roof-terrace-back-glass',
      alongT: 0.52,
      widthMm: 1250,
      familyTypeId: 'hf-ft-door-slider',
    },
    { type: 'updateElementProperty', elementId: 'hf-door-roof-terrace', key: 'operationType', value: 'sliding_single' },

    // === PHASE 5: INTERIOR ===
    {
      type: 'createStair',
      id: 'hf-stair-main',
      name: 'Straight stair behind the right portrait window',
      baseLevelId: 'hf-lvl-ground',
      topLevelId: 'hf-lvl-upper',
      runStartMm: pt(5150, 520),
      runEndMm: pt(5150, 5150),
      widthMm: 1100,
      riserMm: 176,
      treadMm: 280,
    },
    {
      type: 'createSlabOpening',
      id: 'hf-slab-stair-opening',
      name: 'Upper stair shaft opening',
      hostFloorId: 'hf-flr-upper',
      boundaryMm: rect(4550, 450, 5750, 5450),
      isShaft: true,
    },

    wall('hf-w-gf-spine', 'GF main interior spine partition', 'hf-lvl-ground', 3950, GF_Y0, 3950, GF_Y1, 2700, null, INT_T),
    wall('hf-w-gf-wc-e', 'GF WC east partition', 'hf-lvl-ground', 2550, GF_Y0, 2550, 2300, 2700, null, INT_T),
    wall('hf-w-gf-wc-n', 'GF WC north partition', 'hf-lvl-ground', GF_X0, 2300, 2550, 2300, 2700, null, INT_T),
    wall('hf-w-gf-living-s', 'GF living south partition', 'hf-lvl-ground', 2550, 2300, 3950, 2300, 2700, null, INT_T),
    wall('hf-w-gf-hall-n', 'GF hall north partition', 'hf-lvl-ground', 3950, 5400, GF_X1, 5400, 2700, null, INT_T),

    wall('hf-w-uf-ptn-x3600', 'Upper bedroom and landing west partition', 'hf-lvl-upper', 3600, LOGGIA_Y, 3600, D, 2700, null, INT_T),
    wall('hf-w-uf-ptn-bed-split', 'Upper bedrooms split partition', 'hf-lvl-upper', 0, 4500, 3600, 4500, 2700, null, INT_T),
    wall('hf-w-uf-ptn-bath-s', 'Upper bathroom south partition', 'hf-lvl-upper', 3600, 5400, CUT_X0, 5400, 2700, null, INT_T),
    wall('hf-w-uf-ptn-terrace-south', 'Upper landing east partition before terrace', 'hf-lvl-upper', CUT_X0, LOGGIA_Y, CUT_X0, CUT_Y0, 2700, null, INT_T),
    wall('hf-w-uf-ptn-terrace-north', 'Upper landing east partition behind terrace', 'hf-lvl-upper', CUT_X0, CUT_Y1, CUT_X0, D, 2700, null, INT_T),

    {
      type: 'insertDoorOnWall',
      id: 'hf-door-gf-wc',
      name: 'Guest WC door',
      wallId: 'hf-w-gf-wc-e',
      alongT: 0.52,
      widthMm: 800,
      familyTypeId: 'hf-ft-door-int',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-gf-living',
      name: 'Door from stair hall to living dining',
      wallId: 'hf-w-gf-spine',
      alongT: 0.38,
      widthMm: 900,
      familyTypeId: 'hf-ft-door-int',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-gf-kitchen',
      name: 'Door from stair hall to kitchen',
      wallId: 'hf-w-gf-hall-n',
      alongT: 0.48,
      widthMm: 900,
      familyTypeId: 'hf-ft-door-int',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-uf-master',
      name: 'Master bedroom door',
      wallId: 'hf-w-uf-ptn-x3600',
      alongT: 0.24,
      widthMm: 850,
      familyTypeId: 'hf-ft-door-int',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-uf-bed2',
      name: 'Secondary bedroom door',
      wallId: 'hf-w-uf-ptn-x3600',
      alongT: 0.74,
      widthMm: 850,
      familyTypeId: 'hf-ft-door-int',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-uf-bath',
      name: 'Bathroom door',
      wallId: 'hf-w-uf-ptn-bath-s',
      alongT: 0.52,
      widthMm: 850,
      familyTypeId: 'hf-ft-door-int',
    },

    room('hf-room-gf-wc', 'Guest WC', 'hf-lvl-ground', GF_X0, GF_Y0, 2550, 2300, 'toilet', 'guest-wc', 'wet'),
    room('hf-room-gf-living', 'Living / dining room', 'hf-lvl-ground', GF_X0, 2300, 3950, GF_Y1, 'living', 'living-dining', 'living'),
    room('hf-room-gf-hall', 'Entrance / stair hall', 'hf-lvl-ground', 3950, GF_Y0, GF_X1, 5400, 'circulation', 'entrance-stair', 'circulation'),
    room('hf-room-gf-kitchen', 'Kitchen', 'hf-lvl-ground', 3950, 5400, GF_X1, GF_Y1, 'kitchen', 'kitchen', 'kitchen'),
    room('hf-room-uf-master', 'Master bedroom', 'hf-lvl-upper', 0, LOGGIA_Y, 3600, 4500, 'bedroom', 'master-bedroom', 'sleeping'),
    room('hf-room-uf-bed2', 'Secondary bedroom', 'hf-lvl-upper', 0, 4500, 3600, D, 'bedroom', 'secondary-bedroom', 'sleeping'),
    room('hf-room-uf-landing', 'First floor landing', 'hf-lvl-upper', 3600, LOGGIA_Y, CUT_X0, 5400, 'circulation', 'landing', 'circulation'),
    room('hf-room-uf-bath', 'Bathroom', 'hf-lvl-upper', 3600, 5400, CUT_X0, D, 'bathroom', 'family-bathroom', 'wet'),
    room('hf-room-roof-terrace', 'Embedded roof terrace', 'hf-lvl-upper', CUT_X0, CUT_Y0, CUT_X1, CUT_Y1, 'terrace', 'roof-balcony', 'external'),

    // === PHASE 6: DETAIL AND ASSETS ===
    asset('hf-asset-sofa', 'Two-seat sofa', 'furniture', 2200, 900, ['living']),
    asset('hf-asset-coffee-table', 'Coffee table', 'furniture', 1000, 600, ['living']),
    asset('hf-asset-dining-table', 'Dining table', 'furniture', 1600, 900, ['dining']),
    asset('hf-asset-kitchen-run', 'Kitchen cabinet run with sink', 'kitchen', 2500, 650, ['kitchen']),
    asset('hf-asset-kitchen-island', 'Kitchen island', 'kitchen', 1500, 850, ['kitchen']),
    asset('hf-asset-toilet', 'Toilet', 'bathroom', 700, 450, ['bathroom']),
    asset('hf-asset-basin', 'Wash basin', 'bathroom', 600, 450, ['bathroom']),
    asset('hf-asset-shower', 'Shower tray', 'bathroom', 900, 900, ['bathroom']),
    asset('hf-asset-queen-bed', 'Queen bed', 'furniture', 2000, 1600, ['bedroom']),
    asset('hf-asset-single-bed', 'Single bed', 'furniture', 2000, 900, ['bedroom']),
    asset('hf-asset-wardrobe', 'Wardrobe', 'casework', 1500, 600, ['bedroom']),
    asset('hf-asset-desk', 'Small desk', 'furniture', 1200, 600, ['study']),
    asset('hf-asset-outdoor-table', 'Outdoor table', 'furniture', 1000, 800, ['terrace']),
    asset('hf-asset-lounge-chair', 'Lounge chair', 'furniture', 800, 800, ['terrace']),

    place('hf-pa-sofa', 'hf-asset-sofa', 'Living sofa', 'hf-lvl-ground', 2550, 6800, 90),
    place('hf-pa-coffee-table', 'hf-asset-coffee-table', 'Living coffee table', 'hf-lvl-ground', 3050, 6800, 90),
    place('hf-pa-dining-table', 'hf-asset-dining-table', 'Dining table', 'hf-lvl-ground', 3000, 4900, 90),
    place('hf-pa-kitchen-run', 'hf-asset-kitchen-run', 'Kitchen cabinet run', 'hf-lvl-ground', 5300, 7900, 0),
    place('hf-pa-kitchen-island', 'hf-asset-kitchen-island', 'Kitchen island', 'hf-lvl-ground', 5350, 6500, 0),
    place('hf-pa-gf-toilet', 'hf-asset-toilet', 'Guest WC toilet', 'hf-lvl-ground', 1800, 1600, 180),
    place('hf-pa-gf-basin', 'hf-asset-basin', 'Guest WC basin', 'hf-lvl-ground', 2200, 700, 0),
    place('hf-pa-master-bed', 'hf-asset-queen-bed', 'Master bed', 'hf-lvl-upper', 1700, 3000, 90),
    place('hf-pa-master-wardrobe', 'hf-asset-wardrobe', 'Master wardrobe', 'hf-lvl-upper', 3000, 4100, 0),
    place('hf-pa-bed2', 'hf-asset-single-bed', 'Bedroom 2 bed', 'hf-lvl-upper', 1600, 6200, 90),
    place('hf-pa-bed2-desk', 'hf-asset-desk', 'Bedroom 2 desk', 'hf-lvl-upper', 2850, 7650, 0),
    place('hf-pa-bath-toilet', 'hf-asset-toilet', 'Bathroom toilet', 'hf-lvl-upper', 4200, 6350, 90),
    place('hf-pa-bath-basin', 'hf-asset-basin', 'Bathroom basin', 'hf-lvl-upper', 5050, 6350, 270),
    place('hf-pa-bath-shower', 'hf-asset-shower', 'Bathroom shower', 'hf-lvl-upper', 4750, 7600, 0),
    place('hf-pa-terrace-table', 'hf-asset-outdoor-table', 'Roof terrace outdoor table', 'hf-lvl-upper', 6850, 4850, 0),
    place('hf-pa-terrace-chair-1', 'hf-asset-lounge-chair', 'Roof terrace lounge chair 1', 'hf-lvl-upper', 6350, 3900, 0),
    place('hf-pa-terrace-chair-2', 'hf-asset-lounge-chair', 'Roof terrace lounge chair 2', 'hf-lvl-upper', 7350, 5900, 180),

    // === PHASE 7: DOCUMENTATION AND CHECKPOINT VIEWS ===
    {
      type: 'saveViewpoint',
      id: 'vp-main-iso',
      name: 'Main image-matched axonometric - front loggia and roof terrace',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: -4600, yMm: -9000, zMm: 9900 },
        target: { xMm: 4300, yMm: 3600, zMm: 4200 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-front-elev',
      name: 'Front elevation - recessed three-bay upper loggia',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 4000, yMm: -15000, zMm: 4200 },
        target: { xMm: 4000, yMm: 2100, zMm: 4200 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-side-elev-east',
      name: 'Right/east view - roof terrace cutout',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 14500, yMm: 3000, zMm: 7900 },
        target: { xMm: 5750, yMm: 4300, zMm: 4300 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-rear-axo',
      name: 'Rear/right axonometric - terrace return faces',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 12800, yMm: 12600, zMm: 10400 },
        target: { xMm: 5200, yMm: 5000, zMm: 4500 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-terrace-se',
      name: 'High roof terrace checkpoint',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 11500, yMm: 9400, zMm: 13200 },
        target: { xMm: 6500, yMm: 5000, zMm: 5100 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'upsertPlanTagStyle',
      id: 'hf-tag-room',
      name: 'Compact room labels',
      tagTarget: 'room',
      labelFields: ['name', 'area'],
      textSizePt: 9,
      leaderVisible: false,
      badgeStyle: 'rounded',
      colorToken: 'default',
      sortKey: 10,
    },
    {
      type: 'upsertRoomColorScheme',
      id: 'hf-room-colors',
      schemeRows: [
        { programmeCode: 'circulation', schemeColorHex: '#D6E5F4' },
        { programmeCode: 'living', schemeColorHex: '#E7DCC8' },
        { programmeCode: 'kitchen', schemeColorHex: '#D9E7D4' },
        { programmeCode: 'toilet', schemeColorHex: '#D8D8DE' },
        { programmeCode: 'bedroom', schemeColorHex: '#E4DAEA' },
        { programmeCode: 'bathroom', schemeColorHex: '#D7E6E7' },
        { programmeCode: 'terrace', schemeColorHex: '#D8E4D2' },
      ],
    },
    {
      type: 'upsertPlanView',
      id: 'hf-pv-ground',
      name: 'Ground floor plan',
      levelId: 'hf-lvl-ground',
      planShowRoomLabels: true,
      planRoomFillOpacityScale: 0.42,
      planDetailLevel: 'fine',
      cropMinMm: pt(500, -700),
      cropMaxMm: pt(7100, 8700),
      planRoomTagStyleId: 'hf-tag-room',
    },
    {
      type: 'upsertPlanView',
      id: 'hf-pv-upper',
      name: 'First floor and roof terrace plan',
      levelId: 'hf-lvl-upper',
      planShowRoomLabels: true,
      planRoomFillOpacityScale: 0.42,
      planDetailLevel: 'fine',
      cropMinMm: pt(-250, -700),
      cropMaxMm: pt(8250, 8500),
      planRoomTagStyleId: 'hf-tag-room',
    },
    {
      type: 'createSectionCut',
      id: 'hf-sec-loggia',
      name: 'Section through front loggia and folded roof',
      lineStartMm: pt(0, LOGGIA_Y),
      lineEndMm: pt(UPPER_W, LOGGIA_Y),
      cropDepthMm: 9000,
    },
    {
      type: 'upsertSheet',
      id: 'hf-sheet-ga01',
      name: 'GA-01 General arrangement',
      titleBlock: 'A2-bim-ai-default',
      paperWidthMm: 594,
      paperHeightMm: 420,
      titleblockParameters: {
        revisionId: 'A',
        revisionCode: 'A',
        issueDate: '2026-05-10',
        issuePurpose: 'Seedhouse project initiation',
      },
    },
    { type: 'upsertSchedule', id: 'hf-sch-rooms', name: 'Room schedule', sheetId: 'hf-sheet-ga01' },
    { type: 'upsertSchedule', id: 'hf-sch-windows', name: 'Window schedule', sheetId: 'hf-sheet-ga01' },
    { type: 'upsertSchedule', id: 'hf-sch-doors', name: 'Door schedule', sheetId: 'hf-sheet-ga01' },
    {
      type: 'upsertSheetViewports',
      sheetId: 'hf-sheet-ga01',
      viewportsMm: [
        {
          viewportId: 'vp-sheet-ground-plan',
          label: 'Ground floor plan',
          viewRef: 'plan:hf-pv-ground',
          xMm: 20,
          yMm: 20,
          widthMm: 260,
          heightMm: 180,
        },
        {
          viewportId: 'vp-sheet-upper-plan',
          label: 'First floor / roof terrace plan',
          viewRef: 'plan:hf-pv-upper',
          xMm: 300,
          yMm: 20,
          widthMm: 260,
          heightMm: 180,
        },
        {
          viewportId: 'vp-sheet-room-schedule',
          label: 'Room schedule',
          viewRef: 'schedule:hf-sch-rooms',
          xMm: 20,
          yMm: 230,
          widthMm: 170,
          heightMm: 120,
        },
        {
          viewportId: 'vp-sheet-window-schedule',
          label: 'Window schedule',
          viewRef: 'schedule:hf-sch-windows',
          xMm: 210,
          yMm: 230,
          widthMm: 170,
          heightMm: 120,
        },
        {
          viewportId: 'vp-sheet-door-schedule',
          label: 'Door schedule',
          viewRef: 'schedule:hf-sch-doors',
          xMm: 400,
          yMm: 230,
          widthMm: 170,
          heightMm: 120,
        },
      ],
    },
  ];
}
