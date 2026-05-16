export interface PinCommand {
  type: 'pinElements';
  elementIds: string[];
}

export interface UnpinCommand {
  type: 'unpinElements';
  elementIds: string[];
}

/**
 * Builds a pin command for the given element IDs.
 * Returns null if elementIds is empty.
 * Deduplicates IDs before returning.
 */
export function buildPinCommand(elementIds: string[]): PinCommand | null {
  const deduped = [...new Set(elementIds)];
  if (deduped.length === 0) return null;
  return { type: 'pinElements', elementIds: deduped };
}

/**
 * Builds an unpin command for the given element IDs.
 * Returns null if elementIds is empty.
 * Deduplicates IDs before returning.
 */
export function buildUnpinCommand(elementIds: string[]): UnpinCommand | null {
  const deduped = [...new Set(elementIds)];
  if (deduped.length === 0) return null;
  return { type: 'unpinElements', elementIds: deduped };
}

/**
 * Splits the given element IDs into currently-pinned and currently-unpinned
 * buckets, using the provided getPinState callback.
 * IDs for which getPinState returns undefined are treated as unpinned.
 */
export function filterPinnable(
  elementIds: string[],
  getPinState: (id: string) => boolean | undefined,
): { unpinned: string[]; pinned: string[] } {
  const unpinned: string[] = [];
  const pinned: string[] = [];
  for (const id of elementIds) {
    if (getPinState(id) === true) {
      pinned.push(id);
    } else {
      unpinned.push(id);
    }
  }
  return { unpinned, pinned };
}

/**
 * Builds the toggle commands for a mixed selection:
 * - Pins all currently-unpinned elements (if any)
 * - Unpins all currently-pinned elements (if any)
 * Returns an empty array if elementIds is empty.
 */
export function buildPinToggleCommands(
  elementIds: string[],
  getPinState: (id: string) => boolean | undefined,
): Array<PinCommand | UnpinCommand> {
  if (elementIds.length === 0) return [];
  const { unpinned, pinned } = filterPinnable(elementIds, getPinState);
  const commands: Array<PinCommand | UnpinCommand> = [];
  const pinCmd = buildPinCommand(unpinned);
  if (pinCmd) commands.push(pinCmd);
  const unpinCmd = buildUnpinCommand(pinned);
  if (unpinCmd) commands.push(unpinCmd);
  return commands;
}

/** Constant for plan canvas padlock icon size in pixels (B8). */
export const PADLOCK_GLYPH_SIZE_PX = 12;
