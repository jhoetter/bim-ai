import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import {
  InspectorConstraintsFor,
  InspectorGraphicsFor,
  InspectorIdentityFor,
  InspectorProjectSettingsEditor,
  InspectorPlanViewEditor,
  InspectorPropertiesFor,
  InspectorRoomEditor,
  InspectorViewTemplateEditor,
} from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const wall = {
  kind: 'wall',
  id: 'seed-w-eg-south',
  name: 'EG South',
  levelId: 'seed-lvl-ground',
  start: { xMm: 5000, yMm: 4000 },
  end: { xMm: 17000, yMm: 4000 },
  thicknessMm: 200,
  heightMm: 2800,
} as const;

const door = {
  kind: 'door',
  id: 'seed-d-1',
  name: 'Door',
  wallId: 'seed-w-eg-south',
  alongT: 0.5,
  widthMm: 900,
} as const;

const stair = {
  kind: 'stair',
  id: 'seed-stair',
  name: 'Stair',
  baseLevelId: 'seed-lvl-ground',
  topLevelId: 'seed-lvl-upper',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 4000, yMm: 0 },
  widthMm: 1100,
  riserMm: 176,
  treadMm: 280,
} as const;

describe('InspectorPropertiesFor — spec §13', () => {
  it('renders wall properties', () => {
    const { getByText } = render(InspectorPropertiesFor(wall, t));
    expect(getByText('200 mm')).toBeTruthy();
    expect(getByText('2.80 m')).toBeTruthy();
  });

  it('shows the type exterior material for typed walls instead of stale instance material', () => {
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wall-type-clad',
      name: 'Vertical clad external wall',
      layers: [
        { function: 'insulation', materialKey: 'air', thicknessMm: 25 },
        { function: 'finish', materialKey: 'cladding_dark_grey', thicknessMm: 18 },
        { function: 'structure', materialKey: 'timber_frame_insulation', thicknessMm: 140 },
      ],
    };
    const typedWall: Extract<Element, { kind: 'wall' }> = {
      ...wall,
      wallTypeId: wallType.id,
      materialKey: 'timber_frame_insulation',
    };
    const { getByText, queryByText } = render(
      InspectorPropertiesFor(typedWall, t, {
        elementsById: { [wallType.id]: wallType },
      }),
    );

    expect(getByText('Type Exterior Material')).toBeTruthy();
    expect(getByText('Dark-grey cladding')).toBeTruthy();
    expect(queryByText('Instance Material')).toBeNull();
  });

  it('shows floor and roof type top materials instead of blindly layer zero', () => {
    const floorType: Extract<Element, { kind: 'floor_type' }> = {
      kind: 'floor_type',
      id: 'floor-type-finish',
      name: 'Timber floor',
      layers: [
        { function: 'structure', materialKey: 'concrete_smooth', thicknessMm: 180 },
        { function: 'finish', materialKey: 'oak_light', thicknessMm: 20 },
      ],
    };
    const floorEl: Extract<Element, { kind: 'floor' }> = {
      kind: 'floor',
      id: 'floor-1',
      name: 'Floor',
      levelId: 'level-1',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
        { xMm: 3000, yMm: 3000 },
      ],
      thicknessMm: 200,
      floorTypeId: floorType.id,
    };
    const roofType: Extract<Element, { kind: 'roof_type' }> = {
      kind: 'roof_type',
      id: 'roof-type-finish',
      name: 'Metal roof',
      layers: [
        { function: 'structure', materialKey: 'timber_frame_insulation', thicknessMm: 160 },
        { function: 'finish', materialKey: 'metal_standing_seam_dark_grey', thicknessMm: 45 },
      ],
    };
    const roofEl: Extract<Element, { kind: 'roof' }> = {
      kind: 'roof',
      id: 'roof-1',
      name: 'Roof',
      referenceLevelId: 'level-1',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
        { xMm: 3000, yMm: 3000 },
      ],
      roofTypeId: roofType.id,
      materialKey: 'white_render',
    };

    const floorView = render(
      InspectorPropertiesFor(floorEl, t, { elementsById: { [floorType.id]: floorType } }),
    );
    expect(floorView.getByText('Type Top Material')).toBeTruthy();
    expect(floorView.getByText('oak_light')).toBeTruthy();
    floorView.unmount();

    const roofView = render(
      InspectorPropertiesFor(roofEl, t, { elementsById: { [roofType.id]: roofType } }),
    );
    expect(roofView.getByText('Type Top Material')).toBeTruthy();
    expect(roofView.getByText(/Standing-seam metal/)).toBeTruthy();
  });

  it('renders door alongT and width', () => {
    const { getByText } = render(InspectorPropertiesFor(door, t));
    expect(getByText('900 mm')).toBeTruthy();
    expect(getByText('0.500')).toBeTruthy();
  });

  it('surfaces floor boundary editing as an explicit action', () => {
    const floor: Extract<Element, { kind: 'floor' }> = {
      kind: 'floor',
      id: 'floor-1',
      name: 'Floor',
      levelId: 'seed-lvl-ground',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
        { xMm: 1000, yMm: 1000 },
        { xMm: 0, yMm: 1000 },
      ],
      thicknessMm: 220,
      structureThicknessMm: 140,
      finishThicknessMm: 0,
    };
    const onEditBoundary = vi.fn();
    const { getByTestId, getByText } = render(InspectorPropertiesFor(floor, t, { onEditBoundary }));

    expect(getByText('Plan vertex grips')).toBeTruthy();
    fireEvent.click(getByTestId('inspector-floor-edit-boundary'));
    expect(onEditBoundary).toHaveBeenCalledWith(floor);
  });

  it('opens material browser with an explicit door slot target', () => {
    const onOpenMaterialBrowser = vi.fn();
    const { getByText, getAllByTestId } = render(
      InspectorPropertiesFor(
        {
          ...door,
          materialSlots: { frame: 'aluminium_black' },
        } as Extract<Element, { kind: 'door' }>,
        t,
        { onOpenMaterialBrowser },
      ),
    );

    expect(getByText('Material Slots')).toBeTruthy();
    fireEvent.click(getAllByTestId('inspector-material-row-browser')[1]!);
    expect(onOpenMaterialBrowser).toHaveBeenCalledWith({
      kind: 'material-slot',
      elementId: 'seed-d-1',
      slot: 'frame',
      label: 'Frame',
      currentKey: 'aluminium_black',
    });
  });

  it('renders stair risers/treads', () => {
    const { getByLabelText } = render(InspectorPropertiesFor(stair, t));
    expect((getByLabelText('Stair riser height in millimetres') as HTMLInputElement).value).toBe(
      '176',
    );
    expect((getByLabelText('Stair tread depth in millimetres') as HTMLInputElement).value).toBe(
      '280',
    );
  });

  it('renders MEP route metadata and connectors', () => {
    const pipe: Extract<Element, { kind: 'pipe' }> = {
      kind: 'pipe',
      id: 'pipe-1',
      name: 'CHW Supply',
      levelId: 'lvl-1',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 4200, yMm: 0 },
      elevationMm: 2800,
      diameterMm: 80,
      systemType: 'cooling',
      systemName: 'CHW-S',
      flowDirection: 'supply',
      insulation: '25 mm phenolic',
      serviceLevel: 'L02',
      connectors: [
        { id: 'c1', flowDirection: 'supply', diameterMm: 80 },
        { id: 'c2', flowDirection: 'supply', diameterMm: 80 },
      ],
    };

    const { getByText } = render(InspectorPropertiesFor(pipe, t));
    expect(getByText('CHW-S')).toBeTruthy();
    expect(getByText('80 mm')).toBeTruthy();
    expect(getByText('25 mm phenolic')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('renders MEP room zones and load summaries', () => {
    const room: Extract<Element, { kind: 'room' }> = {
      kind: 'room',
      id: 'room-mep',
      name: 'Exam',
      levelId: 'lvl-1',
      outlineMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
        { xMm: 3000, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ],
      ventilationZone: 'VAV-2A',
      heatingCoolingZone: 'HC-2A',
      designAirChangeRate: 6,
      electricalLoadSummary: { receptacles: '1.2 kVA' },
      fixtureEquipmentLoads: { sink: 'cold+hot' },
      serviceRequirements: ['medical gas', 'exhaust'],
    };

    const { getByText } = render(InspectorPropertiesFor(room, t));
    expect(getByText('VAV-2A')).toBeTruthy();
    expect(getByText('HC-2A')).toBeTruthy();
    expect(getByText('6.00 1/h')).toBeTruthy();
    expect(getByText('medical gas, exhaust')).toBeTruthy();
  });

  it('persists room fill pattern override', () => {
    const room: Extract<Element, { kind: 'room' }> = {
      kind: 'room',
      id: 'room-1',
      name: 'Office',
      levelId: 'lvl-1',
      outlineMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 2000, yMm: 0 },
        { xMm: 2000, yMm: 2000 },
        { xMm: 0, yMm: 2000 },
      ],
      roomFillPatternOverride: 'hatch_45',
    };
    const onPropertyChange = vi.fn();
    const { getByTestId } = render(
      <InspectorRoomEditor el={room} revision={1} onPersistProperty={onPropertyChange} />,
    );
    const select = getByTestId('inspector-room-fill-pattern-override') as HTMLSelectElement;
    expect(select.value).toBe('hatch_45');

    fireEvent.change(select, { target: { value: 'crosshatch' } });
    expect(onPropertyChange).toHaveBeenCalledWith('roomFillPatternOverride', 'crosshatch');
  });

  it('surfaces architecture room metadata and read-only consultant badges', () => {
    const room: Extract<Element, { kind: 'room' }> = {
      kind: 'room',
      id: 'room-1',
      name: 'Office',
      levelId: 'lvl-1',
      outlineMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 2000, yMm: 0 },
        { xMm: 2000, yMm: 2000 },
        { xMm: 0, yMm: 2000 },
      ],
      volumeM3: 36.25,
      phaseCreated: 'New Construction',
      props: {
        roomFunction: 'office',
        finishSetId: 'fs-1',
        fireRating: 'F30',
        acousticRating: 'Rw 45',
        energyZone: 'heated',
        costGroup: 'KG 300',
      },
    };
    const onPropertyChange = vi.fn();
    const { getByTestId, getByText } = render(
      <InspectorRoomEditor el={room} revision={1} onPersistProperty={onPropertyChange} />,
    );
    const roomFunction = getByTestId('inspector-room-room-function') as HTMLInputElement;
    expect(roomFunction.value).toBe('office');
    const badges = getByTestId('inspector-room-consultant-badges');
    expect(badges.textContent).toContain('Fire F30');
    expect(badges.textContent).toContain('Acoustic Rw 45');
    expect(badges.textContent).toContain('Energy heated');
    expect(badges.textContent).toContain('Cost KG 300');
    expect(getByText('36.250 m³')).toBeTruthy();
    expect(getByText('New Construction')).toBeTruthy();

    fireEvent.blur(roomFunction, { target: { value: 'meeting' } });
    expect(onPropertyChange).toHaveBeenCalledWith('roomFunction', 'meeting');
  });

  it('renders editable DXF work-plane level dropdown', () => {
    const linkDxf = {
      kind: 'link_dxf',
      id: 'dxf-1',
      name: 'Survey underlay',
      levelId: 'lvl-1',
      originMm: { xMm: 0, yMm: 0 },
      rotationDeg: 0,
      scaleFactor: 1,
      linework: [],
    } as Extract<Element, { kind: 'link_dxf' }>;
    const elementsById = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'Ground', elevationMm: 0 },
      'lvl-2': { kind: 'level', id: 'lvl-2', name: 'Upper', elevationMm: 3000 },
      [linkDxf.id]: linkDxf,
    } as Record<string, Element>;
    const onPropertyChange = vi.fn();

    const { getByTestId } = render(
      InspectorPropertiesFor(linkDxf, t, { elementsById, onPropertyChange }),
    );
    const select = getByTestId('inspector-link-dxf-level') as HTMLSelectElement;
    expect(select.value).toBe('lvl-1');

    fireEvent.change(select, { target: { value: 'lvl-2' } });
    expect(onPropertyChange).toHaveBeenCalledWith('levelId', 'lvl-2');
  });

  it('renders editable wall type fields and layer summary', () => {
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Generic 200',
      basisLine: 'center',
      layers: [{ function: 'structure', materialKey: 'Concrete', thicknessMm: 200 }],
    };
    const onPropertyChange = vi.fn();

    const { getByTestId, getByText } = render(
      InspectorPropertiesFor(wallType, t, { onPropertyChange }),
    );

    const name = getByTestId('inspector-wall-type-name') as HTMLInputElement;
    fireEvent.blur(name, { target: { value: 'Generic 250' } });
    expect(onPropertyChange).toHaveBeenCalledWith('name', 'Generic 250');

    fireEvent.change(getByTestId('inspector-wall-type-basis-line'), {
      target: { value: 'face_exterior' },
    });
    expect(onPropertyChange).toHaveBeenCalledWith('basisLine', 'face_exterior');
    expect(getByText('1 layer · 200 mm')).toBeTruthy();
  });

  it('renders editable family type parameters', () => {
    const familyType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-1',
      name: 'Door 900',
      familyId: 'fam-door',
      discipline: 'door',
      parameters: { name: 'Door 900', widthMm: 900, fireRated: false },
    };
    const onPropertyChange = vi.fn();

    const { getByTestId } = render(InspectorPropertiesFor(familyType, t, { onPropertyChange }));

    const width = getByTestId('inspector-family-type-param-widthMm') as HTMLInputElement;
    fireEvent.blur(width, { target: { value: '1000' } });
    expect(onPropertyChange).toHaveBeenCalledWith('parameters.widthMm', 1000);

    fireEvent.change(getByTestId('inspector-family-type-param-fireRated'), {
      target: { value: 'true' },
    });
    expect(onPropertyChange).toHaveBeenCalledWith('parameters.fireRated', true);
  });
});

