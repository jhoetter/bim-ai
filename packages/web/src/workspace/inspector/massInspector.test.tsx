import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const massBox: Extract<Element, { kind: 'mass_box' }> = {
  kind: 'mass_box',
  id: 'mass-1',
  insertionXMm: 0,
  insertionYMm: 0,
  baseElevationMm: 0,
  widthMm: 1000,
  depthMm: 2000,
  heightMm: 3000,
};

describe('mass inspector actions', () => {
  it('dispatches mass generation commands', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(massBox, t, { onDispatchCommand }));

    fireEvent.click(getByTestId('mass-gen-floors-btn'));
    fireEvent.click(getByTestId('mass-apply-curtain-btn'));

    expect(onDispatchCommand).toHaveBeenCalledWith({
      type: 'generate_floors_from_mass',
      massId: 'mass-1',
    });
    expect(onDispatchCommand).toHaveBeenCalledWith({
      type: 'apply_curtain_to_mass',
      massId: 'mass-1',
    });
  });
});
