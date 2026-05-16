import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element, WallTypeLayer } from '@bim-ai/core';

import { WallTypeLayerEditor } from './WallTypeLayerEditor';

afterEach(cleanup);

type WallTypeEl = Extract<Element, { kind: 'wall_type' }>;

function makeWallType(overrides: Partial<WallTypeEl> = {}): WallTypeEl {
  return {
    kind: 'wall_type',
    id: 'wt1',
    name: 'Test Wall',
    layers: [
      { thicknessMm: 200, function: 'structure', materialKey: 'concrete' },
      { thicknessMm: 50, function: 'insulation', materialKey: null },
    ],
    basisLine: 'center',
    ...overrides,
  };
}

describe('WallTypeLayerEditor — §1.6.7', () => {
  it('renders wall-type-layer-editor', () => {
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType()} onUpdate={() => undefined} />,
    );
    expect(getByTestId('wall-type-layer-editor')).toBeDefined();
  });

  it('renders a row for each layer', () => {
    const el = makeWallType();
    const { getByTestId, queryByTestId } = render(
      <WallTypeLayerEditor typeElement={el} onUpdate={() => undefined} />,
    );
    expect(getByTestId('wall-type-layer-row-0')).toBeDefined();
    expect(getByTestId('wall-type-layer-row-1')).toBeDefined();
    expect(queryByTestId('wall-type-layer-row-2')).toBeNull();
  });

  it('add-layer button increases layer count', () => {
    const onUpdate = vi.fn();
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType()} onUpdate={onUpdate} />,
    );
    fireEvent.click(getByTestId('wall-type-add-layer'));
    expect(onUpdate).toHaveBeenCalledOnce();
    const patch = onUpdate.mock.calls[0][0] as { layers: WallTypeLayer[] };
    expect(patch.layers).toHaveLength(3);
    expect(patch.layers[2]).toMatchObject({ thicknessMm: 100, function: 'structure' });
  });

  it('delete-layer-0 removes first layer and calls onUpdate', () => {
    const onUpdate = vi.fn();
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType()} onUpdate={onUpdate} />,
    );
    fireEvent.click(getByTestId('wall-type-layer-delete-0'));
    expect(onUpdate).toHaveBeenCalledOnce();
    const patch = onUpdate.mock.calls[0][0] as { layers: WallTypeLayer[] };
    expect(patch.layers).toHaveLength(1);
    expect(patch.layers[0].function).toBe('insulation');
  });

  it('thickness input change calls onUpdate with new layers', () => {
    const onUpdate = vi.fn();
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType()} onUpdate={onUpdate} />,
    );
    const input = getByTestId('wall-type-layer-thickness-0') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '300' } });
    expect(onUpdate).toHaveBeenCalledOnce();
    const patch = onUpdate.mock.calls[0][0] as { layers: WallTypeLayer[] };
    expect(patch.layers[0].thicknessMm).toBe(300);
  });

  it('up/down buttons reorder layers', () => {
    const onUpdate = vi.fn();
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType()} onUpdate={onUpdate} />,
    );
    fireEvent.click(getByTestId('wall-type-layer-down-0'));
    expect(onUpdate).toHaveBeenCalledOnce();
    const patch = onUpdate.mock.calls[0][0] as { layers: WallTypeLayer[] };
    expect(patch.layers[0].function).toBe('insulation');
    expect(patch.layers[1].function).toBe('structure');
  });

  it('name input change calls onUpdate with new name', () => {
    const onUpdate = vi.fn();
    const { getByTestId } = render(
      <WallTypeLayerEditor typeElement={makeWallType()} onUpdate={onUpdate} />,
    );
    const input = getByTestId('wall-type-name-input') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: 'Renamed Wall' } });
    expect(onUpdate).toHaveBeenCalledOnce();
    const patch = onUpdate.mock.calls[0][0] as { name: string };
    expect(patch.name).toBe('Renamed Wall');
  });
});
