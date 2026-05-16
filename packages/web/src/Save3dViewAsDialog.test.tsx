/**
 * D5 — Save 3D View As dialog tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Save3dViewAsDialog } from './Save3dViewAsDialog';

afterEach(cleanup);

describe('Save3dViewAsDialog — D5', () => {
  it('renders nothing when isOpen=false', () => {
    const { queryByTestId } = render(
      <Save3dViewAsDialog
        isOpen={false}
        suggestedName="View 1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(queryByTestId('save-3d-view-as-dialog')).toBeNull();
  });

  it('renders the dialog when isOpen=true', () => {
    const { getByTestId } = render(
      <Save3dViewAsDialog
        isOpen={true}
        suggestedName="View 1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(getByTestId('save-3d-view-as-dialog')).toBeTruthy();
  });

  it('pre-fills the input with suggestedName', () => {
    const { getByTestId } = render(
      <Save3dViewAsDialog
        isOpen={true}
        suggestedName="Kitchen Detail"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const input = getByTestId('save-3d-view-as-name-input') as HTMLInputElement;
    expect(input.value).toBe('Kitchen Detail');
  });

  it('calls onSave with the entered name when Save is clicked', () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <Save3dViewAsDialog
        isOpen={true}
        suggestedName="View 1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const input = getByTestId('save-3d-view-as-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'North Elevation View' } });
    fireEvent.click(getByTestId('save-3d-view-as-save'));
    expect(onSave).toHaveBeenCalledWith('North Elevation View');
  });

  it('calls onSave with trimmed name when Enter is pressed', () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <Save3dViewAsDialog
        isOpen={true}
        suggestedName="View 1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const input = getByTestId('save-3d-view-as-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  Living Room 3D  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('Living Room 3D');
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <Save3dViewAsDialog
        isOpen={true}
        suggestedName="View 1"
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(getByTestId('save-3d-view-as-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <Save3dViewAsDialog
        isOpen={true}
        suggestedName="View 1"
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const input = getByTestId('save-3d-view-as-name-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not call onSave when name is empty', () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <Save3dViewAsDialog isOpen={true} suggestedName="" onSave={onSave} onCancel={vi.fn()} />,
    );
    const input = getByTestId('save-3d-view-as-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
  });
});
