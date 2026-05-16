import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { PrintPlotDialog } from './PrintPlotDialog';

afterEach(() => {
  cleanup();
});

const noopClose = vi.fn();
const mockSheets = [{ id: 'sheet-1', name: 'Sheet 1', element: null }];

describe('PrintPlotDialog — §6.5 + §12.4.5', () => {
  it('renders print-plot-dialog when open=true', () => {
    render(<PrintPlotDialog open={true} onClose={noopClose} sheets={mockSheets} />);
    expect(screen.getByTestId('print-plot-dialog')).toBeDefined();
  });

  it('does not render when open=false', () => {
    render(<PrintPlotDialog open={false} onClose={noopClose} sheets={mockSheets} />);
    expect(screen.queryByTestId('print-plot-dialog')).toBeNull();
  });

  it('paper size select has A4, A3, A2, A1, A0 options', () => {
    render(<PrintPlotDialog open={true} onClose={noopClose} sheets={mockSheets} />);
    const select = screen.getByTestId('print-paper-size') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('A4');
    expect(values).toContain('A3');
    expect(values).toContain('A2');
    expect(values).toContain('A1');
    expect(values).toContain('A0');
  });

  it('orientation select has portrait and landscape options', () => {
    render(<PrintPlotDialog open={true} onClose={noopClose} sheets={mockSheets} />);
    const select = screen.getByTestId('print-orientation') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('portrait');
    expect(values).toContain('landscape');
  });

  it('export pdf button exists', () => {
    render(<PrintPlotDialog open={true} onClose={noopClose} sheets={mockSheets} />);
    expect(screen.getByTestId('print-export-pdf')).toBeDefined();
  });
});
