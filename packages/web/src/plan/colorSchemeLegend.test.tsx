import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { ColorSchemeLegend } from './ColorSchemeLegend';

afterEach(() => {
  cleanup();
});

/* eslint-disable bim-ai/no-hex-in-chrome */
const ROWS = [
  { colorHex: '#ff0000', label: 'Living Room', count: 3 },
  { colorHex: '#00ff00', label: 'Bedroom', count: 2 },
];
/* eslint-enable bim-ai/no-hex-in-chrome */

describe('color fill legend — §13.1.3', () => {
  it('renders legend rows with swatches and labels', () => {
    const { getByTestId } = render(
      <ColorSchemeLegend rows={ROWS} title="By Name" visible onClose={vi.fn()} />,
    );
    expect(getByTestId('color-scheme-legend')).toBeTruthy();
    expect(getByTestId('color-scheme-legend-title').textContent).toBe('By Name');
    expect(getByTestId('legend-swatch-0')).toBeTruthy();
    expect(getByTestId('legend-label-0').textContent).toBe('Living Room');
    expect(getByTestId('legend-swatch-1')).toBeTruthy();
    expect(getByTestId('legend-label-1').textContent).toBe('Bedroom');
  });

  it('does not render when visible=false', () => {
    const { queryByTestId } = render(
      <ColorSchemeLegend rows={ROWS} title="By Name" visible={false} onClose={vi.fn()} />,
    );
    expect(queryByTestId('color-scheme-legend')).toBeNull();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <ColorSchemeLegend rows={ROWS} title="By Name" visible onClose={onClose} />,
    );
    fireEvent.click(getByTestId('color-scheme-legend-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render when rows is empty', () => {
    const { queryByTestId } = render(
      <ColorSchemeLegend rows={[]} title="By Name" visible onClose={vi.fn()} />,
    );
    expect(queryByTestId('color-scheme-legend')).toBeNull();
  });

  it('shows count badge when count is provided', () => {
    const { getByTestId } = render(
      <ColorSchemeLegend rows={ROWS} title="By Name" visible onClose={vi.fn()} />,
    );
    expect(getByTestId('legend-count-0').textContent).toBe('3');
    expect(getByTestId('legend-count-1').textContent).toBe('2');
  });
});
