/**
 * CHR-V3-08 — ToolModifierBar.tsx unit tests.
 *
 * Covers: wall acceptance (alignment cycle, Loop, Multiple, Tag-on-Place)
 *         and door acceptance (swing-side cycle). Presentational component
 *         only; zustand wiring is tested via toolPrefsStore.test.ts.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { ToolModifierBar } from './ToolModifierBar';
import { getToolModifierDescriptors } from './modifierBar';

afterEach(cleanup);

function wallProps(overrides: Partial<Parameters<typeof ToolModifierBar>[0]> = {}) {
  const descriptors = getToolModifierDescriptors('wall');
  return {
    activeTool: 'wall' as const,
    descriptors,
    getToggle: (_id: string) => false,
    onToggle: vi.fn(),
    getCycle: (id: string) => (id === 'location-line' ? 'wall-centerline' : ''),
    onCycleAdvance: vi.fn(),
    ...overrides,
  };
}

function doorProps(overrides: Partial<Parameters<typeof ToolModifierBar>[0]> = {}) {
  const descriptors = getToolModifierDescriptors('door');
  return {
    activeTool: 'door' as const,
    descriptors,
    getToggle: (_id: string) => false,
    onToggle: vi.fn(),
    getCycle: (_id: string) => 'left',
    onCycleAdvance: vi.fn(),
    ...overrides,
  };
}

describe('<ToolModifierBar /> — null / empty cases', () => {
  it('renders nothing when activeTool is null', () => {
    const { container } = render(
      <ToolModifierBar
        activeTool={null}
        descriptors={[]}
        getToggle={() => false}
        onToggle={vi.fn()}
        getCycle={() => ''}
        onCycleAdvance={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when descriptors are empty (e.g. select tool)', () => {
    const { container } = render(
      <ToolModifierBar
        activeTool={'select' as never}
        descriptors={[]}
        getToggle={() => false}
        onToggle={vi.fn()}
        getCycle={() => ''}
        onCycleAdvance={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('<ToolModifierBar /> — Wall acceptance', () => {
  it('renders the modifier bar toolbar for the wall tool', () => {
    const { getByTestId } = render(<ToolModifierBar {...wallProps()} />);
    expect(getByTestId('tool-modifier-bar')).toBeTruthy();
  });

  it('shows location-line cycle chip with current value label', () => {
    const { getByTestId } = render(<ToolModifierBar {...wallProps()} />);
    const chip = getByTestId('modifier-cycle-location-line');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('Centerline');
  });

  it('clicking the location-line chip fires onCycleAdvance', () => {
    const onCycleAdvance = vi.fn();
    const { getByTestId } = render(<ToolModifierBar {...wallProps({ onCycleAdvance })} />);
    fireEvent.click(getByTestId('modifier-cycle-location-line'));
    expect(onCycleAdvance).toHaveBeenCalledWith('location-line');
  });

  it('shows loop toggle chip', () => {
    const { getByTestId } = render(<ToolModifierBar {...wallProps()} />);
    expect(getByTestId('modifier-toggle-loop')).toBeTruthy();
  });

  it('loop toggle reflects on/off state via aria-checked', () => {
    const { getByTestId, rerender } = render(
      <ToolModifierBar {...wallProps({ getToggle: (_id) => false })} />,
    );
    expect(getByTestId('modifier-toggle-loop').getAttribute('aria-checked')).toBe('false');

    rerender(<ToolModifierBar {...wallProps({ getToggle: (id) => id === 'loop' })} />);
    expect(getByTestId('modifier-toggle-loop').getAttribute('aria-checked')).toBe('true');
  });

  it('clicking loop toggle fires onToggle with flipped value', () => {
    const onToggle = vi.fn();
    const { getByTestId } = render(
      <ToolModifierBar {...wallProps({ getToggle: () => false, onToggle })} />,
    );
    fireEvent.click(getByTestId('modifier-toggle-loop'));
    expect(onToggle).toHaveBeenCalledWith('loop', true);
  });

  it('shows multiple toggle chip', () => {
    const { getByTestId } = render(<ToolModifierBar {...wallProps()} />);
    expect(getByTestId('modifier-toggle-multiple')).toBeTruthy();
  });

  it('shows tag-on-place toggle chip', () => {
    const { getByTestId } = render(<ToolModifierBar {...wallProps()} />);
    expect(getByTestId('modifier-toggle-tag-on-place')).toBeTruthy();
  });

  it('shows always-armed numeric chip', () => {
    const { getByTestId } = render(<ToolModifierBar {...wallProps()} />);
    expect(getByTestId('modifier-armed-numeric')).toBeTruthy();
  });
});

describe('<ToolModifierBar /> — Door acceptance', () => {
  it('renders the modifier bar for the door tool', () => {
    const { getByTestId } = render(<ToolModifierBar {...doorProps()} />);
    expect(getByTestId('tool-modifier-bar')).toBeTruthy();
  });

  it('shows swing-side cycle chip with current label', () => {
    const { getByTestId } = render(<ToolModifierBar {...doorProps()} />);
    const chip = getByTestId('modifier-cycle-swing-side');
    expect(chip.textContent).toContain('Left');
  });

  it('clicking swing-side cycle fires onCycleAdvance', () => {
    const onCycleAdvance = vi.fn();
    const { getByTestId } = render(<ToolModifierBar {...doorProps({ onCycleAdvance })} />);
    fireEvent.click(getByTestId('modifier-cycle-swing-side'));
    expect(onCycleAdvance).toHaveBeenCalledWith('swing-side');
  });

  it('shows multiple toggle for door', () => {
    const { getByTestId } = render(<ToolModifierBar {...doorProps()} />);
    expect(getByTestId('modifier-toggle-multiple')).toBeTruthy();
  });
});
