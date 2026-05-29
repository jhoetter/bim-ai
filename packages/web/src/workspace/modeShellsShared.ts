import type { Element } from '@bim-ai/core';

/**
 * Helpers shared by the per-mode shells (Section / Sheet / Schedule).
 *
 * These were originally co-located in `ModeShells.tsx`. FE-CQ-02 split each
 * shell into its own module so `CanvasMount` can lazy-load Schedule and Sheet
 * mode without dragging the other shells into the lazy chunk. The helpers
 * stay in a tiny shared module so we don't duplicate them.
 */

export function asArr<T extends Element['kind']>(
  elementsById: Record<string, Element>,
  k: T,
): Extract<Element, { kind: T }>[] {
  return (Object.values(elementsById) as Element[]).filter(
    (e): e is Extract<Element, { kind: T }> => e.kind === k,
  );
}
