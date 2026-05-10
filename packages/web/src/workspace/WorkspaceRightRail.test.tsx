import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import type { ReactElement } from 'react';
import i18n from '../i18n';
import { useBimStore } from '../state/store';
import { WorkspaceRightRail } from './WorkspaceRightRail';
import { inspectorPropertiesContextForElement } from './WorkspaceRightRailContext';
import { typePropertyUpdateCommand } from './WorkspaceRightRailTypeCommands';

vi.mock('./viewport', () => ({
  Viewport3DLayersPanel: () => null,
}));

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
  useBimStore.setState({ selectedId: undefined, elementsById: {} });
});

describe('WorkspaceRightRail — Properties Palette context', () => {
  it('classifies Project Browser type rows as type context', () => {
    const wallType: Element = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Generic 200',
      basisLine: 'center',
      layers: [],
    };

    expect(inspectorPropertiesContextForElement(wallType)).toBe('type');
  });

  it('keeps placed model elements in instance context', () => {
    const wall: Element = {
      kind: 'wall',
      id: 'w-1',
      name: 'Wall 1',
      wallTypeId: 'wt-1',
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    };

    expect(inspectorPropertiesContextForElement(wall)).toBe('instance');
  });

  it('routes document selections to view context', () => {
    const planView: Element = {
      kind: 'plan_view',
      id: 'pv-1',
      name: 'Level 1',
      levelId: 'lvl-1',
    };

    expect(inspectorPropertiesContextForElement(planView)).toBe('view');
  });
});

describe('WorkspaceRightRail — type property commands', () => {
  it('routes wall type property edits through upsertWallType', () => {
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Generic 200',
      basisLine: 'center',
      layers: [{ function: 'structure', materialKey: 'Concrete', thicknessMm: 200 }],
    };

    expect(typePropertyUpdateCommand(wallType, 'basisLine', 'face_exterior')).toEqual({
      type: 'upsertWallType',
      id: 'wt-1',
      name: 'Generic 200',
      basisLine: 'face_exterior',
      layers: [{ function: 'structure', materialKey: 'Concrete', thicknessMm: 200 }],
    });
  });

  it('routes family type parameter edits through upsertFamilyType', () => {
    const familyType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-1',
      name: 'Door 900',
      familyId: 'fam-door',
      discipline: 'door',
      parameters: { name: 'Door 900', widthMm: 900 },
    };

    expect(typePropertyUpdateCommand(familyType, 'parameters.widthMm', 1000)).toEqual({
      type: 'upsertFamilyType',
      id: 'ft-1',
      discipline: 'door',
      parameters: { name: 'Door 900', widthMm: 1000 },
    });
  });
});

describe('WorkspaceRightRail — placed authored family instances', () => {
  it('edits only instance-overridable family params through paramValues', () => {
    const familyType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-chair-600',
      name: '600 x 600 Chair',
      familyId: 'fam:furniture:chair',
      discipline: 'generic',
      parameters: {
        name: '600 x 600 Chair',
        Width: 600,
        Seat_Height: 450,
        __familyDefinition: {
          id: 'fam:furniture:chair',
          name: 'Chair',
          discipline: 'generic',
          params: [
            {
              key: 'Width',
              label: 'Width',
              type: 'length_mm',
              default: 600,
              instanceOverridable: false,
            },
            {
              key: 'Seat_Height',
              label: 'Seat Height',
              type: 'length_mm',
              default: 450,
              instanceOverridable: true,
            },
          ],
          defaultTypes: [],
        },
      },
    };
    const instance: Extract<Element, { kind: 'family_instance' }> = {
      kind: 'family_instance',
      id: 'fi-chair-1',
      name: 'Chair 1',
      familyTypeId: 'ft-chair-600',
      levelId: 'lvl-1',
      positionMm: { xMm: 0, yMm: 0 },
      paramValues: { Seat_Height: 500 },
    };
    const onSemanticCommand = vi.fn();
    useBimStore.setState({
      selectedId: instance.id,
      elementsById: {
        [familyType.id]: familyType,
        [instance.id]: instance,
      },
    });

    const { getByTestId, queryByTestId } = renderWithI18n(
      <WorkspaceRightRail
        mode="plan"
        onSemanticCommand={onSemanticCommand}
        onModeChange={() => undefined}
        codePresetIds={[]}
      />,
    );

    expect(queryByTestId('inspector-family-instance-param-Width')).toBeNull();
    const seatHeight = getByTestId('inspector-family-instance-param-Seat_Height');
    fireEvent.change(seatHeight, { target: { value: '525' } });

    expect(onSemanticCommand).toHaveBeenCalledWith({
      type: 'updateElementProperty',
      elementId: 'fi-chair-1',
      key: 'paramValues',
      value: { Seat_Height: 525 },
    });
  });
});
