import type { Element } from '@bim-ai/core';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanCanvasWorkflowOverlays } from './PlanCanvasWorkflowOverlays';

const element = (id: string, kind: string) => ({ id, kind }) as unknown as Element;

const baseProps = {
  planTool: 'select' as const,
  measureReadout: null,
  measureAngleReadout: null,
  measureArcReadout: null,
  onDismissMeasureReadout: vi.fn(),
  onDismissMeasureAngleReadout: vi.fn(),
  onDismissMeasureArcReadout: vi.fn(),
  selectedId: null,
  selectedIds: [],
  elementsById: {},
  filterOpen: false,
  onToggleFilter: vi.fn(),
  onCloseFilter: vi.fn(),
  onClearSelection: vi.fn(),
  onFilterOutKind: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlanCanvasWorkflowOverlays', () => {
  it('renders active measure readout and dismisses it', () => {
    const onDismissMeasureReadout = vi.fn();
    const { getByTestId } = render(
      <PlanCanvasWorkflowOverlays
        {...baseProps}
        planTool="measure"
        measureReadout={{ distMm: 1234.4 }}
        onDismissMeasureReadout={onDismissMeasureReadout}
      />,
    );

    const chip = getByTestId('measure-readout');
    expect(chip.textContent).toContain('1.234 m');
    expect(chip.textContent).toContain('1234 mm');
    fireEvent.click(chip.querySelector('button')!);
    expect(onDismissMeasureReadout).toHaveBeenCalledTimes(1);
  });

  it('renders multi-selection filter controls by element kind', () => {
    const onToggleFilter = vi.fn();
    const onFilterOutKind = vi.fn();
    const { getByTestId, getByLabelText } = render(
      <PlanCanvasWorkflowOverlays
        {...baseProps}
        selectedId="wall-1"
        selectedIds={['door-1', 'wall-2']}
        elementsById={{
          'wall-1': element('wall-1', 'wall'),
          'wall-2': element('wall-2', 'wall'),
          'door-1': element('door-1', 'door'),
        }}
        filterOpen
        onToggleFilter={onToggleFilter}
        onFilterOutKind={onFilterOutKind}
      />,
    );

    expect(getByTestId('multi-select-count').textContent).toContain('3 elements selected');
    fireEvent.click(getByTestId('filter-selection-button'));
    expect(onToggleFilter).toHaveBeenCalledTimes(1);

    fireEvent.click(getByLabelText('wall (2)'));
    expect(onFilterOutKind).toHaveBeenCalledWith('wall');
  });
});
