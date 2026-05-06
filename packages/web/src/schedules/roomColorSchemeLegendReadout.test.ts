import { describe, expect, it } from 'vitest';

import {
  roomColorSchemeLegendReadoutParts,
  roomColorSchemeHasAdvisories,
  roomColorSchemeOverrideRowSummary,
} from './roomColorSchemeLegendReadout';

const BASE_EV = {
  format: 'roomColorSchemeOverrideEvidence_v1' as const,
  schemeIdentity: 'bim-room-color-scheme',
  overrideRowCount: 2,
  rows: [
    {
      programmeCode: 'LAB',
      department: null,
      label: 'LAB',
      schemeColorHex: '#FF0000',
      orderIndex: 0,
      advisoryCodes: [],
    },
    {
      programmeCode: null,
      department: 'Surgery',
      label: 'Surgery',
      schemeColorHex: '#0000FF',
      orderIndex: 1,
      advisoryCodes: [],
    },
  ],
  rowDigestSha256: 'a'.repeat(64),
  advisoryFindings: [],
};

describe('roomColorSchemeLegendReadoutParts', () => {
  it('returns empty for non-matching format', () => {
    expect(roomColorSchemeLegendReadoutParts(null)).toEqual([]);
    expect(roomColorSchemeLegendReadoutParts({ format: 'other' })).toEqual([]);
  });

  it('includes scheme identity, count and digest prefix', () => {
    const lines = roomColorSchemeLegendReadoutParts(BASE_EV);
    expect(lines.some((l) => l.includes('bim-room-color-scheme'))).toBe(true);
    expect(lines.some((l) => l.includes('overrideRowCount 2'))).toBe(true);
    const digestLine = lines.find((l) => l.startsWith('digest'));
    expect(digestLine).toBeDefined();
    expect(digestLine!.length).toBeLessThan(80);
  });

  it('includes warning count when present', () => {
    const ev = {
      ...BASE_EV,
      advisoryFindings: [
        {
          code: 'room_color_scheme_row_duplicate_override_key',
          severity: 'warning',
          message: 'dup',
        },
      ],
    };
    const lines = roomColorSchemeLegendReadoutParts(ev);
    expect(lines.some((l) => l.includes('warnings 1'))).toBe(true);
  });

  it('does not include warning line when no findings', () => {
    const lines = roomColorSchemeLegendReadoutParts(BASE_EV);
    expect(lines.some((l) => l.includes('warnings'))).toBe(false);
  });
});

describe('roomColorSchemeHasAdvisories', () => {
  it('returns false when no findings', () => {
    expect(roomColorSchemeHasAdvisories(BASE_EV)).toBe(false);
  });

  it('returns true when findings present', () => {
    const ev = {
      ...BASE_EV,
      advisoryFindings: [{ code: 'x', severity: 'info', message: 'm' }],
    };
    expect(roomColorSchemeHasAdvisories(ev)).toBe(true);
  });
});

describe('roomColorSchemeOverrideRowSummary', () => {
  it('maps rows to summary tokens', () => {
    const rows = roomColorSchemeOverrideRowSummary(BASE_EV);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.label).toBe('LAB');
    expect(rows[0]!.hex).toBe('#FF0000');
    expect(rows[0]!.hasAdvisory).toBe(false);
  });

  it('marks advisory rows', () => {
    const ev = {
      ...BASE_EV,
      rows: [
        { ...BASE_EV.rows[0]!, advisoryCodes: ['room_color_scheme_row_duplicate_override_key'] },
      ],
    };
    const rows = roomColorSchemeOverrideRowSummary(ev);
    expect(rows[0]!.hasAdvisory).toBe(true);
  });

  it('returns empty for non-matching input', () => {
    expect(roomColorSchemeOverrideRowSummary(null)).toEqual([]);
  });
});
