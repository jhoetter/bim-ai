import { describe, expect, it } from 'vitest';

import {
  formatLevelDatumPropagationEvidenceLine,
  parseLevelElevationPropagationEvidence,
} from './levelDatumPropagationReadout';

describe('levelDatumPropagationReadout', () => {
  it('parses server evidence shape', () => {
    const raw = {
      format: 'levelElevationPropagationEvidence_v0',
      datumPropagationBlocked: false,
      rows: [
        {
          levelId: 'a',
          elevationBeforeMm: 0,
          elevationAfterMm: 1,
          deltaMm: 1,
          parentLevelId: null,
          role: 'direct_move',
        },
      ],
    };
    const p = parseLevelElevationPropagationEvidence(raw);
    expect(p?.rows?.[0]?.role).toBe('direct_move');
    expect(formatLevelDatumPropagationEvidenceLine(p!)).toContain('a:direct_move');
  });
});
