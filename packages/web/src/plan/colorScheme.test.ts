/**
 * D8 - Color Fill Scheme: unit tests.
 */

import { describe, expect, it } from 'vitest';

import { buildColorFillLegend } from './colorFillLegend';
import { deterministicSchemeColorHex } from './roomSchemeColor';

describe('D8 - buildColorFillLegend', () => {
  it('returns rows sorted alphabetically by value', () => {
    const colorMap = {
      Bedroom: '#ff0000',
      Kitchen: '#00ff00',
      Bathroom: '#0000ff',
    };
    const rows = buildColorFillLegend(colorMap);
    expect(rows.map((r) => r.value)).toEqual(['Bathroom', 'Bedroom', 'Kitchen']);
  });

  it('maps each entry to { value, color, label } where label equals value', () => {
    const colorMap = { LivingRoom: '#aabbcc' };
    const rows = buildColorFillLegend(colorMap);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ value: 'LivingRoom', color: '#aabbcc', label: 'LivingRoom' });
  });

  it('returns empty array for empty colorMap', () => {
    expect(buildColorFillLegend({})).toEqual([]);
  });
});

describe('D8 - By Name scheme: distinct colors', () => {
  it('assigns distinct deterministic colors to 3 different room names', () => {
    const names = ['Bedroom', 'Kitchen', 'Bathroom'];
    const colors = names.map((n) => deterministicSchemeColorHex(n));
    // All three should be valid hex colors
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    // All three should be distinct
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(3);
  });

  it('same room name always produces the same color (deterministic)', () => {
    const color1 = deterministicSchemeColorHex('MasterBedroom');
    const color2 = deterministicSchemeColorHex('MasterBedroom');
    expect(color1).toBe(color2);
  });

  it('buildColorFillLegend rows match the colorMap entries', () => {
    const colorMap: Record<string, string> = {
      Office: '#123456',
      Corridor: '#654321',
    };
    const rows = buildColorFillLegend(colorMap);
    for (const row of rows) {
      expect(row.color).toBe(colorMap[row.value]);
      expect(row.label).toBe(row.value);
    }
  });
});
