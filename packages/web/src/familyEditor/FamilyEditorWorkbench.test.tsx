import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { FamilyEditorWorkbench } from './FamilyEditorWorkbench';
import i18n from '../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
});

describe('<FamilyEditorWorkbench />', () => {
  it('renders template chooser', () => {
    const { getByText } = renderWithI18n(<FamilyEditorWorkbench />);
    expect(getByText('Generic Model')).toBeTruthy();
    expect(getByText('Door')).toBeTruthy();
    expect(getByText('Window')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
  });

  it('add horizontal reference plane', () => {
    const { getByText } = renderWithI18n(<FamilyEditorWorkbench />);
    fireEvent.click(getByText('Add horizontal'));
    expect(getByText('H')).toBeTruthy();
  });

  it('add parameter', () => {
    const { getAllByRole } = renderWithI18n(<FamilyEditorWorkbench />);
    fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
    expect(getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('load into project stub', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByText } = renderWithI18n(<FamilyEditorWorkbench />);
    fireEvent.click(getByText('Load into Project'));
    expect(warnSpy).toHaveBeenCalledWith('load-into-project stub', expect.anything());
    warnSpy.mockRestore();
  });
});