describe('InspectorConstraintsFor', () => {
  it('renders wall constraints (location line, wrap rule)', () => {
    const { getByText } = render(InspectorConstraintsFor(wall, t));
    expect(getByText('Wall centerline')).toBeTruthy();
  });

  it('falls back gracefully for unsupported kinds', () => {
    const { getByText } = render(InspectorConstraintsFor(door, t));
    expect(getByText(/No constraints surface/)).toBeTruthy();
  });
});

describe('InspectorIdentityFor', () => {
  it('renders kind, id, and name', () => {
    const { getByText } = render(InspectorIdentityFor(wall, t));
    expect(getByText('wall')).toBeTruthy();
    expect(getByText('seed-w-eg-south')).toBeTruthy();
    expect(getByText('EG South')).toBeTruthy();
  });
});

describe('InspectorGraphicsFor — T-14 / WP-UI-B01', () => {
  const planView: Element = {
    kind: 'plan_view',
    id: 'seed-plan-eg',
    name: 'Ground Floor Plan',
    levelId: 'seed-lvl-ground',
    planPresentation: 'default',
  };

  const viewTemplate: Element = {
    kind: 'view_template',
    id: 'seed-tmpl-1',
    name: 'Default Template',
    scale: 'scale_100',
  };

  const elementsById: Record<string, Element> = {
    [planView.id]: planView,
    [viewTemplate.id]: viewTemplate,
  };

  it('renders graphics panel for plan_view', () => {
    const result = InspectorGraphicsFor({
      el: planView,
      elementsById,
      revision: 1,
      onPersistProperty: vi.fn(),
    });
    const { container } = render(result!);
    expect(container.firstChild).toBeTruthy();
  });

  it('persists Area Plan subtype and scheme from the plan view editor', () => {
    const onPersistProperty = vi.fn();
    const areaPlan: Element = {
      ...planView,
      planViewSubtype: 'area_plan',
      areaScheme: 'gross_building',
    };
    const { getByTestId } = render(
      <InspectorPlanViewEditor
        el={areaPlan}
        elementsById={{ ...elementsById, [areaPlan.id]: areaPlan }}
        revision={1}
        onPersistProperty={onPersistProperty}
      />,
    );

    fireEvent.change(getByTestId('inspector-plan-view-subtype'), {
      target: { value: 'area_plan' },
    });
    fireEvent.change(getByTestId('inspector-plan-view-area-scheme'), {
      target: { value: 'rentable' },
    });
    fireEvent.change(getByTestId('inspector-plan-view-subdiscipline'), {
      target: { value: 'Coordination' },
    });

    expect(onPersistProperty).toHaveBeenCalledWith('planViewSubtype', 'area_plan');
    expect(onPersistProperty).toHaveBeenCalledWith('areaScheme', 'rentable');
    expect(onPersistProperty).toHaveBeenCalledWith('viewSubdiscipline', 'Coordination');
  });

  it('renders graphics panel for view_template with footnote', () => {
    const result = InspectorGraphicsFor({
      el: viewTemplate,
      elementsById,
      revision: 1,
      onPersistProperty: vi.fn(),
    });
    const { getByText } = render(result!);
    expect(getByText(/Template defaults/)).toBeTruthy();
  });

  it('returns null for non-graphics element kinds', () => {
    const result = InspectorGraphicsFor({
      el: wall as Element,
      elementsById,
      revision: 1,
      onPersistProperty: vi.fn(),
    });
    expect(result).toBeNull();
  });
});

