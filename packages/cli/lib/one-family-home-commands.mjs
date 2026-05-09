/** @typedef {Record<string, unknown>} BimCommand */

/*
 * Canonical seed: the demo "one-family home" project.
 * Rebuilt from scratch per spec/target-house-seed.md (v3 boolean-subtraction massing)
 * and claude-skills/sketch-to-bim/SKILL.md. Visual ground truth:
 * spec/target-house-vis-colored.png + spec/target-house-seed-vis.png.
 *
 * Brief at nightshift/seed-target-house/brief.md.
 *
 * Coordinate convention (plan):
 *   +xMm = east, +yMm = north (south facade is at y=0, viewed from SSW)
 *   Heights use zMm (engine z = render Y).
 */

// ── Dimensional constants ─────────────────────────────────────────────
const GF_W = 7500; // Ground floor E-W width; EXT_W = GF_W−UF_W = 2500 = 1/3 GF_W (spec §1)
const D = 8000; // Building depth N-S, shared by all volumes
const UF_W = 5000; // Upper floor E-W width (west-aligned; east extension = GF_W−UF_W)
const F2F = 3000; // Ground → first floor height
const PARAPET_H = 200; // East terrace parapet height above first-floor slab
const WALL_T = 250; // Standard exterior wall thickness

// Loggia (recessed upper front, spec §1 "wrapper shell creates deeply recessed frontal plane")
const LOGGIA_SETBACK = 1500; // mm setback — spec §1 brief value

// Plinth (Material D — spec §4 "extends exactly 0.5 units beyond building footprint")
const PLINTH_EXT = 500; // mm extension on all sides

// Roof — near-symmetric gable per visual ground truth (target-house-vis-colored.png).
// Slope sanity: eaveLeft + leftRun·tan(slopeDeg) > eaveRight
//   1500 + 3000·tan(30°) = 1500 + 1732 = 3232 > 2300 ✓
const EAVE_L = 1500; // West eave height above UF level (F2F+1500 = z=4500 abs)
const EAVE_R = 2300; // East eave height above UF level (F2F+2300 = z=5300 abs)
const RIDGE_OFF = 500; // Ridge offset east of UF centre (2500+500 = x=3000 from west edge)
const SLOPE_DEG = 30; // Gable pitch in degrees

// Derived: ridge position and absolute height (used in sweep path)
const RIDGE_X = UF_W / 2 + RIDGE_OFF; // = 3000 — ridge x from west UF edge = leftRun
const RIDGE_H_ABS =
  F2F + EAVE_L + Math.round(RIDGE_X * Math.tan((SLOPE_DEG * Math.PI) / 180));
// = 3000 + 1500 + round(3000 × 0.5774) = 3000 + 1500 + 1732 = 6232

