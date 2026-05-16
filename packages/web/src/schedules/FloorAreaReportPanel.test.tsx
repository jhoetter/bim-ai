import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { Element } from '@bim-ai/core';

import { FloorAreaReportPanel } from './FloorAreaReportPanel';

afterEach(() => {
  cleanup();
});

function mkLevel(id: string, name: string, elevationMm = 0): Element {
  return { kind: 'level', id, name, elevationMm } as Element;
}

function mkFloor(id: string, levelId: string, boundaryMm: { xMm: number; yMm: number }[]): Element {
  return { kind: 'floor', id, name: id, levelId, boundaryMm } as Element;
}

const SQUARE_10M = [
  { xMm: 0, yMm: 0 },
  { xMm: 10000, yMm: 0 },
  { xMm: 10000, yMm: 10000 },
  { xMm: 0, yMm: 10000 },
];

describe('FloorAreaReportPanel — §13.2', () => {
  it('renders floor-area-report-panel', () => {
    render(<FloorAreaReportPanel elementsById={{}} />);
    expect(screen.getByTestId('floor-area-report-panel')).toBeTruthy();
  });

  it('shows one row per level that has floors', () => {
    const elementsById: Record<string, Element> = {
      lv1: mkLevel('lv1', 'Ground Floor'),
      lv2: mkLevel('lv2', 'Level 1', 3000),
      f1: mkFloor('f1', 'lv1', SQUARE_10M),
      f2: mkFloor('f2', 'lv2', SQUARE_10M),
    };
    render(<FloorAreaReportPanel elementsById={elementsById} />);
    expect(screen.getByTestId('floor-area-row-lv1')).toBeTruthy();
    expect(screen.getByTestId('floor-area-row-lv2')).toBeTruthy();
  });

  it('shows "No levels" message when no floors exist', () => {
    const elementsById: Record<string, Element> = {
      lv1: mkLevel('lv1', 'Ground Floor'),
    };
    render(<FloorAreaReportPanel elementsById={elementsById} />);
    expect(screen.getByText('No levels with floor areas')).toBeTruthy();
  });

  it('gross area and net area are formatted to 2 decimal places', () => {
    const elementsById: Record<string, Element> = {
      lv1: mkLevel('lv1', 'Ground Floor'),
      f1: mkFloor('f1', 'lv1', SQUARE_10M),
    };
    render(<FloorAreaReportPanel elementsById={elementsById} />);
    const row = screen.getByTestId('floor-area-row-lv1');
    const cells = row.querySelectorAll('td');
    // grossAreaM2 = 100.00, netAreaM2 = 100.00
    expect(cells[1]!.textContent).toMatch(/^\d+\.\d{2}$/);
    expect(cells[2]!.textContent).toMatch(/^\d+\.\d{2}$/);
  });

  it('Export CSV button exists', () => {
    render(<FloorAreaReportPanel elementsById={{}} />);
    expect(screen.getByTestId('floor-area-export-csv')).toBeTruthy();
  });
});
