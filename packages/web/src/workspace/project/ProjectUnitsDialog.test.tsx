import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectUnitsDialog } from './ProjectUnitsDialog';

// Mock useBimStore
const mockStore = {
  modelId: 'model-1',
  elementsById: {
    'ps-1': {
      kind: 'project_settings',
      id: 'ps-1',
      name: 'Test Project',
      lengthUnitFull: 'mm',
      areaUnit: 'm2',
      decimalSymbol: '.',
    },
  },
};

vi.mock('../../state/store', () => ({
  useBimStore: (selector: (s: typeof mockStore) => unknown) => selector(mockStore),
}));

afterEach(() => {
  cleanup();
});

describe('ProjectUnitsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<ProjectUnitsDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('project-units-dialog')).toBeNull();
  });

  it('renders dropdowns with current unit values', () => {
    render(<ProjectUnitsDialog open onClose={vi.fn()} />);

    const lengthSelect = screen.getByTestId('project-units-length') as HTMLSelectElement;
    const areaSelect = screen.getByTestId('project-units-area') as HTMLSelectElement;
    const decimalSelect = screen.getByTestId('project-units-decimal') as HTMLSelectElement;

    expect(lengthSelect.value).toBe('mm');
    expect(areaSelect.value).toBe('m2');
    expect(decimalSelect.value).toBe('.');
  });

  it('shows a live preview', () => {
    render(<ProjectUnitsDialog open onClose={vi.fn()} />);
    const preview = screen.getByTestId('project-units-preview');
    expect(preview.textContent).toContain('3500 mm');
  });

  it('switching to m updates preview with decimal formatting', () => {
    render(<ProjectUnitsDialog open onClose={vi.fn()} />);

    const lengthSelect = screen.getByTestId('project-units-length') as HTMLSelectElement;
    fireEvent.change(lengthSelect, { target: { value: 'm' } });

    const preview = screen.getByTestId('project-units-preview');
    expect(preview.textContent).toContain('3.50 m');
  });

  it('switching length to m and clicking Save dispatches updateElementProperty', async () => {
    const mockApply = vi.fn().mockResolvedValue({ ok: true });

    render(<ProjectUnitsDialog open onClose={vi.fn()} applyCommandImpl={mockApply} />);

    const lengthSelect = screen.getByTestId('project-units-length') as HTMLSelectElement;
    fireEvent.change(lengthSelect, { target: { value: 'm' } });

    fireEvent.click(screen.getByTestId('project-units-save'));

    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith(
        'model-1',
        expect.objectContaining({
          type: 'updateElementProperty',
          id: 'ps-1',
          property: 'lengthUnitFull',
          value: 'm',
        }),
      );
    });
  });

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn();
    render(<ProjectUnitsDialog open onClose={onClose} />);

    fireEvent.click(screen.getByTestId('project-units-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
