/** @typedef {Record<string, unknown>} BimCommand */

/*
 * Canonical seed: an asymmetric two-volume single-family demo house.
 *
 * See spec/target-house-seed.md for the architectural ground truth, and
 * spec/target-house-vis-colored.png for the colour study. This seed is
 * authored against KRN-14 + KRN-15 + KRN-16 (no more workarounds):
 *
 *   - asymmetric gable roof (KRN-11) with bumped ridge offset
 *   - loggia recess on the upper south wall via KRN-16 recessZones[]
 *   - "thick white picture-frame" outline along the gable polygon via
 *     KRN-15 createSweep
 *   - east-slope dormer cut-out via KRN-14 createDormer
 *
 * Plan layout (mm; +X east, +Y north, +Z up; origin at SW corner):
 *
 *     y=8000 ┌──────────────────────────┐         (north)
 *            │   upper-vol roof above   │
 *            │   (asymmetric gable)     │
 *            │     0..5000 × 0..8000    │
 *            │                          │
 *            │   loggia recess on the   │  east strip is single-storey
 *            │   south wall, alongT     │  flat-roof deck w/ parapet
 *            │   0.1..0.9, 1500mm deep  │  (5000..7000 × 0..8000)
 *     y=0    └──────────────────────────┘  (south face)
 *           x=0           5000          7000
 *
 * Massing essence (KRN-11 asymmetric_gable):
 *   - upper volume sits west-aligned over the ground floor
 *   - ridge sits 1800mm east of upper-volume centre (so at x≈4300)
 *   - west-side eave low (1200mm above lvl-upper → absolute 4200mm)
 *   - east-side eave high (4500mm above lvl-upper → absolute 7500mm)
 *   - long west pitch + short steep east pitch
 *
 * Materials follow MAT-01 catalog keys (see app/bim_ai/material_catalog.py).
 */

const UPPER_FOOTPRINT_MM = [
  { xMm: 0, yMm: 0 },
  { xMm: 5000, yMm: 0 },
  { xMm: 5000, yMm: 8000 },
  { xMm: 0, yMm: 8000 },
];

const GROUND_FOOTPRINT_MM = [
  { xMm: 0, yMm: 0 },
  { xMm: 7000, yMm: 0 },
  { xMm: 7000, yMm: 8000 },
  { xMm: 0, yMm: 8000 },
];

const EAST_DECK_FOOTPRINT_MM = [
  { xMm: 5000, yMm: 0 },
  { xMm: 7000, yMm: 0 },
  { xMm: 7000, yMm: 8000 },
  { xMm: 5000, yMm: 8000 },
];

/**
 * Authoritative command bundle for the demo seed house. Both
 * `app/scripts/seed.py` (via the generated JSON) and
 * `scripts/apply-one-family-home.mjs` (direct import) consume this.
 *
 * @returns {BimCommand[]}
 */
