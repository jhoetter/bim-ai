import type { Element } from '@bim-ai/core';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { SheetCanvas } from './SheetCanvas';

function makeElementsWithViewports(
  viewports: Array<Record<string, unknown>>,
): Record<string, Element> {
  const sheet: Extract<Element, { kind: 'sheet' }> = {
    kind: 'sheet',
    id: 'sheet-a101',
    name: 'A101',
    titleblockParameters: {},
    viewportsMm: viewports as unknown[],
  };
  return { [sheet.id]: sheet };
}

afterEach(() => {
  cleanup();
});

describe('sheet viewport scale label — §6.2', () => {
  it('renders sheet-viewport-scale-{id} for each viewport', () => {
    const elements = makeElementsWithViewports([
      {
        viewportId: 'vp-1',
        xMm: 1000,
        yMm: 1000,
        widthMm: 5000,
        heightMm: 4000,
        scale: '1:100',
        label: '',
      },
      {
        viewportId: 'vp-2',
        xMm: 7000,
        yMm: 1000,
        widthMm: 5000,
        heightMm: 4000,
        scale: '1:50',
        label: '',
      },
    ]);
    const { getByTestId } = render(
      <SheetCanvas elementsById={elements} preferredSheetId="sheet-a101" />,
    );
    expect(getByTestId('sheet-viewport-scale-vp-1')).toBeTruthy();
    expect(getByTestId('sheet-viewport-scale-vp-2')).toBeTruthy();
  });

  it('displays vp.scale text in the label', () => {
    const elements = makeElementsWithViewports([
      {
        viewportId: 'vp-x',
        xMm: 1000,
        yMm: 1000,
        widthMm: 5000,
        heightMm: 4000,
        scale: '1:100',
        label: '',
      },
    ]);
    const { getByTestId } = render(
      <SheetCanvas elementsById={elements} preferredSheetId="sheet-a101" />,
    );
    expect(getByTestId('sheet-viewport-scale-vp-x').textContent).toContain('1:100');
  });

  it('shows "—" when scale is empty string', () => {
    const elements = makeElementsWithViewports([
      {
        viewportId: 'vp-y',
        xMm: 1000,
        yMm: 1000,
        widthMm: 5000,
        heightMm: 4000,
        scale: '',
        label: '',
      },
    ]);
    const { getByTestId } = render(
      <SheetCanvas elementsById={elements} preferredSheetId="sheet-a101" />,
    );
    expect(getByTestId('sheet-viewport-scale-vp-y').textContent).toContain('—');
  });

  it('renders sheet-viewport-label-{id} when vp.label is non-empty', () => {
    const elements = makeElementsWithViewports([
      {
        viewportId: 'vp-z',
        xMm: 1000,
        yMm: 1000,
        widthMm: 5000,
        heightMm: 4000,
        scale: '1:100',
        label: 'Floor Plan',
      },
    ]);
    const { getByTestId } = render(
      <SheetCanvas elementsById={elements} preferredSheetId="sheet-a101" />,
    );
    expect(getByTestId('sheet-viewport-label-vp-z')).toBeTruthy();
  });
});
