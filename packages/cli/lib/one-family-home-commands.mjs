/** @typedef {Record<string, unknown>} BimCommand */

/*
 * Canonical seed: target house from spec/target-house-seed.md.
 *
 * The image-locked read is intentionally different from the previous seed:
 * - a smaller vertically-clad ground-floor base;
 * - a wider smooth-white upper wrapper shell;
 * - a deep front loggia inside that shell;
 * - a white asymmetric roof shell with a visible embedded roof terrace cutout.
 *
 * Coordinate convention:
 *   +xMm = east/right, +yMm = north/back. South/front facade is y=0.
 */

const F2F = 3000;
const D = 11000;
const SHELL_W = 12000;
const GF_X0 = 1800;
const GF_X1 = 10500;
const GF_W = GF_X1 - GF_X0;
const WALL_T = 250;
const PLINTH_EXT = 500;

const LOGGIA_Y = 1400;
const SHELL_FACE_Y = -450;
const SHELL_THICK = 650;

const EAVE_L = 2850;
const EAVE_R = 2500;
const RIDGE_OFF = 500;
const SLOPE_DEG = 24;
const RIDGE_X = SHELL_W / 2 + RIDGE_OFF;
const RIDGE_H_ABS =
  F2F + EAVE_L + Math.round(RIDGE_X * Math.tan((SLOPE_DEG * Math.PI) / 180));

const CUT_X0 = 7200;
const CUT_X1 = SHELL_W;
const CUT_Y0 = 2200;
const CUT_Y1 = 9000;

const CHIMNEY_X0 = 4700;
const CHIMNEY_X1 = 6200;

function rect(x0, y0, x1, y1) {
  return [
    { xMm: x0, yMm: y0 },
    { xMm: x1, yMm: y0 },
    { xMm: x1, yMm: y1 },
    { xMm: x0, yMm: y1 },
  ];
}

function roomSepRect(prefix, name, levelId, x0, y0, x1, y1) {
  return [
    {
      type: 'createRoomSeparation',
      id: `${prefix}-s`,
      name: `${name} south room separation`,
      levelId,
      start: { xMm: x0, yMm: y0 },
      end: { xMm: x1, yMm: y0 },
    },
    {
      type: 'createRoomSeparation',
      id: `${prefix}-e`,
      name: `${name} east room separation`,
      levelId,
      start: { xMm: x1, yMm: y0 },
      end: { xMm: x1, yMm: y1 },
    },
    {
      type: 'createRoomSeparation',
      id: `${prefix}-n`,
      name: `${name} north room separation`,
      levelId,
      start: { xMm: x1, yMm: y1 },
      end: { xMm: x0, yMm: y1 },
    },
    {
      type: 'createRoomSeparation',
      id: `${prefix}-w`,
      name: `${name} west room separation`,
      levelId,
      start: { xMm: x0, yMm: y1 },
      end: { xMm: x0, yMm: y0 },
    },
  ];
}

function wallTypeFor(materialKey, thicknessMm) {
  if (materialKey === 'glass_clear') return 'hf-wt-glass';
  if (materialKey === 'cladding_warm_wood') return 'hf-wt-cladding';
  if (materialKey === 'white_render') return 'hf-wt-white-render';
  if (thicknessMm <= 140) return 'hf-wt-internal';
  return 'hf-wt-white-render';
}

function wall(id, name, levelId, x0, y0, x1, y1, heightMm, materialKey = null, thicknessMm = WALL_T) {
  const cmds = [
    {
      type: 'createWall',
      id,
      name,
      levelId,
      start: { xMm: x0, yMm: y0 },
      end: { xMm: x1, yMm: y1 },
      thicknessMm,
      heightMm,
      wallTypeId: wallTypeFor(materialKey, thicknessMm),
    },
  ];
  if (materialKey) {
    cmds.push({ type: 'updateElementProperty', elementId: id, key: 'materialKey', value: materialKey });
  }
  return cmds;
}

function mass(id, name, levelId, x0, y0, x1, y1, heightMm, materialKey) {
  return {
    type: 'createMass',
    id,
    name,
    levelId,
    footprintMm: rect(x0, y0, x1, y1),
    heightMm,
    materialKey,
  };
}