export function buildOneFamilyHomeCommands() {
  return [
    // ── Origin (KRN-06 auto-creates internal_origin; we add an explicit
    //    project base point at the same spot for completeness).
    {
      type: 'createProjectBasePoint',
      id: 'hf-pbp',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      angleToTrueNorthDeg: 0,
    },

    // ── Levels ────────────────────────────────────────────────────────
    { type: 'createLevel', id: 'hf-lvl-ground', name: 'Ground Floor', elevationMm: 0 },
    { type: 'createLevel', id: 'hf-lvl-upper', name: 'First Floor', elevationMm: 3000 },

    // ── Ground floor envelope (h=3000, beige/grey vertical siding) ────
    {
      type: 'createWall',
      id: 'hf-w-gf-south',
      name: 'Ground south facade',
      levelId: 'hf-lvl-ground',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 7000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
      materialKey: 'cladding_beige_grey',
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-west',
      name: 'Ground west facade',
      levelId: 'hf-lvl-ground',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 0, yMm: 8000 },
      thicknessMm: 200,
      heightMm: 3000,
      materialKey: 'cladding_beige_grey',
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-north',
      name: 'Ground north facade',
      levelId: 'hf-lvl-ground',
      start: { xMm: 0, yMm: 8000 },
      end: { xMm: 7000, yMm: 8000 },
      thicknessMm: 200,
      heightMm: 3000,
      materialKey: 'cladding_beige_grey',
    },
    {
      type: 'createWall',
      id: 'hf-w-gf-east',
      name: 'Ground east facade (extension)',
      levelId: 'hf-lvl-ground',
      start: { xMm: 7000, yMm: 0 },
      end: { xMm: 7000, yMm: 8000 },
      thicknessMm: 200,
      heightMm: 3000,
      materialKey: 'cladding_beige_grey',
    },

    // ── Upper floor envelope ──────────────────────────────────────────
    // West and north walls are short (low west eave); they will be
    // attached to the asymmetric roof so their tops follow the slope.
    {
      type: 'createWall',
      id: 'hf-w-uf-west',
      name: 'Upper west wall (low)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 0, yMm: 8000 },
      thicknessMm: 200,
      heightMm: 1200,
      materialKey: 'white_render',
    },
    {
      type: 'createWall',
      id: 'hf-w-uf-north',
      name: 'Upper north wall (gable end)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 0, yMm: 8000 },
      end: { xMm: 5000, yMm: 8000 },
      thicknessMm: 200,
      heightMm: 4500,
      materialKey: 'white_render',
    },
    // Upper east wall — separates upper interior from the east roof deck.
    // The east-slope dormer cut-out (KRN-14) opens onto this wall, so
    // the sliding glass doors host directly here.
    {
      type: 'createWall',
      id: 'hf-w-uf-east',
      name: 'Upper east wall (to deck)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 5000, yMm: 0 },
      end: { xMm: 5000, yMm: 8000 },
      thicknessMm: 200,
      heightMm: 4500,
      materialKey: 'white_render',
    },

    // ── South façade — single wall with KRN-16 loggia recess ─────────
    // The wall's recessZones step the wall plane back 1500 mm interior
    // over alongT 0.1..0.9, exposing the warm-wood "back wall" of the
    // loggia. The non-recessed end caps inherit white_render (set
    // separately) — but for the recessed surface that's visible from
    // the south, the wall's primary materialKey is cladding_warm_wood.
    {
      type: 'createWall',
      id: 'hf-w-uf-south',
      name: 'Upper south wall (loggia recess)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 4200,
      materialKey: 'cladding_warm_wood',
    },
    {
      type: 'setWallRecessZones',
      wallId: 'hf-w-uf-south',
      recessZones: [
        {
          alongTStart: 0.1,
          alongTEnd: 0.9,
          setbackMm: 1500,
          floorContinues: true,
        },
      ],
    },

    // ── Floors / slabs ────────────────────────────────────────────────
    {
      type: 'createFloor',
      id: 'hf-fl-ground',
      name: 'Ground slab',
      levelId: 'hf-lvl-ground',
      boundaryMm: GROUND_FOOTPRINT_MM,
      thicknessMm: 220,
      structureThicknessMm: 160,
      finishThicknessMm: 60,
      roomBounded: false,
    },
    {
      type: 'createFloor',
      id: 'hf-fl-upper',
      name: 'Upper structural slab',
      levelId: 'hf-lvl-upper',
      boundaryMm: UPPER_FOOTPRINT_MM,
      thicknessMm: 220,
      structureThicknessMm: 160,
      finishThicknessMm: 60,
      roomBounded: false,
    },
    {
      type: 'createFloor',
      id: 'hf-fl-east-deck',
      name: 'East roof deck',
      levelId: 'hf-lvl-upper',
      boundaryMm: EAST_DECK_FOOTPRINT_MM,
      thicknessMm: 200,
      structureThicknessMm: 160,
      finishThicknessMm: 40,
      roomBounded: false,
    },

    // ── Asymmetric gable roof (KRN-11) ────────────────────────────────
    // Bumped from the seed-rebuild values to read more dramatically:
    //   ridge offset 1500 → 1800 mm east of centre
    //   west eave 1500 → 1200 mm (lower, longer west pitch)
    //   east eave 4000 → 4500 mm (higher, shorter steep east pitch)
    {
      type: 'createRoof',
      id: 'hf-roof-main',
      name: 'Asymmetric gable roof',
      referenceLevelId: 'hf-lvl-upper',
      footprintMm: UPPER_FOOTPRINT_MM,
      overhangMm: 250,
      slopeDeg: null,
      roofGeometryMode: 'asymmetric_gable',
      ridgeOffsetTransverseMm: 1800,
      eaveHeightLeftMm: 1200,
      eaveHeightRightMm: 4500,
      materialKey: 'metal_standing_seam_dark_grey',
    },

    // Attach upper-volume gable walls to the roof so their tops follow
    // the slope (low west eave, high east eave, gable triangle on N/S).
    // The south wall stays detached from the roof — its top is a flat
    // 4200 mm and the roof / picture-frame outline composes the gable
    // shape above it. Otherwise the recessZones polygon footprint would
    // need to compose with attachWallTopToRoof, which the load-bearing
    // slice does not yet support.
    {
      type: 'attachWallTopToRoof',
      wallId: 'hf-w-uf-west',
      roofId: 'hf-roof-main',
    },
    {
      type: 'attachWallTopToRoof',
      wallId: 'hf-w-uf-north',
      roofId: 'hf-roof-main',
    },
    {
      type: 'attachWallTopToRoof',
      wallId: 'hf-w-uf-east',
      roofId: 'hf-roof-main',
    },

    // ── KRN-15 picture-frame outline along the gable polygon ───────────
    // The 200×100 mm white-render sweep traces the south face's gable
    // outline. Profile: uMm 200 along the wall direction (the visible
    // "thickness" of the frame seen from outside), vMm 100 out of facade
    // (toward the south observer). Path is closed and lives in planY=0.
    {
      type: 'createSweep',
      id: 'hf-sw-frame',
      name: 'Loggia picture-frame outline',
      levelId: 'hf-lvl-ground',
      pathMm: [
        { xMm: 0, yMm: 0, zMm: 3000 },
        { xMm: 5000, yMm: 0, zMm: 3000 },
        { xMm: 5000, yMm: 0, zMm: 7500 },
        { xMm: 4300, yMm: 0, zMm: 4576 },
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

    // ── East roof deck parapet (white render, h=1000) ─────────────────
    {
      type: 'createWall',
      id: 'hf-w-para-south',
      name: 'Deck parapet (south)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 5000, yMm: 0 },
      end: { xMm: 7000, yMm: 0 },
      thicknessMm: 150,
      heightMm: 1000,
      materialKey: 'white_render',
    },
    {
      type: 'createWall',
      id: 'hf-w-para-east',
      name: 'Deck parapet (east)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 7000, yMm: 0 },
      end: { xMm: 7000, yMm: 8000 },
      thicknessMm: 150,
      heightMm: 1000,
      materialKey: 'white_render',
    },
    {
      type: 'createWall',
      id: 'hf-w-para-north',
      name: 'Deck parapet (north)',
      levelId: 'hf-lvl-upper',
      start: { xMm: 7000, yMm: 8000 },
      end: { xMm: 5000, yMm: 8000 },
      thicknessMm: 150,
      heightMm: 1000,
      materialKey: 'white_render',
    },

    // ── Ground floor openings ─────────────────────────────────────────
    // Front entry (right-of-centre per spec §1.3).
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-entry',
      name: 'Front entry',
      wallId: 'hf-w-gf-south',
      alongT: 0.62,
      widthMm: 1000,
    },
    // Two portrait windows on the south, in the left half (spec §1.3).
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-south-1',
      name: 'South window 1',
      wallId: 'hf-w-gf-south',
      alongT: 0.16,
      widthMm: 800,
      sillHeightMm: 100,
      heightMm: 1800,
    },
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-south-2',
      name: 'South window 2',
      wallId: 'hf-w-gf-south',
      alongT: 0.32,
      widthMm: 800,
      sillHeightMm: 100,
      heightMm: 1800,
    },
    // Small portrait window on the east extension (spec §1.6).
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-gf-east',
      name: 'East extension window',
      wallId: 'hf-w-gf-east',
      alongT: 0.5,
      widthMm: 800,
      sillHeightMm: 1500,
      heightMm: 1000,
    },

    // ── Loggia openings (hosted on the south wall in the recess zone) ─
    // The KRN-16 recessZones step the wall plane back 1500 mm interior
    // over alongT 0.1..0.9, so these openings render against the
    // recessed (warm-wood) surface, not the original wall plane.
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-loggia',
      name: 'Loggia sliding door',
      wallId: 'hf-w-uf-south',
      alongT: 0.7,
      widthMm: 1800,
    },
    // Trapezoidal window — left side (spec §1.4: "smaller, trapezoidal
    // window on the left whose top edge slopes to follow the long, low
    // angle of the roof pitch").
    {
      type: 'insertWindowOnWall',
      id: 'hf-win-loggia-trap',
      name: 'Loggia trapezoidal window',
      wallId: 'hf-w-uf-south',
      alongT: 0.2,
      widthMm: 1200,
      sillHeightMm: 100,
      heightMm: 1500,
    },

    // ── KRN-12/13 fields applied via updateElementProperty ────────────
    // (insertDoor/insertWindow commands don't accept these directly yet.)
    {
      type: 'updateElementProperty',
      elementId: 'hf-door-loggia',
      key: 'operationType',
      value: 'sliding_double',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-door-loggia',
      key: 'materialKey',
      value: 'glass_clear',
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
    {
      type: 'updateElementProperty',
      elementId: 'hf-win-loggia-trap',
      key: 'materialKey',
      value: 'aluminium_dark_grey',
    },
    // Dark frames on the ground-floor windows.
    {
      type: 'updateElementProperty',
      elementId: 'hf-win-gf-south-1',
      key: 'materialKey',
      value: 'aluminium_dark_grey',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-win-gf-south-2',
      key: 'materialKey',
      value: 'aluminium_dark_grey',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-win-gf-east',
      key: 'materialKey',
      value: 'aluminium_dark_grey',
    },
    // Front-door panel material (dark with a glass insert per spec §1.3).
    {
      type: 'updateElementProperty',
      elementId: 'hf-door-entry',
      key: 'materialKey',
      value: 'cladding_warm_wood',
    },

    // ── Balcony slab + glass balustrade in front of loggia recess ────
    // Hosted on the south wall, projects south so the balustrade lands
    // just outside the picture-frame outline. createBalcony's
    // balustrade is implicit frameless glass per spec §1.4.
    {
      type: 'createBalcony',
      id: 'hf-balcony-loggia',
      name: 'Loggia balcony',
      wallId: 'hf-w-uf-south',
      elevationMm: 3000,
      projectionMm: 200,
      slabThicknessMm: 150,
      balustradeHeightMm: 1050,
    },

    // ── KRN-14 dormer cut-out on the east slope ───────────────────────
    // Cuts a rectangular hole through the east slope of the asymmetric
    // gable roof, exposing the upper-volume east wall + the deck below.
    // Dormer "front" face opens toward +X (the east deck); cheek walls
    // and back wall in white render match the upper-volume cladding.
    {
      type: 'createDormer',
      id: 'hf-dormer-east',
      name: 'East-slope dormer cut-out',
      hostRoofId: 'hf-roof-main',
      positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1500 },
      widthMm: 2400,
      wallHeightMm: 2400,
      depthMm: 2000,
      dormerRoofKind: 'flat',
      wallMaterialKey: 'white_render',
      hasFloorOpening: false,
    },

    // Sliding glass doors on the upper east wall, hosted within the
    // dormer-cut footprint so they read through the cut-out from the
    // SSW viewpoint. alongT values target plan-Y range 800..3200 mm,
    // matching the dormer's south-half placement.
    {
      type: 'insertDoorOnWall',
      id: 'hf-door-dormer-s',
      name: 'Dormer sliding doors',
      wallId: 'hf-w-uf-east',
      alongT: 0.25,
      widthMm: 2400,
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-door-dormer-s',
      key: 'operationType',
      value: 'sliding_double',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-door-dormer-s',
      key: 'materialKey',
      value: 'glass_clear',
    },

    // ── Stair from ground to upper (interior) ─────────────────────────
    // Tucked along the east face of the upper-volume interior so the
    // open-plan ground floor isn't fragmented.
    {
      type: 'createStair',
      id: 'hf-stair-main',
      name: 'Main stair',
      baseLevelId: 'hf-lvl-ground',
      topLevelId: 'hf-lvl-upper',
      runStartMm: { xMm: 4500, yMm: 4400 },
      runEndMm: { xMm: 4500, yMm: 7800 },
      widthMm: 1000,
      riserMm: 175,
      treadMm: 275,
    },
    // Stair shaft cut through the upper slab so the stair can rise
    // through it. Hosted on the upper floor; matches the stair run.
    {
      type: 'createSlabOpening',
      id: 'hf-opening-stair-upper',
      name: 'Stair shaft (upper slab)',
      hostFloorId: 'hf-fl-upper',
      boundaryMm: [
        { xMm: 3950, yMm: 4300 },
        { xMm: 4750, yMm: 4300 },
        { xMm: 4750, yMm: 7900 },
        { xMm: 3950, yMm: 7900 },
      ],
      isShaft: true,
    },
    {
      type: 'createRailing',
      id: 'hf-rail-stair',
      name: 'Stair guardrail',
      hostedStairId: 'hf-stair-main',
      pathMm: [
        { xMm: 3850, yMm: 4400 },
        { xMm: 3850, yMm: 7800 },
      ],
    },

    // ── Rooms ─────────────────────────────────────────────────────────
    // Open-plan ground floor (no Bath/Kitchen split — see spec §1).
    {
      type: 'createRoomOutline',
      id: 'hf-room-living-kitchen',
      name: 'Living + Kitchen',
      levelId: 'hf-lvl-ground',
      outlineMm: [
        { xMm: 200, yMm: 200 },
        { xMm: 6800, yMm: 200 },
        { xMm: 6800, yMm: 7800 },
        { xMm: 200, yMm: 7800 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-bedroom',
      name: 'Upper bedroom',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: 200, yMm: 1700 },
        { xMm: 4800, yMm: 1700 },
        { xMm: 4800, yMm: 7800 },
        { xMm: 200, yMm: 7800 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-loggia',
      name: 'Loggia',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: 200, yMm: 200 },
        { xMm: 4800, yMm: 200 },
        { xMm: 4800, yMm: 1400 },
        { xMm: 200, yMm: 1400 },
      ],
    },
    {
      type: 'createRoomOutline',
      id: 'hf-room-roof-terrace',
      name: 'Roof Terrace',
      levelId: 'hf-lvl-upper',
      outlineMm: [
        { xMm: 5200, yMm: 200 },
        { xMm: 6800, yMm: 200 },
        { xMm: 6800, yMm: 7800 },
        { xMm: 5200, yMm: 7800 },
      ],
    },

    // Programme codes — preserve KIT-BUNDLE on the kitchen-bearing room
    // to keep the documentation-spine roundtrip test stable.
    {
      type: 'updateElementProperty',
      elementId: 'hf-room-living-kitchen',
      key: 'programmeCode',
      value: 'KIT-BUNDLE',
    },
    {
      type: 'updateElementProperty',
      elementId: 'hf-room-bedroom',
      key: 'programmeCode',
      value: 'BED-BUNDLE',
    },

    // ── Sample reusable family/catalog entries ────────────────────────
    {
      type: 'upsertFamilyType',
      id: 'hf-ft-door-entry',
      name: 'ENT-001',
      discipline: 'door',
      parameters: { manufacturer: 'GoldenFixture', thermalZone: 'exterior', fireRating: 'EI30' },
    },
    {
      type: 'upsertFamilyType',
      id: 'hf-ft-window-loggia',
      name: 'WIN-LOGGIA',
      discipline: 'window',
      parameters: { glazingLayers: 'triple', uw: '0.9' },
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
      openingId: 'hf-win-loggia-trap',
      familyTypeId: 'hf-ft-window-loggia',
      cutDepthMm: 220,
      revealInteriorMm: 30,
    },

    // ── View templates + plan views ───────────────────────────────────
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
      name: 'GF — openings focus',
      levelId: 'hf-lvl-ground',
      viewTemplateId: 'hf-vt-plan-eg-opening',
      planPresentation: 'opening_focus',
      categoriesHidden: ['room'],
    },
    {
      type: 'upsertPlanView',
      id: 'hf-plan-og-rooms',
      name: 'Upper — room fills',
      levelId: 'hf-lvl-upper',
      viewTemplateId: 'hf-vt-plan-og-rooms',
      planPresentation: 'room_scheme',
    },

    // ── Section cut (E–W through the loggia + main living) ────────────
    {
      type: 'createSectionCut',
      id: 'hf-sec-longitudinal',
      name: 'Loggia + interior longitudinal',
      lineStartMm: { xMm: -1000, yMm: 4000 },
      lineEndMm: { xMm: 8000, yMm: 4000 },
      cropDepthMm: 8000,
    },

    // ── Sheet + schedules (preserve hf-sheet-ga01 ID and its title
    //    block / paper size for the documentation-spine roundtrip test).
    {
      type: 'upsertSheet',
      id: 'hf-sheet-ga01',
      name: 'GA-01 — Asymmetric demo',
      titleBlock: 'A1‑Golden',
      paperWidthMm: 42000,
      paperHeightMm: 29700,
      titleblockParameters: {
        projectName: 'One‑family golden',
        sheetNumber: 'GA‑01',
        revision: '4',
        drawnBy: 'bundle',
      },
    },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-room',
      name: 'Room schedule',
      sheetId: null,
    },
    {
      type: 'upsertScheduleFilters',
      scheduleId: 'hf-sch-room',
      filters: { category: 'room', discipline: 'architecture' },
      grouping: { sortBy: 'areaM2', sortDescending: true },
    },
    {
      type: 'upsertSchedule',
      id: 'hf-sch-window',
      name: 'Window schedule',
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
      name: 'Door schedule',
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
      name: 'Floor schedule',
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
      name: 'Roof schedule',
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
      name: 'Stair schedule',
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
      name: 'Sheet index',
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
      name: 'Plan views',
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
      name: 'Section cuts',
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
          label: 'GF plan',
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

    // ── Dimensions (sanity checks on key spans) ───────────────────────
    {
      type: 'createDimension',
      id: 'hf-dim-house-width',
      name: 'House total width',
      levelId: 'hf-lvl-ground',
      aMm: { xMm: 0, yMm: -1200 },
      bMm: { xMm: 7000, yMm: -1200 },
      offsetMm: { xMm: 0, yMm: 600 },
    },
    {
      type: 'createDimension',
      id: 'hf-dim-upper-span',
      name: 'Upper volume span',
      levelId: 'hf-lvl-upper',
      aMm: { xMm: 0, yMm: -1200 },
      bMm: { xMm: 5000, yMm: -1200 },
      offsetMm: { xMm: 0, yMm: 600 },
    },

    // ── Viewpoints ────────────────────────────────────────────────────
    // Primary SSW iso — frames the asymmetric massing per spec §1.1.
    // (Coordinates roughly match the previous Python seed's vp-ssw to
    // preserve evidence/screenshot baselines that bind to camera.)
    {
      type: 'saveViewpoint',
      id: 'vp-ssw',
      name: 'SSW iso (target view)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: -5000, yMm: -14000, zMm: 11000 },
        target: { xMm: 3500, yMm: 4000, zMm: 4000 },
        up: { xMm: 0, yMm: 0, zMm: 1000 },
      },
    },
    // Secondary SE iso — shows the east extension + dormer/deck.
    {
      type: 'saveViewpoint',
      id: 'vp-se',
      name: 'SE iso (deck view)',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 18000, yMm: -8000, zMm: 13000 },
        target: { xMm: 5000, yMm: 4000, zMm: 4000 },
        up: { xMm: 0, yMm: 0, zMm: 1000 },
      },
    },
    // Interior cut-away camera (matches the prior CLI seed's evidence
    // camera so screenshot baselines that depended on this still work).
    {
      type: 'saveViewpoint',
      id: 'hf-vp-cutaway-core',
      name: '3D cut interior',
      mode: 'orbit_3d',
      viewerClipCapElevMm: 5600,
      viewerClipFloorElevMm: 0,
      hiddenSemanticKinds3d: ['roof'],
      camera: {
        position: { xMm: 8000, yMm: 14000, zMm: 4500 },
        target: { xMm: 3000, yMm: 4000, zMm: 1500 },
        up: { xMm: 0, yMm: 0, zMm: 1000 },
      },
    },
    {
      type: 'saveViewpoint',
      id: 'hf-vp-plan-eg-demo',
      name: 'Plan EG seed',
      mode: 'plan_canvas',
      camera: {
        position: { xMm: 3500, yMm: 4000, zMm: 8200 },
        target: { xMm: 3500, yMm: 4000, zMm: 0 },
        up: { xMm: 0, yMm: 1000, zMm: 0 },
      },
    },
  ];
}
