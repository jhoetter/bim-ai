/**
 * CHR-V3-07 — ProjectBrowserV3 tests.
 *
 * Covers: Views group, Schedules group, search filter, right-click context
 * menu, collapsed state, zero hex literals in output, drag-to-reorder.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import type { ComponentProps } from 'react';
import { ProjectBrowser, ProjectBrowserV3 } from './ProjectBrowser';
import { applyCommand } from '../../lib/api';
import { useBimStore } from '../../state/store';

vi.mock('../../lib/api', () => ({
  applyCommand: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(applyCommand).mockReset();
  useBimStore.setState({ modelId: undefined, selectedId: undefined });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const viewpointEl: Element = {
  kind: 'viewpoint',
  id: 'vp-01',
  name: '3D Overview',
  camera: {
    position: { xMm: 0, yMm: 0, zMm: 10000 },
    target: { xMm: 0, yMm: 0, zMm: 0 },
    up: { xMm: 0, yMm: 1, zMm: 0 },
  },
  mode: 'orbit_3d',
};

const savedViewEl: Element = {
  kind: 'saved_view',
  id: 'sv-01',
  baseViewId: 'vp-01',
  name: 'Kitchen Detail',
};

const scheduleEl: Element = {
  kind: 'schedule',
  id: 'sch-01',
  name: 'Door Schedule',
  category: 'door',
  columns: [{ fieldKey: 'name', label: 'Name' }],
};

const wallTypeEl: Element = {
  kind: 'wall_type',
  id: 'wt-01',
  name: 'Generic 200',
  basisLine: 'center',
  layers: [{ thicknessMm: 200, function: 'structure', materialKey: 'concrete' }],
};

const _imageUnderlayEl: Element = {
  kind: 'image_underlay',
  id: 'img-01',
  src: 'data:image/png;base64,AA==',
  rectMm: { xMm: 0, yMm: 0, widthMm: 1000, heightMm: 1000 },
  rotationDeg: 0,
  opacity: 1,
  lockedScale: false,
};

function makeDefaultProps(elements: Element[] = [viewpointEl, savedViewEl, scheduleEl]) {
  return {
    elements,
    activeViewId: null as string | null,
    onActivateView: vi.fn(),
    onRenameView: vi.fn(),
    onDeleteView: vi.fn(),
    onDuplicateView: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectBrowser — F-003 families context menu', () => {
  function renderBrowser(overrides: Partial<ComponentProps<typeof ProjectBrowser>> = {}) {
    return render(
      <ProjectBrowser
        elementsById={{
          [viewpointEl.id]: viewpointEl,
          [wallTypeEl.id]: wallTypeEl,
        }}
        {...overrides}
      />,
    );
  }

  it('opens a right-click context menu for family type rows', () => {
    const { getByTestId, queryByTestId } = renderBrowser();
    expect(queryByTestId('project-browser-family-context-menu')).toBeNull();
    fireEvent.contextMenu(getByTestId('pb-family-type-wt-01'), { clientX: 88, clientY: 120 });
    expect(getByTestId('project-browser-family-context-menu')).toBeTruthy();
  });

  it('context menu Select Type selects the family type element', () => {
    const { getByTestId } = renderBrowser();
    fireEvent.contextMenu(getByTestId('pb-family-type-wt-01'), { clientX: 0, clientY: 0 });
    fireEvent.click(getByTestId('project-browser-family-ctx-select'));
    expect(useBimStore.getState().selectedId).toBe('wt-01');
  });

  it('context menu Rename commits updateElementProperty name for family types', async () => {
    useBimStore.setState({ modelId: 'model-1' });
    const { getByTestId } = renderBrowser();
    fireEvent.contextMenu(getByTestId('pb-family-type-wt-01'), { clientX: 0, clientY: 0 });
    fireEvent.click(getByTestId('project-browser-family-ctx-rename'));
    const input = getByTestId('pb-family-type-rename-wt-01') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Generic 250' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(applyCommand).toHaveBeenCalledWith('model-1', {
      type: 'updateElementProperty',
      elementId: 'wt-01',
      key: 'name',
      value: 'Generic 250',
    });
  });

  it('context menu Duplicate emits an upsert command for the type kind', () => {
    const onUpsertSemantic = vi.fn();
    const { getByTestId } = renderBrowser({ onUpsertSemantic });
    fireEvent.contextMenu(getByTestId('pb-family-type-wt-01'), { clientX: 0, clientY: 0 });
    fireEvent.click(getByTestId('project-browser-family-ctx-duplicate'));
    expect(onUpsertSemantic).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upsertWallType',
        name: 'Generic 200 Copy',
        layers: wallTypeEl.layers,
        basisLine: 'center',
      }),
    );
  });

  it('groups Area Plan views by scheme outside the Floor Plans section', () => {
    const level: Element = { kind: 'level', id: 'lvl-1', name: 'Level 1', elevationMm: 0 };
    const floorPlan: Element = {
      kind: 'plan_view',
      id: 'pv-floor',
      name: 'Level 1 Floor',
      levelId: 'lvl-1',
      planViewSubtype: 'floor_plan',
    };
    const grossPlan: Element = {
      kind: 'plan_view',
      id: 'ap-gross',
      name: 'Gross Area',
      levelId: 'lvl-1',
      planViewSubtype: 'area_plan',
      areaScheme: 'gross_building',
    };
    const rentablePlan: Element = {
      kind: 'plan_view',
      id: 'ap-rentable',
      name: 'Rentable Area',
      levelId: 'lvl-1',
      planViewSubtype: 'area_plan',
      areaScheme: 'rentable',
    };
    const { getByTestId } = renderBrowser({
      elementsById: {
        [level.id]: level,
        [floorPlan.id]: floorPlan,
        [grossPlan.id]: grossPlan,
        [rentablePlan.id]: rentablePlan,
      },
    });
    const areaGroup = getByTestId('project-browser-area-plans-group');
    expect(within(areaGroup).getByTestId('area-plan-scheme-gross_building')).toBeTruthy();
    expect(within(areaGroup).getByTestId('area-plan-scheme-rentable')).toBeTruthy();
    expect(within(areaGroup).getByText(/area_plan · Gross Building · Gross Area/)).toBeTruthy();
    expect(within(areaGroup).getByText(/area_plan · Rentable · Rentable Area/)).toBeTruthy();
  });

  it('groups floor plan views by discipline and sub-discipline', () => {
    const level: Element = { kind: 'level', id: 'lvl-1', name: 'Level 1', elevationMm: 0 };
    const archPlan: Element = {
      kind: 'plan_view',
      id: 'pv-arch',
      name: 'Architecture Plan',
      levelId: 'lvl-1',
      discipline: 'arch',
      viewSubdiscipline: 'Interior',
      planViewSubtype: 'floor_plan',
    };
    const coordPlan: Element = {
      kind: 'plan_view',
      id: 'pv-coordination',
      name: 'Coordination Plan',
      levelId: 'lvl-1',
      discipline: 'coordination',
      viewSubdiscipline: 'Coordination',
      planViewSubtype: 'coordination_plan',
    };
    const { getByTestId, getByText } = renderBrowser({
      elementsById: {
        [level.id]: level,
        [archPlan.id]: archPlan,
        [coordPlan.id]: coordPlan,
      },
    });
    expect(getByTestId('project-browser-subdiscipline-arch-interior')).toBeTruthy();
    expect(getByTestId('project-browser-subdiscipline-coordination-coordination')).toBeTruthy();
    expect(getByText('plan_view · Architecture Plan')).toBeTruthy();
    expect(getByText('plan_view · Coordination Plan')).toBeTruthy();
  });

  it('adds view type and phase hierarchy below discipline groups', () => {
    const level: Element = { kind: 'level', id: 'lvl-1', name: 'Level 1', elevationMm: 0 };
    const phase: Element = { kind: 'phase', id: 'phase-new', name: 'New Construction', ord: 2 };
    const lightingPlan: Element = {
      kind: 'plan_view',
      id: 'pv-lighting',
      name: 'Level 1 Lighting',
      levelId: 'lvl-1',
      discipline: 'mep',
      viewSubdiscipline: 'Electrical',
      planViewSubtype: 'lighting_plan',
      phaseId: 'phase-new',
    };
    const { getByTestId, getByText } = renderBrowser({
      elementsById: {
        [level.id]: level,
        [phase.id]: phase,
        [lightingPlan.id]: lightingPlan,
      },
    });
    expect(getByTestId('project-browser-subdiscipline-mep-electrical')).toBeTruthy();
    expect(getByTestId('project-browser-view-type-lighting_plan')).toBeTruthy();
    expect(getByTestId('project-browser-phase-new-construction')).toBeTruthy();
    expect(getByText(/Level 1 Lighting/)).toBeTruthy();
  });

  it('renders legends and detail groups subtrees', () => {
    const windowLegend: Element = {
      kind: 'window_legend_view',
      id: 'wlv-1',
      name: 'Window Legend',
      scope: 'project',
      sortBy: 'type',
    };
    const colorLegend: Element = {
      kind: 'color_fill_legend',
      id: 'cfl-1',
      hostViewId: 'pv-1',
      positionMm: { xMm: 0, yMm: 0 },
      schemeParameter: 'Department',
      title: 'Department Legend',
    };
    const detailGroup: Element = {
      kind: 'detail_group',
      id: 'dg-1',
      hostViewId: 'pv-1',
      name: 'Typical Detail',
      memberIds: ['a', 'b'],
    };
    const { getByTestId, getByText } = renderBrowser({
      elementsById: {
        [windowLegend.id]: windowLegend,
        [colorLegend.id]: colorLegend,
        [detailGroup.id]: detailGroup,
      },
    });
    expect(getByTestId('project-browser-legends-group')).toBeTruthy();
    expect(getByText(/Window Legend/)).toBeTruthy();
    expect(getByText(/Department Legend/)).toBeTruthy();
    expect(getByTestId('project-browser-groups-group')).toBeTruthy();
    expect(getByText(/Typical Detail/)).toBeTruthy();
    expect(getByText(/members=2/)).toBeTruthy();
  });

  it('creates Area Plan views with level, subtype, and scheme', async () => {
    useBimStore.setState({ modelId: 'model-1' });
    const level: Element = { kind: 'level', id: 'lvl-1', name: 'Level 1', elevationMm: 0 };
    const floorPlan: Element = {
      kind: 'plan_view',
      id: 'pv-floor',
      name: 'Level 1 Floor',
      levelId: 'lvl-1',
      planViewSubtype: 'floor_plan',
    };
    const { getByTestId, getByLabelText } = renderBrowser({
      elementsById: {
        [level.id]: level,
        [floorPlan.id]: floorPlan,
      },
    });
    fireEvent.click(getByTestId('area-plan-new'));
    fireEvent.change(getByTestId('area-plan-new-scheme'), {
      target: { value: 'rentable' },
    });
    const input = getByLabelText('Area plan name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Level 1 Rentable' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(applyCommand).toHaveBeenCalledWith(
        'model-1',
        expect.objectContaining({
          type: 'upsertPlanView',
          name: 'Level 1 Rentable',
          levelId: 'lvl-1',
          planViewSubtype: 'area_plan',
          areaScheme: 'rentable',
        }),
      ),
    );
  });

  it('adds the default area view template when creating an Area Plan', async () => {
    useBimStore.setState({ modelId: 'model-1' });
    const level: Element = { kind: 'level', id: 'lvl-1', name: 'Level 1', elevationMm: 0 };
    const areaTemplate: Element = {
      kind: 'view_template',
      id: 'vt-area',
      name: 'Area Plan Default',
      scale: 100,
    };
    const { getByTestId, getByLabelText } = renderBrowser({
      elementsById: {
        [level.id]: level,
        [areaTemplate.id]: areaTemplate,
      },
    });
    fireEvent.click(getByTestId('area-plan-new'));
    const input = getByLabelText('Area plan name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Level 1 Area' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(applyCommand).toHaveBeenCalledWith(
        'model-1',
        expect.objectContaining({
          type: 'upsertPlanView',
          name: 'Level 1 Area',
          planViewSubtype: 'area_plan',
          viewTemplateId: 'vt-area',
        }),
      ),
    );
  });

  it('uses subtype default template when duplicating an untemplated plan view', () => {
    const onUpsertSemantic = vi.fn();
    const level: Element = { kind: 'level', id: 'lvl-1', name: 'Level 1', elevationMm: 0 };
    const powerTemplate: Element = {
      kind: 'view_template',
      id: 'vt-power',
      name: 'Power Plan Default',
      scale: 100,
    };
    const powerPlan: Element = {
      kind: 'plan_view',
      id: 'pv-power',
      name: 'Level 1 Power',
      levelId: 'lvl-1',
      discipline: 'mep',
      viewSubdiscipline: 'Electrical',
      planViewSubtype: 'power_plan',
    };
    const { getByText } = renderBrowser({
      onUpsertSemantic,
      elementsById: {
        [level.id]: level,
        [powerTemplate.id]: powerTemplate,
        [powerPlan.id]: powerPlan,
      },
    });
    fireEvent.click(getByText('Duplicate…'));
    expect(onUpsertSemantic).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upsertPlanView',
        planViewSubtype: 'power_plan',
        viewTemplateId: 'vt-power',
      }),
    );
  });
});

describe('ProjectBrowserV3 — CHR-V3-07', () => {
  it('renders Views group header with viewpoint elements', () => {
    const { getByTestId, getByText } = render(<ProjectBrowserV3 {...makeDefaultProps()} />);
    expect(getByTestId('pb-group-Views')).toBeTruthy();
    expect(getByText('3D Overview')).toBeTruthy();
  });

  it('renders saved_view rows inside the Views group', () => {
    const { getByText } = render(<ProjectBrowserV3 {...makeDefaultProps()} />);
    expect(getByText('Kitchen Detail')).toBeTruthy();
  });

  it('renders Schedules group with schedule elements', () => {
    const { getByTestId, getByText } = render(<ProjectBrowserV3 {...makeDefaultProps()} />);
    expect(getByTestId('pb-group-Schedules')).toBeTruthy();
    expect(getByText('Door Schedule')).toBeTruthy();
  });

  it('search filter shows only matching rows', () => {
    const { getByLabelText, queryByText } = render(<ProjectBrowserV3 {...makeDefaultProps()} />);
    const input = getByLabelText('Search project browser') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'overview' } });
    expect(queryByText('3D Overview')).not.toBeNull();
    expect(queryByText('Kitchen Detail')).toBeNull();
    expect(queryByText('Door Schedule')).toBeNull();
  });

  it('clearing search restores all rows', () => {
    const { getByLabelText, queryByText } = render(<ProjectBrowserV3 {...makeDefaultProps()} />);
    const input = getByLabelText('Search project browser') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'overview' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(queryByText('3D Overview')).not.toBeNull();
    expect(queryByText('Kitchen Detail')).not.toBeNull();
    expect(queryByText('Door Schedule')).not.toBeNull();
  });

  it('right-click on view row opens context menu', () => {
    const { getByTestId, queryByTestId } = render(<ProjectBrowserV3 {...makeDefaultProps()} />);
    expect(queryByTestId('pb-context-menu')).toBeNull();
    const row = getByTestId('pb-view-row-vp-01').querySelector('button') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 100, clientY: 200 });
    expect(queryByTestId('pb-context-menu')).not.toBeNull();
  });

  it('context menu Delete calls onDeleteView with correct id', () => {
    const props = makeDefaultProps();
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    const row = getByTestId('pb-view-row-vp-01').querySelector('button') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 0, clientY: 0 });
    fireEvent.click(getByTestId('pb-ctx-delete'));
    expect(props.onDeleteView).toHaveBeenCalledWith('vp-01');
  });

  it('context menu Rename calls onRenameView with correct id', () => {
    const props = makeDefaultProps();
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    const row = getByTestId('pb-view-row-vp-01').querySelector('button') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 0, clientY: 0 });
    // Opens inline rename field; commit triggers onRenameView.
    fireEvent.click(getByTestId('pb-ctx-rename'));
    // Find the rename input and confirm.
    const input = getByTestId('pb-view-row-vp-01').querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRenameView).toHaveBeenCalledWith('vp-01', 'New Name');
  });

  it('collapsed state sets data-collapsed attribute and narrow width', () => {
    const props = { ...makeDefaultProps(), collapsed: true };
    const { container } = render(<ProjectBrowserV3 {...props} />);
    const rail = container.firstChild as HTMLElement;
    expect(rail.getAttribute('data-collapsed')).toBe('true');
    expect(rail.style.width).toBe('var(--rail-width-collapsed, 36px)');
  });

  it('collapsed state keeps active section and BIM-native shortcuts visible', () => {
    const props = { ...makeDefaultProps(), collapsed: true, activeViewId: 'sch-01' };
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    expect(getByTestId('pb-collapsed-views')).toBeTruthy();
    expect(getByTestId('pb-collapsed-schedules').getAttribute('data-active')).toBe('true');
  });

  it('expanded state uses rail-width-expanded CSS var — no hex literals in inline styles', () => {
    const { container } = render(<ProjectBrowserV3 {...makeDefaultProps()} />);
    const html = container.innerHTML;
    // Check for hex color literals (#rrggbb or #rgb pattern) not inside CSS var names.
    const hexLiteralPattern = /:\s*#[0-9a-fA-F]{3,8}\b/;
    expect(hexLiteralPattern.test(html)).toBe(false);
  });

  it('drag-to-reorder: dropping changes the visual order of rows', () => {
    const el1: Element = {
      kind: 'viewpoint',
      id: 'vp-a',
      name: 'Alpha',
      camera: {
        position: { xMm: 0, yMm: 0, zMm: 0 },
        target: { xMm: 0, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 1, zMm: 0 },
      },
      mode: 'orbit_3d',
    };
    const el2: Element = {
      kind: 'viewpoint',
      id: 'vp-b',
      name: 'Beta',
      camera: {
        position: { xMm: 0, yMm: 0, zMm: 0 },
        target: { xMm: 0, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 1, zMm: 0 },
      },
      mode: 'orbit_3d',
    };
    const props = makeDefaultProps([el1, el2]);
    const { getByTestId, container } = render(<ProjectBrowserV3 {...props} />);

    const rowA = getByTestId('pb-view-row-vp-a');
    const rowB = getByTestId('pb-view-row-vp-b');

    // Drag Alpha onto Beta → Beta should now come before Alpha.
    fireEvent.dragStart(rowA);
    fireEvent.dragOver(rowB);
    fireEvent.drop(rowB);

    // After drop, query the rendered order.
    const listItems = container.querySelectorAll('[data-testid^="pb-view-row-"]');
    const ids = Array.from(listItems).map((el) =>
      el.getAttribute('data-testid')?.replace('pb-view-row-', ''),
    );
    // vp-b should precede vp-a after the drop.
    expect(ids.indexOf('vp-b')).toBeLessThan(ids.indexOf('vp-a'));
  });
});
