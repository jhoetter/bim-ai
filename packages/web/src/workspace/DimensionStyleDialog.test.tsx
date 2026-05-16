import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
import { DimensionStyleDialog } from './DimensionStyleDialog';

const defaultStyle = {
  textHeightMm: 2.5,
  witnessLineExtensionMm: 2,
  witnessLineGapMm: 1,
  arrowStyle: 'arrow' as const,
  showUnit: false,
};

describe('DimensionStyleDialog — §4.2.4', () => {
  it('renders dimension-style-dialog when open=true', () => {
    render(
      <DimensionStyleDialog
        open={true}
        onClose={vi.fn()}
        currentStyle={defaultStyle}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('dimension-style-dialog')).toBeTruthy();
  });

  it('does not render when open=false', () => {
    render(
      <DimensionStyleDialog
        open={false}
        onClose={vi.fn()}
        currentStyle={defaultStyle}
        onSave={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('dimension-style-dialog')).toBeNull();
  });

  it('text height input shows current textHeightMm', () => {
    render(
      <DimensionStyleDialog
        open={true}
        onClose={vi.fn()}
        currentStyle={{ ...defaultStyle, textHeightMm: 3.5 }}
        onSave={vi.fn()}
      />,
    );
    const input = screen.getByTestId('dim-style-text-height') as HTMLInputElement;
    expect(parseFloat(input.value)).toBe(3.5);
  });

  it('arrow style select has arrow/dot/tick/none options', () => {
    render(
      <DimensionStyleDialog
        open={true}
        onClose={vi.fn()}
        currentStyle={defaultStyle}
        onSave={vi.fn()}
      />,
    );
    const select = screen.getByTestId('dim-style-arrow-style') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('arrow');
    expect(options).toContain('dot');
    expect(options).toContain('tick');
    expect(options).toContain('none');
  });

  it('save button calls onSave with updated style', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <DimensionStyleDialog
        open={true}
        onClose={onClose}
        currentStyle={defaultStyle}
        onSave={onSave}
      />,
    );
    const input = screen.getByTestId('dim-style-text-height') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('dim-style-save'));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]![0].textHeightMm).toBe(4);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancel button calls onClose without saving', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <DimensionStyleDialog
        open={true}
        onClose={onClose}
        currentStyle={defaultStyle}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByTestId('dim-style-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
