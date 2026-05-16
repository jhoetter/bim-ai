import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const beamSystem: Extract<Element, { kind: 'beam_system' }> = {
  kind: 'beam_system',
  id: 'bs-1',
  name: 'Test Beam System',
  levelId: 'lvl-ground',
  boundaryPoints: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 4000 },
    { xMm: 0, yMm: 4000 },
  ],
  beamDirection: 0,
  spacingMm: 1500,
  directionDeg: 0,
};

describe('beam system inspector — §9.3', () => {
  it('renders inspector-beam-spacing input with element value', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beamSystem, t));
    const input = getByTestId('inspector-beam-spacing') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(Number(input.value)).toBe(1500);
  });

  it('renders inspector-beam-direction input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beamSystem, t));
    const input = getByTestId('inspector-beam-direction') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(Number(input.value)).toBe(0);
  });

  it('renders inspector-beam-count input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beamSystem, t));
    const input = getByTestId('inspector-beam-count') as HTMLInputElement;
    expect(input).toBeTruthy();
  });

  it('renders inspector-beam-justification select', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beamSystem, t));
    const select = getByTestId('inspector-beam-justification') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('beginning');
    expect(values).toContain('center');
    expect(values).toContain('end');
  });

  it('spacing change dispatches update_element_property for spacingMm', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(beamSystem, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-beam-spacing') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '2000' } });
    expect(onChange).toHaveBeenCalledWith('spacingMm', 2000);
  });

  it('direction change dispatches onPropertyChange for directionDeg', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(beamSystem, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-beam-direction') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '45' } });
    expect(onChange).toHaveBeenCalledWith('directionDeg', 45);
  });

  it('beam count blur with empty value dispatches null', () => {
    const onChange = vi.fn();
    const bsWithCount: Extract<Element, { kind: 'beam_system' }> = {
      ...beamSystem,
      id: 'bs-2',
      beamCount: 5,
    };
    const { getByTestId } = render(
      InspectorPropertiesFor(bsWithCount, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-beam-count') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('beamCount', null);
  });

  it('justification change dispatches onPropertyChange', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(beamSystem, t, { onPropertyChange: onChange }),
    );
    const select = getByTestId('inspector-beam-justification') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'end' } });
    expect(onChange).toHaveBeenCalledWith('justification', 'end');
  });
});
