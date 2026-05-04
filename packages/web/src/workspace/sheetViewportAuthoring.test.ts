import { describe, expect, it } from 'vitest';

import {
  fingerprintViewportFallback,
  normalizeViewportRaw,
  readViewportMmBox,
} from './sheetViewportAuthoring';

describe('normalizeViewportRaw', () => {
  it('is deterministic across repeated runs when viewportId is omitted', () => {
    const raw = {
      label: 'Plan',
      viewRef: 'plan:pv-1',
      xMm: 100,
      yMm: 200,
      widthMm: 3000,
      heightMm: 4000,
    };

    const a = normalizeViewportRaw(raw, 0);
    const b = normalizeViewportRaw(raw, 0);
    expect(a).toEqual(b);
    expect(a.viewportId).toMatch(/^vp-0-/);
  });

  it('preserves explicit viewportId', () => {
    const d = normalizeViewportRaw(
      { viewportId: 'vp-explicit', xMm: 0, yMm: 0, widthMm: 10, heightMm: 10, viewRef: '' },
      99,
    );
    expect(d.viewportId).toBe('vp-explicit');
  });

  it('uses index in fallback ids so order is stable', () => {
    const row = { xMm: 1, yMm: 2, widthMm: 10, heightMm: 10, viewRef: 'a' };
    const d0 = normalizeViewportRaw(row, 0);
    const d1 = normalizeViewportRaw(row, 1);
    expect(d0.viewportId).not.toBe(d1.viewportId);
  });

  it('accepts legacy wMm and hMm aliases for width and height', () => {
    const box = readViewportMmBox({
      xMm: 1,
      yMm: 2,
      wMm: 220,
      hMm: 170,
      viewRef: 'plan:a',
    });
    expect(box.widthMm).toBe(220);
    expect(box.heightMm).toBe(170);
  });
});

describe('fingerprintViewportFallback', () => {
  it('matches expected hash for a fixed input', () => {
    expect(fingerprintViewportFallback(0, 1, 2, 3, 4, 'plan:x')).toBe(
      fingerprintViewportFallback(0, 1, 2, 3, 4, 'plan:x'),
    );
  });
});
