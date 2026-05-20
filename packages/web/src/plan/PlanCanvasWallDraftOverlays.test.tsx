import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlanCanvasWallDraftOverlays } from './PlanCanvasWallDraftOverlays';

const worldToScreen = ({ xMm, yMm }: { xMm: number; yMm: number }) => ({
  pxX: xMm / 10,
  pxY: yMm / 10,
});

const baseProps = {
  hudMm: null,
  worldToScreen,
  wallPickLineHint: null,
  planTool: 'select' as const,
  wallDraftActive: false,
  wallLocationLine: 'centerline',
  wallDrawOffsetMm: 0,
  wallDrawRadiusMm: null,
  wallDrawHeightMm: 3000,
  activeWallTypeName: 'Default',
  wallDraftNotice: null,
  snapLabel: null,
};

afterEach(cleanup);

describe('PlanCanvasWallDraftOverlays', () => {
  it('renders wall placement details and draft notice', () => {
    const { getByTestId, getByText } = render(
      <PlanCanvasWallDraftOverlays
        {...baseProps}
        hudMm={{ xMm: 1000, yMm: 2000 }}
        planTool="wall"
        wallDraftActive
        wallLocationLine="finish-face-exterior"
        wallDrawOffsetMm={25}
        wallDrawRadiusMm={100}
        activeWallTypeName="Generic 200"
        wallDraftNotice="Outside crop"
        snapLabel="Endpoint"
      />,
    );

    expect(getByText(/X 1.00 m/)).toBeTruthy();
    expect(getByText('type Generic 200')).toBeTruthy();
    expect(getByTestId('wall-draft-notice').textContent).toContain('Outside crop');
    expect(getByText('Endpoint')).toBeTruthy();
  });

  it('renders picked wall line preview', () => {
    const { getByTestId } = render(
      <PlanCanvasWallDraftOverlays
        {...baseProps}
        wallPickLineHint={{
          source: 'floor-edge',
          sourceId: 'floor-1',
          sourceLabel: 'floor edge',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 1000, yMm: 1000 },
          distanceMm: 0,
        }}
      />,
    );

    expect(getByTestId('wall-pick-line-preview')).toBeTruthy();
  });
});
