/** @typedef {Record<string, unknown>} BimCommand */

/*
 * Canonical demo seed: target house rebuilt from the sketch-to-BIM IR in
 * nightshift/seed-target-house-2026-05-11/. This source starts from the
 * target images and floorplan dimensions instead of preserving the prior
 * seedhouse geometry.
 *
 * Coordinate convention:
 *   +xMm = east/right, +yMm = north/back. South/front facade is yMm = 0.
 */

const W = 14000;
const D = 10000;
const F2F = 3000;
const GF_H = 3000;
const UPPER_EAVE_L = 2600;
const UPPER_EAVE_R = 2350;
const ROOF_SLOPE_DEG = 18;
const RIDGE_OFFSET = -900;
const RIDGE_X = W / 2 + RIDGE_OFFSET;
const RIDGE_Z =
  F2F + UPPER_EAVE_L + Math.round(RIDGE_X * Math.tan((ROOF_SLOPE_DEG * Math.PI) / 180));
const WALL_T = 260;
const INT_T = 120;
const GLASS_T = 80;
const LOGGIA_D = 1900;
const COURT_X0 = 8700;
const COURT_Y0 = 5900;
const CARPORT_X0 = 10500;
const CARPORT_Y1 = 5500;

function pt(xMm, yMm) {
  return { xMm, yMm };
}

