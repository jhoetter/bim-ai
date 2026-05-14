import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Element } from '@bim-ai/core';

const familyLibraryProps: { current: Record<string, unknown> | null } = { current: null };

vi.mock('../Viewport', () => ({
  Viewport: () => <div data-testid="stub-viewport" />,
}));

vi.mock('../plan/PlanCanvas', () => ({
  PlanCanvas: ({
    activeTabId,
    activePlanTool,
  }: {
    activeTabId?: string;
    activePlanTool?: string;
  }) => (
    <div
      data-testid="stub-plan-canvas"
      data-active-tab-id={activeTabId ?? ''}
      data-active-plan-tool={activePlanTool ?? ''}
    />
  ),
}));

vi.mock('../families/FamilyLibraryPanel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../families/FamilyLibraryPanel')>();
  return {
    ...actual,
    FamilyLibraryPanel: (props: Record<string, unknown>) => {
      familyLibraryProps.current = props;
      return <div data-testid="stub-family-library" />;
    },
  };
});

const mockApplyCommand = vi.fn();
const mockApplyCommandBundle = vi.fn();
const mockBootstrap = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    applyCommand: (...args: unknown[]) => mockApplyCommand(...args),
    applyCommandBundle: (...args: unknown[]) => mockApplyCommandBundle(...args),
    bootstrap: (...args: unknown[]) => mockBootstrap(...args),
  };
});

import { Workspace } from './Workspace';
import { useBimStore } from '../state/store';
import {
  activeComponentAssetId,
  activeComponentFamilyTypeId,
  setActiveComponentAssetId,
  setActiveComponentFamilyTypeId,
} from './authoring';

const TABS_KEY = 'bim-ai:tabs-v1';
const PANE_LAYOUT_KEY = 'bim-ai:pane-layout-v1';
const COMPOSITIONS_KEY = 'bim-ai:workspace-compositions-v1';

