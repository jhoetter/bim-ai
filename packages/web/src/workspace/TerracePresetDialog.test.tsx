import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TerracePresetDialog } from './TerracePresetDialog';

afterEach(() => {
  cleanup();
});

describe('TerracePresetDialog — §2.9.1', () => {
  it('renders dialog', () => {
    render(<TerracePresetDialog floorId="f1" onApply={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId('terrace-preset-dialog')).toBeTruthy();
  });

  it('calls onApply with railing height', () => {
    const onApply = vi.fn();
    render(<TerracePresetDialog floorId="f1" onApply={onApply} onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('terrace-railing-height-input'), {
      target: { value: '900' },
    });
    fireEvent.click(screen.getByTestId('terrace-preset-apply'));
    expect(onApply).toHaveBeenCalledWith(900);
  });

  it('calls onClose on cancel', () => {
    const onClose = vi.fn();
    render(<TerracePresetDialog floorId="f1" onApply={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('terrace-preset-cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
