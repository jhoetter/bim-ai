import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { FamilyEditorWorkbench, resolveFamilyParamValue } from './FamilyEditorWorkbench';
import i18n from '../i18n';
import { listMaterials } from '../viewport/materials';

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

describe('FAM-09 — flex test mode', () => {
  it('flex sidebar is hidden until Flex toggle is on', () => {
    const { queryByLabelText, getByText } = renderWithI18n(<FamilyEditorWorkbench />);
    expect(queryByLabelText('Flex parameter sidebar')).toBeNull();
    fireEvent.click(getByText('Flex'));
    expect(queryByLabelText('Flex parameter sidebar')).not.toBeNull();
  });

  it('flex value overrides default at canvas resolution time', () => {
    const { getByText, getByLabelText, getByTestId, getAllByRole } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );

    // Author one parameter named "Width" with default 1200
    fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
    const textInputs = getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(textInputs[0], { target: { value: 'Width' } });
    fireEvent.change(textInputs[1], { target: { value: 'Width' } });
    const numericInputs = getAllByRole('spinbutton') as HTMLInputElement[];
    fireEvent.change(numericInputs[0], { target: { value: '1200' } });

    // Enter flex mode
    fireEvent.click(getByText('Flex'));

    // Type 1500 in the flex input for Width
    const flexInput = getByLabelText('flex-Width') as HTMLInputElement;
    fireEvent.change(flexInput, { target: { value: '1500' } });

    // Resolved value reflects the flex override
    expect(getByTestId('resolved-Width').textContent).toContain('1500');
  });

  it('exiting flex mode discards flex values; defaults unchanged', () => {
    const { getByText, getByLabelText, queryByLabelText, getAllByRole } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );

    fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
    const textInputs = getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(textInputs[0], { target: { value: 'Width' } });
    fireEvent.change(textInputs[1], { target: { value: 'Width' } });
    const defaultInput = (getAllByRole('spinbutton') as HTMLInputElement[])[0];
    fireEvent.change(defaultInput, { target: { value: '1200' } });

    fireEvent.click(getByText('Flex'));
    fireEvent.change(getByLabelText('flex-Width'), { target: { value: '1500' } });

    // Exit flex mode
    fireEvent.click(getByText('Flex'));
    // Sidebar gone
    expect(queryByLabelText('Flex parameter sidebar')).toBeNull();

    // Default value is still 1200 (not overwritten)
    const defaultAfter = (getAllByRole('spinbutton') as HTMLInputElement[])[0];
    expect(defaultAfter.value).toBe('1200');

    // Re-entering flex shows empty input again (flex values discarded)
    fireEvent.click(getByText('Flex'));
    expect((getByLabelText('flex-Width') as HTMLInputElement).value).toBe('');
  });

  it('Reset button clears flex values without exiting flex mode', () => {
    const { getByText, getByLabelText, getAllByRole } = renderWithI18n(<FamilyEditorWorkbench />);
    fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
    fireEvent.click(getByText('Flex'));
    const flexInput = getByLabelText('flex-param_1') as HTMLInputElement;
    fireEvent.change(flexInput, { target: { value: '999' } });
    expect(flexInput.value).toBe('999');
    fireEvent.click(getByText('Reset'));
    expect((getByLabelText('flex-param_1') as HTMLInputElement).value).toBe('');
  });
});

describe('FAM material browser parity', () => {
  it('assigns material defaults to material_key family parameters', () => {
    const material = listMaterials()[0]!;
    const { getAllByRole, getByTestId } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
    fireEvent.change(getAllByRole('combobox')[0], { target: { value: 'material_key' } });
    fireEvent.click(getByTestId('material-default-editor').querySelector('button')!);
    fireEvent.click(getByTestId(`material-assign-${material.key}`));

    expect(getByTestId('material-default-label').textContent).toContain(material.displayName);
  });

  it('replaces material defaults from the appearance asset browser', () => {
    const material = listMaterials().find((candidate) => candidate.category === 'glass')!;
    const { getAllByRole, getByText, getByTestId, getByLabelText } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );

    fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
    fireEvent.change(getAllByRole('combobox')[0], { target: { value: 'material_key' } });
    fireEvent.click(getByText('Asset Browser'));
    expect(getByLabelText('Appearance Asset Browser')).toBeTruthy();
    fireEvent.change(getByLabelText('Search materials'), {
      target: { value: material.displayName },
    });
    fireEvent.click(getByTestId(`material-assign-${material.key}`));

    expect(getByTestId('material-default-label').textContent).toContain(material.displayName);
  });

  it('assigns a material to selected sweep geometry', () => {
    const material = listMaterials().find((candidate) => candidate.category === 'concrete')!;
    const { getByText, getByLabelText, getByTestId, getAllByText } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );
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

    fireEvent.click(getByLabelText('select-sweep-0'));
    fireEvent.click(getByText('Browse'));
    fireEvent.change(getByLabelText('Search materials'), {
      target: { value: material.displayName },
    });
    fireEvent.click(getByTestId(`material-assign-${material.key}`));

    expect(getByTestId('selected-sweep-material').textContent).toContain(material.displayName);
  });
});

