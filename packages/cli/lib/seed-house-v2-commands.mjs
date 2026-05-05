/** @typedef {Record<string, unknown>} BimCommand */

/**
 * Seed house V2 — fixture spec spec/ui-ux-redesign-v1-spec.md §27.
 *
 * Reference image silhouette: a 2-storey gable house with a cantilevered
 * upper-floor balcony to the south and a ground-level terrace pad. The
 * fixture exercises every primary element class so demos, replay
 * determinism, and visual-regression baselines can be anchored on a
 * single document.
 *
 * All element ids use the `seed-` prefix per §27.3 to make reset trivial:
 *   Document.removeWhereIdStartsWith("seed-")
 *
 * Coordinate frame: planar mm, +X east, +Y north (canvas convention).
 *
 * L-shape ground footprint (CCW outer ring):
 *   (5000, 4000) → (17000, 4000)            // south of main
 *   (17000, 4000) → (17000, 8000)           // east of main below wing
 *   (17000, 8000) → (21000, 8000)           // south of utility wing
 *   (21000, 8000) → (21000, 12000)          // east of utility wing
 *   (21000, 12000) → (5000, 12000)          // north top
 *   (5000, 12000) → (5000, 4000)            // west
 *
 * Upper rectangle (set back 1 m on the south to form the cantilevered
 * balcony floor):
 *   (5000, 5000) — (17000, 12000)           // 12 m × 7 m
 *
 * Terrace pad (12 m × 9 m, -50 mm):
 *   (5000, -5000) — (17000, 4000)
 *
 * @returns {BimCommand[]}
 */
