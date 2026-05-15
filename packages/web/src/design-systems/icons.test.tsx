import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Icons, IconLabels, ICON_SIZE, StairsIcon } from '@bim-ai/ui';

const requiredKeys = [
  'select',
  'wall',
  'door',
  'window',
  'floor',
  'roof',
  'stair',
  'railing',
  'room',
  'dimension',
  'section',
  'sheet',
  'schedule',
  'family',
  'saveViewpoint',
  'layerOn',
  'layerOff',
  'viewCubeReset',
  'undo',
  'redo',
  'themeLight',
  'themeDark',
  'commandPalette',
  'search',
  'settings',
  'hamburger',
  'collaborators',
  'close',
  'agent',
  'evidence',
  'advisorWarning',
  'online',
  'snap',
  'grid',
  'tag',
] as const;

describe('icon registry — §10.1 chrome assignments', () => {
  it.each(requiredKeys)('exposes Icons.%s', (key) => {
    expect(Icons[key]).toBeDefined();
  });

  it.each(requiredKeys)('has an aria-label default for %s', (key) => {
    expect(IconLabels[key]).toBeTruthy();
  });

  it.each(requiredKeys)('renders an svg element for %s', (key) => {
    const Icon = Icons[key];
    const { container } = render(<Icon aria-label={IconLabels[key]} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});

describe('default sizes — §10', () => {
  it('exposes the documented chrome size tokens', () => {
    expect(ICON_SIZE.chrome).toBe(16);
    expect(ICON_SIZE.toolPalette).toBe(18);
    expect(ICON_SIZE.topbar).toBe(20);
  });
});

describe('custom StairsIcon', () => {
  it('renders an svg with currentColor stroke', () => {
    const { container } = render(<StairsIcon aria-label="Stair" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('stroke')).toBe('currentColor');
  });

  it('respects a custom size', () => {
    const { container } = render(<StairsIcon size={32} aria-label="Stair" />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('32');
    expect(svg!.getAttribute('height')).toBe('32');
  });
});
