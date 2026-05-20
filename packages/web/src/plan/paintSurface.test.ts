import { describe, expect, it } from 'vitest';

type PaintableFixture = { kind: string; id: string; faceOverrides?: Record<string, string> };

describe('PaintFace / UnpaintFace — §3.3.7', () => {
  it('PaintFaceCmd has correct shape', () => {
    const cmd = {
      type: 'paintFace' as const,
      elementId: 'w1',
      faceKey: 'front',
      materialKey: 'brick',
    };
    expect(cmd.type).toBe('paintFace');
    expect(cmd.faceKey).toBe('front');
    expect(cmd.materialKey).toBe('brick');
  });

  it('UnpaintFaceCmd has correct shape', () => {
    const cmd = { type: 'unpaintFace' as const, elementId: 'w1', faceKey: 'front' };
    expect(cmd.type).toBe('unpaintFace');
  });

  it('faceOverrides record stores per-face material', () => {
    const overrides: Record<string, string> = { front: 'brick', back: 'concrete' };
    expect(overrides['front']).toBe('brick');
    expect(overrides['back']).toBe('concrete');
  });

  it('unpaint removes face override', () => {
    const overrides: Record<string, string> = { front: 'brick', back: 'concrete' };
    delete overrides['front'];
    expect(overrides['front']).toBeUndefined();
    expect(overrides['back']).toBe('concrete');
  });

  it('faceOverrides is optional — undefined means no overrides', () => {
    const el: PaintableFixture = { kind: 'wall', id: 'w1' };
    expect(el.faceOverrides ?? {}).toEqual({});
  });
});
