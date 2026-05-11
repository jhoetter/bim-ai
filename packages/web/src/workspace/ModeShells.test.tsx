import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import {
  AgentReviewModeShell,
  ConceptModeShell,
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
  vi.unstubAllGlobals();
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
  'seed-sch-window': {
    kind: 'schedule',
    id: 'seed-sch-window',
    name: 'Window schedule',
    filters: { category: 'window' },
  } as Extract<Element, { kind: 'schedule' }>,
  'win-1': {
    kind: 'window',
    id: 'win-1',
    name: 'W-01',
    wallId: 'wall-1',
    centerAlongMm: 0,
    widthMm: 1200,
    heightMm: 1400,
    sillHeightMm: 900,
  } as unknown as Element,
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

  it('opens the preferred schedule tab and renders server-derived rows', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          scheduleId: 'seed-sch-window',
          name: 'Window schedule',
          category: 'window',
          columns: ['elementId', 'name', 'widthMm', 'heightMm'],
          columnMetadata: {
            fields: {
              elementId: { label: 'Element id', role: 'id' },
              name: { label: 'Name', role: 'text' },
              widthMm: { label: 'Width (mm)', role: 'number' },
              heightMm: { label: 'Height (mm)', role: 'number' },
            },
          },
          rows: [{ elementId: 'win-1', name: 'W-01', widthMm: 1200, heightMm: 1400 }],
          totalRows: 1,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { getAllByText, getByText } = render(
      <ScheduleModeShell
        elementsById={elementsById}
        preferredScheduleId="seed-sch-window"
        modelId="model-1"
      />,
    );

    expect(getAllByText('Window schedule').length).toBeGreaterThanOrEqual(1);
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith('/api/models/model-1/schedules/seed-sch-window/table'),
    );
    expect(getByText('W-01')).toBeTruthy();
    expect(getByText('1200')).toBeTruthy();
  });

  it('supports row selection, canvas navigation, sheet placement, and duplication', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          scheduleId: 'seed-sch-window',
          name: 'Window schedule',
          category: 'window',
          columns: ['elementId', 'name', 'widthMm'],
          columnMetadata: {
            fields: {
              elementId: { label: 'Element id', role: 'id' },
              name: { label: 'Name', role: 'text' },
              widthMm: { label: 'Width (mm)', role: 'number' },
            },
          },
          rows: [{ elementId: 'win-1', name: 'W-01', widthMm: 1200 }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const onUpsertSemantic = vi.fn();
    const onNavigateToElement = vi.fn();

    const { getByText, getByRole } = render(
      <ScheduleModeShell
        elementsById={elementsById}
        preferredScheduleId="seed-sch-window"
        modelId="model-1"
        onUpsertSemantic={onUpsertSemantic}
        onNavigateToElement={onNavigateToElement}
      />,
    );

    await waitFor(() => expect(getByText('W-01')).toBeTruthy());
    fireEvent.click(getByText('W-01'));
    fireEvent.click(getByRole('button', { name: 'Open row' }));
    expect(onNavigateToElement).toHaveBeenCalledWith('win-1');

    fireEvent.click(getByRole('button', { name: 'Place on sheet' }));
    expect(onUpsertSemantic).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upsertSheetViewports',
        sheetId: 'seed-sheet-a101',
      }),
    );

    fireEvent.click(getByRole('button', { name: 'Duplicate' }));
    expect(onUpsertSemantic).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upsertSchedule',
        name: 'Window schedule copy',
        filters: { category: 'window' },
      }),
    );
  });
});

describe('ConceptModeShell — CON-V3-01 / MDB-V3-01', () => {
  it('renders a pre-BIM board with image underlays and concept seeds', () => {
    const conceptElements = {
      img: {
        kind: 'image_underlay',
        id: 'img',
        src: '/underlays/sketch.png',
        rectMm: { xMm: 0, yMm: 0, widthMm: 1000, heightMm: 800 },
        rotationDeg: 0,
        opacity: 0.8,
        lockedScale: true,
      },
      seed: {
        kind: 'concept_seed',
        id: 'seed',
        modelId: 'm1',
        envelopeTokens: [],
        kernelElementDrafts: [],
        assumptionsLog: [],
        status: 'draft',
        schemaVersion: 'con-v3.0',
      },
    } satisfies Record<string, Element>;

    const { getByTestId, getByText } = render(<ConceptModeShell elementsById={conceptElements} />);
    expect(getByTestId('concept-mode-shell')).toBeTruthy();
    expect(getByTestId('concept-board-underlay-count').textContent).toBe('1 underlays');
    expect(getByTestId('concept-board-seed-count').textContent).toBe('1 seeds');
    expect(getByText('/underlays/sketch.png')).toBeTruthy();
    expect(getByText('draft')).toBeTruthy();
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
