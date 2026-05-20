import { describe, expect, it } from 'vitest';

import { coerceElement } from '../storeCoercion';

describe('coordination element coercion', () => {
  it('coerces clash tests from snake_case input and filters invalid id lists', () => {
    const element = coerceElement('clash-1', {
      kind: 'clash_test',
      name: 'Coordination',
      set_a_ids: ['walls', 42, 'floors'],
      set_b_ids: ['ducts', null, 'pipes'],
      tolerance_mm: '75',
      results: [
        {
          element_id_a: 'wall-1',
          element_id_b: 'duct-1',
          distance_mm: '12',
          link_chain_a: ['link-a', 99],
          link_chain_b: ['link-b'],
        },
      ],
    });

    expect(element?.kind).toBe('clash_test');
    if (element?.kind !== 'clash_test') return;
    expect(element.setAIds).toEqual(['walls', 'floors']);
    expect(element.setBIds).toEqual(['ducts', 'pipes']);
    expect(element.toleranceMm).toBe(75);
    expect(element.results).toEqual([
      {
        elementIdA: 'wall-1',
        elementIdB: 'duct-1',
        distanceMm: 12,
        linkChainA: ['link-a'],
        linkChainB: ['link-b'],
      },
    ]);
  });

  it('defaults invalid clash test values predictably', () => {
    const element = coerceElement('clash-2', {
      kind: 'clash_test',
      name: 'Defaults',
      setAIds: 'not-list',
      setBIds: ['ok'],
      toleranceMm: 'bad',
      results: [{ elementIdA: 'a', elementIdB: 'b', distanceMm: 'bad' }, 'skip'],
    });

    expect(element?.kind).toBe('clash_test');
    if (element?.kind !== 'clash_test') return;
    expect(element.setAIds).toEqual([]);
    expect(element.setBIds).toEqual(['ok']);
    expect(element.toleranceMm).toBe(50);
    expect(element.results).toEqual([{ elementIdA: 'a', elementIdB: 'b', distanceMm: 0 }]);
  });
});
