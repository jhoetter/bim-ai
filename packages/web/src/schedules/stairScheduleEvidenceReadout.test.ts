import { describe, expect, it } from 'vitest';

import { stairScheduleEvidenceReadoutLines } from './stairScheduleEvidenceReadout';

describe('stairScheduleEvidenceReadoutLines', () => {
  it('returns empty when rows missing', () => {
    expect(stairScheduleEvidenceReadoutLines(null)).toEqual([]);
    expect(stairScheduleEvidenceReadoutLines([])).toEqual([]);
  });

  it('echoes correlation token and derivation status from first row', () => {
    const lines = stairScheduleEvidenceReadoutLines([
      {
        stairScheduleCorrelationToken: 'stairSchCorr_v0|s1|UP·R16·T15·W1100',
        stairQuantityDerivationStatus: 'complete',
      },
    ]);
    expect(lines).toEqual(['corr stairSchCorr_v0|s1|UP·R16·T15·W1100', 'qty complete']);
  });
});
