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
  Viewport3DLayersPanel: () => <div data-testid="viewport3d-layers-panel" />,
}));

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
  useBimStore.setState({
    selectedId: undefined,
    activePlanViewId: undefined,
    elementsById: {},
    activityEvents: [],
    temporaryVisibility: null,
  });
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
  it('renders stable right-rail section tabs', () => {
    useBimStore.setState({
      selectedId: undefined,
      elementsById: {},
    });

    const { getByTestId } = renderWithI18n(
      <WorkspaceRightRail
        mode="3d"
        onSemanticCommand={() => undefined}
        onModeChange={() => undefined}
        codePresetIds={[]}
      />,
    );

    expect(getByTestId('right-rail-section-tab-properties')).toBeTruthy();
    expect(getByTestId('right-rail-section-tab-view')).toBeTruthy();
    expect(getByTestId('right-rail-section-tab-review')).toBeTruthy();
  });

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

describe('WorkspaceRightRail — 3D selected wall actions', () => {
  const wall: Extract<Element, { kind: 'wall' }> = {
    kind: 'wall',
    id: 'wall-3d',
    name: '3D Wall',
    wallTypeId: 'wt-1',
    levelId: 'lvl-1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 6000, yMm: 0 },
    thicknessMm: 200,
    heightMm: 3000,
  };

  it('shows explicit wall actions in 3D and dispatches hosted insert commands', () => {
    const onSemanticCommand = vi.fn();
    useBimStore.setState({
      selectedId: wall.id,
      elementsById: { [wall.id]: wall },
    });

    const { getByTestId } = renderWithI18n(
      <WorkspaceRightRail
        mode="3d"
        onSemanticCommand={onSemanticCommand}
        onModeChange={() => undefined}
        codePresetIds={[]}
      />,
    );

    expect(getByTestId('selected-wall-3d-actions')).toBeTruthy();
    fireEvent.click(getByTestId('3d-action-insert-door'));
    fireEvent.click(getByTestId('3d-action-insert-window'));
    fireEvent.click(getByTestId('3d-action-insert-opening'));

    expect(onSemanticCommand).toHaveBeenNthCalledWith(1, {
      type: 'insertDoorOnWall',
      wallId: wall.id,
      alongT: 0.5,
      widthMm: 900,
    });
    expect(onSemanticCommand).toHaveBeenNthCalledWith(2, {
      type: 'insertWindowOnWall',
      wallId: wall.id,
      alongT: 0.5,
      widthMm: 1200,
      sillHeightMm: 900,
      heightMm: 1500,
    });
    expect(onSemanticCommand).toHaveBeenNthCalledWith(3, {
      type: 'createWallOpening',
      hostWallId: wall.id,
      alongTStart: 0.45,
      alongTEnd: 0.55,
      sillHeightMm: 200,
      headHeightMm: 2400,
    });
  });

  it('can isolate and hide wall categories from the 3D action row', () => {
    useBimStore.setState({
      selectedId: wall.id,
      elementsById: { [wall.id]: wall },
      viewerCategoryHidden: {},
    });

    const { getByTestId } = renderWithI18n(
      <WorkspaceRightRail
        mode="3d"
        onSemanticCommand={() => undefined}
        onModeChange={() => undefined}
        codePresetIds={[]}
      />,
    );

    fireEvent.click(getByTestId('3d-action-isolate-walls'));
    expect(useBimStore.getState().viewerCategoryHidden.wall).toBe(false);
    expect(useBimStore.getState().viewerCategoryHidden.floor).toBe(true);

    fireEvent.click(getByTestId('3d-action-hide-wall-category'));
    expect(useBimStore.getState().viewerCategoryHidden.wall).toBe(true);
  });

  it('keeps the element surface selected-element-only — UX-WP-05', () => {
    useBimStore.setState({
      selectedId: wall.id,
      elementsById: { [wall.id]: wall },
      activityEvents: [
        {
          id: 1,
          userId: 'test-user',
          revisionAfter: 2,
          commandTypes: ['updateElementProperty'],
          createdAt: '2026-05-11T10:00:00.000Z',
        },
      ],
    });

    const { getByTestId, queryByTestId, queryByText } = renderWithI18n(
      <WorkspaceRightRail
        mode="3d"
        onSemanticCommand={() => undefined}
        onModeChange={() => undefined}
        codePresetIds={[]}
        surface="element"
      />,
    );

    expect(getByTestId('inspector')).toBeTruthy();
    expect(getByTestId('selected-wall-3d-actions')).toBeTruthy();
    expect(queryByTestId('right-rail-section-tabs')).toBeNull();
    expect(queryByTestId('viewport3d-layers-panel')).toBeNull();
    expect(queryByTestId('right-rail-workbench')).toBeNull();
    expect(queryByTestId('right-rail-review')).toBeNull();
    expect(queryByText(/Activity/i)).toBeNull();
  });

  it('moves selected-element temporary visibility actions to the element sidebar — UX-WP-07', () => {
    useBimStore.setState({
      selectedId: wall.id,
      activePlanViewId: 'plan-view-1',
      elementsById: {
        [wall.id]: wall,
        'plan-view-1': {
          kind: 'plan_view',
          id: 'plan-view-1',
          name: 'Level 1 Plan',
          levelId: 'lvl-1',
        },
      },
      temporaryVisibility: null,
    });

    const { getByTestId } = renderWithI18n(
      <WorkspaceRightRail
        mode="plan"
        onSemanticCommand={() => undefined}
        onModeChange={() => undefined}
        codePresetIds={[]}
        surface="element"
      />,
    );

    expect(getByTestId('element-temp-visibility-actions')).toBeTruthy();
    fireEvent.click(getByTestId('element-temp-isolate-element'));

    expect(useBimStore.getState().temporaryVisibility).toEqual({
      viewId: 'plan-view-1',
      mode: 'isolate',
      categories: [],
      elementIds: [wall.id],
    });
  });
});

