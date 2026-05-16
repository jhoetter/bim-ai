import type { Element } from '@bim-ai/core';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { SheetCanvas } from './SheetCanvas';

function makeSheetElements(
  titleblockParameters: Record<string, string> = {},
  projectSettingsOverrides?: Partial<Extract<Element, { kind: 'project_settings' }>>,
): Record<string, Element> {
  const sheet: Extract<Element, { kind: 'sheet' }> = {
    kind: 'sheet',
    id: 'sheet-a101',
    name: 'A101',
    titleblockParameters,
  };
  const elements: Record<string, Element> = { [sheet.id]: sheet };
  if (projectSettingsOverrides) {
    const ps: Extract<Element, { kind: 'project_settings' }> = {
      kind: 'project_settings',
      id: 'ps-1',
      ...projectSettingsOverrides,
    };
    elements[ps.id] = ps;
  }
  return elements;
}

afterEach(() => {
  cleanup();
});

describe('title block checkedBy + issuedBy — §6.2', () => {
  it('renders sheet-tb-checked-by element', () => {
    const elements = makeSheetElements({ checkedBy: 'Alice' });
    const { getByTestId } = render(
      <SheetCanvas elementsById={elements} preferredSheetId="sheet-a101" />,
    );
    expect(getByTestId('sheet-tb-checked-by')).toBeTruthy();
  });

  it('renders sheet-tb-issued-by element', () => {
    const elements = makeSheetElements({ issuedBy: 'Corp Ltd' });
    const { getByTestId } = render(
      <SheetCanvas elementsById={elements} preferredSheetId="sheet-a101" />,
    );
    expect(getByTestId('sheet-tb-issued-by')).toBeTruthy();
  });

  it('falls back to project_settings.authorName for checkedBy', () => {
    const elements = makeSheetElements({}, { authorName: 'Bob' });
    const { getByTestId } = render(
      <SheetCanvas elementsById={elements} preferredSheetId="sheet-a101" />,
    );
    expect(getByTestId('sheet-tb-checked-by').textContent).toContain('Bob');
  });
});
