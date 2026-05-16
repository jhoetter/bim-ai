import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element, WallTypeLayer } from '@bim-ai/core';

import { WallTypeLayerEditor } from './WallTypeLayerEditor';

afterEach(cleanup);

type WallTypeEl = Extract<Element, { kind: 'wall_type' }>;

function makeWallType(layers?: WallTypeLayer[]): WallTypeEl {
  return {
    kind: 'wall_type',
    id: 'wt-priority-test',
    name: 'Priority Test Wall',
    layers: layers ?? [
      { thicknessMm: 200, function: 'structure', materialKey: 'concrete', priority: 1 },
      { thicknessMm: 13, function: 'finish', materialKey: 'plaster', priority: 5 },
    ],
    basisLine: 'center',
  };
}

describe('WallTypeLayerEditor priority column — §2.4.4', () => {
  it('renders layer-priority-0 select for first layer', () => {
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType()} onUpdate={() => undefined} />,
    );
    expect(getByTestId('layer-priority-0')).toBeDefined();
  });

  it('priority select has options 1 through 5', () => {
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType()} onUpdate={() => undefined} />,
    );
    const select = getByTestId('layer-priority-0') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['1', '2', '3', '4', '5']);
  });

  it('changing priority updates draft layer', () => {
    const onUpdate = vi.fn();
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType()} onUpdate={onUpdate} />,
    );
    const select = getByTestId('layer-priority-0') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '4' } });
    expect(onUpdate).toHaveBeenCalledOnce();
    const patch = onUpdate.mock.calls[0][0] as { layers: WallTypeLayer[] };
    expect(patch.layers[0].priority).toBe(4);
  });

  it('defaults to priority 3 when layer priority is null', () => {
    const layers: WallTypeLayer[] = [
      { thicknessMm: 100, function: 'structure', materialKey: null, priority: null },
    ];
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType(layers)} onUpdate={() => undefined} />,
    );
    const select = getByTestId('layer-priority-0') as HTMLSelectElement;
    expect(select.value).toBe('3');
  });
});
