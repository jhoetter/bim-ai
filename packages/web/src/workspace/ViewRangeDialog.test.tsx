import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import type { Element } from '@bim-ai/core';

import { ViewRangeDialog } from './ViewRangeDialog';

afterEach(cleanup);

type PlanViewEl = Extract<Element, { kind: 'plan_view' }>;

function makePlanView(overrides: Partial<PlanViewEl> = {}): PlanViewEl {
  return {
    kind: 'plan_view',
    id: 'pv1',
    name: 'Level 1 Plan',
    levelId: 'lv1',
    viewRangeTopMm: 3000,
    cutPlaneOffsetMm: 1200,
    viewRangeBottomMm: 0,
    viewDepth: 0,
    ...overrides,
  } as PlanViewEl;
}

describe('ViewRangeDialog — §2.1.5', () => {
  it('renders view-range-dialog when open=true', () => {
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={() => undefined}
        view={makePlanView()}
        onPropertyChange={() => undefined}
      />,
    );
    expect(getByTestId('view-range-dialog')).toBeDefined();
  });

  it('does not render when open=false', () => {
    const { queryByTestId } = render(
      <ViewRangeDialog
        open={false}
        onClose={() => undefined}
        view={makePlanView()}
        onPropertyChange={() => undefined}
      />,
    );
    expect(queryByTestId('view-range-dialog')).toBeNull();
  });

  it('vr-top input shows viewRangeTopMm value', () => {
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={() => undefined}
        view={makePlanView({ viewRangeTopMm: 4500 })}
        onPropertyChange={() => undefined}
      />,
    );
    const input = getByTestId('vr-top') as HTMLInputElement;
    expect(Number(input.value)).toBe(4500);
  });

  it('changing vr-cut calls onPropertyChange with cutPlaneOffsetMm', () => {
    const onPropertyChange = vi.fn();
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={() => undefined}
        view={makePlanView()}
        onPropertyChange={onPropertyChange}
      />,
    );
    const input = getByTestId('vr-cut') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '900' } });
    expect(onPropertyChange).toHaveBeenCalledWith('cutPlaneOffsetMm', 900);
  });

  it('shows vr-warning when top <= cut', () => {
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={() => undefined}
        view={makePlanView({ viewRangeTopMm: 1200, cutPlaneOffsetMm: 1200 })}
        onPropertyChange={() => undefined}
      />,
    );
    expect(getByTestId('vr-warning')).toBeDefined();
  });
});
