/**
 * EDT-06 — OptionsBar.tsx coverage.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { OptionsBar } from './OptionsBar';
import { defaultToolGrammarModifiers } from './toolGrammar';

afterEach(cleanup);

function defaultProps(overrides: Partial<Parameters<typeof OptionsBar>[0]> = {}) {
  const onChange = vi.fn();
  return {
    activeTool: 'wall' as const,
    modifiers: defaultToolGrammarModifiers(),
    onModifiersChange: onChange,
    onChange,
    ...overrides,
  };
}

describe('<OptionsBar /> — EDT-06', () => {
  it('renders nothing when no tool is active', () => {
    const { container } = render(<OptionsBar {...defaultProps({ activeTool: null })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for the select tool', () => {
    const { container } = render(
      <OptionsBar {...defaultProps({ activeTool: 'select' as never })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Chain + Tag-on-Place toggles when wall is active', () => {
    const { getByTestId, queryByTestId } = render(
      <OptionsBar {...defaultProps({ activeTool: 'wall' })} />,
    );
    expect(getByTestId('options-bar')).toBeTruthy();
    expect(getByTestId('options-bar-chain')).toBeTruthy();
    expect(getByTestId('options-bar-tag-on-place')).toBeTruthy();
    // Wall does not advertise Multiple.
    expect(queryByTestId('options-bar-multiple')).toBeNull();
    // Numeric-input hint shows for the wall tool.
    expect(getByTestId('options-bar-numeric-hint')).toBeTruthy();
  });

  it('renders Multiple + Tag-on-Place for the door tool, no Chain', () => {
    const { getByTestId, queryByTestId } = render(
      <OptionsBar {...defaultProps({ activeTool: 'door' })} />,
    );
    expect(getByTestId('options-bar-multiple')).toBeTruthy();
    expect(getByTestId('options-bar-tag-on-place')).toBeTruthy();
    expect(queryByTestId('options-bar-chain')).toBeNull();
  });

  it('toggling Chain dispatches onModifiersChange with the new flag', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <OptionsBar {...defaultProps({ activeTool: 'wall', onModifiersChange: onChange })} />,
    );
    fireEvent.click(getByTestId('options-bar-chain'));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0]![0];
    expect(next.chainable).toBe(false);
  });

  it('toggling Tag-on-Place enables the family selector', () => {
    const onChange = vi.fn();
    const { getByTestId, queryByTestId, rerender } = render(
      <OptionsBar {...defaultProps({ activeTool: 'door', onModifiersChange: onChange })} />,
    );
    expect(queryByTestId('options-bar-tag-family')).toBeNull();
    fireEvent.click(getByTestId('options-bar-tag-on-place'));
    const next = onChange.mock.calls[0]![0];
    expect(next.tagOnPlace.enabled).toBe(true);
    // Apply the toggle and re-render to confirm the dropdown shows up.
    rerender(
      <OptionsBar
        {...defaultProps({
          activeTool: 'door',
          modifiers: next,
          onModifiersChange: onChange,
        })}
      />,
    );
    expect(getByTestId('options-bar-tag-family')).toBeTruthy();
  });

  it('renders the wall location-line dropdown when wall is active', () => {
    const onLL = vi.fn();
    const { getByTestId } = render(
      <OptionsBar
        {...defaultProps({
          activeTool: 'wall',
          wallLocationLine: 'wall-centerline',
          onWallLocationLineChange: onLL,
        })}
      />,
    );
    const select = getByTestId('options-bar-wall-location-line') as HTMLSelectElement;
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: 'finish-face-exterior' } });
    expect(onLL).toHaveBeenCalledWith('finish-face-exterior');
  });
});