function rect(x0, y0, x1, y1) {
  return [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
}

function areaM2(x0, y0, x1, y1) {
  return Number((((x1 - x0) * (y1 - y0)) / 1_000_000).toFixed(2));
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

function wallTypeFor(materialKey, thicknessMm) {
  if (materialKey === 'glass_clear' || materialKey === 'glass_low_iron') return 'th-wall-glass';
  if (materialKey === 'cladding_warm_wood') return 'th-wall-cladding';
  if (thicknessMm <= 140) return 'th-wall-internal';
  return 'th-wall-white';
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
    isCurtainWall: materialKey === 'glass_clear' || materialKey === 'glass_low_iron',
  };
}

function sweep(id, name, pathMm, materialKey, widthMm = 35, depthMm = 35) {
  return {
    type: 'createSweep',
    id,
    name,
    levelId: 'th-lvl-ground',
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

function asset(id, name, category, width, depth, tags = []) {
  return {
    type: 'IndexAsset',
    id,
    name,
    category,
    tags: ['seed', ...tags],
    thumbnailWidthMm: width,
    thumbnailHeightMm: depth,
  };
}

function place(id, assetId, name, levelId, xMm, yMm, rotationDeg = 0, paramValues = {}) {
  return {
    type: 'PlaceAsset',
    id,
    assetId,
    name,
    levelId,
    positionMm: pt(xMm, yMm),
    rotationDeg,
    paramValues,
  };
}

function openingFamily(id, discipline, parameters) {
  return { type: 'upsertFamilyType', id, discipline, parameters };
}

function door(id, name, wallId, alongT, widthMm, familyTypeId = 'th-ft-door-int') {
  return { type: 'insertDoorOnWall', id, name, wallId, alongT, widthMm, familyTypeId };
}

function window(id, name, wallId, alongT, widthMm, heightMm, sillHeightMm, familyTypeId = 'th-ft-window') {
  return {
    type: 'insertWindowOnWall',
    id,
    name,
    wallId,
    alongT,
    widthMm,
    heightMm,
    sillHeightMm,
    familyTypeId,
  };
}

function claddingBattens(prefix, levelZ, xValues, yMm, z0, z1) {
  return xValues.map((xMm, index) =>
    sweep(
      `${prefix}-${String(index + 1).padStart(2, '0')}`,
      `${prefix} vertical batten ${index + 1}`,
      [
        { xMm, yMm, zMm: levelZ + z0 },
        { xMm, yMm, zMm: levelZ + z1 },
      ],
      'aluminium_natural',
      12,
      12,
    ),
  );
}

function range(start, end, step, skip = []) {
  const values = [];
  for (let v = start; v <= end; v += step) {
    if (skip.some(([a, b]) => v >= a && v <= b)) continue;
    values.push(v);
  }
  return values;
}

/**
 * @returns {BimCommand[]}
 */
export function buildOneFamilyHomeCommands() {
  return [
    { type: 'createProjectBasePoint', id: 'th-pbp', positionMm: { xMm: 0, yMm: 0, zMm: 0 }, angleToTrueNorthDeg: 0 },
    { type: 'createLevel', id: 'th-lvl-site', name: 'Plinth / Site', elevationMm: -180, alsoCreatePlanView: false },
    { type: 'createLevel', id: 'th-lvl-ground', name: 'Ground Floor', elevationMm: 0, planViewId: 'th-pv-auto-ground' },
    { type: 'createLevel', id: 'th-lvl-upper', name: 'First Floor', elevationMm: F2F, planViewId: 'th-pv-auto-upper' },

    {
      type: 'upsertWallType',
      id: 'th-wall-white',
      name: 'Smooth white folded shell wall',
      layers: [
        { thicknessMm: 190, function: 'structure', materialKey: 'concrete_smooth' },
        { thicknessMm: 70, function: 'finish', materialKey: 'white_render' },
      ],
      basisLine: 'center',
    },
    {
      type: 'upsertWallType',
      id: 'th-wall-cladding',
      name: 'Vertical warm board cladding wall',
      layers: [
        { thicknessMm: 160, function: 'structure', materialKey: 'concrete_smooth' },
        { thicknessMm: 40, function: 'insulation', materialKey: 'air' },
        { thicknessMm: 60, function: 'finish', materialKey: 'cladding_warm_wood' },
      ],
      basisLine: 'center',
    },
    {
      type: 'upsertWallType',
      id: 'th-wall-internal',
      name: 'Internal plasterboard partition',
      layers: [{ thicknessMm: 120, function: 'finish', materialKey: 'plasterboard' }],
      basisLine: 'center',
    },
    {
      type: 'upsertWallType',
      id: 'th-wall-glass',
      name: 'Clear glass wall',
      layers: [{ thicknessMm: 80, function: 'finish', materialKey: 'glass_clear' }],
      basisLine: 'center',
    },
    {
      type: 'upsertFloorType',
      id: 'th-floor-slab',
      name: 'Light concrete slab with finish',
      layers: [
        { thicknessMm: 180, function: 'structure', materialKey: 'concrete_smooth' },
        { thicknessMm: 40, function: 'finish', materialKey: 'render_light_grey' },
      ],
    },
    {
      type: 'upsertRoofType',
      id: 'th-roof-white-shell',
      name: 'Thick white roof shell',
      layers: [
        { thicknessMm: 360, function: 'structure', materialKey: 'concrete_smooth' },
        { thicknessMm: 90, function: 'finish', materialKey: 'white_render' },
      ],
    },
    openingFamily('th-ft-door-ext', 'door', { widthMm: 950, heightMm: 2200, typeMark: 'D-EXT' }),
    openingFamily('th-ft-door-int', 'door', { widthMm: 850, heightMm: 2100, typeMark: 'D-INT' }),
    openingFamily('th-ft-door-slider', 'door', { widthMm: 2400, heightMm: 2400, operationType: 'sliding_double', typeMark: 'D-GL' }),
    openingFamily('th-ft-window', 'window', { widthMm: 1200, heightMm: 1500, typeMark: 'W' }),
    openingFamily('th-ft-window-tall', 'window', { widthMm: 900, heightMm: 2200, typeMark: 'W-TALL' }),
    openingFamily('th-ft-window-gable', 'window', { widthMm: 2500, heightMm: 1900, outlineKind: 'gable_trapezoid', typeMark: 'W-GABLE' }),

    // Ground floor envelope: cladded occupied base plus a recessed carport void.
    wall('th-w-gf-south', 'Ground south cladded facade with glazing', 'th-lvl-ground', 0, 0, CARPORT_X0, 0, GF_H, 'cladding_warm_wood'),
    wall('th-w-gf-west', 'Ground west cladded facade', 'th-lvl-ground', 0, D, 0, 0, GF_H, 'cladding_warm_wood'),
    wall('th-w-gf-north-main', 'Ground north cladded main facade', 'th-lvl-ground', 0, D, W, D, GF_H, 'cladding_warm_wood'),
    wall('th-w-gf-house-east', 'Ground house east wall before carport', 'th-lvl-ground', CARPORT_X0, 0, CARPORT_X0, D, GF_H, 'cladding_warm_wood'),
    wall('th-w-gf-carport-back', 'Recessed carport back wall', 'th-lvl-ground', CARPORT_X0, CARPORT_Y1, W, CARPORT_Y1, GF_H, 'cladding_warm_wood'),
    wall('th-w-gf-carport-east-support', 'White right support wall at recessed carport', 'th-lvl-ground', W, 0, W, CARPORT_Y1, GF_H, 'white_render'),
    wall('th-w-gf-service-east', 'Ground service east wall', 'th-lvl-ground', W, CARPORT_Y1, W, D, GF_H, 'cladding_warm_wood'),

    // Upper dominant white wrapper and set-back loggia facade.
    wall('th-w-up-west', 'Upper white west wrapper wall', 'th-lvl-upper', 0, D, 0, 0, 3800, 'white_render'),
    wall('th-w-up-east', 'Upper white east wrapper wall', 'th-lvl-upper', W, 0, W, D, 3800, 'white_render'),
    wall('th-w-up-north', 'Upper white north wrapper wall', 'th-lvl-upper', W, D, 0, D, 3800, 'white_render'),
    wall('th-w-up-loggia-left-glass', 'Recessed upper loggia left glass bay', 'th-lvl-upper', 0, LOGGIA_D, 4600, LOGGIA_D, 3100, 'glass_clear', GLASS_T),
    wall('th-w-up-loggia-pier', 'Recessed upper loggia central cladded pier', 'th-lvl-upper', 4600, LOGGIA_D, 6700, LOGGIA_D, 3300, 'cladding_warm_wood'),
    wall('th-w-up-loggia-right-glass', 'Recessed upper loggia right glass bay', 'th-lvl-upper', 6700, LOGGIA_D, W, LOGGIA_D, 3100, 'glass_clear', GLASS_T),

    {
      type: 'createFloor',
      id: 'th-flr-plinth',
      name: 'Low projecting white plinth slab',
      levelId: 'th-lvl-site',
      boundaryMm: rect(-600, -550, W + 600, D + 550),
      thicknessMm: 180,
      floorTypeId: 'th-floor-slab',
      materialKey: 'white_render',
    },
    {
      type: 'createFloor',
      id: 'th-flr-ground-main',
      name: 'Ground occupied slab excluding recessed carport',
      levelId: 'th-lvl-ground',
      boundaryMm: [pt(0, 0), pt(CARPORT_X0, 0), pt(CARPORT_X0, CARPORT_Y1), pt(W, CARPORT_Y1), pt(W, D), pt(0, D)],
      thicknessMm: 220,
      floorTypeId: 'th-floor-slab',
      roomBounded: true,
      materialKey: 'render_light_grey',
    },
    {
      type: 'createFloor',
      id: 'th-flr-carport',
      name: 'Recessed carport floor slab',
      levelId: 'th-lvl-ground',
      boundaryMm: rect(CARPORT_X0, 0, W, CARPORT_Y1),
      thicknessMm: 180,
      floorTypeId: 'th-floor-slab',
      materialKey: 'render_light_grey',
    },
    {
      type: 'createFloor',
      id: 'th-flr-upper',
      name: 'First floor plate with roof court void omitted',
      levelId: 'th-lvl-upper',
      boundaryMm: [pt(0, 0), pt(W, 0), pt(W, COURT_Y0), pt(COURT_X0, COURT_Y0), pt(COURT_X0, D), pt(0, D)],
      thicknessMm: 260,
      floorTypeId: 'th-floor-slab',
      roomBounded: true,
      materialKey: 'white_render',
    },
    {
      type: 'createFloor',
      id: 'th-flr-roof-court',
      name: 'Occupied open-to-sky roof court terrace floor',
      levelId: 'th-lvl-upper',
      boundaryMm: rect(COURT_X0, COURT_Y0, W, D),
      thicknessMm: 180,
      floorTypeId: 'th-floor-slab',
      materialKey: 'render_light_grey',
    },

    {
      type: 'createRoof',
      id: 'th-roof-main',
      name: 'White asymmetric folded roof shell with open roof court',
      referenceLevelId: 'th-lvl-upper',
      footprintMm: rect(0, 0, W, D),
      roofGeometryMode: 'asymmetric_gable',
      ridgeOffsetTransverseMm: RIDGE_OFFSET,
      eaveHeightLeftMm: UPPER_EAVE_L,
      eaveHeightRightMm: UPPER_EAVE_R,
      slopeDeg: ROOF_SLOPE_DEG,
      overhangMm: 0,
      roofTypeId: 'th-roof-white-shell',
      materialKey: 'white_render',
    },
    {
      type: 'createRoofOpening',
      id: 'th-roof-court-opening',
      name: 'Large right back open-to-sky roof court void',
      hostRoofId: 'th-roof-main',
      boundaryMm: rect(COURT_X0, COURT_Y0, W, D),
    },
    ...[
      'th-w-up-west',
      'th-w-up-east',
      'th-w-up-north',
      'th-w-up-loggia-left-glass',
      'th-w-up-loggia-pier',
      'th-w-up-loggia-right-glass',
    ].map((wallId) => ({ type: 'attachWallTopToRoof', wallId, roofId: 'th-roof-main' })),

    // Roof court return/guard geometry. These make the roof opening visible even
    // in normal user-facing 3D views.
    wall('th-w-court-west-return', 'White roof-court west return face', 'th-lvl-upper', COURT_X0, COURT_Y0, COURT_X0, D, 1900, 'white_render'),
    wall('th-w-court-south-glass', 'Glass access wall at roof court', 'th-lvl-upper', COURT_X0, COURT_Y0, W, COURT_Y0, 2300, 'glass_clear', GLASS_T),
    wall('th-w-court-east-guard', 'Glass guard on exposed roof court east edge', 'th-lvl-upper', W, COURT_Y0, W, D, 1150, 'glass_clear', GLASS_T),

    // Interior partitions, kept orthogonal to match the supplied plan.
    wall('th-w-gf-spine', 'Ground feature screen and stair spine wall', 'th-lvl-ground', 6300, 0, 6300, D, 2700, null, INT_T),
    wall('th-w-gf-service-west', 'Ground service west partition', 'th-lvl-ground', 8700, 0, 8700, D, 2700, null, INT_T),
    wall('th-w-gf-utility-south', 'Ground utility south partition', 'th-lvl-ground', 6300, 6500, 8700, 6500, 2700, null, INT_T),
    wall('th-w-gf-bath-south', 'Ground bath laundry south partition', 'th-lvl-ground', 8700, 6500, CARPORT_X0, 6500, 2700, null, INT_T),

    wall('th-w-up-private-east', 'Upper private suite east partition', 'th-lvl-upper', 4600, LOGGIA_D, 4600, D, 2700, null, INT_T),
    wall('th-w-up-suite-core', 'Upper ensuite and closet partition', 'th-lvl-upper', 2600, LOGGIA_D, 2600, 5800, 2700, null, INT_T),
    wall('th-w-up-ensuite-closet-split', 'Upper ensuite closet split', 'th-lvl-upper', 0, 3800, 2600, 3800, 2700, null, INT_T),
    wall('th-w-up-master-south', 'Upper master bedroom south partition', 'th-lvl-upper', 0, 5800, 4600, 5800, 2700, null, INT_T),
    wall('th-w-up-east-zone-west', 'Upper landing to east bedroom partition', 'th-lvl-upper', COURT_X0, LOGGIA_D, COURT_X0, COURT_Y0, 2700, null, INT_T),
    wall('th-w-up-landing-north', 'Upper landing north closure', 'th-lvl-upper', 4600, 6500, COURT_X0, 6500, 2700, null, INT_T),

    // Openings.
    door('th-door-front', 'Front entry door under the upper overhang', 'th-w-gf-south', 0.72, 950, 'th-ft-door-ext'),
    door('th-door-living', 'Door from entry stair hall to living kitchen zone', 'th-w-gf-spine', 0.34, 950, 'th-ft-door-int'),
    door('th-door-utility', 'Utility door from stair hall', 'th-w-gf-utility-south', 0.32, 850, 'th-ft-door-int'),
    door('th-door-bath', 'Bath laundry door from utility', 'th-w-gf-service-west', 0.78, 800, 'th-ft-door-int'),
    door('th-door-carport-service', 'Door from service zone to recessed carport', 'th-w-gf-carport-back', 0.26, 900, 'th-ft-door-ext'),
    window('th-win-gf-living-front', 'Large living front glazing', 'th-w-gf-south', 0.26, 3200, 2250, 220, 'th-ft-window-tall'),
    window('th-win-gf-stair-front', 'Tall stair window showing the stair run', 'th-w-gf-south', 0.58, 1000, 2300, 200, 'th-ft-window-tall'),
    window('th-win-gf-kitchen-north', 'Kitchen north horizontal window', 'th-w-gf-north-main', 0.28, 2400, 900, 1150, 'th-ft-window'),
    window('th-win-gf-service-north', 'Service north window', 'th-w-gf-north-main', 0.70, 1300, 900, 1150, 'th-ft-window'),
    window('th-win-gf-west', 'Living west side window', 'th-w-gf-west', 0.42, 1500, 1500, 750, 'th-ft-window'),

    door('th-door-loggia-left', 'Sliding glass door to deep upper loggia left bay', 'th-w-up-loggia-left-glass', 0.76, 1900, 'th-ft-door-slider'),
    door('th-door-loggia-right', 'Sliding glass door to deep upper loggia right bay', 'th-w-up-loggia-right-glass', 0.55, 2600, 'th-ft-door-slider'),
    window('th-win-loggia-left-gable', 'Upper left sloped-top loggia window', 'th-w-up-loggia-left-glass', 0.24, 2100, 1800, 350, 'th-ft-window-gable'),
    { type: 'updateElementProperty', elementId: 'th-win-loggia-left-gable', key: 'outlineKind', value: 'gable_trapezoid' },
    { type: 'updateElementProperty', elementId: 'th-win-loggia-left-gable', key: 'attachedRoofId', value: 'th-roof-main' },
    door('th-door-roof-court', 'Glass door from landing to open roof court', 'th-w-court-south-glass', 0.56, 1400, 'th-ft-door-slider'),
    door('th-door-master-vestibule', 'Door from landing to primary suite vestibule', 'th-w-up-private-east', 0.22, 850, 'th-ft-door-int'),
    door('th-door-master-bed', 'Door from primary vestibule to bedroom', 'th-w-up-master-south', 0.76, 850, 'th-ft-door-int'),
    door('th-door-ensuite', 'Ensuite door from primary vestibule', 'th-w-up-suite-core', 0.28, 800, 'th-ft-door-int'),
    door('th-door-closet', 'Walk-in closet door from primary vestibule', 'th-w-up-suite-core', 0.72, 800, 'th-ft-door-int'),
    door('th-door-bedroom-2', 'Bedroom 2 door from landing', 'th-w-up-east-zone-west', 0.32, 850, 'th-ft-door-int'),
    window('th-win-master-north', 'Primary bedroom north window', 'th-w-up-north', 0.20, 2000, 1300, 850, 'th-ft-window'),
    window('th-win-bed2-east', 'Bedroom 2 east window', 'th-w-up-east', 0.34, 1600, 1400, 800, 'th-ft-window'),

    {
      type: 'createStair',
      id: 'th-stair-main',
      name: 'Straight stair aligned with the tall front stair window',
      baseLevelId: 'th-lvl-ground',
      topLevelId: 'th-lvl-upper',
      runStartMm: pt(7350, 700),
      runEndMm: pt(7350, 5250),
      widthMm: 1100,
      riserMm: 176,
      treadMm: 280,
    },
    {
      type: 'createSlabOpening',
      id: 'th-slab-stair-opening',
      name: 'First-floor stair shaft opening',
      hostFloorId: 'th-flr-upper',
      boundaryMm: rect(6750, 550, 7950, 5450),
      isShaft: true,
    },

    // Room programme and reachability metadata.
    room('th-room-living-kitchen', 'Living / kitchen / dining', 'th-lvl-ground', 0, 0, 6300, D, 'living', 'open-living-kitchen', 'living'),
    room('th-room-entry-stair', 'Entry / stair hall', 'th-lvl-ground', 6300, 0, 8700, 6500, 'circulation', 'entry-stair', 'circulation'),
    room('th-room-utility', 'Utility', 'th-lvl-ground', 6300, 6500, 8700, D, 'utility', 'utility', 'service'),
    room('th-room-bath-laundry', 'Bath / laundry', 'th-lvl-ground', 8700, 6500, CARPORT_X0, D, 'bathroom', 'bath-laundry', 'wet'),
    room('th-room-primary-bedroom', 'Primary bedroom', 'th-lvl-upper', 0, 5800, 4600, D, 'bedroom', 'primary-bedroom', 'sleeping'),
    room('th-room-primary-vestibule', 'Primary suite vestibule', 'th-lvl-upper', 2600, LOGGIA_D, 4600, 5800, 'circulation', 'suite-vestibule', 'circulation'),
    room('th-room-closet', 'Walk-in closet', 'th-lvl-upper', 0, 3800, 2600, 5800, 'closet', 'walk-in-closet', 'storage'),
    room('th-room-ensuite', 'Ensuite', 'th-lvl-upper', 0, LOGGIA_D, 2600, 3800, 'bathroom', 'ensuite', 'wet'),
    room('th-room-landing', 'Hall / landing', 'th-lvl-upper', 4600, LOGGIA_D, COURT_X0, 6500, 'circulation', 'upper-landing', 'circulation'),
    room('th-room-bedroom-2', 'Bedroom 2', 'th-lvl-upper', COURT_X0, LOGGIA_D, W, COURT_Y0, 'bedroom', 'bedroom-2', 'sleeping'),
    room('th-room-roof-court', 'Open-to-sky roof court / terrace', 'th-lvl-upper', COURT_X0, COURT_Y0, W, D, 'terrace', 'roof-court', 'external'),

    // Sparse, explicit facade lines for visible vertical cladding zones and rails.
    ...claddingBattens('th-sw-loggia-pier-batten', F2F, range(4850, 6450, 230), LOGGIA_D - 70, 100, 3050),
    ...[850, 1080, 1310].map((z, index) =>
      sweep(
        `th-sw-loggia-rail-${index + 1}`,
        `Thin black front loggia rail ${index + 1}`,
        [
          { xMm: 300, yMm: -80, zMm: F2F + z },
          { xMm: W - 300, yMm: -80, zMm: F2F + z },
        ],
        'aluminium_black',
        24,
        24,
      ),
    ),
    sweep(
      'th-sw-front-white-frame',
      'Thick white front folded-shell gable frame outline',
      [
        { xMm: 0, yMm: -95, zMm: F2F },
        { xMm: W, yMm: -95, zMm: F2F },
        { xMm: W, yMm: -95, zMm: F2F + UPPER_EAVE_R },
        { xMm: RIDGE_X, yMm: -95, zMm: RIDGE_Z },
        { xMm: 0, yMm: -95, zMm: F2F + UPPER_EAVE_L },
        { xMm: 0, yMm: -95, zMm: F2F },
      ],
      'white_render',
      180,
      180,
    ),
    // Furniture and fixtures for programme legibility.
    asset('th-asset-sofa', 'L-shaped sofa', 'furniture', 2600, 1600, ['living']),
    asset('th-asset-coffee-table', 'Coffee table', 'furniture', 1000, 650, ['living']),
    asset('th-asset-dining-table', 'Six-seat dining table', 'furniture', 2200, 1000, ['dining']),
    asset('th-asset-kitchen-run', 'Kitchen cabinet run with sink', 'kitchen', 4200, 650, ['kitchen']),
    asset('th-asset-kitchen-island', 'Kitchen island', 'kitchen', 2100, 950, ['kitchen']),
    asset('th-asset-toilet', 'Toilet', 'bathroom', 700, 450, ['bathroom']),
    asset('th-asset-basin', 'Wash basin', 'bathroom', 650, 480, ['bathroom']),
    asset('th-asset-shower', 'Shower tray', 'bathroom', 950, 950, ['bathroom']),
    asset('th-asset-queen-bed', 'Queen bed', 'furniture', 2100, 1650, ['bedroom']),
    asset('th-asset-single-bed', 'Single bed', 'furniture', 2050, 950, ['bedroom']),
    asset('th-asset-wardrobe', 'Wardrobe run', 'casework', 2200, 650, ['closet']),
    asset('th-asset-desk', 'Small desk', 'furniture', 1200, 600, ['bedroom']),
    asset('th-asset-outdoor-table', 'Outdoor roof terrace table', 'furniture', 1200, 850, ['terrace']),
    asset('th-asset-lounge-chair', 'Roof terrace lounge chair', 'furniture', 850, 800, ['terrace']),

    place('th-pa-sofa', 'th-asset-sofa', 'Living sofa', 'th-lvl-ground', 2100, 2300, 0),
    place('th-pa-coffee', 'th-asset-coffee-table', 'Living coffee table', 'th-lvl-ground', 3000, 2750, 0),
    place('th-pa-dining', 'th-asset-dining-table', 'Dining table', 'th-lvl-ground', 3100, 6400, 0),
    place('th-pa-kitchen-run', 'th-asset-kitchen-run', 'Kitchen run at north wall', 'th-lvl-ground', 3000, 9550, 0),
    place('th-pa-kitchen-island', 'th-asset-kitchen-island', 'Kitchen island', 'th-lvl-ground', 3100, 7900, 0),
    place('th-pa-gf-toilet', 'th-asset-toilet', 'Bath laundry toilet', 'th-lvl-ground', 9700, 9300, 180),
    place('th-pa-gf-basin', 'th-asset-basin', 'Bath laundry basin', 'th-lvl-ground', 9000, 7200, 90),
    place('th-pa-gf-shower', 'th-asset-shower', 'Bath laundry shower', 'th-lvl-ground', 9900, 7200, 0),
    place('th-pa-master-bed', 'th-asset-queen-bed', 'Primary bed', 'th-lvl-upper', 1950, 8150, 90),
    place('th-pa-master-wardrobe', 'th-asset-wardrobe', 'Primary closet wardrobe', 'th-lvl-upper', 1320, 5000, 90),
    place('th-pa-ensuite-toilet', 'th-asset-toilet', 'Ensuite toilet', 'th-lvl-upper', 650, 2950, 90),
    place('th-pa-ensuite-basin', 'th-asset-basin', 'Ensuite basin', 'th-lvl-upper', 1900, 2250, 180),
    place('th-pa-ensuite-shower', 'th-asset-shower', 'Ensuite shower', 'th-lvl-upper', 1900, 3350, 0),
    place('th-pa-bed2', 'th-asset-single-bed', 'Bedroom 2 bed', 'th-lvl-upper', 12400, 3600, 90),
    place('th-pa-bed2-desk', 'th-asset-desk', 'Bedroom 2 desk', 'th-lvl-upper', 9900, 5250, 0),
    place('th-pa-roof-table', 'th-asset-outdoor-table', 'Roof court outdoor table', 'th-lvl-upper', 11200, 7700, 0),
    place('th-pa-roof-chair-1', 'th-asset-lounge-chair', 'Roof court lounge chair 1', 'th-lvl-upper', 10000, 7000, 20),
    place('th-pa-roof-chair-2', 'th-asset-lounge-chair', 'Roof court lounge chair 2', 'th-lvl-upper', 12700, 8900, 200),

    // Checkpoint viewpoints and documentation surfaces.
    {
      type: 'saveViewpoint',
      id: 'vp-main-iso',
      name: 'Main image-matched axonometric - front loggia and roof court',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: -7600, yMm: -9800, zMm: 9800 },
        target: { xMm: 7000, yMm: 4300, zMm: 3900 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-front-elev',
      name: 'Front elevation - deep three-bay upper loggia',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 7000, yMm: -17500, zMm: 4200 },
        target: { xMm: 7000, yMm: 2700, zMm: 4200 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-side-elev-east',
      name: 'Right/east view - recessed carport and roof court',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 21000, yMm: 3300, zMm: 8200 },
        target: { xMm: 9600, yMm: 4750, zMm: 3900 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-rear-axo',
      name: 'Rear/right axonometric - roof court return faces',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 20500, yMm: 15800, zMm: 10900 },
        target: { xMm: 8200, yMm: 6200, zMm: 4300 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-terrace-se',
      name: 'High roof court checkpoint',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 15800, yMm: 12800, zMm: 14500 },
        target: { xMm: 11100, yMm: 7600, zMm: 5200 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'upsertPlanTagStyle',
      id: 'th-tag-room',
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
      id: 'th-room-colors',
      schemeRows: [
        { programmeCode: 'circulation', schemeColorHex: '#D6E5F4' },
        { programmeCode: 'living', schemeColorHex: '#E7DCC8' },
        { programmeCode: 'kitchen', schemeColorHex: '#D9E7D4' },
        { programmeCode: 'utility', schemeColorHex: '#E8E0D4' },
        { programmeCode: 'closet', schemeColorHex: '#DDD8CB' },
        { programmeCode: 'bedroom', schemeColorHex: '#E4DAEA' },
        { programmeCode: 'bathroom', schemeColorHex: '#D7E6E7' },
        { programmeCode: 'terrace', schemeColorHex: '#D8E4D2' },
      ],
    },
    {
      type: 'upsertPlanView',
      id: 'th-pv-ground',
      name: 'Ground floor plan',
      levelId: 'th-lvl-ground',
      planShowRoomLabels: true,
      planRoomFillOpacityScale: 0.42,
      planDetailLevel: 'fine',
      cropMinMm: pt(-800, -800),
      cropMaxMm: pt(W + 800, D + 800),
      planRoomTagStyleId: 'th-tag-room',
    },
    {
      type: 'upsertPlanView',
      id: 'th-pv-upper',
      name: 'First floor / roof court plan',
      levelId: 'th-lvl-upper',
      planShowRoomLabels: true,
      planRoomFillOpacityScale: 0.42,
      planDetailLevel: 'fine',
      cropMinMm: pt(-800, -800),
      cropMaxMm: pt(W + 800, D + 800),
      planRoomTagStyleId: 'th-tag-room',
    },
    {
      type: 'createSectionCut',
      id: 'th-sec-front-loggia',
      name: 'Section through deep front loggia and folded roof',
      lineStartMm: pt(0, LOGGIA_D),
      lineEndMm: pt(W, LOGGIA_D),
      cropDepthMm: 10000,
    },
    {
      type: 'upsertSheet',
      id: 'th-sheet-ga01',
      name: 'GA-01 Target House General Arrangement',
      titleBlock: 'A2-bim-ai-default',
      paperWidthMm: 594,
      paperHeightMm: 420,
      titleblockParameters: {
        revisionId: 'A',
        revisionCode: 'A',
        issueDate: '2026-05-11',
        issuePurpose: 'Target-house seed rebuild',
      },
    },
    { type: 'upsertSchedule', id: 'th-sch-rooms', name: 'Room schedule', sheetId: 'th-sheet-ga01' },
    { type: 'upsertSchedule', id: 'th-sch-windows', name: 'Window schedule', sheetId: 'th-sheet-ga01' },
    { type: 'upsertSchedule', id: 'th-sch-doors', name: 'Door schedule', sheetId: 'th-sheet-ga01' },
    {
      type: 'upsertSheetViewports',
      sheetId: 'th-sheet-ga01',
      viewportsMm: [
        { viewportId: 'vp-sheet-ground-plan', label: 'Ground floor plan', viewRef: 'plan:th-pv-ground', xMm: 20, yMm: 20, widthMm: 260, heightMm: 180 },
        { viewportId: 'vp-sheet-upper-plan', label: 'First floor / roof court plan', viewRef: 'plan:th-pv-upper', xMm: 300, yMm: 20, widthMm: 260, heightMm: 180 },
        { viewportId: 'vp-sheet-room-schedule', label: 'Room schedule', viewRef: 'schedule:th-sch-rooms', xMm: 20, yMm: 230, widthMm: 170, heightMm: 120 },
        { viewportId: 'vp-sheet-window-schedule', label: 'Window schedule', viewRef: 'schedule:th-sch-windows', xMm: 210, yMm: 230, widthMm: 170, heightMm: 120 },
        { viewportId: 'vp-sheet-door-schedule', label: 'Door schedule', viewRef: 'schedule:th-sch-doors', xMm: 400, yMm: 230, widthMm: 170, heightMm: 120 },
      ],
    },
  ];
}
