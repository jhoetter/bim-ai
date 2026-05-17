/**
 * §8.6.4 — stair inspector — additional field tests.
 *
 * Tests for run-width, total-height, riser-height and multi-storey
 * fields added by wave16/F on top of the pre-existing riser-count /
 * tread-depth inputs (covered by stairInspector.test.tsx in the
 * inspector sub-folder).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from '../workspace/inspector/InspectorContent';
import i18n from '../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const baseStair: Extract<Element, { kind: 'stair' }> = {
  kind: 'stair',
  id: 'stair-wave16',
  name: 'Wave-16 Stair',
  baseLevelId: 'lvl-ground',
  topLevelId: 'lvl-upper',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 4000, yMm: 0 },
  widthMm: 1100,
  riserMm: 175,
  treadMm: 280,
  riserCount: 16,
};

describe('stair inspector — §8.6.4', () => {
  it('renders inspector-stair-riser-count input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(baseStair, t));
    expect(getByTestId('inspector-stair-riser-count')).toBeTruthy();
  });

  it('renders inspector-stair-run-width input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(baseStair, t));
    expect(getByTestId('inspector-stair-run-width')).toBeTruthy();
  });

  it('renders inspector-stair-total-height readout', () => {
    const { getByTestId } = render(InspectorPropertiesFor(baseStair, t));
    expect(getByTestId('inspector-stair-total-height')).toBeTruthy();
  });

  it('renders inspector-stair-riser-height input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(baseStair, t));
    expect(getByTestId('inspector-stair-riser-height')).toBeTruthy();
  });

  it('renders inspector-stair-multi-storey checkbox', () => {
    const { getByTestId } = render(InspectorPropertiesFor(baseStair, t));
    expect(getByTestId('inspector-stair-multi-storey')).toBeTruthy();
  });

  it('changing riser count calls onPropertyChange', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(baseStair, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-stair-riser-count') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '18' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('riserCount', 18);
  });

  it('changing run width calls onPropertyChange with runWidthMm', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(baseStair, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-stair-run-width') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1200' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('runWidthMm', 1200);
  });

  it('total-height readout shows riserCount * riserMm when no override', () => {
    const { getByTestId } = render(InspectorPropertiesFor(baseStair, t));
    const span = getByTestId('inspector-stair-total-height');
    const expected = (baseStair.riserCount ?? 0) * (baseStair.riserMm ?? 175);
    expect(span.textContent).toBe(String(expected));
  });

  it('total-height readout shows totalHeightMm when set', () => {
    const stair: Extract<Element, { kind: 'stair' }> = {
      ...baseStair,
      id: 'stair-total-ht',
      totalHeightMm: 3200,
    };
    const { getByTestId } = render(InspectorPropertiesFor(stair, t));
    expect(getByTestId('inspector-stair-total-height').textContent).toBe('3200');
  });

  it('run-width defaults to widthMm when runWidthMm not set', () => {
    const { getByTestId } = render(InspectorPropertiesFor(baseStair, t));
    const input = getByTestId('inspector-stair-run-width') as HTMLInputElement;
    expect(Number(input.value)).toBe(baseStair.widthMm);
  });

  it('landing-depth input is NOT rendered for single-run stair', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(baseStair, t));
    expect(queryByTestId('inspector-stair-landing-depth')).toBeNull();
  });

  it('landing-depth input IS rendered for stair with ≥2 runs', () => {
    const multiRunStair: Extract<Element, { kind: 'stair' }> = {
      ...baseStair,
      id: 'stair-multi-run',
      shape: 'l_shape',
      runs: [
        {
          id: 'run-0',
          startMm: { xMm: 0, yMm: 0 },
          endMm: { xMm: 2000, yMm: 0 },
          widthMm: 1100,
          riserCount: 8,
        },
        {
          id: 'run-1',
          startMm: { xMm: 2000, yMm: 0 },
          endMm: { xMm: 2000, yMm: 2000 },
          widthMm: 1100,
          riserCount: 8,
        },
      ],
    };
    const { getByTestId } = render(InspectorPropertiesFor(multiRunStair, t));
    expect(getByTestId('inspector-stair-landing-depth')).toBeTruthy();
  });

  it('multi-storey checkbox is unchecked by default', () => {
    const { getByTestId } = render(InspectorPropertiesFor(baseStair, t));
    const cb = getByTestId('inspector-stair-multi-storey') as HTMLInputElement;
    expect(cb.checked).toBe(false);
  });

  it('multi-storey checkbox reflects el.multiStorey=true', () => {
    const stair: Extract<Element, { kind: 'stair' }> = {
      ...baseStair,
      id: 'stair-ms',
      multiStorey: true,
    };
    const { getByTestId } = render(InspectorPropertiesFor(stair, t));
    const cb = getByTestId('inspector-stair-multi-storey') as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });
});
