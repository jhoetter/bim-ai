import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import {
  AgentReviewModeShell,
  ScheduleModeShell,
  SectionModeShell,
  SheetModeShell,
} from './ModeShells';

afterEach(() => {
  cleanup();
});

const elementsById: Record<string, Element> = {
  'seed-sec-aa': {
    kind: 'section_cut',
    id: 'seed-sec-aa',
    name: 'A–A',
    lineStartMm: { xMm: 0, yMm: 0 },
    lineEndMm: { xMm: 12000, yMm: 0 },
    cropDepthMm: 9000,
  } as Extract<Element, { kind: 'section_cut' }>,
  'seed-sec-bb': {
    kind: 'section_cut',
    id: 'seed-sec-bb',
    name: 'B–B',
    lineStartMm: { xMm: 0, yMm: 0 },
    lineEndMm: { xMm: 0, yMm: 9000 },
    cropDepthMm: 9000,
  } as Extract<Element, { kind: 'section_cut' }>,
  'seed-sheet-a101': {
    kind: 'sheet',
    id: 'seed-sheet-a101',
    name: 'A-101',
    paperWidthMm: 84_100,
    paperHeightMm: 59_400,
    viewportsMm: [
      {
        viewportId: 'vp-eg',
        label: 'Ground plan',
        viewRef: 'plan:seed-plan-eg',
        xMm: 1500,
        yMm: 1500,
        widthMm: 38000,
        heightMm: 25000,
      },
    ],
  } as Extract<Element, { kind: 'sheet' }>,
  'seed-sch-door': {
    kind: 'schedule',
    id: 'seed-sch-door',
    name: 'Door schedule',
  } as Extract<Element, { kind: 'schedule' }>,
};

describe('SectionModeShell — spec §20.4', () => {
  it('lists section cuts and renders a preview for the active one', () => {
    const { getAllByText, getByTestId } = render(<SectionModeShell elementsById={elementsById} />);
    expect(getByTestId('section-mode-shell')).toBeTruthy();
    expect(getAllByText('A–A').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('B–B').length).toBeGreaterThanOrEqual(1);
  });

  it('switches active section on click', () => {
    const { getAllByText, getByText } = render(<SectionModeShell elementsById={elementsById} />);
    fireEvent.click(getAllByText('B–B')[0]!);
    // Crop depth readout reflects the active section.
    expect(getByText(/crop depth · 9000/)).toBeTruthy();
  });
});

describe('SheetModeShell — spec §20.5', () => {
  it('renders the active sheet paper with its viewports', () => {
    const { getByTestId, getAllByText } = render(<SheetModeShell elementsById={elementsById} />);
    expect(getByTestId('sheet-mode-shell')).toBeTruthy();
    expect(getAllByText('A-101').length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('sheet-viewport-vp-eg')).toBeTruthy();
  });
});

describe('ScheduleModeShell — spec §20.6', () => {
  it('renders the schedule grid for the active id', () => {
    const { getByTestId, getAllByText } = render(<ScheduleModeShell elementsById={elementsById} />);
    expect(getByTestId('schedule-mode-shell')).toBeTruthy();
    expect(getAllByText('Door schedule').length).toBeGreaterThanOrEqual(1);
  });
});

describe('AgentReviewModeShell — spec §20.7', () => {
  it('renders the manifest tree + action queue scaffold', () => {
    const { getByTestId, getByText } = render(<AgentReviewModeShell />);
    expect(getByTestId('agent-review-mode-shell')).toBeTruthy();
    expect(getByText('Manifest tree')).toBeTruthy();
    expect(getByText('Action queue')).toBeTruthy();
  });

  it('exposes severity filter switches', () => {
    const { getAllByRole } = render(<AgentReviewModeShell />);
    const switches = getAllByRole('switch');
    expect(switches.length).toBe(3);
  });
});
