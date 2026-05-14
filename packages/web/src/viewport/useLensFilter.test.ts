import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  elementPassesFireSafetyLens,
  lensFilterFromMode,
  resolveLensFilter,
} from './useLensFilter';

describe('fire-safety lens filter', () => {
  it('foregrounds shared architectural and MEP fire-safety hosts', () => {
    expect(
      elementPassesFireSafetyLens({
        kind: 'wall',
        id: 'w1',
        name: 'Rated wall',
        levelId: 'l1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1000, yMm: 0 },
      } as Element),
    ).toBe(true);
    expect(
      elementPassesFireSafetyLens({
        kind: 'duct',
        id: 'd1',
        levelId: 'l1',
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 1000, yMm: 0 },
      } as Element),
    ).toBe(true);
  });

  it('foregrounds custom review markers with fire-safety props', () => {
    const generic = {
      kind: 'generic_model',
      id: 'g1',
      name: 'Inspection marker',
      props: { firestopStatus: 'approved' },
    } as unknown as Element;
    expect(elementPassesFireSafetyLens(generic)).toBe(true);
  });

  it('ghosts unrelated elements in UI and saved-view fire-safety lens modes', () => {
    const column = {
      kind: 'column',
      id: 'c1',
      name: 'Column',
      levelId: 'l1',
      center: { xMm: 0, yMm: 0 },
    } as unknown as Element;

    expect(lensFilterFromMode('fire-safety')(column)).toBe('ghost');
    expect(resolveLensFilter({ defaultLens: 'show_fire_safety' })(column)).toBe('ghost');
  });
});
