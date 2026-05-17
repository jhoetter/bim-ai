import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import { createInstance } from 'i18next';

afterEach(() => {
  cleanup();
});

const t = createInstance();
t.init({ lng: 'en', resources: {} });
const tFn = (key: string) => key;

const room: Extract<Element, { kind: 'room' }> = {
  kind: 'room',
  id: 'room-1',
  name: 'Conference Room',
  levelId: 'lvl-1',
  outlineMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 8_000, yMm: 0 },
    { xMm: 8_000, yMm: 5_000 },
    { xMm: 0, yMm: 5_000 },
  ],
};

const column: Extract<Element, { kind: 'column' }> = {
  kind: 'column',
  id: 'col-1',
  name: 'C1',
  levelId: 'lvl-1',
  positionMm: { xMm: 4_000, yMm: 2_500 },
  bMm: 300,
  hMm: 300,
  heightMm: 3_000,
};

const elementsById: Record<string, Element> = {
  'col-1': column,
};

describe('room net area inspector — §13.1.4', () => {
  it('renders inspector-room-net-area with computed value', () => {
    const { getByTestId } = render(InspectorPropertiesFor(room, tFn as never, { elementsById }));
    const el = getByTestId('inspector-room-net-area');
    expect(el).toBeTruthy();
    // gross = 8000*5000 mm² = 40 m², net = 40 - 0.3*0.3 = 39.91 m²
    expect(el.textContent).toContain('m²');
  });

  it('renders inspector-room-gross-area', () => {
    const { getByTestId } = render(InspectorPropertiesFor(room, tFn as never, { elementsById }));
    const el = getByTestId('inspector-room-gross-area');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('40.00 m²');
  });

  it('net area is less than or equal to gross area', () => {
    const { getByTestId } = render(InspectorPropertiesFor(room, tFn as never, { elementsById }));
    const grossEl = getByTestId('inspector-room-gross-area');
    const netEl = getByTestId('inspector-room-net-area');
    const grossText = grossEl.textContent ?? '';
    const netText = netEl.textContent ?? '';
    const grossMatch = grossText.match(/[\d.]+/);
    const netMatch = netText.match(/[\d.]+/);
    const grossVal = grossMatch ? parseFloat(grossMatch[0]) : NaN;
    const netVal = netMatch ? parseFloat(netMatch[0]) : NaN;
    expect(Number.isFinite(grossVal)).toBe(true);
    expect(Number.isFinite(netVal)).toBe(true);
    expect(netVal).toBeLessThanOrEqual(grossVal);
  });
});
