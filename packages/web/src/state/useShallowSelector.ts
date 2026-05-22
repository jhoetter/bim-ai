/**
 * PERF-G06: shallow-equality selector convention.
 *
 * Re-exports zustand v5's `useShallow` so the codebase has one canonical
 * import path. Use it whenever a selector returns a fresh object/tuple
 * whose contents are reference-stable per delta — without shallow
 * equality, every store change wakes the consumer even when the slice
 * it actually reads is unchanged.
 *
 * Example:
 *
 *   import { useShallowSelector } from '../state/useShallowSelector';
 *
 *   const { walls, openings } = useBimStore(
 *     useShallowSelector((s) => ({
 *       walls: s.modelIndices.wallsByLevel[activeLevel] ?? EMPTY,
 *       openings: s.modelIndices.openingsByWall,
 *     })),
 *   );
 */
export { useShallow as useShallowSelector } from 'zustand/react/shallow';