describe('InspectorViewTemplateEditor', () => {
  it('persists include and lock controls for template-controlled fields', () => {
    const onPersistProperty = vi.fn();
    const template: Extract<Element, { kind: 'view_template' }> = {
      kind: 'view_template',
      id: 'vt-locked',
      name: 'Template',
      scale: 100,
      templateControlMatrix: {
        scale: { included: true, locked: true },
      },
    };

    const { getByTestId } = render(
      <InspectorViewTemplateEditor
        el={template}
        revision={1}
        elementsById={{ [template.id]: template }}
        onPersistProperty={onPersistProperty}
      />,
    );

    fireEvent.click(getByTestId('inspector-vt-control-scale-include'));
    expect(onPersistProperty).toHaveBeenCalledWith(
      '__updateViewTemplate__',
      JSON.stringify({
        templateControlMatrix: { scale: { included: false, locked: false } },
      }),
    );
  });
});

describe('InspectorPropertiesFor — text_note (ANN-01)', () => {
  const textNote: Extract<Element, { kind: 'text_note' }> = {
    kind: 'text_note',
    id: 'tn-1',
    hostViewId: 'pv-1',
    positionMm: { xMm: 1000, yMm: 2000 },
    text: 'Sample note',
    fontSizeMm: 200,
  };

  it('shows content textarea and font size input when onPropertyChange is provided', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    expect(getByTestId('inspector-text-note-content')).toBeTruthy();
    expect(getByTestId('inspector-text-note-font-size')).toBeTruthy();
    expect(getByTestId('inspector-text-note-rotation')).toBeTruthy();
  });

  it('calls onPropertyChange with text on content blur', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    const textarea = getByTestId('inspector-text-note-content') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Updated text' } });
    fireEvent.blur(textarea);
    expect(onChange).toHaveBeenCalledWith('text', 'Updated text');
  });

  it('calls onPropertyChange with fontSizeMm on blur', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-text-note-font-size') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('fontSizeMm', 300);
  });

  it('shows read-only content when no onPropertyChange', () => {
    const { getByText, queryByTestId } = render(InspectorPropertiesFor(textNote, t));
    expect(getByText('Sample note')).toBeTruthy();
    expect(queryByTestId('inspector-text-note-content')).toBeNull();
  });
});

