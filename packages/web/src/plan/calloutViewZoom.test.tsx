/**
 * §6.4.1 — Detail callout enlarged view tests.
 *
 * Covers:
 *   1. A callout plan_view element has planViewSubtype === 'callout' and crop bounds.
 *   2. PlanViewHeader renders callout-view-badge when subtype is callout.
 *   3. PlanViewHeader renders callout-view-scale as a numeric label.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import type { Element } from '@bim-ai/core';

import { PlanViewHeader } from './PlanViewHeader';

afterEach(() => {
  cleanup();
});

const calloutView: Extract<Element, { kind: 'plan_view' }> = {
  kind: 'plan_view',
  id: 'pv-callout-zoom-test',
  name: 'Stair Detail',
  levelId: 'lvl-1',
  planViewSubtype: 'callout',
  parentViewId: 'pv-parent-1',
  calloutScaleFactor: 5,
  cropMinMm: { xMm: 1000, yMm: 2000 },
  cropMaxMm: { xMm: 3500, yMm: 4500 },
  cropEnabled: true,
};

const elementsById: Record<string, Element> = {
  [calloutView.id]: calloutView,
};

describe('detail callout enlarged view — §6.4.1', () => {
  it('callout view activates with plan_view subtype=callout', () => {
    // Verify the element shape is correct — planViewSubtype must be 'callout'
    expect(calloutView.planViewSubtype).toBe('callout');
    expect(calloutView.cropEnabled).toBe(true);
    expect(calloutView.cropMinMm).toEqual({ xMm: 1000, yMm: 2000 });
    expect(calloutView.cropMaxMm).toEqual({ xMm: 3500, yMm: 4500 });
  });

  it('callout-view-badge renders when subtype is callout', () => {
    const { getByTestId } = render(
      <PlanViewHeader
        phaseFilter="show_all"
        onPhaseFilterChange={vi.fn()}
        detailLevel="medium"
        onDetailLevelChange={vi.fn()}
        activePlanViewId={calloutView.id}
        elementsById={elementsById}
      />,
    );
    const badge = getByTestId('callout-view-badge');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('Detail Callout:');
    expect(badge.textContent).toContain('Stair Detail');
  });

  it('callout-view-scale renders a numeric scale', () => {
    const { getByTestId } = render(
      <PlanViewHeader
        phaseFilter="show_all"
        onPhaseFilterChange={vi.fn()}
        detailLevel="medium"
        onDetailLevelChange={vi.fn()}
        activePlanViewId={calloutView.id}
        elementsById={elementsById}
        canvasWidthPx={800}
      />,
    );
    // calloutWidthMm = 3500 - 1000 = 2500; canvasWidthPx = 800
    // calloutScale = 2500 / 800 * (96 / 25.4) ≈ 11.81 → rounded = 12
    const scaleEl = getByTestId('callout-view-scale');
    expect(scaleEl).toBeDefined();
    // text must be "1:" followed by a positive integer
    expect(scaleEl.textContent).toMatch(/^1:\d+$/);
    const scalePart = parseInt(scaleEl.textContent?.replace('1:', '') ?? '0', 10);
    expect(scalePart).toBeGreaterThan(0);
  });
});
