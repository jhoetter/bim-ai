import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@bim-ai/core';

import { MaterialLayerStackWorkbench } from './MaterialLayerStackWorkbench';

afterEach(() => cleanup());

const wallType: Extract<Element, { kind: 'wall_type' }> = {
  kind: 'wall_type',
  id: 'wt-layered',
  name: 'Layered Wall',
  basisLine: 'center',
  layers: [
    { thicknessMm: 12, function: 'finish', materialKey: 'gyp' },
    { thicknessMm: 180, function: 'structure', materialKey: 'concrete' },
    { thicknessMm: 30, function: 'insulation', materialKey: 'mineral-wool' },
  ],
};

describe('MaterialLayerStackWorkbench', () => {
  it('reorders type layers before applying the upsert command', () => {
    const onUpsertSemantic = vi.fn();
    const { getByTestId } = render(
      <MaterialLayerStackWorkbench
        selected={wallType}
        elementsById={{ [wallType.id]: wallType }}
        revision={1}
        onUpsertSemantic={onUpsertSemantic}
      />,
    );

    fireEvent.click(getByTestId('material-layer-move-down-0'));
    fireEvent.click(getByTestId('material-layer-move-up-2'));
    fireEvent.click(getByTestId('material-layer-move-up-1'));
    fireEvent.click(getByTestId('material-layer-apply'));

    expect(onUpsertSemantic).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upsertWallType',
        layers: [
          { thicknessMm: 30, function: 'insulation', materialKey: 'mineral-wool' },
          { thicknessMm: 180, function: 'structure', materialKey: 'concrete' },
          { thicknessMm: 12, function: 'finish', materialKey: 'gyp' },
        ],
      }),
    );
  });

  it('persists layer wrapping flags in the type stack command', () => {
    const onUpsertSemantic = vi.fn();
    const { getByLabelText, getByTestId } = render(
      <MaterialLayerStackWorkbench
        selected={wallType}
        elementsById={{ [wallType.id]: wallType }}
        revision={1}
        onUpsertSemantic={onUpsertSemantic}
      />,
    );

    fireEvent.click(getByLabelText('Wrap layer 0 at wall ends'));
    fireEvent.click(getByLabelText('Wrap layer 2 at inserts'));
    fireEvent.click(getByTestId('material-layer-apply'));

    expect(onUpsertSemantic).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upsertWallType',
        layers: [
          { thicknessMm: 12, function: 'finish', materialKey: 'gyp', wrapsAtEnds: true },
          { thicknessMm: 180, function: 'structure', materialKey: 'concrete' },
          {
            thicknessMm: 30,
            function: 'insulation',
            materialKey: 'mineral-wool',
            wrapsAtInserts: true,
          },
        ],
      }),
    );
  });
});
