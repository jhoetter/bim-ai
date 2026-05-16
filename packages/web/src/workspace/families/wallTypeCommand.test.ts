import { describe, expect, it } from 'vitest';
import type { Element, UpdateWallTypeCmd, WallTypeLayer } from '@bim-ai/core';

type WallTypeEl = Extract<Element, { kind: 'wall_type' }>;

function applyUpdateWallType(
  elementsById: Record<string, Element>,
  cmd: UpdateWallTypeCmd,
): Record<string, Element> {
  return {
    ...elementsById,
    [cmd.id]: { ...elementsById[cmd.id], ...cmd.patch },
  };
}

function makeWallType(overrides: Partial<WallTypeEl> = {}): WallTypeEl {
  return {
    kind: 'wall_type',
    id: 'wt1',
    name: 'Original',
    layers: [{ thicknessMm: 200, function: 'structure', materialKey: null }],
    ...overrides,
  };
}

describe('update_wall_type command — §1.6.7', () => {
  it('patches name on wall_type element', () => {
    const elements: Record<string, Element> = { wt1: makeWallType() };
    const result = applyUpdateWallType(elements, {
      type: 'update_wall_type',
      id: 'wt1',
      patch: { name: 'Renamed' },
    });
    expect((result.wt1 as WallTypeEl).name).toBe('Renamed');
  });

  it('patches layers on wall_type element', () => {
    const elements: Record<string, Element> = { wt1: makeWallType() };
    const newLayers: WallTypeLayer[] = [
      { thicknessMm: 100, function: 'finish', materialKey: 'brick' },
      { thicknessMm: 200, function: 'structure', materialKey: null },
    ];
    const result = applyUpdateWallType(elements, {
      type: 'update_wall_type',
      id: 'wt1',
      patch: { layers: newLayers },
    });
    expect((result.wt1 as WallTypeEl).layers).toHaveLength(2);
    expect((result.wt1 as WallTypeEl).layers[0].function).toBe('finish');
  });

  it('does not affect other elements', () => {
    const otherEl: Extract<Element, { kind: 'level' }> = {
      kind: 'level',
      id: 'lv1',
      name: 'Level 1',
      elevationMm: 0,
    };
    const elements: Record<string, Element> = { wt1: makeWallType(), lv1: otherEl };
    const result = applyUpdateWallType(elements, {
      type: 'update_wall_type',
      id: 'wt1',
      patch: { name: 'Changed' },
    });
    expect(result.lv1).toBe(otherEl);
    expect((result.wt1 as WallTypeEl).name).toBe('Changed');
  });
});
