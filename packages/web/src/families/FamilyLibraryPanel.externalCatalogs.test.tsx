/**
 * FAM-08 — External Catalogs tab on the Family Library panel.
 *
 * Drives the panel with a stub `catalogClient` and asserts:
 *  - Switching tabs surfaces the external catalog index from the server
 *  - Expanding a catalog fetches + lists its families
 *  - Clicking "Place" calls `onPlaceCatalogFamily` with the canonical
 *    placement payload (catalogId + version + family + defaultType)
 *  - Project-loaded family_type elements with `catalogSource` show the
 *    catalog provenance badge in the In Project tab
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';

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

describe('<FamilyLibraryPanel /> — FAM-08 External Catalogs tab', () => {
  it('renders the tabs row and the In Project tab is selected by default', () => {
    const { getByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={() => undefined}
        elementsById={{}}
        onPlaceType={() => undefined}
        catalogClient={makeClient()}
      />,
    );
    expect(getByTestId('family-library-tab-in-project').getAttribute('aria-selected')).toBe('true');
    expect(getByTestId('family-library-tab-external').getAttribute('aria-selected')).toBe('false');
  });

  it('switching to External Catalogs lists every catalog from the server', async () => {
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
    fireEvent.click(getByTestId('family-library-tab-external'));
    await waitFor(() => getByTestId('external-catalog-living-room-furniture'));
    expect(getByTestId('external-catalog-kitchen-fixtures')).toBeTruthy();
    expect(client.listCatalogs).toHaveBeenCalledTimes(1);
  });

  it('expanding a catalog fetches its full payload and lists families', async () => {
    const client = makeClient();
    const { getByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={() => undefined}
        elementsById={{}}
        onPlaceType={() => undefined}
        catalogClient={client}
        initialTab="external"
      />,
    );
    await waitFor(() => getByTestId('external-catalog-living-room-furniture'));
    await act(async () => {
      fireEvent.click(getByTestId('external-catalog-toggle-living-room-furniture'));
    });
    await waitFor(() => getByTestId('external-family-catalog:living-room:sofa-3-seat'));
    expect(getByTestId('external-family-catalog:living-room:floor-lamp')).toBeTruthy();
    expect(client.getCatalog).toHaveBeenCalledWith('living-room-furniture');
  });

  it('Place on an external family fires onPlaceCatalogFamily with the placement payload', async () => {
    const onPlaceCatalogFamily = vi.fn<(_p: ExternalCatalogPlacement) => void>();
    const onClose = vi.fn();
    const { getByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={onClose}
        elementsById={{}}
        onPlaceType={() => undefined}
        catalogClient={makeClient()}
        initialTab="external"
        onPlaceCatalogFamily={onPlaceCatalogFamily}
      />,
    );
    await waitFor(() => getByTestId('external-catalog-living-room-furniture'));
    await act(async () => {
      fireEvent.click(getByTestId('external-catalog-toggle-living-room-furniture'));
    });
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

  it('Load on an external family fires onLoadCatalogFamily without placing', async () => {
    const onLoadCatalogFamily = vi.fn<(_p: ExternalCatalogPlacement) => void>();
    const onPlaceCatalogFamily = vi.fn<(_p: ExternalCatalogPlacement) => void>();
    const onClose = vi.fn();
    const { getByTestId } = render(
      <FamilyLibraryPanel
        open
        onClose={onClose}
        elementsById={{}}
        onPlaceType={() => undefined}
        catalogClient={makeClient()}
        initialTab="external"
        onLoadCatalogFamily={onLoadCatalogFamily}
        onPlaceCatalogFamily={onPlaceCatalogFamily}
      />,
    );
    await waitFor(() => getByTestId('external-catalog-living-room-furniture'));
    await act(async () => {
      fireEvent.click(getByTestId('external-catalog-toggle-living-room-furniture'));
    });
    await waitFor(() => getByTestId('external-family-catalog:living-room:sofa-3-seat-load'));
    fireEvent.click(getByTestId('external-family-catalog:living-room:sofa-3-seat-load'));

    expect(onLoadCatalogFamily).toHaveBeenCalledTimes(1);
    expect(onPlaceCatalogFamily).not.toHaveBeenCalled();
    const placement = onLoadCatalogFamily.mock.calls[0]![0]!;
    expect(placement.catalogId).toBe('living-room-furniture');
    expect(placement.family.id).toBe('catalog:living-room:sofa-3-seat');
    expect(placement.defaultType.id).toBe('catalog:living-room:sofa-3-seat:standard');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('In Project tab shows catalogSource provenance badge for catalog-loaded family_type', () => {
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
        initialTab="external"
      />,
    );
    await waitFor(() => getByTestId('external-catalogs-error'));
    expect(getByTestId('external-catalogs-error').textContent).toContain('network fell over');
  });
});
