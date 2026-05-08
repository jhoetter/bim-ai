/** @typedef {Record<string, unknown>} BimCommand */

/*
 * Canonical seed: the demo "one-family home" project.
 *
 * Authored phase-by-phase per `claude-skills/sketch-to-bim/SKILL.md`.
 * The structured brief lives at `nightshift/seed-target-house/brief.md`;
 * dimensional assumptions at `nightshift/seed-target-house/assumptions.md`.
 *
 * Coordinate convention (plan):
 *   +xMm = east, +yMm = north (south facade is at y=0)
 */

// ── Dimensional constants (from brief.md) ────────────────────────────
const GF_W = 7000; // ground-floor E-W width
const D = 8000; // depth, N-S, common to all volumes
const UF_W = 5000; // upper-floor E-W width (west-aligned)
const F2F = 3000; // ground → first floor height
const UPPER_WALL_H = 4500; // top of EAST eave (high side); placeholder roof sits here in Phase 2
const PARAPET_H = 200; // east deck low parapet
const WALL_T = 250; // standard exterior wall thickness

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
    // Three volumetric blocks defining the asymmetric two-stack composition.
    // Material keys are pre-applied so the colour silhouette also reads at
    // the Phase 1 checkpoint.
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
      heightMm: UPPER_WALL_H,
      materialKey: 'render_white',
    },
    {
      type: 'createMass',
      id: 'hf-mass-parapet',
      name: 'East deck parapet block',
      levelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: UF_W, yMm: 0 },
        { xMm: GF_W, yMm: 0 },
        { xMm: GF_W, yMm: D },
        { xMm: UF_W, yMm: D },
      ],
      heightMm: PARAPET_H,
      materialKey: 'cladding_beige_grey',
    },

    // === PHASE 2: SKELETON ===
    // Replace the Phase 1 mass placeholders with the load-bearing structural
    // primitives: perimeter walls, floor slabs, and a flat-roof placeholder
    // (Phase 3 promotes it to asymmetric_gable + applies materials).
    //
    // We delete the masses rather than calling materializeMassToWalls because
    // the GF mass would emit a roof at z=3000 that overlaps the upper-floor
    // and east-deck floors at the same elevation — three coplanar slabs
    // z-fight in the renderer. Manual authoring keeps the skeleton clean.
    { type: 'deleteElement', elementId: 'hf-mass-gf' },
    { type: 'deleteElement', elementId: 'hf-mass-uf' },
    { type: 'deleteElement', elementId: 'hf-mass-parapet' },

    // Ground-floor perimeter walls (height = F2F, ccw from SW)
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

    // Upper-floor perimeter walls (5000×8000, west-aligned). heightMm =
    // UPPER_WALL_H (top of east eave) — the asymmetric gable roof in
    // Phase 3 will crop the west wall down via attachWallTopToRoof.
    {
      type: 'createWall',
      id: 'hf-w-uf-s',
      name: 'UF south wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: UF_W, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: UPPER_WALL_H,
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-e',
      name: 'UF east wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_W, yMm: 0 },
      end: { xMm: UF_W, yMm: D },
      thicknessMm: WALL_T,
      heightMm: UPPER_WALL_H,
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-n',
      name: 'UF north wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_W, yMm: D },
      end: { xMm: 0, yMm: D },
      thicknessMm: WALL_T,
      heightMm: UPPER_WALL_H,
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-w',
      name: 'UF west wall',
      levelId: 'hf-lvl-upper',
      start: { xMm: 0, yMm: D },
      end: { xMm: 0, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: UPPER_WALL_H,
    },

    // East deck parapet walls (south / east / north — west edge butts up
    // against UF east wall, no parapet needed there).
    {
      type: 'createWall',
      id: 'hf-w-pa-s',
      name: 'Deck parapet south',
      levelId: 'hf-lvl-upper',
      start: { xMm: UF_W, yMm: 0 },
      end: { xMm: GF_W, yMm: 0 },
      thicknessMm: WALL_T,
      heightMm: PARAPET_H,
    },
    {
      type: 'createWall',
      id: 'hf-w-pa-e',
      name: 'Deck parapet east',
      levelId: 'hf-lvl-upper',
      start: { xMm: GF_W, yMm: 0 },
      end: { xMm: GF_W, yMm: D },
      thicknessMm: WALL_T,
      heightMm: PARAPET_H,
    },
    {
      type: 'createWall',
      id: 'hf-w-pa-n',
      name: 'Deck parapet north',
      levelId: 'hf-lvl-upper',
      start: { xMm: GF_W, yMm: D },
      end: { xMm: UF_W, yMm: D },
      thicknessMm: WALL_T,
      heightMm: PARAPET_H,
    },

    // Floor slabs.
    {
      type: 'createFloor',
      id: 'hf-flr-ground',
      name: 'Ground floor slab',
      levelId: 'hf-lvl-ground',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: GF_W, yMm: 0 },
        { xMm: GF_W, yMm: D },
        { xMm: 0, yMm: D },
      ],
    },
    {
      type: 'createFloor',
      id: 'hf-flr-upper',
      name: 'Upper floor slab (west)',
      levelId: 'hf-lvl-upper',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: UF_W, yMm: 0 },
        { xMm: UF_W, yMm: D },
        { xMm: 0, yMm: D },
      ],
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
    },

    // Placeholder flat upper roof. Phase 3 mutates this in place to
    // `asymmetric_gable` with the dramatic ridge offset + eave heights.
    {
      type: 'createRoof',
      id: 'hf-roof-main',
      name: 'Upper-volume roof',
      referenceLevelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: UF_W, yMm: 0 },
        { xMm: UF_W, yMm: D },
        { xMm: 0, yMm: D },
      ],
      roofGeometryMode: 'flat',
      slopeDeg: 0,
      eaveHeightLeftMm: UPPER_WALL_H,
      eaveHeightRightMm: UPPER_WALL_H,
      overhangMm: 0,
    },
  ];
}
