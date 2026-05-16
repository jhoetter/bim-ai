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
  id: 'beam-1',
  name: 'Test Beam',
  levelId: 'lvl-ground',
  startMm: { xMm: 0, yMm: 0 },
  endMm: { xMm: 5000, yMm: 0 },
  widthMm: 200,
  heightMm: 400,
};

const beamWithIProfile: Extract<Element, { kind: 'beam' }> = {
  ...beam,
  id: 'beam-2',
  sectionProfile: 'I',
  flangeWidthMm: 150,
  webThicknessMm: 10,
  flangeThicknessMm: 20,
};

describe('beam inspector — §9.2', () => {
  it('renders section profile select', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beam, t));
    const select = getByTestId('inspector-beam-section-profile') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('rectangular');
  });

  it('profile select has all 7 options', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beam, t));
    const select = getByTestId('inspector-beam-section-profile') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('rectangular');
    expect(values).toContain('I');
    expect(values).toContain('H');
    expect(values).toContain('C');
    expect(values).toContain('L');
    expect(values).toContain('T');
    expect(values).toContain('HSS');
  });

  it('flange-width input shown for I profile', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beamWithIProfile, t));
    expect(getByTestId('inspector-beam-flange-width')).toBeTruthy();
  });

  it('web-thickness input shown for I profile', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beamWithIProfile, t));
    expect(getByTestId('inspector-beam-web-thickness')).toBeTruthy();
  });

  it('flange-thickness input shown for I profile', () => {
    const { getByTestId } = render(InspectorPropertiesFor(beamWithIProfile, t));
    expect(getByTestId('inspector-beam-flange-thickness')).toBeTruthy();
  });

  it('flange-width input hidden for rectangular profile', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(beam, t));
    expect(queryByTestId('inspector-beam-flange-width')).toBeNull();
  });

  it('web-thickness input hidden for rectangular profile', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(beam, t));
    expect(queryByTestId('inspector-beam-web-thickness')).toBeNull();
  });

  it('changing profile dispatches update_element_property', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(beam, t, { onPropertyChange: onChange }));
    const select = getByTestId('inspector-beam-section-profile') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'I' } });
    expect(onChange).toHaveBeenCalledWith('sectionProfile', 'I');
  });

  it('flange-width shown for H profile', () => {
    const beamH: Extract<Element, { kind: 'beam' }> = {
      ...beam,
      id: 'beam-h',
      sectionProfile: 'H',
    };
    const { getByTestId } = render(InspectorPropertiesFor(beamH, t));
    expect(getByTestId('inspector-beam-flange-width')).toBeTruthy();
  });

  it('flange-width shown for C profile but not web/flange thickness', () => {
    const beamC: Extract<Element, { kind: 'beam' }> = {
      ...beam,
      id: 'beam-c',
      sectionProfile: 'C',
    };
    const { getByTestId, queryByTestId } = render(InspectorPropertiesFor(beamC, t));
    expect(getByTestId('inspector-beam-flange-width')).toBeTruthy();
    expect(queryByTestId('inspector-beam-web-thickness')).toBeNull();
  });
});
