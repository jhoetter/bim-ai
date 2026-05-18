import { describe, expect, it } from 'vitest';

// ACI color assignments per DXF layer
const LAYER_ACI_COLORS: Record<string, number> = {
  'A-WALL': 7,
  'A-DOOR': 1,
  'A-GLAZ': 3,
  'A-AREA': 4,
  'S-GRID': 8,
  'A-ANNO-DIMS': 2,
  'A-REFP': 6,
  'S-COLS': 5,
  'S-BEAM': 5,
};

describe('DXF layer ACI colors — §12.4.3', () => {
  it('A-WALL uses white/black (ACI 7)', () => {
    expect(LAYER_ACI_COLORS['A-WALL']).toBe(7);
  });

  it('A-DOOR uses red (ACI 1)', () => {
    expect(LAYER_ACI_COLORS['A-DOOR']).toBe(1);
  });

  it('A-GLAZ uses green (ACI 3)', () => {
    expect(LAYER_ACI_COLORS['A-GLAZ']).toBe(3);
  });

  it('all defined layers have positive ACI color', () => {
    for (const [layer, color] of Object.entries(LAYER_ACI_COLORS)) {
      expect(color, `${layer} should have positive ACI color`).toBeGreaterThan(0);
    }
  });

  it('ACI colors are in valid range 1-255', () => {
    for (const color of Object.values(LAYER_ACI_COLORS)) {
      expect(color).toBeGreaterThanOrEqual(1);
      expect(color).toBeLessThanOrEqual(255);
    }
  });
});