describe('InspectorPropertiesFor — leader_text (ANN-02)', () => {
  const leaderText: Extract<Element, { kind: 'leader_text' }> = {
    kind: 'leader_text',
    id: 'lt-1',
    hostViewId: 'pv-1',
    anchorMm: { xMm: 0, yMm: 0 },
    elbowMm: { xMm: 300, yMm: 0 },
    textMm: { xMm: 600, yMm: 0 },
    content: 'Wall A',
  };

  it('shows content textarea and arrow-style selector when onPropertyChange is provided', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(leaderText, t, { onPropertyChange: onChange }),
    );
    expect(getByTestId('inspector-leader-text-content')).toBeTruthy();
    expect(getByTestId('inspector-leader-text-arrow-style')).toBeTruthy();
  });

  it('calls onPropertyChange with content on blur', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(leaderText, t, { onPropertyChange: onChange }),
    );
    const textarea = getByTestId('inspector-leader-text-content') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New label' } });
    fireEvent.blur(textarea);
    expect(onChange).toHaveBeenCalledWith('content', 'New label');
  });

  it('calls onPropertyChange with arrowStyle on select change', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(leaderText, t, { onPropertyChange: onChange }),
    );
    const select = getByTestId('inspector-leader-text-arrow-style') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'dot' } });
    expect(onChange).toHaveBeenCalledWith('arrowStyle', 'dot');
  });

  it('shows read-only content when no onPropertyChange', () => {
    const { getByText, queryByTestId } = render(InspectorPropertiesFor(leaderText, t));
    expect(getByText('Wall A')).toBeTruthy();
    expect(queryByTestId('inspector-leader-text-content')).toBeNull();
  });
});

