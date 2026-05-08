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
 *
 * Massing volumes (Phase 1):
 *   - hf-mass-gf       Ground floor:        7000 × 8000, height 3000     (cladding_beige_grey)
 *   - hf-mass-uf       Upper floor (west):  5000 × 8000, height 4500     (render_white)
 *                      heightMm = top of EAST eave (high side); the
 *                      asymmetric_gable roof above is added in Phase 3.
 *   - hf-mass-parapet  East roof-deck block:2000 × 8000, height 200      (cladding_beige_grey)
 */

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
    { type: 'createLevel', id: 'hf-lvl-upper', name: 'First Floor', elevationMm: 3000 },

    // === PHASE 1: MASSING ===
    // Three volumetric blocks defining the asymmetric two-stack composition.
    // Material keys are pre-applied so the colour silhouette reads at the
    // Phase 1 checkpoint — the skill allows materialKey unset, but the
    // SKB-09 archetype precedent applies them in massing too.
    {
      type: 'createMass',
      id: 'hf-mass-gf',
      name: 'Ground floor mass',
      levelId: 'hf-lvl-ground',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 7000, yMm: 0 },
        { xMm: 7000, yMm: 8000 },
        { xMm: 0, yMm: 8000 },
      ],
      heightMm: 3000,
      materialKey: 'cladding_beige_grey',
    },
    {
      type: 'createMass',
      id: 'hf-mass-uf',
      name: 'Upper floor mass (west-aligned)',
      levelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 5000, yMm: 8000 },
        { xMm: 0, yMm: 8000 },
      ],
      heightMm: 4500,
      materialKey: 'render_white',
    },
    {
      type: 'createMass',
      id: 'hf-mass-parapet',
      name: 'East deck parapet block',
      levelId: 'hf-lvl-upper',
      footprintMm: [
        { xMm: 5000, yMm: 0 },
        { xMm: 7000, yMm: 0 },
        { xMm: 7000, yMm: 8000 },
        { xMm: 5000, yMm: 8000 },
      ],
      heightMm: 200,
      materialKey: 'cladding_beige_grey',
    },
  ];
}
