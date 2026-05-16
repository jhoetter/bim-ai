import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const conn: Extract<Element, { kind: 'steel_connection' }> = {
  kind: 'steel_connection',
  id: 'conn-1',
  connectionType: 'end_plate',
  hostElementId: 'beam-1',
  positionT: 1.0,
  plateSizeMm: { width: 150, height: 200, thickness: 10 },
  boltRows: 2,
  boltCols: 2,
  boltDiameterMm: 20,
};

describe('steel connection inspector — §9.5.1', () => {
  it('renders connection type select', () => {
    const { getByTestId } = render(InspectorPropertiesFor(conn, t));
    const select = getByTestId('inspector-steel-connection-type') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('end_plate');
  });

  it('connection type select has all three options', () => {
    const { getByTestId } = render(InspectorPropertiesFor(conn, t));
    const select = getByTestId('inspector-steel-connection-type') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('end_plate');
    expect(values).toContain('bolted_flange');
    expect(values).toContain('shear_tab');
  });

  it('changing type dispatches update_element_property', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(conn, t, { onPropertyChange: onChange }));
    const select = getByTestId('inspector-steel-connection-type') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'bolted_flange' } });
    expect(onChange).toHaveBeenCalledWith('connectionType', 'bolted_flange');
  });

  it('bolt rows input exists', () => {
    const { getByTestId } = render(InspectorPropertiesFor(conn, t));
    const input = getByTestId('inspector-steel-bolt-rows') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(Number(input.defaultValue)).toBe(2);
  });

  it('bolt cols input exists', () => {
    const { getByTestId } = render(InspectorPropertiesFor(conn, t));
    const input = getByTestId('inspector-steel-bolt-cols') as HTMLInputElement;
    expect(input).toBeTruthy();
  });

  it('plate width input exists with default 150', () => {
    const { getByTestId } = render(InspectorPropertiesFor(conn, t));
    const input = getByTestId('inspector-steel-plate-width') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(Number(input.defaultValue)).toBe(150);
  });

  it('plate height input exists with default 200', () => {
    const { getByTestId } = render(InspectorPropertiesFor(conn, t));
    const input = getByTestId('inspector-steel-plate-height') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(Number(input.defaultValue)).toBe(200);
  });

  it('bolt diameter input exists with default 20', () => {
    const { getByTestId } = render(InspectorPropertiesFor(conn, t));
    const input = getByTestId('inspector-steel-bolt-diameter') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(Number(input.defaultValue)).toBe(20);
  });
});
