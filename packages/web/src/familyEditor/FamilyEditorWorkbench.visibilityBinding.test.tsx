/**
 * FAM-03 — Family editor "Visible When" UI flow.
 *
 * After authoring a sweep + a boolean parameter, the user should be
 * able to:
 *   - select the sweep, see a "Visible When" dropdown
 *   - bind to the boolean param
 *   - flip Show-when-true / Show-when-false
 *   - return to "Always" (binding stripped)
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { FamilyEditorWorkbench } from './FamilyEditorWorkbench';
import i18n from '../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
});

function authorBooleanParam(utils: ReturnType<typeof renderWithI18n>, key: string, label: string) {
  const { getAllByRole } = utils;
  fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
  const typeSelects = Array.from(utils.container.querySelectorAll('select')).filter((candidate) =>
    Array.from(candidate.options).some((option) => option.value === 'boolean'),
  );
  const typeSelect = typeSelects.at(-1);
  if (!typeSelect) {
    throw new Error('Parameter type select not found');
  }
  const row = typeSelect.closest('tr');
  if (!row) {
    throw new Error('Parameter row not found');
  }
  const textInputs = row.querySelectorAll(
    'input:not([type="number"])',
  ) as NodeListOf<HTMLInputElement>;
  fireEvent.change(textInputs[0]!, { target: { value: key } });
  fireEvent.change(textInputs[1]!, { target: { value: label } });
  fireEvent.change(typeSelect, { target: { value: 'boolean' } });
}

function authorSweep(utils: ReturnType<typeof renderWithI18n>) {
  const { getByText, getByLabelText, getAllByText } = utils;
  fireEvent.click(getByText('Sweep'));
  fireEvent.change(getByLabelText('path-sx'), { target: { value: '0' } });
  fireEvent.change(getByLabelText('path-sy'), { target: { value: '0' } });
  fireEvent.change(getByLabelText('path-ex'), { target: { value: '500' } });
  fireEvent.change(getByLabelText('path-ey'), { target: { value: '0' } });
  fireEvent.click(getAllByText('Add line')[0]);
  fireEvent.click(getByText(/Edit Profile/));
  const triangle: [string, string, string, string][] = [
    ['0', '0', '40', '0'],
    ['40', '0', '20', '40'],
    ['20', '40', '0', '0'],
  ];
  for (const [sx, sy, ex, ey] of triangle) {
    fireEvent.change(getByLabelText('profile-sx'), { target: { value: sx } });
    fireEvent.change(getByLabelText('profile-sy'), { target: { value: sy } });
    fireEvent.change(getByLabelText('profile-ex'), { target: { value: ex } });
    fireEvent.change(getByLabelText('profile-ey'), { target: { value: ey } });
    fireEvent.click(getByText('Add line'));
  }
  fireEvent.click(getByText(/Finish/));
}

describe('FAM-03 — Visible When UI', () => {
  it('lists boolean params + an Always sentinel after selecting a sweep', () => {
    const utils = renderWithI18n(<FamilyEditorWorkbench />);
    authorBooleanParam(utils, 'hasFrame', 'Has Frame');
    authorSweep(utils);
    fireEvent.click(utils.getByLabelText('select-sweep-0'));

    const select = utils.getByLabelText('Visible When') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('__always__');
    expect(options).toContain('hasFrame');
    expect(select.value).toBe('__always__');
  });

  it('binding to a boolean param flips the sweep summary text + reveals the when-true/when-false toggle', () => {
    const utils = renderWithI18n(<FamilyEditorWorkbench />);
    authorBooleanParam(utils, 'hasFrame', 'Has Frame');
    authorSweep(utils);
    fireEvent.click(utils.getByLabelText('select-sweep-0'));

    fireEvent.change(utils.getByLabelText('Visible When'), { target: { value: 'hasFrame' } });

    // Both radio buttons appear, defaulting to Show-when-true.
    const trueRadio = utils.getByLabelText('Show when true') as HTMLInputElement;
    const falseRadio = utils.getByLabelText('Show when false') as HTMLInputElement;
    expect(trueRadio.checked).toBe(true);
    expect(falseRadio.checked).toBe(false);

    // Sweep list shows the new "visible when hasFrame Show when true" annotation.
    const li = utils.getByTestId('sweep-0');
    expect(within(li).getByText(/hasFrame/)).toBeTruthy();
  });

  it('flipping the radio writes whenTrue: false', () => {
    const utils = renderWithI18n(<FamilyEditorWorkbench />);
    authorBooleanParam(utils, 'hasFrame', 'Has Frame');
    authorSweep(utils);
    fireEvent.click(utils.getByLabelText('select-sweep-0'));
    fireEvent.change(utils.getByLabelText('Visible When'), { target: { value: 'hasFrame' } });
    fireEvent.click(utils.getByLabelText('Show when false'));

    const falseRadio = utils.getByLabelText('Show when false') as HTMLInputElement;
    expect(falseRadio.checked).toBe(true);
    const li = utils.getByTestId('sweep-0');
    expect(within(li).getByText(/Show when false/)).toBeTruthy();
  });

  it('returning to Always strips the binding', () => {
    const utils = renderWithI18n(<FamilyEditorWorkbench />);
    authorBooleanParam(utils, 'hasFrame', 'Has Frame');
    authorSweep(utils);
    fireEvent.click(utils.getByLabelText('select-sweep-0'));
    fireEvent.change(utils.getByLabelText('Visible When'), { target: { value: 'hasFrame' } });
    fireEvent.change(utils.getByLabelText('Visible When'), { target: { value: '__always__' } });

    expect(utils.queryByLabelText('Show when true')).toBeNull();
    expect(utils.queryByLabelText('Show when false')).toBeNull();
    const li = utils.getByTestId('sweep-0');
    expect(within(li).queryByText(/visible when/)).toBeNull();
  });
});
