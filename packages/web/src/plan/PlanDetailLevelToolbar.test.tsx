import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { PlanDetailLevelToolbar } from './PlanDetailLevelToolbar';

afterEach(() => {
  cleanup();
});

describe('VIE-01 — PlanDetailLevelToolbar', () => {
  it('marks the active level as aria-checked', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<PlanDetailLevelToolbar value="medium" onChange={onChange} />);
    expect(getByTestId('plan-detail-level-medium').getAttribute('aria-checked')).toBe('true');
    expect(getByTestId('plan-detail-level-coarse').getAttribute('aria-checked')).toBe('false');
    expect(getByTestId('plan-detail-level-fine').getAttribute('aria-checked')).toBe('false');
  });

  it('emits onChange with the clicked level', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<PlanDetailLevelToolbar value="coarse" onChange={onChange} />);
    fireEvent.click(getByTestId('plan-detail-level-fine'));
    expect(onChange).toHaveBeenCalledWith('fine');
  });
});
