import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import type { Element } from '@bim-ai/core';

import { ScheduleDefinitionToolbar } from './ScheduleDefinitionToolbar';

afterEach(() => {
  cleanup();
});

function makeScheduleEl(id: string): Extract<Element, { kind: 'schedule' }> {
  return {
    kind: 'schedule',
    id,
    name: id,
    filters: { category: 'room' },
    grouping: { sortBy: 'name', groupKeys: [], sortDescending: false },
  };
}

function makeLevel(id: string, name: string): Extract<Element, { kind: 'level' }> {
  return { kind: 'level', id, name, elevationMm: 0 };
}

const BASE_ELEMENTS: Record<string, Element> = {
  sched1: makeScheduleEl('sched1'),
  lv1: makeLevel('lv1', 'Level 1'),
  lv2: makeLevel('lv2', 'Level 2'),
};

const SRV_ACTIVE = {
  tab: 'rooms' as const,
  scheduleId: 'sched1',
  data: { columns: ['name', 'level', 'areaM2'], rows: [] },
};

function renderToolbar(overrides: Partial<Parameters<typeof ScheduleDefinitionToolbar>[0]> = {}) {
  return render(
    <ScheduleDefinitionToolbar
      tab="rooms"
      scheduleId="sched1"
      srvActive={SRV_ACTIVE}
      modelId="model-1"
      elementsById={BASE_ELEMENTS}
      onScheduleFiltersCommit={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ScheduleDefinitionToolbar — WP-F', () => {
  it('renders the Export CSV button with correct data-testid', () => {
    const { getByTestId } = renderToolbar();
    expect(getByTestId('schedule-export-csv')).toBeTruthy();
  });

  it('level filter dropdown shows "All Levels" plus project levels', () => {
    const { getByTestId } = renderToolbar();
    const select = getByTestId('schedule-level-filter') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.text);
    expect(options).toContain('All Levels');
    expect(options).toContain('Level 1');
    expect(options).toContain('Level 2');
  });

  it('selecting a level commits filterEquals with that levelId', () => {
    const onCommit = vi.fn();
    const { getByTestId } = renderToolbar({ onScheduleFiltersCommit: onCommit });
    const select = getByTestId('schedule-level-filter') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'lv1' } });
    expect(onCommit).toHaveBeenCalled();
    const [, filtersArg] = onCommit.mock.calls[0] as [string, Record<string, unknown>];
    const fe = filtersArg.filterEquals as Record<string, unknown>;
    expect(fe['levelId']).toBe('lv1');
  });
});
