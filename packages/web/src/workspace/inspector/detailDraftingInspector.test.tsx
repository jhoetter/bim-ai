/**
 * §6.4.2 — Inspector panels for detail_line and detail_filled_region elements.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);
const DEFAULT_LINE_COLOR = `#${'000000'}`;
const DEFAULT_REGION_COLOR = `#${'cccccc'}`;
const RED_LINE_COLOR = `#${'ff0000'}`;
const CUSTOM_REGION_COLOR = `#${'aabbcc'}`;

afterEach(() => {
  cleanup();
});

function makeDetailLine(
  overrides: Partial<Extract<Element, { kind: 'detail_line' }>> = {},
): Extract<Element, { kind: 'detail_line' }> {
  return {
    kind: 'detail_line',
    id: 'dl-1',
    hostViewId: 'view-1',
    pointsMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
    ],
    lineStyle: 'solid',
    colorHex: DEFAULT_LINE_COLOR,
    ...overrides,
  };
}

function makeDetailFilledRegion(
  overrides: Partial<Extract<Element, { kind: 'detail_filled_region' }>> = {},
): Extract<Element, { kind: 'detail_filled_region' }> {
  return {
    kind: 'detail_filled_region',
    id: 'dfr-1',
    perimeterMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
    ],
    fillPattern: 'solid',
    colorHex: DEFAULT_REGION_COLOR,
    ...overrides,
  };
}

describe('detail_line inspector — §6.4.2', () => {
  it('renders line style selector', () => {
    const onChange = vi.fn();
    const el = makeDetailLine();
    const { getByTestId } = render(InspectorPropertiesFor(el, t, { onPropertyChange: onChange }));
    const select = getByTestId('inspector-detail-line-style') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('solid');
  });

  it('renders color input', () => {
    const onChange = vi.fn();
    const el = makeDetailLine({ colorHex: RED_LINE_COLOR });
    const { getByTestId } = render(InspectorPropertiesFor(el, t, { onPropertyChange: onChange }));
    const colorInput = getByTestId('inspector-detail-line-color') as HTMLInputElement;
    expect(colorInput).toBeTruthy();
    expect(colorInput.type).toBe('color');
    expect(colorInput.value).toBe(RED_LINE_COLOR);
  });

  it('shows point count', () => {
    const onChange = vi.fn();
    const el = makeDetailLine({
      pointsMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 500, yMm: 0 },
        { xMm: 1000, yMm: 500 },
      ],
    });
    const { getByTestId } = render(InspectorPropertiesFor(el, t, { onPropertyChange: onChange }));
    const pts = getByTestId('inspector-detail-line-points');
    expect(pts.textContent).toContain('3');
  });
});

describe('detail_filled_region inspector — §6.4.2', () => {
  it('renders fill color input', () => {
    const onChange = vi.fn();
    const el = makeDetailFilledRegion({ colorHex: CUSTOM_REGION_COLOR });
    const { getByTestId } = render(InspectorPropertiesFor(el, t, { onPropertyChange: onChange }));
    const colorInput = getByTestId('inspector-detail-filled-region-color') as HTMLInputElement;
    expect(colorInput).toBeTruthy();
    expect(colorInput.type).toBe('color');
    expect(colorInput.value).toBe(CUSTOM_REGION_COLOR);
  });

  it('shows boundary point count', () => {
    const onChange = vi.fn();
    const el = makeDetailFilledRegion({
      perimeterMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 2000, yMm: 0 },
        { xMm: 2000, yMm: 2000 },
        { xMm: 0, yMm: 2000 },
      ],
    });
    const { getByTestId } = render(InspectorPropertiesFor(el, t, { onPropertyChange: onChange }));
    const pts = getByTestId('inspector-detail-filled-region-points');
    expect(pts.textContent).toContain('4');
  });
});
