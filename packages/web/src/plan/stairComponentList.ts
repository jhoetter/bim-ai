import type { Element } from '@bim-ai/core';

export interface StairComponentSummary {
  runs: Array<Extract<Element, { kind: 'stair_run' }>>;
  landings: Array<Extract<Element, { kind: 'stair_landing' }>>;
}

/**
 * Finds all stair_run and stair_landing elements that belong to the given stairId.
 */
export function getStairComponents(
  stairId: string,
  elementsById: Record<string, Element>,
): StairComponentSummary {
  const runs: Array<Extract<Element, { kind: 'stair_run' }>> = [];
  const landings: Array<Extract<Element, { kind: 'stair_landing' }>> = [];

  for (const el of Object.values(elementsById)) {
    if (
      el.kind === 'stair_run' &&
      ((el as any).stairId === stairId || (el as any).parentStairId === stairId)
    ) {
      runs.push(el as any);
    }
    if (
      el.kind === 'stair_landing' &&
      ((el as any).stairId === stairId || (el as any).parentStairId === stairId)
    ) {
      landings.push(el as any);
    }
  }

  return { runs, landings };
}
