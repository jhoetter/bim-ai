import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const familyLibraryProps: { current: Record<string, unknown> | null } = { current: null };

vi.mock('../Viewport', () => ({
  Viewport: () => <div data-testid="stub-viewport" />,
}));

vi.mock('../plan/PlanCanvas', () => ({
  PlanCanvas: () => <div data-testid="stub-plan-canvas" />,
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

describe('<Workspace /> family library array formula persistence', () => {
  beforeEach(() => {
    familyLibraryProps.current = null;
    mockApplyCommand.mockReset();
    mockApplyCommandBundle.mockReset();
    mockBootstrap.mockReset();
    mockApplyCommand.mockResolvedValue({ revision: 2, elements: {}, violations: [] });
    mockApplyCommandBundle.mockResolvedValue({ revision: 3, elements: {}, violations: [] });
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
});
