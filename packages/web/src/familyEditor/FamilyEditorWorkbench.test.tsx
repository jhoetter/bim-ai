import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { FamilyEditorWorkbench, resolveFamilyParamValue } from './FamilyEditorWorkbench';
import i18n from '../i18n';
import { listMaterials } from '../viewport/materials';
import { FAMILY_EDITOR_DOCUMENT_PARAM } from './familyEditorPersistence';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

function parameterTypeSelect(comboboxes: HTMLElement[]): HTMLSelectElement {
  const select = comboboxes.find((candidate) =>
    Array.from((candidate as HTMLSelectElement).options ?? []).some(
      (option) => option.value === 'material_key',
    ),
  );
  if (!select) throw new Error('Parameter type select not found');
  return select as HTMLSelectElement;
}

function parameterTableControls(getByText: (text: string) => HTMLElement) {
  const table = getByText('Key').closest('table');
  if (!table) throw new Error('Parameter table not found');
  return within(table);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('<FamilyEditorWorkbench />', () => {
  it('renders template chooser', () => {
    const { getByText } = renderWithI18n(<FamilyEditorWorkbench />);
    expect(getByText('Generic Model')).toBeTruthy();
    expect(getByText('Door')).toBeTruthy();
    expect(getByText('Window')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
    expect(getByText('Furniture', { selector: 'button' })).toBeTruthy();
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

  it('saves and opens an authored family document', () => {
    const { getByLabelText, getByTestId, getByText } = renderWithI18n(
      <FamilyEditorWorkbench now={() => 1000} />,
    );

    fireEvent.change(getByLabelText('Family name'), { target: { value: 'Casework Bench' } });
    fireEvent.change(getByLabelText('Family id'), { target: { value: 'fam:casework:bench' } });
    fireEvent.click(getByText('Add parameter'));
    fireEvent.change(getByLabelText('Family name'), { target: { value: 'Temporary Name' } });

    fireEvent.click(getByTestId('family-save'));
    expect(getByTestId('family-persistence-message').textContent).toContain('Temporary Name');

    fireEvent.change(getByLabelText('Family name'), { target: { value: 'Unsaved Name' } });
    fireEvent.change(getByLabelText('Open saved family'), {
      target: { value: 'fam:casework:bench' },
    });

    expect((getByLabelText('Family name') as HTMLInputElement).value).toBe('Temporary Name');
    expect(getByTestId('family-persistence-message').textContent).toContain('Opened');
  });

  it('loads an authored family into the project as an upsertFamilyType command', async () => {
    const onLoadIntoProject = vi.fn();
    const { getByLabelText, getByTestId } = renderWithI18n(
      <FamilyEditorWorkbench now={() => 2000} onLoadIntoProject={onLoadIntoProject} />,
    );

    fireEvent.change(getByLabelText('Family name'), { target: { value: 'Casework Bench' } });
    fireEvent.change(getByLabelText('Family id'), { target: { value: 'fam:casework:bench' } });
    fireEvent.click(getByTestId('family-load-into-project'));

    await waitFor(() => expect(onLoadIntoProject).toHaveBeenCalledTimes(1));
    expect(onLoadIntoProject.mock.calls[0][0]).toMatchObject({
      typeId: 'ft-fam_casework_bench-1jk',
      reloaded: false,
      command: {
        type: 'upsertFamilyType',
        name: 'Type 1',
        familyId: 'fam:casework:bench',
        discipline: 'generic',
      },
    });
  });

  it('creates a local project family_type when no host project callback is supplied', () => {
    const { getByLabelText, getByTestId, getByRole } = renderWithI18n(
      <FamilyEditorWorkbench now={() => 2000} />,
    );

    fireEvent.change(getByLabelText('Family name'), { target: { value: 'Casework Bench' } });
    fireEvent.change(getByLabelText('Family id'), { target: { value: 'fam:casework:bench' } });
    fireEvent.click(getByTestId('family-load-into-project'));

    expect(getByTestId('family-persistence-message').textContent).toContain(
      'Loaded Casework Bench into project',
    );

    fireEvent.click(getByTestId('family-load-into-project'));

    expect(getByRole('dialog', { name: 'Reload Family' })).toBeTruthy();
  });

  it('prompts for keep-values or overwrite when loading over an existing authored family', async () => {
    const onLoadIntoProject = vi.fn();
    const existingDocument = {
      id: 'authored-family-1',
      name: 'Untitled Family',
      template: 'generic_model',
      categorySettings: {
        category: 'generic_model',
        alwaysVertical: false,
        workPlaneBased: false,
        roomCalculationPoint: false,
        shared: false,
      },
      viewRange: {
        topOffsetMm: 2300,
        cutPlaneOffsetMm: 1200,
        bottomOffsetMm: 0,
        viewDepthOffsetMm: -1200,
      },
      refPlanes: [],
      params: [],
      familyTypes: [{ id: 'family-type-1', name: 'Type 1', values: {} }],
      activeFamilyTypeId: 'family-type-1',
      sweeps: [],
      arrays: [],
      nestedInstances: [],
      symbolicLines: [],
      dimensions: [],
      eqConstraints: [],
      savedAt: 1000,
      version: 'family-editor-1000',
    };
    const existingFamilyType = {
      kind: 'family_type',
      id: 'ft-existing',
      name: 'Project Type',
      familyId: 'authored-family-1',
      discipline: 'generic',
      parameters: {
        name: 'Project Type',
        familyId: 'authored-family-1',
        Width: 1800,
        [FAMILY_EDITOR_DOCUMENT_PARAM]: existingDocument,
      },
    } as const;

    const { getByTestId, getByRole } = renderWithI18n(
      <FamilyEditorWorkbench
        now={() => 3000}
        projectElementsById={{ 'ft-existing': existingFamilyType }}
        onLoadIntoProject={onLoadIntoProject}
      />,
    );

    fireEvent.click(getByTestId('family-load-into-project'));

    expect(getByRole('dialog', { name: 'Reload Family' })).toBeTruthy();
    fireEvent.click(getByTestId('family-reload-keep-values'));

    await waitFor(() => expect(onLoadIntoProject).toHaveBeenCalledTimes(1));
    expect(onLoadIntoProject.mock.calls[0][0]).toMatchObject({
      reloaded: true,
      overwriteOption: 'keep-existing-values',
      command: {
        id: 'ft-existing',
        parameters: { Width: 1800 },
      },
    });
  });
});

describe('FAM-075/FAM-079/FAM-081/FAM-085 — furniture template preset', () => {
  it('seeds a furniture family with ref planes, params, symbolic lines, sweeps, and types', () => {
    const { getByText, getAllByText, getByLabelText, getByTestId, getByDisplayValue } =
      renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.click(getByText('Furniture', { selector: 'button' }));

    expect((getByLabelText('Family category') as HTMLSelectElement).value).toBe('furniture');
    expect(getByDisplayValue('Center Left/Right')).toBeTruthy();
    expect(getByDisplayValue('Center Front/Back')).toBeTruthy();
    expect(getAllByText('Backrest Depth').length).toBeGreaterThan(0);
    expect(getByTestId('family-dimensions-list').textContent).toContain('Backrest_Depth');
    expect(getByLabelText('parameter-default-Show_2D_Elements')).toBeTruthy();
    expect((getByLabelText('parameter-default-Show_2D_Elements') as HTMLInputElement).checked).toBe(
      true,
    );
    expect(getByTestId('symbolic-lines-list').textContent).toContain('visible when');
    expect(getByTestId('preview-visibility-summary').textContent).toContain(
      '0/5 sweeps, 5/5 symbolic lines',
    );

    fireEvent.click(getByTestId('family-types-open'));
    expect(getByText('600 x 600 Chair')).toBeTruthy();
    expect(getByText('750 x 750 Lounge')).toBeTruthy();
  });

  it('uses detail level preview to swap coarse symbolic lines for medium 3D geometry', () => {
    const { getByText, getByLabelText, getByTestId } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.click(getByText('Furniture', { selector: 'button' }));
    fireEvent.change(getByLabelText('Preview detail level'), { target: { value: 'medium' } });

    expect(getByTestId('preview-visibility-summary').textContent).toContain(
      '0/5 sweeps, 0/5 symbolic lines',
    );

    fireEvent.click(getByLabelText('parameter-default-Show_2D_Elements'));

    expect(getByTestId('preview-visibility-summary').textContent).toContain(
      '5/5 sweeps, 0/5 symbolic lines',
    );
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
    const table = parameterTableControls(getByText);
    const textInputs = table.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(textInputs[0], { target: { value: 'Width' } });
    fireEvent.change(textInputs[1], { target: { value: 'Width' } });
    const numericInputs = table.getAllByRole('spinbutton') as HTMLInputElement[];
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
    const table = parameterTableControls(getByText);
    const textInputs = table.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(textInputs[0], { target: { value: 'Width' } });
    fireEvent.change(textInputs[1], { target: { value: 'Width' } });
    const defaultInput = (table.getAllByRole('spinbutton') as HTMLInputElement[])[0];
    fireEvent.change(defaultInput, { target: { value: '1200' } });

    fireEvent.click(getByText('Flex'));
    fireEvent.change(getByLabelText('flex-Width'), { target: { value: '1500' } });

    // Exit flex mode
    fireEvent.click(getByText('Flex'));
    // Sidebar gone
    expect(queryByLabelText('Flex parameter sidebar')).toBeNull();

    // Default value is still 1200 (not overwritten)
    const defaultAfter = (table.getAllByRole('spinbutton') as HTMLInputElement[])[0];
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
    fireEvent.change(parameterTypeSelect(getAllByRole('combobox')), {
      target: { value: 'material_key' },
    });
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
    fireEvent.change(parameterTypeSelect(getAllByRole('combobox')), {
      target: { value: 'material_key' },
    });
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

describe('FAM-056 — Family Types dialog', () => {
  it('edits active type parameter values and feeds the resolved preview', () => {
    const { getAllByRole, getByText, getByLabelText, getByTestId } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );

    fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
    fireEvent.click(getByTestId('family-types-open'));
    fireEvent.change(getByLabelText('family-type-value-param_1'), { target: { value: '1500' } });
    fireEvent.click(getByText('Close'));
    fireEvent.click(getByText('Flex'));

    expect(getByTestId('resolved-param_1').textContent).toContain('1500');
  });

  it('creates, renames, selects, and deletes family types', () => {
    const { getByTestId, getByLabelText, queryByText } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.click(getByTestId('family-types-open'));
    fireEvent.click(getByTestId('family-types-new'));
    fireEvent.change(getByLabelText('Family type name'), { target: { value: '900 x 2100' } });
    expect(queryByText('900 x 2100')).toBeTruthy();

    fireEvent.click(getByTestId('family-type-row-family-type-1'));
    expect((getByLabelText('Family type name') as HTMLInputElement).value).toBe('Type 1');
    fireEvent.click(getByTestId('family-type-row-family-type-2'));
    fireEvent.click(getByTestId('family-types-delete'));
    expect(queryByText('900 x 2100')).toBeNull();
  });
});

describe('FAM-054 — aligned dimensions', () => {
  it('creates a length parameter from an aligned reference-plane dimension', () => {
    const { getByText, getByLabelText, getByTestId, getAllByDisplayValue } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );

    fireEvent.click(getByText('Add vertical'));
    fireEvent.click(getByText('Add vertical'));
    fireEvent.change(getByLabelText('ref-plane-offset-1'), { target: { value: '1000' } });
    fireEvent.change(getByLabelText('dimension-parameter-name'), { target: { value: 'Width' } });
    fireEvent.click(getByTestId('dimension-create-parameter'));

    expect(getByTestId('family-dimensions-list').textContent).toContain('Width: 1000 mm');
    expect(getByTestId('family-dimension-canvas-dim-dim-1').textContent).toContain('Width');
    expect(getAllByDisplayValue('Width').length).toBeGreaterThan(0);
  });

  it('labels a dimension with an existing parameter and solves the reference-plane offset', () => {
    const { getByText, getByLabelText, getByTestId, getAllByRole } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );

    fireEvent.click(getAllByRole('button').find((b) => b.textContent === 'Add parameter')!);
    const table = parameterTableControls(getByText);
    const textInputs = table.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(textInputs[0], { target: { value: 'Depth' } });
    fireEvent.change(textInputs[1], { target: { value: 'Depth' } });
    const defaultInput = (table.getAllByRole('spinbutton') as HTMLInputElement[]).find(
      (input) => input.value === '0',
    )!;
    fireEvent.change(defaultInput, { target: { value: '750' } });

    fireEvent.click(getByText('Add vertical'));
    fireEvent.click(getByText('Add vertical'));
    fireEvent.change(getByLabelText('ref-plane-offset-1'), { target: { value: '1000' } });
    fireEvent.change(getByLabelText('dimension-label-mode'), {
      target: { value: 'existing' },
    });
    fireEvent.change(getByLabelText('dimension-existing-parameter'), {
      target: { value: 'Depth' },
    });
    fireEvent.click(getByTestId('dimension-create-parameter'));

    expect((getByLabelText('ref-plane-offset-1') as HTMLInputElement).value).toBe('750');
    expect(getByTestId('family-dimensions-list').textContent).toContain('Depth: 750 mm');
  });

  it('updates a labeled dimension through Family Types and drives the canvas references', () => {
    const { getByText, getByLabelText, getByTestId } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.click(getByText('Add vertical'));
    fireEvent.click(getByText('Add vertical'));
    fireEvent.change(getByLabelText('ref-plane-offset-1'), { target: { value: '1000' } });
    fireEvent.change(getByLabelText('dimension-parameter-name'), { target: { value: 'Width' } });
    fireEvent.click(getByTestId('dimension-create-parameter'));

    fireEvent.click(getByTestId('family-types-open'));
    fireEvent.change(getByLabelText('family-type-value-Width'), { target: { value: '1200' } });

    expect((getByLabelText('ref-plane-offset-1') as HTMLInputElement).value).toBe('1200');
    expect(getByTestId('family-dimensions-list').textContent).toContain('Width: 1200 mm');
  });
});

describe('FAM-050 — reference plane properties', () => {
  it('edits reference-plane name, strong/weak/not-reference classification, and lock state', () => {
    const { getByText, getByLabelText } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.click(getByText('Add vertical'));
    fireEvent.change(getByLabelText('ref-plane-name-0'), {
      target: { value: 'Latch Centerline' },
    });
    fireEvent.change(getByLabelText('ref-plane-reference-type-0'), {
      target: { value: 'strong_reference' },
    });
    fireEvent.click(getByLabelText('ref-plane-locked-0'));

    expect((getByLabelText('ref-plane-name-0') as HTMLInputElement).value).toBe('Latch Centerline');
    expect((getByLabelText('ref-plane-reference-type-0') as HTMLSelectElement).value).toBe(
      'strong_reference',
    );
    expect((getByLabelText('ref-plane-locked-0') as HTMLInputElement).checked).toBe(true);
  });
});

describe('FAM-076 — equal reference-plane dimensions', () => {
  it('equalizes matching reference planes and keeps gaps equal when an outer plane moves', () => {
    const { getByText, getByLabelText, getByTestId } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.click(getByText('Add vertical'));
    fireEvent.click(getByText('Add vertical'));
    fireEvent.click(getByText('Add vertical'));
    fireEvent.change(getByLabelText('ref-plane-offset-1'), { target: { value: '400' } });
    fireEvent.change(getByLabelText('ref-plane-offset-2'), { target: { value: '1000' } });

    fireEvent.click(getByTestId('dimension-eq-create'));

    expect((getByLabelText('ref-plane-offset-1') as HTMLInputElement).value).toBe('500');
    expect(getByTestId('family-eq-constraints-list').textContent).toContain('gap 500 mm');

    fireEvent.change(getByLabelText('ref-plane-offset-2'), { target: { value: '1200' } });

    expect((getByLabelText('ref-plane-offset-1') as HTMLInputElement).value).toBe('600');
    expect(getByTestId('family-eq-constraints-list').textContent).toContain('gap 600 mm');
  });
});

describe('FAM-065/FAM-066 — family category and view range settings', () => {
  it('edits family category parameter flags', () => {
    const { getByLabelText } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.change(getByLabelText('Family category'), {
      target: { value: 'detail_component' },
    });
    fireEvent.click(getByLabelText('Always Vertical'));
    fireEvent.click(getByLabelText('Work Plane-Based'));

    expect((getByLabelText('Family category') as HTMLSelectElement).value).toBe('detail_component');
    expect((getByLabelText('Always Vertical') as HTMLInputElement).checked).toBe(true);
    expect((getByLabelText('Work Plane-Based') as HTMLInputElement).checked).toBe(true);
  });

  it('edits family editor view range offsets', () => {
    const { getByLabelText, getByTestId } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.change(getByLabelText('Cut plane'), { target: { value: '1400' } });
    fireEvent.change(getByLabelText('View depth'), { target: { value: '-1600' } });

    expect(getByTestId('family-view-range-summary').textContent).toContain('Cut 1400 mm');
    expect(getByTestId('family-view-range-summary').textContent).toContain('depth -1600 mm');
  });
});

describe('FAM-067/FAM-071/FAM-072 — symbolic detail line authoring', () => {
  it('adds symbolic lines with opening and hidden-cut subcategories', () => {
    const { getByLabelText, getByTestId } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.change(getByLabelText('Symbolic line subcategory'), {
      target: { value: 'opening_projection' },
    });
    fireEvent.change(getByLabelText('symbolic-start-x'), { target: { value: '10' } });
    fireEvent.change(getByLabelText('symbolic-end-x'), { target: { value: '200' } });
    fireEvent.click(getByTestId('symbolic-line-add'));
    expect(getByTestId('symbolic-lines-list').textContent).toContain('Opening Projection');

    fireEvent.change(getByLabelText('Symbolic line subcategory'), {
      target: { value: 'hidden_cut' },
    });
    fireEvent.click(getByTestId('symbolic-line-add'));
    expect(getByTestId('symbolic-lines-list').textContent).toContain('Hidden Lines (Cut)');
    expect(getByTestId('symbolic-line-style-1').textContent).toContain('dashed');
    expect(getByTestId('symbolic-project-rendering-evidence').textContent).toContain(
      'Family: Hidden Lines (Cut):w2:dashed',
    );
    expect(getByTestId('symbolic-canvas-line-1').getAttribute('stroke-dasharray')).toBe('8 5');
  });

  it('draws symbolic lines from the canvas using the active subcategory style', () => {
    const { getByLabelText, getByTestId } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.change(getByLabelText('Symbolic line subcategory'), {
      target: { value: 'hidden_cut' },
    });
    fireEvent.click(getByTestId('symbolic-line-canvas'), { clientX: 240, clientY: 130 });
    expect(getByTestId('symbolic-canvas-start')).not.toBeNull();
    fireEvent.click(getByTestId('symbolic-line-canvas'), { clientX: 340, clientY: 130 });

    expect(getByTestId('symbolic-lines-list').textContent).toContain('(0, 0) → (500, 0)');
    expect(getByTestId('symbolic-line-style-0').textContent).toContain('dashed');
    expect(getByTestId('symbolic-canvas-line-0').getAttribute('stroke-dasharray')).toBe('8 5');
  });

  it('filters selected symbolic lines by preview detail level and boolean visibility params', () => {
    const { getByLabelText, getByTestId, getByText, queryByTestId } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );

    fireEvent.click(getByText('Furniture', { selector: 'button' }));
    fireEvent.click(getByLabelText('select-symbolic-line-0'));
    fireEvent.click(getByLabelText('symbolic-visibility-coarse'));
    expect(getByTestId('preview-visibility-summary').textContent).toContain('4/5 symbolic lines');
    expect(queryByTestId('symbolic-canvas-line-0')).toBeNull();

    fireEvent.click(getByLabelText('symbolic-visibility-coarse'));
    fireEvent.change(getByLabelText('Symbolic line visible when'), {
      target: { value: 'Show_2D_Elements' },
    });
    fireEvent.click(getByLabelText('symbolic-show-when-false'));
    expect(getByTestId('preview-visibility-summary').textContent).toContain('4/5 symbolic lines');
  });
});

describe('FAM-073 — preview visibility', () => {
  it('filters family geometry by preview detail level visibility', () => {
    const { getByText, getByLabelText, getByTestId, getAllByText, queryByTestId } = renderWithI18n(
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
    fireEvent.click(getByLabelText('visibility-fine'));
    fireEvent.click(getByLabelText('Preview Visibility'));
    fireEvent.change(getByLabelText('Preview detail level'), { target: { value: 'fine' } });

    expect(getByTestId('preview-visibility-summary').textContent).toContain('0/1 sweeps');
    expect(queryByTestId('sweep-0')).toBeNull();
  });
});

describe('FAM-068 — family align and lock', () => {
  it('aligns a symbolic line to a reference plane and follows locked plane edits', () => {
    const { getByText, getByLabelText, getByTestId } = renderWithI18n(<FamilyEditorWorkbench />);

    fireEvent.click(getByText('Add vertical'));
    fireEvent.change(getByLabelText('ref-plane-offset-0'), { target: { value: '250' } });
    fireEvent.click(getByTestId('symbolic-line-add'));
    fireEvent.click(getByTestId('symbolic-line-align'));

    expect(getByTestId('symbolic-lines-list').textContent).toContain('(250, 0)');
    expect(getByTestId('symbolic-lines-list').textContent).toContain('locked');

    fireEvent.change(getByLabelText('ref-plane-offset-0'), { target: { value: '400' } });
    expect(getByTestId('symbolic-lines-list').textContent).toContain('(400, 0)');
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

  it('picks a locked family edge into the profile and follows its source constraint', () => {
    const { getByText, getByLabelText, getByTestId, getAllByText } = renderWithI18n(
      <FamilyEditorWorkbench />,
    );

    fireEvent.click(getByText('Add vertical'));
    fireEvent.change(getByLabelText('ref-plane-offset-0'), { target: { value: '250' } });
    fireEvent.click(getByTestId('symbolic-line-add'));
    fireEvent.click(getByTestId('symbolic-line-align'));

    fireEvent.click(getByText('Sweep'));
    fireEvent.click(getAllByText('Add line')[0]);
    fireEvent.click(getByText(/Edit Profile/));
    fireEvent.click(getByTestId('profile-pick-family-edge'));
    expect(getByTestId('sweep-profile-list').textContent).toContain('locked');
    expect(getByTestId('sweep-profile-list').textContent).toContain('(250, 0)');

    fireEvent.change(getByLabelText('ref-plane-offset-0'), { target: { value: '400' } });
    expect(getByTestId('sweep-profile-list').textContent).toContain('(400, 0)');
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

  it('runs Trim/Extend from the TR keyboard shortcut in profile sketch mode', () => {
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

    const profileSketch = getByLabelText('Sweep profile sketch');
    profileSketch.focus();
    fireEvent.keyDown(profileSketch, { key: 'T' });
    fireEvent.keyDown(profileSketch, { key: 'R' });

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
