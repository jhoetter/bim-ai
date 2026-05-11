import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { AssetLibraryEntry } from '@bim-ai/core';
import { LibraryOverlay } from './LibraryOverlay';

afterEach(() => cleanup());

const entries: AssetLibraryEntry[] = [
  {
    id: 'chair-arch',
    name: 'Dining chair',
    tags: ['chair'],
    category: 'furniture',
    disciplineTags: ['arch'],
    thumbnailKind: 'schematic_plan',
  },
  {
    id: 'beam-struct',
    name: 'Steel beam',
    tags: ['beam'],
    category: 'profile',
    disciplineTags: ['struct'],
    thumbnailKind: 'schematic_plan',
  },
  {
    id: 'diffuser-mep',
    name: 'Ceiling diffuser',
    tags: ['diffuser'],
    category: 'profile',
    disciplineTags: ['mep'],
    thumbnailKind: 'schematic_plan',
  },
];

describe('LibraryOverlay — LIB-V3-01', () => {
  it('defaults to active discipline and supports multi-select filters', () => {
    const { getByTestId, queryByText, getByText } = render(
      <LibraryOverlay
        isOpen={true}
        onClose={vi.fn()}
        entries={entries}
        activeDiscipline="struct"
        onPlace={vi.fn()}
      />,
    );

    expect(getByText('Steel beam')).toBeTruthy();
    expect(queryByText('Dining chair')).toBeNull();

    fireEvent.click(getByTestId('discipline-filter-arch'));
    expect(getByText('Steel beam')).toBeTruthy();
    expect(getByText('Dining chair')).toBeTruthy();

    fireEvent.click(getByTestId('discipline-filter-struct'));
    expect(queryByText('Steel beam')).toBeNull();
    expect(getByText('Dining chair')).toBeTruthy();
  });
});
