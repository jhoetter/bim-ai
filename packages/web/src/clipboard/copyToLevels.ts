/**
 * B3 / C6 — Copy-to-levels command shape + helpers.
 *
 * These are pure data utilities; no store dependency. The heavy
 * orchestration (cloning elements per target level, id reassignment,
 * zMm offset) lives in copyPaste.ts via copyToLevels / pasteAlignedToLevels.
 */

export interface CopyToLevelsCommand {
  type: 'copyElementsToLevels';
  elementIds: string[];
  sourceLevelId: string;
  targetLevelIds: string[];
}

/**
 * Remove source level and duplicates from a target-level list.
 */
export function filterValidTargetLevels(targetLevelIds: string[], sourceLevelId: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of targetLevelIds) {
    if (!id || id === sourceLevelId || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/**
 * Returns the vertical offset in mm between two levels (target − source).
 */
export function levelOffsetMm(
  sourceLevelElevationMm: number,
  targetLevelElevationMm: number,
): number {
  return targetLevelElevationMm - sourceLevelElevationMm;
}

/**
 * Build one {@link CopyToLevelsCommand} per valid target level.
 *
 * Filters out the source level and deduplicates target ids.
 * Returns an empty array when no valid targets remain.
 */
export function buildCopyToLevelsCommands(
  elementIds: string[],
  sourceLevelId: string,
  targetLevelIds: string[],
): CopyToLevelsCommand[] {
  const validTargets = filterValidTargetLevels(targetLevelIds, sourceLevelId);
  return validTargets.map((targetLevelId) => ({
    type: 'copyElementsToLevels',
    elementIds,
    sourceLevelId,
    targetLevelIds: [targetLevelId],
  }));
}
