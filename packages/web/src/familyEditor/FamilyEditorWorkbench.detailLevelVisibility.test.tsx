/**
 * VIE-02 — family editor properties-panel checkboxes set
 * `visibilityByDetailLevel` on the selected geometry node.
 *
 * Walks the existing FAM-02 sweep-authoring flow to add a sweep, then
 * toggles the new Coarse checkbox and verifies the saved sweep node
 * carries `visibilityByDetailLevel.coarse === false`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { FamilyEditorWorkbench } from './FamilyEditorWorkbench';
import { FAMILY_EDITOR_DOCUMENT_PARAM } from './familyEditorPersistence';
import i18n from '../i18n';

function renderWithI18n(ui: React.ReactElement): RenderResult {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
});

function authorOneSweep(view: RenderResult): void {
  const { getByText, getByLabelText, getAllByText } = view;
  fireEvent.click(getByText('Sweep'));
  fireEvent.change(getByLabelText('path-sx'), { target: { value: '0' } });
  fireEvent.change(getByLabelText('path-sy'), { target: { value: '0' } });
  fireEvent.change(getByLabelText('path-ex'), { target: { value: '1000' } });
  fireEvent.change(getByLabelText('path-ey'), { target: { value: '0' } });
  fireEvent.click(getAllByText('Add line')[0]);
  fireEvent.click(getByText(/Edit Profile/));

  const addProfileLine = (sx: string, sy: string, ex: string, ey: string) => {
    fireEvent.change(getByLabelText('profile-sx'), { target: { value: sx } });
    fireEvent.change(getByLabelText('profile-sy'), { target: { value: sy } });
    fireEvent.change(getByLabelText('profile-ex'), { target: { value: ex } });
    fireEvent.change(getByLabelText('profile-ey'), { target: { value: ey } });
    fireEvent.click(getByText('Add line'));
  };
  addProfileLine('0', '0', '50', '0');
  addProfileLine('50', '0', '25', '50');
  addProfileLine('25', '50', '0', '0');

  fireEvent.click(getByText(/Finish/));
}

describe('VIE-02 — family editor visibility-by-detail-level UI', () => {
  it('properties panel exposes the visibility-by-detail row once a sweep is selected', () => {
    const view = renderWithI18n(<FamilyEditorWorkbench />);
    authorOneSweep(view);
    fireEvent.click(view.getByLabelText('select-sweep-0'));
    expect(view.queryByLabelText('Visibility by detail level')).not.toBeNull();
  });

  it('renders three checkboxes (coarse / medium / fine), all checked by default', () => {
    const view = renderWithI18n(<FamilyEditorWorkbench />);
    authorOneSweep(view);
    fireEvent.click(view.getByLabelText('select-sweep-0'));
    const coarse = view.getByLabelText('visibility-coarse') as HTMLInputElement;
    const medium = view.getByLabelText('visibility-medium') as HTMLInputElement;
    const fine = view.getByLabelText('visibility-fine') as HTMLInputElement;
    expect(coarse.checked).toBe(true);
    expect(medium.checked).toBe(true);
    expect(fine.checked).toBe(true);
  });

  it('unchecking the Coarse box stamps visibilityByDetailLevel.coarse=false on the sweep', async () => {
    const onLoadIntoProject = vi.fn();
    const view = renderWithI18n(
      <FamilyEditorWorkbench storage={null} onLoadIntoProject={onLoadIntoProject} />,
    );
    authorOneSweep(view);
    fireEvent.click(view.getByLabelText('select-sweep-0'));

    const coarse = view.getByLabelText('visibility-coarse') as HTMLInputElement;
    fireEvent.click(coarse);
    expect(coarse.checked).toBe(false);

    fireEvent.click(view.getByTestId('family-load-into-project'));
    await waitFor(() => expect(onLoadIntoProject).toHaveBeenCalledTimes(1));
    const payload = onLoadIntoProject.mock.calls[0][0].command.parameters[
      FAMILY_EDITOR_DOCUMENT_PARAM
    ] as {
      sweeps: Array<{ visibilityByDetailLevel?: Record<string, boolean> }>;
    };
    expect(payload.sweeps[0].visibilityByDetailLevel?.coarse).toBe(false);
    // Medium / fine remain unset (= visible by default).
    expect(payload.sweeps[0].visibilityByDetailLevel?.medium ?? true).toBe(true);
    expect(payload.sweeps[0].visibilityByDetailLevel?.fine ?? true).toBe(true);
  });

  it('toggling all three boxes off independently records every binding', async () => {
    const onLoadIntoProject = vi.fn();
    const view = renderWithI18n(
      <FamilyEditorWorkbench storage={null} onLoadIntoProject={onLoadIntoProject} />,
    );
    authorOneSweep(view);
    fireEvent.click(view.getByLabelText('select-sweep-0'));
    fireEvent.click(view.getByLabelText('visibility-coarse'));
    fireEvent.click(view.getByLabelText('visibility-medium'));
    fireEvent.click(view.getByLabelText('visibility-fine'));
    fireEvent.click(view.getByTestId('family-load-into-project'));
    await waitFor(() => expect(onLoadIntoProject).toHaveBeenCalledTimes(1));
    const payload = onLoadIntoProject.mock.calls[0][0].command.parameters[
      FAMILY_EDITOR_DOCUMENT_PARAM
    ] as {
      sweeps: Array<{ visibilityByDetailLevel?: Record<string, boolean> }>;
    };
    expect(payload.sweeps[0].visibilityByDetailLevel?.coarse).toBe(false);
    expect(payload.sweeps[0].visibilityByDetailLevel?.medium).toBe(false);
    expect(payload.sweeps[0].visibilityByDetailLevel?.fine).toBe(false);
  });
});
