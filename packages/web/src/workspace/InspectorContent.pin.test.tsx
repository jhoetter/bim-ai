import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPinToggle } from './InspectorContent';

afterEach(() => {
  cleanup();
});

const wall: Element = {
  kind: 'wall',
  id: 'wall-1',
  name: 'W1',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

const wallTypeEl: Element = {
  kind: 'wall_type',
  id: 'wt-1',
  name: 'WT1',
  layers: [],
};

describe('InspectorPinToggle — VIE-07', () => {
  it('emits pinElement when clicked on an unpinned element', () => {
    const onPin = vi.fn();
    const onUnpin = vi.fn();
    const { getByRole } = render(<InspectorPinToggle el={wall} onPin={onPin} onUnpin={onUnpin} />);
    const toggle = getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onPin).toHaveBeenCalledWith('wall-1');
    expect(onUnpin).not.toHaveBeenCalled();
  });

  it('emits unpinElement when clicked on a pinned element', () => {
    const onPin = vi.fn();
    const onUnpin = vi.fn();
    const pinnedWall: Element = { ...wall, pinned: true };
    const { getByRole } = render(
      <InspectorPinToggle el={pinnedWall} onPin={onPin} onUnpin={onUnpin} />,
    );
    const toggle = getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    expect(onUnpin).toHaveBeenCalledWith('wall-1');
    expect(onPin).not.toHaveBeenCalled();
  });

  it('renders nothing for non-pinnable element kinds', () => {
    const onPin = vi.fn();
    const onUnpin = vi.fn();
    const { container } = render(
      <InspectorPinToggle el={wallTypeEl} onPin={onPin} onUnpin={onUnpin} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
