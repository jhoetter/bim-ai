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
      materialKey: 'white_render',
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

    // === PHASE 3: ENVELOPE ===
    // Promote the placeholder flat upper-volume roof to the dramatic
    // asymmetric_gable per brief: ridge 1800mm east of UF center, west
    // eave 1200mm above UF level, east eave 4500mm above UF level,
    // slope 45° (ridge lands 5500mm above UF = z=8500 absolute, well
    // above the east eave at z=7500 — avoids the seed-fidelity flat-
    // roof failure where ridge sat below the east eave).
    //
    // The engine's updateElementProperty for roofs only supports a
    // narrow key subset (roofTypeId | roofGeometryMode | name) and
    // roofGeometryMode is restricted to mass_box | gable_pitched_rectangle,
    // so we delete + recreate rather than mutate in place.
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
      ridgeOffsetTransverseMm: 1800,
      eaveHeightLeftMm: 1200,
      eaveHeightRightMm: 4500,
      slopeDeg: 45,
      overhangMm: 0,
      materialKey: 'metal_standing_seam_dark_grey',
    },

    // Bump UF wall heights so the south + north gable-end walls cover
    // the ridge peak (5500 mm above UF level). With heightMm=4500 the
    // walls would have a 1000mm gap at the peak; 6000 leaves margin.
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-uf-s',
      key: 'heightMm',
      value: 6000,
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-uf-n',
      key: 'heightMm',
      value: 6000,
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-uf-e',
      key: 'heightMm',
      value: 6000,
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-uf-w',
      key: 'heightMm',
      value: 6000,
    },

    // Attach all 4 UF walls to the asymmetric gable so their tops
    // crop along the slope (KRN-11 attachWallTopToRoof).
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-s', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-e', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-n', roofId: 'hf-roof-main' },
    { type: 'attachWallTopToRoof', wallId: 'hf-w-uf-w', roofId: 'hf-roof-main' },

    // Apply primary materials. The UF south wall takes `cladding_warm_wood`
    // because Phase 4 adds a recess zone whose back wall renders with the
    // wall's primary materialKey; the surrounding non-recessed end caps
    // auto-render as white_render via the makeRecessedWallMesh capMat
    // override (architectural pattern: white frame around a wood-clad
    // recess).
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-gf-s',
      key: 'materialKey',
      value: 'cladding_beige_grey',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-gf-e',
      key: 'materialKey',
      value: 'cladding_beige_grey',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-gf-n',
      key: 'materialKey',
      value: 'cladding_beige_grey',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-gf-w',
      key: 'materialKey',
      value: 'cladding_beige_grey',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-uf-s',
      key: 'materialKey',
      value: 'cladding_warm_wood',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-uf-e',
      key: 'materialKey',
      value: 'white_render',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-uf-n',
      key: 'materialKey',
      value: 'white_render',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-uf-w',
      key: 'materialKey',
      value: 'white_render',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-pa-s',
      key: 'materialKey',
      value: 'cladding_beige_grey',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-pa-e',
      key: 'materialKey',
      value: 'cladding_beige_grey',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-w-pa-n',
      key: 'materialKey',
      value: 'cladding_beige_grey',
    },

    // Picture-frame outline (KRN-15 sweep) along the south-face gable
    // pentagon. Path is 5 vertices + closure (CW from south view):
    //   SW → SE → E-eave → ridge → W-eave → SW.
    // Profile is 100×200 mm centered (uMm: ±50, vMm: ±100): u-axis is
    // proud direction (cross of tangent + world-up at start), v-axis
    // is perpendicular within the facade plane.
    {
      type: 'createSweep',
      id: 'hf-sw-frame',
      name: 'Picture-frame outline',
      levelId: 'hf-lvl-ground',
      pathMm: [
        { xMm: 0, yMm: 0, zMm: 3000 },
        { xMm: 5000, yMm: 0, zMm: 3000 },
        { xMm: 5000, yMm: 0, zMm: 7500 },
        { xMm: 4300, yMm: 0, zMm: 8500 },
        { xMm: 0, yMm: 0, zMm: 4200 },
        { xMm: 0, yMm: 0, zMm: 3000 },
      ],
      profileMm: [
        { uMm: -50, vMm: -100 },
        { uMm: 50, vMm: -100 },
        { uMm: 50, vMm: 100 },
        { uMm: -50, vMm: 100 },
      ],
      profilePlane: 'work_plane',
      materialKey: 'white_render',
    },

    // === PHASE 4: OPENINGS ===
    // Ground-floor south facade: 2 portrait windows on the western
    // (cladding_beige_grey) half + 1 front door right-of-center + 1
    // small vertical window on the east extension.
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-s-1',
      name: 'GF south window (left)',
      wallId: 'hf-w-gf-s',
      alongT: 0.1,
      widthMm: 700,
      heightMm: 1800,
      sillHeightMm: 200,
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-s-2',
      name: 'GF south window (centre-left)',
      wallId: 'hf-w-gf-s',
      alongT: 0.22,
      widthMm: 700,
      heightMm: 1800,
      sillHeightMm: 200,
    },
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-front',
      name: 'Front door',
      wallId: 'hf-w-gf-s',
      alongT: 0.55,
      widthMm: 900,
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-s-3',
      name: 'GF south window (east extension)',
      wallId: 'hf-w-gf-s',
      alongT: 0.85,
      widthMm: 600,
      heightMm: 1200,
      sillHeightMm: 1000,
    },

    // Loggia recess on the upper-floor south wall (KRN-16). The wall's
    // primary materialKey (cladding_warm_wood — set in Phase 3) renders
    // on the recess back surface; non-recessed end caps auto-render as
    // white via makeRecessedWallMesh's capMat override.
    {
      type: 'setWallRecessZones',
      wallId: 'hf-w-uf-s',
      recessZones: [
        {
          alongTStart: 0.1,
          alongTEnd: 0.9,
          setbackMm: 1500,
          floorContinues: true,
        },
      ],
    },

    // Loggia openings — hosted on the south wall in the recess range.
    // The renderer (recessOffsetForOpening) places them against the
    // recessed (cladding_warm_wood) back surface.
    //
    // Right side: large floor-to-ceiling sliding door (spec §1.4
    // "large rectangular window/sliding door on the right").
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-loggia',
      name: 'Loggia sliding door',
      wallId: 'hf-w-uf-s',
      alongT: 0.7,
      widthMm: 1800,
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-door-loggia',
      key: 'operationType',
      value: 'sliding_double',
    },

    // Left side: trapezoidal window whose top edge follows the long,
    // low west pitch of the asymmetric_gable (spec §1.4 "smaller
    // trapezoidal window on the left whose top edge slopes to follow
    // the long, low angle of the roof pitch"). KRN-12 outlineKind +
    // attachedRoofId pair lets the renderer compute the slope-following
    // top edge from the host roof's geometry.
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-loggia-trap',
      name: 'Loggia trapezoidal window',
      wallId: 'hf-w-uf-s',
      alongT: 0.2,
      widthMm: 1500,
      heightMm: 1800,
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

    // === PHASE 5: INTERIOR ===
    // Open-plan ground floor (1 living/kitchen room). Upper floor is
    // partitioned into 3 rooms (2 bedrooms + bath) plus the loggia
    // (recess) and east deck (terrace).
    //
    // Partitions on UF — 1 mid-depth E-W partition + 1 N-S partition
    // in the north half divide the upper into the 3 rooms above.
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
      name: 'UF back partition (N-S, north half)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 2500, yMm: 4000 },
      end: { xMm: 2500, yMm: D },
      thicknessMm: 120,
      heightMm: 2700,
    },

    // Stair: straight, ground → upper. Run 3500 mm (y=3000..6500) wide
    // 1000 mm at x=4000. Riser 175 mm × 17 = 2975 mm rise (close to
    // the 3000 mm F2F).
    {
      type: 'createStair',
      id: 'hf-stair-main',
      name: 'Main stair',
      baseLevelId: 'hf-lvl-ground',
      topLevelId: 'hf-lvl-upper',
      runStartMm: { xMm: 4000, yMm: 3000 },
      runEndMm: { xMm: 4000, yMm: 6500 },
      widthMm: 1000,
      riserMm: 175,
      treadMm: 220,
    },

    // Slab opening on the upper-floor floor for the stair shaft.
    {
      type: 'createSlabOpening',
      id: 'hf-slab-stair',
      name: 'Stair shaft opening',
      hostFloorId: 'hf-flr-upper',
      boundaryMm: [
        { xMm: 3500, yMm: 3000 },
        { xMm: 4500, yMm: 3000 },
        { xMm: 4500, yMm: 6500 },
        { xMm: 3500, yMm: 6500 },
      ],
      isShaft: true,
    },

    // Stair railing along the open (west) side of the stair.
    {
      type: 'createRailing',
      id: 'hf-rail-stair',
      name: 'Stair railing',
      hostedStairId: 'hf-stair-main',
      pathMm: [
        { xMm: 3500, yMm: 3000 },
        { xMm: 3500, yMm: 6500 },
      ],
    },

    // Rooms.
    {
      type: 'createRoomOutline',
      id: 'hf-room-living',
      name: 'Open-plan kitchen + living',
      levelId: 'hf-lvl-ground',
      outlineMm: [
        { xMm: 200, yMm: 200 },
        { xMm: 6800, yMm: 200 },
        { xMm: 6800, yMm: 7800 },
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
      targetAreaM2: 16,
    },
  ];
}
