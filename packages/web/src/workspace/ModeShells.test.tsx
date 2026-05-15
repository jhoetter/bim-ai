import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import { ScheduleModeShell, SectionModeShell, SheetModeShell } from './ModeShells';
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
    onOpenSourcePlan,
    onOpen3dContext,
  }: {
    activeLevelLabel: string;
    modelId?: string;
    onOpenSourcePlan?: () => void;
    onOpen3dContext?: () => void;
  }) => (
    <div
      data-testid="section-placeholder-pane"
      data-level={activeLevelLabel}
      data-model-id={modelId ?? ''}
    >
      <button
        type="button"
        data-testid="mock-open-source-plan"
        onClick={() => onOpenSourcePlan?.()}
      >
        open source
      </button>
      <button type="button" data-testid="mock-open-3d-context" onClick={() => onOpen3dContext?.()}>
        open 3d
      </button>
    </div>
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

  it('passes section navigation callbacks through to SectionPlaceholderPane', () => {
    const onOpenSourcePlan = vi.fn();
    const onOpen3dContext = vi.fn();
    const { getByTestId } = render(
      <SectionModeShell
        activeLevelLabel="L2"
        modelId="model-abc"
        onOpenSourcePlan={onOpenSourcePlan}
        onOpen3dContext={onOpen3dContext}
      />,
    );
    fireEvent.click(getByTestId('mock-open-source-plan'));
    fireEvent.click(getByTestId('mock-open-3d-context'));
    expect(onOpenSourcePlan).toHaveBeenCalledOnce();
    expect(onOpen3dContext).toHaveBeenCalledOnce();
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

  it('applies workflow profile presets with meaningful fields/grouping and keeps export reachable', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          scheduleId: 'seed-sch-window',
          name: 'Window schedule',
          category: 'window',
          scheduleEngine: {
            format: 'scheduleEngine_v1',
            category: 'window',
            sortBy: 'name',
            supportsCsv: true,
          },
          columns: [
            'elementId',
            'name',
            'level',
            'widthMm',
            'heightMm',
            'roughOpeningAreaM2',
            'openingAreaM2',
            'sillMm',
            'aspectRatio',
            'headHeightMm',
            'hostWallTypeDisplay',
            'materialDisplay',
            'familyTypeDisplay',
          ],
          columnMetadata: {
            fields: {
              elementId: { label: 'Element id', role: 'id' },
              name: { label: 'Name', role: 'text' },
              openingAreaM2: { label: 'Opening area (m²)', role: 'number' },
            },
          },
          rows: [{ elementId: 'win-1', name: 'W-01', openingAreaM2: 1.2 }],
          totals: { rows: 1 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const onUpsertSemantic = vi.fn();

    const { getByTestId, getByRole, getByText } = render(
      <ScheduleModeShell
        elementsById={elementsById}
        preferredScheduleId="seed-sch-window"
        modelId="model-1"
        onUpsertSemantic={onUpsertSemantic}
      />,
    );

    await waitFor(() => expect(getByText('W-01')).toBeTruthy());
    expect(getByRole('button', { name: 'Export CSV' })).toBeTruthy();

    fireEvent.change(getByTestId('schedule-workflow-profile-select'), {
      target: { value: 'window-energy-opening' },
    });
    fireEvent.click(getByTestId('schedule-workflow-profile-apply'));

    expect(onUpsertSemantic).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upsertSchedule',
        id: 'seed-sch-window',
        filters: expect.objectContaining({
          sortBy: 'openingAreaM2',
          sortDescending: true,
          displayColumnKeys: expect.arrayContaining(['openingAreaM2', 'roughOpeningAreaM2']),
        }),
        grouping: expect.objectContaining({
          sortBy: 'openingAreaM2',
          sortDescending: true,
          groupKeys: ['levelId'],
        }),
      }),
    );
  });

  it('applies Cost and Quantity estimate workflow profile', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          scheduleId: 'seed-sch-cost',
          name: 'Cost estimate',
          category: 'cost_estimate',
          scheduleEngine: {
            format: 'scheduleEngine_v1',
            category: 'cost_estimate',
            sortBy: 'name',
            supportsCsv: true,
            lensId: 'cost-quantity',
          },
          columns: [
            'rowId',
            'elementId',
            'scenarioId',
            'costGroup',
            'unit',
            'quantity',
            'unitRate',
            'totalCost',
            'costSource',
            'costDataStatus',
          ],
          columnMetadata: {
            fields: {
              rowId: { label: 'Cost row', role: 'id' },
              totalCost: { label: 'Total cost', role: 'number' },
              costSource: { label: 'Source/reference', role: 'text' },
            },
          },
          rows: [{ rowId: 'floor-1:as-is', elementId: 'floor-1', totalCost: 220 }],
          totals: { totalCost: 220 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const onUpsertSemantic = vi.fn();
    const costElements = {
      ...elementsById,
      'seed-sch-cost': {
        kind: 'schedule',
        id: 'seed-sch-cost',
        name: 'Cost estimate',
        filters: { category: 'cost_estimate' },
      } as Extract<Element, { kind: 'schedule' }>,
    };

    const { getByTestId, getByText } = render(
      <ScheduleModeShell
        elementsById={costElements}
        preferredScheduleId="seed-sch-cost"
        modelId="model-1"
        onUpsertSemantic={onUpsertSemantic}
      />,
    );

    await waitFor(() => expect(getByText('floor-1')).toBeTruthy());
    fireEvent.change(getByTestId('schedule-workflow-profile-select'), {
      target: { value: 'cost-estimate-source' },
    });
    fireEvent.click(getByTestId('schedule-workflow-profile-apply'));

    expect(onUpsertSemantic).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upsertSchedule',
        id: 'seed-sch-cost',
        filters: expect.objectContaining({
          sortBy: 'totalCost',
          sortDescending: true,
          displayColumnKeys: expect.arrayContaining(['costSource', 'costDataStatus']),
        }),
        grouping: expect.objectContaining({
          sortBy: 'totalCost',
          sortDescending: true,
          groupKeys: ['costGroup', 'workPackage'],
        }),
      }),
    );
  });
});
