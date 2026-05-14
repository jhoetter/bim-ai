import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { CanvasMount } from './CanvasMount';

type PlanCanvasProps = {
  activeLevelResolvedId: string;
  activePlanViewId?: string | null;
};
type ViewportProps = {
  viewOverlayRightInset?: string;
};

const planCanvasProps: { current: PlanCanvasProps | null } = { current: null };
const viewportProps: { current: ViewportProps | null } = { current: null };

vi.mock('../../Viewport', () => ({
  Viewport: (props: ViewportProps) => {
    viewportProps.current = props;
    return <div data-testid="stub-viewport" />;
  },
}));

vi.mock('../../plan/PlanCanvas', () => ({
  PlanCanvas: (props: PlanCanvasProps) => {
    planCanvasProps.current = props;
    return <div data-testid="stub-plan-canvas" />;
  },
}));

vi.mock('../ModeShells', () => ({
  ScheduleModeShell: () => <div data-testid="stub-schedule" />,
  SectionModeShell: () => <div data-testid="stub-section" />,
  SheetModeShell: () => <div data-testid="stub-sheet" />,
}));

afterEach(() => {
  planCanvasProps.current = null;
  viewportProps.current = null;
  cleanup();
});

describe('<CanvasMount />', () => {
  it('passes the pane-pinned plan view id into PlanCanvas', () => {
    render(
      <CanvasMount
        mode="plan"
        viewerMode="plan_canvas"
        activeLevelId="lvl-ground"
        activePlanViewId="pv-ground"
        elementsById={{}}
        onSemanticCommand={() => undefined}
      />,
    );

    expect(planCanvasProps.current).toMatchObject({
      activeLevelResolvedId: 'lvl-ground',
      activePlanViewId: 'pv-ground',
    });
  });

  it('passes null for level-only plan panes so global plan_view state is ignored', () => {
    render(
      <CanvasMount
        mode="plan"
        viewerMode="plan_canvas"
        activeLevelId="lvl-ground"
        activePlanViewId={null}
        elementsById={{}}
        onSemanticCommand={() => undefined}
      />,
    );

    expect(planCanvasProps.current).toMatchObject({
      activeLevelResolvedId: 'lvl-ground',
      activePlanViewId: null,
    });
  });

  it('passes the pane overlay inset into the 3D viewport', () => {
    render(
      <CanvasMount
        mode="3d"
        viewerMode="orbit_3d"
        activeLevelId="lvl-ground"
        elementsById={{}}
        onSemanticCommand={() => undefined}
        viewOverlayRightInset="min(340px, 45%)"
      />,
    );

    expect(viewportProps.current).toMatchObject({
      viewOverlayRightInset: 'min(340px, 45%)',
    });
  });
});
