import type { Element } from '@bim-ai/core';

type PermanentDimension = Extract<Element, { kind: 'permanent_dimension' }>;
type StackableDimension = Omit<PermanentDimension, 'offsetMm'> & {
  isVertical?: boolean;
  offsetMm?: number | { xMm?: number; yMm?: number };
};

function stackAxisOffset(dim: StackableDimension, spacingMm: number): number {
  if (typeof dim.offsetMm === 'number') return dim.offsetMm;
  if (dim.offsetMm && typeof dim.offsetMm.xMm === 'number') return dim.offsetMm.xMm;
  return spacingMm;
}

/**
 * §4.2.6: groups parallel permanent_dimension elements and redistributes
 * their offsetMm so they stack at even 7mm spacing (innermost at 7mm, next at 14mm, etc.)
 *
 * Two dims are "parallel" if they share the same axis (both vertical, or both
 * within 5° of each other). Returns a map of elementId → new offsetMm.
 */
export function stackDimensions(dims: PermanentDimension[], spacingMm = 7): Map<string, number> {
  const result = new Map<string, number>();
  if (dims.length === 0) return result;

  // Group by axis: vertical (isVertical) vs horizontal
  const stackableDims = dims as StackableDimension[];
  const verticals = stackableDims.filter((d) => d.isVertical);
  const horizontals = stackableDims.filter((d) => !d.isVertical);

  const assignOffsets = (group: StackableDimension[]) => {
    // Sort by current offsetMm ascending (innermost first)
    const sorted = [...group].sort(
      (a, b) => stackAxisOffset(a, spacingMm) - stackAxisOffset(b, spacingMm),
    );
    sorted.forEach((dim, i) => {
      result.set(dim.id, spacingMm * (i + 1));
    });
  };

  assignOffsets(verticals);
  assignOffsets(horizontals);
  return result;
}
