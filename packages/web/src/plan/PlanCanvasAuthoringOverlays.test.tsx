import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanCanvasAuthoringOverlays } from './PlanCanvasAuthoringOverlays';

const baseProps = {
  revealHiddenMode: false,
  activePlanViewId: 'plan-1',
  onSemanticCommand: vi.fn(),
  textAnnotOverlay: null,
  onTextAnnotationDraftChange: vi.fn(),
  onTextAnnotationDone: vi.fn(),
  leaderTextOverlay: null,
  onLeaderTextDraftChange: vi.fn(),
  onLeaderTextDone: vi.fn(),
  pendingPlanRegion: null,
  onPlanRegionDraftChange: vi.fn(),
  onPlanRegionDone: vi.fn(),
  planTool: 'select' as const,
  subdivisionDraft: null,
  onSetSubdivisionDraft: vi.fn(),
  onUpdateCurrentSubdivisionDraftCategory: vi.fn(),
  onCancelSubdivision: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlanCanvasAuthoringOverlays', () => {
  it('submits text annotations through the semantic command path', () => {
    const onSemanticCommand = vi.fn();
    const onTextAnnotationDone = vi.fn();
    const { getByDisplayValue } = render(
      <PlanCanvasAuthoringOverlays
        {...baseProps}
        onSemanticCommand={onSemanticCommand}
        textAnnotOverlay={{
          positionMm: { xMm: 100, yMm: 200 },
          screenX: 10,
          screenY: 20,
          draft: 'Room note',
        }}
        onTextAnnotationDone={onTextAnnotationDone}
      />,
    );

    fireEvent.keyDown(getByDisplayValue('Room note'), { key: 'Enter' });

    expect(onSemanticCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'createTextNote',
        hostViewId: 'plan-1',
        text: 'Room note',
      }),
    );
    expect(onTextAnnotationDone).toHaveBeenCalledTimes(1);
  });

  it('submits cut-plane plan regions with parsed height', () => {
    const onSemanticCommand = vi.fn();
    const onPlanRegionDone = vi.fn();
    const { getByText } = render(
      <PlanCanvasAuthoringOverlays
        {...baseProps}
        onSemanticCommand={onSemanticCommand}
        pendingPlanRegion={{
          x0: 0,
          x1: 1000,
          y0: 0,
          y1: 2000,
          lvlId: 'level-1',
          cutPlaneDraft: '1200',
        }}
        onPlanRegionDone={onPlanRegionDone}
      />,
    );

    fireEvent.click(getByText('Place Region'));

    expect(onPlanRegionDone).toHaveBeenCalledTimes(1);
    expect(onSemanticCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'createPlanRegion',
        levelId: 'level-1',
        cutPlaneOffsetMm: 1200,
      }),
    );
  });
});
