import { describe, expect, it } from 'vitest';

import { extractRoomColorLegend } from './planProjectionWire';

describe('extractRoomColorLegend', () => {
  it('parses functionLabel when present', () => {
    const rows = extractRoomColorLegend({
      format: 'planProjectionWire_v1',
      roomColorLegend: [
        {
          label: 'OFF',
          schemeColorHex: '#38cca6',
          programmeCode: 'OFF',
          department: 'Archives',
          functionLabel: 'Reading',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.functionLabel).toBe('Reading');
    expect(rows[0]!.department).toBe('Archives');
  });
});
