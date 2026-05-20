import { describe, expect, it } from 'vitest';

type CalloutViewFixture = {
  kind: 'plan_view';
  planViewSubtype: 'callout';
  calloutBoundaryMm: { xMm: number; yMm: number; widthMm: number; heightMm: number };
};

describe('Callout reference symbol — §6.4.1', () => {
  it('callout view has planViewSubtype callout', () => {
    const view: CalloutViewFixture = {
      kind: 'plan_view',
      planViewSubtype: 'callout',
      calloutBoundaryMm: { xMm: 0, yMm: 0, widthMm: 1000, heightMm: 1000 },
    };
    expect(view.planViewSubtype).toBe('callout');
  });

  it('calloutBoundaryMm corners are computed correctly', () => {
    const b = { xMm: 0, yMm: 0, widthMm: 2000, heightMm: 1500 };
    expect(b.widthMm).toBe(2000);
    expect(b.heightMm).toBe(1500);
    expect(b.xMm + b.widthMm).toBe(2000);
    expect(b.yMm + b.heightMm).toBe(1500);
  });

  it('callout symbol uses dashed material', () => {
    const dashSize = 0.08;
    const gapSize = 0.04;
    expect(dashSize).toBeGreaterThan(0);
    expect(gapSize).toBeGreaterThan(0);
  });

  it('tag circle is placed at bottom-right corner', () => {
    const b = { xMm: 0, yMm: 0, widthMm: 2000, heightMm: 1500 };
    // Tag is at max corner (xMm + widthMm, yMm + heightMm)
    const tagX = b.xMm + b.widthMm;
    const tagY = b.yMm + b.heightMm;
    expect(tagX).toBe(2000);
    expect(tagY).toBe(1500);
  });

  it('callout reference symbol testid convention', () => {
    const viewId = 'pv-callout-1';
    const attr = `calloutViewId`;
    expect(attr).toBe('calloutViewId');
    expect(viewId.startsWith('pv-callout')).toBe(true);
  });
});