describe('<Workspace /> family library array formula persistence', () => {
  beforeEach(() => {
    familyLibraryProps.current = null;
    mockApplyCommand.mockReset();
    mockApplyCommandBundle.mockReset();
    mockBootstrap.mockReset();
    mockApplyCommand.mockResolvedValue({ revision: 2, elements: {}, violations: [] });
    mockApplyCommandBundle.mockResolvedValue({ revision: 3, elements: {}, violations: [] });
    setActiveComponentAssetId(null);
    setActiveComponentFamilyTypeId(null);
    localStorage.setItem('bim.onboarding-completed', 'true');
    useBimStore.setState({
      modelId: 'model-array-formulas',
      userId: 'user-1',
      elementsById: {},
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem('bim.onboarding-completed');
    localStorage.removeItem(TABS_KEY);
    localStorage.removeItem(PANE_LAYOUT_KEY);
    localStorage.removeItem(COMPOSITIONS_KEY);
  });

  it('persists project asset array formula edits through updateElementProperty', async () => {
    useBimStore.setState({
      elementsById: {
        'asset-table-array': {
          kind: 'asset_library_entry',
          id: 'asset-table-array',
          assetKind: 'family_instance',
          name: 'Dining Table Array',
          tags: ['dining'],
          category: 'furniture',
          thumbnailKind: 'schematic_plan',
          paramSchema: [
            { key: 'widthMm', kind: 'mm', default: 2400 },
            {
              key: 'Array_Length_Width',
              kind: 'mm',
              default: 4,
              constraints: { formula: 'max(1, rounddown(widthMm / 600))' },
            },
          ],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );

    await waitFor(() => expect(familyLibraryProps.current).not.toBeNull());
    await act(async () => {
      await (
        familyLibraryProps.current?.onUpdateArrayFormula as (update: unknown) => Promise<void>
      )({
        target: { kind: 'asset', assetId: 'asset-table-array' },
        paramKey: 'Array_Length_Width',
        formula: 'max(1, rounddown(widthMm / 500))',
      });
    });

    expect(mockApplyCommand).toHaveBeenCalledWith(
      'model-array-formulas',
      expect.objectContaining({
        type: 'updateElementProperty',
        elementId: 'asset-table-array',
        key: 'paramSchema',
        value: expect.arrayContaining([
          expect.objectContaining({
            key: 'Array_Length_Width',
            constraints: expect.objectContaining({
              formula: 'max(1, rounddown(widthMm / 500))',
            }),
          }),
        ]),
      }),
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  it('persists catalog-family array formula edits through an upserted family type', async () => {
    useBimStore.setState({
      elementsById: {
        'ft-catalog-table': {
          kind: 'family_type',
          id: 'ft-catalog-table',
          name: 'Dining Table',
          familyId: 'catalog:dining-table-array',
          discipline: 'generic',
          parameters: { name: 'Dining Table', familyId: 'catalog:dining-table-array' },
          catalogSource: {
            catalogId: 'living-room-furniture',
            familyId: 'catalog:dining-table-array',
            version: '1.0.0',
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );

    await waitFor(() => expect(familyLibraryProps.current).not.toBeNull());
    await act(async () => {
      await (
        familyLibraryProps.current?.onUpdateArrayFormula as (update: unknown) => Promise<void>
      )({
        target: {
          kind: 'catalog_family',
          placement: {
            catalogId: 'living-room-furniture',
            catalogName: 'Living Room Furniture',
            catalogVersion: '1.0.0',
            family: {
              id: 'catalog:dining-table-array',
              name: 'Dining Table',
              discipline: 'generic',
              params: [
                { key: 'Width', label: 'Width', type: 'length_mm', default: 2400 },
                {
                  key: 'Array_Length_Width',
                  label: 'Array_Length_Width',
                  type: 'length_mm',
                  default: 4,
                  formula: 'max(1, rounddown(Width / 600))',
                },
              ],
              defaultTypes: [
                {
                  id: 'default',
                  name: 'Default',
                  familyId: 'catalog:dining-table-array',
                  discipline: 'generic',
                  parameters: { Width: 2400 },
                },
              ],
              geometry: [],
            },
            defaultType: {
              id: 'default',
              name: 'Default',
              familyId: 'catalog:dining-table-array',
              discipline: 'generic',
              parameters: { Width: 2400 },
            },
          },
        },
        paramKey: 'Array_Length_Width',
        formula: 'max(1, rounddown(Width / 500))',
      });
    });

    expect(mockApplyCommandBundle).toHaveBeenCalledWith(
      'model-array-formulas',
      [
        expect.objectContaining({
          type: 'upsertFamilyType',
          id: 'ft-catalog-table',
          parameters: expect.objectContaining({
            Array_Length_WidthFormula: 'max(1, rounddown(Width / 500))',
            catalogArrayFormulaParams: expect.objectContaining({
              Array_Length_Width: 'max(1, rounddown(Width / 500))',
            }),
          }),
        }),
      ],
      expect.objectContaining({ userId: 'component-tool' }),
    );
  });

  it('hydrates a newly loaded catalog family before entering placement mode', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const typeId = 'ft-catalog_living-room_chair-rs';
    mockApplyCommandBundle.mockResolvedValueOnce({
      revision: 4,
      elements: {
        [typeId]: {
          kind: 'family_type',
          id: typeId,
          name: 'Lounge Chair',
          familyId: 'catalog:living-room:chair',
          discipline: 'generic',
          parameters: { name: 'Lounge Chair', familyId: 'catalog:living-room:chair' },
          catalogSource: {
            catalogId: 'living-room-furniture',
            familyId: 'catalog:living-room:chair',
            version: '1.0.0',
          },
        },
      },
      violations: [],
    });

    render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );

    await waitFor(() => expect(familyLibraryProps.current).not.toBeNull());
    await act(async () => {
      await (
        familyLibraryProps.current?.onPlaceCatalogFamily as (placement: unknown) => Promise<void>
      )({
        catalogId: 'living-room-furniture',
        catalogName: 'Living Room Furniture',
        catalogVersion: '1.0.0',
        family: {
          id: 'catalog:living-room:chair',
          name: 'Lounge Chair',
          discipline: 'generic',
          params: [],
          defaultTypes: [],
          geometry: [],
        },
        defaultType: {
          id: 'default',
          name: 'Lounge Chair',
          familyId: 'catalog:living-room:chair',
          discipline: 'generic',
          parameters: {},
        },
      });
    });
    now.mockRestore();

    expect(useBimStore.getState().elementsById[typeId]).toMatchObject({
      kind: 'family_type',
      id: typeId,
    });
    expect(useBimStore.getState().planTool).toBe('component');
  });

  it('indexes catalog plumbing fixtures as placed assets before placement', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const typeId = 'ft-catalog_bathroom_toilet-rs';
    const assetId = 'catalog:bathroom:toilet';
    mockApplyCommandBundle.mockResolvedValueOnce({
      revision: 4,
      elements: {
        [typeId]: {
          kind: 'family_type',
          id: typeId,
          name: 'Toilet',
          familyId: assetId,
          discipline: 'generic',
          parameters: { name: 'Toilet', familyId: assetId, widthMm: 400, depthMm: 700 },
          catalogSource: {
            catalogId: 'bathroom-fixtures',
            familyId: assetId,
            version: '1.0.0',
          },
        },
        [assetId]: {
          kind: 'asset_library_entry',
          id: assetId,
          assetKind: 'family_instance',
          name: 'Toilet',
          tags: ['bathroom', 'bathroom-fixtures', 'Bathroom Fixtures', 'generic'],
          category: 'bathroom',
          thumbnailKind: 'schematic_plan',
          thumbnailWidthMm: 400,
          thumbnailHeightMm: 700,
          planSymbolKind: 'toilet',
          renderProxyKind: 'toilet',
          description: 'Bathroom Fixtures · 1 type',
        },
      },
      violations: [],
    });

    render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );

    await waitFor(() => expect(familyLibraryProps.current).not.toBeNull());
    await act(async () => {
      await (
        familyLibraryProps.current?.onPlaceCatalogFamily as (placement: unknown) => Promise<void>
      )({
        catalogId: 'bathroom-fixtures',
        catalogName: 'Bathroom Fixtures',
        catalogVersion: '1.0.0',
        family: {
          id: assetId,
          name: 'Toilet',
          discipline: 'generic',
          params: [],
          defaultTypes: [],
          geometry: [],
        },
        defaultType: {
          id: `${assetId}:standard`,
          name: 'Toilet',
          familyId: assetId,
          discipline: 'generic',
          parameters: { widthMm: 400, depthMm: 700 },
        },
        assetEntry: {
          id: assetId,
          assetKind: 'family_instance',
          name: 'Toilet',
          tags: ['bathroom', 'bathroom-fixtures', 'Bathroom Fixtures', 'generic'],
          category: 'bathroom',
          thumbnailKind: 'schematic_plan',
          thumbnailMm: { widthMm: 400, heightMm: 700 },
          planSymbolKind: 'toilet',
          renderProxyKind: 'toilet',
          description: 'Bathroom Fixtures · 1 type',
        },
      });
    });
    now.mockRestore();

    expect(mockApplyCommandBundle).toHaveBeenCalledWith(
      'model-array-formulas',
      [
        expect.objectContaining({ type: 'upsertFamilyType', id: typeId }),
        expect.objectContaining({
          type: 'IndexAsset',
          id: assetId,
          category: 'bathroom',
          planSymbolKind: 'toilet',
          renderProxyKind: 'toilet',
          thumbnailWidthMm: 400,
          thumbnailHeightMm: 700,
        }),
      ],
      expect.objectContaining({ userId: 'component-tool' }),
    );
    expect(useBimStore.getState().elementsById[assetId]).toMatchObject({
      kind: 'asset_library_entry',
      planSymbolKind: 'toilet',
    });
    expect(activeComponentAssetId).toBe(assetId);
    expect(activeComponentFamilyTypeId).toBeNull();
    expect(useBimStore.getState().planTool).toBe('component');
  });

  it('moves free catalog placement from a section pane into a plan canvas', async () => {
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify({
        v: 1,
        tabs: [{ id: 'section:sec-1', kind: 'section', targetId: 'sec-1', label: 'Section · A' }],
        activeId: 'section:sec-1',
      }),
    );
    localStorage.setItem(
      PANE_LAYOUT_KEY,
      JSON.stringify({
        v: 1,
        layout: {
          focusedLeafId: 'pane-root',
          root: { kind: 'leaf', id: 'pane-root', tabId: 'section:sec-1' },
        },
      }),
    );
    const elements = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'Level 1', elevationMm: 0 },
      'sec-1': {
        kind: 'section_cut',
        id: 'sec-1',
        name: 'A',
        levelId: 'lvl-1',
        lineStartMm: { xMm: 0, yMm: 0 },
        lineEndMm: { xMm: 1000, yMm: 0 },
      },
      'ft-chair': {
        kind: 'family_type',
        id: 'ft-chair',
        name: 'Lounge Chair',
        familyId: 'catalog:living-room:chair',
        discipline: 'generic',
        parameters: { widthMm: 900, depthMm: 850 },
        catalogSource: {
          catalogId: 'living-room-furniture',
          familyId: 'catalog:living-room:chair',
          version: '1.0.0',
        },
      },
    } as unknown as Record<string, Element>;
    useBimStore.setState({ elementsById: elements });
    mockApplyCommandBundle.mockResolvedValueOnce({ revision: 4, elements, violations: [] });

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );

    await waitFor(() => expect(familyLibraryProps.current).not.toBeNull());
    await act(async () => {
      await (
        familyLibraryProps.current?.onPlaceCatalogFamily as (placement: unknown) => Promise<void>
      )({
        catalogId: 'living-room-furniture',
        catalogName: 'Living Room Furniture',
        catalogVersion: '1.0.0',
        family: {
          id: 'catalog:living-room:chair',
          name: 'Lounge Chair',
          discipline: 'generic',
          params: [],
          defaultTypes: [],
          geometry: [],
        },
        defaultType: {
          id: 'default',
          name: 'Lounge Chair',
          familyId: 'catalog:living-room:chair',
          discipline: 'generic',
          parameters: { widthMm: 900, depthMm: 850 },
        },
      });
    });

    await waitFor(() => {
      expect(getByTestId('stub-plan-canvas').dataset.activePlanTool).toBe('component');
    });
    expect(useBimStore.getState().planTool).toBe('component');
  });
});
