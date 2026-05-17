import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const beam: Extract<Element, { kind: 'beam' }> = {
  kind: 'beam',
  id: 'beam-bp-1',
  name: 'Profile Beam',
  levelId: 'lvl-ground',
  startMm: { xMm: 0, yMm: 0 },
  endMm: { xMm: 6000, yMm: 0 },
  widthMm: 200,
  heightMm: 400,
};

describe('beam profile inspector — §9.2', () => {
  it('renders profile type select with rectangular default', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beam, t));
    const select = getByTestId('inspector-beam-profile-type') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('rectangular');
  });

  it('profile type select has all 5 options', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beam, t));
    const select = getByTestId('inspector-beam-profile-type') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('rectangular');
    expect(values).toContain('I-beam');
    expect(values).toContain('H-beam');
    expect(values).toContain('HSS-round');
    expect(values).toContain('HSS-square');
  });

  it('shows flange/web inputs when I-beam selected', () => {
    const iBeam: Extract<Element, { kind: 'beam' }> = {
      ...beam,
      id: 'beam-bp-2',
      beamProfileType: 'I-beam',
    };
    const { getByTestId } = render(InspectorPropertiesFor(iBeam, t));
    expect(getByTestId('inspector-beam-flange-width-bp')).toBeTruthy();
    expect(getByTestId('inspector-beam-flange-thickness-bp')).toBeTruthy();
    expect(getByTestId('inspector-beam-web-thickness-bp')).toBeTruthy();
  });

  it('shows flange/web inputs when H-beam selected', () => {
    const hBeam: Extract<Element, { kind: 'beam' }> = {
      ...beam,
      id: 'beam-bp-3',
      beamProfileType: 'H-beam',
    };
    const { getByTestId } = render(InspectorPropertiesFor(hBeam, t));
    expect(getByTestId('inspector-beam-flange-width-bp')).toBeTruthy();
    expect(getByTestId('inspector-beam-web-thickness-bp')).toBeTruthy();
  });

  it('shows wall thickness input when HSS-round selected', () => {
    const hssRound: Extract<Element, { kind: 'beam' }> = {
      ...beam,
      id: 'beam-bp-4',
      beamProfileType: 'HSS-round',
    };
    const { getByTestId } = render(InspectorPropertiesFor(hssRound, t));
    expect(getByTestId('inspector-beam-wall-thickness')).toBeTruthy();
  });

  it('shows wall thickness input when HSS-square selected', () => {
    const hssSquare: Extract<Element, { kind: 'beam' }> = {
      ...beam,
      id: 'beam-bp-5',
      beamProfileType: 'HSS-square',
    };
    const { getByTestId } = render(InspectorPropertiesFor(hssSquare, t));
    expect(getByTestId('inspector-beam-wall-thickness')).toBeTruthy();
  });

  it('hides flange/web inputs for rectangular profile', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(beam, t));
    expect(queryByTestId('inspector-beam-flange-width-bp')).toBeNull();
    expect(queryByTestId('inspector-beam-web-thickness-bp')).toBeNull();
  });

  it('hides wall thickness for rectangular profile', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(beam, t));
    expect(queryByTestId('inspector-beam-wall-thickness')).toBeNull();
  });

  it('changing profile type dispatches beamProfileType property change', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(beam, t, { onPropertyChange: onChange }));
    const select = getByTestId('inspector-beam-profile-type') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'I-beam' } });
    expect(onChange).toHaveBeenCalledWith('beamProfileType', 'I-beam');
  });
});
