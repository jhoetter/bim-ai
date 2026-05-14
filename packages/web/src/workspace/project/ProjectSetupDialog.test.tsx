import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import { ProjectSetupDialog } from './ProjectSetupDialog';

afterEach(() => cleanup());

function baseElements(): Record<string, Element> {
  return {
    project_settings: {
      kind: 'project_settings',
      id: 'project_settings',
      name: 'House A',
      lengthUnit: 'millimeter',
      angularUnitDeg: 'degree',
      displayLocale: 'en-US',
      checkpointRetentionLimit: 20,
    },
    'lvl-ground': {
      kind: 'level',
      id: 'lvl-ground',
      name: 'Ground',
      elevationMm: 0,
    },
    'lvl-first': {
      kind: 'level',
      id: 'lvl-first',
      name: 'First',
      elevationMm: 2800,
    },
    'pv-ground': {
      kind: 'plan_view',
      id: 'pv-ground',
      name: 'Ground plan',
      levelId: 'lvl-ground',
      planViewSubtype: 'floor_plan',
    },
  };
}

describe('<ProjectSetupDialog />', () => {
  it('renders nothing while closed', () => {
    const { queryByTestId } = render(
      <ProjectSetupDialog
        open={false}
        onClose={vi.fn()}
        elementsById={{}}
        onSemanticCommand={vi.fn()}
      />,
    );
    expect(queryByTestId('project-setup-dialog')).toBeNull();
  });

  it('summarizes setup health and opens the manage links callback', () => {
    const onOpenManageLinks = vi.fn();
    const { getByTestId, getByText } = render(
      <ProjectSetupDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements()}
        onSemanticCommand={vi.fn()}
        onOpenManageLinks={onOpenManageLinks}
      />,
    );

    expect(getByTestId('project-setup-dialog')).toBeTruthy();
    expect(getByTestId('project-setup-check-levels-storeys').textContent).toContain('Partial');
    fireEvent.click(getByText('Manage Links'));
    expect(onOpenManageLinks).toHaveBeenCalledOnce();
  });

  it('generates missing storeys and floor plans from the setup table', async () => {
    const onSemanticCommand = vi.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByText } = render(
      <ProjectSetupDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements()}
        onSemanticCommand={onSemanticCommand}
      />,
    );

    fireEvent.change(getByLabelText('Storeys'), { target: { value: '3' } });
    fireEvent.change(getByLabelText('Floor-to-floor mm'), { target: { value: '3000' } });
    fireEvent.click(getByText('Apply Storey Setup'));

    await waitFor(() => expect(onSemanticCommand).toHaveBeenCalled());
    expect(onSemanticCommand.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        {
          type: 'moveLevelElevation',
          levelId: 'lvl-first',
          elevationMm: 3000,
        },
        expect.objectContaining({
          type: 'createLevel',
          name: 'Level 3',
          elevationMm: 6000,
          alsoCreatePlanView: true,
        }),
        expect.objectContaining({
          type: 'upsertPlanView',
          levelId: 'lvl-first',
          planViewSubtype: 'floor_plan',
        }),
      ]),
    );
  });

  it('saves direct level name, elevation, and height edits', async () => {
    const onSemanticCommand = vi.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByText } = render(
      <ProjectSetupDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements()}
        onSemanticCommand={onSemanticCommand}
      />,
    );

    fireEvent.change(getByLabelText('Level name First'), { target: { value: 'Upper Level' } });
    fireEvent.change(getByLabelText('Height above previous First'), { target: { value: '3200' } });
    fireEvent.click(getByText('Save Level Table'));

    await waitFor(() => expect(onSemanticCommand).toHaveBeenCalled());
    expect(onSemanticCommand.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        {
          type: 'updateElementProperty',
          elementId: 'lvl-first',
          key: 'name',
          value: 'Upper Level',
        },
        {
          type: 'moveLevelElevation',
          levelId: 'lvl-first',
          elevationMm: 3200,
        },
        expect.objectContaining({
          type: 'upsertPlanView',
          levelId: 'lvl-first',
          planViewSubtype: 'floor_plan',
        }),
      ]),
    );
  });

  it('persists project info and unit fields through updateElementProperty', async () => {
    const onSemanticCommand = vi.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByText } = render(
      <ProjectSetupDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements()}
        onSemanticCommand={onSemanticCommand}
      />,
    );

    fireEvent.change(getByLabelText('Project number'), { target: { value: 'P-42' } });
    fireEvent.change(getByLabelText('Length unit'), { target: { value: 'meter' } });
    fireEvent.click(getByText('Save Project Info'));

    await waitFor(() => expect(onSemanticCommand).toHaveBeenCalled());
    expect(onSemanticCommand.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        {
          type: 'updateElementProperty',
          elementId: 'project_settings',
          key: 'projectNumber',
          value: 'P-42',
        },
        {
          type: 'updateElementProperty',
          elementId: 'project_settings',
          key: 'lengthUnit',
          value: 'meter',
        },
      ]),
    );
  });

  it('generates a rectangular grid system', async () => {
    const onSemanticCommand = vi.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByText } = render(
      <ProjectSetupDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements()}
        onSemanticCommand={onSemanticCommand}
      />,
    );

    fireEvent.change(getByLabelText('X grid count'), { target: { value: '2' } });
    fireEvent.change(getByLabelText('Y grid count'), { target: { value: '2' } });
    fireEvent.change(getByLabelText('Spacing mm'), { target: { value: '5000' } });
    fireEvent.change(getByLabelText('Extent mm'), { target: { value: '10000' } });
    fireEvent.click(getByText('Generate Grid System'));

    await waitFor(() => expect(onSemanticCommand).toHaveBeenCalledTimes(4));
    expect(onSemanticCommand.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'createGridLine',
          label: '1',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 0, yMm: 10000 },
        }),
        expect.objectContaining({
          type: 'createGridLine',
          label: 'B',
          start: { xMm: 0, yMm: 5000 },
          end: { xMm: 10000, yMm: 5000 },
        }),
      ]),
    );
  });

  it('creates location sun settings when missing', async () => {
    const onSemanticCommand = vi.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByText } = render(
      <ProjectSetupDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements()}
        onSemanticCommand={onSemanticCommand}
      />,
    );

    fireEvent.change(getByLabelText('Latitude deg'), { target: { value: '40.71' } });
    fireEvent.change(getByLabelText('Longitude deg'), { target: { value: '-74.01' } });
    fireEvent.change(getByLabelText('Sun date'), { target: { value: '2026-06-21' } });
    fireEvent.change(getByLabelText('Hour'), { target: { value: '9' } });
    fireEvent.change(getByLabelText('Minute'), { target: { value: '30' } });
    fireEvent.click(getByText('Save Location / Sun'));

    await waitFor(() => expect(onSemanticCommand).toHaveBeenCalledOnce());
    expect(onSemanticCommand).toHaveBeenCalledWith({
      type: 'createSunSettings',
      id: 'sun_settings',
      latitudeDeg: 40.71,
      longitudeDeg: -74.01,
      dateIso: '2026-06-21',
      timeOfDay: { hours: 9, minutes: 30 },
      daylightSavingStrategy: 'auto',
    });
  });

  it('creates default phases when absent', async () => {
    const onSemanticCommand = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <ProjectSetupDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements()}
        onSemanticCommand={onSemanticCommand}
      />,
    );

    fireEvent.click(getByText('Create Default Phases'));

    await waitFor(() => expect(onSemanticCommand).toHaveBeenCalledTimes(2));
    expect(onSemanticCommand.mock.calls.map((call) => call[0])).toEqual([
      { type: 'createPhase', id: 'phase-existing', name: 'Existing', ord: 0 },
      { type: 'createPhase', id: 'phase-new', name: 'New Construction', ord: 1 },
    ]);
  });
});
