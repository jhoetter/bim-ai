import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { PlanCanvasToolOverlays } from './PlanCanvasToolOverlays';

const worldToScreen = ({ xMm, yMm }: { xMm: number; yMm: number }) => ({
  pxX: xMm / 10,
  pxY: yMm / 10,
});

const baseProps = {
  planTool: 'select' as const,
  snapOverrideDisplay: null,
  onCancelSnapOverride: vi.fn(),
  copyAnchorSet: false,
  moveAnchorSet: false,
  moveAnchorMm: null,
  rotateAnchorSet: false,
  rotateAnchorMm: null,
  rotateReferenceSet: false,
  rotateReferenceMm: null,
  alignReferenceMm: null,
  mirrorAxisSet: false,
  mirrorAxisStartMm: null,
  trimExtendFirstWallSet: false,
  hudMm: null,
  numericInput: null,
  hasGripDrag: false,
  scalePhase: 'idle' as const,
  worldToScreen,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlanCanvasToolOverlays', () => {
  it('renders and cancels snap override chip', () => {
    const onCancelSnapOverride = vi.fn();
    const { getByTestId, getByLabelText } = render(
      <PlanCanvasToolOverlays
        {...baseProps}
        snapOverrideDisplay="intersection"
        onCancelSnapOverride={onCancelSnapOverride}
      />,
    );

    expect(getByTestId('snap-override-chip').textContent).toContain('Snap: Intersection [SI]');
    fireEvent.click(getByLabelText('Cancel snap override'));
    expect(onCancelSnapOverride).toHaveBeenCalledTimes(1);
  });

  it('renders rotate overlay and numeric input', () => {
    const { getByTestId } = render(
      <PlanCanvasToolOverlays
        {...baseProps}
        planTool="rotate"
        rotateAnchorSet
        rotateAnchorMm={{ xMm: 1000, yMm: 2000 }}
        rotateReferenceSet
        rotateReferenceMm={{ xMm: 2000, yMm: 2000 }}
        hudMm={{ xMm: 2500, yMm: 3000 }}
        numericInput={{ value: '45', pxX: 50, pxY: 60 }}
      />,
    );

    expect(getByTestId('rotate-tool-overlay')).toBeTruthy();
    expect(getByTestId('rotate-tool-chip').textContent).toContain('Click end ray');
    expect(getByTestId('grip-numeric-input').textContent).toContain('45');
    expect(getByTestId('grip-numeric-input').textContent).toContain('deg');
  });
});
