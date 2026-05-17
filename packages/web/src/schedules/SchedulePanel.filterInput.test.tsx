import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { Element } from '@bim-ai/core';

import { SchedulePanel } from './SchedulePanel';

afterEach(() => {
  cleanup();
});

function makeLevel(id: string, name: string): Element {
  return { kind: 'level', id, name, elevationMm: 0 } as unknown as Element;
}

function makeWall(id: string, levelId: string): Element {
  return {
    kind: 'wall',
    id,
    name: `Wall ${id}`,
    levelId,
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 5000, yMm: 0 },
    heightMm: 3000,
    thicknessMm: 200,
    wallTypeId: null,
  } as unknown as Element;
}

function makeDoor(id: string, wallId: string, name: string, familyTypeId = 'TypeA'): Element {
  return {
    kind: 'door',
    id,
    name,
    wallId,
    alongT: 0.5,
    widthMm: 900,
    heightMm: 2100,
    familyTypeId,
  } as unknown as Element;
}

const baseElements: Record<string, Element> = {
  lvl1: makeLevel('lvl1', 'Level 1'),
  w1: makeWall('w1', 'lvl1'),
  d1: makeDoor('d1', 'w1', 'Door Alpha', 'TypeAlpha'),
  d2: makeDoor('d2', 'w1', 'Door Beta', 'TypeBeta'),
  d3: makeDoor('d3', 'w1', 'Door Gamma', 'TypeAlpha'),
};

describe('SchedulePanel filter input', () => {
  it('renders schedule-filter-input on doors tab', () => {
    render(<SchedulePanel elementsById={baseElements} />);
    fireEvent.click(screen.getByTestId('schedule-tab-doors'));
    expect(screen.getByTestId('schedule-filter-input')).toBeTruthy();
  });

  it('filtering hides non-matching rows', () => {
    render(<SchedulePanel elementsById={baseElements} />);
    fireEvent.click(screen.getByTestId('schedule-tab-doors'));

    // All 3 unique door types visible initially — row-count shows 1 grouped row per type
    const filterInput = screen.getByTestId('schedule-filter-input');

    // Filter to only "Alpha" rows
    fireEvent.change(filterInput, { target: { value: 'Alpha' } });

    const panel = screen.getByTestId('schedule-panel');
    // TypeAlpha should appear, TypeBeta should not
    expect(panel.textContent).toMatch(/Alpha/i);
    expect(panel.textContent).not.toMatch(/Beta/i);
  });

  it('clearing filter restores all rows', () => {
    render(<SchedulePanel elementsById={baseElements} />);
    fireEvent.click(screen.getByTestId('schedule-tab-doors'));

    const filterInput = screen.getByTestId('schedule-filter-input');
    fireEvent.change(filterInput, { target: { value: 'Alpha' } });
    fireEvent.change(filterInput, { target: { value: '' } });

    const panel = screen.getByTestId('schedule-panel');
    expect(panel.textContent).toMatch(/Alpha/i);
    expect(panel.textContent).toMatch(/Beta/i);
  });
});
