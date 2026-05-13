import type { Element } from '@bim-ai/core';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SheetCanvas } from './SheetCanvas';

function makeElements(
  overrides?: Partial<Extract<Element, { kind: 'sheet' }>>,
): Record<string, Element> {
  const sheet: Extract<Element, { kind: 'sheet' }> = {
    kind: 'sheet',
    id: 'sheet-a101',
    name: 'A101',
    titleblockParameters: {
      sheetIntent: 'documentation',
    },
    ...(overrides ?? {}),
  };
  return {
    [sheet.id]: sheet,
  };
}

describe('SheetCanvas', () => {
  it('keeps documentation details collapsed by default', () => {
    const { getByTestId } = render(
      <SheetCanvas elementsById={makeElements()} preferredSheetId="sheet-a101" />,
    );

    const details = getByTestId('sheet-documentation-details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it('updates sheet intent via semantic command when authoring', () => {
    const onUpsertSemantic = vi.fn();
    const { getByTestId } = render(
      <SheetCanvas
        elementsById={makeElements({ titleblockParameters: { sheetIntent: 'documentation' } })}
        preferredSheetId="sheet-a101"
        onUpsertSemantic={onUpsertSemantic}
      />,
    );

    const select = getByTestId('sheet-intent-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'moodboard' } });

    expect(onUpsertSemantic).toHaveBeenCalledWith({
      type: 'updateElementProperty',
      elementId: 'sheet-a101',
      key: 'titleblockParametersPatch',
      value: '{"sheetIntent":"moodboard"}',
    });
  });
});
