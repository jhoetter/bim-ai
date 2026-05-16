import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { PlanViewHeader } from './PlanViewHeader';

afterEach(() => {
  cleanup();
});

describe('D1 — PlanViewHeader RCP badge', () => {
  it('shows RCP badge when viewSubtype is ceiling_plan', () => {
    const { getByTestId } = render(
      <PlanViewHeader
        phaseFilter="show_all"
        onPhaseFilterChange={vi.fn()}
        detailLevel="medium"
        onDetailLevelChange={vi.fn()}
        viewSubtype="ceiling_plan"
      />,
    );
    expect(getByTestId('plan-view-header-rcp-badge').textContent).toBe('RCP');
  });

  it('does not show RCP badge when viewSubtype is floor_plan', () => {
    const { queryByTestId } = render(
      <PlanViewHeader
        phaseFilter="show_all"
        onPhaseFilterChange={vi.fn()}
        detailLevel="medium"
        onDetailLevelChange={vi.fn()}
        viewSubtype="floor_plan"
      />,
    );
    expect(queryByTestId('plan-view-header-rcp-badge')).toBeNull();
  });

  it('does not show RCP badge when viewSubtype is omitted', () => {
    const { queryByTestId } = render(
      <PlanViewHeader
        phaseFilter="show_all"
        onPhaseFilterChange={vi.fn()}
        detailLevel="medium"
        onDetailLevelChange={vi.fn()}
      />,
    );
    expect(queryByTestId('plan-view-header-rcp-badge')).toBeNull();
  });
});
