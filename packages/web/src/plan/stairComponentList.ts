import type { Element } from '@bim-ai/core';

type StairRunElement = Extract<Element, { kind: 'stair_run' }>;
type StairLandingElement = Extract<Element, { kind: 'stair_landing' }>;
type StairComponentWithLegacyParent<T> = T & { parentStairId?: string };

export interface StairComponentSummary {
  runs: StairRunElement[];
  landings: StairLandingElement[];
}

/**
 * Finds all stair_run and stair_landing elements that belong to the given stairId.
 */
export function getStairComponents(
  stairId: string,
  elementsById: Record<string, Element>,
): StairComponentSummary {
  const runs: StairRunElement[] = [];
  const landings: StairLandingElement[] = [];

  for (const el of Object.values(elementsById)) {
    if (el.kind === 'stair_run') {
      const run = el as StairComponentWithLegacyParent<StairRunElement>;
      if (run.stairId === stairId || run.parentStairId === stairId) runs.push(el);
    }
    if (el.kind === 'stair_landing') {
      const landing = el as StairComponentWithLegacyParent<StairLandingElement>;
      if (landing.stairId === stairId || landing.parentStairId === stairId) landings.push(el);
    }
  }

  return { runs, landings };
}
