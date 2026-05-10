import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { useBimStore } from '../../state/store';

import { TemporaryVisibilityChip } from './TemporaryVisibilityChip';

afterEach(() => {
  useBimStore.setState({ temporaryVisibility: null });
  cleanup();
});

describe('VIE-04 — TemporaryVisibilityChip', () => {
  it('renders nothing when no override is active', () => {
    const { container } = render(<TemporaryVisibilityChip />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the active override mode + categories', () => {
    useBimStore.setState({
      temporaryVisibility: { viewId: 'pv-1', mode: 'isolate', categories: ['wall'] },
    });
    const { getByTestId } = render(<TemporaryVisibilityChip />);
    const chip = getByTestId('temp-visibility-chip');
    expect(chip.textContent).toContain('Isolate');
    expect(chip.textContent).toContain('wall');
  });

  it('clicking clears the override', () => {
    useBimStore.setState({
      temporaryVisibility: { viewId: 'pv-1', mode: 'hide', categories: ['door'] },
    });
    const { getByTestId } = render(<TemporaryVisibilityChip />);
    fireEvent.click(getByTestId('temp-visibility-chip'));
    expect(useBimStore.getState().temporaryVisibility).toBeNull();
  });
});
