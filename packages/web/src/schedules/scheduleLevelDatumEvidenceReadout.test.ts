import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { formatScheduleLevelDatumEvidenceLine } from './scheduleLevelDatumEvidenceReadout';

describe('scheduleLevelDatumEvidenceReadout', () => {
  it('emits when level in stack', () => {
    const elementsById: Record<string, Element> = {
      l1: { kind: 'level', id: 'l1', name: 'L1', elevationMm: 3200, parentLevelId: undefined },
    };
    expect(formatScheduleLevelDatumEvidenceLine(elementsById, 'l1')).toContain('scheduleLevelDatum');
  });
});
