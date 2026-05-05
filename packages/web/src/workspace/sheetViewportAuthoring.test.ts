import { describe, expect, it } from 'vitest';

import {
  clampViewportMmBox,
  clampViewportMmPosition,
  fingerprintViewportFallback,
  normalizeViewportRaw,
  parsePlanViewRefId,
  readViewportMmBox,
  readViewportPresentationMeta,
  sheetViewportsMmFromDrafts,
} from './sheetViewportAuthoring';

describe('clampViewportMmPosition', () => {
  it('clamps negative origin to zero', () => {
    expect(
      clampViewportMmPosition(42000, 29700, {
        xMm: -100,
        yMm: -50,
        widthMm: 2000,
        heightMm: 1500,
      }),
    ).toEqual({ xMm: 0, yMm: 0 });
  });

  it('clamps bottom-right overflow inside paper', () => {
    expect(
      clampViewportMmPosition(42000, 29700, {
        xMm: 41000,
        yMm: 29200,
        widthMm: 3000,
        heightMm: 2000,
      }),
    ).toEqual({ xMm: 39000, yMm: 27700 });
  });
});

describe('clampViewportMmBox', () => {
  it('enforces minimum 10 mm edges and keeps rect inside paper', () => {
    expect(
      clampViewportMmBox(42000, 29700, { xMm: 41990, yMm: 29690, widthMm: 5, heightMm: 5 }),
    ).toEqual({
      xMm: 41990,
      yMm: 29690,
      widthMm: 10,
      heightMm: 10,
    });
  });

  it('shrinks overflowing dimensions and clamps origin so rect fits paper', () => {
    const b = clampViewportMmBox(1000, 800, { xMm: 900, yMm: 700, widthMm: 5000, heightMm: 5000 });
    expect(b.xMm + b.widthMm).toBeLessThanOrEqual(1000);
    expect(b.yMm + b.heightMm).toBeLessThanOrEqual(800);
    expect(b.widthMm).toBeGreaterThanOrEqual(10);
    expect(b.heightMm).toBeGreaterThanOrEqual(10);
  });
});

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
    expect(a.cropMinMm).toBe(null);
    expect(a.cropMaxMm).toBe(null);
  });

  it('parses snake_case crop aliases when both corners are present', () => {
    const d = normalizeViewportRaw(
      {
        xMm: 0,
        yMm: 0,
        widthMm: 50,
        heightMm: 50,
        viewRef: '',
        crop_min_mm: { x_mm: 1.5, y_mm: -2 },
        cropMaxMm: { xMm: 9, yMm: 8 },
      },
      0,
    );
    expect(d.cropMinMm).toEqual({ xMm: 1.5, yMm: -2 });
    expect(d.cropMaxMm).toEqual({ xMm: 9, yMm: 8 });
  });

  it('drops incomplete crop corners', () => {
    const d = normalizeViewportRaw(
      {
        xMm: 0,
        yMm: 0,
        widthMm: 50,
        heightMm: 50,
        viewRef: '',
        cropMinMm: { xMm: 1, yMm: 2 },
      },
      0,
    );
    expect(d.cropMinMm).toBe(null);
    expect(d.cropMaxMm).toBe(null);
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

  it('hydrates detail number, scale, and lock from camelCase and snake_case aliases', () => {
    const d = normalizeViewportRaw(
      {
        xMm: 0,
        yMm: 0,
        widthMm: 10,
        heightMm: 10,
        viewRef: 'plan:x',
        detail_number: '  A3 ',
        scale: ' 1:75 ',
        viewport_locked: true,
      },
      0,
    );
    expect(d.detailNumber).toBe('A3');
    expect(d.scale).toBe('1:75');
    expect(d.viewportLocked).toBe(true);
  });
});

describe('readViewportPresentationMeta', () => {
  it('reads locked from locked alias and coerces strings', () => {
    expect(readViewportPresentationMeta({ locked: 'true', scale: '1:50' })).toEqual({
      detailNumber: '',
      scale: '1:50',
      viewportLocked: true,
    });
  });
});

describe('sheetViewportsMmFromDrafts', () => {
  it('serializes crop only when both corners are set', () => {
    const base = {
      label: '',
      viewRef: '',
      detailNumber: '',
      scale: '',
      viewportLocked: false,
      xMm: 0,
      yMm: 0,
      widthMm: 10,
      heightMm: 10,
    };
    const rows = sheetViewportsMmFromDrafts([
      {
        viewportId: 'a',
        ...base,
        cropMinMm: { xMm: 1, yMm: 2 },
        cropMaxMm: { xMm: 3, yMm: 4 },
      },
      {
        viewportId: 'b',
        ...base,
        cropMinMm: { xMm: 1, yMm: 2 },
        cropMaxMm: null,
      },
    ]);
    expect(rows[0]).toMatchObject({
      cropMinMm: { xMm: 1, yMm: 2 },
      cropMaxMm: { xMm: 3, yMm: 4 },
    });
    expect('cropMinMm' in rows[1]).toBe(false);
    expect('cropMaxMm' in rows[1]).toBe(false);
  });

  it('omits blank detail and scale; emits viewportLocked only when true', () => {
    const rows = sheetViewportsMmFromDrafts([
      {
        viewportId: 'z',
        label: 'V',
        viewRef: 'plan:p1',
        detailNumber: '  ',
        scale: '',
        viewportLocked: false,
        xMm: 1,
        yMm: 2,
        widthMm: 100,
        heightMm: 100,
        cropMinMm: null,
        cropMaxMm: null,
      },
      {
        viewportId: 'w',
        label: 'W',
        viewRef: 'section:s1',
        detailNumber: '2',
        scale: '1:100',
        viewportLocked: true,
        xMm: 0,
        yMm: 0,
        widthMm: 10,
        heightMm: 10,
        cropMinMm: null,
        cropMaxMm: null,
      },
    ]);
    expect(rows[0]).not.toHaveProperty('detailNumber');
    expect(rows[0]).not.toHaveProperty('scale');
    expect(rows[0]).not.toHaveProperty('viewportLocked');
    expect(rows[1]).toMatchObject({
      detailNumber: '2',
      scale: '1:100',
      viewportLocked: true,
    });
  });
});

describe('parsePlanViewRefId', () => {
  it('extracts trailing id segment', () => {
    expect(parsePlanViewRefId('plan: pv-99 ')).toBe('pv-99');
    expect(parsePlanViewRefId('schedule:s1')).toBe(null);
  });
});

describe('fingerprintViewportFallback', () => {
  it('matches expected hash for a fixed input', () => {
    expect(fingerprintViewportFallback(0, 1, 2, 3, 4, 'plan:x')).toBe(
      fingerprintViewportFallback(0, 1, 2, 3, 4, 'plan:x'),
    );
  });
});
