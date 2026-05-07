/**
 * FAM-05 — Array tool UI flow.
 *
 * Click the Array button → fill out a target family + count param +
 * spacing → Finish. The new array node should appear in the Arrays
 * list, and the Finish button should remain disabled while the form
 * is incomplete.
 */
import { afterEach, describe, expect, it } from 'vitest';
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

function authorNumericParam(utils: ReturnType<typeof renderWithI18n>, key: string, label: string) {
  const { getAllByRole } = utils;
  fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
  const textInputs = getAllByRole('textbox') as HTMLInputElement[];
  // Each param row contributes 3 textboxes (key, label, formula) — write to
  // the last freshly-added row so successive calls don't overwrite earlier
  // params. The row's <select> defaults to length_mm; leave it so the param
  // shows up in the Array tool's numeric-param dropdowns.
  const last = textInputs.length;
  fireEvent.change(textInputs[last - 3], { target: { value: key } });
  fireEvent.change(textInputs[last - 2], { target: { value: label } });
}

describe('FAM-05 — Array tool UI', () => {
  it('opens an array authoring session when Array is clicked', () => {
    const { getByText, queryByLabelText } = renderWithI18n(<FamilyEditorWorkbench />);
    expect(queryByLabelText('Array authoring session')).toBeNull();
    fireEvent.click(getByText('Array'));
    expect(queryByLabelText('Array authoring session')).not.toBeNull();
  });

  it('Finish stays disabled until target + count param are set', () => {
    const utils = renderWithI18n(<FamilyEditorWorkbench />);
    authorNumericParam(utils, 'chairCount', 'Chair Count');
    fireEvent.click(utils.getByText('Array'));

    const finish = utils.getByText(/Finish/);
    expect((finish as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(utils.getByLabelText('Target family'), {
      target: { value: 'fam:chair' },
    });
    expect((finish as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(utils.getByLabelText('Count parameter'), {
      target: { value: 'chairCount' },
    });
    expect((finish as HTMLButtonElement).disabled).toBe(false);
  });

  it('completing the flow appends an array node to the family', () => {
    const utils = renderWithI18n(<FamilyEditorWorkbench />);
    authorNumericParam(utils, 'chairCount', 'Chair Count');
    fireEvent.click(utils.getByText('Array'));
    fireEvent.change(utils.getByLabelText('Target family'), {
      target: { value: 'fam:chair' },
    });
    fireEvent.change(utils.getByLabelText('Count parameter'), {
      target: { value: 'chairCount' },
    });
    fireEvent.click(utils.getByText(/Finish/));

    expect(utils.queryByTestId('array-0')).not.toBeNull();
    // Default mode is linear; sanity-check the label.
    expect(utils.getByTestId('array-0').textContent).toContain('linear');
    expect(utils.getByTestId('array-0').textContent).toContain('chairCount');
  });

  it('switching to fit_total spacing requires a totalLengthParam before Finish', () => {
    const utils = renderWithI18n(<FamilyEditorWorkbench />);
    authorNumericParam(utils, 'chairCount', 'Chair Count');
    authorNumericParam(utils, 'tableWidth', 'Table Width');
    fireEvent.click(utils.getByText('Array'));
    fireEvent.change(utils.getByLabelText('Target family'), {
      target: { value: 'fam:chair' },
    });
    fireEvent.change(utils.getByLabelText('Count parameter'), {
      target: { value: 'chairCount' },
    });
    fireEvent.change(utils.getByLabelText('Spacing'), {
      target: { value: 'fit_total' },
    });

    const finish = utils.getByText(/Finish/);
    expect((finish as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(utils.getByLabelText('Fit total length param'), {
      target: { value: 'tableWidth' },
    });
    expect((finish as HTMLButtonElement).disabled).toBe(false);
  });
});