export function buildSeedHouseV2Commands() {
  const cmds = [];

  // ── 1. Levels (3) ───────────────────────────────────────────────────────
  cmds.push(
    { type: 'createLevel', id: 'seed-lvl-ground', name: 'Ground', elevationMm: 0 },
    { type: 'createLevel', id: 'seed-lvl-upper', name: 'Upper', elevationMm: 3000 },
    { type: 'createLevel', id: 'seed-lvl-roof-apex', name: 'Roof Apex', elevationMm: 5800 },
  );

  // ── 2. Site + terrace (1 site, terrace pad as a -50 mm slab) ────────────
  cmds.push({
    type: 'upsertSite',
    id: 'seed-site',
    name: 'Site pad',
    referenceLevelId: 'seed-lvl-ground',
    boundaryMm: [
      { xMm: -10000, yMm: -8000 },
      { xMm: 25000, yMm: -8000 },
      { xMm: 25000, yMm: 18000 },
      { xMm: -10000, yMm: 18000 },
    ],
    padThicknessMm: 80,
    baseOffsetMm: -50,
    northDegCwFromPlanX: 0,
    uniformSetbackMm: 3000,
  });

  // ── 3. Walls — exterior ground (6, L-shape) ─────────────────────────────
  const EXTERIOR_THICKNESS_MM = 200;
  const WALL_HEIGHT_MM = 2800;
  cmds.push(
    {
      type: 'createWall',
      id: 'seed-w-eg-south-main',
      name: 'EG South facade (main)',
      levelId: 'seed-lvl-ground',
      start: { xMm: 5000, yMm: 4000 },
      end: { xMm: 17000, yMm: 4000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-eg-east-main',
      name: 'EG East facade (main)',
      levelId: 'seed-lvl-ground',
      start: { xMm: 17000, yMm: 4000 },
      end: { xMm: 17000, yMm: 8000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-eg-south-wing',
      name: 'EG South facade (utility wing)',
      levelId: 'seed-lvl-ground',
      start: { xMm: 17000, yMm: 8000 },
      end: { xMm: 21000, yMm: 8000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-eg-east-wing',
      name: 'EG East facade (utility wing)',
      levelId: 'seed-lvl-ground',
      start: { xMm: 21000, yMm: 8000 },
      end: { xMm: 21000, yMm: 12000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-eg-north',
      name: 'EG North facade',
      levelId: 'seed-lvl-ground',
      start: { xMm: 21000, yMm: 12000 },
      end: { xMm: 5000, yMm: 12000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-eg-west',
      name: 'EG West facade',
      levelId: 'seed-lvl-ground',
      start: { xMm: 5000, yMm: 12000 },
      end: { xMm: 5000, yMm: 4000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
  );

  // ── 4. Walls — interior ground (4 partitions) ───────────────────────────
  const INTERIOR_THICKNESS_MM = 100;
  cmds.push(
    {
      type: 'createWall',
      id: 'seed-w-eg-spine',
      name: 'EG spine (entrance/living split)',
      levelId: 'seed-lvl-ground',
      start: { xMm: 11000, yMm: 4180 },
      end: { xMm: 11000, yMm: 12000 },
      thicknessMm: INTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-eg-cross',
      name: 'EG kitchen/utility cross',
      levelId: 'seed-lvl-ground',
      start: { xMm: 11000, yMm: 8000 },
      end: { xMm: 17000, yMm: 8000 },
      thicknessMm: INTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-eg-wc',
      name: 'EG WC partition',
      levelId: 'seed-lvl-ground',
      start: { xMm: 5180, yMm: 6000 },
      end: { xMm: 8000, yMm: 6000 },
      thicknessMm: INTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-eg-utility',
      name: 'EG utility partition',
      levelId: 'seed-lvl-ground',
      start: { xMm: 17000, yMm: 10000 },
      end: { xMm: 21000, yMm: 10000 },
      thicknessMm: INTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
  );

  // ── 5. Walls — exterior upper (4, set back 1 m on south for balcony) ────
  cmds.push(
    {
      type: 'createWall',
      id: 'seed-w-og-south',
      name: 'OG South facade (set back 1 m)',
      levelId: 'seed-lvl-upper',
      start: { xMm: 5000, yMm: 5000 },
      end: { xMm: 17000, yMm: 5000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-og-east',
      name: 'OG East facade',
      levelId: 'seed-lvl-upper',
      start: { xMm: 17000, yMm: 5000 },
      end: { xMm: 17000, yMm: 12000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-og-north',
      name: 'OG North facade',
      levelId: 'seed-lvl-upper',
      start: { xMm: 17000, yMm: 12000 },
      end: { xMm: 5000, yMm: 12000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-og-west',
      name: 'OG West facade',
      levelId: 'seed-lvl-upper',
      start: { xMm: 5000, yMm: 12000 },
      end: { xMm: 5000, yMm: 5000 },
      thicknessMm: EXTERIOR_THICKNESS_MM,
      heightMm: WALL_HEIGHT_MM,
    },
  );

  // ── 6. Walls — gable (2, north & south at 35° pitch, cladded) ──────────
  // Modelled as cladded walls riding above the upper-level eave height; the
  // pitched roof element drives the visible 35° geometry. The wall element
  // anchors the cladding hatch (vertical-board) called out in §27.1.
  const GABLE_HEIGHT_MM = 2000;
  cmds.push(
    {
      type: 'createWall',
      id: 'seed-w-gable-south',
      name: 'OG South gable (cladded, 35°)',
      levelId: 'seed-lvl-upper',
      start: { xMm: 5000, yMm: 5000 },
      end: { xMm: 17000, yMm: 5000 },
      thicknessMm: 150,
      heightMm: GABLE_HEIGHT_MM,
    },
    {
      type: 'createWall',
      id: 'seed-w-gable-north',
      name: 'OG North gable (cladded, 35°)',
      levelId: 'seed-lvl-upper',
      start: { xMm: 17000, yMm: 12000 },
      end: { xMm: 5000, yMm: 12000 },
      thicknessMm: 150,
      heightMm: GABLE_HEIGHT_MM,
    },
  );

  // ── 7. Floors / slabs (3) ───────────────────────────────────────────────
  // Ground slab — full L-shape footprint.
  cmds.push({
    type: 'createFloor',
    id: 'seed-floor-eg',
    name: 'EG slab (L-shape)',
    levelId: 'seed-lvl-ground',
    boundaryMm: [
      { xMm: 5000, yMm: 4000 },
      { xMm: 17000, yMm: 4000 },
      { xMm: 17000, yMm: 8000 },
      { xMm: 21000, yMm: 8000 },
      { xMm: 21000, yMm: 12000 },
      { xMm: 5000, yMm: 12000 },
    ],
    thicknessMm: 220,
    structureThicknessMm: 140,
    finishThicknessMm: 30,
    roomBounded: true,
  });

  // Upper slab — main rect including the 1 m south cantilever (balcony floor).
  cmds.push({
    type: 'createFloor',
    id: 'seed-floor-og',
    name: 'OG slab (with south cantilever)',
    levelId: 'seed-lvl-upper',
    boundaryMm: [
      { xMm: 5000, yMm: 4000 },
      { xMm: 17000, yMm: 4000 },
      { xMm: 17000, yMm: 12000 },
      { xMm: 5000, yMm: 12000 },
    ],
    thicknessMm: 240,
    structureThicknessMm: 160,
    finishThicknessMm: 30,
    roomBounded: true,
  });

  // Terrace slab — 12 m × 9 m at -50 mm, south of main.
  cmds.push({
    type: 'createFloor',
    id: 'seed-floor-terrace',
    name: 'Terrace slab (-50 mm)',
    levelId: 'seed-lvl-ground',
    boundaryMm: [
      { xMm: 5000, yMm: -5000 },
      { xMm: 17000, yMm: -5000 },
      { xMm: 17000, yMm: 4000 },
      { xMm: 5000, yMm: 4000 },
    ],
    thicknessMm: 120,
    structureThicknessMm: 100,
    finishThicknessMm: 20,
    roomBounded: false,
  });

  // ── 8. Roof (1, pitched gable over main + flat over wing) ───────────────
  // Single roof element covering both volumes; pitched gable mass for the
  // main rectangle dominates visually, secondary flat plane is implied by
  // the included utility-wing footprint.
  cmds.push({
    type: 'createRoof',
    id: 'seed-roof',
    name: 'Pitched gable + flat over wing',
    referenceLevelId: 'seed-lvl-upper',
    footprintMm: [
      { xMm: 5000, yMm: 5000 },
      { xMm: 17000, yMm: 5000 },
      { xMm: 17000, yMm: 8000 },
      { xMm: 21000, yMm: 8000 },
      { xMm: 21000, yMm: 12000 },
      { xMm: 5000, yMm: 12000 },
    ],
    overhangMm: 600,
    slopeDeg: 35,
    roofGeometryMode: 'mass_box',
  });

  // ── 9. Stair (1, 17 risers × 176 mm, ground → upper) ────────────────────
  cmds.push({
    type: 'createStair',
    id: 'seed-stair-main',
    name: 'Main run (straight, 17 × 176 mm)',
    baseLevelId: 'seed-lvl-ground',
    topLevelId: 'seed-lvl-upper',
    runStartMm: { xMm: 11400, yMm: 8400 },
    runEndMm: { xMm: 16000, yMm: 8400 },
    widthMm: 1100,
    riserMm: 176,
    treadMm: 280,
  });

  // Slab opening for the stair shaft.
  cmds.push({
    type: 'createSlabOpening',
    id: 'seed-shaft-stair',
    name: 'Stair shaft (OG)',
    hostFloorId: 'seed-floor-og',
    boundaryMm: [
      { xMm: 11400, yMm: 7800 },
      { xMm: 16000, yMm: 7800 },
      { xMm: 16000, yMm: 9000 },
      { xMm: 11400, yMm: 9000 },
    ],
    isShaft: true,
  });

  // ── 10. Doors (5) — alongT is 0..1 fraction along wall ──────────────────
  cmds.push(
    {
      type: 'insertDoorOnWall',
      id: 'seed-d-entry-utility',
      name: 'Utility entry door',
      wallId: 'seed-w-eg-east-wing',
      alongT: 0.25,
      widthMm: 900,
    },
    {
      type: 'insertDoorOnWall',
      id: 'seed-d-terrace',
      name: 'Terrace double door',
      wallId: 'seed-w-eg-south-main',
      alongT: 0.5,
      widthMm: 1800,
    },
    {
      type: 'insertDoorOnWall',
      id: 'seed-d-wc',
      name: 'WC door',
      wallId: 'seed-w-eg-wc',
      alongT: 0.5,
      widthMm: 800,
    },
    {
      type: 'insertDoorOnWall',
      id: 'seed-d-spine',
      name: 'Living/entrance hall door',
      wallId: 'seed-w-eg-spine',
      alongT: 0.3,
      widthMm: 900,
    },
    {
      type: 'insertDoorOnWall',
      id: 'seed-d-utility',
      name: 'Utility room door',
      wallId: 'seed-w-eg-utility',
      alongT: 0.5,
      widthMm: 900,
    },
  );

  // ── 11. Windows (7) — alongT is 0..1 fraction along wall ────────────────
  cmds.push(
    {
      type: 'insertWindowOnWall',
      id: 'seed-win-living-fth',
      name: 'Living-room floor-to-ceiling window',
      wallId: 'seed-w-eg-south-main',
      alongT: 0.2,
      widthMm: 4000,
      heightMm: 2500,
      sillHeightMm: 100,
    },
    {
      type: 'insertWindowOnWall',
      id: 'seed-win-bath',
      name: 'EG bath window (small)',
      wallId: 'seed-w-eg-west',
      alongT: 0.15,
      widthMm: 600,
      heightMm: 600,
      sillHeightMm: 1500,
    },
    {
      type: 'insertWindowOnWall',
      id: 'seed-win-utility',
      name: 'EG utility window (small)',
      wallId: 'seed-w-eg-east-wing',
      alongT: 0.7,
      widthMm: 600,
      heightMm: 600,
      sillHeightMm: 1500,
    },
    {
      type: 'insertWindowOnWall',
      id: 'seed-win-bed-a-s',
      name: 'OG bedroom A south window',
      wallId: 'seed-w-og-south',
      alongT: 0.125,
      widthMm: 1200,
      heightMm: 1400,
      sillHeightMm: 900,
    },
    {
      type: 'insertWindowOnWall',
      id: 'seed-win-bed-b-s',
      name: 'OG bedroom B south window',
      wallId: 'seed-w-og-south',
      alongT: 0.7,
      widthMm: 1200,
      heightMm: 1400,
      sillHeightMm: 900,
    },
    {
      type: 'insertWindowOnWall',
      id: 'seed-win-bed-a-w',
      name: 'OG bedroom A west window',
      wallId: 'seed-w-og-west',
      alongT: 0.3,
      widthMm: 1200,
      heightMm: 1400,
      sillHeightMm: 900,
    },
    {
      type: 'insertWindowOnWall',
      id: 'seed-win-hall-n',
      name: 'OG hall north window',
      wallId: 'seed-w-og-north',
      alongT: 0.45,
      widthMm: 1200,
      heightMm: 1400,
      sillHeightMm: 900,
    },
  );

  // ── 12. Railings (3) ────────────────────────────────────────────────────
  cmds.push(
    {
      type: 'createRailing',
      id: 'seed-rail-stair',
      name: 'Stair railing',
      hostedStairId: 'seed-stair-main',
      pathMm: [
        { xMm: 11400, yMm: 8400 },
        { xMm: 16000, yMm: 8400 },
      ],
    },
    {
      type: 'createRailing',
      id: 'seed-rail-balcony',
      name: 'Balcony railing (horizontal-bar 5×30 mm)',
      pathMm: [
        { xMm: 5000, yMm: 4000 },
        { xMm: 17000, yMm: 4000 },
      ],
    },
    {
      type: 'createRailing',
      id: 'seed-rail-terrace',
      name: 'Terrace edge railing',
      pathMm: [
        { xMm: 5000, yMm: -5000 },
        { xMm: 17000, yMm: -5000 },
      ],
    },
  );

  // ── 13. Rooms (9 — 5 ground + 4 upper) ──────────────────────────────────
  cmds.push(
    {
      type: 'createRoomOutline',
      id: 'seed-room-entrance',
      name: 'Entrance hall',
      levelId: 'seed-lvl-ground',
      programmeCode: 'CIRC',
      outlineMm: [
        { xMm: 5180, yMm: 6180 },
        { xMm: 10900, yMm: 6180 },
        { xMm: 10900, yMm: 8000 },
        { xMm: 5180, yMm: 8000 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'seed-room-living',
      name: 'Living',
      levelId: 'seed-lvl-ground',
      programmeCode: 'LIV',
      outlineMm: [
        { xMm: 11100, yMm: 4180 },
        { xMm: 16900, yMm: 4180 },
        { xMm: 16900, yMm: 8000 },
        { xMm: 11100, yMm: 8000 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'seed-room-kitchen',
      name: 'Kitchen',
      levelId: 'seed-lvl-ground',
      programmeCode: 'KIT',
      outlineMm: [
        { xMm: 11100, yMm: 8180 },
        { xMm: 16900, yMm: 8180 },
        { xMm: 16900, yMm: 11900 },
        { xMm: 11100, yMm: 11900 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'seed-room-wc',
      name: 'WC',
      levelId: 'seed-lvl-ground',
      programmeCode: 'WC',
      outlineMm: [
        { xMm: 5180, yMm: 4180 },
        { xMm: 7820, yMm: 4180 },
        { xMm: 7820, yMm: 5900 },
        { xMm: 5180, yMm: 5900 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'seed-room-utility',
      name: 'Utility',
      levelId: 'seed-lvl-ground',
      programmeCode: 'UTIL',
      outlineMm: [
        { xMm: 17180, yMm: 8180 },
        { xMm: 20900, yMm: 8180 },
        { xMm: 20900, yMm: 9900 },
        { xMm: 17180, yMm: 9900 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'seed-room-bed-a',
      name: 'Bedroom A',
      levelId: 'seed-lvl-upper',
      programmeCode: 'BED',
      outlineMm: [
        { xMm: 5180, yMm: 5180 },
        { xMm: 10900, yMm: 5180 },
        { xMm: 10900, yMm: 8000 },
        { xMm: 5180, yMm: 8000 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'seed-room-bed-b',
      name: 'Bedroom B',
      levelId: 'seed-lvl-upper',
      programmeCode: 'BED',
      outlineMm: [
        { xMm: 11100, yMm: 5180 },
        { xMm: 16820, yMm: 5180 },
        { xMm: 16820, yMm: 8000 },
        { xMm: 11100, yMm: 8000 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'seed-room-bath-og',
      name: 'Bath',
      levelId: 'seed-lvl-upper',
      programmeCode: 'BATH',
      outlineMm: [
        { xMm: 5180, yMm: 9100 },
        { xMm: 10900, yMm: 9100 },
        { xMm: 10900, yMm: 11900 },
        { xMm: 5180, yMm: 11900 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'seed-room-hall-og',
      name: 'Upper hall',
      levelId: 'seed-lvl-upper',
      programmeCode: 'CIRC',
      outlineMm: [
        { xMm: 11100, yMm: 9100 },
        { xMm: 16820, yMm: 9100 },
        { xMm: 16820, yMm: 11900 },
        { xMm: 11100, yMm: 11900 },
      ],
    },
  );

  // ── 14. Section cuts (2) ────────────────────────────────────────────────
  cmds.push(
    {
      type: 'createSectionCut',
      id: 'seed-sec-aa',
      name: 'A–A (E–W through living room)',
      lineStartMm: { xMm: 4000, yMm: 6000 },
      lineEndMm: { xMm: 22000, yMm: 6000 },
      cropDepthMm: 9000,
    },
    {
      type: 'createSectionCut',
      id: 'seed-sec-bb',
      name: 'B–B (N–S through stair)',
      lineStartMm: { xMm: 13700, yMm: 3500 },
      lineEndMm: { xMm: 13700, yMm: 12500 },
      cropDepthMm: 9000,
    },
  );

  // ── 15. Plan views (2) ──────────────────────────────────────────────────
  cmds.push(
    {
      type: 'upsertViewTemplate',
      id: 'seed-vt-arch-1to100',
      name: 'Architecture · 1:100',
      scale: 'scale_100',
      disciplinesVisible: ['architecture'],
      planDetailLevel: 'medium',
    },
    {
      type: 'upsertPlanView',
      id: 'seed-plan-eg',
      name: 'Ground plan',
      levelId: 'seed-lvl-ground',
      viewTemplateId: 'seed-vt-arch-1to100',
      planPresentation: 'default',
      cropMinMm: { xMm: 2000, yMm: -7000 },
      cropMaxMm: { xMm: 24000, yMm: 14000 },
    },
    {
      type: 'upsertPlanView',
      id: 'seed-plan-og',
      name: 'Upper plan',
      levelId: 'seed-lvl-upper',
      viewTemplateId: 'seed-vt-arch-1to100',
      planPresentation: 'default',
      cropMinMm: { xMm: 2000, yMm: 2000 },
      cropMaxMm: { xMm: 24000, yMm: 14000 },
    },
  );

  // ── 16. 3D viewpoints (3) ───────────────────────────────────────────────
  cmds.push(
    {
      type: 'saveViewpoint',
      id: 'seed-vp-default-orbit',
      name: 'Default Orbit',
      camera: {
        position: { xMm: 32000, yMm: -8000, zMm: 9000 },
        target: { xMm: 13000, yMm: 8000, zMm: 1500 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'seed-vp-ne-iso',
      name: 'NE-Iso',
      camera: {
        position: { xMm: 30000, yMm: 28000, zMm: 14000 },
        target: { xMm: 13000, yMm: 8000, zMm: 1500 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'seed-vp-balcony-worm',
      name: "Worm's-eye from balcony",
      camera: {
        position: { xMm: 11000, yMm: 4500, zMm: 3300 },
        target: { xMm: 11000, yMm: 8000, zMm: 5800 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    },
  );

  // ── 17. Sheet (A-101) with 4 viewports ──────────────────────────────────
  cmds.push(
    {
      type: 'upsertSheet',
      id: 'seed-sheet-a101',
      name: 'A-101 · Plans / sections',
      titleBlock: 'A1',
      paperWidthMm: 84100,
      paperHeightMm: 59400,
      titleblockParameters: {
        projectName: 'BIM AI seed house V2',
        sheetNumber: 'A-101',
        scale: '1:100',
        revision: 'A',
      },
    },
    {
      type: 'upsertSheetViewports',
      sheetId: 'seed-sheet-a101',
      viewportsMm: [
        {
          viewportId: 'seed-vp-eg',
          label: 'Ground plan',
          viewRef: 'plan:seed-plan-eg',
          xMm: 1500,
          yMm: 1500,
          widthMm: 38000,
          heightMm: 25000,
        },
        {
          viewportId: 'seed-vp-og',
          label: 'Upper plan',
          viewRef: 'plan:seed-plan-og',
          xMm: 41000,
          yMm: 1500,
          widthMm: 38000,
          heightMm: 25000,
        },
        {
          viewportId: 'seed-vp-aa',
          label: 'Section A–A',
          viewRef: 'section:seed-sec-aa',
          xMm: 1500,
          yMm: 28000,
          widthMm: 38000,
          heightMm: 14000,
        },
        {
          viewportId: 'seed-vp-iso',
          label: '3D · NE-Iso',
          viewRef: 'viewpoint:seed-vp-ne-iso',
          xMm: 41000,
          yMm: 28000,
          widthMm: 38000,
          heightMm: 14000,
        },
      ],
    },
  );

  // ── 18. Schedules (5) ───────────────────────────────────────────────────
  cmds.push(
    { type: 'upsertSchedule', id: 'seed-sch-door', name: 'Door schedule' },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'seed-sch-door',
      filters: { kinds: ['door'] },
      grouping: { sortBy: 'mark', sortDescending: false },
    },
    { type: 'upsertSchedule', id: 'seed-sch-window', name: 'Window schedule' },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'seed-sch-window',
      filters: { kinds: ['window'] },
      grouping: { sortBy: 'widthMm', sortDescending: true },
    },
    { type: 'upsertSchedule', id: 'seed-sch-room', name: 'Room schedule' },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'seed-sch-room',
      filters: { kinds: ['room'] },
      grouping: { sortBy: 'areaM2', sortDescending: true },
    },
    { type: 'upsertSchedule', id: 'seed-sch-wall-types', name: 'Wall types' },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'seed-sch-wall-types',
      filters: { kinds: ['wall'] },
      grouping: { sortBy: 'thicknessMm', sortDescending: true },
    },
    { type: 'upsertSchedule', id: 'seed-sch-material', name: 'Material take-off' },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'seed-sch-material',
      filters: { kinds: ['floor', 'roof', 'wall'] },
      grouping: { sortBy: 'kind', sortDescending: false },
    },
  );

  return cmds;
}
