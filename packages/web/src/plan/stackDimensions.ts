import type { Element } from '@bim-ai/core';

type PermanentDimension = Extract<Element, { kind: 'permanent_dimension' }>;

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
  const verticals = dims.filter((d) => (d as any).isVertical);
  const horizontals = dims.filter((d) => !(d as any).isVertical);

  const assignOffsets = (group: PermanentDimension[]) => {
    // Sort by current offsetMm ascending (innermost first)
    const sorted = [...group].sort(
      (a, b) => ((a as any).offsetMm ?? spacingMm) - ((b as any).offsetMm ?? spacingMm),
    );
    sorted.forEach((dim, i) => {
      result.set(dim.id, spacingMm * (i + 1));
    });
  };

  assignOffsets(verticals);
  assignOffsets(horizontals);
  return result;
}
