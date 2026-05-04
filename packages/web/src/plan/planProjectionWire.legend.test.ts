import { describe, expect, it } from 'vitest';

import { extractRoomColorLegend, extractRoomProgrammeLegendEvidenceV0 } from './planProjectionWire';

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

  it('extractRoomProgrammeLegendEvidenceV0 reads digest and orthogonalTo', () => {
    const ev = extractRoomProgrammeLegendEvidenceV0({
      format: 'planProjectionWire_v1',
      roomProgrammeLegendEvidence_v0: {
        format: 'roomProgrammeLegendEvidence_v0',
        legendDigestSha256: 'a'.repeat(64),
        rowCount: 3,
        orthogonalTo: ['derivedRoomBoundaryEvidence_v0'],
        schemeOverridesSource: 'bim-room-color-scheme',
        schemeOverrideRowCount: '2',
        notes: 'Test note',
      },
    });
    expect(ev).not.toBeNull();
    expect(ev!.legendDigestSha256).toBe('a'.repeat(64));
    expect(ev!.rowCount).toBe(3);
    expect(ev!.orthogonalTo).toEqual(['derivedRoomBoundaryEvidence_v0']);
    expect(ev!.schemeOverridesSource).toBe('bim-room-color-scheme');
    expect(ev!.schemeOverrideRowCount).toBe(2);
    expect(ev!.notes).toBe('Test note');
  });
});
