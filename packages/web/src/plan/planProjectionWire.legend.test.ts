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
        notes: 'Test note',
      },
    });
    expect(ev).not.toBeNull();
    expect(ev!.legendDigestSha256).toBe('a'.repeat(64));
    expect(ev!.rowCount).toBe(3);
    expect(ev!.orthogonalTo).toEqual(['derivedRoomBoundaryEvidence_v0']);
    expect(ev!.notes).toBe('Test note');
  });

  it('extractRoomProgrammeLegendEvidenceV0 reads schemeOverridesSource and schemeOverrideRowCount', () => {
    const ev = extractRoomProgrammeLegendEvidenceV0({
      format: 'planProjectionWire_v1',
      roomProgrammeLegendEvidence_v0: {
        format: 'roomProgrammeLegendEvidence_v0',
        legendDigestSha256: 'b'.repeat(64),
        rowCount: 2,
        schemeOverridesSource: 'bim-room-color-scheme',
        schemeOverrideRowCount: 1,
      },
    });
    expect(ev).not.toBeNull();
    expect(ev!.schemeOverridesSource).toBe('bim-room-color-scheme');
    expect(ev!.schemeOverrideRowCount).toBe(1);
  });

  it('extractRoomProgrammeLegendEvidenceV0 reads snake_case scheme override aliases', () => {
    const ev = extractRoomProgrammeLegendEvidenceV0({
      format: 'planProjectionWire_v1',
      roomProgrammeLegendEvidence_v0: {
        format: 'roomProgrammeLegendEvidence_v0',
        legendDigestSha256: 'c'.repeat(64),
        row_count: 4,
        scheme_overrides_source: 'bim-room-color-scheme',
        scheme_override_row_count: 3,
      },
    });
    expect(ev).not.toBeNull();
    expect(ev!.rowCount).toBe(4);
    expect(ev!.schemeOverridesSource).toBe('bim-room-color-scheme');
    expect(ev!.schemeOverrideRowCount).toBe(3);
  });
});
