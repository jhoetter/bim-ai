import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';

import { WallContextMenu } from './WallContextMenu';

afterEach(() => {
  cleanup();
});

const wallEW: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'w-EW',
  name: 'South façade',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

describe('ANN-02 — WallContextMenu', () => {
  it('renders Generate Section Cut and Generate Elevation entries', () => {
    const { getByTestId } = render(
      <WallContextMenu
        wall={wallEW}
        position={{ x: 100, y: 100 }}
        onCommand={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(getByTestId('wall-context-menu-section')).toBeTruthy();
    expect(getByTestId('wall-context-menu-elevation')).toBeTruthy();
  });

  it('clicking Generate Section Cut emits a createSectionCut command + closes', () => {
    const onCommand = vi.fn();
    const onClose = vi.fn();
    const { getByTestId } = render(
      <WallContextMenu
        wall={wallEW}
        position={{ x: 100, y: 100 }}
        onCommand={onCommand}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByTestId('wall-context-menu-section'));
    expect(onCommand).toHaveBeenCalledTimes(1);
    const arg = onCommand.mock.calls[0][0];
    expect(arg.kind).toBe('section_cut');
    expect(typeof arg.sectionCutId).toBe('string');
    expect(arg.cmd.type).toBe('createSectionCut');
    // Section runs perpendicular to the wall through its midpoint (3000, 0).
    expect(arg.cmd.lineStartMm.xMm).toBeCloseTo(3000);
    expect(arg.cmd.lineEndMm.xMm).toBeCloseTo(3000);
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Generate Elevation emits a createElevationView command with a snapped direction', () => {
    const onCommand = vi.fn();
    const { getByTestId } = render(
      <WallContextMenu
        wall={wallEW}
        position={{ x: 100, y: 100 }}
        onCommand={onCommand}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByTestId('wall-context-menu-elevation'));
    const arg = onCommand.mock.calls[0][0];
    expect(arg.kind).toBe('elevation_view');
    expect(arg.cmd.type).toBe('createElevationView');
    expect(['north', 'south']).toContain(arg.cmd.direction);
    expect(typeof arg.elevationViewId).toBe('string');
  });

  it('Escape key closes the menu', () => {
    const onClose = vi.fn();
    render(
      <WallContextMenu
        wall={wallEW}
        position={{ x: 100, y: 100 }}
        onCommand={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking outside closes the menu', () => {
    const onClose = vi.fn();
    render(
      <div>
        <button type="button" data-testid="outside">
          outside
        </button>
        <WallContextMenu
          wall={wallEW}
          position={{ x: 100, y: 100 }}
          onCommand={vi.fn()}
          onClose={onClose}
        />
      </div>,
    );
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});