describe('WorkspaceRightRail — 3D selected door/window/floor/roof actions', () => {
  const hostWall: Extract<Element, { kind: 'wall' }> = {
    kind: 'wall',
    id: 'host-wall',
    name: 'Host Wall',
    wallTypeId: 'wt-1',
    levelId: 'lvl-1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 6000, yMm: 0 },
    thicknessMm: 200,
    heightMm: 3000,
  };
  const doorType: Extract<Element, { kind: 'family_type' }> = {
    kind: 'family_type',
    id: 'ft-door',
    name: 'Door Type',
    familyId: 'fam-door',
    discipline: 'door',
    parameters: { name: 'Door Type' },
  };
  const door: Extract<Element, { kind: 'door' }> = {
    kind: 'door',
    id: 'door-3d',
    name: 'Door 3D',
    wallId: hostWall.id,
    alongT: 0.5,
    widthMm: 900,
    familyTypeId: doorType.id,
  };
  const floorType: Extract<Element, { kind: 'floor_type' }> = {
    kind: 'floor_type',
    id: 'ft-floor',
    name: 'Floor Type',
    layers: [],
  };
  const floor: Extract<Element, { kind: 'floor' }> = {
    kind: 'floor',
    id: 'floor-3d',
    name: 'Floor 3D',
    levelId: 'lvl-1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 0, yMm: 1000 },
    ],
    thicknessMm: 250,
    floorTypeId: floorType.id,
  };
  const roofType: Extract<Element, { kind: 'roof_type' }> = {
    kind: 'roof_type',
    id: 'rt-roof',
    name: 'Roof Type',
    layers: [],
  };
  const roof: Extract<Element, { kind: 'roof' }> = {
    kind: 'roof',
    id: 'roof-3d',
    name: 'Roof 3D',
    referenceLevelId: 'lvl-1',
    footprintMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 1200, yMm: 0 },
      { xMm: 1200, yMm: 1200 },
      { xMm: 0, yMm: 1200 },
    ],
    roofTypeId: roofType.id,
  };

  it('lets selected hosted openings jump to host wall and type from 3D', () => {
    useBimStore.setState({
      selectedId: door.id,
      elementsById: {
        [hostWall.id]: hostWall,
        [door.id]: door,
        [doorType.id]: doorType,
      },
    });

    const { getByTestId } = renderWithI18n(
      <WorkspaceRightRail
        mode="3d"
        onSemanticCommand={() => undefined}
        onModeChange={() => undefined}
        codePresetIds={[]}
      />,
    );

    expect(getByTestId('selected-3d-element-actions')).toBeTruthy();
    fireEvent.click(getByTestId('3d-action-door-edit-type'));
    expect(useBimStore.getState().selectedId).toBe(doorType.id);
  });

  it('lets selected hosted openings jump to their wall host from 3D', () => {
    useBimStore.setState({
      selectedId: door.id,
      elementsById: {
        [hostWall.id]: hostWall,
        [door.id]: door,
        [doorType.id]: doorType,
      },
    });

    const { getByTestId } = renderWithI18n(
      <WorkspaceRightRail
        mode="3d"
        onSemanticCommand={() => undefined}
        onModeChange={() => undefined}
        codePresetIds={[]}
      />,
    );

    fireEvent.click(getByTestId('3d-action-door-select-host'));
    expect(useBimStore.getState().selectedId).toBe(hostWall.id);
  });

  it('adds 3D category and type actions for selected floors and roofs', () => {
    useBimStore.setState({
      selectedId: floor.id,
      elementsById: {
        [floor.id]: floor,
        [floorType.id]: floorType,
        [roof.id]: roof,
        [roofType.id]: roofType,
      },
      viewerCategoryHidden: {},
    });

    const { getByTestId, rerender } = renderWithI18n(
      <WorkspaceRightRail
        mode="3d"
        onSemanticCommand={() => undefined}
        onModeChange={() => undefined}
        codePresetIds={[]}
      />,
    );

    fireEvent.click(getByTestId('3d-action-floor-isolate-category'));
    expect(useBimStore.getState().viewerCategoryHidden.floor).toBe(false);
    expect(useBimStore.getState().viewerCategoryHidden.wall).toBe(true);

    useBimStore.setState({ selectedId: roof.id, viewerCategoryHidden: {} });
    rerender(
      <I18nextProvider i18n={i18n}>
        <WorkspaceRightRail
          mode="3d"
          onSemanticCommand={() => undefined}
          onModeChange={() => undefined}
          codePresetIds={[]}
        />
      </I18nextProvider>,
    );

    fireEvent.click(getByTestId('3d-action-roof-hide-category'));
    expect(useBimStore.getState().viewerCategoryHidden.roof).toBe(true);
    fireEvent.click(getByTestId('3d-action-roof-edit-type'));
    expect(useBimStore.getState().selectedId).toBe(roofType.id);
  });
});
