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

function makeDoor(id: string, wallId: string, widthMm = 900): Element {
  return {
    kind: 'door',
    id,
    name: `Door ${id}`,
    wallId,
    alongT: 0.5,
    widthMm,
    familyTypeId: 'TypeA',
  } as unknown as Element;
}

function makeWindow(id: string, wallId: string): Element {
  return {
    kind: 'window',
    id,
    name: `Win ${id}`,
    wallId,
    alongT: 0.5,
    widthMm: 1200,
    heightMm: 1400,
    sillHeightMm: 900,
    familyTypeId: 'WinTypeA',
  } as unknown as Element;
}

function makeColumn(id: string, levelId: string): Element {
  return {
    kind: 'column',
    id,
    name: `Col ${id}`,
    levelId,
    positionMm: { xMm: 0, yMm: 0 },
    bMm: 300,
    hMm: 300,
    heightMm: 3000,
  } as unknown as Element;
}

const baseElements: Record<string, Element> = {
  lvl1: makeLevel('lvl1', 'Level 1'),
  w1: makeWall('w1', 'lvl1'),
  d1: makeDoor('d1', 'w1'),
  win1: makeWindow('win1', 'w1'),
  col1: makeColumn('col1', 'lvl1'),
};

describe('schedule panel — §13.3.1', () => {
  it('renders schedule-tab-doors', () => {
    render(<SchedulePanel elementsById={baseElements} />);
    expect(screen.getByTestId('schedule-tab-doors')).toBeTruthy();
  });

  it('renders schedule-tab-windows', () => {
    render(<SchedulePanel elementsById={baseElements} />);
    expect(screen.getByTestId('schedule-tab-windows')).toBeTruthy();
  });

  it('renders schedule-tab-columns', () => {
    render(<SchedulePanel elementsById={baseElements} />);
    expect(screen.getByTestId('schedule-tab-columns')).toBeTruthy();
  });

  it('door tab shows widthMm and heightMm columns', () => {
    render(<SchedulePanel elementsById={baseElements} />);
    fireEvent.click(screen.getByTestId('schedule-tab-doors'));
    const panel = screen.getByTestId('schedule-panel');
    expect(panel.textContent).toMatch(/Width/i);
    expect(panel.textContent).toMatch(/Height/i);
  });

  it('columns tab renders column rows', () => {
    render(<SchedulePanel elementsById={baseElements} />);
    fireEvent.click(screen.getByTestId('schedule-tab-columns'));
    expect(screen.getByTestId('schedule-columns-table')).toBeTruthy();
    expect(screen.getByTestId('schedule-row-0')).toBeTruthy();
  });
});
