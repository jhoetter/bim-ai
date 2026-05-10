import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import {
  AgentReviewModeShell,
  ScheduleModeShell,
  SectionModeShell,
  SheetModeShell,
} from './ModeShells';
import { useBimStore } from '../state/store';
import i18n from '../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

vi.mock('./sheets', () => ({
  SheetCanvas: ({
    preferredSheetId,
  }: {
    preferredSheetId?: string;
    elementsById: Record<string, Element>;
  }) => <div data-testid="sheet-canvas" data-preferred-sheet-id={preferredSheetId ?? ''} />,
  SectionPlaceholderPane: ({
    activeLevelLabel,
    modelId,
  }: {
    activeLevelLabel: string;
    modelId?: string;
  }) => (
    <div
      data-testid="section-placeholder-pane"
      data-level={activeLevelLabel}
      data-model-id={modelId ?? ''}
    />
  ),
}));

afterEach(() => {
  cleanup();
});

const elementsById: Record<string, Element> = {
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
  it('renders the section-mode-shell wrapper with SectionPlaceholderPane', () => {
    const { getByTestId } = render(<SectionModeShell activeLevelLabel="Level 1" />);
    expect(getByTestId('section-mode-shell')).toBeTruthy();
    expect(getByTestId('section-placeholder-pane')).toBeTruthy();
  });

  it('passes activeLevelLabel and modelId through to SectionPlaceholderPane', () => {
    const { getByTestId } = render(<SectionModeShell activeLevelLabel="L2" modelId="model-abc" />);
    const pane = getByTestId('section-placeholder-pane');
    expect(pane.getAttribute('data-level')).toBe('L2');
    expect(pane.getAttribute('data-model-id')).toBe('model-abc');
  });
});

describe('SheetModeShell — spec §20.5', () => {
  it('renders the sheet-mode-shell wrapper with SheetCanvas', () => {
    const { getByTestId } = render(<SheetModeShell elementsById={elementsById} />);
    expect(getByTestId('sheet-mode-shell')).toBeTruthy();
    expect(getByTestId('sheet-canvas')).toBeTruthy();
  });

  it('passes preferredSheetId to SheetCanvas', () => {
    const { getByTestId } = render(
      <SheetModeShell elementsById={elementsById} preferredSheetId="seed-sheet-a101" />,
    );
    expect(getByTestId('sheet-canvas').getAttribute('data-preferred-sheet-id')).toBe(
      'seed-sheet-a101',
    );
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
    const { getByTestId, getByText } = renderWithI18n(
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
    const { getByText } = renderWithI18n(<AgentReviewModeShell onApplyQuickFix={() => {}} />);
    expect(getByText('Door too narrow')).toBeTruthy();
  });

  it('dispatches preset change via onPreset', () => {
    useBimStore.setState({ buildingPreset: 'residential' });
    const { getByRole } = renderWithI18n(<AgentReviewModeShell onApplyQuickFix={() => {}} />);
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
    const { getByText } = renderWithI18n(<AgentReviewModeShell onApplyQuickFix={spy} />);
    fireEvent.click(getByText('Apply suggested fix'));
    expect(spy).toHaveBeenCalledWith(qfCmd);
  });
});
