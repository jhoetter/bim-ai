/**
 * §1.6.10 — Per-view category visibility/graphics override dialog tests.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import type { Element } from '@bim-ai/core';

import { PlanViewHeader } from '../plan/PlanViewHeader';
import { PerViewVGDialog } from './PerViewVGDialog';

afterEach(cleanup);

type PlanViewEl = Extract<Element, { kind: 'plan_view' }>;

function makePlanView(overrides: Partial<PlanViewEl> = {}): PlanViewEl {
  return {
    kind: 'plan_view',
    id: 'pv1',
    name: 'Level 1 Plan',
    levelId: 'lv1',
    ...overrides,
  } as PlanViewEl;
}

const noop = () => undefined;

describe('per-view visibility/graphics dialog — §1.6.10', () => {
  it('renders per-view-vg-btn in plan view header when prop provided', () => {
    const { getByTestId } = render(
      <PlanViewHeader
        phaseFilter="show_all"
        onPhaseFilterChange={noop}
        detailLevel="medium"
        onDetailLevelChange={noop}
        onPerViewVGOpen={noop}
      />,
    );
    expect(getByTestId('plan-view-per-view-vg-btn')).toBeTruthy();
  });

  it('dialog does not render when closed', () => {
    const planView = makePlanView();
    const { queryByTestId } = render(
      <PerViewVGDialog
        open={false}
        onClose={noop}
        activePlanViewId={planView.id}
        elementsById={{ [planView.id]: planView }}
        onApply={noop}
      />,
    );
    expect(queryByTestId('per-view-vg-dialog')).toBeNull();
  });

  it('dialog renders category rows when open', () => {
    const planView = makePlanView();
    const { getByTestId } = render(
      <PerViewVGDialog
        open={true}
        onClose={noop}
        activePlanViewId={planView.id}
        elementsById={{ [planView.id]: planView }}
        onApply={noop}
      />,
    );
    expect(getByTestId('per-view-vg-dialog')).toBeTruthy();
    expect(getByTestId('per-view-vg-visible-wall')).toBeTruthy();
    expect(getByTestId('per-view-vg-visible-floor')).toBeTruthy();
    expect(getByTestId('per-view-vg-color-wall')).toBeTruthy();
  });

  it('calls onApply with updated overrides', () => {
    const planView = makePlanView();
    const onApply = vi.fn();
    const { getByTestId } = render(
      <PerViewVGDialog
        open={true}
        onClose={noop}
        activePlanViewId={planView.id}
        elementsById={{ [planView.id]: planView }}
        onApply={onApply}
      />,
    );
    // Toggle wall visibility off (uncheck) to create an override
    const wallCheckbox = getByTestId('per-view-vg-visible-wall') as HTMLInputElement;
    fireEvent.click(wallCheckbox);
    // Click apply
    fireEvent.click(getByTestId('per-view-vg-apply'));
    expect(onApply).toHaveBeenCalledWith(
      planView.id,
      expect.arrayContaining([expect.objectContaining({ hidden: true })]),
    );
  });
});
