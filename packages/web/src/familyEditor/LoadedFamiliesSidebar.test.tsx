import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import i18n from '../i18n';
import { LoadedFamiliesSidebar, NESTED_FAMILY_DRAG_TYPE } from './LoadedFamiliesSidebar';
import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import { FamilyEditorWorkbench } from './FamilyEditorWorkbench';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
});

describe('FAM-01 — <LoadedFamiliesSidebar />', () => {
  it('lists every family with its usage count', () => {
    const families = BUILT_IN_FAMILIES.slice(0, 2);
    const usageCounts: Record<string, number> = { [families[0].id]: 3 };
    const onAdd = vi.fn();
    const { getByTestId } = renderWithI18n(
      <LoadedFamiliesSidebar families={families} usageCounts={usageCounts} onAddInstance={onAdd} />,
    );
    expect(getByTestId(`loaded-family-${families[0].id}`)).toBeTruthy();
    expect(getByTestId(`loaded-family-${families[1].id}`)).toBeTruthy();
    expect(getByTestId(`loaded-family-count-${families[0].id}`).textContent).toContain('3');
    expect(getByTestId(`loaded-family-count-${families[1].id}`).textContent).toContain('0');
  });

  it('clicking the inline Add button calls onAddInstance with the family id', () => {
    const fam = BUILT_IN_FAMILIES[0];
    const onAdd = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <LoadedFamiliesSidebar families={[fam]} usageCounts={{}} onAddInstance={onAdd} />,
    );
    fireEvent.click(getByLabelText(`Add ${fam.name} to canvas`));
    expect(onAdd).toHaveBeenCalledWith(fam.id);
  });

  it('dragstart sets the family id on the drag payload', () => {
    const fam = BUILT_IN_FAMILIES[0];
    const { getByTestId } = renderWithI18n(
      <LoadedFamiliesSidebar families={[fam]} usageCounts={{}} onAddInstance={vi.fn()} />,
    );
    const row = getByTestId(`loaded-family-${fam.id}`);
    const setData = vi.fn();
    const dataTransfer = {
      setData,
      effectAllowed: '',
      dropEffect: '',
      types: [],
      files: [],
      items: [],
      getData: () => '',
      clearData: () => undefined,
      setDragImage: () => undefined,
    } as unknown as DataTransfer;
    fireEvent.dragStart(row, { dataTransfer });
    expect(setData).toHaveBeenCalledWith(NESTED_FAMILY_DRAG_TYPE, fam.id);
    expect(setData).toHaveBeenCalledWith('text/plain', fam.id);
  });

  it('shows an empty hint when no families are passed', () => {
    const { getByText } = renderWithI18n(
      <LoadedFamiliesSidebar families={[]} usageCounts={{}} onAddInstance={vi.fn()} />,
    );
    expect(getByText('No families compatible with this host.')).toBeTruthy();
  });
});

describe('FAM-01 — drag-drop emits addNestedFamilyInstance via the workbench', () => {
  function dispatchDrop(
    target: HTMLElement,
    familyId: string,
    point: { clientX: number; clientY: number } = { clientX: 0, clientY: 0 },
  ) {
    const dataTransfer = {
      types: [NESTED_FAMILY_DRAG_TYPE],
      getData: (k: string) => (k === NESTED_FAMILY_DRAG_TYPE ? familyId : ''),
      setData: () => undefined,
      effectAllowed: 'copy',
      dropEffect: 'copy',
      files: [],
      items: [],
      clearData: () => undefined,
      setDragImage: () => undefined,
    } as unknown as DataTransfer;
    fireEvent.dragOver(target, { dataTransfer, ...point });
    fireEvent.drop(target, { dataTransfer, ...point });
  }

  it('drops a family entry into the editing canvas → emits addNestedFamilyInstance', () => {
    const { getByTestId } = renderWithI18n(<FamilyEditorWorkbench />);
    const canvas = getByTestId('family-editing-canvas');
    const fam = BUILT_IN_FAMILIES[0];
    dispatchDrop(canvas, fam.id);
    const action = getByTestId('last-nested-action');
    expect(action.dataset.familyId).toBe(fam.id);
    expect(getByTestId('nested-instance-0')).toBeTruthy();
  });
});
