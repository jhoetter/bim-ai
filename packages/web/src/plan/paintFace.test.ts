import { describe, expect, it } from 'vitest';

/**
 * Unit tests for the paint_face command logic — §3.3.4.
 *
 * The Workspace handler applies the same pattern used here:
 *   spread existing overrides, set/delete the keyed entry, persist non-empty record or null.
 */
function applyPaintFace(
  existing: Record<string, string> | null | undefined,
  faceId: string,
  materialId: string | null,
): Record<string, string> | null {
  const overrides: Record<string, string> = { ...(existing ?? {}) };
  if (materialId === null) {
    delete overrides[faceId];
  } else {
    overrides[faceId] = materialId;
  }
  return Object.keys(overrides).length > 0 ? overrides : null;
}

describe('paintFace command — §3.3.4', () => {
  it('sets faceMaterialOverrides on element', () => {
    const result = applyPaintFace(null, 'top', 'mat-concrete');
    expect(result).toEqual({ top: 'mat-concrete' });
  });

  it('preserves other face overrides when painting one face', () => {
    const existing = { top: 'mat-tile', bottom: 'mat-concrete' };
    const result = applyPaintFace(existing, 'front', 'mat-brick');
    expect(result).toEqual({ top: 'mat-tile', bottom: 'mat-concrete', front: 'mat-brick' });
  });

  it('null materialId clears the override', () => {
    const existing = { top: 'mat-tile', bottom: 'mat-concrete' };
    const result = applyPaintFace(existing, 'top', null);
    expect(result).toEqual({ bottom: 'mat-concrete' });
  });

  it('clearing the last override returns null', () => {
    const existing = { top: 'mat-tile' };
    const result = applyPaintFace(existing, 'top', null);
    expect(result).toBeNull();
  });
});
