import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VVDialog } from './VVDialog';
import { useBimStore } from '../../state/store';
import type { VGFilter } from '@bim-ai/core';

beforeEach(() => {
  useBimStore.setState({
    modelId: 'model-1',
    activePlanViewId: 'pv-1',
    elementsById: {
      'pv-1': {
        kind: 'plan_view',
        id: 'pv-1',
        name: 'Level 1',
        levelId: 'lv-1',
        vgFilters: [] as VGFilter[],
      },
    },
  });
});

afterEach(() => {
  cleanup();
});

function openFiltersTab(applyCommandImpl?: ReturnType<typeof vi.fn>) {
  const result = render(
    <VVDialog open={true} onClose={vi.fn()} applyCommandImpl={applyCommandImpl} />,
  );
  fireEvent.click(screen.getByTestId('vv-tab-filters'));
  return result;
}

describe('<VVDialog /> Filters tab', () => {
  it('"New filter" button adds a row to the filter list', async () => {
    const apply = vi.fn().mockResolvedValue({ ok: true });
    openFiltersTab(apply);

    fireEvent.click(screen.getByTestId('vv-new-filter'));

    expect(apply).toHaveBeenCalledOnce();
    const [, cmd] = apply.mock.calls[0] as [
      string,
      { type: string; patch: { vgFilters: VGFilter[] } },
    ];
    expect(cmd.type).toBe('updateElement');
    expect(cmd.patch.vgFilters).toHaveLength(1);
    expect(cmd.patch.vgFilters[0].name).toBe('New Filter');
  });

  it('deleting a filter removes it from the list and dispatches updateElement', async () => {
    const existingFilter: VGFilter = {
      id: 'f-existing',
      name: 'My Filter',
      categories: [],
      rules: [],
      override: {},
    };
    useBimStore.setState({
      modelId: 'model-1',
      activePlanViewId: 'pv-1',
      elementsById: {
        'pv-1': {
          kind: 'plan_view',
          id: 'pv-1',
          name: 'Level 1',
          levelId: 'lv-1',
          vgFilters: [existingFilter],
        },
      },
    });

    const apply = vi.fn().mockResolvedValue({ ok: true });
    openFiltersTab(apply);

    expect(screen.getByTestId('vv-filter-row-f-existing')).toBeTruthy();

    fireEvent.click(screen.getByTestId('vv-delete-filter-f-existing'));

    expect(apply).toHaveBeenCalledOnce();
    const [, cmd] = apply.mock.calls[0] as [
      string,
      { type: string; patch: { vgFilters: VGFilter[] } },
    ];
    expect(cmd.type).toBe('updateElement');
    expect(cmd.patch.vgFilters).toHaveLength(0);
  });

  it('selecting a filter shows its name in the editor', () => {
    const existingFilter: VGFilter = {
      id: 'f-sel',
      name: 'Selection Test',
      categories: ['wall'],
      rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: {},
    };
    useBimStore.setState({
      modelId: 'model-1',
      activePlanViewId: 'pv-1',
      elementsById: {
        'pv-1': {
          kind: 'plan_view',
          id: 'pv-1',
          name: 'Level 1',
          levelId: 'lv-1',
          vgFilters: [existingFilter],
        },
      },
    });

    openFiltersTab();

    fireEvent.click(screen.getByTestId('vv-filter-row-f-sel'));

    const nameInput = screen.getByTestId('vv-filter-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Selection Test');

    const catCheckbox = screen.getByTestId('vv-filter-cat-wall') as HTMLInputElement;
    expect(catCheckbox.checked).toBe(true);
  });

  it('changing filter name dispatches updated vgFilters array', async () => {
    const existingFilter: VGFilter = {
      id: 'f-rename',
      name: 'Old Name',
      categories: [],
      rules: [],
      override: {},
    };
    useBimStore.setState({
      modelId: 'model-1',
      activePlanViewId: 'pv-1',
      elementsById: {
        'pv-1': {
          kind: 'plan_view',
          id: 'pv-1',
          name: 'Level 1',
          levelId: 'lv-1',
          vgFilters: [existingFilter],
        },
      },
    });

    const apply = vi.fn().mockResolvedValue({ ok: true });
    openFiltersTab(apply);

    fireEvent.click(screen.getByTestId('vv-filter-row-f-rename'));

    const nameInput = screen.getByTestId('vv-filter-name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    expect(apply).toHaveBeenCalledOnce();
    const [, cmd] = apply.mock.calls[0] as [
      string,
      { type: string; patch: { vgFilters: VGFilter[] } },
    ];
    expect(cmd.type).toBe('updateElement');
    expect(cmd.patch.vgFilters[0].name).toBe('New Name');
  });
});
