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
const LOGGIA_SETBACK = 1000; // mm setback — spec §1 brief value

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
const CHIMNEY_X0 = 2000; // chimney left edge — equal 2000 mm left/right zones; right edge at ridge x=3000
const CHIMNEY_X1 = 3000; // chimney right edge = ridge x — 1000 mm narrow chimney, 20% of UF facade
const CHIMNEY_H = 2000; // Height above UF level — roof at x=1500 is 2366 mm, so 2000 clears by 366 mm

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
      materialKey: 'cladding_warm_wood',
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
    // UF south wall split into 3 segments so each zone gets its own material:
    //   s-l (x=0..1500): loggia left zone → white_render on back surface
    //   s-c (x=1500..3000): chimney face, stays flush → cladding_warm_wood
    //   s-r (x=3000..5000): loggia right zone → white_render on back surface
    {
      type: 'createWall',
      id: 'hf-w-uf-s-l',
      name: 'UF south wall left (loggia)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: CHIMNEY_X0, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: 5500,
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-s-c',
      name: 'UF south wall centre (chimney face)',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X0, yMm: 0 },
      end: { xMm: CHIMNEY_X1, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: 5500,
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-s-r',
      name: 'UF south wall right (loggia)',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X1, yMm: 0 },
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
      overhangMm: 600,
      materialKey: 'white_render',
    },
    {
      type: 'createRoofOpening',
      id: 'hf-roof-terrace-cutout',
      name: 'Right-slope rectangular roof cutout',
      hostRoofId: 'hf-roof-main',
      // Spec §2: large rectangular subtraction on the right-hand slope,
      // extending from near the ridge down toward the east gutter to reveal
      // the hidden upper-level terrace and its recessed glass wall.
      boundaryMm: [
        { xMm: RIDGE_X + 250, yMm: 4200 },
        { xMm: UF_W, yMm: 4200 },
        { xMm: UF_W, yMm: 7400 },
        { xMm: RIDGE_X + 250, yMm: 7400 },
      ],
    },

    // Attach all UF south segments and side walls to the gable.
    // hf-w-uf-s-c is also attached: height 5500 → trimmed by gable profile.
    // The chimney reads as a protrusion because s-l and s-r are recessed 1500 mm back while s-c is flush.
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-s-l', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-s-c', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-s-r', roofId: 'hf-roof-main' },
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
    //   Material B (cladding_warm_wood): all GF walls + chimney face — single material per spec §4
    //   Parapet walls → white_render (part of the upper "wrapper shell")
    { type: 'updateElementProperty', elementId: 'hf-w-gf-s', key: 'materialKey', value: 'cladding_warm_wood' },
    { type: 'updateElementProperty', elementId: 'hf-w-gf-e', key: 'materialKey', value: 'cladding_warm_wood' },
    { type: 'updateElementProperty', elementId: 'hf-w-gf-n', key: 'materialKey', value: 'cladding_warm_wood' },
    { type: 'updateElementProperty', elementId: 'hf-w-gf-w', key: 'materialKey', value: 'cladding_warm_wood' },
    // UF south split walls: loggia back surfaces → white_render; chimney face → cladding_warm_wood.
    { type: 'updateElementProperty', elementId: 'hf-w-uf-s-l', key: 'materialKey', value: 'white_render' },
    { type: 'updateElementProperty', elementId: 'hf-w-uf-s-c', key: 'materialKey', value: 'white_cladding' },
    { type: 'updateElementProperty', elementId: 'hf-w-uf-s-r', key: 'materialKey', value: 'white_render' },
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
        { uMm: -100, vMm: -60 },
        { uMm: 100, vMm: -60 },
        { uMm: 100, vMm: 60 },
        { uMm: -100, vMm: 60 },
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

    // Loggia recess — all three south wall segments recessed equally.
    // The chimney centre (s-c) is ALSO recessed so its face sits at the loggia back plane
    // (y=LOGGIA_SETBACK), making the chimney read as an interior column visible through
    // the glass — not a solid protrusion at the facade line.
    // This also aligns all three balcony slabs to the same y so they form one flat band.
    {
      type: 'setWallRecessZones',
      wallId: 'hf-w-uf-s-l',
      recessZones: [{ alongTStart: 0.0, alongTEnd: 1.0, setbackMm: LOGGIA_SETBACK, floorContinues: true }],
    },
    {
      type: 'setWallRecessZones',
      wallId: 'hf-w-uf-s-c',
      recessZones: [{ alongTStart: 0.0, alongTEnd: 1.0, setbackMm: LOGGIA_SETBACK, floorContinues: true }],
    },
    {
      type: 'setWallRecessZones',
      wallId: 'hf-w-uf-s-r',
      recessZones: [{ alongTStart: 0.0, alongTEnd: 1.0, setbackMm: LOGGIA_SETBACK, floorContinues: true }],
    },

    // Left loggia zone — wide trapezoidal window filling most of the 2000 mm zone.
    // hf-w-uf-s-l spans x=0..2000; alongT=0.5 → x=1000 mm; 1500 mm wide leaves 250 mm margins.
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-loggia-trap',
      name: 'Loggia left — trapezoidal slope-following window',
      wallId: 'hf-w-uf-s-l',
      alongT: 0.5,
      widthMm: 1500,
      heightMm: 1600,
      sillHeightMm: 200,
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
    // hf-w-uf-s-r spans x=3000..5000; alongT=0.5 → x=4000 mm (wall centre).
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-loggia',
      name: 'Loggia right — sliding glass curtain wall',
      wallId: 'hf-w-uf-s-r',
      alongT: 0.5,
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

    // Ground-floor light partitions — enough to make the interior programme legible
    // without changing the exterior shell or the stair visibility through the facade.
    {
      type: 'createWall',
      id: 'hf-w-gf-ptn-front',
      name: 'GF partition — front service band',
      levelId: 'hf-lvl-ground',
      start: { xMm: 3700, yMm: 2600 },
      end: { xMm: GF_W, yMm: 2600 },
      thicknessMm: 120,
      heightMm: 2700,
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-ptn-wc',
      name: 'GF partition — guest WC side',
      levelId: 'hf-lvl-ground',
      start: { xMm: 5400, yMm: 200 },
      end: { xMm: 5400, yMm: 2600 },
      thicknessMm: 120,
      heightMm: 2700,
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-ptn-kitchen',
      name: 'GF partition — kitchen datum',
      levelId: 'hf-lvl-ground',
      start: { xMm: 3700, yMm: 4300 },
      end: { xMm: GF_W, yMm: 4300 },
      thicknessMm: 120,
      heightMm: 2700,
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

    // Rooms — labelled programme zones per spec §5.
    {
      type: 'createRoomOutline',
      id: 'hf-room-entry-stair',
      name: 'Entrance / stair hall',
      levelId: 'hf-lvl-ground',
      outlineMm: [
        { xMm: 200, yMm: 200 },
        { xMm: 3700, yMm: 200 },
        { xMm: 3700, yMm: 2600 },
        { xMm: 200, yMm: 2600 },
      ],
      programmeCode: 'circulation',
      functionLabel: 'entrance-stair',
      finishSet: 'hardwearing-entry',
      targetAreaM2: 8,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-gf-wc',
      name: 'Guest WC',
      levelId: 'hf-lvl-ground',
      outlineMm: [
        { xMm: 5400, yMm: 200 },
        { xMm: 7300, yMm: 200 },
        { xMm: 7300, yMm: 2400 },
        { xMm: 5400, yMm: 2400 },
      ],
      programmeCode: 'toilet',
      functionLabel: 'guest-wc',
      finishSet: 'wet-room',
      targetAreaM2: 4,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-living-dining',
      name: 'Living / dining room',
      levelId: 'hf-lvl-ground',
      outlineMm: [
        { xMm: 200, yMm: 2800 },
        { xMm: 3600, yMm: 2800 },
        { xMm: 3600, yMm: 7800 },
        { xMm: 200, yMm: 7800 },
      ],
      programmeCode: 'living',
      functionLabel: 'living-dining',
      finishSet: 'warm-living',
      targetAreaM2: 17,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-kitchen',
      name: 'Kitchen',
      levelId: 'hf-lvl-ground',
      outlineMm: [
        { xMm: 3800, yMm: 4400 },
        { xMm: 7300, yMm: 4400 },
        { xMm: 7300, yMm: 7800 },
        { xMm: 3800, yMm: 7800 },
      ],
      programmeCode: 'kitchen',
      functionLabel: 'kitchen',
      finishSet: 'kitchen-durable',
      targetAreaM2: 12,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bed-1',
      name: 'Bedroom 1 (master)',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: 200, yMm: 200 },
        { xMm: 3000, yMm: 200 },
        { xMm: 3000, yMm: 3900 },
        { xMm: 200, yMm: 3900 },
      ],
      programmeCode: 'bedroom',
      functionLabel: 'master-bedroom',
      finishSet: 'quiet-bedroom',
      targetAreaM2: 10,
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
      functionLabel: 'secondary-bedroom',
      finishSet: 'quiet-bedroom',
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
      functionLabel: 'family-bathroom',
      finishSet: 'wet-room',
      targetAreaM2: 6,
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-landing',
      name: 'Landing / study nook',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: 3200, yMm: 200 },
        { xMm: 4800, yMm: 200 },
        { xMm: 4800, yMm: 3900 },
        { xMm: 3200, yMm: 3900 },
      ],
      programmeCode: 'circulation',
      functionLabel: 'landing-study',
      finishSet: 'hardwearing-entry',
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
      functionLabel: 'roof-terrace',
      finishSet: 'exterior-terrace',
      targetAreaM2: 20,
    },

    // Asset library entries used by the seeded interior.
    {
      type: 'IndexAsset',
      id: 'hf-asset-sofa',
      name: 'Two-seat sofa',
      category: 'furniture',
      tags: ['living', 'seating', 'seed'],
      thumbnailWidthMm: 2200,
      thumbnailHeightMm: 900,
      description: 'Schematic sofa used to make the living room legible in plan.',
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-coffee-table',
      name: 'Coffee table',
      category: 'furniture',
      tags: ['living', 'table', 'seed'],
      thumbnailWidthMm: 1000,
      thumbnailHeightMm: 600,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-dining-table',
      name: 'Dining table',
      category: 'furniture',
      tags: ['dining', 'table', 'seed'],
      thumbnailWidthMm: 1600,
      thumbnailHeightMm: 900,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-dining-chair',
      name: 'Dining chair',
      category: 'furniture',
      tags: ['dining', 'chair', 'seed'],
      thumbnailWidthMm: 450,
      thumbnailHeightMm: 450,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-kitchen-run',
      name: 'Kitchen cabinet run',
      category: 'kitchen',
      tags: ['kitchen', 'casework', 'seed'],
      thumbnailWidthMm: 3000,
      thumbnailHeightMm: 650,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-kitchen-island',
      name: 'Kitchen island',
      category: 'kitchen',
      tags: ['kitchen', 'island', 'seed'],
      thumbnailWidthMm: 1800,
      thumbnailHeightMm: 900,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-fridge',
      name: 'Fridge / pantry unit',
      category: 'kitchen',
      tags: ['kitchen', 'appliance', 'seed'],
      thumbnailWidthMm: 700,
      thumbnailHeightMm: 700,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-toilet',
      name: 'Toilet',
      category: 'bathroom',
      tags: ['bathroom', 'wc', 'seed'],
      thumbnailWidthMm: 700,
      thumbnailHeightMm: 450,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-basin',
      name: 'Wash basin',
      category: 'bathroom',
      tags: ['bathroom', 'basin', 'seed'],
      thumbnailWidthMm: 600,
      thumbnailHeightMm: 450,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-shower',
      name: 'Shower tray',
      category: 'bathroom',
      tags: ['bathroom', 'shower', 'seed'],
      thumbnailWidthMm: 900,
      thumbnailHeightMm: 900,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-queen-bed',
      name: 'Queen bed',
      category: 'furniture',
      tags: ['bedroom', 'bed', 'seed'],
      thumbnailWidthMm: 2000,
      thumbnailHeightMm: 1600,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-single-bed',
      name: 'Single bed',
      category: 'furniture',
      tags: ['bedroom', 'bed', 'seed'],
      thumbnailWidthMm: 2000,
      thumbnailHeightMm: 900,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-wardrobe',
      name: 'Wardrobe',
      category: 'casework',
      tags: ['bedroom', 'storage', 'seed'],
      thumbnailWidthMm: 1800,
      thumbnailHeightMm: 600,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-desk',
      name: 'Small desk',
      category: 'furniture',
      tags: ['bedroom', 'study', 'seed'],
      thumbnailWidthMm: 1200,
      thumbnailHeightMm: 600,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-outdoor-table',
      name: 'Outdoor table',
      category: 'furniture',
      tags: ['terrace', 'outdoor', 'seed'],
      thumbnailWidthMm: 1200,
      thumbnailHeightMm: 800,
    },
    {
      type: 'IndexAsset',
      id: 'hf-asset-lounge-chair',
      name: 'Lounge chair',
      category: 'furniture',
      tags: ['terrace', 'outdoor', 'seating', 'seed'],
      thumbnailWidthMm: 800,
      thumbnailHeightMm: 800,
    },

    // Placed interior assets — schematic plan symbols tied to the indexed library.
    { type: 'PlaceAsset', id: 'hf-pa-sofa', assetId: 'hf-asset-sofa', name: 'Living sofa', levelId: 'hf-lvl-ground', positionMm: { xMm: 1200, yMm: 6500 }, rotationDeg: 90 },
    { type: 'PlaceAsset', id: 'hf-pa-coffee-table', assetId: 'hf-asset-coffee-table', name: 'Living coffee table', levelId: 'hf-lvl-ground', positionMm: { xMm: 2300, yMm: 6500 }, rotationDeg: 90 },
    { type: 'PlaceAsset', id: 'hf-pa-dining-table', assetId: 'hf-asset-dining-table', name: 'Dining table', levelId: 'hf-lvl-ground', positionMm: { xMm: 2300, yMm: 4900 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-dining-chair-1', assetId: 'hf-asset-dining-chair', name: 'Dining chair 1', levelId: 'hf-lvl-ground', positionMm: { xMm: 2300, yMm: 4200 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-dining-chair-2', assetId: 'hf-asset-dining-chair', name: 'Dining chair 2', levelId: 'hf-lvl-ground', positionMm: { xMm: 2300, yMm: 5600 }, rotationDeg: 180 },
    { type: 'PlaceAsset', id: 'hf-pa-kitchen-run', assetId: 'hf-asset-kitchen-run', name: 'North kitchen cabinet run', levelId: 'hf-lvl-ground', positionMm: { xMm: 5550, yMm: 7480 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-kitchen-island', assetId: 'hf-asset-kitchen-island', name: 'Kitchen island', levelId: 'hf-lvl-ground', positionMm: { xMm: 5550, yMm: 5750 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-fridge', assetId: 'hf-asset-fridge', name: 'Fridge / pantry', levelId: 'hf-lvl-ground', positionMm: { xMm: 6900, yMm: 6900 }, rotationDeg: 90 },
    { type: 'PlaceAsset', id: 'hf-pa-gf-toilet', assetId: 'hf-asset-toilet', name: 'Guest WC toilet', levelId: 'hf-lvl-ground', positionMm: { xMm: 6350, yMm: 1700 }, rotationDeg: 180 },
    { type: 'PlaceAsset', id: 'hf-pa-gf-basin', assetId: 'hf-asset-basin', name: 'Guest WC basin', levelId: 'hf-lvl-ground', positionMm: { xMm: 5700, yMm: 800 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-master-bed', assetId: 'hf-asset-queen-bed', name: 'Master bed', levelId: 'hf-lvl-upper', positionMm: { xMm: 1350, yMm: 1900 }, rotationDeg: 90 },
    { type: 'PlaceAsset', id: 'hf-pa-master-wardrobe', assetId: 'hf-asset-wardrobe', name: 'Master wardrobe', levelId: 'hf-lvl-upper', positionMm: { xMm: 2350, yMm: 3350 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-bed2', assetId: 'hf-asset-single-bed', name: 'Bedroom 2 bed', levelId: 'hf-lvl-upper', positionMm: { xMm: 1200, yMm: 5900 }, rotationDeg: 90 },
    { type: 'PlaceAsset', id: 'hf-pa-bed2-desk', assetId: 'hf-asset-desk', name: 'Bedroom 2 desk', levelId: 'hf-lvl-upper', positionMm: { xMm: 1700, yMm: 7300 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-bath-toilet', assetId: 'hf-asset-toilet', name: 'Bathroom toilet', levelId: 'hf-lvl-upper', positionMm: { xMm: 3300, yMm: 5050 }, rotationDeg: 90 },
    { type: 'PlaceAsset', id: 'hf-pa-bath-basin', assetId: 'hf-asset-basin', name: 'Bathroom basin', levelId: 'hf-lvl-upper', positionMm: { xMm: 4400, yMm: 5050 }, rotationDeg: 270 },
    { type: 'PlaceAsset', id: 'hf-pa-bath-shower', assetId: 'hf-asset-shower', name: 'Bathroom shower', levelId: 'hf-lvl-upper', positionMm: { xMm: 3800, yMm: 7100 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-terrace-table', assetId: 'hf-asset-outdoor-table', name: 'Terrace outdoor table', levelId: 'hf-lvl-upper', positionMm: { xMm: 6250, yMm: 4300 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-terrace-chair-1', assetId: 'hf-asset-lounge-chair', name: 'Terrace lounge chair 1', levelId: 'hf-lvl-upper', positionMm: { xMm: 6250, yMm: 3000 }, rotationDeg: 0 },
    { type: 'PlaceAsset', id: 'hf-pa-terrace-chair-2', assetId: 'hf-asset-lounge-chair', name: 'Terrace lounge chair 2', levelId: 'hf-lvl-upper', positionMm: { xMm: 6250, yMm: 5600 }, rotationDeg: 180 },

    // === PHASE 6: DETAIL ===
    // Chimney-like centre protrusion (spec §3 "protruding chimney-like volume clad
    // in vertical siding"). The UF south wall's non-recessed centre section
    // (T=0.3..0.6, x=1500..3000) provides the south face. Two return walls close
    // the left and right edges so the protrusion reads as a solid volume.
    {
      type: 'createWall',
      id: 'hf-w-chimney-w',
      name: 'Chimney west return',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X0, yMm: LOGGIA_SETBACK },
      end: { xMm: CHIMNEY_X0, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: 5500,
      materialKey: 'cladding_warm_wood',
    },
    {
      type: 'createWall',
      id: 'hf-w-chimney-e',
      name: 'Chimney east return',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X1, yMm: 0 },
      end: { xMm: CHIMNEY_X1, yMm: LOGGIA_SETBACK },
      thicknessMm: WALL_T,
      heightMm: 5500,
      materialKey: 'cladding_warm_wood',
    },
    {
      type: 'createWall',
      id: 'hf-w-chimney-back',
      name: 'Chimney back wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: CHIMNEY_X0, yMm: LOGGIA_SETBACK },
      end: { xMm: CHIMNEY_X1, yMm: LOGGIA_SETBACK },
      thicknessMm: WALL_T,
      heightMm: 5500,
      materialKey: 'cladding_warm_wood',
    },
    // Attach chimney return walls and back wall to the gable roof so their tops
    // are trimmed flush with the gable profile (closes the open corner gaps).
    { type: 'attachWallTopToRoof', wallId: 'hf-w-chimney-w', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-chimney-e', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-chimney-back', roofId: 'hf-roof-main' },

    // Loggia balcony slabs + balustrades (spec §3 "three thin, continuous black
    // horizontal cables/rails fixed to the inner edge of the white shell").
    // One per loggia wall segment; the chimney centre section has no balcony.
    {
      type: 'createBalcony',
      id: 'hf-balcony-l',
      name: 'Loggia balcony left',
      wallId: 'hf-w-uf-s-l',
      elevationMm: F2F,
      projectionMm: 700,
      slabThicknessMm: 150,
      balustradeHeightMm: 1100,
    },
    {
      type: 'createBalcony',
      id: 'hf-balcony-r',
      name: 'Loggia balcony right',
      wallId: 'hf-w-uf-s-r',
      elevationMm: F2F,
      projectionMm: 700,
      slabThicknessMm: 150,
      balustradeHeightMm: 1100,
    },
    {
      type: 'createBalcony',
      id: 'hf-balcony-c',
      name: 'Loggia balcony centre (chimney)',
      wallId: 'hf-w-uf-s-c',
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
      name: 'Main isometric (SSW — south facade + west gable, spec §5 front-left)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: -3000, yMm: -9000, zMm: 11000 },
        target: { xMm: 3500, yMm: 4000, zMm: 3500 },
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
      id: 'vp-side-elev-east',
      name: 'Side elevation (ESE — roof cutout side)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 15000, yMm: 2000, zMm: 6200 },
        target: { xMm: 4200, yMm: 4500, zMm: 4300 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-rear-axo',
      name: 'Rear axonometric (NE)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 12000, yMm: 14000, zMm: 8000 },
        target: { xMm: 3500, yMm: 4000, zMm: 4250 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'vp-terrace-se',
      name: 'Roof cutout and east terrace (high SE)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 11500, yMm: 10500, zMm: 13500 },
        target: { xMm: 3900, yMm: 6000, zMm: 4800 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },

    // Plan views.
    {
      type: 'upsertPlanView',
      id: 'hf-pv-ground',
      name: 'GF plan',
      levelId: 'hf-lvl-ground',
      planShowRoomLabels: true,
      planRoomFillOpacityScale: 0.45,
    },
    {
      type: 'upsertPlanView',
      id: 'hf-pv-upper',
      name: 'First-floor plan',
      levelId: 'hf-lvl-upper',
      planShowRoomLabels: true,
      planRoomFillOpacityScale: 0.45,
    },

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
    {
      type: 'upsertSheetViewports',
      sheetId: 'hf-sheet-ga01',
      viewportsMm: [
        {
          viewportId: 'hf-vp-ga01-ground',
          label: 'GF plan',
          viewRef: 'plan:hf-pv-ground',
          detailNumber: '1',
          scale: '1:100',
          xMm: 3_200,
          yMm: 5_800,
          widthMm: 24_800,
          heightMm: 19_400,
        },
        {
          viewportId: 'hf-vp-ga01-upper',
          label: 'First-floor plan',
          viewRef: 'plan:hf-pv-upper',
          detailNumber: '2',
          scale: '1:100',
          xMm: 30_000,
          yMm: 5_800,
          widthMm: 23_600,
          heightMm: 19_400,
        },
        {
          viewportId: 'hf-vp-ga01-section',
          label: 'South facade section',
          viewRef: 'section:hf-sec-loggia',
          detailNumber: '3',
          scale: '1:100',
          xMm: 3_200,
          yMm: 27_200,
          widthMm: 25_400,
          heightMm: 10_500,
        },
        {
          viewportId: 'hf-vp-ga01-room-schedule',
          label: 'Room schedule',
          viewRef: 'schedule:hf-sch-rooms',
          detailNumber: '4',
          xMm: 30_200,
          yMm: 27_200,
          widthMm: 23_400,
          heightMm: 3_000,
        },
        {
          viewportId: 'hf-vp-ga01-door-schedule',
          label: 'Door schedule',
          viewRef: 'schedule:hf-sch-doors',
          detailNumber: '5',
          xMm: 30_200,
          yMm: 31_000,
          widthMm: 23_400,
          heightMm: 3_000,
        },
        {
          viewportId: 'hf-vp-ga01-window-schedule',
          label: 'Window schedule',
          viewRef: 'schedule:hf-sch-windows',
          detailNumber: '6',
          xMm: 30_200,
          yMm: 34_800,
          widthMm: 23_400,
          heightMm: 3_000,
        },
      ],
    },
  ];
}
