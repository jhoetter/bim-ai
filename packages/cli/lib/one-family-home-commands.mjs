/** @typedef {Record<string, unknown>} BimCommand */

/*
 * Canonical seed: the demo "one-family home" project.
 * Rebuilt from scratch per spec/target-house-seed.md (v3 boolean-subtraction massing)
 * and claude-skills/sketch-to-bim/SKILL.md. Visual ground truth:
 * spec/target-house.jpeg.
 *
 * Coordinate convention (plan):
 *   +xMm = east, +yMm = north (south facade is at y=0, viewed from SSW)
 *   Heights use zMm (engine z = render Y).
 */

// ── Dimensional constants ─────────────────────────────────────────────
const TOTAL_W = 12000; // Total building width (UF width)
const GF_W = 8000; // Ground floor width (2/3 of TOTAL_W)
const D = 16000; // Building depth (1:2 ratio for GF)
const F2F = 3000; // Floor-to-floor height
const WALL_T = 250; // Standard wall thickness
const SHELL_T = 500; // Thick wrapper shell (approx 0.5 units)

const CANTILEVER = 4000; // 1/3 of TOTAL_W
const UF_X0 = 0;
const UF_X1 = TOTAL_W;
const GF_X0 = CANTILEVER;
const GF_X1 = TOTAL_W;

const LOGGIA_SETBACK = 1000; // Recessed frontal plane

// Plinth (Material D)
const PLINTH_EXT = 500; // mm extension

// Roof
const RIDGE_X = 9000; // Ridge off-center to the right (3/4 of 12000)
const EAVE_L = 1500; // West eave height above UF level
const EAVE_R = 2500; // East eave height above UF level (higher ridge offset east)
const SLOPE_DEG = 30;

// Derived Ridge Height
const RIDGE_H_ABS = F2F + EAVE_L + Math.round(RIDGE_X * Math.tan((SLOPE_DEG * Math.PI) / 180));

// Chimney (Spec §3)
const CHIMNEY_W = 2000;
const CHIMNEY_X0 = (TOTAL_W - CHIMNEY_W) / 2; // Center it
const CHIMNEY_X1 = CHIMNEY_X0 + CHIMNEY_W;

/**
 * @returns {BimCommand[]}
 */
