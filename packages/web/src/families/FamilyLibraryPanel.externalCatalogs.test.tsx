/**
 * FAM-08 — catalog-backed families in the Family Library panel.
 *
 * Drives the panel with a stub `catalogClient` and asserts:
 *  - The unified library surfaces catalog families from the server
 *  - Catalog families render as normal rows with rendered thumbnails
 *  - Clicking "Place" calls `onPlaceCatalogFamily` with the canonical
 *    placement payload (catalogId + version + family + defaultType)
 *  - Project-loaded family_type elements with `catalogSource` show catalog
 *    provenance in the same list
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import type { Element } from '@bim-ai/core';

import {
  FamilyLibraryPanel,
  type ExternalCatalogClient,
  type ExternalCatalogIndexEntry,
  type ExternalCatalogPayload,
  type ExternalCatalogPlacement,
} from './FamilyLibraryPanel';

afterEach(() => {
  cleanup();
});

const SOFA_PAYLOAD: ExternalCatalogPayload = {
  catalogId: 'living-room-furniture',
  name: 'Living Room Furniture',
  version: '1.0.0',
  description: 'Sofa, lamp, coffee table.',
  thumbnailsBaseUrl: null,
  families: [
    {
      id: 'catalog:living-room:sofa-3-seat',
      name: '3-Seat Sofa',
      discipline: 'generic',
      defaultTypes: [
        {
          id: 'catalog:living-room:sofa-3-seat:standard',
          name: 'Standard 3-Seat 2200×950',
          familyId: 'catalog:living-room:sofa-3-seat',
          discipline: 'generic',
          parameters: { widthMm: 2200, depthMm: 950 },
        },
      ],
    },
    {
      id: 'catalog:living-room:floor-lamp',
      name: 'Floor Lamp',
      discipline: 'generic',
      defaultTypes: [
        {
          id: 'catalog:living-room:floor-lamp:standard-1700',
          name: 'Standard Floor Lamp 1700',
          familyId: 'catalog:living-room:floor-lamp',
          discipline: 'generic',
          parameters: { heightMm: 1700 },
        },
      ],
    },
    {
      id: 'catalog:living-room:dining-table-array',
      name: 'Dining Table With Chair Array',
      discipline: 'generic',
      params: [
        {
          key: 'Width',
          label: 'Table Width',
          type: 'length_mm',
          default: 2400,
          instanceOverridable: true,
        },
        {
          key: 'ChairSlotPitch',
          label: 'Chair Slot Pitch',
          type: 'length_mm',
          default: 600,
          instanceOverridable: false,
        },
        {
          key: 'Array_Length_Width',
          label: 'Array Length Width',
          type: 'length_mm',
          default: 4,
          formula: 'max(1, rounddown(Width / 600))',
          instanceOverridable: false,
        },
      ],
      defaultTypes: [
        {
          id: 'catalog:living-room:dining-table-array:standard',
          name: 'Standard 2400',
          familyId: 'catalog:living-room:dining-table-array',
          discipline: 'generic',
          parameters: { Width: 2400, ChairSlotPitch: 600 },
        },
      ],
      geometry: [
        {
          kind: 'array',
          target: {
            kind: 'family_instance_ref',
            familyId: 'catalog:living-room:chair',
            positionMm: { xMm: 0, yMm: 0, zMm: 0 },
            rotationDeg: 0,
            parameterBindings: {},
          },
          mode: 'linear',
          countParam: 'Array_Length_Width',
          spacing: { kind: 'fit_total', totalLengthParam: 'Width' },
          axisStart: { xMm: 0, yMm: 0, zMm: 0 },
          axisEnd: { xMm: 0, yMm: 0, zMm: 0 },
        },
      ],
    },
  ],
};

const KITCHEN_PAYLOAD: ExternalCatalogPayload = {
  catalogId: 'kitchen-fixtures',
  name: 'Kitchen Fixtures',
  version: '1.0.0',
  description: 'Counter, sink, oven, fridge.',
  thumbnailsBaseUrl: null,
  families: [
    {
      id: 'catalog:kitchen:sink',
      name: 'Sink',
      discipline: 'generic',
      defaultTypes: [
        {
          id: 'catalog:kitchen:sink:single-bowl-600',
          name: 'Single Bowl Sink 600',
          familyId: 'catalog:kitchen:sink',
          discipline: 'generic',
          parameters: { widthMm: 600 },
        },
      ],
    },
  ],
};

const INDEX: ExternalCatalogIndexEntry[] = [
  {
    catalogId: SOFA_PAYLOAD.catalogId,
    name: SOFA_PAYLOAD.name,
    description: SOFA_PAYLOAD.description,
    version: SOFA_PAYLOAD.version,
    thumbnailsBaseUrl: null,
    familyCount: SOFA_PAYLOAD.families.length,
  },
  {
    catalogId: KITCHEN_PAYLOAD.catalogId,
    name: KITCHEN_PAYLOAD.name,
    description: KITCHEN_PAYLOAD.description,
    version: KITCHEN_PAYLOAD.version,
    thumbnailsBaseUrl: null,
    familyCount: KITCHEN_PAYLOAD.families.length,
  },
];

function makeClient(): ExternalCatalogClient {
  return {
    listCatalogs: vi.fn(async () => INDEX),
    getCatalog: vi.fn(async (id: string) => {
      if (id === SOFA_PAYLOAD.catalogId) return SOFA_PAYLOAD;
      if (id === KITCHEN_PAYLOAD.catalogId) return KITCHEN_PAYLOAD;
      throw new Error(`unknown catalog: ${id}`);
    }),
  };
}

describe('<FamilyLibraryPanel /> — FAM-08 catalog families', () => {
  it('renders catalog families in the unified library without source tabs', async () => {
    const client = makeClient();
    const { getByTestId, queryByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={() => undefined}
        elementsById={{}}
        onPlaceType={() => undefined}
        catalogClient={client}
      />,
    );
    expect(queryByTestId('family-library-tab-in-project')).toBeNull();
    expect(queryByTestId('family-library-tab-external')).toBeNull();
    await waitFor(() => getByTestId('family-row-catalog:living-room:sofa-3-seat'));
    expect(getByTestId('family-row-catalog:kitchen:sink')).toBeTruthy();
    expect(client.listCatalogs).toHaveBeenCalledTimes(1);
    expect(client.getCatalog).toHaveBeenCalledWith('living-room-furniture');
    expect(client.getCatalog).toHaveBeenCalledWith('kitchen-fixtures');
  });

  it('renders catalog families as normal grouped rows with rendered thumbnails', async () => {
    const client = makeClient();
    const { getByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={() => undefined}
        elementsById={{}}
        onPlaceType={() => undefined}
        catalogClient={client}
      />,
    );
    await waitFor(() => getByTestId('family-row-catalog:living-room:sofa-3-seat'));
    const sofaRow = getByTestId('family-row-catalog:living-room:sofa-3-seat');
    const sinkRow = getByTestId('family-row-catalog:kitchen:sink');

    expect(getByTestId('family-group-asset-furniture')).toBeTruthy();
    expect(getByTestId('family-group-asset-kitchen')).toBeTruthy();
    expect(sofaRow.querySelector('[data-testid="asset-rendered-thumbnail"]')?.tagName).toBe('IMG');
    expect(sinkRow.querySelector('[data-testid="asset-rendered-thumbnail"]')?.tagName).toBe('IMG');
  });

  it('Place on a catalog family fires onPlaceCatalogFamily with the placement payload', async () => {
    const onPlaceCatalogFamily = vi.fn<(_p: ExternalCatalogPlacement, _option?: string) => void>();
    const onClose = vi.fn();
    const { getByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={onClose}
        elementsById={{}}
        onPlaceType={() => undefined}
        catalogClient={makeClient()}
        onPlaceCatalogFamily={onPlaceCatalogFamily}
      />,
    );
    await waitFor(() => getByTestId('external-family-catalog:living-room:sofa-3-seat-place'));
    fireEvent.click(getByTestId('external-family-catalog:living-room:sofa-3-seat-place'));
    expect(onPlaceCatalogFamily).toHaveBeenCalledTimes(1);
    const placement = onPlaceCatalogFamily.mock.calls[0]![0]!;
    expect(placement.catalogId).toBe('living-room-furniture');
    expect(placement.catalogVersion).toBe('1.0.0');
    expect(placement.family.id).toBe('catalog:living-room:sofa-3-seat');
    expect(placement.defaultType.id).toBe('catalog:living-room:sofa-3-seat:standard');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('loaded catalog families show Loaded and Place keeps existing values', async () => {
    const onPlaceCatalogFamily = vi.fn();
    const existingType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-sofa-loaded',
      name: 'Project sofa',
      familyId: 'catalog:living-room:sofa-3-seat',
      discipline: 'generic',
      parameters: {
        name: 'Project sofa',
        familyId: 'catalog:living-room:sofa-3-seat',
        widthMm: 2400,
      },
      catalogSource: {
        catalogId: 'living-room-furniture',
        familyId: 'catalog:living-room:sofa-3-seat',
        version: '0.9.0',
      },
    };
    const { getByTestId, queryByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={() => undefined}
        elementsById={{ [existingType.id]: existingType }}
        onPlaceType={() => undefined}
        catalogClient={makeClient()}
        onPlaceCatalogFamily={onPlaceCatalogFamily}
      />,
    );
    await waitFor(() => getByTestId('family-row-catalog:living-room:sofa-3-seat-loaded-badge'));

    expect(getByTestId('family-row-catalog:living-room:sofa-3-seat-loaded-badge')).toBeTruthy();
    expect(queryByTestId('external-family-catalog:living-room:sofa-3-seat-load')).toBeNull();
    expect(
      queryByTestId('external-family-catalog:living-room:sofa-3-seat-reload-keep-values'),
    ).toBeNull();

    fireEvent.click(getByTestId('external-family-catalog:living-room:sofa-3-seat-place'));
    expect(onPlaceCatalogFamily).toHaveBeenLastCalledWith(
      expect.objectContaining({ catalogId: 'living-room-furniture' }),
      'keep-existing-values',
    );
  });

  it('surfaces catalog-family array formulas and saves edits with placement context', async () => {
    const onUpdateArrayFormula = vi.fn();
    const { getByLabelText, getByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={() => undefined}
        elementsById={{}}
        onPlaceType={() => undefined}
        catalogClient={makeClient()}
        onUpdateArrayFormula={onUpdateArrayFormula}
      />,
    );
    await waitFor(() => getByTestId('family-row-catalog:living-room:dining-table-array'));

    const input = getByLabelText('Array formula Array_Length_Width') as HTMLInputElement;
    expect(input.value).toBe('max(1, rounddown(Width / 600))');
    fireEvent.change(input, { target: { value: 'max(1, rounddown(Width / 500))' } });
    fireEvent.click(getByTestId('array-formula-save-Array_Length_Width'));

    expect(onUpdateArrayFormula).toHaveBeenCalledTimes(1);
    expect(onUpdateArrayFormula.mock.calls[0]![0]).toMatchObject({
      target: {
        kind: 'catalog_family',
        placement: {
          catalogId: 'living-room-furniture',
          family: { id: 'catalog:living-room:dining-table-array' },
        },
      },
      paramKey: 'Array_Length_Width',
      formula: 'max(1, rounddown(Width / 500))',
    });
  });

  it('shows catalogSource provenance badge for catalog-loaded family_type', () => {
    const ftFromCatalog: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-sofa-loaded',
      name: 'Sofa loaded from catalog',
      familyId: 'catalog:living-room:sofa-3-seat',
      discipline: 'generic',
      parameters: { name: 'Sofa loaded from catalog', widthMm: 2200 },
      catalogSource: {
        catalogId: 'living-room-furniture',
        familyId: 'catalog:living-room:sofa-3-seat',
        version: '1.0.0',
      },
    };
    const { getByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={() => undefined}
        elementsById={{ [ftFromCatalog.id]: ftFromCatalog }}
        onPlaceType={() => undefined}
        catalogClient={makeClient()}
      />,
    );
    expect(getByTestId(`family-row-${ftFromCatalog.id}`)).toBeTruthy();
    const badge = getByTestId(`family-row-${ftFromCatalog.id}-catalog-badge`);
    expect(badge.textContent).toBe('living-room-furniture');
  });

  it('shows an error message when listCatalogs rejects', async () => {
    const client: ExternalCatalogClient = {
      listCatalogs: vi.fn(async () => {
        throw new Error('network fell over');
      }),
      getCatalog: vi.fn(async () => {
        throw new Error('not reached');
      }),
    };
    const { getByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={() => undefined}
        elementsById={{}}
        onPlaceType={() => undefined}
        catalogClient={client}
      />,
    );
    await waitFor(() => getByTestId('family-catalogs-error'));
    expect(getByTestId('family-catalogs-error').textContent).toContain('network fell over');
  });
});
