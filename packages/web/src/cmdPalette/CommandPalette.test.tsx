import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { CommandPalette } from './CommandPalette';
import { _clearRegistry, registerCommand, type PaletteContext } from './registry';

const PLAN_CONTEXT: PaletteContext = {
  selectedElementIds: [],
  activeViewId: null,
  activeMode: 'plan',
};

beforeEach(() => {
  _clearRegistry();
});

afterEach(() => {
  cleanup();
  _clearRegistry();
});

describe('<CommandPalette /> context sections', () => {
  it('groups visible commands by resolved context badge', () => {
    registerCommand({
      id: 'theme.toggle',
      label: 'Toggle Theme',
      category: 'command',
      invoke: vi.fn(),
    });
    registerCommand({
      id: 'tool.wall',
      label: 'Place Wall',
      category: 'command',
      invoke: vi.fn(),
    });
    registerCommand({
      id: 'view.3d.fit',
      label: '3D: Fit Model',
      category: 'command',
      invoke: vi.fn(),
    });

    render(<CommandPalette isOpen onClose={vi.fn()} context={PLAN_CONTEXT} />);

    expect(screen.getByTestId('cmd-palette-section-universal')).toBeTruthy();
    expect(screen.getByTestId('cmd-palette-section-plan-3d')).toBeTruthy();
    expect(screen.getByTestId('cmd-palette-section-unavailable')).toBeTruthy();
    expect(screen.getByTestId('palette-entry-badge-theme.toggle').textContent).toBe('Universal');
    expect(screen.getByTestId('palette-entry-badge-view.3d.fit').textContent).toBe('Unavailable');
  });
});
