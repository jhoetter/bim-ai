import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanCanvasViewControls } from './PlanCanvasViewControls';

const baseProps = {
  thinLinesEnabled: false,
  onToggleThinLines: vi.fn(),
  activePlanViewId: 'plan-1',
  showConstraints: false,
  onToggleConstraints: vi.fn(),
  showUnderlay: false,
  onToggleUnderlay: vi.fn(),
  underlayLevelId: null,
  underlayLevels: [],
  onSetUnderlayLevel: vi.fn(),
  activeWorkPlaneName: null,
  onClearWorkPlane: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlanCanvasViewControls', () => {
  it('routes top-left view toggles', () => {
    const onToggleThinLines = vi.fn();
    const onToggleConstraints = vi.fn();
    const onToggleUnderlay = vi.fn();
    const { getByTestId } = render(
      <PlanCanvasViewControls
        {...baseProps}
        onToggleThinLines={onToggleThinLines}
        onToggleConstraints={onToggleConstraints}
        onToggleUnderlay={onToggleUnderlay}
      />,
    );

    fireEvent.click(getByTestId('plan-view-thin-lines-toggle'));
    fireEvent.click(getByTestId('plan-view-show-constraints-btn'));
    fireEvent.click(getByTestId('plan-view-underlay-btn'));

    expect(onToggleThinLines).toHaveBeenCalledTimes(1);
    expect(onToggleConstraints).toHaveBeenCalledWith('plan-1');
    expect(onToggleUnderlay).toHaveBeenCalledWith('plan-1');
  });

  it('routes underlay level and work-plane changes', () => {
    const onSetUnderlayLevel = vi.fn();
    const onClearWorkPlane = vi.fn();
    const { getByTestId } = render(
      <PlanCanvasViewControls
        {...baseProps}
        showUnderlay
        underlayLevels={[{ id: 'level-2', name: 'Level 2' }]}
        activeWorkPlaneName="Reference Level"
        onSetUnderlayLevel={onSetUnderlayLevel}
        onClearWorkPlane={onClearWorkPlane}
      />,
    );

    fireEvent.change(getByTestId('plan-view-underlay-level-select'), {
      target: { value: 'level-2' },
    });
    fireEvent.click(getByTestId('plan-view-work-plane-clear'));

    expect(onSetUnderlayLevel).toHaveBeenCalledWith('plan-1', 'level-2');
    expect(onClearWorkPlane).toHaveBeenCalledWith('plan-1');
  });
});
