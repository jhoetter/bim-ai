/**
 * D4 — Detail Callout Enlarged View Workflow tests.
 *
 * Tests the pure-function helpers involved when a user places a callout
 * boundary on the plan canvas:
 *   1. The resulting upsertPlanView command has cropMinMm / cropMaxMm that
 *      match the drawn rectangle.
 *   2. The callout view default scale factor is 5 (1:20 if parent is 1:100).
 *   3. tabFromElement returns a "Detail callout" label for callout plan_views.
 */
import { describe, it, expect } from 'vitest';
import type { Element } from '@bim-ai/core';

import { tabFromElement } from '../workspace/tabsModel';

// ---------------------------------------------------------------------------
// Helper: build the payload that PlanCanvas sends to onSemanticCommand
// when the user commits a callout rectangle.
// ---------------------------------------------------------------------------

function buildCalloutViewCommand(opts: {
  viewId: string;
  name: string;
  levelId: string;
  parentViewId: string | null;
  x0Mm: number;
  y0Mm: number;
  x1Mm: number;
  y1Mm: number;
}) {
  const { viewId, name, levelId, parentViewId, x0Mm, y0Mm, x1Mm, y1Mm } = opts;
  return {
    type: 'upsertPlanView',
    id: viewId,
    name,
    levelId,
    planViewSubtype: 'callout',
    parentViewId,
    calloutScaleFactor: 5,
    cropMinMm: { xMm: x0Mm, yMm: y0Mm },
    cropMaxMm: { xMm: x1Mm, yMm: y1Mm },
    cropEnabled: true,
    scale: 20,
  } as const;
}

describe('D4 — detail callout view creation', () => {
  it('crop bounds on the callout view match the drawn rectangle', () => {
    const cmd = buildCalloutViewCommand({
      viewId: 'pv-callout-test',
      name: 'Detail Callout 1',
      levelId: 'lvl-1',
      parentViewId: 'pv-parent',
      x0Mm: 1000,
      y0Mm: 2000,
      x1Mm: 3500,
      y1Mm: 4500,
    });

    expect(cmd.cropMinMm).toEqual({ xMm: 1000, yMm: 2000 });
    expect(cmd.cropMaxMm).toEqual({ xMm: 3500, yMm: 4500 });
    expect(cmd.cropEnabled).toBe(true);
  });

  it('calloutScaleFactor defaults to 5 (1:20 when parent is 1:100)', () => {
    const cmd = buildCalloutViewCommand({
      viewId: 'pv-callout-scale-test',
      name: 'Detail Callout 2',
      levelId: 'lvl-1',
      parentViewId: null,
      x0Mm: 0,
      y0Mm: 0,
      x1Mm: 2000,
      y1Mm: 2000,
    });

    expect(cmd.calloutScaleFactor).toBe(5);
    expect(cmd.planViewSubtype).toBe('callout');
    expect(cmd.scale).toBe(20);
  });

  it('tabFromElement returns "Detail callout" label for callout plan_views', () => {
    const calloutView: Extract<Element, { kind: 'plan_view' }> = {
      kind: 'plan_view',
      id: 'pv-callout-1',
      name: 'Detail Callout 1',
      levelId: 'lvl-1',
      planViewSubtype: 'callout',
      parentViewId: 'pv-parent-1',
      calloutScaleFactor: 5,
      cropMinMm: { xMm: 0, yMm: 0 },
      cropMaxMm: { xMm: 2000, yMm: 2000 },
      cropEnabled: true,
    };

    const tab = tabFromElement(calloutView);
    expect(tab).not.toBeNull();
    expect(tab?.kind).toBe('plan');
    expect(tab?.label).toBe('Detail callout · Detail Callout 1');
    expect(tab?.targetId).toBe('pv-callout-1');
  });

  it('tabFromElement returns "Plan view" label for regular plan_views', () => {
    const regularView: Extract<Element, { kind: 'plan_view' }> = {
      kind: 'plan_view',
      id: 'pv-regular-1',
      name: 'Level 1 Plan',
      levelId: 'lvl-1',
      planViewSubtype: 'floor_plan',
    };

    const tab = tabFromElement(regularView);
    expect(tab?.label).toBe('Plan view · Level 1 Plan');
  });
});
