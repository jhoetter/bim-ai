import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  elementPassesCostQuantityLens,
  elementPassesFireSafetyLens,
  lensFilterFromMode,
  resolveLensFilter,
} from './useLensFilter';

describe('lensFilterFromMode', () => {
  it('foregrounds shared architectural and MEP fire-safety hosts', () => {
    expect(
      elementPassesFireSafetyLens({
        kind: 'wall',
        id: 'w1',
        name: 'Rated wall',
        levelId: 'l1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1000, yMm: 0 },
      } as Element),
    ).toBe(true);
    expect(
      elementPassesFireSafetyLens({
        kind: 'duct',
        id: 'd1',
        levelId: 'l1',
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 1000, yMm: 0 },
      } as Element),
    ).toBe(true);
  });

  it('foregrounds custom review markers with fire-safety props', () => {
    const generic = {
      kind: 'generic_model',
      id: 'g1',
      name: 'Inspection marker',
      props: { firestopStatus: 'approved' },
    } as unknown as Element;
    expect(elementPassesFireSafetyLens(generic)).toBe(true);
  });

  it('ghosts unrelated elements in UI and saved-view fire-safety lens modes', () => {
    const column = {
      kind: 'column',
      id: 'c1',
      name: 'Column',
      levelId: 'l1',
      center: { xMm: 0, yMm: 0 },
    } as unknown as Element;

    expect(lensFilterFromMode('fire-safety')(column)).toBe('ghost');
    expect(resolveLensFilter({ defaultLens: 'show_fire_safety' })(column)).toBe('ghost');
  });

  it('foregrounds construction metadata and temporary works in construction lens', () => {
    const filter = lensFilterFromMode('construction');
    const wall = {
      kind: 'wall',
      id: 'wall-1',
      name: 'Wall',
      levelId: 'lvl',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
      props: { construction: { progressStatus: 'installed' } },
    } satisfies Element;
    const logistics = {
      kind: 'construction_logistics',
      id: 'log-1',
      name: 'Crane',
      logisticsKind: 'crane_lift_zone',
    } satisfies Element;
    const room = {
      kind: 'room',
      id: 'room-1',
      name: 'Room',
      levelId: 'lvl',
      outlineMm: [],
    } satisfies Element;

    expect(filter(wall)).toBe('foreground');
    expect(filter(logistics)).toBe('foreground');
    expect(filter(room)).toBe('ghost');
  });
});

describe('cost-quantity lens filter', () => {
  it('foregrounds model-derived takeoff elements and cost-classified custom items', () => {
    expect(
      elementPassesCostQuantityLens({
        kind: 'floor',
        id: 'f1',
        name: 'Slab',
        levelId: 'l1',
        boundary: [],
      } as unknown as Element),
    ).toBe(true);

    expect(
      elementPassesCostQuantityLens({
        kind: 'generic_model',
        id: 'allowance-1',
        name: 'Allowance',
        props: { cost: { costGroup: '700', workPackage: 'Site' } },
      } as unknown as Element),
    ).toBe(true);
  });

  it('ghosts unrelated elements in UI and saved-view cost lens modes', () => {
    const column = {
      kind: 'column',
      id: 'c1',
      name: 'Column',
      levelId: 'l1',
      center: { xMm: 0, yMm: 0 },
    } as unknown as Element;

    expect(lensFilterFromMode('cost-quantity')(column)).toBe('ghost');
    expect(resolveLensFilter({ defaultLens: 'show_cost_quantity' })(column)).toBe('ghost');
  });
});
