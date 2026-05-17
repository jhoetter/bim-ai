import { afterEach, describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { PlanViewHeader } from './PlanViewHeader';

afterEach(cleanup);

// Minimal required props for PlanViewHeader.
const baseProps = {
  phaseFilter: 'show_all' as const,
  onPhaseFilterChange: () => {},
  detailLevel: 'medium' as const,
  onDetailLevelChange: () => {},
};

describe('PlanViewHeader north indicator — §5.4.2', () => {
  it('renders plan-view-north-angle when planViewAngleDeg is non-zero', () => {
    render(<PlanViewHeader {...baseProps} planViewAngleDeg={-30} />);
    const indicator = screen.getByTestId('plan-view-north-angle');
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain('-30.0°');
  });

  it('does not render plan-view-north-angle when planViewAngleDeg is 0', () => {
    render(<PlanViewHeader {...baseProps} planViewAngleDeg={0} />);
    const indicator = screen.queryByTestId('plan-view-north-angle');
    expect(indicator).toBeNull();
  });

  it('does not render plan-view-north-angle when planViewAngleDeg is not provided', () => {
    render(<PlanViewHeader {...baseProps} />);
    const indicator = screen.queryByTestId('plan-view-north-angle');
    expect(indicator).toBeNull();
  });

  it('shows the correct angle text for positive planViewAngleDeg', () => {
    render(<PlanViewHeader {...baseProps} planViewAngleDeg={15.5} />);
    const indicator = screen.getByTestId('plan-view-north-angle');
    expect(indicator.textContent).toContain('15.5°');
  });
});
