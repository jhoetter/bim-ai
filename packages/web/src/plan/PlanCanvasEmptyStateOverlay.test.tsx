import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlanCanvasEmptyStateOverlay } from './PlanCanvasEmptyStateOverlay';

afterEach(cleanup);

describe('PlanCanvasEmptyStateOverlay', () => {
  it('renders the empty level message only when visible', () => {
    const hidden = render(<PlanCanvasEmptyStateOverlay visible={false} />);
    expect(hidden.queryByText('This level is empty.')).toBeNull();
    hidden.unmount();

    const shown = render(<PlanCanvasEmptyStateOverlay visible />);
    expect(shown.getByText('This level is empty.')).toBeTruthy();
  });
});
