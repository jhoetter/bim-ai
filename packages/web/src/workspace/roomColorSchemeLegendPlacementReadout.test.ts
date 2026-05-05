import { describe, expect, it } from 'vitest';

import {
  formatPlacedLegendCell,
  hasPlacedLegends,
  roomColorSchemeLegendPlacementReadoutLines,
  type RoomColorSchemePlacedRow,
} from './roomColorSchemeLegendPlacementReadout';

const PLACED_ROW: RoomColorSchemePlacedRow = {
  viewportId: 'vp-plan',
  planViewRef: 'pv-1',
  placementXMm: 50,
  placementYMm: 100,
  viewportWidthMm: 4000,
  viewportHeightMm: 3000,
  legendRowCount: 3,
  legendDigestSha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  schemeSource: 'override',
  schemeIdentity: 'bim-room-color-scheme',
  schemeOverrideRowCount: 2,
};

const BASE_EV = {
  format: 'roomColorSchemeLegendPlacementEvidence_v1' as const,
  placedLegendCount: 1,
  placementDigestSha256: 'b'.repeat(64),
  schemeIdentity: 'bim-room-color-scheme',
  schemeOverrideRowCount: 2,
  placedRows: [PLACED_ROW],
};

describe('roomColorSchemeLegendPlacementReadoutLines', () => {
  it('returns empty for non-matching format', () => {
    expect(roomColorSchemeLegendPlacementReadoutLines(null)).toEqual([]);
    expect(roomColorSchemeLegendPlacementReadoutLines({ format: 'other' })).toEqual([]);
  });

  it('includes scheme identity, placed count and digest prefix', () => {
    const lines = roomColorSchemeLegendPlacementReadoutLines(BASE_EV);
    expect(lines.some((l) => l.includes('bim-room-color-scheme'))).toBe(true);
    expect(lines.some((l) => l.includes('placedLegends 1'))).toBe(true);
    expect(lines.some((l) => l.includes('schemeOverrideRowCount 2'))).toBe(true);
    const digestLine = lines.find((l) => l.startsWith('digest'));
    expect(digestLine).toBeDefined();
  });

  it('includes a row line for each placed viewport', () => {
    const lines = roomColorSchemeLegendPlacementReadoutLines(BASE_EV);
    expect(lines.some((l) => l.includes('vp=vp-plan'))).toBe(true);
    expect(lines.some((l) => l.includes('legendRows=3'))).toBe(true);
    expect(lines.some((l) => l.includes('src=override'))).toBe(true);
    expect(lines.some((l) => l.includes('plan=pv-1'))).toBe(true);
  });

  it('shows hash_fallback src for hashed rows', () => {
    const ev = {
      ...BASE_EV,
      placedRows: [{ ...PLACED_ROW, schemeSource: 'hashed_fallback' as const }],
    };
    const lines = roomColorSchemeLegendPlacementReadoutLines(ev);
    expect(lines.some((l) => l.includes('src=hash'))).toBe(true);
  });

  it('handles no placed rows', () => {
    const ev = { ...BASE_EV, placedLegendCount: 0, placedRows: [] };
    const lines = roomColorSchemeLegendPlacementReadoutLines(ev);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.includes('placedLegends 0'))).toBe(true);
  });
});

describe('formatPlacedLegendCell', () => {
  it('formats a compact cell token', () => {
    const cell = formatPlacedLegendCell(PLACED_ROW);
    expect(cell).toContain('n=3');
    expect(cell).toContain('src=override');
    expect(cell).toContain('sha=abcdef12');
  });
});

describe('hasPlacedLegends', () => {
  it('returns true when count > 0', () => {
    expect(hasPlacedLegends(BASE_EV)).toBe(true);
  });

  it('returns false for empty or non-matching', () => {
    expect(hasPlacedLegends(null)).toBe(false);
    expect(hasPlacedLegends({ format: 'roomColorSchemeLegendPlacementEvidence_v1', placedLegendCount: 0, placedRows: [] })).toBe(false);
  });
});

describe('ordering stability', () => {
  it('digest readout is deterministic across repeated calls', () => {
    const lines1 = roomColorSchemeLegendPlacementReadoutLines(BASE_EV);
    const lines2 = roomColorSchemeLegendPlacementReadoutLines(BASE_EV);
    expect(lines1).toEqual(lines2);
  });
});
