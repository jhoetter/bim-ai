import type { Element } from '@bim-ai/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

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

function makeElementsWithNorthArrow(
  northArrowOverrides?: Partial<Extract<Element, { kind: 'annotation_symbol' }>>,
  projectNorthAngleDeg?: number,
): Record<string, Element> {
  const sheet: Extract<Element, { kind: 'sheet' }> = {
    kind: 'sheet',
    id: 'sheet-a101',
    name: 'A101',
    titleblockParameters: { sheetIntent: 'documentation' },
  };
  const northArrow: Extract<Element, { kind: 'annotation_symbol' }> = {
    kind: 'annotation_symbol',
    id: 'na-1',
    hostViewId: 'sheet-a101',
    positionMm: { xMm: 5000, yMm: 5000 },
    symbolType: 'north_arrow',
    rotationDeg: 0,
    ...(northArrowOverrides ?? {}),
  };
  const elements: Record<string, Element> = {
    [sheet.id]: sheet,
    [northArrow.id]: northArrow,
  };
  if (projectNorthAngleDeg !== undefined) {
    const ps: Extract<Element, { kind: 'project_settings' }> = {
      kind: 'project_settings',
      id: 'project_settings',
      projectNorthAngleDeg,
    };
    elements[ps.id] = ps;
  }
  return elements;
}

afterEach(() => {
  cleanup();
});

describe('SheetCanvas', () => {
  it('keeps documentation details collapsed by default', () => {
    const { getByTestId } = render(
      <SheetCanvas elementsById={makeElements()} preferredSheetId="sheet-a101" />,
    );

    const details = getByTestId('sheet-documentation-details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it('renders a north arrow symbol hosted on the sheet (ANN-12)', () => {
    const { getByTestId } = render(
      <SheetCanvas elementsById={makeElementsWithNorthArrow()} preferredSheetId="sheet-a101" />,
    );
    expect(getByTestId('sheet-north-arrow-na-1')).toBeTruthy();
  });

  it('does not render north arrow hosted on a different view', () => {
    const elements = makeElementsWithNorthArrow({ hostViewId: 'some-other-view' });
    const { queryByTestId } = render(
      <SheetCanvas elementsById={elements} preferredSheetId="sheet-a101" />,
    );
    expect(queryByTestId('sheet-north-arrow-na-1')).toBeNull();
  });

  it('applies projectNorthAngleDeg to north arrow rotation', () => {
    const { getByTestId } = render(
      <SheetCanvas
        elementsById={makeElementsWithNorthArrow({ rotationDeg: 30 }, 15)}
        preferredSheetId="sheet-a101"
      />,
    );
    const g = getByTestId('sheet-north-arrow-na-1');
    expect(g.getAttribute('transform')).toContain('rotate(45,');
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
