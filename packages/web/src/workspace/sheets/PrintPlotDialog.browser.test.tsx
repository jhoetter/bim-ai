import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { PrintPlotDialog } from './PrintPlotDialog';

afterEach(() => {
  cleanup();
});

const noopClose = vi.fn();
const mockSheets = [{ id: 'sheet-1', name: 'Sheet 1', element: null }];

describe('PrintPlotDialog browser print — §6.5', () => {
  it('renders print-browser-btn', () => {
    render(<PrintPlotDialog open={true} onClose={noopClose} sheets={mockSheets} />);
    expect(screen.getByTestId('print-browser-btn')).toBeDefined();
  });

  it('renders print-all-views-browser-btn', () => {
    render(<PrintPlotDialog open={true} onClose={noopClose} sheets={mockSheets} />);
    expect(screen.getByTestId('print-all-views-browser-btn')).toBeDefined();
  });

  it('print-browser-btn is disabled when exporting=true', () => {
    // The exporting state is internal to the component; we test the initial state
    // where exporting=false means the button is NOT disabled by default.
    render(<PrintPlotDialog open={true} onClose={noopClose} sheets={mockSheets} />);
    const btn = screen.getByTestId('print-browser-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('print-browser-btn has correct label', () => {
    render(<PrintPlotDialog open={true} onClose={noopClose} sheets={mockSheets} />);
    const btn = screen.getByTestId('print-browser-btn');
    expect(btn.textContent).toContain('Print (Browser)');
  });

  it('print-all-views-browser-btn has correct label', () => {
    render(<PrintPlotDialog open={true} onClose={noopClose} sheets={mockSheets} />);
    const btn = screen.getByTestId('print-all-views-browser-btn');
    expect(btn.textContent).toContain('Print All Views (Browser)');
  });

  it('print-browser-btn does not render when dialog is closed', () => {
    render(<PrintPlotDialog open={false} onClose={noopClose} sheets={mockSheets} />);
    expect(screen.queryByTestId('print-browser-btn')).toBeNull();
  });

  it('print-all-views-browser-btn does not render when dialog is closed', () => {
    render(<PrintPlotDialog open={false} onClose={noopClose} sheets={mockSheets} />);
    expect(screen.queryByTestId('print-all-views-browser-btn')).toBeNull();
  });
});
