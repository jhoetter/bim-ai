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

  it('renders door alongT and width', () => {
    const { getByText } = render(InspectorPropertiesFor(door, t));
    expect(getByText('900 mm')).toBeTruthy();
    expect(getByText('0.500')).toBeTruthy();
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