export function buildOneFamilyHomeCommands() {
  return [
    // ── Project base point + levels ───────────────────────────────────
    {
      type: 'createProjectBasePoint',
      id: 'hf-pbp',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      angleToTrueNorthDeg: 0,
    },
    { type: 'createLevel', id: 'hf-lvl-ground', name: 'Ground Floor', elevationMm: 0 },
    { type: 'createLevel', id: 'hf-lvl-upper', name: 'First Floor', elevationMm: F2F },

    // === PHASE 1: MASSING ===
    {
      type: 'createMass',
      id: 'hf-mass-gf',
      name: 'Ground floor volume',
      levelId: 'hf-lvl-ground',
      footprintMm: [
        { xMm: GF_X0, yMm: 0 },
        { xMm: GF_X1, yMm: 0 },
        { xMm: GF_X1, yMm: D },
        { xMm: GF_X0, yMm: D },
      ],
      heightMm: F2F,
      materialKey: 'white_cladding',
    },
    {
      type: 'createMass',
      id: 'hf-mass-uf',
      name: 'Upper floor volume',
      levelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: UF_X0, yMm: 0 },
        { xMm: UF_X1, yMm: 0 },
        { xMm: UF_X1, yMm: D },
        { xMm: UF_X0, yMm: D },
      ],
      heightMm: 4000,
      materialKey: 'white_render',
    },

    // === PHASE 2: SKELETON ===
    { type: 'deleteElement', elementId: 'hf-mass-gf' },
    { type: 'deleteElement', elementId: 'hf-mass-uf' },

    // GF Walls
    {
      type: 'createWall',
      id: 'hf-w-gf-s',
      name: 'GF south wall',
      levelId: 'hf-lvl-ground',
      start: { xMm: GF_X0, yMm: 0 },
      end: { xMm: GF_X1, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: F2F,
      materialKey: 'white_cladding',
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-e',
      name: 'GF east wall',
      levelId: 'hf-lvl-ground',
      start: { xMm: GF_X1, yMm: 0 },
      end: { xMm: GF_X1, yMm: D },
      thicknessMm: WALL_T,
      heightMm: F2F,
      materialKey: 'white_cladding',
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-n',
      name: 'GF north wall',
      levelId: 'hf-lvl-ground',
      start: { xMm: GF_X1, yMm: D },
      end: { xMm: GF_X0, yMm: D },
      thicknessMm: WALL_T,
      heightMm: F2F,
      materialKey: 'white_cladding',
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-w',
      name: 'GF west wall',
      levelId: 'hf-lvl-ground',
      start: { xMm: GF_X0, yMm: D },
      end: { xMm: GF_X0, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: F2F,
      materialKey: 'white_cladding',
    },

    // UF Shell Side Walls (Thick white band)
    {
      type: 'createWall',
      id: 'hf-w-uf-e',
      name: 'UF east shell wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_X1, yMm: 0 },
      end: { xMm: UF_X1, yMm: D },
      thicknessMm: SHELL_T,
      heightMm: 6000,
      materialKey: 'white_render',
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-w',
      name: 'UF west shell wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_X0, yMm: D },
      end: { xMm: UF_X0, yMm: 0 },
      thicknessMm: SHELL_T,
      heightMm: 6000,
      materialKey: 'white_render',
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-n',
      name: 'UF north wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_X1, yMm: D },
      end: { xMm: UF_X0, yMm: D },
      thicknessMm: WALL_T,
      heightMm: 6000,
      materialKey: 'white_render',
    },

    // UF Recessed Front Wall (at y=LOGGIA_SETBACK)
    // Split into 3 zones for the facade composition
    {
      type: 'createWall',
      id: 'hf-w-uf-s-l',
      name: 'UF south wall left',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_X0 + SHELL_T, yMm: LOGGIA_SETBACK },
      end: { xMm: CHIMNEY_X0, yMm: LOGGIA_SETBACK },
      thicknessMm: WALL_T,
      heightMm: 6000,
      materialKey: 'white_render',
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-s-c',
      name: 'UF south wall center (recessed plane)',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X0, yMm: LOGGIA_SETBACK },
      end: { xMm: CHIMNEY_X1, yMm: LOGGIA_SETBACK },
      thicknessMm: WALL_T,
      heightMm: 6000,
      materialKey: 'white_cladding',
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-s-r',
      name: 'UF south wall right',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X1, yMm: LOGGIA_SETBACK },
      end: { xMm: UF_X1 - SHELL_T, yMm: LOGGIA_SETBACK },
      thicknessMm: WALL_T,
      heightMm: 6000,
      materialKey: 'white_render',
    },

    // Terrace enclosure wall (Spec §2 "recessed vertical glass wall")
    // Sits at the ridge line (x=9000), from terrace start (y=D/2) to back (y=D)
    {
      type: 'createWall',
      id: 'hf-w-terrace-glass',
      name: 'Terrace vertical glass wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: RIDGE_X, yMm: D / 2 },
      end: { xMm: RIDGE_X, yMm: D },
      thicknessMm: 100,
      heightMm: 4000,
      materialKey: 'glass_clear',
      isCurtainWall: true,
    },

    // Floor slabs
    {
      type: 'createFloor',
      id: 'hf-flr-ground',
      name: 'Ground floor slab + plinth',
      levelId: 'hf-lvl-ground',
      boundaryMm: [
        { xMm: GF_X0 - PLINTH_EXT, yMm: -PLINTH_EXT },
        { xMm: GF_X1 + PLINTH_EXT, yMm: -PLINTH_EXT },
        { xMm: GF_X1 + PLINTH_EXT, yMm: D + PLINTH_EXT },
        { xMm: GF_X0 - PLINTH_EXT, yMm: D + PLINTH_EXT },
      ],
      materialKey: 'white_render',
    },
    {
      type: 'createFloor',
      id: 'hf-flr-upper',
      name: 'First floor slab (thick wrapper bottom)',
      levelId: 'hf-lvl-upper',
      boundaryMm: [
        { xMm: UF_X0, yMm: 0 },
        { xMm: UF_X1, yMm: 0 },
        { xMm: UF_X1, yMm: D },
        { xMm: UF_X0, yMm: D },
      ],
      thicknessMm: SHELL_T,
      materialKey: 'white_render',
    },

    // === PHASE 3: ENVELOPE ===
    {
      type: 'createRoof',
      id: 'hf-roof-main',
      name: 'Upper-volume asymmetric gable',
      referenceLevelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: UF_X0, yMm: 0 },
        { xMm: UF_X1, yMm: 0 },
        { xMm: UF_X1, yMm: D },
        { xMm: UF_X0, yMm: D },
      ],
      roofGeometryMode: 'asymmetric_gable',
      ridgeOffsetTransverseMm: RIDGE_X - TOTAL_W / 2, // Engine expects offset from centre
      eaveHeightLeftMm: EAVE_L,
      eaveHeightRightMm: EAVE_R,
      slopeDeg: SLOPE_DEG,
      overhangMm: 0, // Wrapper shell is flush
      materialKey: 'white_render',
    },

    // Attach walls
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-s-l', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-s-c', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-s-r', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-e', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-w', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-n', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-terrace-glass', roofId: 'hf-roof-main' },

    // Roof Cutout (Spec §2)
    // Subtract from ridge (x=9000) to gutter (x=12000) for the back half of the building
    {
      type: 'createRoofOpening',
      id: 'hf-roof-cutout',
      name: 'Terrace roof cutout',
      hostRoofId: 'hf-roof-main',
      boundaryMm: [
        { xMm: RIDGE_X, yMm: D / 2 },
        { xMm: UF_X1, yMm: D / 2 },
        { xMm: UF_X1, yMm: D },
        { xMm: RIDGE_X, yMm: D },
      ],
    },

    // Picture-frame Sweep (The crisp edge from the image)
    // Path: front face outline (y=0)
    {
      type: 'createSweep',
      id: 'hf-sw-frame',
      name: 'Wrapper shell front frame',
      levelId: 'hf-lvl-upper',
      pathMm: [
        { xMm: 0, yMm: 0, zMm: 0 },
        { xMm: TOTAL_W, yMm: 0, zMm: 0 },
        { xMm: TOTAL_W, yMm: 0, zMm: EAVE_R },
        { xMm: RIDGE_X, yMm: 0, zMm: RIDGE_H_ABS - F2F },
        { xMm: 0, yMm: 0, zMm: EAVE_L },
        { xMm: 0, yMm: 0, zMm: 0 },
      ],
      profileMm: [
        { uMm: -SHELL_T / 2, vMm: -50 },
        { uMm: SHELL_T / 2, vMm: -50 },
        { uMm: SHELL_T / 2, vMm: 50 },
        { uMm: -SHELL_T / 2, vMm: 50 },
      ],
      profilePlane: 'work_plane',
      materialKey: 'white_render',
    },

    // === PHASE 4: OPENINGS ===
    // Ground south windows
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-s-1',
      name: 'GF south window 1',
      wallId: 'hf-w-gf-s',
      alongT: 0.25,
      widthMm: 800,
      heightMm: 2000,
      sillHeightMm: 200,
      familyTypeId: 'window_casement_fixed',
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-s-2',
      name: 'GF south window 2 (stair)',
      wallId: 'hf-w-gf-s',
      alongT: 0.5,
      widthMm: 800,
      heightMm: 2000,
      sillHeightMm: 200,
      familyTypeId: 'window_casement_fixed',
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-front',
      name: 'Front door',
      wallId: 'hf-w-gf-s',
      alongT: 0.9,
      widthMm: 1000,
      familyTypeId: 'door_hinged_single',
    },

    // Upper Front Openings
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-uf-trap',
      name: 'Upper left trapezoidal window',
      wallId: 'hf-w-uf-s-l',
      alongT: 0.5,
      widthMm: 2500,
      heightMm: 2000,
      sillHeightMm: 500,
      familyTypeId: 'window_casement_fixed',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-win-uf-trap',
      key: 'outlineKind',
      value: 'gable_trapezoid',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-win-uf-trap',
      key: 'attachedRoofId',
      value: 'hf-roof-main',
    },

    // Curtain wall on the right
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-uf-curtain',
      name: 'Upper right curtain wall',
      wallId: 'hf-w-uf-s-r',
      alongT: 0.5,
      widthMm: 3500,
      heightMm: 2800,
      sillHeightMm: 0,
      familyTypeId: 'window_curtain_wall',
    },
    // Mullion logic would be here if supported, or via curtain wall family

    // === PHASE 5: INTERIOR ===
    {
      type: 'createStair',
      id: 'hf-stair-main',
      name: 'Interior staircase',
      baseLevelId: 'hf-lvl-ground',
      topLevelId: 'hf-lvl-upper',
      runStartMm: { xMm: GF_X0 + 4000, yMm: 500 },
      runEndMm: { xMm: GF_X0 + 4000, yMm: 5000 },
      widthMm: 1000,
      riserMm: 176,
      treadMm: 250,
    },

    {
      type: 'createRoomOutline',
      id: 'hf-room-gf',
      name: 'Ground Floor Living',
      levelId: 'hf-lvl-ground',
      outlineMm: [
        { xMm: GF_X0 + 200, yMm: 200 },
        { xMm: GF_X1 - 200, yMm: 200 },
        { xMm: GF_X1 - 200, yMm: D - 200 },
        { xMm: GF_X0 + 200, yMm: D - 200 },
      ],
      programmeCode: 'living',
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-uf-main',
      name: 'Master Suite',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: UF_X0 + SHELL_T + 200, yMm: LOGGIA_SETBACK + 200 },
        { xMm: UF_X1 - SHELL_T - 200, yMm: LOGGIA_SETBACK + 200 },
        { xMm: UF_X1 - SHELL_T - 200, yMm: D / 2 - 200 },
        { xMm: UF_X0 + SHELL_T + 200, yMm: D / 2 - 200 },
      ],
      programmeCode: 'bedroom',
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-terrace',
      name: 'Roof Terrace',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: RIDGE_X + 200, yMm: D / 2 + 200 },
        { xMm: UF_X1 - SHELL_T - 200, yMm: D / 2 + 200 },
        { xMm: UF_X1 - SHELL_T - 200, yMm: D - 200 },
        { xMm: RIDGE_X + 200, yMm: D - 200 },
      ],
      programmeCode: 'terrace',
    },

    // === PHASE 6: DETAIL ===
    // Chimney protrusion (Spec §3 Center volume)
    // It's a vertical siding volume in front of hf-w-uf-s-c
    {
      type: 'createWall',
      id: 'hf-w-chimney-s',
      name: 'Chimney face',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X0, yMm: 0 },
      end: { xMm: CHIMNEY_X1, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: 6000,
      materialKey: 'white_cladding',
    },
    {
      type: 'createWall',
      id: 'hf-w-chimney-w',
      name: 'Chimney side west',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X0, yMm: LOGGIA_SETBACK },
      end: { xMm: CHIMNEY_X0, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: 6000,
      materialKey: 'white_cladding',
    },
    {
      type: 'createWall',
      id: 'hf-w-chimney-e',
      name: 'Chimney side east',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X1, yMm: 0 },
      end: { xMm: CHIMNEY_X1, yMm: LOGGIA_SETBACK },
      thicknessMm: WALL_T,
      heightMm: 6000,
      materialKey: 'white_cladding',
    },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-chimney-s', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-chimney-w', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-chimney-e', roofId: 'hf-roof-main' },

    // Railing (Spec §3 Balcony)
    // Across entire upper front width at y=0 (inner edge of shell)
    {
      type: 'createRailing',
      id: 'hf-rail-balcony',
      name: 'Upper balcony railing',
      pathMm: [
        { xMm: UF_X0 + SHELL_T, yMm: 50 },
        { xMm: CHIMNEY_X0, yMm: 50 },
        // Gap for chimney? No, "across the entire upper front width"
        // But the chimney is at y=0. So railing stops at chimney.
      ],
    },
    {
      type: 'createRailing',
      id: 'hf-rail-balcony-2',
      name: 'Upper balcony railing 2',
      pathMm: [
        { xMm: CHIMNEY_X1, yMm: 50 },
        { xMm: UF_X1 - SHELL_T, yMm: 50 },
      ],
    },

    // === PHASE 7: DOCUMENTATION ===
    {
      type: 'saveViewpoint',
      id: 'vp-main-iso',
      name: 'Main isometric (Spec §5 front-left)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: -8000, yMm: -12000, zMm: 12000 },
        target: { xMm: 6000, yMm: 8000, zMm: 3000 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-front-elev',
      name: 'Front elevation (south)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 6000, yMm: -12000, zMm: 4500 },
        target: { xMm: 6000, yMm: 8000, zMm: 4500 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-terrace',
      name: 'Roof Terrace view',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 14000, yMm: 14000, zMm: 6000 },
        target: { xMm: 10000, yMm: 12000, zMm: 4000 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
  ];
}
