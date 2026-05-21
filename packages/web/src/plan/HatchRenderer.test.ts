import type { HatchPatternDef } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import { buildSvgHatchPatternElement } from './HatchRenderer';

function hatch(overrides: Partial<HatchPatternDef>): HatchPatternDef {
  return {
    kind: 'hatch_pattern_def',
    id: 'test-hatch',
    name: 'Test Hatch',
    patternKind: 'lines',
    paperMmRepeat: 5,
    rotationDeg: 0,
    strokeWidthMm: 0.18,
    ...overrides,
  };
}

describe('HatchRenderer structured SVG patterns', () => {
  it('builds standard hatch patterns as React SVG nodes', () => {
    const element = buildSvgHatchPatternElement(
      hatch({ patternKind: 'crosshatch' }),
      12,
      '#111',
      'safe-id',
    );

    expect(element).toBeTruthy();
    expect(element?.type).toBe('pattern');
    expect(element?.props).toMatchObject({
      id: 'safe-id',
      patternUnits: 'userSpaceOnUse',
      width: 12,
      height: 12,
    });
  });

  it('converts safe custom svgSource children without injecting markup', () => {
    const element = buildSvgHatchPatternElement(
      hatch({
        patternKind: 'svg',
        svgSource: '<line x1="0" y1="0" x2="4" y2="4" stroke="#444" stroke-width="0.5" />',
      }),
      8,
      '#111',
      'custom-safe',
    );

    expect(element).toBeTruthy();
    expect(element?.props).toMatchObject({ id: 'custom-safe' });
  });

  it('rejects custom svgSource children with event handlers', () => {
    const element = buildSvgHatchPatternElement(
      hatch({
        patternKind: 'svg',
        svgSource: '<line x1="0" y1="0" x2="4" y2="4" onclick="alert(1)" />',
      }),
      8,
      '#111',
      'custom-unsafe',
    );

    expect(element).toBeNull();
  });
});
