import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlanCanvasRoomColorLegend } from './PlanCanvasRoomColorLegend';

afterEach(cleanup);

describe('PlanCanvasRoomColorLegend', () => {
  it('renders room scheme rows with de-duplicated subtitle metadata', () => {
    const { getByTestId } = render(
      <PlanCanvasRoomColorLegend
        planPresentation="room_scheme"
        rows={[
          {
            label: 'Office',
            schemeColorHex: 'rgb(255, 0, 255)',
            programmeCode: 'OFF',
            department: 'Workplace',
            functionLabel: 'Office',
          },
        ]}
      />,
    );

    const legend = getByTestId('plan-room-color-legend');
    expect(legend.textContent).toContain('Office');
    expect(legend.textContent).toContain('OFF · Workplace');
  });
});
