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

const noop = () => undefined;
const noopSave = (_patch: {
  viewRangeTopMm: number;
  viewRangeBottomMm: number;
  cutPlaneOffsetMm: number;
}) => undefined;

describe('ViewRangeDialog — §2.1.5', () => {
  it('renders view-range-dialog when open=true', () => {
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={noop}
        planView={makePlanView()}
        levelElevationsMm={{ lv1: 0 }}
        onSave={noopSave}
      />,
    );
    expect(getByTestId('view-range-dialog')).toBeDefined();
  });

  it('does not render when open=false', () => {
    const { queryByTestId } = render(
      <ViewRangeDialog
        open={false}
        onClose={noop}
        planView={makePlanView()}
        levelElevationsMm={{ lv1: 0 }}
        onSave={noopSave}
      />,
    );
    expect(queryByTestId('view-range-dialog')).toBeNull();
  });

  it('shows vr-top-mm, vr-cut-mm, vr-bottom-mm inputs', () => {
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={noop}
        planView={makePlanView({ viewRangeTopMm: 4500 })}
        levelElevationsMm={{ lv1: 0 }}
        onSave={noopSave}
      />,
    );
    expect((getByTestId('vr-top-mm') as HTMLInputElement).value).toBe('4500');
    expect(getByTestId('vr-cut-mm')).toBeDefined();
    expect(getByTestId('vr-bottom-mm')).toBeDefined();
  });

  it('shows vr-error when cut plane is above top', () => {
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={noop}
        planView={makePlanView({ viewRangeTopMm: 1200, cutPlaneOffsetMm: 1200 })}
        levelElevationsMm={{ lv1: 0 }}
        onSave={noopSave}
      />,
    );
    expect(getByTestId('vr-error')).toBeDefined();
  });

  it('save button calls onSave with correct values', () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={noop}
        planView={makePlanView({
          viewRangeTopMm: 4000,
          cutPlaneOffsetMm: 1200,
          viewRangeBottomMm: 0,
        })}
        levelElevationsMm={{ lv1: 0 }}
        onSave={onSave}
      />,
    );
    fireEvent.click(getByTestId('vr-save'));
    expect(onSave).toHaveBeenCalledWith({
      viewRangeTopMm: 4000,
      viewRangeBottomMm: 0,
      cutPlaneOffsetMm: 1200,
    });
  });

  it('cancel calls onClose without saving', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={onClose}
        planView={makePlanView()}
        levelElevationsMm={{ lv1: 0 }}
        onSave={onSave}
      />,
    );
    fireEvent.click(getByTestId('vr-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders vr-diagram SVG element', () => {
    const { getByTestId } = render(
      <ViewRangeDialog
        open={true}
        onClose={noop}
        planView={makePlanView()}
        levelElevationsMm={{ lv1: 0 }}
        onSave={noopSave}
      />,
    );
    expect(getByTestId('vr-diagram')).toBeDefined();
  });
});
