import type { Element } from '@bim-ai/core';
import { cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./SketchCanvas', () => ({
  SketchCanvas: ({
    elementKind,
    wallsForPicking,
    extraOptions,
  }: {
    elementKind: string;
    wallsForPicking: unknown[];
    extraOptions?: Record<string, unknown>;
  }) => (
    <div
      data-testid="mock-sketch-canvas"
      data-kind={elementKind}
      data-wall-count={wallsForPicking.length}
      data-host-view={String(extraOptions?.hostViewId ?? '')}
    />
  ),
}));

import { PlanCanvasSketchOverlay } from './PlanCanvasSketchOverlay';
import type { MmToScreen, PointerToMm } from './SketchCanvas';

const wall = {
  id: 'wall-1',
  kind: 'wall',
  levelId: 'level-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 1000, yMm: 0 },
  thicknessMm: 200,
} as unknown as Element;

const baseProps = {
  planTool: 'select' as const,
  modelId: 'model-1',
  levelId: 'level-1',
  activePlanViewId: 'plan-1',
  elementsById: { 'wall-1': wall },
  pointerToMmRef: createRef<PointerToMm | null>(),
  mmToScreenRef: createRef<MmToScreen | null>(),
  floorTypeId: null,
  floorDrawOffsetMm: 0,
  roofSlopeDeg: 30,
  roofOverhangMm: 450,
  onFinished: vi.fn(),
  onCancelled: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlanCanvasSketchOverlay', () => {
  it('renders sketch canvas for active sketch tools with level walls', () => {
    const { getByTestId } = render(
      <PlanCanvasSketchOverlay {...baseProps} planTool="floor-sketch" />,
    );

    const sketch = getByTestId('mock-sketch-canvas');
    expect(sketch.getAttribute('data-kind')).toBe('floor');
    expect(sketch.getAttribute('data-wall-count')).toBe('1');
  });

  it('passes host view for masking regions', () => {
    const { getByTestId } = render(
      <PlanCanvasSketchOverlay {...baseProps} planTool="masking-region" />,
    );

    expect(getByTestId('mock-sketch-canvas').getAttribute('data-host-view')).toBe('plan-1');
  });
});
