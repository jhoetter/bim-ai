import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useBimStore } from '../state/store';
import { PlanViewHeader } from './PlanViewHeader';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useBimStore.setState({ selectLinkedEnabled: false });
});

describe('PlanViewHeader select-linked toggle — §3.3.1', () => {
  it('renders LK toggle button', () => {
    render(
      <PlanViewHeader
        phaseFilter="show_all"
        onPhaseFilterChange={vi.fn()}
        detailLevel="medium"
        onDetailLevelChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('plan-view-select-linked-toggle')).toBeTruthy();
  });

  it('clicking LK toggle enables select linked', () => {
    render(
      <PlanViewHeader
        phaseFilter="show_all"
        onPhaseFilterChange={vi.fn()}
        detailLevel="medium"
        onDetailLevelChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('plan-view-select-linked-toggle'));
    expect(useBimStore.getState().selectLinkedEnabled).toBe(true);
  });
});
