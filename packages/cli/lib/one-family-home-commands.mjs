/** @typedef {Record<string, unknown>} BimCommand */

/*
 * Canonical seed: the demo "one-family home" project.
 *
 * Currently a STUB: only the bare-minimum scaffolding (project base point
 * + two levels) is authored. The previous house geometry has been cleared
 * so that the next iteration can re-author the target house from scratch
 * against `spec/target-house-seed.md` + `spec/target-house-vis-colored.png`.
 *
 * All three consumers — `app/scripts/seed.py`, `scripts/apply-one-family-home.mjs`,
 * and the `bim-ai plan-house` CLI — keep working against this builder; they
 * just produce an essentially empty model until the new house is authored.
 */

/**
 * @returns {BimCommand[]}
 */
export function buildOneFamilyHomeCommands() {
  return [
    {
      type: 'createProjectBasePoint',
      id: 'hf-pbp',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      angleToTrueNorthDeg: 0,
    },
    { type: 'createLevel', id: 'hf-lvl-ground', name: 'Ground Floor', elevationMm: 0 },
    { type: 'createLevel', id: 'hf-lvl-upper', name: 'First Floor', elevationMm: 3000 },
  ];
}
