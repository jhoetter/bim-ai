import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import type { Element } from '@bim-ai/core';

import { FamilyLibraryPanel } from './FamilyLibraryPanel';

afterEach(() => {
  cleanup();
});

function setup(elementsById: Record<string, Element> = {}, onPlaceType = vi.fn()) {
  const onClose = vi.fn();
  const utils = render(
    <FamilyLibraryPanel
      open
      onClose={onClose}
      elementsById={elementsById}
      onPlaceType={onPlaceType}
    />,
  );
  return { ...utils, onPlaceType, onClose };
}

describe('<FamilyLibraryPanel /> — FL-06', () => {
  it('renders all built-in disciplines that have entries', () => {
    const { getByTestId } = setup();
    expect(getByTestId('family-group-door')).toBeTruthy();
    expect(getByTestId('family-group-window')).toBeTruthy();
    expect(getByTestId('family-group-stair')).toBeTruthy();
    expect(getByTestId('family-group-railing')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    const { queryByTestId } = render(
      <FamilyLibraryPanel
        open={false}
        onClose={() => undefined}
        elementsById={{}}
        onPlaceType={() => undefined}
      />,
    );
    expect(queryByTestId('family-library-panel')).toBeNull();
  });

  it('search "casement" filters down to the casement window family only', () => {
    const { getByLabelText, queryByTestId } = setup();
    const search = getByLabelText('Search families') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'casement' } });

    // Casement window types should remain
    expect(queryByTestId('family-row-builtin:window:casement:1200x1500')).toBeTruthy();
    // Door / stair / fixed-window groups should hide
    expect(queryByTestId('family-group-door')).toBeNull();
    expect(queryByTestId('family-row-builtin:window:fixed:1500x2000')).toBeNull();
    expect(queryByTestId('family-group-stair')).toBeNull();
  });

  it('clicking "Place" on a door type calls onPlaceType with kind=door + the type id', () => {
    const onPlaceType = vi.fn();
    const { getByTestId } = setup({}, onPlaceType);
    const row = getByTestId('family-row-builtin:door:single:900x2100');
    const placeBtn = row.querySelector('button');
    expect(placeBtn).toBeTruthy();
    fireEvent.click(placeBtn!);
    expect(onPlaceType).toHaveBeenCalledWith('door', 'builtin:door:single:900x2100');
  });

  it('clicking "Place" closes the panel', () => {
    const onPlaceType = vi.fn();
    const { getByTestId, onClose } = setup({}, onPlaceType);
    const row = getByTestId('family-row-builtin:door:single:900x2100');
    fireEvent.click(row.querySelector('button')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows custom family_type elements with a "Custom" badge', () => {
    const customDoor: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'custom:door:wide-fire',
      name: 'Wide fire door',
      familyId: 'builtin:door:single',
      discipline: 'door',
      parameters: { name: 'Wide fire door', leafWidthMm: 1100 },
      isBuiltIn: false,
    };
    const { getByTestId } = setup({ [customDoor.id]: customDoor });
    expect(getByTestId(`family-row-${customDoor.id}`)).toBeTruthy();
    expect(getByTestId(`family-row-${customDoor.id}-custom-badge`)).toBeTruthy();
  });

  it('shows in-project interior assets as component families', () => {
    const asset: Extract<Element, { kind: 'asset_library_entry' }> = {
      kind: 'asset_library_entry',
      id: 'asset-bedroom-queen-bed-1800',
      assetKind: 'family_instance',
      name: 'Queen Bed 1800x2100',
      tags: ['bedroom', 'bed'],
      category: 'furniture',
      thumbnailKind: 'schematic_plan',
      thumbnailWidthMm: 1800,
      thumbnailHeightMm: 2100,
      planSymbolKind: 'bed',
      renderProxyKind: 'bed',
    };
    const onPlaceType = vi.fn();
    const { getByTestId } = setup({ [asset.id]: asset }, onPlaceType);

    expect(getByTestId('family-group-asset-furniture')).toBeTruthy();
    const row = getByTestId(`family-row-${asset.id}`);
    expect(row).toBeTruthy();
    fireEvent.click(row.querySelector('button')!);
    expect(onPlaceType).toHaveBeenCalledWith('asset', asset.id);
  });

  it('renders in-project assets with rendered family-preview thumbnails', () => {
    const asset: Extract<Element, { kind: 'asset_library_entry' }> = {
      kind: 'asset_library_entry',
      id: 'asset-dining-table-2200',
      assetKind: 'family_instance',
      name: 'Dining table',
      tags: ['dining', 'table'],
      category: 'furniture',
      thumbnailKind: 'schematic_plan',
      thumbnailWidthMm: 2200,
      thumbnailHeightMm: 900,
    };
    const { getByTestId } = setup({ [asset.id]: asset });
    const canvas = getByTestId(`family-row-${asset.id}`).querySelector('canvas');

    expect(canvas).toBeTruthy();
    expect(canvas?.getAttribute('data-testid')).toBe('asset-rendered-thumbnail');
    expect(canvas?.getAttribute('width')).toBe('64');
    expect(canvas?.getAttribute('height')).toBe('64');
  });

  it('groups custom wall_type elements under "Wall Types"', () => {
    const wt: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'My Wall Type',
      basisLine: 'center',
      layers: [{ thicknessMm: 200, function: 'structure', materialKey: '' }],
    };
    const { getByTestId } = setup({ [wt.id]: wt });
    expect(getByTestId('family-group-wall_type')).toBeTruthy();
    expect(getByTestId(`family-row-${wt.id}`)).toBeTruthy();
  });

  it('renders built-in wall types with wall assembly thumbnails', () => {
    const { getByTestId } = setup();
    const row = getByTestId('family-row-wall.ext-timber');

    expect(row.querySelector('[data-testid="wall-type-thumbnail"]')).toBeTruthy();
    expect(row.querySelector('img')).toBeNull();
  });

  it('renders custom wall_type elements with wall assembly thumbnails', () => {
    const wt: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-rendered',
      name: 'Rendered Wall Type',
      basisLine: 'center',
      layers: [
        { thicknessMm: 13, function: 'finish', materialKey: 'plaster' },
        { thicknessMm: 140, function: 'structure', materialKey: 'timber_stud' },
      ],
    };
    const { getByTestId } = setup({ [wt.id]: wt });
    const row = getByTestId(`family-row-${wt.id}`);

    expect(row.querySelector('[data-testid="wall-type-thumbnail"]')).toBeTruthy();
    expect(row.querySelector('img')).toBeNull();
  });

  it('clicking the backdrop closes the panel', () => {
    const { getByTestId, onClose } = setup();
    fireEvent.click(getByTestId('family-library-panel'));
    expect(onClose).toHaveBeenCalled();
  });
});
