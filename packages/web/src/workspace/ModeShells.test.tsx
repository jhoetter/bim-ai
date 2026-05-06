import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import {
  AgentReviewModeShell,
  ScheduleModeShell,
  SectionModeShell,
  SheetModeShell,
} from './ModeShells';
import { useBimStore } from '../state/store';

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

describe('AgentReviewModeShell — spec §20.7 / WP-UI-E01–E04', () => {
  afterEach(() => {
    useBimStore.setState({ violations: [], buildingPreset: 'residential', selectedId: undefined });
  });

  it('mounts and shows empty advisory state when no violations', () => {
    useBimStore.setState({ violations: [] });
    const { getByTestId, getByText } = render(
      <AgentReviewModeShell onApplyQuickFix={() => {}} />,
    );
    expect(getByTestId('agent-review-mode-shell')).toBeTruthy();
    expect(getByText(/No advisory items/)).toBeTruthy();
  });

  it('renders violation cards when violations are present', () => {
    useBimStore.setState({
      violations: [
        {
          ruleId: 'MIN_DOOR_WIDTH',
          severity: 'warning',
          message: 'Door too narrow',
          blocking: false,
          elementIds: [],
        } as never,
      ],
    });
    const { getByText } = render(<AgentReviewModeShell onApplyQuickFix={() => {}} />);
    expect(getByText('Door too narrow')).toBeTruthy();
  });

  it('dispatches preset change via onPreset', () => {
    useBimStore.setState({ buildingPreset: 'residential' });
    const { getByRole } = render(<AgentReviewModeShell onApplyQuickFix={() => {}} />);
    const select = getByRole('combobox');
    fireEvent.change(select, { target: { value: 'commercial' } });
    expect(useBimStore.getState().buildingPreset).toBe('commercial');
  });

  it('calls onApplyQuickFix when quick-fix button is clicked', () => {
    const spy = vi.fn();
    const qfCmd = { type: 'fixDoorWidth', elementId: 'door-1' };
    useBimStore.setState({
      violations: [
        {
          ruleId: 'MIN_DOOR_WIDTH',
          severity: 'warning',
          message: 'Door too narrow',
          blocking: false,
          elementIds: [],
          quickFixCommand: qfCmd,
        } as never,
      ],
    });
    const { getByText } = render(<AgentReviewModeShell onApplyQuickFix={spy} />);
    fireEvent.click(getByText('Apply suggested fix'));
    expect(spy).toHaveBeenCalledWith(qfCmd);
  });
});