describe('InspectorPropertiesFor — dimension text decoration (ANN-11)', () => {
  const baseDim: Extract<Element, { kind: 'dimension' }> = {
    kind: 'dimension',
    id: 'dim-1',
    name: 'D1',
    levelId: 'lvl-1',
    aMm: { xMm: 0, yMm: 0 },
    bMm: { xMm: 3000, yMm: 0 },
    offsetMm: { xMm: 0, yMm: -500 },
  };

  it('shows prefix/suffix/override inputs when onPropertyChange provided', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(baseDim, t, { onPropertyChange: onChange }),
    );
    expect(getByTestId('dimension-text-prefix')).toBeTruthy();
    expect(getByTestId('dimension-text-suffix')).toBeTruthy();
    expect(getByTestId('dimension-text-override')).toBeTruthy();
  });

  it('calls onPropertyChange with textPrefix on blur', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(baseDim, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('dimension-text-prefix') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '≈' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('textPrefix', '≈');
  });

  it('calls onPropertyChange with textOverride on blur', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(baseDim, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('dimension-text-override') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'VARIES' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('textOverride', 'VARIES');
  });

  it('passes null when override is cleared', () => {
    const onChange = vi.fn();
    const dimWithOverride: typeof baseDim = { ...baseDim, textOverride: 'OLD' };
    const { getByTestId } = render(
      InspectorPropertiesFor(dimWithOverride, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('dimension-text-override') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('textOverride', null);
  });
});

