import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { buildPlanOverlay3dGroup, resolvePlanOverlaySource } from './planOverlay3d';

const COLORS = {
  sheetColor: 'white',
  lineColor: 'black',
  roomColor: 'blue',
  openingColor: 'orange',
  assetColor: 'green',
  stairColor: 'red',
  witnessColor: 'gray',
};

function fixtureElements(): Record<string, Element> {
  return {
    lv1: { kind: 'level', id: 'lv1', name: 'Level 1', elevationMm: 0 },
    pv1: { kind: 'plan_view', id: 'pv1', name: 'Level 1 Plan', levelId: 'lv1' },
    w1: {
      kind: 'wall',
      id: 'w1',
      name: 'North wall',
      levelId: 'lv1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    },
    d1: { kind: 'door', id: 'd1', name: 'Door', wallId: 'w1', alongT: 0.5, widthMm: 900 },
    rm1: {
      kind: 'room',
      id: 'rm1',
      name: 'Living',
      levelId: 'lv1',
      outlineMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
        { xMm: 4000, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ],
    },
    s1: {
      kind: 'stair',
      id: 's1',
      name: 'Stair',
      baseLevelId: 'lv1',
      topLevelId: 'lv1',
      runStartMm: { xMm: 500, yMm: 500 },
      runEndMm: { xMm: 2500, yMm: 500 },
      widthMm: 900,
      riserMm: 175,
      treadMm: 280,
    },
    a1: {
      kind: 'placed_asset',
      id: 'a1',
      name: 'Table',
      assetId: 'table',
      levelId: 'lv1',
      positionMm: { xMm: 2000, yMm: 1500 },
      rotationDeg: 30,
      paramValues: { widthMm: 1200, depthMm: 800 },
    },
    vp1: {
      kind: 'viewpoint',
      id: 'vp1',
      name: 'Overlay',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 0, yMm: 0, zMm: 5000 },
        target: { xMm: 0, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 0, zMm: 1000 },
      },
      planOverlayEnabled: true,
      planOverlaySourcePlanViewId: 'pv1',
      planOverlayOffsetMm: 4200,
      planOverlayWitnessLinesVisible: true,
    },
  };
}

describe('planOverlay3d', () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
      fillStyle: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  it('resolves the requested source plan view with fallback to the first plan', () => {
    const elements = fixtureElements();
    const vp = elements.vp1 as Extract<Element, { kind: 'viewpoint' }>;
    expect(resolvePlanOverlaySource(elements, vp)?.id).toBe('pv1');
    expect(
      resolvePlanOverlaySource(elements, { ...vp, planOverlaySourcePlanViewId: 'missing' })?.id,
    ).toBe('pv1');
  });

  it('builds a non-pickable registered overlay with linework, fills, labels, and dashed witnesses', () => {
    const elements = fixtureElements();
    const vp = elements.vp1 as Extract<Element, { kind: 'viewpoint' }>;
    const group = buildPlanOverlay3dGroup(elements, vp, COLORS);

    expect(group).toBeTruthy();
    expect(group?.userData.planOverlay3d).toBe(true);
    expect(group?.userData.sourcePlanViewId).toBe('pv1');
    expect(group?.children.length).toBeGreaterThan(4);
    expect(group?.children.some((child) => child instanceof THREE.Sprite)).toBe(true);
    expect(
      group?.children.some(
        (child) =>
          child instanceof THREE.LineSegments && child.material instanceof THREE.LineDashedMaterial,
      ),
    ).toBe(true);
    expect(group?.children.some((child) => child.userData.bimPickId)).toBe(false);
  });

  it('returns null when the saved viewpoint has the overlay disabled', () => {
    const elements = fixtureElements();
    const vp = elements.vp1 as Extract<Element, { kind: 'viewpoint' }>;
    expect(
      buildPlanOverlay3dGroup(elements, { ...vp, planOverlayEnabled: false }, COLORS),
    ).toBeNull();
  });
});
