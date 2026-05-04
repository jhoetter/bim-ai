import { describe, expect, it } from 'vitest';

import { useBimStore } from './state/store';

describe('bim web store', () => {
  it('hydrates from snapshot-ish payload', () => {
    useBimStore.getState().hydrateFromSnapshot({
      modelId: 'm',
      revision: 1,
      elements: {},
      violations: [],
    });
    expect(useBimStore.getState().modelId).toBe('m');
    expect(useBimStore.getState().revision).toBe(1);
  });
});
