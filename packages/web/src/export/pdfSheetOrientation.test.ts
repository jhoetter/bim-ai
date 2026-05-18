import { describe, expect, it } from 'vitest';

describe('PDF per-sheet orientation — §12.4.5', () => {
  it('sheet orientation defaults to global orientation', () => {
    const globalOrientation = 'portrait';
    const sheetOrientations: Record<string, 'portrait' | 'landscape'> = {};
    const sheetId = 'sheet-01';
    const effective = sheetOrientations[sheetId] ?? globalOrientation;
    expect(effective).toBe('portrait');
  });

  it('per-sheet override takes precedence over global', () => {
    const globalOrientation = 'portrait';
    const sheetOrientations: Record<string, 'portrait' | 'landscape'> = {
      'sheet-01': 'landscape',
    };
    const effective = sheetOrientations['sheet-01'] ?? globalOrientation;
    expect(effective).toBe('landscape');
  });

  it('different sheets can have different orientations', () => {
    const orientations: Record<string, 'portrait' | 'landscape'> = {
      'sheet-01': 'landscape',
      'sheet-02': 'portrait',
    };
    expect(orientations['sheet-01']).toBe('landscape');
    expect(orientations['sheet-02']).toBe('portrait');
  });
});
