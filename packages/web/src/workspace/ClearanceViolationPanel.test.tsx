import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ClearanceViolationPanel } from './ClearanceViolationPanel';
import type { ClearanceViolation } from '../plan/openingClearance';

const makeViolation = (
  id: string,
  kind: ClearanceViolation['kind'] = 'door',
): ClearanceViolation => ({
  elementId: id,
  kind,
  clearanceMm: 1800,
  requiredMm: 2100,
  positionMm: { xMm: 0, yMm: 0 },
  message: `${kind} head height 1800mm < required 2100mm`,
});

describe('ClearanceViolationPanel — §8.4', () => {
  afterEach(() => cleanup());

  it('renders null when violations is empty', () => {
    const { container } = render(<ClearanceViolationPanel violations={[]} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders clearance-violation-panel when violations exist', () => {
    render(<ClearanceViolationPanel violations={[makeViolation('d1')]} onClose={vi.fn()} />);
    expect(screen.getByTestId('clearance-violation-panel')).toBeDefined();
  });

  it('renders clearance-violation-count with correct count', () => {
    render(
      <ClearanceViolationPanel
        violations={[makeViolation('d1'), makeViolation('d2')]}
        onClose={vi.fn()}
      />,
    );
    const count = screen.getByTestId('clearance-violation-count');
    expect(count.textContent).toContain('2');
  });

  it('renders one row per violation', () => {
    const violations = [
      makeViolation('d1'),
      makeViolation('w1', 'window'),
      makeViolation('s1', 'stair'),
    ];
    render(<ClearanceViolationPanel violations={violations} onClose={vi.fn()} />);
    expect(screen.getByTestId('clearance-violation-d1')).toBeDefined();
    expect(screen.getByTestId('clearance-violation-w1')).toBeDefined();
    expect(screen.getByTestId('clearance-violation-s1')).toBeDefined();
  });

  it('renders singular "issue" when there is exactly one violation', () => {
    render(<ClearanceViolationPanel violations={[makeViolation('d1')]} onClose={vi.fn()} />);
    const count = screen.getByTestId('clearance-violation-count');
    expect(count.textContent).toContain('1 clearance issue');
    expect(count.textContent).not.toContain('issues');
  });

  it('renders plural "issues" when there are multiple violations', () => {
    render(
      <ClearanceViolationPanel
        violations={[makeViolation('d1'), makeViolation('d2')]}
        onClose={vi.fn()}
      />,
    );
    const count = screen.getByTestId('clearance-violation-count');
    expect(count.textContent).toContain('issues');
  });
});