function sweep(id, name, pathMm, profileMm, materialKey) {
  return {
    type: 'createSweep',
    id,
    name,
    levelId: 'hf-lvl-ground',
    pathMm,
    profileMm,
    profilePlane: 'work_plane',
    materialKey,
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

function place(id, assetId, name, levelId, x, y, rotationDeg = 0) {
  return {
    type: 'PlaceAsset',
    id,
    assetId,
    name,
    levelId,
    positionMm: { xMm: x, yMm: y },
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
      name: 'White render exterior wall',
      layers: [
        { thicknessMm: 160, function: 'structure', materialKey: 'concrete' },
        { thicknessMm: 90, function: 'finish', materialKey: 'white_render' },
      ],
      basisLine: 'center',
    },
    {
      type: 'upsertWallType',
      id: 'hf-wt-cladding',
      name: 'Vertical timber clad exterior wall',
      layers: [
        { thicknessMm: 160, function: 'structure', materialKey: 'concrete' },
        { thicknessMm: 90, function: 'finish', materialKey: 'cladding_warm_wood' },
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
      name: 'Clear glass guard / curtain wall',
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
      id: 'hf-ft-door-slider',
      discipline: 'door',
      parameters: { widthMm: 2500, heightMm: 2300, operationType: 'sliding_double', typeMark: 'D-SLD' },
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

    // === PHASE 1: IMAGE-LOCKED MASSING ===
    mass(
      'hf-mass-front-bottom-frame',
      'White wrapper bottom front frame / loggia sill',
      'hf-lvl-upper',
      0,
      SHELL_FACE_Y,
      SHELL_W,
      LOGGIA_Y,
      SHELL_THICK,
      'white_render',
    ),
    mass(
      'hf-mass-front-left-jamb',
      'White wrapper left front jamb',
      'hf-lvl-upper',
      0,
      SHELL_FACE_Y,
      SHELL_THICK,
      LOGGIA_Y,
      EAVE_L + 450,
      'white_render',
    ),
    mass(
      'hf-mass-front-right-jamb',
      'White wrapper right front jamb',
      'hf-lvl-upper',
      SHELL_W - SHELL_THICK,
      SHELL_FACE_Y,
      SHELL_W,
      LOGGIA_Y,
      EAVE_R + 650,
      'white_render',
    ),
    mass(
      'hf-mass-roof-cut-front-return',
      'White roof cutout front return face',
      'hf-lvl-upper',
      CUT_X0,
      CUT_Y0 - SHELL_THICK,
      CUT_X1,
      CUT_Y0,
      EAVE_R + 1200,
      'white_render',
    ),
    mass(
      'hf-mass-roof-cut-back-return',
      'White roof cutout back return face',
      'hf-lvl-upper',
      CUT_X0,
      CUT_Y1,
      CUT_X1,
      CUT_Y1 + SHELL_THICK,
      EAVE_R + 1200,
      'white_render',
    ),
    mass(
      'hf-mass-roof-cut-inner-return',
      'White roof cutout inner return face',
      'hf-lvl-upper',
      CUT_X0 - SHELL_THICK,
      CUT_Y0,
      CUT_X0,
      CUT_Y1,
      EAVE_R + 1200,
      'white_render',
    ),

    // === PHASE 2: STRUCTURAL SHELL ===
    ...wall('hf-w-gf-s', 'GF south cladded wall', 'hf-lvl-ground', GF_X0, 0, GF_X1, 0, F2F, 'cladding_warm_wood'),
    ...wall('hf-w-gf-e', 'GF east cladded wall', 'hf-lvl-ground', GF_X1, 0, GF_X1, D, F2F, 'cladding_warm_wood'),
    ...wall('hf-w-gf-n', 'GF north cladded wall', 'hf-lvl-ground', GF_X1, D, GF_X0, D, F2F, 'cladding_warm_wood'),
    ...wall('hf-w-gf-w', 'GF west cladded wall', 'hf-lvl-ground', GF_X0, D, GF_X0, 0, F2F, 'cladding_warm_wood'),

    ...wall('hf-w-uf-w', 'Upper white west shell wall', 'hf-lvl-upper', 0, D, 0, 0, 5600, 'white_render'),
    ...wall('hf-w-uf-e', 'Upper white east shell wall', 'hf-lvl-upper', SHELL_W, 0, SHELL_W, D, 5600, 'white_render'),
    ...wall('hf-w-uf-n', 'Upper white north shell wall', 'hf-lvl-upper', SHELL_W, D, 0, D, 5600, 'white_render'),
    ...wall('hf-w-uf-s-l', 'Recessed upper loggia left bay', 'hf-lvl-upper', SHELL_THICK, LOGGIA_Y, CHIMNEY_X0, LOGGIA_Y, 3600, 'white_render'),
    ...wall('hf-w-uf-s-c', 'Recessed upper loggia vertical cladding pier', 'hf-lvl-upper', CHIMNEY_X0, LOGGIA_Y, CHIMNEY_X1, LOGGIA_Y, 3600, 'cladding_warm_wood'),
    ...wall('hf-w-uf-s-r', 'Recessed upper loggia right glass bay host', 'hf-lvl-upper', CHIMNEY_X1, LOGGIA_Y, SHELL_W - SHELL_THICK, LOGGIA_Y, 3600, 'white_render'),

    {
      type: 'createFloor',
      id: 'hf-flr-ground',
      name: 'Projecting white plinth slab',
      levelId: 'hf-lvl-ground',
      boundaryMm: rect(GF_X0 - PLINTH_EXT, -PLINTH_EXT, GF_X1 + PLINTH_EXT, D + PLINTH_EXT),
      materialKey: 'white_render',
    },
    {
      type: 'createFloor',
      id: 'hf-flr-upper',
      name: 'Upper floor plate inside white wrapper',
      levelId: 'hf-lvl-upper',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: SHELL_W, yMm: 0 },
        { xMm: SHELL_W, yMm: CUT_Y0 },
        { xMm: CUT_X0, yMm: CUT_Y0 },
        { xMm: CUT_X0, yMm: CUT_Y1 },
        { xMm: SHELL_W, yMm: CUT_Y1 },
        { xMm: SHELL_W, yMm: D },
        { xMm: 0, yMm: D },
      ],
      materialKey: 'white_render',
    },
    {
      type: 'createFloor',
      id: 'hf-flr-roof-terrace',
      name: 'Embedded roof terrace floor inside cutout',
      levelId: 'hf-lvl-upper',
      boundaryMm: rect(CUT_X0 + 150, CUT_Y0 + 150, CUT_X1 - 180, CUT_Y1 - 150),
      materialKey: 'white_render',
    },

    // === PHASE 3: WHITE FOLDED ROOF WITH EMBEDDED BALCONY VOID ===
    {
      type: 'createRoof',
      id: 'hf-roof-main',
      name: 'White folded roof shell with terrace cutout',
      referenceLevelId: 'hf-lvl-upper',
      footprintMm: rect(0, 0, SHELL_W, D),
      roofGeometryMode: 'asymmetric_gable',
      ridgeOffsetTransverseMm: RIDGE_OFF,
      eaveHeightLeftMm: EAVE_L,
      eaveHeightRightMm: EAVE_R,
      slopeDeg: SLOPE_DEG,
      overhangMm: 320,
      materialKey: 'white_render',
    },
    {
      type: 'createRoofOpening',
      id: 'hf-roof-terrace-cutout',
      name: 'Large embedded roof terrace cutout',
      hostRoofId: 'hf-roof-main',
      boundaryMm: rect(CUT_X0, CUT_Y0, CUT_X1, CUT_Y1),
    },
    ...['hf-w-uf-w', 'hf-w-uf-e', 'hf-w-uf-n', 'hf-w-uf-s-l', 'hf-w-uf-s-c', 'hf-w-uf-s-r'].map((wallId) => ({
      type: 'attachWallTopToRoof',
      wallId,
      roofId: 'hf-roof-main',
    })),

    // Glass wall and guard surfaces inside the roof balcony.
    ...wall('hf-w-roof-terrace-glass-back', 'Roof terrace recessed glass wall', 'hf-lvl-upper', CUT_X0 + 120, CUT_Y1 - 150, CUT_X1 - 420, CUT_Y1 - 150, 2200, 'glass_clear', 90),
    ...wall('hf-w-roof-terrace-glass-side', 'Roof terrace transparent side guard', 'hf-lvl-upper', CUT_X1 - 160, CUT_Y0 + 350, CUT_X1 - 160, CUT_Y1 - 350, 1200, 'glass_clear', 80),

    // Front white picture frame and black loggia rails.
    sweep(
      'hf-sw-front-wrapper-frame',
      'Thick white front wrapper outline',
      [
        { xMm: 0, yMm: SHELL_FACE_Y, zMm: F2F },
        { xMm: SHELL_W, yMm: SHELL_FACE_Y, zMm: F2F },
        { xMm: SHELL_W, yMm: SHELL_FACE_Y, zMm: F2F + EAVE_R },
        { xMm: RIDGE_X, yMm: SHELL_FACE_Y, zMm: RIDGE_H_ABS },
        { xMm: 0, yMm: SHELL_FACE_Y, zMm: F2F + EAVE_L },
        { xMm: 0, yMm: SHELL_FACE_Y, zMm: F2F },
      ],
      rect(-120, -90, 120, 90).map((p) => ({ uMm: p.xMm, vMm: p.yMm })),
      'white_render',
    ),
    ...[900, 1080, 1260].map((z, i) =>
      sweep(
        `hf-sw-loggia-rail-${i + 1}`,
        `Black loggia rail ${i + 1}`,
        [
          { xMm: 450, yMm: SHELL_FACE_Y - 40, zMm: F2F + z },
          { xMm: SHELL_W - 450, yMm: SHELL_FACE_Y - 40, zMm: F2F + z },
        ],
        rect(-22, -22, 22, 22).map((p) => ({ uMm: p.xMm, vMm: p.yMm })),
        'aluminium_black',
      ),
    ),

    // === PHASE 4: OPENINGS AND FACADE RHYTHM ===
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-s-1',
      name: 'GF portrait window left',
      wallId: 'hf-w-gf-s',
      alongT: 0.36,
      widthMm: 620,
      heightMm: 1850,
      sillHeightMm: 250,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-s-2',
      name: 'GF stair portrait window',
      wallId: 'hf-w-gf-s',
      alongT: 0.66,
      widthMm: 620,
      heightMm: 1850,
      sillHeightMm: 250,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-living-west',
      name: 'Living room west side window',
      wallId: 'hf-w-gf-w',
      alongT: 0.5,
      widthMm: 900,
      heightMm: 1500,
      sillHeightMm: 700,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-wc-west',
      name: 'Guest WC west window',
      wallId: 'hf-w-gf-w',
      alongT: 0.88,
      widthMm: 600,
      heightMm: 650,
      sillHeightMm: 1600,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-kitchen-north',
      name: 'Kitchen north side window',
      wallId: 'hf-w-gf-n',
      alongT: 0.28,
      widthMm: 1100,
      heightMm: 1300,
      sillHeightMm: 900,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-front',
      name: 'Recessed front door under cantilever',
      wallId: 'hf-w-gf-s',
      alongT: 0.88,
      widthMm: 900,
      familyTypeId: 'hf-ft-door-ext',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-loggia-trap',
      name: 'Upper loggia left sloped window',
      wallId: 'hf-w-uf-s-l',
      alongT: 0.5,
      widthMm: 1700,
      heightMm: 1700,
      sillHeightMm: 260,
      familyTypeId: 'hf-ft-window-trapezoid',
    },
    { type: 'updateElementProperty', elementId: 'hf-win-loggia-trap', key: 'outlineKind', value: 'gable_trapezoid' },
    { type: 'updateElementProperty', elementId: 'hf-win-loggia-trap', key: 'attachedRoofId', value: 'hf-roof-main' },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-loggia',
      name: 'Upper loggia right full-height glass',
      wallId: 'hf-w-uf-s-r',
      alongT: 0.52,
      widthMm: 2500,
      familyTypeId: 'hf-ft-door-slider',
    },
    { type: 'updateElementProperty', elementId: 'hf-door-loggia', key: 'operationType', value: 'sliding_double' },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-bed2-west',
      name: 'Bedroom 2 west side window',
      wallId: 'hf-w-uf-w',
      alongT: 0.37,
      widthMm: 900,
      heightMm: 1450,
      sillHeightMm: 800,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-bath-north',
      name: 'Bathroom north clerestory window',
      wallId: 'hf-w-uf-n',
      alongT: 0.48,
      widthMm: 800,
      heightMm: 700,
      sillHeightMm: 1700,
      familyTypeId: 'hf-ft-window-portrait',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-roof-terrace',
      name: 'Roof terrace recessed glass access door',
      wallId: 'hf-w-roof-terrace-glass-back',
      alongT: 0.5,
      widthMm: 1200,
      familyTypeId: 'hf-ft-door-slider',
    },
    { type: 'updateElementProperty', elementId: 'hf-door-roof-terrace', key: 'operationType', value: 'sliding_single' },

    // === PHASE 5: INTERIOR PROGRAMME ===
    {
      type: 'createStair',
      id: 'hf-stair-main',
      name: 'Visible stair behind front portrait window',
      baseLevelId: 'hf-lvl-ground',
      topLevelId: 'hf-lvl-upper',
      runStartMm: { xMm: 7450, yMm: 1350 },
      runEndMm: { xMm: 7450, yMm: 6500 },
      widthMm: 1100,
      riserMm: 176,
      treadMm: 280,
    },
    {
      type: 'createSlabOpening',
      id: 'hf-slab-stair',
      name: 'Upper floor stair opening',
      hostFloorId: 'hf-flr-upper',
      boundaryMm: rect(6850, 1250, 8050, 6700),
      isShaft: true,
    },
    ...wall('hf-w-gf-ptn-entry', 'GF stair hall partition', 'hf-lvl-ground', 6400, 0, 6400, 4700, 2700, null, 120),
    ...wall('hf-w-gf-ptn-living-kitchen', 'GF living kitchen partition', 'hf-lvl-ground', 6400, 5000, GF_X1, 5000, 2700, null, 120),
    ...wall('hf-w-gf-ptn-wc', 'GF WC partition', 'hf-lvl-ground', 3800, 0, 3800, 3300, 2700, null, 120),
    ...wall('hf-w-uf-ptn-mid', 'UF bedroom corridor partition', 'hf-lvl-upper', SHELL_THICK, 4500, SHELL_W - SHELL_THICK, 4500, 2700, null, 120),
    ...wall('hf-w-uf-ptn-bath', 'UF bathroom partition', 'hf-lvl-upper', 4400, 4500, 4400, D - 650, 2700, null, 120),

    {
      type: 'createRoomOutline',
      id: 'hf-room-entry-stair',
      name: 'Entrance / stair hall',
      levelId: 'hf-lvl-ground',
      outlineMm: rect(6600, 800, 10200, 4500),
      programmeCode: 'circulation',
      functionLabel: 'entrance-stair',
      targetAreaM2: 13.3,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-living-dining',
      name: 'Living / dining room',
      levelId: 'hf-lvl-ground',
      outlineMm: rect(2100, 4800, 6300, D - 400),
      programmeCode: 'living',
      functionLabel: 'living-dining',
      targetAreaM2: 24.4,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-kitchen',
      name: 'Kitchen',
      levelId: 'hf-lvl-ground',
      outlineMm: rect(6600, 5200, GF_X1 - 300, D - 400),
      programmeCode: 'kitchen',
      functionLabel: 'kitchen',
      targetAreaM2: 19.4,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-gf-wc',
      name: 'Guest WC',
      levelId: 'hf-lvl-ground',
      outlineMm: rect(2100, 800, 3600, 3000),
      programmeCode: 'toilet',
      functionLabel: 'guest-wc',
      targetAreaM2: 3.3,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bed-1',
      name: 'Bedroom 1',
      levelId: 'hf-lvl-upper',
      outlineMm: rect(800, 1500, 4400, 4300),
      programmeCode: 'bedroom',
      functionLabel: 'master-bedroom',
      targetAreaM2: 10.1,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bed-2',
      name: 'Bedroom 2',
      levelId: 'hf-lvl-upper',
      outlineMm: rect(800, 4900, 4200, D - 700),
      programmeCode: 'bedroom',
      functionLabel: 'secondary-bedroom',
      targetAreaM2: 18.4,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bath',
      name: 'Bathroom',
      levelId: 'hf-lvl-upper',
      outlineMm: rect(4600, 4900, 6800, D - 700),
      programmeCode: 'bathroom',
      functionLabel: 'family-bathroom',
      targetAreaM2: 11.9,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-deck',
      name: 'Embedded roof terrace',
      levelId: 'hf-lvl-upper',
      outlineMm: rect(CUT_X0 + 250, CUT_Y0 + 250, CUT_X1 - 300, CUT_Y1 - 250),
      programmeCode: 'terrace',
      functionLabel: 'roof-balcony',
      targetAreaM2: 25.8,
    },
    ...roomSepRect('hf-rs-entry', 'Entrance / stair hall', 'hf-lvl-ground', 6600, 800, 10200, 4500),
    ...roomSepRect('hf-rs-living', 'Living / dining room', 'hf-lvl-ground', 2100, 4800, 6300, D - 400),
    ...roomSepRect('hf-rs-kitchen', 'Kitchen', 'hf-lvl-ground', 6600, 5200, GF_X1 - 300, D - 400),
    ...roomSepRect('hf-rs-gf-wc', 'Guest WC', 'hf-lvl-ground', 2100, 800, 3600, 3000),
    ...roomSepRect('hf-rs-bed-1', 'Bedroom 1', 'hf-lvl-upper', 800, 1500, 4400, 4300),
    ...roomSepRect('hf-rs-bed-2', 'Bedroom 2', 'hf-lvl-upper', 800, 4900, 4200, D - 700),
    ...roomSepRect('hf-rs-bath', 'Bathroom', 'hf-lvl-upper', 4600, 4900, 6800, D - 700),
    ...roomSepRect('hf-rs-deck', 'Embedded roof terrace', 'hf-lvl-upper', CUT_X0 + 250, CUT_Y0 + 250, CUT_X1 - 300, CUT_Y1 - 250),

    // === PHASE 6: ASSET READABILITY ===
    asset('hf-asset-sofa', 'Two-seat sofa', 'furniture', 2200, 900, ['living']),
    asset('hf-asset-coffee-table', 'Coffee table', 'furniture', 1000, 600, ['living']),
    asset('hf-asset-dining-table', 'Dining table', 'furniture', 1600, 900, ['dining']),
    asset('hf-asset-kitchen-run', 'Kitchen cabinet run', 'kitchen', 3000, 650, ['kitchen']),
    asset('hf-asset-kitchen-island', 'Kitchen island', 'kitchen', 1800, 900, ['kitchen']),
    asset('hf-asset-toilet', 'Toilet', 'bathroom', 700, 450, ['bathroom']),
    asset('hf-asset-basin', 'Wash basin', 'bathroom', 600, 450, ['bathroom']),
    asset('hf-asset-shower', 'Shower tray', 'bathroom', 900, 900, ['bathroom']),
    asset('hf-asset-queen-bed', 'Queen bed', 'furniture', 2000, 1600, ['bedroom']),
    asset('hf-asset-single-bed', 'Single bed', 'furniture', 2000, 900, ['bedroom']),
    asset('hf-asset-wardrobe', 'Wardrobe', 'casework', 1800, 600, ['bedroom']),
    asset('hf-asset-desk', 'Small desk', 'furniture', 1200, 600, ['study']),
    asset('hf-asset-outdoor-table', 'Outdoor table', 'furniture', 1200, 800, ['terrace']),
    asset('hf-asset-lounge-chair', 'Lounge chair', 'furniture', 800, 800, ['terrace']),

    place('hf-pa-sofa', 'hf-asset-sofa', 'Living sofa', 'hf-lvl-ground', 3500, 7800, 90),
    place('hf-pa-coffee-table', 'hf-asset-coffee-table', 'Living coffee table', 'hf-lvl-ground', 4300, 7800, 90),
    place('hf-pa-dining-table', 'hf-asset-dining-table', 'Dining table', 'hf-lvl-ground', 4400, 5650, 0),
    place('hf-pa-kitchen-run', 'hf-asset-kitchen-run', 'Kitchen cabinet run', 'hf-lvl-ground', 8350, 10300, 0),
    place('hf-pa-kitchen-island', 'hf-asset-kitchen-island', 'Kitchen island', 'hf-lvl-ground', 8350, 7900, 0),
    place('hf-pa-gf-toilet', 'hf-asset-toilet', 'Guest WC toilet', 'hf-lvl-ground', 2950, 2050, 180),
    place('hf-pa-gf-basin', 'hf-asset-basin', 'Guest WC basin', 'hf-lvl-ground', 2500, 1150, 0),
    place('hf-pa-master-bed', 'hf-asset-queen-bed', 'Master bed', 'hf-lvl-upper', 2500, 2850, 90),
    place('hf-pa-master-wardrobe', 'hf-asset-wardrobe', 'Master wardrobe', 'hf-lvl-upper', 3600, 3900, 0),
    place('hf-pa-bed2', 'hf-asset-single-bed', 'Bedroom 2 bed', 'hf-lvl-upper', 2500, 6800, 90),
    place('hf-pa-bed2-desk', 'hf-asset-desk', 'Bedroom 2 desk', 'hf-lvl-upper', 3350, 9500, 0),
    place('hf-pa-bath-toilet', 'hf-asset-toilet', 'Bathroom toilet', 'hf-lvl-upper', 5350, 5850, 90),
    place('hf-pa-bath-basin', 'hf-asset-basin', 'Bathroom basin', 'hf-lvl-upper', 6200, 6000, 270),
    place('hf-pa-bath-shower', 'hf-asset-shower', 'Bathroom shower', 'hf-lvl-upper', 5700, 9250, 0),
    place('hf-pa-terrace-table', 'hf-asset-outdoor-table', 'Roof terrace outdoor table', 'hf-lvl-upper', 9500, 5600, 0),
    place('hf-pa-terrace-chair-1', 'hf-asset-lounge-chair', 'Roof terrace lounge chair 1', 'hf-lvl-upper', 9500, 4100, 0),
    place('hf-pa-terrace-chair-2', 'hf-asset-lounge-chair', 'Roof terrace lounge chair 2', 'hf-lvl-upper', 9500, 7200, 180),

    // === PHASE 7: DOCUMENTATION AND CHECKPOINT VIEWS ===
    {
      type: 'saveViewpoint',
      id: 'vp-main-iso',
      name: 'Main image-locked axonometric - front loggia and roof cutout',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: -6500, yMm: -11500, zMm: 12800 },
        target: { xMm: 6100, yMm: 5200, zMm: 5100 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-front-elev',
      name: 'Front elevation - recessed upper loggia',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 6000, yMm: -18000, zMm: 5000 },
        target: { xMm: 6000, yMm: 3300, zMm: 5000 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-side-elev-east',
      name: 'Right/east view - embedded roof balcony',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 20500, yMm: 3200, zMm: 8500 },
        target: { xMm: 8400, yMm: 5600, zMm: 5200 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-rear-axo',
      name: 'Rear/right axonometric - terrace return faces',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 18200, yMm: 16500, zMm: 11600 },
        target: { xMm: 7200, yMm: 6200, zMm: 5200 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-terrace-se',
      name: 'High roof terrace checkpoint',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 16500, yMm: 12500, zMm: 15000 },
        target: { xMm: 9300, yMm: 6100, zMm: 5700 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'upsertPlanView',
      id: 'hf-pv-ground',
      name: 'Ground floor plan',
      levelId: 'hf-lvl-ground',
      planShowRoomLabels: true,
      planRoomFillOpacityScale: 0.45,
    },
    {
      type: 'upsertPlanView',
      id: 'hf-pv-upper',
      name: 'First floor and roof terrace plan',
      levelId: 'hf-lvl-upper',
      planShowRoomLabels: true,
      planRoomFillOpacityScale: 0.45,
    },
    {
      type: 'createSectionCut',
      id: 'hf-sec-loggia',
      name: 'Section through front loggia and folded roof',
      lineStartMm: { xMm: 0, yMm: LOGGIA_Y },
      lineEndMm: { xMm: SHELL_W, yMm: LOGGIA_Y },
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
        issuePurpose: 'Seed reference rebuild',
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
          viewportId: 'vp-sheet-section-loggia',
          label: 'Loggia section',
          viewRef: 'section:hf-sec-loggia',
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
