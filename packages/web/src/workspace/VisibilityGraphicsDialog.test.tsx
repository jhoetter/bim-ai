import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import type { Element } from '@bim-ai/core';

import { VisibilityGraphicsDialog } from './VisibilityGraphicsDialog';

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

describe('VisibilityGraphicsDialog — §2.1.4', () => {
  it('renders vg-dialog when open=true', () => {
    const { getByTestId } = render(
      <VisibilityGraphicsDialog
        open={true}
        onClose={noop}
        planView={makePlanView()}
        onOverrideChange={noop}
      />,
    );
    expect(getByTestId('vg-dialog')).toBeTruthy();
  });

  it('returns null when open=false', () => {
    const { queryByTestId } = render(
      <VisibilityGraphicsDialog
        open={false}
        onClose={noop}
        planView={makePlanView()}
        onOverrideChange={noop}
      />,
    );
    expect(queryByTestId('vg-dialog')).toBeNull();
  });

  it('renders vg-visible-wall checkbox', () => {
    const { getByTestId } = render(
      <VisibilityGraphicsDialog
        open={true}
        onClose={noop}
        planView={makePlanView()}
        onOverrideChange={noop}
      />,
    );
    expect(getByTestId('vg-visible-wall')).toBeTruthy();
  });

  it('renders vg-color-wall input', () => {
    const { getByTestId } = render(
      <VisibilityGraphicsDialog
        open={true}
        onClose={noop}
        planView={makePlanView()}
        onOverrideChange={noop}
      />,
    );
    const colorInput = getByTestId('vg-color-wall');
    expect(colorInput).toBeTruthy();
    expect((colorInput as HTMLInputElement).type).toBe('color');
  });

  it('unchecking vg-visible-wall calls onOverrideChange with hidden:true', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <VisibilityGraphicsDialog
        open={true}
        onClose={noop}
        planView={makePlanView()}
        onOverrideChange={onChange}
      />,
    );
    const checkbox = getByTestId('vg-visible-wall') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith('wall', expect.objectContaining({ hidden: true }));
  });

  it('clicking vg-reset-wall calls onOverrideChange with null', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <VisibilityGraphicsDialog
        open={true}
        onClose={noop}
        planView={makePlanView({ categoryOverrides: { wall: { hidden: true } } })}
        onOverrideChange={onChange}
      />,
    );
    fireEvent.click(getByTestId('vg-reset-wall'));
    expect(onChange).toHaveBeenCalledWith('wall', null);
  });
});
