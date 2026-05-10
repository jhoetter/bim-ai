import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { VVDialog } from './VVDialog';

// Mock useBimStore
const mockSetCategoryOverride = vi.fn();
const mockStore = {
  activePlanViewId: 'pv-1',
  elementsById: {
    'pv-1': {
      kind: 'plan_view',
      id: 'pv-1',
      name: 'Level 1 Floor Plan',
      levelId: 'lv-1',
      categoryOverrides: {},
    },
  },
  setCategoryOverride: mockSetCategoryOverride,
};

vi.mock('../../state/store', () => ({
  useBimStore: (selector: (s: typeof mockStore) => unknown) => selector(mockStore),
}));

afterEach(() => {
  cleanup();
});

describe('VVDialog', () => {
  beforeEach(() => {
    mockSetCategoryOverride.mockClear();
  });

  it('renders with 15 model category rows when open', () => {
    render(<VVDialog open={true} onClose={() => {}} />);
    // 15 model categories
    expect(screen.getByText('Walls')).toBeDefined();
    expect(screen.getByText('Floors')).toBeDefined();
    expect(screen.getByText('Roofs')).toBeDefined();
    expect(screen.getByText('Ceilings')).toBeDefined();
    expect(screen.getByText('Columns')).toBeDefined();
    expect(screen.getByText('Structural Framing')).toBeDefined();
    expect(screen.getByText('Stairs')).toBeDefined();
    expect(screen.getByText('Railings')).toBeDefined();
    expect(screen.getByText('Doors')).toBeDefined();
    expect(screen.getByText('Windows')).toBeDefined();
    expect(screen.getByText('Rooms')).toBeDefined();
    expect(screen.getByText('Furniture / Generic Models')).toBeDefined();
    expect(screen.getByText('Property Lines')).toBeDefined();
    expect(screen.getByText('Site')).toBeDefined();
    expect(screen.getByText('Site / Origin')).toBeDefined();
  });

  it('does not render when closed', () => {
    render(<VVDialog open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('unchecking a visibility checkbox sets draft visible = false', () => {
    render(<VVDialog open={true} onClose={() => {}} />);
    const wallCheckbox = screen.getByLabelText('Walls visible');
    expect((wallCheckbox as HTMLInputElement).checked).toBe(true);
    fireEvent.click(wallCheckbox);
    expect((wallCheckbox as HTMLInputElement).checked).toBe(false);
  });

  it('clicking Apply calls setCategoryOverride for changed categories', () => {
    render(<VVDialog open={true} onClose={() => {}} />);
    // Uncheck Walls
    const wallCheckbox = screen.getByLabelText('Walls visible');
    fireEvent.click(wallCheckbox);
    // Click Apply
    fireEvent.click(screen.getByText('Apply'));
    // Should have called setCategoryOverride at least once
    expect(mockSetCategoryOverride).toHaveBeenCalled();
    // Should have been called with planViewId = 'pv-1' and categoryKey = 'wall'
    expect(mockSetCategoryOverride).toHaveBeenCalledWith(
      'pv-1',
      'wall',
      expect.objectContaining({ visible: false }),
    );
  });

  it('clicking Cancel does not call setCategoryOverride', () => {
    const onClose = vi.fn();
    render(<VVDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockSetCategoryOverride).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking OK calls setCategoryOverride and closes', () => {
    const onClose = vi.fn();
    render(<VVDialog open={true} onClose={onClose} />);
    const wallCheckbox = screen.getByLabelText('Walls visible');
    fireEvent.click(wallCheckbox);
    fireEvent.click(screen.getByText('OK'));
    expect(mockSetCategoryOverride).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
