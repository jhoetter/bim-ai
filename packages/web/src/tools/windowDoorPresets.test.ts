import { describe, expect, it } from 'vitest';
import { WINDOW_PRESETS, DOOR_PRESETS } from './windowDoorPresets';

describe('windowDoorPresets — §3.6.2', () => {
  it('has at least 5 window presets', () => {
    expect(WINDOW_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it('has at least 3 door presets', () => {
    expect(DOOR_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it('all window presets have positive dimensions', () => {
    for (const p of WINDOW_PRESETS) {
      expect(p.widthMm).toBeGreaterThan(0);
      expect(p.heightMm).toBeGreaterThan(0);
    }
  });

  it('all door presets have positive dimensions', () => {
    for (const p of DOOR_PRESETS) {
      expect(p.widthMm).toBeGreaterThan(0);
      expect(p.heightMm).toBeGreaterThan(0);
    }
  });

  it('window preset IDs are unique', () => {
    const ids = WINDOW_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('door preset IDs are unique', () => {
    const ids = DOOR_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes casement window preset', () => {
    expect(WINDOW_PRESETS.some((p) => p.windowStyle === 'casement')).toBe(true);
  });

  it('includes sliding door preset', () => {
    expect(DOOR_PRESETS.some((p) => p.doorStyle === 'sliding')).toBe(true);
  });
});
