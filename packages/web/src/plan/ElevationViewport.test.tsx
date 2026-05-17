/**
 * §6.1.4 — ElevationViewport component tests.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import type { Element } from '@bim-ai/core';

import { ElevationViewport } from './ElevationViewport';

afterEach(() => {
  cleanup();
});

const view: Extract<Element, { kind: 'elevation_view' }> = {
  kind: 'elevation_view',
  id: 'ev-N',
  name: 'North Elevation',
  direction: 'north',
};

const level: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-1',
  name: 'Level 1',
  elevationMm: 0,
};

const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'w-1',
  name: 'Wall 1',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

describe('ElevationViewport — §6.1.4', () => {
  it('renders elevation-viewport-empty when no lines', () => {
    const { getByTestId } = render(
      <ElevationViewport view={view} elementsById={{}} widthPx={800} heightPx={600} />,
    );
    const empty = getByTestId('elevation-viewport-empty');
    expect(empty).toBeDefined();
    expect(empty.textContent).toContain('No geometry to display');
  });

  it('renders elevation-viewport-svg when lines present', () => {
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'w-1': wall,
    };
    const { getByTestId } = render(
      <ElevationViewport view={view} elementsById={elementsById} widthPx={800} heightPx={600} />,
    );
    const svg = getByTestId('elevation-viewport-svg');
    expect(svg).toBeDefined();
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('SVG contains <line> elements for each projected line', () => {
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'w-1': wall,
    };
    const { getByTestId } = render(
      <ElevationViewport view={view} elementsById={elementsById} widthPx={800} heightPx={600} />,
    );
    const svg = getByTestId('elevation-viewport-svg');
    const lineEls = svg.querySelectorAll('line');
    // A single wall produces 4 lines (top, bottom, left, right)
    expect(lineEls.length).toBe(4);
  });
});
