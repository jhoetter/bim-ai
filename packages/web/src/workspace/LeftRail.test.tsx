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

  it('emits onRowActivate on click and onRowRename on F2', () => {
    const onRowActivate = vi.fn();
    const onRowRename = vi.fn();
    const { getByTestId, getByRole } = render(
      <LeftRail sections={sections} onRowActivate={onRowActivate} onRowRename={onRowRename} />,
    );
    fireEvent.click(getByTestId('left-rail-row-site'));
    expect(onRowActivate).toHaveBeenCalledWith('site');
    fireEvent.keyDown(getByRole('tree'), { key: 'F2' });
    expect(onRowRename).toHaveBeenCalledWith('site');
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
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-label')).toBe('Project');
    expect(buttons[1].getAttribute('aria-label')).toBe('Views');
  });
});
