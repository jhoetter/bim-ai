import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlanCanvasReadouts, PlanLevelDatum } from './PlanCanvasReadouts';

afterEach(cleanup);

describe('PlanCanvasReadouts', () => {
  it('renders scale, active level work plane, and north point readouts', () => {
    render(
      <PlanCanvasReadouts
        scaleBarMeters={1.25}
        plotScaleN={100}
        activeLevel={{
          kind: 'level',
          id: 'lvl-1',
          name: 'Level 1',
          elevationMm: 3000,
        }}
      />,
    );

    expect(screen.getByTestId('plan-scale-readout').textContent).toContain('125 cm');
    expect(screen.getByTestId('plan-scale-readout').textContent).toContain('1:100');
    expect(screen.getByTestId('plan-work-plane-badge').textContent).toContain('Level 1');
    expect(screen.getByLabelText('North')).toBeTruthy();
  });

  it('omits the level datum when no active level is available', () => {
    render(<PlanLevelDatum activeLevel={null} />);

    expect(screen.queryByTestId('plan-level-datum-line')).toBeNull();
    expect(screen.queryByTestId('plan-level-elevation-badge')).toBeNull();
  });
});
