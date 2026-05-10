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
    mockStore.elementsById['pv-1'].categoryOverrides = {};
  });

  it('renders a Revit-scale model category catalogue when open', () => {
    render(<VVDialog open={true} onClose={() => {}} />);
    expect(screen.getAllByTestId(/^vv-category-row-/)).toHaveLength(100);
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
    expect(screen.getByText('Mechanical Equipment')).toBeDefined();
    expect(screen.getByText('Structural Foundations')).toBeDefined();
    expect(screen.getByText('Duct Systems')).toBeDefined();
  });

  it('renders a Revit-scale annotation category catalogue', () => {
    render(<VVDialog open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('vv-tab-annotation'));

    expect(screen.getAllByTestId(/^vv-category-row-/)).toHaveLength(65);
    expect(screen.getByText('Text Notes')).toBeDefined();
    expect(screen.getByText('Revision Clouds')).toBeDefined();
    expect(screen.getByText('Spot Elevations')).toBeDefined();
    expect(screen.getByText('Multi-Category Tags')).toBeDefined();
  });

  it('filters the category catalogue with search', () => {
    render(<VVDialog open={true} onClose={() => {}} />);

    fireEvent.change(screen.getByTestId('vv-category-search'), {
      target: { value: 'mechanical' },
    });

    expect(screen.getByText('Mechanical Equipment')).toBeDefined();
    expect(screen.queryByText('Walls')).toBeNull();
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

  it('exposes projection and cut transparency controls for model and annotation categories', () => {
    render(<VVDialog open={true} onClose={() => {}} />);
    expect(screen.getByLabelText('Walls projection transparency')).toBeDefined();
    expect(screen.getByLabelText('Walls cut transparency')).toBeDefined();

    fireEvent.click(screen.getByTestId('vv-tab-annotation'));
    expect(screen.getByLabelText('Text Notes projection transparency')).toBeDefined();
    expect(screen.getByLabelText('Text Notes cut transparency')).toBeDefined();
  });

  it('reads existing category transparency overrides into the matrix', () => {
    mockStore.elementsById['pv-1'].categoryOverrides = {
      wall: {
        projection: { transparency: 35 },
        cut: { transparency: 80 },
      },
    };

    render(<VVDialog open={true} onClose={() => {}} />);

    expect((screen.getByLabelText('Walls projection transparency') as HTMLInputElement).value).toBe(
      '35',
    );
    expect((screen.getByLabelText('Walls cut transparency') as HTMLInputElement).value).toBe('80');
  });

  it('persists projection and cut transparency overrides on Apply', () => {
    render(<VVDialog open={true} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('Walls projection transparency'), {
      target: { value: '45' },
    });
    fireEvent.change(screen.getByLabelText('Walls cut transparency'), {
      target: { value: '70' },
    });
    fireEvent.click(screen.getByText('Apply'));

    expect(mockSetCategoryOverride).toHaveBeenCalledWith(
      'pv-1',
      'wall',
      expect.objectContaining({
        projection: expect.objectContaining({ transparency: 45 }),
        cut: expect.objectContaining({ transparency: 70 }),
      }),
    );
  });
});
