import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Inspector, NumericField, evaluateExpression, type InspectorSelection } from './Inspector';

afterEach(() => {
  cleanup();
});

const selection: InspectorSelection = {
  label: 'Wall · Generic 200 mm',
  id: 'seed-w-eg-south-main',
};

describe('Inspector — spec §13', () => {
  it('renders the empty state with quick actions when nothing is selected', () => {
    const { getByText } = render(
      <Inspector
        selection={null}
        tabs={{ properties: <div /> }}
        emptyStateActions={[
          { hotkey: 'W', label: 'Draw a wall' },
          { hotkey: 'D', label: 'Insert a door' },
        ]}
      />,
    );
    expect(getByText('No selection.')).toBeTruthy();
    expect(getByText('Draw a wall')).toBeTruthy();
    expect(getByText('Insert a door')).toBeTruthy();
  });

  it('renders header, three tabs, and Properties body when selection set', () => {
    const { getByText, getAllByRole } = render(
      <Inspector
        selection={selection}
        tabs={{
          properties: <div data-testid="props-body">props</div>,
          constraints: <div>constraints</div>,
          identity: <div>identity</div>,
        }}
      />,
    );
    expect(getByText('Wall · Generic 200 mm')).toBeTruthy();
    const tabs = getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Properties', 'Constraints', 'Identity']);
    expect(getByText('props')).toBeTruthy();
  });

  it('switches body when tab is clicked', () => {
    const { getByText, queryByText } = render(
      <Inspector
        selection={selection}
        tabs={{
          properties: <div>props</div>,
          constraints: <div>constraints</div>,
          identity: <div>identity</div>,
        }}
      />,
    );
    expect(queryByText('constraints')).toBeNull();
    fireEvent.click(getByText('Constraints'));
    expect(getByText('constraints')).toBeTruthy();
  });

  it('cycles tabs with ArrowLeft / ArrowRight', () => {
    const { getByRole, getByText } = render(
      <Inspector
        selection={selection}
        tabs={{
          properties: <div>props</div>,
          constraints: <div>constraints</div>,
          identity: <div>identity</div>,
        }}
      />,
    );
    const tablist = getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(getByText('constraints')).toBeTruthy();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(getByText('identity')).toBeTruthy();
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(getByText('constraints')).toBeTruthy();
  });

  it('shows Apply / Reset footer only when dirty', () => {
    const onApply = vi.fn();
    const onReset = vi.fn();
    const { queryByText, rerender, getByText } = render(
      <Inspector
        selection={selection}
        tabs={{ properties: <div>props</div> }}
        onApply={onApply}
        onReset={onReset}
      />,
    );
    expect(queryByText('Apply (⏎)')).toBeNull();
    rerender(
      <Inspector
        selection={selection}
        tabs={{ properties: <div>props</div> }}
        onApply={onApply}
        onReset={onReset}
        dirty
      />,
    );
    expect(getByText('Apply (⏎)')).toBeTruthy();
    fireEvent.click(getByText('Apply (⏎)'));
    expect(onApply).toHaveBeenCalled();
    fireEvent.click(getByText('Reset (Esc)'));
    expect(onReset).toHaveBeenCalled();
  });

  it('emits onClearSelection when the close button is clicked', () => {
    const onClearSelection = vi.fn();
    const { getByLabelText } = render(
      <Inspector
        selection={selection}
        tabs={{ properties: <div>props</div> }}
        onClearSelection={onClearSelection}
      />,
    );
    fireEvent.click(getByLabelText('Close'));
    expect(onClearSelection).toHaveBeenCalled();
  });
});

describe('evaluateExpression — §13.3 numeric grammar', () => {
  it('evaluates simple arithmetic', () => {
    expect(evaluateExpression('2400 + 200')).toBe(2600);
    expect(evaluateExpression('1500 / 2')).toBe(750);
    expect(evaluateExpression('(100 + 50) * 2')).toBe(300);
  });
  it('returns null for non-numeric input', () => {
    expect(evaluateExpression('alert(1)')).toBeNull();
    expect(evaluateExpression('drop database')).toBeNull();
    expect(evaluateExpression('')).toBeNull();
  });
});

describe('NumericField', () => {
  it('renders the value in the chosen unit', () => {
    const { getByLabelText } = render(
      <NumericField label="Width" valueMm={1500} onCommitMm={() => undefined} unit="m" />,
    );
    expect((getByLabelText('Width') as HTMLInputElement).value).toBe('1.500');
  });

  it('cycles units mm → cm → m → mm', () => {
    const { getByRole } = render(
      <NumericField label="Width" valueMm={1500} onCommitMm={() => undefined} />,
    );
    const chip = getByRole('button');
    expect(chip.textContent).toBe('mm');
    fireEvent.click(chip);
    expect(chip.textContent).toBe('cm');
    fireEvent.click(chip);
    expect(chip.textContent).toBe('m');
    fireEvent.click(chip);
    expect(chip.textContent).toBe('mm');
  });

  it('commits an expression on blur', () => {
    const onCommitMm = vi.fn();
    const { getByLabelText } = render(
      <NumericField label="Width" valueMm={1500} onCommitMm={onCommitMm} />,
    );
    const input = getByLabelText('Width') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2400 + 200' } });
    fireEvent.blur(input);
    expect(onCommitMm).toHaveBeenCalledWith(2600);
  });

  it('flags invalid expressions via aria-invalid', () => {
    const { getByLabelText } = render(
      <NumericField label="Width" valueMm={1500} onCommitMm={() => undefined} />,
    );
    const input = getByLabelText('Width') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'wat' } });
    fireEvent.blur(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