describe('InspectorPropertiesFor — A4-A9 annotation elements', () => {
  it('angular_dimension shows vertex and ray positions', () => {
    const el: Extract<Element, { kind: 'angular_dimension' }> = {
      kind: 'angular_dimension',
      id: 'ad-1',
      hostViewId: 'pv-1',
      vertexMm: { xMm: 500, yMm: 500 },
      rayAMm: { xMm: 1000, yMm: 500 },
      rayBMm: { xMm: 500, yMm: 1000 },
    };
    const { getByText } = render(InspectorPropertiesFor(el, t));
    expect(getByText('Vertex')).toBeTruthy();
    expect(getByText('(500, 500) mm')).toBeTruthy();
  });

  it('radial_dimension shows radius measurement', () => {
    const el: Extract<Element, { kind: 'radial_dimension' }> = {
      kind: 'radial_dimension',
      id: 'rd-1',
      hostViewId: 'pv-1',
      centerMm: { xMm: 0, yMm: 0 },
      arcPointMm: { xMm: 1000, yMm: 0 },
    };
    const { getByText } = render(InspectorPropertiesFor(el, t));
    expect(getByText('1000 mm')).toBeTruthy();
  });

  it('diameter_dimension shows diameter (2× radius)', () => {
    const el: Extract<Element, { kind: 'diameter_dimension' }> = {
      kind: 'diameter_dimension',
      id: 'dd-1',
      hostViewId: 'pv-1',
      centerMm: { xMm: 0, yMm: 0 },
      arcPointMm: { xMm: 500, yMm: 0 },
    };
    const { getByText } = render(InspectorPropertiesFor(el, t));
    expect(getByText('1000 mm')).toBeTruthy();
  });

  it('arc_length_dimension shows arc length', () => {
    const el: Extract<Element, { kind: 'arc_length_dimension' }> = {
      kind: 'arc_length_dimension',
      id: 'ald-1',
      hostViewId: 'pv-1',
      centerMm: { xMm: 0, yMm: 0 },
      radiusMm: 1000,
      startAngleDeg: 0,
      endAngleDeg: 90,
    };
    const { getByText } = render(InspectorPropertiesFor(el, t));
    expect(getByText('90.0°')).toBeTruthy();
    expect(getByText('1571 mm')).toBeTruthy();
  });

  it('spot_elevation shows elevation and editable mm input when onChange provided', () => {
    const onChange = vi.fn();
    const el: Extract<Element, { kind: 'spot_elevation' }> = {
      kind: 'spot_elevation',
      id: 'se-1',
      hostViewId: 'pv-1',
      positionMm: { xMm: 0, yMm: 0 },
      elevationMm: 3000,
    };
    const { getByText, getByTestId } = render(
      InspectorPropertiesFor(el, t, { onPropertyChange: onChange }),
    );
    expect(getByText('3.000 m')).toBeTruthy();
    const input = getByTestId('inspector-spot-elevation-mm') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4500' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('elevationMm', 4500);
  });

  it('spot_coordinate shows N/E values', () => {
    const el: Extract<Element, { kind: 'spot_coordinate' }> = {
      kind: 'spot_coordinate',
      id: 'sc-1',
      hostViewId: 'pv-1',
      positionMm: { xMm: 100, yMm: 200 },
      northMm: 1500,
      eastMm: 2000,
    };
    const { getByText } = render(InspectorPropertiesFor(el, t));
    expect(getByText('1500')).toBeTruthy();
    expect(getByText('2000')).toBeTruthy();
  });

  it('spot_slope shows editable slope when onChange provided', () => {
    const onChange = vi.fn();
    const el: Extract<Element, { kind: 'spot_slope' }> = {
      kind: 'spot_slope',
      id: 'ss-1',
      hostViewId: 'pv-1',
      positionMm: { xMm: 0, yMm: 0 },
      slopePct: 5,
    };
    const { getByTestId } = render(InspectorPropertiesFor(el, t, { onPropertyChange: onChange }));
    const input = getByTestId('inspector-spot-slope-pct') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('slopePct', 8);
  });
});

describe('InspectorProjectSettingsEditor', () => {
  it('persists checkpoint retention as a clamped project setting', () => {
    const onPersistProperty = vi.fn();
    const projectSettings: Extract<Element, { kind: 'project_settings' }> = {
      kind: 'project_settings',
      id: 'project_settings',
      checkpointRetentionLimit: 12,
    };

    const { getByTestId } = render(
      <InspectorProjectSettingsEditor el={projectSettings} onPersistProperty={onPersistProperty} />,
    );

    const input = getByTestId('inspector-checkpoint-retention-limit') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);

    expect(input.value).toBe('99');
    expect(onPersistProperty).toHaveBeenCalledWith('checkpointRetentionLimit', '99');
  });
});
