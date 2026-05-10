import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import {
  Inspector,
  InspectorDrawer,
  NumericField,
  evaluateExpression,
  type InspectorSelection,
} from './Inspector';
import i18n from '../../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    ),
  });
}

afterEach(() => {
  cleanup();
});

const selection: InspectorSelection = {
  label: 'Wall · Generic 200 mm',
  id: 'seed-w-eg-south-main',
};

describe('Inspector — spec §13', () => {
  it('renders nothing (absent from DOM) when selection is null — CHR-V3-06', () => {
    const { container } = renderWithI18n(
      <Inspector
        selection={null}
        tabs={{ properties: <div /> }}
        emptyStateActions={[
          { hotkey: 'W', label: 'Draw a wall' },
          { hotkey: 'D', label: 'Insert a door' },
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders header, three tabs, and Properties body when selection set', () => {
    const { getByText, getAllByRole } = renderWithI18n(
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

  it('renames the Properties tab for type and instance contexts', () => {
    const { getAllByRole, rerender } = renderWithI18n(
      <Inspector
        selection={{ label: 'Wall Type · Generic 200', id: 'wt-1' }}
        propertiesContext="type"
        tabs={{
          properties: <div>type props</div>,
          constraints: <div>constraints</div>,
          identity: <div>identity</div>,
        }}
      />,
    );
    expect(getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Type',
      'Constraints',
      'Identity',
    ]);

    rerender(
      <I18nextProvider i18n={i18n}>
        <Inspector
          selection={selection}
          propertiesContext="instance"
          tabs={{
            properties: <div>instance props</div>,
            constraints: <div>constraints</div>,
            identity: <div>identity</div>,
          }}
        />
      </I18nextProvider>,
    );
    expect(getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Instance',
      'Constraints',
      'Identity',
    ]);
  });

  it('switches body when tab is clicked', () => {
    const { getByText, queryByText } = renderWithI18n(
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
    const { getByRole, getByText } = renderWithI18n(
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
    const { queryByText, rerender, getByText } = renderWithI18n(
      <Inspector
        selection={selection}
        tabs={{ properties: <div>props</div> }}
        onApply={onApply}
        onReset={onReset}
      />,
    );
    expect(queryByText('Apply (⏎)')).toBeNull();
    rerender(
      <I18nextProvider i18n={i18n}>
        <Inspector
          selection={selection}
          tabs={{ properties: <div>props</div> }}
          onApply={onApply}
          onReset={onReset}
          dirty
        />
      </I18nextProvider>,
    );
    expect(getByText('Apply (⏎)')).toBeTruthy();
    fireEvent.click(getByText('Apply (⏎)'));
    expect(onApply).toHaveBeenCalled();
    fireEvent.click(getByText('Reset (Esc)'));
    expect(onReset).toHaveBeenCalled();
  });

  it('emits onClearSelection when the close button is clicked', () => {
    const onClearSelection = vi.fn();
    const { getByLabelText } = renderWithI18n(
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

describe('Inspector — CHR-V3-06 applies-to radio', () => {
  it('hides the radio when siblingCount is 1 (default)', () => {
    const { queryByRole } = renderWithI18n(
      <Inspector selection={selection} tabs={{ properties: <div>props</div> }} />,
    );
    expect(queryByRole('radiogroup')).toBeNull();
  });

  it('shows the radio when siblingCount > 1', () => {
    const { getByRole } = renderWithI18n(
      <Inspector selection={selection} tabs={{ properties: <div>props</div> }} siblingCount={4} />,
    );
    expect(getByRole('radiogroup', { name: 'Applies to' })).toBeTruthy();
  });

  it('fires onApplyScopeChange with "all" when that option is chosen', () => {
    const onApplyScopeChange = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <Inspector
        selection={selection}
        tabs={{ properties: <div>props</div> }}
        siblingCount={3}
        onApplyScopeChange={onApplyScopeChange}
      />,
    );
    fireEvent.click(getByLabelText('all 3'));
    expect(onApplyScopeChange).toHaveBeenCalledWith('all');
  });
});

describe('InspectorDrawer — CHR-V3-06', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = renderWithI18n(
      <InspectorDrawer open={false} title="Edit type" onClose={() => undefined}>
        <div>drawer content</div>
      </InspectorDrawer>,
    );
    expect(queryByTestId('inspector-drawer')).toBeNull();
  });

  it('renders title and children when open', () => {
    const { getByTestId, getByText } = renderWithI18n(
      <InspectorDrawer open={true} title="Edit type" onClose={() => undefined}>
        <div>drawer content</div>
      </InspectorDrawer>,
    );
    expect(getByTestId('inspector-drawer')).toBeTruthy();
    expect(getByText('Edit type')).toBeTruthy();
    expect(getByText('drawer content')).toBeTruthy();
  });

  it('calls onClose when the scrim is clicked', () => {
    const onClose = vi.fn();
    const { getByTestId } = renderWithI18n(
      <InspectorDrawer open={true} title="Edit type" onClose={onClose}>
        <div>content</div>
      </InspectorDrawer>,
    );
    fireEvent.click(getByTestId('inspector-drawer-scrim'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderWithI18n(
      <InspectorDrawer open={true} title="Edit type" onClose={onClose}>
        <div>content</div>
      </InspectorDrawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
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
    const { getByLabelText } = renderWithI18n(
      <NumericField label="Width" valueMm={1500} onCommitMm={() => undefined} unit="m" />,
    );
    expect((getByLabelText('Width') as HTMLInputElement).value).toBe('1.500');
  });

  it('cycles units mm → cm → m → mm', () => {
    const { getByRole } = renderWithI18n(
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
    const { getByLabelText } = renderWithI18n(
      <NumericField label="Width" valueMm={1500} onCommitMm={onCommitMm} />,
    );
    const input = getByLabelText('Width') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2400 + 200' } });
    fireEvent.blur(input);
    expect(onCommitMm).toHaveBeenCalledWith(2600);
  });

  it('flags invalid expressions via aria-invalid', () => {
    const { getByLabelText } = renderWithI18n(
      <NumericField label="Width" valueMm={1500} onCommitMm={() => undefined} />,
    );
    const input = getByLabelText('Width') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'wat' } });
    fireEvent.blur(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
