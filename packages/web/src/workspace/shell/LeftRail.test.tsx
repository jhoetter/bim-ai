import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { LeftRail, LeftRailCollapsed, type LeftRailSection } from './LeftRail';

afterEach(() => {
  cleanup();
});

const sections: LeftRailSection[] = [
  {
    id: 'project',
    label: 'Project',
    rows: [
      {
        id: 'levels',
        label: 'Levels',
        children: [
          { id: 'level-ground', label: 'Ground' },
          { id: 'level-upper', label: 'Upper' },
        ],
      },
      { id: 'site', label: 'Site' },
    ],
  },
  {
    id: 'views',
    label: 'Views',
    rows: [
      {
        id: 'plans',
        label: 'Floor Plans',
        children: [
          { id: 'plan-eg', label: 'Ground — Plan' },
          { id: 'plan-og', label: 'Upper — Plan' },
        ],
      },
      { id: '3d-default', label: 'Default Orbit' },
    ],
  },
];

describe('LeftRail — spec §12', () => {
  it('renders section header action and emits click', () => {
    const onCreate = vi.fn();
    const withAction: LeftRailSection[] = [
      {
        ...sections[0],
        headerAction: {
          label: 'New project item',
          testId: 'left-rail-section-action-project',
          onClick: onCreate,
        },
      },
      sections[1],
    ];
    const { getByTestId } = render(<LeftRail sections={withAction} />);
    fireEvent.click(getByTestId('left-rail-section-action-project'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('renders sections with uppercase eyebrow labels and rows', () => {
    const { getByText } = render(<LeftRail sections={sections} />);
    expect(getByText('Project')).toBeTruthy();
    expect(getByText('Views')).toBeTruthy();
    expect(getByText('Levels')).toBeTruthy();
    expect(getByText('Default Orbit')).toBeTruthy();
  });

  it('hides children of collapsed parents and reveals on expand', () => {
    const { getByTestId, queryByText } = render(<LeftRail sections={sections} />);
    expect(queryByText('Ground')).toBeNull();
    fireEvent.click(getByTestId('left-rail-row-levels'));
    expect(queryByText('Ground')).not.toBeNull();
    expect(queryByText('Upper')).not.toBeNull();
  });

  it('marks the active row with aria-selected and the selected style', () => {
    const { getByTestId } = render(
      <LeftRail
        sections={sections}
        activeRowId="3d-default"
        defaultExpanded={new Set(['plans'])}
      />,
    );
    const active = getByTestId('left-rail-row-3d-default');
    expect(active.getAttribute('aria-selected')).toBe('true');
    expect(active.getAttribute('data-active')).toBe('true');
  });

  it('emits onRowActivate on click and commits inline rename from F2', () => {
    const onRowActivate = vi.fn();
    const onRowRename = vi.fn();
    const { getByTestId, getByRole } = render(
      <LeftRail sections={sections} onRowActivate={onRowActivate} onRowRename={onRowRename} />,
    );
    fireEvent.click(getByTestId('left-rail-row-site'));
    expect(onRowActivate).toHaveBeenCalledWith('site');
    fireEvent.keyDown(getByRole('tree'), { key: 'F2' });
    const input = getByTestId('left-rail-rename-input-site') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Terrain' } });
    fireEvent.blur(input);
    expect(onRowRename).toHaveBeenCalledWith('site', 'Terrain');
  });

  it('starts inline rename on row double click', () => {
    const onRowRename = vi.fn();
    const { getByTestId } = render(<LeftRail sections={sections} onRowRename={onRowRename} />);
    fireEvent.doubleClick(getByTestId('left-rail-row-site'));
    const input = getByTestId('left-rail-rename-input-site') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Site Plan' } });
    fireEvent.blur(input);
    expect(onRowRename).toHaveBeenCalledWith('site', 'Site Plan');
  });

  it('emits onRowContextMenu on right click and keyboard context menu', () => {
    const onRowContextMenu = vi.fn();
    const { getByTestId, getByRole } = render(
      <LeftRail sections={sections} onRowContextMenu={onRowContextMenu} />,
    );

    fireEvent.contextMenu(getByTestId('left-rail-row-site'), { clientX: 44, clientY: 55 });
    expect(onRowContextMenu).toHaveBeenCalledWith('site', { x: 44, y: 55 });

    fireEvent.keyDown(getByRole('tree'), { key: 'ContextMenu' });
    expect(onRowContextMenu).toHaveBeenCalledWith(
      'site',
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });

  it('navigates with ArrowDown / ArrowUp / ArrowRight / ArrowLeft', () => {
    const onRowActivate = vi.fn();
    const { getByRole } = render(
      <LeftRail
        sections={sections}
        defaultExpanded={new Set(['plans'])}
        onRowActivate={onRowActivate}
      />,
    );
    const tree = getByRole('tree');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onRowActivate).toHaveBeenCalled();
  });

  it('filters rows by search query', () => {
    const { getByLabelText, queryByText } = render(<LeftRail sections={sections} />);
    const search = getByLabelText('Search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'orbit' } });
    expect(queryByText('Default Orbit')).not.toBeNull();
    expect(queryByText('Site')).toBeNull();
  });
});

describe('LeftRailCollapsed — icon strip', () => {
  it('renders one button per section with aria-label', () => {
    const { getAllByRole } = render(<LeftRailCollapsed sections={sections} />);
    const buttons = getAllByRole('button').filter((button) =>
      sections.some((section) => button.getAttribute('aria-label')?.startsWith(section.label)),
    );
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-label')).toContain('Project');
    expect(buttons[1].getAttribute('aria-label')).toContain('Views');
  });

  it('marks the section containing the active row in collapsed mode', () => {
    const { getByRole } = render(<LeftRailCollapsed sections={sections} activeRowId="plan-eg" />);
    expect(getByRole('button', { name: /Views/ }).getAttribute('data-active')).toBe('true');
  });
});