// Chimney-like center protrusion (spec §3 "protruding vertical chimney-like volume
// clad in vertical siding"). Spans the middle third of the UF south loggia.
const CHIMNEY_X0 = 1500; // West edge within UF footprint
const CHIMNEY_X1 = 3000; // East edge
const CHIMNEY_H = 3000; // Height above UF level (below ridge at 3232 mm)

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
    // Three massing volumes define the asymmetric two-stack composition:
    //   GF (7500×8000) — wider base, board-and-batten cladding
    //   UF (5000×8000, west-aligned) — upper shell, white render
    //   East parapet block (2500×8000, 200 mm) — low parapet for roof terrace
    // East extension = exactly 1/3 of GF_W per spec §1.
    {
      type: 'createMass',
      id: 'hf-mass-gf',
      name: 'Ground floor mass',
      levelId: 'hf-lvl-ground',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: GF_W, yMm: 0 },
        { xMm: GF_W, yMm: D },
        { xMm: 0, yMm: D },
      ],
      heightMm: F2F,
      materialKey: 'cladding_beige_grey',
    },
    {
      type: 'createMass',
      id: 'hf-mass-uf',
      name: 'Upper floor mass (west-aligned)',
      levelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: UF_W, yMm: 0 },
        { xMm: UF_W, yMm: D },
        { xMm: 0, yMm: D },
      ],
      heightMm: EAVE_R + 1000,
      materialKey: 'white_render',
    },
    {
      type: 'createMass',
      id: 'hf-mass-parapet',
      name: 'East terrace parapet block',
      levelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: UF_W, yMm: 0 },
        { xMm: GF_W, yMm: 0 },
        { xMm: GF_W, yMm: D },
        { xMm: UF_W, yMm: D },
      ],
      heightMm: PARAPET_H,
      materialKey: 'white_render',
    },

    // === PHASE 2: SKELETON ===
    // Delete phase-1 masses; author load-bearing walls, floor slabs, flat-roof placeholder.
    // Manual authoring avoids coplanar-slab z-fighting that materializeMassToWalls
    // would produce at the UF / east-terrace boundary.
    { type: 'deleteElement', elementId: 'hf-mass-gf' },
    { type: 'deleteElement', elementId: 'hf-mass-uf' },
    { type: 'deleteElement', elementId: 'hf-mass-parapet' },

    // Ground-floor perimeter walls (CCW from SW corner, height = F2F).
    {
      type: 'createWall',
      id: 'hf-w-gf-s',
      name: 'GF south wall',
      levelId: 'hf-lvl-ground',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: GF_W, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: F2F,
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-e',
      name: 'GF east wall',
      levelId: 'hf-lvl-ground',
      start: { xMm: GF_W, yMm: 0 },
      end: { xMm: GF_W, yMm: D },
      thicknessMm: WALL_T,
      heightMm: F2F,
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-n',
      name: 'GF north wall',
      levelId: 'hf-lvl-ground',
      start: { xMm: GF_W, yMm: D },
      end: { xMm: 0, yMm: D },
      thicknessMm: WALL_T,
      heightMm: F2F,
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-w',
      name: 'GF west wall',
      levelId: 'hf-lvl-ground',
      start: { xMm: 0, yMm: D },
      end: { xMm: 0, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: F2F,
    },

    // Upper-floor perimeter walls (5000×8000, west-aligned).
    // heightMm oversized at 5500 so attachWallTopToRoof can trim them
    // correctly along the asymmetric gable slopes in Phase 3.
    {
      type: 'createWall',
      id: 'hf-w-uf-s',
      name: 'UF south wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: UF_W, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: 5500,
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-e',
      name: 'UF east wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_W, yMm: 0 },
      end: { xMm: UF_W, yMm: D },
      thicknessMm: WALL_T,
      heightMm: 5500,
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-n',
      name: 'UF north wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_W, yMm: D },
      end: { xMm: 0, yMm: D },
      thicknessMm: WALL_T,
      heightMm: 5500,
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-w',
      name: 'UF west wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: 0, yMm: D },
      end: { xMm: 0, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: 5500,
    },

    // East terrace parapet walls — south / east / north
    // (west edge abuts the UF east wall; no parapet needed there).
    {
      type: 'createWall',
      id: 'hf-w-pa-s',
      name: 'Terrace parapet south',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_W, yMm: 0 },
      end: { xMm: GF_W, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: PARAPET_H,
    },
    {
      type: 'createWall',
      id: 'hf-w-pa-e',
      name: 'Terrace parapet east',
      levelId: 'hf-lvl-upper',
      start: { xMm: GF_W, yMm: 0 },
      end: { xMm: GF_W, yMm: D },
      thicknessMm: WALL_T,
      heightMm: PARAPET_H,
    },
    {
      type: 'createWall',
      id: 'hf-w-pa-n',
      name: 'Terrace parapet north',
      levelId: 'hf-lvl-upper',
      start: { xMm: GF_W, yMm: D },
      end: { xMm: UF_W, yMm: D },
      thicknessMm: WALL_T,
      heightMm: PARAPET_H,
    },

    // Floor slabs.
    // GF slab extends PLINTH_EXT mm beyond the footprint on all sides to create
    // the low white plinth base (Material D, spec §4).
    {
      type: 'createFloor',
      id: 'hf-flr-ground',
      name: 'Ground floor slab + plinth',
      levelId: 'hf-lvl-ground',
      boundaryMm: [
        { xMm: -PLINTH_EXT, yMm: -PLINTH_EXT },
        { xMm: GF_W + PLINTH_EXT, yMm: -PLINTH_EXT },
        { xMm: GF_W + PLINTH_EXT, yMm: D + PLINTH_EXT },
        { xMm: -PLINTH_EXT, yMm: D + PLINTH_EXT },
      ],
      materialKey: 'white_render',
    },
    {
      type: 'createFloor',
      id: 'hf-flr-upper',
      name: 'First floor slab (west)',
      levelId: 'hf-lvl-upper',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: UF_W, yMm: 0 },
        { xMm: UF_W, yMm: D },
        { xMm: 0, yMm: D },
      ],
      materialKey: 'white_render',
    },
    {
      type: 'createFloor',
      id: 'hf-flr-deck',
      name: 'East roof terrace deck',
      levelId: 'hf-lvl-upper',
      boundaryMm: [
        { xMm: UF_W, yMm: 0 },
        { xMm: GF_W, yMm: 0 },
        { xMm: GF_W, yMm: D },
        { xMm: UF_W, yMm: D },
      ],
      materialKey: 'white_render',
    },

    // Flat roof placeholder — Phase 3 deletes and recreates as asymmetric_gable.
    {
      type: 'createRoof',
      id: 'hf-roof-main',
      name: 'Upper-volume roof (flat placeholder)',
      referenceLevelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: UF_W, yMm: 0 },
        { xMm: UF_W, yMm: D },
        { xMm: 0, yMm: D },
      ],
      roofGeometryMode: 'flat',
      slopeDeg: 0,
      overhangMm: 0,
    },

    // === PHASE 3: ENVELOPE ===
    // Promote the flat placeholder to the calibrated asymmetric gable.
    // updateElementProperty for roofs is restricted to name/roofTypeId/roofGeometryMode
    // subset, so we delete + recreate rather than mutate in place.
    { type: 'deleteElement', elementId: 'hf-roof-main' },
    {
      type: 'createRoof',
      id: 'hf-roof-main',
      name: 'Upper-volume asymmetric gable',
      referenceLevelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: UF_W, yMm: 0 },
        { xMm: UF_W, yMm: D },
        { xMm: 0, yMm: D },
      ],
      roofGeometryMode: 'asymmetric_gable',
      // Near-symmetric per visual ground truth; ridge slightly east of centre.
      // Slope sanity: 1500 + 3000·tan(30°) = 3232 > 2300 (east eave) ✓
      ridgeOffsetTransverseMm: RIDGE_OFF,
      eaveHeightLeftMm: EAVE_L,
      eaveHeightRightMm: EAVE_R,
      slopeDeg: SLOPE_DEG,
      overhangMm: 0,
      materialKey: 'metal_standing_seam_dark_grey',
    },

    // Attach all 4 UF walls to the gable so their tops crop along the slopes.
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-s', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-e', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-n', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-w', roofId: 'hf-roof-main' },

    // Dense-mesh fix for UF north gable-end wall: a minimal recessZone forces
    // makeRecessedWallMesh (25-sample path) over makeSlopedWallMesh (2-sample),
    // correctly producing the triangular gable crown at the peak.
    {
      type: 'setWallRecessZones',
      wallId: 'hf-w-uf-n',
      recessZones: [{ alongTStart: 0.0, alongTEnd: 1.0, setbackMm: 50, floorContinues: false }],
    },

    // Apply materials — spec §4:
    //   Material A (white render):  roof ✓ | UF side walls (E/N/W) | floor slabs ✓
    //   Material B (cladding):      all GF walls | UF south loggia back wall + chimney
    //   Parapet walls → white_render (part of the upper "wrapper shell")
    { type: 'updateElementProperty', elementId: 'hf-w-gf-s', key: 'materialKey', value: 'cladding_beige_grey' },
    { type: 'updateElementProperty', elementId: 'hf-w-gf-e', key: 'materialKey', value: 'cladding_beige_grey' },
    { type: 'updateElementProperty', elementId: 'hf-w-gf-n', key: 'materialKey', value: 'cladding_beige_grey' },
    { type: 'updateElementProperty', elementId: 'hf-w-gf-w', key: 'materialKey', value: 'cladding_beige_grey' },
    // UF south primary materialKey renders on the loggia recess back surfaces (Phase 4).
    { type: 'updateElementProperty', elementId: 'hf-w-uf-s', key: 'materialKey', value: 'cladding_warm_wood' },
    // UF side walls = white render (Material A — the "wrapper shell").
    { type: 'updateElementProperty', elementId: 'hf-w-uf-e', key: 'materialKey', value: 'white_render' },
    { type: 'updateElementProperty', elementId: 'hf-w-uf-n', key: 'materialKey', value: 'white_render' },
    { type: 'updateElementProperty', elementId: 'hf-w-uf-w', key: 'materialKey', value: 'white_render' },
    // Parapet walls = white render (part of the upper shell).
    { type: 'updateElementProperty', elementId: 'hf-w-pa-s', key: 'materialKey', value: 'white_render' },
    { type: 'updateElementProperty', elementId: 'hf-w-pa-e', key: 'materialKey', value: 'white_render' },
    { type: 'updateElementProperty', elementId: 'hf-w-pa-n', key: 'materialKey', value: 'white_render' },

    // Picture-frame sweep (KRN-15) — white gable pentagon outline on south face.
    // Path traces the asymmetric gable polygon (5 vertices, closed):
    //   SW → SE (eave line at F2F) → E-eave → Ridge → W-eave → close.
    // Ridge x = RIDGE_X = 3000, Ridge z = RIDGE_H_ABS = 6232 (derived above).
    {
      type: 'createSweep',
      id: 'hf-sw-frame',
      name: 'Picture-frame gable outline',
      levelId: 'hf-lvl-ground',
      pathMm: [
        { xMm: 0, yMm: 0, zMm: F2F },
        { xMm: UF_W, yMm: 0, zMm: F2F },
        { xMm: UF_W, yMm: 0, zMm: F2F + EAVE_R },
        { xMm: RIDGE_X, yMm: 0, zMm: RIDGE_H_ABS },
        { xMm: 0, yMm: 0, zMm: F2F + EAVE_L },
        { xMm: 0, yMm: 0, zMm: F2F },
      ],
      profileMm: [
        { uMm: -175, vMm: -100 },
        { uMm: 175, vMm: -100 },
        { uMm: 175, vMm: 100 },
        { uMm: -175, vMm: 100 },
      ],
      profilePlane: 'work_plane',
      materialKey: 'white_render',
    },

    // === PHASE 4: OPENINGS ===
    // Ground-floor south facade — spec §3:
    //   Two identical portrait windows (left half of facade).
    //   Window 2 aligns with the stair so at least 8 treads are visible (spec §3).
    //   Recessed door at the far right (alongT=0.88 → x≈6600 of 7500).
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-s-1',
      name: 'GF south window (left)',
      wallId: 'hf-w-gf-s',
      alongT: 0.15,
      widthMm: 700,
      heightMm: 1800,
      sillHeightMm: 200,
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-s-2',
      name: 'GF south window (right of pair — stair visible through)',
      wallId: 'hf-w-gf-s',
      alongT: 0.37,
      widthMm: 700,
      heightMm: 1800,
      sillHeightMm: 200,
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-front',
      name: 'Front door (far right, recessed)',
      wallId: 'hf-w-gf-s',
      alongT: 0.88,
      widthMm: 900,
    },

    // Loggia recess — full-width recessZone on UF south wall (spec §1 "approx 1 m deep").
    // The cladding_warm_wood materialKey (set Phase 3) renders on both setback back surfaces.
    // The chimney mass (Phase 6) sits inside the centre zone (x=1500..3000) and its south
    // face (at y=0) is visible as the "protruding chimney-like volume" (spec §3).
    {
      type: 'setWallRecessZones',
      wallId: 'hf-w-uf-s',
      recessZones: [
        { alongTStart: 0.0, alongTEnd: 1.0, setbackMm: LOGGIA_SETBACK, floorContinues: true },
      ],
    },

    // Left loggia zone — trapezoidal window whose top edge follows the west gable pitch.
    // alongT=0.15 → x=750 mm, centre of the left zone (x=0..1500).
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-loggia-trap',
      name: 'Loggia left — trapezoidal slope-following window',
      wallId: 'hf-w-uf-s',
      alongT: 0.15,
      widthMm: 900,
      heightMm: 1400,
      sillHeightMm: 300,
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-win-loggia-trap',
      key: 'outlineKind',
      value: 'gable_trapezoid',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-win-loggia-trap',
      key: 'attachedRoofId',
      value: 'hf-roof-main',
    },

    // Right loggia zone — double-height sliding-glass curtain wall (spec §3
    // "double-height curtain wall of glass divided by a central horizontal mullion").
    // alongT=0.80 → x=4000 mm, centre of right zone (x=3000..5000).
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-loggia',
      name: 'Loggia right — sliding glass curtain wall',
      wallId: 'hf-w-uf-s',
      alongT: 0.8,
      widthMm: 1800,
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-door-loggia',
      key: 'operationType',
      value: 'sliding_double',
    },

    // === PHASE 5: INTERIOR ===
    // Main stair — straight N-S run, GF → UF.
    // Start close to the GF south wall so treads face south and are visible
    // through GF south window 2 (at x≈2775, spec §3 "at least 8 visible treads").
    // 17 risers × 176 mm = 2992 mm ≈ F2F. Run 3520 mm (16 treads × 220 mm).
    {
      type: 'createStair',
      id: 'hf-stair-main',
      name: 'Main stair',
      baseLevelId: 'hf-lvl-ground',
      topLevelId: 'hf-lvl-upper',
      runStartMm: { xMm: 2700, yMm: 500 },
      runEndMm: { xMm: 2700, yMm: 4020 },
      widthMm: 900,
      riserMm: 176,
      treadMm: 220,
    },

    // Stair-shaft slab opening in the first-floor slab.
    {
      type: 'createSlabOpening',
      id: 'hf-slab-stair',
      name: 'Stair shaft opening',
      hostFloorId: 'hf-flr-upper',
      boundaryMm: [
        { xMm: 2250, yMm: 500 },
        { xMm: 3150, yMm: 500 },
        { xMm: 3150, yMm: 4020 },
        { xMm: 2250, yMm: 4020 },
      ],
      isShaft: true,
    },

    // Stair railing (west side of stair run).
    {
      type: 'createRailing',
      id: 'hf-rail-stair',
      name: 'Stair railing',
      hostedStairId: 'hf-stair-main',
      pathMm: [
        { xMm: 2250, yMm: 500 },
        { xMm: 2250, yMm: 4020 },
      ],
    },

    // UF partition walls — E-W mid-depth + N-S back partition.
    {
      type: 'createWall',
      id: 'hf-w-uf-ptn-mid',
      name: 'UF mid partition (E-W)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 0, yMm: 4000 },
      end: { xMm: UF_W, yMm: 4000 },
      thicknessMm: 120,
      heightMm: 2700,
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-ptn-back',
      name: 'UF back partition (N-S)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 2500, yMm: 4000 },
      end: { xMm: 2500, yMm: D },
      thicknessMm: 120,
      heightMm: 2700,
    },

    // Sliding glass doors on UF east wall → east roof terrace (spec §2
    // "recessed vertical glass wall... reveals a hidden upper-level terrace").
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-terrace',
      name: 'Terrace sliding doors (UF east → terrace)',
      wallId: 'hf-w-uf-e',
      alongT: 0.35,
      widthMm: 2400,
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-door-terrace',
      key: 'operationType',
      value: 'sliding_double',
    },

    // Rooms.
    {
      type: 'createRoomOutline',
      id: 'hf-room-living',
      name: 'Open-plan kitchen + living',
      levelId: 'hf-lvl-ground',
      outlineMm: [
        { xMm: 200, yMm: 200 },
        { xMm: 7300, yMm: 200 },
        { xMm: 7300, yMm: 7800 },
        { xMm: 200, yMm: 7800 },
      ],
      programmeCode: 'living',
      targetAreaM2: 56,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bed-1',
      name: 'Bedroom 1 (master)',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: 200, yMm: 200 },
        { xMm: 4800, yMm: 200 },
        { xMm: 4800, yMm: 3900 },
        { xMm: 200, yMm: 3900 },
      ],
      programmeCode: 'bedroom',
      targetAreaM2: 18,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bed-2',
      name: 'Bedroom 2',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: 200, yMm: 4100 },
        { xMm: 2400, yMm: 4100 },
        { xMm: 2400, yMm: 7800 },
        { xMm: 200, yMm: 7800 },
      ],
      programmeCode: 'bedroom',
      targetAreaM2: 12,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bath',
      name: 'Bathroom',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: 2600, yMm: 4100 },
        { xMm: 4800, yMm: 4100 },
        { xMm: 4800, yMm: 7800 },
        { xMm: 2600, yMm: 7800 },
      ],
      programmeCode: 'bathroom',
      targetAreaM2: 6,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-deck',
      name: 'East roof terrace',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: UF_W + 200, yMm: 200 },
        { xMm: GF_W - 200, yMm: 200 },
        { xMm: GF_W - 200, yMm: D - 200 },
        { xMm: UF_W + 200, yMm: D - 200 },
      ],
      programmeCode: 'terrace',
      targetAreaM2: 20,
    },

    // === PHASE 6: DETAIL ===
    // Chimney-like centre protrusion (spec §3).
    // A mass occupying x=CHIMNEY_X0..CHIMNEY_X1, y=0..LOGGIA_SETBACK at UF level.
    // Its south face (at y=0) is flush with the main facade line; flanked by the
    // left (trapezoidal window) and right (curtain wall) loggia bays.
    {
      type: 'createMass',
      id: 'hf-mass-chimney',
      name: 'Chimney-like centre protrusion',
      levelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: CHIMNEY_X0, yMm: 0 },
        { xMm: CHIMNEY_X1, yMm: 0 },
        { xMm: CHIMNEY_X1, yMm: LOGGIA_SETBACK },
        { xMm: CHIMNEY_X0, yMm: LOGGIA_SETBACK },
      ],
      heightMm: CHIMNEY_H,
      materialKey: 'cladding_warm_wood',
    },

    // Loggia balcony slab + balustrade (spec §3 "three thin, continuous black
    // horizontal cables/rails fixed to the inner edge of the white shell").
    // Projects 700 mm south of the main facade plane at elevation F2F.
    {
      type: 'createBalcony',
      id: 'hf-balcony-loggia',
      name: 'Loggia balcony',
      wallId: 'hf-w-uf-s',
      elevationMm: F2F,
      projectionMm: 700,
      slabThicknessMm: 150,
      balustradeHeightMm: 1100,
    },

    // === PHASE 7: DOCUMENTATION ===
    // Four camera presets matching the panels in target-house-vis-colored.png.
    {
      type: 'saveViewpoint',
      id: 'vp-main-iso',
      name: 'Main isometric (SSW)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: -1500, yMm: -7500, zMm: 11000 },
        target: { xMm: 3500, yMm: 4000, zMm: 4250 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-front-elev',
      name: 'Front elevation (south)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 3500, yMm: -12000, zMm: 4250 },
        target: { xMm: 3500, yMm: 4000, zMm: 4250 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-side-elev-west',
      name: 'Side elevation (WSW)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: -14000, yMm: -1000, zMm: 5000 },
        target: { xMm: 2500, yMm: 5000, zMm: 2500 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-rear-axo',
      name: 'Rear axonometric (NE)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 12000, yMm: 14000, zMm: 11000 },
        target: { xMm: 3500, yMm: 4000, zMm: 4250 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },

    // Plan views.
    { type: 'upsertPlanView', id: 'hf-pv-ground', name: 'GF plan', levelId: 'hf-lvl-ground' },
    { type: 'upsertPlanView', id: 'hf-pv-upper', name: 'First-floor plan', levelId: 'hf-lvl-upper' },

    // Section cut through loggia at y=2000 — reveals gable + recess + balcony.
    {
      type: 'createSectionCut',
      id: 'hf-sec-loggia',
      name: 'South facade section through loggia',
      lineStartMm: { xMm: 0, yMm: 2000 },
      lineEndMm: { xMm: GF_W, yMm: 2000 },
      cropDepthMm: 9000,
    },

    // Sheet + schedules.
    {
      type: 'upsertSheet',
      id: 'hf-sheet-ga01',
      name: 'GA-01 General arrangement',
      titleBlock: 'A2-bim-ai-default',
      paperWidthMm: 594,
      paperHeightMm: 420,
    },
    { type: 'upsertSchedule', id: 'hf-sch-rooms', name: 'Room schedule', sheetId: 'hf-sheet-ga01' },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-windows',
      name: 'Window schedule',
      sheetId: 'hf-sheet-ga01',
    },
    { type: 'upsertSchedule', id: 'hf-sch-doors', name: 'Door schedule', sheetId: 'hf-sheet-ga01' },
  ];
}