describe('FAM-02 — sweep tool flow', () => {
  it('opens a sketch session when Sweep is clicked', () => {
    const { getByText, queryByLabelText } = renderWithI18n(<FamilyEditorWorkbench />);
    expect(queryByLabelText('Sweep sketch session')).toBeNull();
    fireEvent.click(getByText('Sweep'));
    expect(queryByLabelText('Sweep sketch session')).not.toBeNull();
  });

  it('locks Edit Profile until at least one path segment is added', () => {
    const { getByText } = renderWithI18n(<FamilyEditorWorkbench />);
    fireEvent.click(getByText('Sweep'));
    const advanceBtn = getByText(/Edit Profile/);
    expect((advanceBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('finishing the flow appends a sweep node to the family', () => {
    const { getByText, getByLabelText, queryByTestId, getAllByText } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );
    fireEvent.click(getByText('Sweep'));

    // Path: one straight segment (0,0)→(1000,0)
    fireEvent.change(getByLabelText('path-sx'), { target: { value: '0' } });
    fireEvent.change(getByLabelText('path-sy'), { target: { value: '0' } });
    fireEvent.change(getByLabelText('path-ex'), { target: { value: '1000' } });
    fireEvent.change(getByLabelText('path-ey'), { target: { value: '0' } });
    fireEvent.click(getAllByText('Add line')[0]);
    fireEvent.click(getByText(/Edit Profile/));

    // Profile: 3-line triangle
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
    expect(queryByTestId('sweep-0')).not.toBeNull();
  });

  it('picks a locked reference plane into the profile and follows offset edits', () => {
    const { getByText, getByLabelText, getByTestId, getAllByText } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );
    fireEvent.click(getByText('Add vertical'));
    fireEvent.click(getByText('Sweep'));

    fireEvent.click(getAllByText('Add line')[0]);
    fireEvent.click(getByText(/Edit Profile/));
    fireEvent.click(getByTestId('profile-pick-reference-plane'));
    expect(getByTestId('sweep-profile-list').textContent).toContain('locked');

    fireEvent.change(getByLabelText('ref-plane-offset-0'), { target: { value: '300' } });
    expect(getByTestId('sweep-profile-list').textContent).toContain('(300, -1000)');
    expect(getByTestId('sweep-profile-list').textContent).toContain('(300, 1000)');
  });

  it('trims and extends two profile lines to a clean corner', () => {
    const { getByText, getByLabelText, getByTestId, getAllByText } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );
    fireEvent.click(getByText('Sweep'));
    fireEvent.click(getAllByText('Add line')[0]);
    fireEvent.click(getByText(/Edit Profile/));

    const addProfileLine = (sx: string, sy: string, ex: string, ey: string) => {
      fireEvent.change(getByLabelText('profile-sx'), { target: { value: sx } });
      fireEvent.change(getByLabelText('profile-sy'), { target: { value: sy } });
      fireEvent.change(getByLabelText('profile-ex'), { target: { value: ex } });
      fireEvent.change(getByLabelText('profile-ey'), { target: { value: ey } });
      fireEvent.click(getByText('Add line'));
    };
    addProfileLine('0', '0', '10', '0');
    addProfileLine('12', '-5', '12', '10');

    fireEvent.click(getByTestId('profile-trim-extend'));
    const profileText = getByTestId('sweep-profile-list').textContent ?? '';
    expect(profileText).toContain('(12, 0)');
  });
});

describe('resolveFamilyParamValue', () => {
  const param = {
    key: 'Width',
    label: 'Width',
    type: 'length_mm' as const,
    default: 1200,
    formula: '',
  };

  it('returns default when no overrides given', () => {
    expect(resolveFamilyParamValue(param)).toBe(1200);
  });

  it('returns default when overrides do not contain key', () => {
    expect(resolveFamilyParamValue(param, { Other: 99 })).toBe(1200);
  });

  it('returns override when present and non-empty', () => {
    expect(resolveFamilyParamValue(param, { Width: 1500 })).toBe(1500);
  });

  it('falls back to default when override is empty string', () => {
    expect(resolveFamilyParamValue(param, { Width: '' })).toBe(1200);
  });
});
